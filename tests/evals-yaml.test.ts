import { describe, expect, it } from 'vitest';
import { parseQueries } from '../evals/yaml';

describe('parseQueries', () => {
  it('parses multiple queries, comments and quotes', () => {
    const text = `
# comment
- query: claude code 节约token skills
  username: someone
  expected: [a/b, "c/d"]

- query: "带: 冒号 查询"
  username: other
  expected: [x/y]
`;
    expect(parseQueries(text)).toEqual([
      { query: 'claude code 节约token skills', username: 'someone', expected: ['a/b', 'c/d'] },
      { query: '带: 冒号 查询', username: 'other', expected: ['x/y'] },
    ]);
  });

  it('throws on missing fields', () => {
    expect(() => parseQueries('- query: q\n  username: u\n')).toThrow('missing');
  });

  it('unknown lines throw with line numbers', () => {
    expect(() => parseQueries('- query: q\n  foo: bar\n')).toThrow('Line 2');
  });
});
