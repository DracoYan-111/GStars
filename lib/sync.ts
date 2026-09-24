// Sync task: fetch all stars and READMEs for a user, resumable.
// All progress lives in IndexedDB (syncState). When the service worker is recycled, rerun this round:
// Re-fetch the star list (fast); repos already written with this round syncRun are skipped.
import pLimit, { type LimitFunction } from 'p-limit';
import { cleanReadme } from './core/cleaner';
import { REFRESH_INTERVAL_MS, type Settings } from './core/settings';
import { getErrorMessage, isAbortError } from './async';
import { db, type Repo, type SyncState } from './db';
import { fetchAllStars, fetchReadme, fetchReadmes, GitHubError, type Readme, type StarredRepo } from './github';
import { addRepos, invalidateIndex, persistIndex, removeRepos } from './index';

export type ProgressListener = (state: SyncState) => void;

/** How many repos per GraphQL README query. 10 per batch with concurrency is fastest; bigger batches slow down. */
const README_BATCH_SIZE = 10;
/** Repos missing from batch query fall back to REST one by one with its own limit, avoiding a burst on batch failure. */
const REST_CONCURRENCY = 6;

// Only dedupes launches within one service worker lifetime; real state is in IndexedDB.
const running = new Set<string>();

export function getSyncState(username: string): Promise<SyncState | undefined> {
  return db.syncState.get(username);
}

/** 401 or still-rate-limited after retry fails everything after it, so abort the round; other errors only skip the current repo. */
function isFatal(error: unknown): boolean {
  if (isAbortError(error)) return true;
  return error instanceof GitHubError && (error.status === 401 || error.isRateLimited);
}

interface Job {
  repo: StarredRepo;
  existing: Repo | undefined;
  syncRun: number;
}

/**
 * README only changes after a push: repos with unchanged pushedAt reuse the stored README, only metadata like stars is refreshed.
 * Empty pushedAt means the last README fetch failed and must be retried.
 */
function canReuse(job: Job): job is Job & { existing: Repo } {
  return job.existing !== undefined && job.existing.pushedAt !== '' && job.existing.pushedAt === job.repo.pushedAt;
}

function toRecord(username: string, { repo, existing, syncRun }: Job, readme: Readme | null): Repo {
  if (readme === null) return { ...repo, username, readmeSha: null, readmeClean: '', syncRun };
  const readmeClean = existing?.readmeSha === readme.sha ? existing.readmeClean : cleanReadme(readme.text);
  return { ...repo, username, readmeSha: readme.sha, readmeClean, syncRun };
}

/** README fetch failed: keep the old README; clear pushedAt so next sync does not skip via "pushedAt unchanged". */
function toFailedRecord(username: string, { repo, existing, syncRun }: Job, error: unknown): Repo {
  console.warn(`[gstars] Skip ${repo.fullName}  README: ${getErrorMessage(error)}`);
  return {
    ...repo,
    username,
    pushedAt: '',
    readmeSha: existing?.readmeSha ?? null,
    readmeClean: existing?.readmeClean ?? '',
    syncRun,
  };
}

async function fetchOne(username: string, job: Job, token: string): Promise<Repo> {
  try {
    return toRecord(username, job, await fetchReadme(job.repo.fullName, token));
  } catch (error) {
    if (isFatal(error)) throw error;
    return toFailedRecord(username, job, error);
  }
}

/** One batch: one GraphQL query for root READMEs first, REST fallback for misses (404 there confirms no README). */
async function fetchBatch(username: string, jobs: Job[], token: string, rest: LimitFunction): Promise<Repo[]> {
  let found = new Map<string, Readme>();
  try {
    found = await fetchReadmes(
      jobs.map((j) => j.repo.fullName),
      token,
    );
  } catch (error) {
    if (isFatal(error)) throw error;
    console.warn(`[gstars] Batch README fetch failed, falling back to per-repo requests for this batch: ${getErrorMessage(error)}`);
  }
  return Promise.all(
    jobs.map((job) => {
      const readme = found.get(job.repo.fullName);
      return readme ? toRecord(username, job, readme) : rest(() => fetchOne(username, job, token));
    }),
  );
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/** Build records for a set of repos, callback per finished batch (persist, index, progress). */
async function resolveRecords(
  username: string,
  jobs: Job[],
  settings: Settings,
  onBatch: (records: Repo[]) => Promise<void>,
): Promise<void> {
  const reused = jobs.filter(canReuse).map(({ repo, existing, syncRun }) => ({ ...existing, ...repo, username, syncRun }));
  if (reused.length > 0) await onBatch(reused);

  const batchLimit = pLimit(settings.syncConcurrency);
  const restLimit = pLimit(REST_CONCURRENCY);
  const pending = jobs.filter((job) => !canReuse(job));
  await Promise.all(
    chunk(pending, README_BATCH_SIZE).map((batch) =>
      batchLimit(async () => onBatch(await fetchBatch(username, batch, settings.githubToken, restLimit))),
    ),
  );
}

async function removeUnstarred(username: string, syncRun: number): Promise<void> {
  const stale = await db.repos
    .where('username')
    .equals(username)
    .filter((r) => r.syncRun !== syncRun)
    .primaryKeys();
  if (stale.length === 0) return;
  await db.repos.bulkDelete(stale);
  await removeRepos(
    username,
    stale.map(([, fullName]) => fullName),
  );
}

async function run(initial: SyncState, settings: Settings, onProgress: ProgressListener): Promise<void> {
  let state = initial;
  const save = async (patch: Partial<SyncState>) => {
    state = { ...state, ...patch, updatedAt: Date.now() };
    await db.syncState.put(state);
    onProgress(state);
  };

  try {
    await save({ state: 'running', error: undefined });
    const { username, startedAt } = state;
    const listed = await fetchAllStars(username, settings.githubToken);
    const existing = await db.repos.bulkGet(listed.map((r): [string, string] => [username, r.fullName]));
    // Resume: repos already written this round (syncRun equals round start) are skipped
    const jobs = listed.flatMap((repo, i) => {
      const old = existing[i];
      return old?.syncRun === startedAt ? [] : [{ repo, existing: old, syncRun: startedAt }];
    });
    let fetched = listed.length - jobs.length;
    await save({ total: listed.length, fetched });

    await resolveRecords(username, jobs, settings, async (records) => {
      fetched += records.length;
      await db.repos.bulkPut(records); // persist immediately per finished batch
      await addRepos(username, records);
      await save({ fetched });
    });

    await removeUnstarred(username, startedAt);
    const total = await db.repos.where('username').equals(username).count();
    await persistIndex(username);
    await save({ state: 'done', fetched: total, total });
  } catch (error) {
    console.warn(`[gstars] Sync ${state.username} failed`, error);
    await save({ state: 'error', error: getErrorMessage(error) });
  }
}

function isSameRecord(a: Repo, b: Repo): boolean {
  return (
    a.stars === b.stars &&
    a.forks === b.forks &&
    a.description === b.description &&
    a.language === b.language &&
    a.pushedAt === b.pushedAt &&
    a.readmeSha === b.readmeSha &&
    a.topics.join() === b.topics.join()
  );
}

/**
 * Incremental check for synced users: silent, never changes state (stays done), no loading UI.
 * Only fetch the star list; fetch README only for new/pushed repos; remove unstarred repos from DB and index.
 * On mid-check failure keep existing data and retry next time (updatedAt still updates to avoid retry storms).
 */
async function refresh(state: SyncState, settings: Settings, onProgress: ProgressListener): Promise<void> {
  const { username } = state;
  let next: SyncState = { ...state, updatedAt: Date.now() };
  try {
    const listed = await fetchAllStars(username, settings.githubToken);
    const existing = await db.repos.where('username').equals(username).toArray();
    const byName = new Map(existing.map((r) => [r.fullName, r]));
    const jobs = listed.map((repo) => {
      const old = byName.get(repo.fullName);
      return { repo, existing: old, syncRun: old?.syncRun ?? state.startedAt };
    });
    const changed: Repo[] = [];

    await resolveRecords(username, jobs, settings, async (records) => {
      const updates = records.filter((r) => {
        const old = byName.get(r.fullName);
        return !old || !isSameRecord(old, r);
      });
      if (updates.length === 0) return;
      await db.repos.bulkPut(updates);
      changed.push(...updates);
    });

    const listedNames = new Set(listed.map((r) => r.fullName));
    const gone = existing.filter((r) => !listedNames.has(r.fullName));
    if (gone.length > 0) {
      await db.repos.bulkDelete(gone.map((r): [string, string] => [username, r.fullName]));
      await removeRepos(username, gone.map((r) => r.fullName));
    }
    if (changed.length > 0 || gone.length > 0) {
      await addRepos(username, changed);
      await persistIndex(username);
    }
    next = { ...next, fetched: listed.length, total: listed.length };
  } catch (error) {
    console.warn(`[gstars] Incremental check ${username} failed, keeping existing data`, error);
  }
  await db.syncState.put(next);
  onProgress(next);
}

/** Whether the check interval elapsed (15s margin against timer/updatedAt skew). */
function isStale(state: SyncState): boolean {
  return Date.now() - state.updatedAt >= REFRESH_INTERVAL_MS - 15_000;
}

/**
 * Start, resume, or incrementally check.
 * - No record: first full sync, results persisted to IndexedDB
 * - pending / running / error: rerun the round, skipping repos already written with this syncRun
 * - done: no refetch; silent incremental check only if unchecked for over 5 minutes
 */
export async function startSync(username: string, settings: Settings, onProgress: ProgressListener): Promise<void> {
  if (running.has(username)) return;
  running.add(username);
  try {
    const previous = await getSyncState(username);

    if (previous?.state === 'done') {
      if (settings.githubToken && isStale(previous)) await refresh(previous, settings, onProgress);
      return;
    }

    const initial: SyncState = previous ?? {
      username,
      state: 'pending',
      fetched: 0,
      total: 0,
      updatedAt: Date.now(),
      startedAt: Date.now(),
    };

    if (!settings.githubToken) {
      const failed: SyncState = { ...initial, state: 'error', error: 'GitHub token is not configured', updatedAt: Date.now() };
      await db.syncState.put(failed);
      onProgress(failed);
      return;
    }
    if (!previous) await invalidateIndex(username);
    await run(initial, settings, onProgress);
  } finally {
    running.delete(username);
  }
}

/** Find all unfinished (pending / running) syncs, resumed on background startup */
export async function listUnfinished(): Promise<SyncState[]> {
  return db.syncState.filter((s) => s.state === 'pending' || s.state === 'running').toArray();
}
