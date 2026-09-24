// Pure functions, no browser APIs.
import type { LocaleSetting } from '../i18n';
import { DEFAULT_MIN_SCORE } from './rank';

/** Incremental check interval for synced users */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface Settings {
  githubToken: string;
  jevKey: string;
  fullScanLimit: number;
  minScore: number;
  syncConcurrency: number;
  jevConcurrency: number;
  locale: LocaleSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  githubToken: '',
  jevKey: '',
  fullScanLimit: 1500,
  minScore: DEFAULT_MIN_SCORE,
  syncConcurrency: 16,
  jevConcurrency: 16,
  locale: 'auto',
};

function clampNumber(value: unknown, fallback: number, min: number, max: number, isInt: boolean): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  const bounded = Math.min(max, Math.max(min, n));
  return isInt ? Math.round(bounded) : bounded;
}

function toKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toLocale(value: unknown): LocaleSetting {
  return value === 'zh-CN' || value === 'en' ? value : 'auto';
}

/** Storage content is untrusted: validate item by item, fall back to defaults on invalid values */
export function normalizeSettings(raw: unknown): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  return {
    githubToken: toKey(r.githubToken),
    jevKey: toKey(r.jevKey),
    fullScanLimit: clampNumber(r.fullScanLimit, d.fullScanLimit, 1, 100_000, true),
    minScore: clampNumber(r.minScore, d.minScore, 0, 3, false),
    syncConcurrency: clampNumber(r.syncConcurrency, d.syncConcurrency, 1, 32, true),
    jevConcurrency: clampNumber(r.jevConcurrency, d.jevConcurrency, 1, 64, true),
    locale: toLocale(r.locale),
  };
}

export function hasRequiredKeys(settings: Pick<Settings, 'githubToken' | 'jevKey'>): boolean {
  return settings.githubToken !== '' && settings.jevKey !== '';
}
