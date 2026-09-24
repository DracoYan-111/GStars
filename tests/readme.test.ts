import { describe, expect, it } from 'vitest';
import { buildReadmeQuery, decodeBase64Utf8, parseReadmeResponse, README_FILENAMES } from '../lib/core/readme';

describe('buildReadmeQuery', () => {
  it('repo names go via variables, not inlined into query text', () => {
    const { query, variables } = buildReadmeQuery(['a/b', 'evil"}/x']);
    expect(variables).toEqual({ o0: 'a', n0: 'b', o1: 'evil"}', n1: 'x' });
    expect(query).not.toContain('evil');
    expect(query).toContain('r1: repository(owner: $o1, name: $n1)');
    expect(query).toContain('"HEAD:README.md"');
  });
});

describe('parseReadmeResponse', () => {
  const blob = (oid: string, text: string | null, isBinary = false) => ({ oid, text, isBinary });

  it('takes the first existing text README in filename order', () => {
    const body = {
      data: {
        r0: { f0: null, f1: blob('s1', 'lower'), f4: blob('s4', 'rst') },
        r1: { f0: blob('bin', null, true), f6: blob('s6', 'plain') },
      },
    };
    const found = parseReadmeResponse(['a/b', 'c/d'], body);
    expect(found.get('a/b')).toEqual({ sha: 's1', text: 'lower' });
    expect(found.get('c/d')).toEqual({ sha: 's6', text: 'plain' });
  });

  it('omits repos with no README or a null repository', () => {
    const empty = Object.fromEntries(README_FILENAMES.map((_, j) => [`f${j}`, null]));
    const found = parseReadmeResponse(['a/b', 'gone/x'], { data: { r0: empty, r1: null }, errors: [{}] });
    expect(found.size).toBe(0);
  });

  it('throws when data is missing', () => {
    expect(() => parseReadmeResponse(['a/b'], { errors: [{ message: 'x' }] })).toThrow();
  });
});

describe('decodeBase64Utf8', () => {
  it('decodes UTF-8 content that contains line breaks', () => {
    const encoded = Buffer.from('# 标题\nhello').toString('base64');
    expect(decodeBase64Utf8(`${encoded.slice(0, 8)}\n${encoded.slice(8)}\n`)).toBe('# 标题\nhello');
  });
});
