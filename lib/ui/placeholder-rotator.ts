// Placeholder rotator: types examples after the fixed prefix, pauses, deletes, then shows the next.
// Only touches placeholder, never the input value; skips a round while the user is typing.
const TYPE_MS = 70;
const ERASE_MS = 30;
const HOLD_MS = 2200;
const GAP_MS = 400;
/** No typing with reduced motion, swaps whole sentences. */
const STATIC_SWAP_MS = 4000;

export interface PlaceholderRotator {
  /** Start or restart from scratch (called on locale change to switch immediately). */
  restart(): void;
  stop(): void;
}

export function createPlaceholderRotator(
  input: HTMLInputElement,
  getPrefix: () => string,
  getExamples: () => readonly string[],
): PlaceholderRotator {
  let timer: number | undefined;
  let index = 0;

  const schedule = (delay: number, next: () => void) => {
    timer = window.setTimeout(next, delay);
  };

  const render = (example: string) => {
    input.placeholder = getPrefix() + example;
  };

  const nextExample = (): string[] => {
    const examples = getExamples();
    const example = examples[index % examples.length] ?? '';
    index += 1;
    return Array.from(example);
  };

  const typeIn = (chars: string[], shown: number) => {
    render(chars.slice(0, shown).join(''));
    if (shown < chars.length) schedule(TYPE_MS, () => typeIn(chars, shown + 1));
    else schedule(HOLD_MS, () => erase(chars, chars.length));
  };

  const erase = (chars: string[], shown: number) => {
    // User is typing: placeholder hidden, keep current example and check later.
    if (input.value !== '') {
      schedule(HOLD_MS, () => erase(chars, shown));
      return;
    }
    render(chars.slice(0, shown).join(''));
    if (shown > 0) schedule(ERASE_MS, () => erase(chars, shown - 1));
    else schedule(GAP_MS, () => typeIn(nextExample(), 1));
  };

  const swapStatic = () => {
    render(nextExample().join(''));
    schedule(STATIC_SWAP_MS, swapStatic);
  };

  const stop = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };

  const restart = () => {
    stop();
    index = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) swapStatic();
    else typeIn(nextExample(), 1);
  };

  return { restart, stop };
}
