// Minimal YAML subset used by queries.yaml only:
//   - query: xxx
//     username: xxx
//     expected: [owner/repo, owner/repo]
// No yaml dependency; unknown lines throw with line numbers to avoid silent misparsing.

export interface EvalQuery {
  query: string;
  username: string;
  expected: string[];
}

function unquote(value: string): string {
  const v = value.trim();
  const quoted = v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")));
  return quoted ? v.slice(1, -1) : v;
}

function parseList(value: string, lineNo: number): string[] {
  const v = value.trim();
  if (!v.startsWith('[') || !v.endsWith(']')) throw new Error(`Line ${lineNo} : expected must look like [a/b, c/d]`);
  return v
    .slice(1, -1)
    .split(',')
    .map(unquote)
    .filter((s) => s !== '');
}

export function parseQueries(text: string): EvalQuery[] {
  const items: Partial<EvalQuery>[] = [];
  text.split('\n').forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('#')) return;

    const isItemStart = line.startsWith('- ');
    if (isItemStart) items.push({});
    const current = items[items.length - 1];
    const body = isItemStart ? line.slice(2) : line.trim();
    const match = body.match(/^(query|username|expected):\s*(.*)$/);
    if (!current || !match) throw new Error(`Line ${lineNo}: failed to parse: ${raw}`);

    const [, key, value = ''] = match;
    if (key === 'expected') current.expected = parseList(value, lineNo);
    else if (key === 'query' || key === 'username') current[key] = unquote(value);
  });

  return items.map((item, i) => {
    if (!item.query || !item.username || !item.expected?.length) {
      throw new Error(`Line ${i + 1}th query is missing query / username / expected`);
    }
    return { query: item.query, username: item.username, expected: item.expected };
  });
}
