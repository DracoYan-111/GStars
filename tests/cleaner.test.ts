import { expect, test } from 'vitest';
import { cleanReadme } from '../lib/core/cleaner';

test('removes images and badges', () => {
  const out = cleanReadme('# Title\n\n![build](https://img.shields.io/badge.svg)\n\nBody text.');
  expect(out).not.toContain('img.shields.io');
  expect(out).toContain('Title');
  expect(out).toContain('Body text.');
});

test('removes html tags', () => {
  const out = cleanReadme('<div align="center">\n<h1>Hello</h1>\n</div>\n\nParagraph.');
  expect(out).not.toContain('<div');
  expect(out).not.toContain('<h1>');
  expect(out).toContain('Hello');
  expect(out).toContain('Paragraph.');
});

test('removes code blocks and inline code', () => {
  const out = cleanReadme('Before\n\n```js\nconst x = 1;\n```\n\nAfter `inline` code.');
  expect(out).not.toContain('const x = 1');
  expect(out).not.toContain('`inline`');
  expect(out).toContain('Before');
  expect(out).toContain('After');
});

test('removes pure-link table rows and separator rows, keeps mixed-text rows', () => {
  const md = [
    '| [Link1](https://a.com) | [Link2](https://b.com) |',
    '| --- | --- |',
    '| Real text | [also a link](https://c.com) |',
  ].join('\n');
  const out = cleanReadme(md);
  expect(out).not.toContain('---');
  expect(out).toContain('Real text');
  expect(out).toContain('also a link');
});

test('converts remaining markdown links to plain text', () => {
  const out = cleanReadme('See [the docs](https://example.com) for details.');
  expect(out).toContain('the docs');
  expect(out).not.toContain('https://example.com');
});

test('collapses consecutive blank lines', () => {
  const out = cleanReadme('A\n\n\n\n\nB');
  expect(out).toBe('A\n\nB');
});

test('truncates to max length', () => {
  const out = cleanReadme('x'.repeat(10000), 100);
  expect(out.length).toBe(100);
});
