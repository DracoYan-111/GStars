import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '@/lib/core/settings';
import type { RuntimeRequest, RuntimeResponse } from '@/lib/messages';
import { loadSettings, saveSettings } from '@/lib/settings';
import { detectLocale, resolveLocale, t, type Locale } from '@/lib/i18n';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const textInputs = {
  githubToken: byId<HTMLInputElement>('githubToken'),
  jevKey: byId<HTMLInputElement>('jevKey'),
  fullScanLimit: byId<HTMLInputElement>('fullScanLimit'),
  minScore: byId<HTMLInputElement>('minScore'),
  syncConcurrency: byId<HTMLInputElement>('syncConcurrency'),
  jevConcurrency: byId<HTMLInputElement>('jevConcurrency'),
} satisfies Record<Exclude<keyof Settings, 'locale'>, HTMLInputElement>;
const localeInput = byId<HTMLSelectElement>('locale');

const testButton = byId<HTMLButtonElement>('test');
const savedOutput = byId<HTMLElement>('saved');
const githubOutput = byId<HTMLElement>('githubResult');
const jevOutput = byId<HTMLElement>('jevResult');

function applyLocale(l: Locale): void {
  document.documentElement.lang = l;
  document.title = t(l, 'optionsTitle');
  byId('page-title').textContent = t(l, 'optionsTitle');
  byId('legend-keys').textContent = t(l, 'keysLegend');
  byId('hint-token').textContent = t(l, 'githubTokenHint');
  byId('legend-params').textContent = t(l, 'paramsLegend');
  byId('label-fullscan').firstChild!.textContent = t(l, 'fullScanLabel');
  byId('hint-fullscan').textContent = t(l, 'fullScanHint', { default: DEFAULT_SETTINGS.fullScanLimit });
  byId('hint-minscore').textContent = t(l, 'minScoreHint', { default: DEFAULT_SETTINGS.minScore });
  byId('hint-sync').textContent = t(l, 'syncConcurrencyHint', { default: DEFAULT_SETTINGS.syncConcurrency });
  byId('hint-jev').textContent = t(l, 'jevConcurrencyHint', { default: DEFAULT_SETTINGS.jevConcurrency });
  byId('hint-locale').textContent = t(l, 'languageHint');
  const autoOption = localeInput.querySelector<HTMLOptionElement>('option[value="auto"]');
  if (autoOption) autoOption.textContent = t(l, 'localeAuto');
  byId('label-minscore').firstChild!.textContent = t(l, 'minScoreLabel');
  byId('label-sync').firstChild!.textContent = t(l, 'syncConcurrencyLabel');
  byId('label-jev').firstChild!.textContent = t(l, 'jevConcurrencyLabel');
  byId('label-locale').firstChild!.textContent = t(l, 'languageLabel');
  byId<HTMLButtonElement>('save').textContent = t(l, 'save');
  testButton.textContent = t(l, 'testConnection');
  byId('apply-github').textContent = t(l, 'applyForKey');
  byId('apply-jev').textContent = t(l, 'applyForKey');
}

// On "auto", detect from browser language, not the current UI language.
localeInput.addEventListener('change', () => {
  locale = resolveLocale(normalizeSettings({ locale: localeInput.value }).locale, navigator.language);
  applyLocale(locale);
});

function fillForm(settings: Settings): void {
  for (const key of Object.keys(textInputs) as (keyof typeof textInputs)[]) {
    textInputs[key].value = String(settings[key]);
  }
  localeInput.value = settings.locale;
}

function readForm(): Settings {
  const raw: Record<string, string> = {};
  for (const key of Object.keys(textInputs) as (keyof typeof textInputs)[]) raw[key] = textInputs[key].value;
  raw.locale = localeInput.value;
  return normalizeSettings(raw);
}

let locale: Locale = detectLocale();

/** "GitHub: result" style prefixes use locale-appropriate colons. */
function withService(service: 'GitHub' | 'Jev', text: string): string {
  return `${service}${locale === 'en' ? ': ' : '：'}${text}`;
}

function show(output: HTMLElement, text: string, ok: boolean | null): void {
  output.textContent = text;
  output.className = `result ${ok === null ? '' : ok ? 'ok' : 'fail'}`;
}

const REQUIRED_KEYS = [textInputs.githubToken, textInputs.jevKey] as const;
for (const input of REQUIRED_KEYS) {
  input.addEventListener('input', () => {
    if (input.value.trim() !== '') input.classList.remove('invalid');
  });
}

/**
 * Highlights empty required keys and focuses the first one; returns whether all are filled.
 * Called before save and test-connection so users can see what is missing.
 */
function requireKeys(): boolean {
  const missing = REQUIRED_KEYS.filter((input) => input.value.trim() === '');
  for (const input of REQUIRED_KEYS) input.classList.toggle('invalid', input.value.trim() === '');
  if (missing.length === 0) return true;
  const first = missing[0]!;
  first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  first.focus({ preventScroll: true });
  return false;
}

/** Saves and writes back normalized values so users see how invalid input was fixed. */
async function save(): Promise<Settings> {
  const settings = readForm();
  await saveSettings(settings);
  fillForm(settings);
  return settings;
}

byId<HTMLFormElement>('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const complete = requireKeys();
  try {
    await save();
    show(savedOutput, t(locale, 'saved'), true);
  } catch (error) {
    show(savedOutput, t(locale, 'saveFailed', { message: error instanceof Error ? error.message : String(error) }), false);
  }
  if (!complete) requireKeys();
});

testButton.addEventListener('click', async () => {
  if (!requireKeys()) {
    show(githubOutput, withService('GitHub', t(locale, 'githubNoToken')), false);
    show(jevOutput, withService('Jev', t(locale, 'jevNoKey')), false);
    return;
  }
  testButton.disabled = true;
  show(githubOutput, t(locale, 'testingGithub'), null);
  show(jevOutput, t(locale, 'testingJev'), null);
  try {
    const settings = await save();
    show(savedOutput, t(locale, 'saved'), true);
    const request: RuntimeRequest = {
      type: 'testConnection',
      githubToken: settings.githubToken,
      jevKey: settings.jevKey,
    };
    const response = (await browser.runtime.sendMessage(request)) as RuntimeResponse | undefined;
    if (!response || !('github' in response)) throw new Error(t(locale, 'bgNoResponse'));
    show(githubOutput, withService('GitHub', response.github.message), response.github.ok);
    show(jevOutput, withService('Jev', response.jev.message), response.jev.ok);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    show(githubOutput, withService('GitHub', t(locale, 'testFailed', { message })), false);
    show(jevOutput, withService('Jev', t(locale, 'testFailed', { message })), false);
  } finally {
    testButton.disabled = false;
  }
});

void loadSettings().then((settings) => {
  locale = resolveLocale(settings.locale, navigator.language);
  applyLocale(locale);
  fillForm(settings);
});
