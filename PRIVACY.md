# Privacy Policy

_Last updated: 2026-09-24_

GStars is a browser extension that searches a GitHub user's starred repositories. It has **no backend server** and **does not collect analytics or telemetry**. The developer never receives your data.

## Data stored on your device

All of the following stays in your browser's local extension storage and IndexedDB:

- The GitHub token and Jev key you enter on the options page
- Your settings (language, score threshold, concurrency)
- Starred-repository metadata and cleaned README text for the users you sync
- The local search index and cached relevance scores

Uninstalling the extension deletes all of this data.

## Data sent to third parties

GStars only talks to the two services it needs, and only when you use it:

| Service | What is sent | Why |
| --- | --- | --- |
| **GitHub API** (`api.github.com`) | Your GitHub token; the username whose stars you are viewing | To download that user's starred repositories and their READMEs |
| **TypeSafe Jev** (`api.typesafe.ai`) | Your Jev key; your search query; the name, description, topics and a README excerpt (up to about 400 tokens) of each candidate repository | To score how relevant each repository is to your query |

Repository information sent to TypeSafe is public GitHub data. How TypeSafe handles requests is governed by [TypeSafe's own terms and privacy policy](https://typesafe.ai).

## Access to github.com pages

The content script runs on `github.com` so that it can add the search panel to Stars pages. It only reads the page URL and the signed-in username (from GitHub's `user-login` meta tag) to work out which user's stars you are viewing. It does not read or change any other page content.

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage`, `unlimitedStorage` | Store settings, synced repositories, the search index and the score cache locally |
| `https://api.github.com/*` | Fetch starred repositories and READMEs |
| `https://github.com/*` | Show the search panel on Stars pages |
| `https://api.typesafe.ai/*` | Relevance scoring with Jev |

## Contact

Questions or concerns: open an issue at <https://github.com/DracoYan-111/GStars/issues>.
