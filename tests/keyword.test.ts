import { describe, expect, it } from 'vitest';
import { createIndex, loadIndex, searchKeyword, upsertDoc, type IndexableRepo } from '../lib/core/keyword';
import { hashQuery } from '../lib/core/hash';

const repo = (fullName: string, description: string, topics: string[] = [], readmeClean = ''): IndexableRepo => ({
  fullName,
  description,
  topics,
  readmeClean,
});

const repos = [
  repo('acme/token-saver', 'Reduce token usage for Claude Code', ['claude-code', 'skills']),
  repo('acme/vector-db', 'vector database with full-text search', ['database']),
  repo('acme/ui-kit', 'A React component library', ['react'], 'buttons and tokens for design'),
];

function build() {
  const index = createIndex();
  repos.forEach((r) => upsertDoc(index, r));
  return index;
}

describe('keyword index', () => {
  it('matches English by word with prefix support', () => {
    expect(searchKeyword(build(), 'claude')[0]).toBe('acme/token-saver');
    expect(searchKeyword(build(), 'compon')[0]).toBe('acme/ui-kit');
  });

  it('matches Chinese by bigram', () => {
    expect(searchKeyword(build(), 'vector database')[0]).toBe('acme/vector-db');
  });

  it('weighting: repo-name hits rank before README hits', () => {
    expect(searchKeyword(build(), 'token').slice(0, 2)).toEqual(['acme/token-saver', 'acme/ui-kit']);
  });

  it('upsert upserting the same repo creates no duplicate docs', () => {
    const index = build();
    upsertDoc(index, repo('acme/ui-kit', 'Renamed description', ['react']));
    expect(index.documentCount).toBe(3);
    expect(searchKeyword(index, 'renamed')).toEqual(['acme/ui-kit']);
  });

  it('results stay identical after serialize/load', () => {
    const index = build();
    const restored = loadIndex(JSON.stringify(index));
    expect(searchKeyword(restored, 'vector database')).toEqual(searchKeyword(index, 'vector database'));
  });

  it('limit works', () => {
    expect(searchKeyword(build(), 'token', 1)).toHaveLength(1);
  });
});

describe('hashQuery', () => {
  it('ignores case and extra whitespace', () => {
    expect(hashQuery('  Claude   Code ')).toBe(hashQuery('claude code'));
  });

  it('different queries hash differently', () => {
    expect(hashQuery('a')).not.toBe(hashQuery('b'));
  });
});
