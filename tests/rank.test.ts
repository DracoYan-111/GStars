import { expect, test } from 'vitest';
import { rankResults } from '../lib/core/rank';

test('filters out results below minScore', () => {
  const results = [
    { fullName: 'a', score: 3, stars: 1 },
    { fullName: 'b', score: 1, stars: 100 },
  ];
  expect(rankResults(results, 1.5).map((r) => r.fullName)).toEqual(['a']);
});

test('sorts by score descending', () => {
  const results = [
    { fullName: 'low', score: 2, stars: 1 },
    { fullName: 'high', score: 3, stars: 1 },
  ];
  expect(rankResults(results, 0).map((r) => r.fullName)).toEqual(['high', 'low']);
});

test('breaks score ties by stars descending', () => {
  const results = [
    { fullName: 'fewer-stars', score: 3, stars: 10 },
    { fullName: 'more-stars', score: 3, stars: 100 },
  ];
  expect(rankResults(results, 0).map((r) => r.fullName)).toEqual(['more-stars', 'fewer-stars']);
});

test('uses default min score when not provided', () => {
  const results = [{ fullName: 'a', score: 1.4, stars: 1 }];
  expect(rankResults(results)).toEqual([]);
});
