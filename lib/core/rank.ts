// Pure functions, no browser APIs.
// Ranking: Jev score desc, stars desc on ties. Below MIN_SCORE is dropped.

/**
 * 2 = "partially meets the need". Measured with `pnpm eval` (30 queries, v2 question): raising the threshold
 * from 1.5 to 2.0 halved the non-expected results shown (1.7 → 0.8 per query) with MRR and recall@10 unchanged
 * at 1.0; 2.5 started dropping expected repos (recall@10 0.983).
 */
export const DEFAULT_MIN_SCORE = 2;

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
