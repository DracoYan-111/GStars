<p align="center">
  <img src="assets/icon.png" width="96" alt="GStars logo">
</p>

<h1 align="center">GStars</h1>

<p align="center">
  Search any GitHub user's starred repositories in natural language.
  <br>
  English | <a href="README.zh-CN.md">简体中文</a>
</p>

---

GStars adds a search box to the top of any GitHub user's **Stars** page. Type what you are looking for — in English, Chinese, or a mix, such as `claude code skills to save tokens` — and it finds the matching repositories among everything that user has starred.

- **Natural-language search.** Results come from a local keyword index first, then are re-ranked by relevance with TypeSafe's [Jev](https://docs.typesafe.ai) decision model.
- **Works on any user.** Open `github.com/{user}?tab=stars` or `github.com/stars/{user}`.
- **Local first.** Stars, READMEs and the search index are stored in your browser (IndexedDB). There is no backend server.
- **Fast sync.** READMEs are fetched through batched GraphQL queries; about 1,500 starred repos sync in roughly 35 seconds. After that, a quiet incremental check runs every 5 minutes.
- **No generative AI.** GStars does not translate, summarize or generate text. Jev is only used to score relevance.

## Install

- **Chrome Web Store**: coming soon
- **Firefox Add-ons**: coming soon
- **From source**: see [Development](#development), then load `.output/chrome-mv3` as an unpacked extension in `chrome://extensions` (enable Developer mode).

## Setup

GStars needs two keys, entered on its options page. They are stored only in your browser.

| Key | Where to get it | Notes |
| --- | --- | --- |
| GitHub token | [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) | No scopes needed. It only raises the API rate limit. |
| Jev key | [console.typesafe.ai/keys](https://console.typesafe.ai/keys) | Used for relevance scoring. Billed by TypeSafe per request. |

Click **Test connection** on the options page to check both keys.

## Usage

1. Click the toolbar icon, enter a GitHub username and confirm. GStars starts syncing and opens that user's Stars page. You can also open any Stars page directly.
2. Sync progress is drawn around the search box. Search is enabled once sync finishes.
3. Type a query and press <kbd>Enter</kbd>. Keyword matches appear immediately and are replaced by the relevance-ranked list as scores arrive. The top match gets a 👍 badge.
4. Use <kbd>↑</kbd> / <kbd>↓</kbd> to select a result and <kbd>Enter</kbd> to open it. The 🔀 button fills in a random example query built from that user's own topics.

The options page also lets you change the UI language, the minimum relevance score, and concurrency limits.

## How it works

```text
github.com Stars page ──(port messages)──▶ background service worker
  content script: panel UI                   ├─ sync: GitHub REST + GraphQL → IndexedDB
                                             ├─ keyword recall: MiniSearch (CJK bigrams)
                                             └─ rerank: Jev scores (cached per query)
```

- All network requests are made by the background worker. The content script never calls an external API.
- If the user has at most `FULL_SCAN_LIMIT` (default 1,500) repos, every repo is scored; otherwise only the top 200 keyword matches are.
- Scores are cached per query, README version and question version, so repeating a query costs nothing.
- Numeric signals (stars, dates) are handled in code and are never sent to Jev.

## Privacy

GStars has no server and collects no analytics. Your query and the public metadata of candidate repos are sent to TypeSafe for scoring. See [PRIVACY.md](PRIVACY.md) for details.

## Development

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev              # Chrome, with hot reload
pnpm dev:firefox
pnpm test             # unit tests (Vitest)
pnpm compile          # type check
pnpm build            # → .output/chrome-mv3
pnpm build:firefox    # → .output/firefox-mv2
pnpm zip && pnpm zip:firefox   # store packages
```

### Project structure

```text
entrypoints/
  background.ts        network requests, sync and search orchestration
  stars.content.ts     injects the panel into Stars pages (Turbo-aware)
  popup/  options/     toolbar popup and options page
lib/
  core/                pure functions (no browser APIs): tokenizer, README cleaner,
                       ranking, Jev question template, settings validation, …
  ui/                  panel (Shadow DOM), sync indicator, animations, styles
  github.ts jev.ts     API clients
  sync.ts search.ts    resumable sync; recall → score → rank
  db.ts index.ts       Dexie schema; MiniSearch index persistence
assets/                source images (icon, SVG icons inlined at build time)
public/                files copied as-is: toolbar icons, _locales
tests/                 Vitest unit tests for lib/core
evals/                 offline relevance evaluation (recall@10, MRR)
```

### Relevance evaluation

`evals/queries.yaml` holds hand-labelled queries. The evaluation runs in Node and reuses `lib/core`:

```bash
GITHUB_TOKEN=... JEV_API_KEY=... pnpm eval
```

Re-run it whenever you change the Jev question wording (and bump `QUESTION_VERSION`), `MIN_SCORE`, or the README budget.

## License

[MIT](LICENSE) © DracoYan-111
