// Pure functions, no browser APIs.

export interface LinkPages {
  next: number | null;
  last: number | null;
}

/** Parses rel="next" / rel="last" page numbers from the GitHub Link header */
export function parseLinkPages(link: string | null): LinkPages {
  const pages: LinkPages = { next: null, last: null };
  if (!link) return pages;
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="(next|last)"/);
    if (!match) continue;
    const url = match[1] as string;
    const rel = match[2] as 'next' | 'last';
    const page = Number(new URL(url).searchParams.get('page'));
    if (Number.isInteger(page) && page > 0) pages[rel] = page;
  }
  return pages;
}

export interface RateLimitHeaders {
  retryAfter: string | null;
  remaining: string | null;
  reset: string | null;
}

const BASE_BACKOFF_MS = 5_000;
const RESET_MARGIN_MS = 1_000;

/**
 * How long to wait before retrying on 403/429; null means it is not rate limiting (e.g. real forbidden).
 * Priority: retry-after -> x-ratelimit-reset (remaining is 0) -> exponential backoff on 429 without headers.
 */
export function retryDelayMs(
  status: number,
  headers: RateLimitHeaders,
  nowMs: number,
  attempt: number,
): number | null {
  const retryAfter = Number(headers.retryAfter);
  if (headers.retryAfter !== null && Number.isFinite(retryAfter)) {
    return Math.max(0, retryAfter * 1000);
  }
  const reset = Number(headers.reset);
  if (headers.remaining === '0' && headers.reset !== null && Number.isFinite(reset)) {
    return Math.max(0, reset * 1000 - nowMs) + RESET_MARGIN_MS;
  }
  if (status === 429) return BASE_BACKOFF_MS * 2 ** attempt;
  return null;
}
