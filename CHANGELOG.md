# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

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
