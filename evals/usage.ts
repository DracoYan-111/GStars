// Measures real Jev token usage and cost per request and per search.
// Usage: pnpm eval:usage (reads JEV_API_KEY from .env in the project root when present)
// Env vars:
//   JEV_API_KEY        required
//   USAGE_USER=name    whose cached stars to score (default ruanyf; run `pnpm eval` first to cache them)
// Sends one real Jev request per (query, repo) pair using the same request builder as the extension,
// and reads `usage.input_tokens` from each response. Results go to evals/.cache/usage.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pLimit from 'p-limit';
import { buildJevRequest, parseScoreAnswer, QUESTION_VERSION, README_TOKEN_BUDGET, type RepoForScoring } from '../lib/core/questions';
import { DEFAULT_SETTINGS } from '../lib/core/settings';
import { sleep } from '../lib/async';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
/** USD per million input tokens (docs.typesafe.ai/models, jev-1.13.0). Output tokens are free. */
const USD_PER_MTOK = 0.042;
const QUERIES = ['中文分词 命名实体识别', 'Python code formatter', 'Node.js 日志库 logger'];
const CACHE_DIR = fileURLToPath(new URL('./.cache/', import.meta.url));

interface Sample {
  query: string;
  repo: string;
  readmeChars: number;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

async function measure(apiKey: string, query: string, repo: RepoForScoring): Promise<Sample> {
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildJevRequest(query, repo)),
    });
    const ms = performance.now() - started;
    if (res.status === 429 && attempt < 4) {
      await sleep(Number(res.headers.get('retry-after') ?? 1) * 1000 || 1000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { usage?: { input_tokens?: number; output_tokens?: number } };
    parseScoreAnswer(body); // make sure it is a real, well-formed answer
    return {
      query,
      repo: repo.fullName,
      readmeChars: repo.readmeClean.length,
      inputTokens: body.usage?.input_tokens ?? NaN,
      outputTokens: body.usage?.output_tokens ?? NaN,
      ms,
    };
  }
}

function stats(values: number[]): { min: number; median: number; mean: number; p95: number; max: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? NaN;
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return { min: sorted[0] ?? NaN, median: at(0.5), mean, p95: at(0.95), max: sorted[sorted.length - 1] ?? NaN };
}

async function main(): Promise<void> {
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey) throw new Error('Missing env var JEV_API_KEY');
  const user = process.env.USAGE_USER ?? 'ruanyf';
  const file = `${CACHE_DIR}stars-${user}.json`;
  if (!existsSync(file)) throw new Error(`No cached stars for ${user}; run pnpm eval first`);
  const repos = JSON.parse(readFileSync(file, 'utf8')) as RepoForScoring[];

  const limit = pLimit(DEFAULT_SETTINGS.jevConcurrency);
  const samples: Sample[] = [];
  for (const query of QUERIES) {
    const started = performance.now();
    const batch = await Promise.all(repos.map((repo) => limit(() => measure(apiKey, query, repo))));
    const wall = (performance.now() - started) / 1000;
    samples.push(...batch);
    const tokens = batch.reduce((s, x) => s + x.inputTokens, 0);
    console.log(
      `${query}: ${batch.length} requests, ${tokens} input tokens, $${((tokens / 1e6) * USD_PER_MTOK).toFixed(5)}, ${wall.toFixed(1)}s wall`,
    );
  }

  const input = stats(samples.map((s) => s.inputTokens));
  const output = stats(samples.map((s) => s.outputTokens));
  const latency = stats(samples.map((s) => s.ms));
  const withReadme = samples.filter((s) => s.readmeChars > 0);
  const noReadme = samples.filter((s) => s.readmeChars === 0);
  const summary = {
    measuredAt: new Date().toISOString(),
    questionVersion: QUESTION_VERSION,
    readmeTokenBudget: README_TOKEN_BUDGET,
    usdPerMtok: USD_PER_MTOK,
    repos: repos.length,
    requests: samples.length,
    inputTokens: input,
    outputTokens: output,
    latencyMs: latency,
    inputTokensWithReadme: stats(withReadme.map((s) => s.inputTokens)),
    inputTokensWithoutReadme: noReadme.length ? stats(noReadme.map((s) => s.inputTokens)) : null,
    perQueryInputTokens: Object.fromEntries(
      QUERIES.map((q) => [q, stats(samples.filter((s) => s.query === q).map((s) => s.inputTokens)).mean]),
    ),
  };
  writeFileSync(`${CACHE_DIR}usage.json`, JSON.stringify({ summary, samples }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
