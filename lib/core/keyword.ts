// Pure functions, no browser APIs (MiniSearch itself needs no browser).
import MiniSearch, { type Options, type SearchOptions } from 'minisearch';
import { tokenize } from './tokenizer';

export interface IndexableRepo {
  fullName: string;
  description: string;
  topics: string[];
  readmeClean: string;
}

interface IndexDoc {
  id: string;
  fullName: string;
  description: string;
  topics: string;
  readmeClean: string;
}

// Field weights: fullName > topics > description > readmeClean
const BOOST = { fullName: 4, topics: 3, description: 2, readmeClean: 1 };

const INDEX_OPTIONS: Options<IndexDoc> = {
  fields: ['fullName', 'topics', 'description', 'readmeClean'],
  tokenize,
  // tokenize already lowercases, skip the default processTerm pass
  processTerm: (term) => term,
};

const SEARCH_OPTIONS: SearchOptions = {
  boost: BOOST,
  prefix: true,
  fuzzy: 0.1, // Light fuzziness: only longer terms allow a 1-char difference
  combineWith: 'OR',
};

export type KeywordIndex = MiniSearch<IndexDoc>;

export function toDoc(repo: IndexableRepo): IndexDoc {
  return {
    id: repo.fullName,
    fullName: repo.fullName,
    description: repo.description,
    topics: repo.topics.join(' '),
    readmeClean: repo.readmeClean,
  };
}

export function createIndex(): KeywordIndex {
  return new MiniSearch<IndexDoc>(INDEX_OPTIONS);
}

export function loadIndex(json: string): KeywordIndex {
  return MiniSearch.loadJSON<IndexDoc>(json, INDEX_OPTIONS);
}

/** Adds or overwrites one doc (same repo may be written twice during sync) */
export function upsertDoc(index: KeywordIndex, repo: IndexableRepo): void {
  const doc = toDoc(repo);
  if (index.has(doc.id)) index.replace(doc);
  else index.add(doc);
}

/** Returns fullName list by descending relevance */
export function searchKeyword(index: KeywordIndex, query: string, limit?: number): string[] {
  const ids = index.search(query, SEARCH_OPTIONS).map((hit) => String(hit.id));
  return limit === undefined ? ids : ids.slice(0, limit);
}
