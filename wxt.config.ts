import { defineConfig } from 'wxt';

const REPOSITORY_URL = 'https://github.com/DracoYan-111/GStars';

export default defineConfig({
  zip: {
    // The Firefox sources zip (submitted to AMO review) ignores .gitignore, so local-only files are excluded here
    excludeSources: ['CLAUDE.md', '.claude/**', 'evals/.cache/**'],
  },
  manifest: ({ browser }) => ({
    // Name/description via _locales (public/_locales/*/messages.json), shown per store locale
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: REPOSITORY_URL,
    // tabs.create needs no tabs permission; skipping it avoids the read-browsing-history install warning
    permissions: ['storage', 'unlimitedStorage'],
    host_permissions: [
      'https://api.github.com/*',
      'https://github.com/*',
      'https://api.typesafe.ai/*', // Jev API, see https://docs.typesafe.ai/api.md
    ],
    ...(browser === 'firefox' && {
      // AMO requires a fixed extension ID; it cannot change after release
      browser_specific_settings: {
        gecko: {
          id: 'gstars@dracoyan-111.github.io',
          strict_min_version: '128.0',
          // User queries are sent to third-party Jev (TypeSafe) for scoring (searchTerms); everything else talks to GitHub only
          data_collection_permissions: { required: ['searchTerms'] },
        },
      },
    }),
  }),
});
