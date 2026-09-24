import { describe, expect, it } from 'vitest';
import { suggestQuery, type SuggestSeed } from '../lib/core/suggest';

/** Sequential pseudo-random stub */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] as number;
};

describe('suggestQuery', () => {
  it('returns null without topics', () => {
    expect(suggestQuery([], 'zh-CN')).toBeNull();
    expect(suggestQuery([{ topics: [], language: 'Go' }], 'en')).toBeNull();
  });

  it('Only seeds from repos with topics; slug hyphens become spaces', () => {
    const seeds: SuggestSeed[] = [
      { topics: [], language: 'Go' },
      { topics: ['machine-learning'], language: null },
    ];
    // one seed repo, one topic, no language/second topic: single-topic template.
    expect(suggestQuery(seeds, 'zh-CN', sequence(0))).toBe('我收藏过哪些 machine learning 相关的项目');
  });

  it('language template when a language exists', () => {
    const seeds: SuggestSeed[] = [{ topics: ['cli'], language: 'Rust' }];
    // order: pick repo, topic, template group (2nd = language), in-group template.
    expect(suggestQuery(seeds, 'zh-CN', sequence(0, 0, 0.9, 0))).toBe('有没有用 Rust 写的 cli 工具');
    expect(suggestQuery(seeds, 'en', sequence(0, 0, 0.9, 0))).toBe('a cli tool written in Rust');
  });

  it('combines when two topics exist', () => {
    const seeds: SuggestSeed[] = [{ topics: ['llm', 'rag'], language: null }];
    // order: pick repo, topic(llm), other topic(rag), group (2nd = two-topic), in-group template.
    expect(suggestQuery(seeds, 'zh-CN', sequence(0, 0, 0, 0.9, 0))).toBe('把 llm 和 rag 结合起来的项目');
  });

  it('always generates a non-empty string', () => {
    const seeds: SuggestSeed[] = [{ topics: ['a', 'b-c'], language: 'TypeScript' }];
    for (let i = 0; i < 50; i++) {
      const text = suggestQuery(seeds, i % 2 ? 'en' : 'zh-CN');
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/undefined|null/);
    }
  });
});
