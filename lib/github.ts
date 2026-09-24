// GitHub REST API. fetch only, works in Node (evals) and background.
import pLimit from 'p-limit';
import { parseLinkPages, retryDelayMs } from './core/http';
import { buildReadmeQuery, decodeBase64Utf8, parseReadmeResponse, type Readme } from './core/readme';
import { getErrorMessage, sleep } from './async';
import { detectLocale, t } from './i18n';

export type { Readme } from './core/readme';

const API = 'https://api.github.com';
const STARS_PER_PAGE = 100;
const MAX_RETRIES = 4;
/** Give up when a single backoff exceeds this; user retries manually later. */
const MAX_WAIT_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
/** After learning total pages, fetch remaining star pages in parallel. */
const PAGE_CONCURRENCY = 8;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Still rate-limited after retry: later requests will fail too, caller should abort the round. */
    readonly isRateLimited = false,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface StarredRepo {
  fullName: string;
  description: string;
  topics: string[];
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
  htmlUrl: string;
}

interface StarsPage {
  repos: StarredRepo[];
  nextPage: number | null;
  lastPage: number | null;
}

interface RequestOptions {
  accept?: string;
  /** POST when a body exists (GraphQL). */
  body?: string;
}

async function ghFetch(
  url: string,
  token: string,
  signal: AbortSignal | undefined,
  { accept = 'application/vnd.github+json', body }: RequestOptions = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      body,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (res.status === 401) throw new GitHubError(t(detectLocale(), 'githubTokenInvalid'), 401);
    if (res.status !== 403 && res.status !== 429) return res;

    const wait = retryDelayMs(
      res.status,
      {
        retryAfter: res.headers.get('retry-after'),
        remaining: res.headers.get('x-ratelimit-remaining'),
        reset: res.headers.get('x-ratelimit-reset'),
      },
      Date.now(),
      attempt,
    );
    if (wait === null) return res; // Real 403 (forbidden), handled by the caller.
    if (attempt >= MAX_RETRIES || wait > MAX_WAIT_MS) {
      const minutes = Math.ceil(wait / 60_000);
      throw new GitHubError(t(detectLocale(), 'githubRateLimited', { minutes }), res.status, true);
    }
    await sleep(wait, signal);
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** API responses are untrusted: validate field by field before mapping. */
function toStarredRepo(item: unknown): StarredRepo | null {
  if (typeof item !== 'object' || item === null) return null;
  const r = item as Record<string, unknown>;
  const fullName = asString(r.full_name);
  const htmlUrl = asString(r.html_url);
  if (!fullName || !htmlUrl.startsWith('https://github.com/')) return null;
  return {
    fullName,
    description: asString(r.description),
    topics: Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === 'string') : [],
    language: typeof r.language === 'string' ? r.language : null,
    stars: typeof r.stargazers_count === 'number' ? r.stargazers_count : 0,
    forks: typeof r.forks_count === 'number' ? r.forks_count : 0,
    pushedAt: asString(r.pushed_at),
    htmlUrl,
  };
}

async function fetchStarsPage(
  username: string,
  page: number,
  token: string,
  signal?: AbortSignal,
): Promise<StarsPage> {
  const url = `${API}/users/${encodeURIComponent(username)}/starred?per_page=${STARS_PER_PAGE}&page=${page}`;
  const res = await ghFetch(url, token, signal);
  if (res.status === 404) throw new GitHubError(t(detectLocale(), 'githubUserNotFound', { username }), 404);
  if (!res.ok) throw new GitHubError(t(detectLocale(), 'githubStarsFailed', { status: res.status }), res.status);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new GitHubError(t(detectLocale(), 'githubStarsBadFormat'), res.status);
  const links = parseLinkPages(res.headers.get('link'));
  return {
    repos: body.map(toStarredRepo).filter((r): r is StarredRepo => r !== null),
    nextPage: links.next,
    lastPage: links.last,
  };
}

/**
 * All stars: after page-1 Link header gives total pages, fetch the rest in parallel.
 * List may shift during fetch; dedupe adjacent-page duplicates by fullName; gaps are covered next check.
 */
export async function fetchAllStars(username: string, token: string, signal?: AbortSignal): Promise<StarredRepo[]> {
  const first = await fetchStarsPage(username, 1, token, signal);
  const pages = [first];
  if (first.nextPage !== null && first.lastPage !== null) {
    const limit = pLimit(PAGE_CONCURRENCY);
    const rest = Array.from({ length: first.lastPage - 1 }, (_, i) => i + 2);
    pages.push(...(await Promise.all(rest.map((page) => limit(() => fetchStarsPage(username, page, token, signal))))));
  } else {
    // Fall back to page-by-page when Link has no last.
    for (let page = first.nextPage; page !== null; ) {
      const result = await fetchStarsPage(username, page, token, signal);
      pages.push(result);
      page = result.nextPage;
    }
  }
  const byName = new Map(pages.flatMap((p) => p.repos).map((r) => [r.fullName, r]));
  return [...byName.values()];
}

function readmeUrl(fullName: string): string {
  const path = fullName.split('/').map(encodeURIComponent).join('/');
  return `${API}/repos/${path}/readme`;
}

/** One GraphQL query fetches root READMEs for a batch; missing repos fall back to fetchReadme. */
export async function fetchReadmes(
  fullNames: readonly string[],
  token: string,
  signal?: AbortSignal,
): Promise<Map<string, Readme>> {
  const body = JSON.stringify(buildReadmeQuery(fullNames));
  const res = await ghFetch(`${API}/graphql`, token, signal, { body });
  if (!res.ok) throw new GitHubError(t(detectLocale(), 'githubBatchReadmeFailed', { status: res.status }), res.status);
  return parseReadmeResponse(fullNames, await res.json());
}

async function fetchReadmeRaw(fullName: string, token: string, signal?: AbortSignal): Promise<string> {
  const res = await ghFetch(readmeUrl(fullName), token, signal, { accept: 'application/vnd.github.raw' });
  if (res.status === 404) return '';
  if (!res.ok) throw new GitHubError(t(detectLocale(), 'githubReadmeFailed', { fullName, status: res.status }), res.status);
  return res.text();
}

/**
 * Single-repo README (REST). 404 (no README) returns null, not an error.
 * Body comes from base64 content directly; raw is requested only over 1MB (empty content).
 */
export async function fetchReadme(fullName: string, token: string, signal?: AbortSignal): Promise<Readme | null> {
  const res = await ghFetch(readmeUrl(fullName), token, signal);
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(t(detectLocale(), 'githubReadmeFailed', { fullName, status: res.status }), res.status);
  const body = (await res.json()) as { sha?: unknown; content?: unknown; encoding?: unknown };
  if (typeof body.sha !== 'string') return null;
  const content = body.encoding === 'base64' && typeof body.content === 'string' ? body.content : '';
  const text = content !== '' ? decodeBase64Utf8(content) : await fetchReadmeRaw(fullName, token, signal);
  return { sha: body.sha, text };
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
}

export async function testGithubToken(token: string): Promise<ConnectionResult> {
  if (!token) return { ok: false, message: t(detectLocale(), 'githubNoToken') };
  try {
    const res = await ghFetch(`${API}/rate_limit`, token, undefined);
    if (!res.ok) return { ok: false, message: t(detectLocale(), 'githubHttp', { status: res.status }) };
    const body = (await res.json()) as { resources?: { core?: { remaining?: number; limit?: number } } };
    const core = body.resources?.core;
    return { ok: true, message: t(detectLocale(), 'githubRateOk', { remaining: core?.remaining ?? '?', limit: core?.limit ?? '?' }) };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
