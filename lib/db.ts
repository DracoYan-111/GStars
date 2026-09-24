import Dexie, { type EntityTable, type Table } from 'dexie';

export type SyncStatus = 'pending' | 'running' | 'done' | 'error';

export interface Repo {
  username: string;
  fullName: string;
  description: string;
  topics: string[];
  language: string | null;
  stars: number;
  /** Older synced records lack this field; backfilled on next incremental check. */
  forks?: number;
  pushedAt: string;
  htmlUrl: string;
  readmeSha: string | null;
  readmeClean: string;
  /** Sync round that wrote this record (SyncState.startedAt); unstarred repos are pruned when sync ends. */
  syncRun: number;
}

export interface SyncState {
  username: string;
  state: SyncStatus;
  fetched: number;
  total: number;
  updatedAt: number;
  /** Start time of this sync round, unchanged on resume. */
  startedAt: number;
  /** Most recent failure reason. */
  error?: string;
}

export interface Score {
  queryHash: string;
  fullName: string;
  readmeSha: string;
  questionVersion: number;
  score: number;
  confidence: number;
}

export interface SearchIndex {
  username: string;
  json: string;
}

export const db = new Dexie('gstars') as Dexie & {
  repos: Table<Repo, [string, string]>;
  syncState: EntityTable<SyncState, 'username'>;
  scores: Table<Score, [string, string, string, number]>;
  searchIndex: EntityTable<SearchIndex, 'username'>;
};

db.version(1).stores({
  repos: '[username+fullName], username',
  syncState: 'username',
  scores: '[queryHash+fullName+readmeSha+questionVersion]',
  searchIndex: 'username',
});
