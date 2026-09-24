/** Built-in static icons (shipped with the project, not external input), parsed into SVG nodes */
export function parseIcon(svgSource: string, size: number): Element {
  const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
  const svg = document.importNode(doc.documentElement, true);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  return svg;
}
