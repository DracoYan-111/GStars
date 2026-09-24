import { getErrorMessage, isAbortError } from '@/lib/async';
import { hasRequiredKeys } from '@/lib/core/settings';
import { isValidUsername, normalizeUsername } from '@/lib/core/username';
import type { SyncState } from '@/lib/db';
import { testGithubToken } from '@/lib/github';
import { testJevKey } from '@/lib/jev';
import type { BackgroundMessage, ContentMessage, RuntimeRequest, RuntimeResponse } from '@/lib/messages';
import { runSearch } from '@/lib/search';
import { suggestQuery } from '@/lib/core/suggest';
import { sampleSeeds } from '@/lib/suggest';
import type { Settings } from '@/lib/core/settings';
import { loadSettings, onSettingsChanged } from '@/lib/settings';
import { detectLocale, setPreferredLocale, t } from '@/lib/i18n';
import { getSyncState, listUnfinished, startSync } from '@/lib/sync';

type Port = ReturnType<typeof browser.runtime.connect>;

const MAX_QUERY_LENGTH = 500;

function toProgress(username: string, state: SyncState | undefined): BackgroundMessage {
  if (!state) return { type: 'progress', username, fetched: 0, total: 0, state: 'none' };
  return {
    type: 'progress',
    username,
    fetched: state.fetched,
    total: state.total,
    state: state.state,
    message: state.error,
  };
}

/** Data from ports is untrusted, validate field by field. */
function parseContentMessage(raw: unknown): ContentMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const isUser = (v: unknown): v is string => typeof v === 'string' && isValidUsername(v);
  switch (m.type) {
    case 'search':
      return typeof m.requestId === 'string' && isUser(m.username) && typeof m.query === 'string'
        ? { type: 'search', requestId: m.requestId, username: m.username, query: m.query.slice(0, MAX_QUERY_LENGTH) }
        : null;
    case 'cancel':
      return typeof m.requestId === 'string' ? { type: 'cancel', requestId: m.requestId } : null;
    case 'status':
    case 'sync':
      return isUser(m.username) ? { type: m.type, username: m.username } : null;
    case 'suggest':
      return typeof m.requestId === 'string' && isUser(m.username)
        ? { type: 'suggest', requestId: m.requestId, username: m.username, locale: m.locale === 'zh-CN' ? 'zh-CN' : 'en' }
        : null;
    default:
      return null;
  }
}

function applyLocaleSetting(settings: Settings): void {
  setPreferredLocale(settings.locale === 'auto' ? null : settings.locale);
}

export default defineBackground(() => {
  void loadSettings().then(applyLocaleSetting);
  onSettingsChanged(applyLocaleSetting);

  // Only forwards sync progress to ports viewing that user; content script reconnects and sends status to recover on loss
  const watchers = new Map<Port, string>();

  const notifyProgress = (state: SyncState) => {
    for (const [port, username] of watchers) {
      if (username !== state.username) continue;
      try {
        port.postMessage(toProgress(username, state));
      } catch {
        watchers.delete(port);
      }
    }
  };

  const launchSync = async (username: string) => {
    try {
      await startSync(username, await loadSettings(), notifyProgress);
    } catch (error) {
      console.error('[gstars] Failed to start sync', error);
    }
  };

  // On startup (including service worker restart) resume unfinished syncs
  void listUnfinished().then((states) => states.forEach((s) => void launchSync(s.username)));

  browser.runtime.onConnect.addListener((port) => {
    const controllers = new Map<string, AbortController>();

    const post = (message: BackgroundMessage) => {
      try {
        port.postMessage(message);
      } catch {
        // Port disconnected, the disconnect handler cleans up.
      }
    };

    const handleSearch = async (msg: Extract<ContentMessage, { type: 'search' }>) => {
      const controller = new AbortController();
      controllers.set(msg.requestId, controller);
      try {
        await runSearch(msg, await loadSettings(), controller.signal, post);
      } catch (error) {
        if (!isAbortError(error) && !controller.signal.aborted) {
          console.error('[gstars] Search failed', error);
          post({ type: 'error', requestId: msg.requestId, message: getErrorMessage(error) });
        }
      } finally {
        controllers.delete(msg.requestId);
      }
    };

    const handleSuggest = async (msg: Extract<ContentMessage, { type: 'suggest' }>) => {
      try {
        const text = suggestQuery(await sampleSeeds(msg.username), msg.locale);
        post({ type: 'suggestion', requestId: msg.requestId, text });
      } catch (error) {
        console.error('[gstars] Failed to generate random query', error);
        post({ type: 'suggestion', requestId: msg.requestId, text: null });
      }
    };

    const handleStatus = async (username: string) => {
      const state = await getSyncState(username);
      post(toProgress(username, state));
      // pending / running: resume; done: silent incremental check if stale (decided inside startSync)
      if (state && state.state !== 'error') void launchSync(username);
    };

    port.onMessage.addListener((raw: unknown) => {
      const msg = parseContentMessage(raw);
      if (!msg) return;
      switch (msg.type) {
        case 'search':
          watchers.set(port, msg.username);
          void handleSearch(msg);
          break;
        case 'cancel':
          controllers.get(msg.requestId)?.abort();
          break;
        case 'status':
          watchers.set(port, msg.username);
          void handleStatus(msg.username);
          break;
        case 'sync':
          watchers.set(port, msg.username);
          void launchSync(msg.username);
          break;
        case 'suggest':
          void handleSuggest(msg);
          break;
      }
    });

    // Port disconnected: abort all in-flight searches on this connection (including Jev calls).
    port.onDisconnect.addListener(() => {
      watchers.delete(port);
      controllers.forEach((c) => c.abort());
      controllers.clear();
    });
  });

  browser.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse: (r: RuntimeResponse) => void) => {
    const request = raw as RuntimeRequest;
    switch (request?.type) {
      case 'openOptions':
        void browser.runtime.openOptionsPage();
        return false;
      case 'startSync': {
        const username = normalizeUsername(String(request.username ?? ''));
        if (!isValidUsername(username)) {
          sendResponse({ ok: false, message: t(detectLocale(), 'invalidUsername') });
          return false;
        }
        void (async () => {
          if (!hasRequiredKeys(await loadSettings())) {
            sendResponse({ ok: false, message: t(detectLocale(), 'keysNotConfigured') });
            return;
          }
          void launchSync(username);
          await browser.tabs.create({ url: `https://github.com/${username}?tab=stars` });
          sendResponse({ ok: true });
        })();
        return true;
      }
      case 'testConnection':
        void Promise.all([testGithubToken(String(request.githubToken ?? '')), testJevKey(String(request.jevKey ?? ''))]).then(
          ([github, jev]) => sendResponse({ github, jev }),
        );
        return true;
      default:
        return false;
    }
  });
});
