// TypeSafe Jev REST wrapper. No official browser/service-worker support claimed, plain fetch is used.
// Endpoint: POST https://api.typesafe.ai/v1/systemone, Bearer auth (https://docs.typesafe.ai/api.md).
import { buildJevRequest, parseScoreAnswer, type RepoForScoring, type ScoreAnswer } from './core/questions';
import { getErrorMessage, sleep } from './async';
import { detectLocale, t } from './i18n';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const RETRYABLE_STATUS = new Set([429, 529]);

/** Only this interface is exposed so the decision model can be swapped later. */
export type ScoreRelevance = (query: string, repo: RepoForScoring, signal: AbortSignal) => Promise<ScoreAnswer>;

export class JevAuthError extends Error {
  constructor() {
    super(t(detectLocale(), 'jevAuth'));
    this.name = 'JevAuthError';
  }
}

function backoffMs(res: Response, attempt: number): number {
  const retryAfter = Number(res.headers.get('retry-after'));
  if (res.headers.get('retry-after') !== null && Number.isFinite(retryAfter)) {
    return Math.min(MAX_BACKOFF_MS, retryAfter * 1000);
  }
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt + jitter);
}

async function postSystemOne(apiKey: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
    if (res.ok) return res.json();
    if (res.status === 401) throw new JevAuthError();
    if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS - 1) {
      await sleep(backoffMs(res, attempt), signal);
      continue;
    }
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(t(detectLocale(), 'jevRequestFailed', { status: res.status, detail }));
  }
}

export function createScorer(apiKey: string): ScoreRelevance {
  return async (query, repo, signal) => parseScoreAnswer(await postSystemOne(apiKey, buildJevRequest(query, repo), signal));
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
}

/** Validate the key and request shape with one real scoring request. */
export async function testJevKey(apiKey: string): Promise<ConnectionResult> {
  if (!apiKey) return { ok: false, message: t(detectLocale(), 'jevNoKey') };
  const sample: RepoForScoring = {
    fullName: 'facebook/react',
    description: 'The library for web and native user interfaces.',
    topics: ['javascript', 'ui', 'frontend'],
    readmeClean: '',
  };
  try {
    const { score } = await createScorer(apiKey)('JavaScript frontend UI library', sample, new AbortController().signal);
    return { ok: true, message: t(detectLocale(), 'jevSampleOk', { score: score.toFixed(2) }) };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
