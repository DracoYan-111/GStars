// "Random query" seeds: sample topics/languages from the DB; core/suggest.ts builds the sentence.
import type { SuggestSeed } from './core/suggest';
import { db } from './db';

/** How many repos to sample; only ones with topics, oversample to avoid all-topic-less picks. */
const SAMPLE_SIZE = 12;

/** Fetch one by one at random offsets to avoid loading all repos (with READMEs) into memory. */
export async function sampleSeeds(username: string): Promise<SuggestSeed[]> {
  const repos = () => db.repos.where('username').equals(username);
  const count = await repos().count();
  if (count === 0) return [];
  const offsets = Array.from({ length: Math.min(SAMPLE_SIZE, count) }, () => Math.floor(Math.random() * count));
  const picked = await Promise.all(offsets.map((offset) => repos().offset(offset).first()));
  return picked.flatMap((r) => (r ? [{ topics: r.topics, language: r.language }] : []));
}
