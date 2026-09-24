// Common language colors from GitHub linguist (languages.yml). The star list API returns no colors, so they are built in;
// Languages missing from the table get a gray dot.
// ponytail: only common languages are included; add more as needed.
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  'Objective-C': '#438eff',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#663399',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Dart: '#00B4AB',
  Lua: '#000080',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  Clojure: '#db5855',
  Elm: '#60B5CC',
  Zig: '#ec915c',
  Nix: '#7e7eff',
  Solidity: '#AA6746',
  'Jupyter Notebook': '#DA5B0B',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  'Vim Script': '#199f4b',
  TeX: '#3D6117',
  MDX: '#fcb32c',
  Astro: '#ff5a03',
  PowerShell: '#012456',
  R: '#198CE7',
  Perl: '#0298c3',
  OCaml: '#ef7a08',
  Erlang: '#B83998',
};

const FALLBACK_COLOR = '#8b949e';

export function languageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? FALLBACK_COLOR;
}
