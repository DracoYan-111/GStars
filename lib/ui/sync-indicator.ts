// Sync progress: a clockwise ring along the input border plus an x/y count over its top-left border.
// At the moment sync completes, the count becomes a check icon, then the repo total y.
import type { ProgressState } from '../messages';
import { t, type Locale } from '../i18n';
import checkIconSvg from '@/assets/icons/circle-check.svg?raw';
import { parseIcon } from './icons';

/** How long the completion check stays before switching to the total */
const CHECK_DISPLAY_MS = 1200;
/** Fade out/in durations of the count content, matching .sync-badge-content transition in styles.ts */
const FADE_MS = 200;
const SVG_NS = 'http://www.w3.org/2000/svg';
/** Matches the rect rx: the path starts where the top-left corner radius ends (x = RING_RADIUS) */
const RING_RADIUS = 6;
/** Gap between the ring start and the right edge of the count badge */
const BADGE_GAP = 4;

export interface SyncProgress {
  state: ProgressState;
  fetched: number;
  total: number;
}

export interface SyncIndicator {
  /** Ring overlaying the input, placed in a same-size positioned container */
  ring: SVGSVGElement;
  badge: HTMLElement;
  update(progress: SyncProgress): void;
}

export function isSyncing(state: ProgressState): boolean {
  return state === 'pending' || state === 'running';
}

function createRing(): { ring: SVGSVGElement; rect: SVGRectElement } {
  const ring = document.createElementNS(SVG_NS, 'svg');
  ring.classList.add('sync-ring');
  ring.setAttribute('aria-hidden', 'true');
  // pathLength=100: stroke length in percent; the rect path runs clockwise from the top-left
  const rect = document.createElementNS(SVG_NS, 'rect');
  const attributes: [string, string][] = [
    ['x', '0'],
    ['y', '0'],
    ['width', '100%'],
    ['height', '100%'],
    ['rx', String(RING_RADIUS)],
    ['pathLength', '100'],
  ];
  for (const [name, value] of attributes) rect.setAttribute(name, value);
  ring.append(rect);
  return { ring, rect };
}

/** getLocale: copy language follows the panel locale (user-set, not necessarily the browser language) */
export function createSyncIndicator(getLocale: () => Locale): SyncIndicator {
  const { ring, rect } = createRing();
  const badge = document.createElement('span');
  badge.className = 'sync-badge';
  badge.id = 'gstars-sync-badge';
  badge.hidden = true;
  // Content on its own layer: only content fades on switch, the badge background keeps covering the border
  const content = document.createElement('span');
  content.className = 'sync-badge-content';
  badge.append(content);
  const checkIcon = parseIcon(checkIconSvg, 14);

  let wasSyncing = false;
  /** Timer for the completion animation (x/y -> check -> total); non-null while it is still playing */
  let finishTimers: number[] = [];

  const cancelFinish = () => {
    finishTimers.forEach((id) => window.clearTimeout(id));
    finishTimers = [];
    content.classList.remove('fading');
  };

  /** Fades out the current content, swaps, then fades back in */
  const fadeTo = (delay: number, apply: () => void) => {
    finishTimers.push(
      window.setTimeout(() => content.classList.add('fading'), delay),
      window.setTimeout(() => {
        apply();
        content.classList.remove('fading');
      }, delay + FADE_MS),
    );
  };

  /** Moves the stroke start right of the count badge so no sliver shows left of the badge */
  const alignStartToBadge = () => {
    const length = rect.getTotalLength();
    if (length <= 0) return;
    const startPx = badge.offsetLeft + badge.offsetWidth + BADGE_GAP - RING_RADIUS;
    rect.style.strokeDashoffset = String(-(startPx / length) * 100);
  };

  const showTotal = (total: number) => {
    badge.classList.remove('complete');
    content.textContent = String(total);
    badge.title = t(getLocale(), 'syncedTotal', { total });
  };

  const update = ({ state, fetched, total }: SyncProgress) => {
    const syncing = isSyncing(state);
    const justFinished = wasSyncing && state === 'done';
    wasSyncing = syncing;

    if (syncing) {
      cancelFinish();
      const known = total > 0;
      ring.classList.remove('finished');
      ring.classList.toggle('indeterminate', !known);
      ring.removeAttribute('hidden');
      rect.style.strokeDasharray = known ? `${Math.min(100, (fetched / total) * 100)} 100` : '';
      badge.hidden = false;
      badge.classList.remove('complete', 'error');
      content.textContent = known ? `${fetched}/${total}` : t(getLocale(), 'preparing');
      if (known) alignStartToBadge(); // Badge width changes with digits, remeasured after each update
      badge.title = t(getLocale(), 'syncingTitle');
      return;
    }

    ring.classList.remove('indeterminate');
    badge.classList.toggle('error', state === 'error');
    if (state === 'error') {
      cancelFinish();
      ring.setAttribute('hidden', '');
      badge.hidden = total === 0;
      content.textContent = `${fetched}/${total}`;
      badge.title = t(getLocale(), 'syncIncomplete');
      return;
    }
    if (state !== 'done' || total === 0) {
      cancelFinish();
      ring.setAttribute('hidden', '');
      badge.hidden = true;
      return;
    }

    badge.hidden = false;
    if (justFinished) {
      // Fades the ring once full; the count fades to a check, pauses, then fades to the total
      rect.style.strokeDasharray = '100 100';
      ring.classList.add('finished');
      badge.title = t(getLocale(), 'syncDone');
      fadeTo(0, () => {
        badge.classList.add('complete');
        content.replaceChildren(checkIcon);
      });
      // Timeline: check at 0-400ms, shown for CHECK_DISPLAY_MS, then total over 400ms
      const totalAt = 2 * FADE_MS + CHECK_DISPLAY_MS;
      fadeTo(totalAt, () => showTotal(total));
      finishTimers.push(
        window.setTimeout(() => {
          finishTimers = [];
          ring.setAttribute('hidden', '');
        }, totalAt + 2 * FADE_MS),
      );
      return;
    }
    if (finishTimers.length === 0) {
      ring.setAttribute('hidden', '');
      showTotal(total);
    }
  };

  ring.setAttribute('hidden', '');
  return { ring, badge, update };
}
