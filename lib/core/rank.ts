// Pure functions, no browser APIs.
// Ranking: Jev score desc, stars desc on ties. Below MIN_SCORE is dropped.

export const DEFAULT_MIN_SCORE = 1.5;

/** Queries shorter than this after trim use keyword recall only, no Jev */
export const MIN_JEV_QUERY_LENGTH = 2;

/** Candidate cap handed to Jev after keyword recall (when repos exceed FULL_SCAN_LIMIT) */
export const RECALL_CANDIDATE_LIMIT = 200;

/** Push a rerank update every this many scored repos */
export const RERANK_BATCH_SIZE = 50;

export interface ScoredRepo {
  fullName: string;
  score: number;
  stars: number;
}

export function rankResults<T extends ScoredRepo>(
  results: T[],
  minScore = DEFAULT_MIN_SCORE,
): T[] {
  return results
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || b.stars - a.stars);
}
