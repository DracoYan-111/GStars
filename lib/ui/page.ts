// GitHub page-structure DOM helpers. Never relies on GitHub class names:
// Prefers stable data-*/aria-* selectors, falls back to the top of main.
// Inserts exactly one panel; never hides or alters native content.

/** Stars page "Search stars" filter box (stable-attribute selector) */
const FILTER_INPUT_SELECTOR = 'input[data-test-selector="stars-repo-filter"], input[aria-label="Search stars"]';
const MAIN_SELECTORS = ['main', '[role="main"]'];

function findMain(): HTMLElement | null {
  for (const selector of MAIN_SELECTORS) {
    const found = document.querySelector<HTMLElement>(selector);
    if (found) return found;
  }
  return null;
}

/** Logged-in username, completes addresses without one like https://github.com/stars */
export function currentLogin(): string | null {
  return document.querySelector('meta[name="user-login"]')?.getAttribute('content') || null;
}

/**
 * Panel host: the outermost turbo-frame wrapping the whole tab content (Lists + Stars); the panel is its first child,
 * so it always sits atop the page content (above Lists when present).
 * The inner user-starred-repos frame fully reloads on native filter/pagination, so the panel must not live inside;
 * the outer frame only reloads on tab switches, when we leave anyway.
 * Falls back to the filter form when no turbo-frame is found; the panel goes before it.
 */
function findContainer(): Element | null {
  const filter = document.querySelector(FILTER_INPUT_SELECTOR);
  if (!filter) return null;
  let frame = filter.closest('turbo-frame');
  for (let outer = frame?.parentElement?.closest('turbo-frame'); outer; outer = frame?.parentElement?.closest('turbo-frame')) {
    frame = outer;
  }
  return frame ?? filter.closest('form');
}

/** Places the panel atop the page content; parks it at the top of main until the native block renders, then moves it over. */
export function attachHost(host: HTMLElement): boolean {
  const container = findContainer();
  if (container?.tagName === 'TURBO-FRAME') {
    if (container.firstElementChild !== host) container.prepend(host);
    return true;
  }
  if (container) {
    if (host.nextElementSibling !== container) container.before(host);
    return true;
  }
  const main = findMain();
  if (!main) return false;
  if (host.parentElement !== main) main.prepend(host);
  return true;
}
