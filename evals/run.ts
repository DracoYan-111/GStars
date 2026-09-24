// Eval: pnpm tsx evals/run.ts
// Env vars:
//   GITHUB_TOKEN, JEV_API_KEY   required
//   MIN_SCORE / FULL_SCAN_LIMIT / EVAL_CONCURRENCY   override defaults
//   EVAL_LIMIT=N     only run first N queries (saves cost, for debugging)
//   EVAL_REFRESH=1   refetch GitHub data (local cache is reused by default)
// Cached in evals/.cache/, unchanged parts do not call the API again.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pLimit from 'p-limit';
import { cleanReadme } from '../lib/core/cleaner';
import { hashQuery } from '../lib/core/hash';
import { createIndex, searchKeyword, upsertDoc } from '../lib/core/keyword';
import { QUESTION_VERSION } from '../lib/core/questions';
import { DEFAULT_MIN_SCORE, RECALL_CANDIDATE_LIMIT, rankResults } from '../lib/core/rank';
import { DEFAULT_SETTINGS } from '../lib/core/settings';
import { getErrorMessage } from '../lib/async';
import { fetchAllStars, fetchReadme, type StarredRepo } from '../lib/github';
import { createScorer, JevAuthError } from '../lib/jev';
import { parseQueries, type EvalQuery } from './yaml';

interface EvalRepo extends StarredRepo {
  readmeSha: string | null;
  readmeClean: string;
}
type ScoreCache = Record<string, { score: number; confidence: number }>;

const CACHE_DIR = fileURLToPath(new URL('./.cache/', import.meta.url));
const QUERIES_FILE = fileURLToPath(new URL('./queries.yaml', import.meta.url));
const SCORES_FILE = `${CACHE_DIR}scores.json`;
const SAVE_EVERY = 200;
const TOP_K = 10;
const GITHUB_CONCURRENCY = 6;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing env var  ${name}`);
    process.exit(1);
  }
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] ? n : fallback;
}

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(value));
}

async function loadStars(username: string, token: string, refresh: boolean): Promise<EvalRepo[]> {
  const file = `${CACHE_DIR}stars-${username}.json`;
  const cached = readJson<EvalRepo[] | null>(file, null);
  if (cached && !refresh) return cached;

  const byName = new Map((cached ?? []).map((r) => [r.fullName, r]));
  const listed = await fetchAllStars(username, token);

  const limit = pLimit(GITHUB_CONCURRENCY);
  const repos = await Promise.all(
    listed.map((repo) =>
      limit(async (): Promise<EvalRepo> => {
        const readme = await fetchReadme(repo.fullName, token);
        const old = byName.get(repo.fullName);
        if (readme === null) return { ...repo, readmeSha: null, readmeClean: '' };
        if (old?.readmeSha === readme.sha) return { ...repo, readmeSha: readme.sha, readmeClean: old.readmeClean };
        return { ...repo, readmeSha: readme.sha, readmeClean: cleanReadme(readme.text) };
      }),
    ),
  );
  writeJson(file, repos);
  console.log(`  Fetched ${username}   ${repos.length}  stars`);
  return repos;
}

/** recall@K: how many expected repos are in top K; RR: reciprocal rank of first hit (0 on miss) */
function metrics(ranked: string[], expected: string[]): { recall: number; rr: number; firstHit: number } {
  const top = new Set(ranked.slice(0, TOP_K));
  const recall = expected.filter((e) => top.has(e)).length / expected.length;
  const idx = ranked.findIndex((name) => expected.includes(name));
  return { recall, rr: idx < 0 ? 0 : 1 / (idx + 1), firstHit: idx + 1 };
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

async function main(): Promise<void> {
  const token = requireEnv('GITHUB_TOKEN');
  const scorer = createScorer(requireEnv('JEV_API_KEY'));
  const minScore = numberEnv('MIN_SCORE', DEFAULT_MIN_SCORE);
  const fullScanLimit = numberEnv('FULL_SCAN_LIMIT', DEFAULT_SETTINGS.fullScanLimit);
  const limit = pLimit(numberEnv('EVAL_CONCURRENCY', DEFAULT_SETTINGS.jevConcurrency));
  const refresh = process.env.EVAL_REFRESH === '1';

  const all = parseQueries(readFileSync(QUERIES_FILE, 'utf8'));
  const queries: EvalQuery[] = all.slice(0, numberEnv('EVAL_LIMIT', all.length));
  const scores = readJson<ScoreCache>(SCORES_FILE, {});
  console.log(`QUESTION_VERSION=${QUESTION_VERSION} MIN_SCORE=${minScore} FULL_SCAN_LIMIT=${fullScanLimit} queries=${queries.length}/${all.length}`);

  const starsByUser = new Map<string, EvalRepo[]>();
  for (const username of new Set(queries.map((q) => q.username))) {
    starsByUser.set(username, await loadStars(username, token, refresh));
  }

  let unsaved = 0;
  const rows: { query: string; jev: ReturnType<typeof metrics>; keyword: ReturnType<typeof metrics> }[] = [];

  for (const q of queries) {
    const repos = starsByUser.get(q.username) ?? [];
    const names = new Set(repos.map((r) => r.fullName));
    const missing = q.expected.filter((e) => !names.has(e));
    if (missing.length > 0) console.warn(`  ⚠ bad annotation, ${q.username} has no stars: ${missing.join(', ')}`);

    const index = createIndex();
    repos.forEach((r) => upsertDoc(index, r));
    const recalledNames = searchKeyword(index, q.query, RECALL_CANDIDATE_LIMIT);
    const byName = new Map(repos.map((r) => [r.fullName, r]));
    const candidates =
      repos.length <= fullScanLimit
        ? repos
        : recalledNames.map((n) => byName.get(n)).filter((r): r is EvalRepo => r !== undefined);

    const queryHash = hashQuery(q.query);
    const scored: { fullName: string; score: number; stars: number }[] = [];
    let failures = 0;

    await Promise.all(
      candidates.map((repo) =>
        limit(async () => {
          const key = `${queryHash}|${repo.fullName}|${repo.readmeSha ?? ''}|${QUESTION_VERSION}`;
          let hit = scores[key];
          if (!hit) {
            try {
              hit = await scorer(q.query, repo, new AbortController().signal);
            } catch (error) {
              if (error instanceof JevAuthError) throw error;
              failures++;
              console.warn(`  Skip ${repo.fullName}: ${getErrorMessage(error)}`);
              return;
            }
            scores[key] = hit;
            if (++unsaved >= SAVE_EVERY) {
              unsaved = 0;
              writeJson(SCORES_FILE, scores);
            }
          }
          scored.push({ fullName: repo.fullName, score: hit.score, stars: repo.stars });
        }),
      ),
    );

    const jev = metrics(rankResults(scored, minScore).map((r) => r.fullName), q.expected);
    const keyword = metrics(recalledNames, q.expected);
    rows.push({ query: q.query, jev, keyword });
    const hit = jev.firstHit > 0 ? `#${jev.firstHit}` : 'miss';
    console.log(`  recall@${TOP_K}=${jev.recall.toFixed(2)} firstHit=${hit.padEnd(4)} keywordFirstHit=${keyword.firstHit > 0 ? '#' + keyword.firstHit : 'miss'}${failures ? ` failed=${failures}` : ''}  ${q.query}`);
  }
  writeJson(SCORES_FILE, scores);

  console.log('\n=== Summary ===');
  console.log(`Jev     recall@${TOP_K}=${average(rows.map((r) => r.jev.recall)).toFixed(3)}  MRR=${average(rows.map((r) => r.jev.rr)).toFixed(3)}`);
  console.log(`keyword recall@${TOP_K}=${average(rows.map((r) => r.keyword.recall)).toFixed(3)}  MRR=${average(rows.map((r) => r.keyword.rr)).toFixed(3)}  (MiniSearch recall only, baseline)`);
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
