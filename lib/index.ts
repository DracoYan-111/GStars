// MiniSearch index build and persistence. Tokenizer/fields/weights: see core/keyword.ts.
import { createIndex, loadIndex, searchKeyword, toDoc, upsertDoc, type IndexableRepo, type KeywordIndex } from './core/keyword';
import { db } from './db';

// In-memory service worker cache, rebuilt from IndexedDB after recycle; cached Promise avoids duplicate concurrent builds.
const cache = new Map<string, Promise<KeywordIndex>>();

async function buildIndex(username: string): Promise<KeywordIndex> {
  const persisted = await db.searchIndex.get(username);
  if (persisted) {
    try {
      return loadIndex(persisted.json);
    } catch (error) {
      console.warn('[gstars] Persisted index corrupted, rebuilding', error);
    }
  }
  const index = createIndex();
  const repos = await db.repos.where('username').equals(username).toArray();
  index.addAll(repos.map(toDoc));
  return index;
}

function getIndex(username: string): Promise<KeywordIndex> {
  const cached = cache.get(username);
  if (cached) return cached;
  const created = buildIndex(username);
  cache.set(username, created);
  created.catch(() => cache.delete(username));
  return created;
}

export async function addRepos(username: string, repos: IndexableRepo[]): Promise<void> {
  const index = await getIndex(username);
  for (const repo of repos) upsertDoc(index, repo);
}

export async function removeRepos(username: string, fullNames: string[]): Promise<void> {
  const index = await getIndex(username);
  for (const fullName of fullNames) {
    if (index.has(fullName)) index.discard(fullName);
  }
}

export async function persistIndex(username: string): Promise<void> {
  const index = await getIndex(username);
  await db.searchIndex.put({ username, json: JSON.stringify(index) });
}

/** Called on sync start: drop the old index so a recycled worker never reads a partial persisted copy. */
export async function invalidateIndex(username: string): Promise<void> {
  cache.delete(username);
  await db.searchIndex.delete(username);
}

export async function keywordSearch(username: string, query: string, limit?: number): Promise<string[]> {
  return searchKeyword(await getIndex(username), query, limit);
}
