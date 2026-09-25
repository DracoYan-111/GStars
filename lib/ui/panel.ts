// Search panel injected into the stars page. Lives in Shadow DOM, style-isolated from GitHub.
// All text is written via textContent; repo info is never parsed as HTML.
import type { ProgressState, RepoResult } from '../messages';
import { MIN_JEV_QUERY_LENGTH } from '../core/rank';
import { detectLocale, PLACEHOLDER_EXAMPLES, t, type Locale, type LocaleSetting } from '../i18n';
import searchIconSvg from '@/assets/icons/search.svg?raw';
import shuffleIconSvg from '@/assets/icons/shuffle-fill.svg?raw';
import thumbsUpIconSvg from '@/assets/icons/thumbs-up.svg?raw';
import { parseIcon } from './icons';
import { languageColor } from './languages';
import { PANEL_CSS } from './styles';
import { createSyncIndicator, isSyncing } from './sync-indicator';
import { createPlaceholderRotator } from './placeholder-rotator';
import { createTypewriter } from './typewriter';

const HOST_ID = 'gstars-host';
const REPO_URL_PREFIX = 'https://github.com/';
const fullNumber = new Intl.NumberFormat('en');
/** Current panel locale; module-level renderers need it too, so it lives in module scope, updated by Panel.setLocale */
let activeLocale: Locale = 'zh-CN';
const relativeTimeFor = (locale: Locale) => new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'zh-CN', { numeric: 'auto' });
const TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** Relative time matching GitHub native lists, e.g. "11 minutes ago" / "3 months ago" */
function formatUpdated(iso: string): string | null {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  const seconds = (time - Date.now()) / 1000;
  for (const [unit, size] of TIME_UNITS) {
    if (Math.abs(seconds) >= size) return relativeTimeFor(activeLocale).format(Math.round(seconds / size), unit);
  }
  return t(activeLocale, 'justNow');
}

export interface PanelHandlers {
  /** Fired on Enter or search-button click */
  onSubmit(value: string): void;
  /** Fired when the input is cleared */
  onClear(): void;
  onOpenOptions(): void;
  onRetrySync(): void;
  /** Random button click: requests a query built from this user's star seeds */
  onShuffle(locale: Locale): void;
}

export interface ProgressView {
  state: ProgressState;
  fetched: number;
  total: number;
  message?: string;
}

export interface ResultsView {
  results: RepoResult[];
  loading: boolean;
  hasQuery: boolean;
}

export interface Panel {
  host: HTMLElement;
  setNeedsKeys(needsKeys: boolean): void;
  setProgress(progress: ProgressView): void;
  setResults(view: ResultsView): void;
  setError(message: string): void;
  /** Fills in one query (no auto search) and moves the caret to the end */
  setQuery(text: string): void;
  /** Switches UI language: all rendered text (placeholder, tooltips, results, etc.) moves to the new language */
  setLocale(locale: Locale): void;
  /** Called when the panel is removed; stops timers like the placeholder rotator */
  destroy(): void;
  focus(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openRepo(repo: RepoResult | undefined): void {
  if (repo && repo.htmlUrl.startsWith(REPO_URL_PREFIX)) window.open(repo.htmlUrl, '_blank', 'noopener,noreferrer');
}

/**
 * `isFinal`: all Jev scores are in. Scores arrive in batches and the order can still change until then,
 * so the thumbs-up is only given to the final top result, never to a provisional leader.
 */
function renderItem(repo: RepoResult, index: number, selected: boolean, isFinal: boolean): HTMLLIElement {
  const item = el('li');
  // Final top result after Jev scoring: a shaking thumbs-up icon at its top-right corner
  if (index === 0 && isFinal && repo.score !== undefined) {
    item.classList.add('top');
    const badge = el('span', 'top-badge');
    badge.title = t(activeLocale, 'topMatch');
    badge.append(parseIcon(thumbsUpIconSvg, 18));
    item.append(badge);
  }
  item.id = `gstars-item-${index}`;
  item.setAttribute('role', 'option');
  item.setAttribute('aria-selected', String(selected));

  const link = el('a', 'name', repo.fullName);
  if (repo.htmlUrl.startsWith(REPO_URL_PREFIX)) link.href = repo.htmlUrl;
  link.rel = 'noopener noreferrer';
  item.append(link);

  if (repo.description) item.append(el('p', 'desc', repo.description));

  const meta = el('div', 'meta');
  if (repo.language) {
    const lang = el('span', 'lang');
    const dot = el('span', 'lang-dot');
    dot.style.backgroundColor = languageColor(repo.language);
    lang.append(dot, repo.language);
    meta.append(lang);
  }
  meta.append(el('span', undefined, `★ ${fullNumber.format(repo.stars)}`));
  meta.append(el('span', undefined, `⑂ ${fullNumber.format(repo.forks)}`));
  const updated = formatUpdated(repo.pushedAt);
  if (updated) meta.append(el('span', undefined, t(activeLocale, 'updatedAt', { time: updated })));
  if (repo.score !== undefined) meta.append(el('span', 'score', t(activeLocale, 'relevance', { score: repo.score.toFixed(2) })));
  item.append(meta);
  return item;
}

export function createPanel(username: string, handlers: PanelHandlers, localeSetting?: LocaleSetting): Panel {
  activeLocale = localeSetting && localeSetting !== 'auto' ? localeSetting : detectLocale();
  const host = el('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });

  const style = el('style', undefined, PANEL_CSS);
  const wrap = el('div', 'wrap');

  const notice = el('div', 'notice');
  notice.hidden = true;
  const openOptions = el('a');
  openOptions.href = '#';
  openOptions.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onOpenOptions();
  });

  const input = el('input');
  input.type = 'search';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'gstars-results');
  input.setAttribute('aria-expanded', 'false');
  input.autocomplete = 'off';
  input.setAttribute('aria-describedby', 'gstars-sync-badge');

  const searchButton = el('button', 'icon-button');
  searchButton.type = 'button';
  searchButton.append(parseIcon(searchIconSvg, 18));
  // Sync progress is drawn on the input: border ring + top-left x/y count
  const sync = createSyncIndicator(() => activeLocale);
  const searchBox = el('div', 'search-box');
  const shuffleButton = el('button', 'icon-button');
  shuffleButton.type = 'button';
  shuffleButton.append(parseIcon(shuffleIconSvg, 18));
  shuffleButton.addEventListener('click', () => handlers.onShuffle(activeLocale));
  const actions = el('div', 'actions');
  actions.append(shuffleButton, searchButton);
  searchBox.append(input, actions, sync.ring, sync.badge);

  // On sync failure shows the reason below the input with a retry
  const progress = el('div', 'progress error');
  const progressLabel = el('span');
  const retry = el('button', 'retry');
  retry.type = 'button';
  retry.addEventListener('click', () => handlers.onRetrySync());
  progress.append(progressLabel, ' ', retry);
  progress.hidden = true;

  const errorBanner = el('div', 'error-banner');
  errorBanner.setAttribute('role', 'alert');
  errorBanner.hidden = true;
  const status = el('div', 'loading');
  status.hidden = true;
  const list = el('ul');
  list.id = 'gstars-results';
  list.setAttribute('role', 'listbox');

  wrap.append(notice, searchBox, progress, errorBanner, status, list);
  root.append(style, wrap);

  let results: RepoResult[] = [];
  let lastProgress: ProgressView | null = null;
  let lastView: ResultsView | null = null;
  const placeholder = createPlaceholderRotator(
    input,
    () => t(activeLocale, 'searchPlaceholderPrefix', { username }),
    () => PLACEHOLDER_EXAMPLES[activeLocale],
  );
  /** -1 means nothing selected; Enter opens the selected repo, otherwise Enter searches */
  let selected = -1;

  const typewriter = createTypewriter(input);
  // When the user starts acting (keys, paste, ...), the in-flight random sentence completes at once to avoid mixing with input
  input.addEventListener('beforeinput', () => typewriter.finish());

  /**
   * While Jev is ranking, the query is taken out of the input and a "finding the best match" hint is shown in
   * its place; the query comes back once the final ranking arrives. null = not matching.
   */
  let matchingQuery: string | null = null;

  const idlePlaceholder = () => {
    if (lastProgress && isSyncing(lastProgress.state)) {
      input.placeholder = t(activeLocale, 'syncingPlaceholder', { username });
    } else {
      placeholder.restart();
    }
  };

  const startMatching = (query: string) => {
    matchingQuery = query;
    placeholder.stop();
    input.value = '';
    input.placeholder = t(activeLocale, 'matchingPlaceholder');
    input.classList.add('matching');
    input.setAttribute('aria-busy', 'true');
  };

  /** `restore`: put the query back (ranking done / failed). False when the user already typed something new. */
  const endMatching = (restore: boolean) => {
    if (matchingQuery === null) return;
    if (restore) {
      input.value = matchingQuery;
      input.setSelectionRange(matchingQuery.length, matchingQuery.length);
    }
    matchingQuery = null;
    input.classList.remove('matching');
    input.removeAttribute('aria-busy');
    idlePlaceholder();
  };

  const submit = () => {
    typewriter.finish();
    const value = input.value.trim();
    if (!value) return;
    // Queries too short for Jev only get keyword results, which arrive at once: no matching phase
    if (value.length >= MIN_JEV_QUERY_LENGTH) startMatching(value);
    handlers.onSubmit(value);
  };
  searchButton.addEventListener('click', () => {
    submit();
    input.focus();
  });

  const updateSelection = (next: number) => {
    selected = next;
    Array.from(list.children).forEach((child, i) => child.setAttribute('aria-selected', String(i === selected)));
    const active = list.children[selected] as HTMLElement | undefined;
    if (active) {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  // Shadow DOM retargets events bubbling to document onto the host div, so GitHub global shortcuts
  // (s, / to focus search, etc.) no longer recognize this as an input. Stop key events from bubbling out.
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  input.addEventListener('input', () => {
    endMatching(false); // The user is typing a new query: do not bring the old one back over it
    updateSelection(-1); // Query changed, Enter should search again instead of opening the stale result
    if (input.value.trim() === '') handlers.onClear();
  });
  input.addEventListener('keydown', (event) => {
    typewriter.finish();
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.isComposing) return; // Enter during IME composition does not trigger
      if (selected >= 0) openRepo(results[selected]);
      else submit();
      return;
    }
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      updateSelection(Math.min(results.length - 1, selected + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      updateSelection(Math.max(-1, selected - 1));
    }
  });
  list.addEventListener('click', (event) => {
    const item = (event.target as Element).closest('li');
    if (!item) return;
    const index = Array.from(list.children).indexOf(item);
    if (index < 0) return;
    if ((event.target as Element).closest('a')) return; // Link clicks use the default browser behavior
    updateSelection(index);
    openRepo(results[index]);
  });

  function renderProgressLabel(): void {
    const message = lastProgress?.message ?? t(activeLocale, 'unknownError');
    progressLabel.textContent = t(activeLocale, 'syncFailed', { message });
  }

  function renderResults(): void {
    const view = lastView;
    const isFinal = view !== null && !view.loading;
    list.replaceChildren(...results.map((repo, i) => renderItem(repo, i, i === selected, isFinal)));
    input.setAttribute('aria-expanded', String(results.length > 0));
    status.hidden = !view || !(view.loading || (view.hasQuery && results.length === 0));
    status.className = view?.loading ? 'loading' : 'empty';
    status.textContent = view?.loading ? t(activeLocale, 'scoring') : t(activeLocale, 'noResults');
  }

  /** All locale-dependent static text; called once on creation and again on locale switch */
  function applyLocale(): void {
    openOptions.textContent = t(activeLocale, 'openOptions');
    notice.replaceChildren(t(activeLocale, 'needsKeysPrefix'), openOptions);
    input.setAttribute('aria-label', t(activeLocale, 'searchAriaLabel', { username }));
    for (const [button, key] of [[searchButton, 'searchButton'], [shuffleButton, 'shuffleButton']] as const) {
      button.title = t(activeLocale, key);
      button.setAttribute('aria-label', t(activeLocale, key));
    }
    retry.textContent = t(activeLocale, 'retry');
    if (matchingQuery !== null) input.placeholder = t(activeLocale, 'matchingPlaceholder');
    else idlePlaceholder();
    renderProgressLabel();
    renderResults();
    updateSelection(selected);
    if (lastProgress) sync.update(lastProgress);
  }

  applyLocale();

  return {
    host,
    focus: () => input.focus(),
    setQuery: (text) => {
      updateSelection(-1); // Query changed, Enter should search again
      input.focus();
      typewriter.type(text);
    },
    setNeedsKeys: (needsKeys) => {
      notice.hidden = !needsKeys;
    },
    setProgress: (p) => {
      const wasSyncing = lastProgress === null || isSyncing(lastProgress.state);
      lastProgress = p;
      sync.update(p);
      // Input is disabled until sync finishes; on failure it opens so stored repos stay searchable
      const syncing = isSyncing(p.state);
      input.disabled = syncing;
      searchButton.disabled = syncing;
      shuffleButton.disabled = syncing;
      if (syncing) {
        placeholder.stop();
        input.placeholder = t(activeLocale, 'syncingPlaceholder', { username });
      } else if (wasSyncing && matchingQuery === null) {
        placeholder.restart(); // Starts the rotator only right after sync ends (or on first state); periodic progress refreshes never interrupt it
      }
      progress.hidden = p.state !== 'error';
      renderProgressLabel();
    },
    setLocale: (locale) => {
      activeLocale = locale;
      applyLocale();
    },
    destroy: () => {
      placeholder.stop();
      typewriter.finish();
    },
    setError: (message) => {
      errorBanner.textContent = message;
      errorBanner.hidden = message === '';
      if (message !== '') endMatching(true);
    },
    setResults: (view) => {
      // Replaces in place with the latest ranking; keeps the selected repo selected when possible
      const previous = results[selected]?.fullName;
      results = view.results;
      lastView = view;
      selected = previous ? results.findIndex((r) => r.fullName === previous) : -1;
      renderResults();
      updateSelection(selected);
      if (!view.loading) endMatching(true); // Final ranking is in: the best match now has its thumbs-up
    },
  };
}
