// Pure functions, no browser APIs.
// Latin letters and digits are split into lowercase words; runs of CJK characters become bigrams.
// Queries and documents must use the same tokenizer.

const CJK = /[\u4e00-\u9fff]/; // CJK Unified Ideographs
const LATIN = /[a-zA-Z0-9]/;

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let latinBuf = '';
  let cjkBuf = '';

  const flushLatin = () => {
    if (latinBuf) tokens.push(latinBuf.toLowerCase());
    latinBuf = '';
  };
  const flushCjk = () => {
    if (cjkBuf.length === 1) {
      tokens.push(cjkBuf);
    } else {
      for (let i = 0; i < cjkBuf.length - 1; i++) tokens.push(cjkBuf.slice(i, i + 2));
    }
    cjkBuf = '';
  };

  for (const ch of text) {
    if (CJK.test(ch)) {
      flushLatin();
      cjkBuf += ch;
    } else if (LATIN.test(ch)) {
      flushCjk();
      latinBuf += ch;
    } else {
      flushLatin();
      flushCjk();
    }
  }
  flushLatin();
  flushCjk();

  return tokens;
}
