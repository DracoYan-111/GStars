// Pure functions, no browser APIs.

const DEFAULT_MAX_LENGTH = 6000;

/** Whether a line is only markdown links plus table/whitespace tokens (no real text) */
function isPureLinkLine(line: string): boolean {
  if (!/\[[^\]]*]\([^)]*\)/.test(line)) return false;
  const stripped = line.replace(/\[[^\]]*]\([^)]*\)/g, '').replace(/[|\s:-]/g, '');
  return stripped === '';
}

/** Table delimiter row, e.g. `| --- | --- |` */
function isTableSeparatorLine(line: string): boolean {
  return /^[\s|:-]+$/.test(line) && line.includes('-');
}

export function cleanReadme(markdown: string, maxLength = DEFAULT_MAX_LENGTH): string {
  let text = markdown;

  // Code blocks / inline code
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/~~~[\s\S]*?~~~/g, '');
  text = text.replace(/`[^`\n]*`/g, '');

  // Images (incl. badges)
  text = text.replace(/!\[[^\]]*]\([^)]*\)/g, '');

  // HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Pure-link rows / delimiter rows in tables
  text = text
    .split('\n')
    .filter((line) => !isPureLinkLine(line) && !isTableSeparatorLine(line))
    .join('\n');

  // Remaining links become plain text
  text = text.replace(/\[([^\]]*)]\([^)]*\)/g, '$1');

  // Collapse consecutive blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text.slice(0, maxLength);
}
