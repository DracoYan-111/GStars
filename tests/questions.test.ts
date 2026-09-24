import { describe, expect, it } from 'vitest';
import { buildJevRequest, parseScoreAnswer, QUESTION_ID, QUESTION_VERSION, README_TOKEN_BUDGET, SCORE_LEVELS, truncateToTokens } from '../lib/core/questions';

const repo = { fullName: 'a/b', description: 'desc', topics: ['x'], readmeClean: 'readme' };

describe('buildJevRequest', () => {
  it('embeds the raw query and uses 4-level score criteria', () => {
    const req = buildJevRequest('claude code 节约token skills', repo);
    const q = req.questions[QUESTION_ID];
    expect(q?.type).toBe('score');
    expect(q?.instructions).toContain('claude code 节约token skills');
    expect(q?.criteria).toHaveLength(4);
    expect(req.model).toBe('jev-latest');
  });

  it('state only contains fullName, description, topics, readme', () => {
    expect(buildJevRequest('q', repo).state).toEqual({
      repository: 'a/b',
      description: 'desc',
      topics: ['x'],
      readme: 'readme',
    });
  });

  it('level count satisfies API limits (2-10) with distinct descriptions', () => {
    expect(SCORE_LEVELS.length).toBeGreaterThanOrEqual(2);
    expect(SCORE_LEVELS.length).toBeLessThanOrEqual(10);
    expect(new Set(SCORE_LEVELS).size).toBe(SCORE_LEVELS.length);
    expect(Number.isInteger(QUESTION_VERSION)).toBe(true);
  });
});

describe('parseScoreAnswer', () => {
  it('parses score and confidence', () => {
    const body = { answers: { [QUESTION_ID]: { type: 'score', score: 2.4, confidence: 0.8, probabilities: {} } } };
    expect(parseScoreAnswer(body)).toEqual({ score: 2.4, confidence: 0.8 });
  });

  it('treats missing confidence as 0', () => {
    const body = { answers: { [QUESTION_ID]: { type: 'score', score: 1 } } };
    expect(parseScoreAnswer(body)).toEqual({ score: 1, confidence: 0 });
  });

  it.each([null, {}, { answers: {} }, { answers: { [QUESTION_ID]: { type: 'noul', noul: 1 } } }, { answers: { [QUESTION_ID]: { type: 'score', score: 'x' } } }])(
    'throws on malformed response: %j',
    (body) => {
      expect(() => parseScoreAnswer(body)).toThrow();
    },
  );
});

describe('truncateToTokens', () => {
  it('truncates CJK at 1 token/char', () => {
    expect(truncateToTokens('中'.repeat(10), 4)).toBe('中'.repeat(4));
  });

  it('truncates Latin at 0.2 token/char', () => {
    expect(truncateToTokens('a'.repeat(100), 4)).toHaveLength(20);
  });

  it('returns as-is within budget', () => {
    expect(truncateToTokens('短文本', 100)).toBe('短文本');
  });

  it('keeps the README in the request within budget', () => {
    const req = buildJevRequest('q', { ...repo, readmeClean: '中'.repeat(5000) });
    expect(req.state.readme.length).toBe(README_TOKEN_BUDGET);
  });
});
