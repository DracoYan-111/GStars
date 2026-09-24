import { describe, expect, it } from 'vitest';
import { isValidUsername, usernameFromStarsUrl } from '../lib/core/username';

const u = (s: string) => new URL(s);

describe('isValidUsername', () => {
  it.each(['a', 'torvalds', 'a-b', 'A1-b2'])('valid: %s', (name) => expect(isValidUsername(name)).toBe(true));
  it.each(['', '-a', 'a-', 'a--b', 'a b', 'a/b', 'a'.repeat(40)])('invalid: %s', (name) => expect(isValidUsername(name)).toBe(false));
});

describe('usernameFromStarsUrl', () => {
  it('?tab=stars', () => {
    expect(usernameFromStarsUrl(u('https://github.com/Torvalds?tab=stars'), null)).toBe('torvalds');
  });

  it('/stars/{user}', () => {
    expect(usernameFromStarsUrl(u('https://github.com/stars/sindresorhus'), null)).toBe('sindresorhus');
  });

  it('completes /stars with the current logged-in user', () => {
    expect(usernameFromStarsUrl(u('https://github.com/stars'), 'me')).toBe('me');
    expect(usernameFromStarsUrl(u('https://github.com/stars'), null)).toBeNull();
  });

  it('other pages are not stars pages', () => {
    expect(usernameFromStarsUrl(u('https://github.com/torvalds'), null)).toBeNull();
    expect(usernameFromStarsUrl(u('https://github.com/torvalds?tab=repositories'), null)).toBeNull();
    expect(usernameFromStarsUrl(u('https://github.com/torvalds/linux?tab=stars'), null)).toBeNull();
  });
});
