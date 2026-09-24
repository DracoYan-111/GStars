// Pure functions, no browser APIs.
// Jev request shape follows https://docs.typesafe.ai/api.md:
//   POST https://api.typesafe.ai/v1/systemone
//   { state, model, questions: { <id>: { type: 'score', instructions, criteria: string[2..10] } } }
//   Response answers.<id> = { type: 'score', score, legend, probabilities, confidence }

// Bump whenever the wording changes; old caches expire with it. Also rerun evals/run.ts.
export const QUESTION_VERSION = 2;

const JEV_MODEL = 'jev-latest';
export const QUESTION_ID = 'relevance';

/**
 * README budget sent to Jev (estimated tokens). Jev bills per request and each repo is one request, so the
 * README is the largest cost: an untruncated Chinese README can exceed 6k tokens. The opening of a README
 * usually introduces the project, which is enough to judge relevance.
 * The keyword index still uses the full readmeClean and is not affected.
 */
export const README_TOKEN_BUDGET = 400;
const CJK_CHAR = /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/;
// Measured: about 1 token per Chinese character and 0.17 token per English character; slightly conservative here.
// Counted in integer units of 1/5 token to avoid floating-point drift.
const UNITS_PER_TOKEN = 5;
const CJK_UNITS = 5; // 1 token
const OTHER_UNITS = 1; // 0.2 token

/** Truncates text by estimated token count */
export function truncateToTokens(text: string, budget: number): string {
  const limit = budget * UNITS_PER_TOKEN;
  let used = 0;
  let i = 0;
  for (const ch of text) {
    used += CJK_CHAR.test(ch) ? CJK_UNITS : OTHER_UNITS;
    if (used > limit) return text.slice(0, i);
    i += ch.length;
  }
  return text;
}

/**
 * Four levels, numbered from 0 by position. The model never sees the numbers, so each level must be a
 * self-contained sentence describing a concrete situation. The wording is product behavior: changing it
 * requires bumping QUESTION_VERSION and rerunning the evals.
 */
export const SCORE_LEVELS: readonly string[] = [
  '与需求无关：仓库的主题、用途和适用场景与需求没有任何交集。',
  '同一领域但不满足需求：仓库与需求属于同一技术领域或话题，但解决的是另一个问题，无法满足需求。',
  '部分满足需求：仓库覆盖了需求的一部分，或只能间接、有限地满足需求。',
  '直接满足需求：仓库的核心功能与需求描述的内容一致，可以直接用来满足需求。',
];

export interface RepoForScoring {
  fullName: string;
  description: string;
  topics: string[];
  readmeClean: string;
}

export interface ScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}

export interface JevRequest {
  state: {
    repository: string;
    description: string;
    topics: string[];
    readme: string;
  };
  model: string;
  questions: Record<string, ScoreQuestion>;
}

export interface ScoreAnswer {
  score: number;
  confidence: number;
}

function buildScoreQuestion(query: string): ScoreQuestion {
  return {
    type: 'score',
    instructions:
      `用户想在 GitHub 仓库中找到满足下面这个需求的项目：\n「${query.trim()}」\n` +
      '请判断 state 中描述的这个仓库满足该需求的程度。',
    criteria: [...SCORE_LEVELS],
  };
}

export function buildJevRequest(query: string, repo: RepoForScoring): JevRequest {
  return {
    state: {
      repository: repo.fullName,
      description: repo.description,
      topics: repo.topics,
      readme: truncateToTokens(repo.readmeClean, README_TOKEN_BUDGET),
    },
    model: JEV_MODEL,
    questions: { [QUESTION_ID]: buildScoreQuestion(query) },
  };
}

/** Responses come from an external service; validate field by field and throw on mismatch */
export function parseScoreAnswer(body: unknown): ScoreAnswer {
  const answers = (body as { answers?: Record<string, unknown> } | null)?.answers;
  const answer = answers?.[QUESTION_ID] as { type?: unknown; score?: unknown; confidence?: unknown } | undefined;
  if (!answer || answer.type !== 'score') {
    throw new Error('Jev response is missing the score answer');
  }
  const { score, confidence } = answer;
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error('Jev response score is not a number');
  }
  return { score, confidence: typeof confidence === 'number' ? confidence : 0 };
}
