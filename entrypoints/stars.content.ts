import { hasRequiredKeys, REFRESH_INTERVAL_MS } from '@/lib/core/settings';
import { MIN_JEV_QUERY_LENGTH } from '@/lib/core/rank';
import { usernameFromStarsUrl } from '@/lib/core/username';
import type { BackgroundMessage, ContentMessage, ProgressState, RuntimeRequest } from '@/lib/messages';
import { loadSettings, onSettingsChanged } from '@/lib/settings';
import { attachHost, currentLogin } from '@/lib/ui/page';
import { createPanel, type Panel } from '@/lib/ui/panel';
import { resolveLocale } from '@/lib/i18n';

type Port = ReturnType<typeof browser.runtime.connect>;

const STATUS_POLL_MS = 5_000;
const RECONNECT_DELAY_MS = 1_000;

interface Session {
  username: string;
  panel: Panel;
  latestRequestId: string | null;
  /** Latest random-query request; rapid clicks only honor the last one */
  latestSuggestId: string | null;
  latestNeedsJev: boolean;
  hasQuery: boolean;
  hasKeys: boolean;
  pollTimer: number | undefined;
}

export default defineContentScript({
  matches: ['https://github.com/*'],
  main() {
    let session: Session | null = null;
    let port: Port | null = null;
    let reconcileQueued = false;

    const isContextValid = () => Boolean(browser.runtime?.id);

    // ---------- background messaging ----------

    function send(message: ContentMessage): void {
      try {
        if (!port) {
          port = browser.runtime.connect({ name: 'gstars' });
          port.onMessage.addListener((raw: unknown) => handleMessage(raw as BackgroundMessage));
          port.onDisconnect.addListener(() => {
            port = null;
            // service worker recycled or extension reloaded: reconnect later and recover progress via status
            const current = session;
            if (current) window.setTimeout(() => session === current && send({ type: 'status', username: current.username }), RECONNECT_DELAY_MS);
          });
        }
        port.postMessage(message);
      } catch {
        port = null; // context invalid after reload, next reconcile cleans up.
      }
    }

    function handleMessage(message: BackgroundMessage): void {
      const current = session;
      if (!current) return;
      switch (message.type) {
        case 'progress':
          if (message.username !== current.username) return;
          current.panel.setProgress(message);
          scheduleStatusPoll(current, message.state);
          if (message.state === 'none' && current.hasKeys) send({ type: 'sync', username: current.username });
          return;
        case 'keyword':
          // requestId mismatch: from superseded input, drop it
          if (message.requestId !== current.latestRequestId) return;
          current.panel.setError('');
          current.panel.setResults({ results: message.results, loading: current.latestNeedsJev, hasQuery: current.hasQuery });
          return;
        case 'rerank':
          if (message.requestId !== current.latestRequestId) return;
          current.panel.setResults({ results: message.results, loading: !message.done, hasQuery: current.hasQuery });
          return;
        case 'suggestion':
          if (message.requestId !== current.latestSuggestId) return;
          current.latestSuggestId = null;
          if (message.text) current.panel.setQuery(message.text);
          return;
        case 'error':
          if (message.requestId !== current.latestRequestId) return;
          current.panel.setError(message.message);
          current.panel.setResults({ results: [], loading: false, hasQuery: current.hasQuery });
      }
    }

    /**
     * Send status periodically: every 5s while syncing (refresh progress, resume after recycle);
     * every 5 min when done (triggers incremental check so open pages get new stars).
     */
    function scheduleStatusPoll(target: Session, state: ProgressState): void {
      window.clearTimeout(target.pollTimer);
      let delay: number;
      if (state === 'pending' || state === 'running') delay = STATUS_POLL_MS;
      else if (state === 'done') delay = REFRESH_INTERVAL_MS;
      else return;
      target.pollTimer = window.setTimeout(() => {
        if (session === target) send({ type: 'status', username: target.username });
      }, delay);
    }

    // ---------- search input ----------

    function cancelLatest(target: Session): void {
      if (target.latestRequestId) send({ type: 'cancel', requestId: target.latestRequestId });
      target.latestRequestId = null;
    }

    /** Enter or search click: cancel previous request (with its Jev calls), start a new search. */
    function submitSearch(target: Session, query: string): void {
      cancelLatest(target);
      target.hasQuery = true;
      const requestId = crypto.randomUUID();
      target.latestRequestId = requestId;
      target.latestNeedsJev = query.length >= MIN_JEV_QUERY_LENGTH;
      target.panel.setError('');
      send({ type: 'search', requestId, username: target.username, query });
    }

    /** Input cleared: cancel in-flight search and clear results */
    function clearSearch(target: Session): void {
      cancelLatest(target);
      target.hasQuery = false;
      target.panel.setError('');
      target.panel.setResults({ results: [], loading: false, hasQuery: false });
    }

    // ---------- page lifecycle ----------

    function mount(username: string, localeSetting?: Parameters<typeof createPanel>[2]): void {
      const panel = createPanel(username, {
        onSubmit: (query) => session && submitSearch(session, query),
        onClear: () => session && clearSearch(session),
        onOpenOptions: () => void browser.runtime.sendMessage({ type: 'openOptions' } satisfies RuntimeRequest),
        onRetrySync: () => send({ type: 'sync', username }),
        onShuffle: (locale) => {
          if (!session) return;
          const requestId = crypto.randomUUID();
          session.latestSuggestId = requestId;
          send({ type: 'suggest', requestId, username, locale });
        },
      }, localeSetting);
      const next: Session = {
        username,
        panel,
        latestRequestId: null,
        latestSuggestId: null,
        latestNeedsJev: false,
        hasQuery: false,
        hasKeys: false,
        pollTimer: undefined,
      };
      session = next;
      attachHost(panel.host);
      // Read key config before status: auto-sync for unsynced users depends on keys being ready
      void loadSettings().then((settings) => {
        if (session !== next) return;
        panel.setLocale(resolveLocale(settings.locale, navigator.language));
        next.hasKeys = hasRequiredKeys(settings);
        panel.setNeedsKeys(!next.hasKeys);
        send({ type: 'status', username });
      });
    }

    function unmount(): void {
      const current = session;
      if (!current) return;
      cancelLatest(current);
      window.clearTimeout(current.pollTimer);
      current.panel.destroy();
      current.panel.host.remove();
      session = null;
    }

    function reconcile(): void {
      reconcileQueued = false;
      if (!isContextValid()) {
        dispose();
        return;
      }
      const username = usernameFromStarsUrl(new URL(location.href), currentLogin());
      if (!username) {
        unmount();
        return;
      }
      if (session && session.username !== username) unmount();
      if (session) {
        attachHost(session.panel.host); // Turbo navigation may detach the panel, reattach idempotently.
      } else {
        mount(username);
      }
    }

    function queueReconcile(): void {
      if (reconcileQueued) return;
      reconcileQueued = true;
      requestAnimationFrame(reconcile);
    }

    const observer = new MutationObserver(queueReconcile);

    function dispose(): void {
      observer.disconnect();
      document.removeEventListener('turbo:load', queueReconcile);
      document.removeEventListener('turbo:render', queueReconcile);
      window.removeEventListener('popstate', queueReconcile);
      unmount();
    }

    document.addEventListener('turbo:load', queueReconcile);
    document.addEventListener('turbo:render', queueReconcile);
    window.addEventListener('popstate', queueReconcile);
    // Fallback: reconcile on any DOM change (reconcile is idempotent and cheap)
    observer.observe(document.body, { childList: true, subtree: true });

    onSettingsChanged((settings) => {
      if (!session) return;
      // Language changed in settings: open panels switch immediately
      session.panel.setLocale(resolveLocale(settings.locale, navigator.language));
      session.hasKeys = hasRequiredKeys(settings);
      session.panel.setNeedsKeys(!session.hasKeys);
      send({ type: 'status', username: session.username });
    });

    reconcile();
  },
});
