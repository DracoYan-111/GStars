// Pure functions, no browser APIs.
// One GraphQL query batch-fetches root READMEs for many repos instead of per-repo REST.
// REST has a 900/min secondary limit (1500 repos take 100s+); each GraphQL query costs 1 point.

/** Tried in order; repos with none fall back to REST /readme (which also checks docs/, .github/, etc.). */
export const README_FILENAMES = [
  'README.md',
  'readme.md',
  'Readme.md',
  'README.markdown',
  'README.rst',
  'README.txt',
  'README',
] as const;

export interface Readme {
  /** Git blob sha, same as REST /readme sha; comparable with stored readmeSha directly. */
  sha: string;
  text: string;
}

export interface GraphQLRequest {
  query: string;
  variables: Record<string, string>;
}

function splitFullName(fullName: string): [string, string] {
  const slash = fullName.indexOf('/');
  return slash < 0 ? [fullName, ''] : [fullName.slice(0, slash), fullName.slice(slash + 1)];
}

/** Repo names go via variables, never inlined into query text, to avoid injection. */
export function buildReadmeQuery(fullNames: readonly string[]): GraphQLRequest {
  const variables: Record<string, string> = {};
  const params: string[] = [];
  const fields: string[] = [];
  const files = README_FILENAMES.map((name, j) => `f${j}: object(expression: ${JSON.stringify(`HEAD:${name}`)}) { ...B }`);
  fullNames.forEach((fullName, i) => {
    const [owner, name] = splitFullName(fullName);
    variables[`o${i}`] = owner;
    variables[`n${i}`] = name;
    params.push(`$o${i}: String!, $n${i}: String!`);
    fields.push(`r${i}: repository(owner: $o${i}, name: $n${i}) { ${files.join(' ')} }`);
  });
  const query = `query(${params.join(', ')}) { ${fields.join(' ')} } fragment B on Blob { oid isBinary text }`;
  return { query, variables };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function toReadme(value: unknown): Readme | null {
  const blob = asRecord(value);
  if (!blob || blob.isBinary === true) return null;
  if (typeof blob.oid !== 'string' || typeof blob.text !== 'string') return null;
  return { sha: blob.oid, text: blob.text };
}

/**
 * Parses the response: returns repos with a README found. Missing repos fall back to the caller.
 * Per-repo errors still return other data; only a wholly missing data is a failure.
 */
export function parseReadmeResponse(fullNames: readonly string[], body: unknown): Map<string, Readme> {
  const data = asRecord(asRecord(body)?.data);
  if (!data) throw new Error('GraphQL response is missing data');
  const found = new Map<string, Readme>();
  fullNames.forEach((fullName, i) => {
    const repo = asRecord(data[`r${i}`]);
    if (!repo) return;
    for (let j = 0; j < README_FILENAMES.length; j++) {
      const readme = toReadme(repo[`f${j}`]);
      if (readme) {
        found.set(fullName, readme);
        return;
      }
    }
  });
  return found;
}

/** Decodes wrapped base64 REST content into UTF-8 text. */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
