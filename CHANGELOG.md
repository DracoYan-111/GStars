# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-06

### Added

- Every setting on the options page now has a plain-language hint (English and Chinese) explaining what it controls and its default.

### Changed

- Default `MIN_SCORE` raised from 1.5 to 2: only results that at least partially meet the need are shown. On 30 evaluation queries this halved the unrelated results per query (1.7 → 0.8) with MRR and recall@10 unchanged. Existing installs keep their saved value; set it to 2 on the options page to adopt the new default.

### Fixed

- The 👍 badge now waits for the final ranking instead of landing on a provisional leader and jumping to another repo as Jev scores arrive. While scoring runs, the input shows "Finding the best match…" and the query is restored when the final ranking arrives.
- The "Auto" language option on the options page is now localized.

## [0.1.0] - 2026-09-24

First public release.

### Added

- Natural-language search panel on GitHub Stars pages (`?tab=stars` and `/stars/{user}`), with Turbo navigation support.
- Keyword recall with MiniSearch (CJK bigram tokenizer), then relevance reranking with TypeSafe Jev. Scores are cached per query.
- Resumable star sync using batched GraphQL README fetches, plus a silent incremental check every 5 minutes.
- Sync progress drawn around the search box; search is enabled once sync finishes.
- Random example query button, typewriter-style placeholder examples, and a 👍 badge on the top match.
- English and Simplified Chinese UI, following the language chosen on the options page.
- Chrome (MV3) and Firefox builds.
