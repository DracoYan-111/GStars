// Pure functions, no browser APIs.

const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

/** GitHub usernames are case-insensitive; lowercase is the storage key */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns the username (lowercase) when the URL is a user's stars page.
 * - https://github.com/{user}?tab=stars
 * - https://github.com/stars/{user}
 * - https://github.com/stars (own stars, completed with currentUser)
 */
export function usernameFromStarsUrl(url: URL, currentUser: string | null): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  let candidate: string | null = null;
  if (segments.length === 2 && segments[0] === 'stars') candidate = segments[1] ?? null;
  else if (segments.length === 1 && segments[0] === 'stars') candidate = currentUser;
  else if (segments.length === 1 && url.searchParams.get('tab') === 'stars') candidate = segments[0] ?? null;

  if (candidate === null) return null;
  const name = normalizeUsername(candidate);
  return isValidUsername(name) ? name : null;
}
