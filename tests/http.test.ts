import { describe, expect, it } from 'vitest';
import { parseLinkPages, retryDelayMs } from '../lib/core/http';

describe('parseLinkPages', () => {
  it('parses next and last', () => {
    const link =
      '<https://api.github.com/user/1/starred?per_page=100&page=2>; rel="next", ' +
      '<https://api.github.com/user/1/starred?per_page=100&page=9>; rel="last"';
    expect(parseLinkPages(link)).toEqual({ next: 2, last: 9 });
  });

  it('last page has no next', () => {
    const link = '<https://api.github.com/user/1/starred?per_page=100&page=1>; rel="first"';
    expect(parseLinkPages(link)).toEqual({ next: null, last: null });
  });

  it('missing headers', () => {
    expect(parseLinkPages(null)).toEqual({ next: null, last: null });
  });
});

describe('retryDelayMs', () => {
  const none = { retryAfter: null, remaining: null, reset: null };

  it('prefers retry-after (seconds)', () => {
    expect(retryDelayMs(429, { ...none, retryAfter: '12' }, 0, 0)).toBe(12_000);
  });

  it('waits until x-ratelimit-reset when quota exhausted', () => {
    const delay = retryDelayMs(403, { retryAfter: null, remaining: '0', reset: '100' }, 40_000, 0);
    expect(delay).toBe(60_000 + 1_000);
  });

  it('only waits the margin when reset already passed', () => {
    expect(retryDelayMs(403, { retryAfter: null, remaining: '0', reset: '10' }, 50_000, 0)).toBe(1_000);
  });

  it('backs off exponentially on 429 without headers', () => {
    expect(retryDelayMs(429, none, 0, 0)).toBe(5_000);
    expect(retryDelayMs(429, none, 0, 2)).toBe(20_000);
  });

  it('plain 403 (forbidden) is not rate limiting', () => {
    expect(retryDelayMs(403, { ...none, remaining: '4999' }, 0, 0)).toBeNull();
  });
});
