import type { SyncStatus } from './db';
import type { ConnectionResult } from './github';
import type { Locale } from './i18n';

export interface RepoResult {
  fullName: string;
  htmlUrl: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
  score?: number;
}

/** Content script -> background over the long-lived port. */
export type ContentMessage =
  | { type: 'search'; requestId: string; username: string; query: string }
  | { type: 'cancel'; requestId: string }
  | { type: 'status'; username: string }
  | { type: 'sync'; username: string }
  | { type: 'suggest'; requestId: string; username: string; locale: Locale };

/** 'none' means this user was never synced. */
export type ProgressState = SyncStatus | 'none';

/** Background -> content script over the port. */
export type BackgroundMessage =
  | { type: 'progress'; username: string; fetched: number; total: number; state: ProgressState; message?: string }
  | { type: 'keyword'; requestId: string; results: RepoResult[] }
  | { type: 'rerank'; requestId: string; results: RepoResult[]; done: boolean }
  | { type: 'error'; requestId: string; message: string }
  /** Randomly generated query sentence; null when the user has no usable topics. */
  | { type: 'suggestion'; requestId: string; text: string | null };

/** One-shot requests via runtime.sendMessage from popup / options / content script. */
export type RuntimeRequest =
  | { type: 'startSync'; username: string }
  | { type: 'openOptions' }
  | { type: 'testConnection'; githubToken: string; jevKey: string };

export type RuntimeResponse =
  | { ok: true }
  | { ok: false; message: string }
  | { github: ConnectionResult; jev: ConnectionResult };
