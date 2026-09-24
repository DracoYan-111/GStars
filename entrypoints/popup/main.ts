import { hasRequiredKeys } from '@/lib/core/settings';
import { isValidUsername, normalizeUsername } from '@/lib/core/username';
import type { RuntimeRequest, RuntimeResponse } from '@/lib/messages';
import { loadSettings } from '@/lib/settings';
import { detectLocale, resolveLocale, t } from '@/lib/i18n';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const form = byId<HTMLFormElement>('form');
const usernameInput = byId<HTMLInputElement>('username');
const submitButton = byId<HTMLButtonElement>('submit');
const hint = byId<HTMLElement>('hint');
const errorOutput = byId<HTMLElement>('error');

function showError(message: string): void {
  errorOutput.textContent = message;
  errorOutput.hidden = message === '';
}

function openOptionsPage(): void {
  void browser.runtime.openOptionsPage();
}

byId('open-options').addEventListener('click', (event) => {
  event.preventDefault();
  openOptionsPage();
});
byId('open-settings').addEventListener('click', openOptionsPage);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const username = normalizeUsername(usernameInput.value);
  if (!isValidUsername(username)) {
    showError(t(activeLocale, 'invalidUsername'));
    return;
  }
  submitButton.disabled = true;
  try {
    const request: RuntimeRequest = { type: 'startSync', username };
    const response = (await browser.runtime.sendMessage(request)) as RuntimeResponse | undefined;
    if (response && 'ok' in response && response.ok) {
      window.close();
      return;
    }
    showError(response && 'message' in response ? response.message : t(activeLocale, 'bgNoResponse'));
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    submitButton.disabled = false;
  }
});

let activeLocale = detectLocale();
void loadSettings().then((settings) => {
  const configured = hasRequiredKeys(settings);
  const l = resolveLocale(settings.locale, navigator.language);
  activeLocale = l;
  document.documentElement.lang = l;
  usernameInput.placeholder = t(l, 'usernamePlaceholder');
  submitButton.textContent = t(l, 'confirm');
  hint.firstChild!.textContent = t(l, 'keysMissing');
  byId('open-options').textContent = t(l, 'openOptions');
  const settingsButton = byId<HTMLButtonElement>('open-settings');
  settingsButton.title = t(l, 'openOptions');
  settingsButton.setAttribute('aria-label', t(l, 'openOptions'));
  hint.hidden = configured;
  submitButton.disabled = !configured;
});
