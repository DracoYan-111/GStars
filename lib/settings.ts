import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './core/settings';

const STORAGE_KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY] ?? DEFAULT_SETTINGS);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: normalizeSettings(settings) });
}

/** Callback on settings change (content script uses it to refresh the "keys not configured" notice). */
export function onSettingsChanged(callback: (settings: Settings) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && STORAGE_KEY in changes) {
      callback(normalizeSettings(changes[STORAGE_KEY]?.newValue));
    }
  });
}
