import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, hasRequiredKeys, normalizeSettings } from '../lib/core/settings';

describe('normalizeSettings', () => {
  it('falls back to defaults on empty', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('oops')).toEqual(DEFAULT_SETTINGS);
  });

  it('trims keys', () => {
    const s = normalizeSettings({ githubToken: '  ghp_x \n', jevKey: ' k ' });
    expect(s.githubToken).toBe('ghp_x');
    expect(s.jevKey).toBe('k');
  });

  it('clamps out-of-range numbers, falls back on NaN', () => {
    const s = normalizeSettings({ fullScanLimit: -5, minScore: 9, syncConcurrency: '100', jevConcurrency: 'abc' });
    expect(s.fullScanLimit).toBe(1);
    expect(s.minScore).toBe(3);
    expect(s.syncConcurrency).toBe(32);
    expect(s.jevConcurrency).toBe(DEFAULT_SETTINGS.jevConcurrency);
  });

  it('rounds concurrency', () => {
    expect(normalizeSettings({ syncConcurrency: 3.6 }).syncConcurrency).toBe(4);
  });

  it('complete only when both keys are set', () => {
    expect(hasRequiredKeys({ githubToken: 'a', jevKey: '' })).toBe(false);
    expect(hasRequiredKeys({ githubToken: 'a', jevKey: 'b' })).toBe(true);
  });
});
