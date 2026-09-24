import { expect, test } from 'vitest';
import { tokenize } from '../lib/core/tokenizer';

test('splits english words and lowercases', () => {
  expect(tokenize('Claude Code')).toEqual(['claude', 'code']);
});

test('keeps numbers attached to words as single tokens', () => {
  expect(tokenize('gpt4 v2')).toEqual(['gpt4', 'v2']);
});

test('splits consecutive chinese into bigrams', () => {
  expect(tokenize('节约token')).toEqual(['节约', 'token']);
  expect(tokenize('中文分词测试')).toEqual(['中文', '文分', '分词', '词测', '测试']);
});

test('single trailing chinese char becomes its own token', () => {
  expect(tokenize('测')).toEqual(['测']);
});

test('mixed chinese and english query matches document tokenization', () => {
  const query = tokenize('claude code 节约token skills');
  expect(query).toEqual(['claude', 'code', '节约', 'token', 'skills']);
});

test('ignores punctuation as separators', () => {
  expect(tokenize('a, b.c!')).toEqual(['a', 'b', 'c']);
});
