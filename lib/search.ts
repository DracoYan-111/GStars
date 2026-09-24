// Recall/score/rank orchestration: keyword recall -> score cache -> Jev scoring -> ranked push.
import pLimit from 'p-limit';
import { hashQuery } from './core/hash';
import type { Settings } from './core/settings';
import { QUESTION_VERSION } from './core/questions';
import { MIN_JEV_QUERY_LENGTH, RECALL_CANDIDATE_LIMIT, RERANK_BATCH_SIZE, rankResults } from './core/rank';
import { getErrorMessage } from './async';
import { detectLocale, t } from './i18n';
import { db, type Repo, type Score } from './db';
import { keywordSearch } from './index';
import { createScorer, JevAuthError } from './jev';
import type { BackgroundMessage, RepoResult } from './messages';

/** Max keyword results shown to the UI first. */
const KEYWORD_DISPLAY_LIMIT = 50;

interface SearchRequest {
  requestId: string;
  username: string;
  query: string;
}

function toResult(repo: Repo, score?: number): RepoResult {
  return {
    fullName: repo.fullName,
    htmlUrl: repo.htmlUrl,
    description: repo.description,
    language: repo.language,
    stars: repo.stars,
    forks: repo.forks ?? 0,
    pushedAt: repo.pushedAt,
    score,
  };
}

async function loadRepos(username: string, fullNames: string[]): Promise<Repo[]> {
  const found = await db.repos.bulkGet(fullNames.map((name): [string, string] => [username, name]));
  return found.filter((r): r is Repo => r !== undefined);
}

/** Score all repos when count is within fullScanLimit, else only top RECALL_CANDIDATE_LIMIT keyword recalls. */
async function pickCandidates(username: string, recalledNames: string[], fullScanLimit: number): Promise<Repo[]> {
  const repos = db.repos.where('username').equals(username);
  if ((await repos.count()) <= fullScanLimit) return repos.toArray();
  return loadRepos(username, recalledNames.slice(0, RECALL_CANDIDATE_LIMIT));
}

type ScoredEntry = { repo: Repo; fullName: string; score: number; stars: number };

export async function runSearch(
  request: SearchRequest,
  settings: Settings,
  outerSignal: AbortSignal,
  emit: (message: BackgroundMessage) => void,
): Promise<void> {
  const { requestId, username } = request;
  const query = request.query.trim();
  const send = (message: BackgroundMessage) => {
    if (!outerSignal.aborted) emit(message);
  };

  // 1. Keyword recall, push immediately (only read the few rows to display for speed).
  const recalledNames = await keywordSearch(username, query, RECALL_CANDIDATE_LIMIT);
  const shown = await loadRepos(username, recalledNames.slice(0, KEYWORD_DISPLAY_LIMIT));
  send({ type: 'keyword', requestId, results: shown.map((r) => toResult(r)) });

  // 2. Query too short: return keyword results only, no Jev call.
  if (query.length < MIN_JEV_QUERY_LENGTH) return;
  if (!settings.jevKey) {
    send({ type: 'error', requestId, message: t(detectLocale(), 'keywordOnlyNoKey') });
    return;
  }

  // 3. Candidates: check score cache first.
  const candidates = await pickCandidates(username, recalledNames, settings.fullScanLimit);
  const queryHash = hashQuery(query);
  const cacheKey = (r: Repo): [string, string, string, number] => [queryHash, r.fullName, r.readmeSha ?? '', QUESTION_VERSION];
  const cachedScores = await db.scores.bulkGet(candidates.map(cacheKey));

  const scored: ScoredEntry[] = [];
  const todo: Repo[] = [];
  candidates.forEach((repo, i) => {
    const hit = cachedScores[i];
    if (hit) scored.push({ repo, fullName: repo.fullName, score: hit.score, stars: repo.stars });
    else todo.push(repo);
  });

  const emitRanked = (done: boolean) => {
    const results = rankResults(scored, settings.minScore).map((s) => toResult(s.repo, s.score));
    send({ type: 'rerank', requestId, results, done });
  };
  // Buffer fresh scores and write per push to avoid one IndexedDB transaction per repo.
  let unsaved: Score[] = [];
  const flushScores = async () => {
    if (unsaved.length === 0) return;
    const batch = unsaved;
    unsaved = [];
    await db.scores.bulkPut(batch);
  };
  if (todo.length === 0) {
    emitRanked(true);
    return;
  }
  if (scored.length > 0) emitRanked(false);

  // 4. Score cache misses via Jev. Single-repo failure is skipped with a log; 401 aborts the rest.
  const inner = new AbortController();
  outerSignal.addEventListener('abort', () => inner.abort(), { once: true });
  const scoreRelevance = createScorer(settings.jevKey);
  const limit = pLimit(settings.jevConcurrency);
  let sinceLastEmit = 0;
  let failures = 0;
  let lastFailure = '';
  let authFailed = false;

  await Promise.all(
    todo.map((repo) =>
      limit(async () => {
        if (inner.signal.aborted) return;
        try {
          const { score, confidence } = await scoreRelevance(query, repo, inner.signal);
          const [, fullName, readmeSha, questionVersion] = cacheKey(repo);
          unsaved.push({ queryHash, fullName, readmeSha, questionVersion, score, confidence });
          scored.push({ repo, fullName: repo.fullName, score, stars: repo.stars });
          if (++sinceLastEmit >= RERANK_BATCH_SIZE) {
            sinceLastEmit = 0;
            emitRanked(false);
            await flushScores();
          }
        } catch (error) {
          if (inner.signal.aborted) return;
          if (error instanceof JevAuthError) {
            authFailed = true;
            inner.abort();
            return;
          }
          failures++;
          lastFailure = getErrorMessage(error);
          console.warn(`[gstars] Skip ${repo.fullName}  scoring: ${lastFailure}`);
        }
      }),
    ),
  );

  // Persist scores even when cancelled: same query can hit cache next time.
  await flushScores();
  if (outerSignal.aborted) return;
  if (authFailed) {
    send({ type: 'error', requestId, message: t(detectLocale(), 'jevKeyInvalidCheck') });
    return;
  }
  emitRanked(true);
  if (failures > 0 && failures === todo.length) {
    send({ type: 'error', requestId, message: t(detectLocale(), 'jevAllFailed', { message: lastFailure }) });
  }
}
