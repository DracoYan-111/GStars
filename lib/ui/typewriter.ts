// Typewriter effect: fills a sentence into the input char by char. Touches value only, fires no input event.
/** Interval per character. */
const CHAR_INTERVAL_MS = 14;
/** Compresses the interval for long sentences; the whole sentence takes at most this long. */
const MAX_DURATION_MS = 500;

export interface Typewriter {
  type(text: string): void;
  /** Completes the sentence immediately while typing; no-op when idle. */
  finish(): void;
}

export function createTypewriter(input: HTMLInputElement): Typewriter {
  let timer: number | undefined;
  let pending = '';

  const setValue = (value: string) => {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
  };

  const finish = () => {
    if (timer === undefined) return;
    window.clearInterval(timer);
    timer = undefined;
    setValue(pending);
  };

  const type = (text: string) => {
    finish();
    // Splits by code point so emoji are never torn in half.
    const chars = Array.from(text);
    pending = text;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || chars.length === 0) {
      setValue(text);
      return;
    }
    const interval = Math.min(CHAR_INTERVAL_MS, MAX_DURATION_MS / chars.length);
    let shown = 0;
    setValue('');
    timer = window.setInterval(() => {
      shown += 1;
      setValue(chars.slice(0, shown).join(''));
      if (shown >= chars.length) {
        window.clearInterval(timer);
        timer = undefined;
      }
    }, interval);
  };

  return { type, finish };
}
