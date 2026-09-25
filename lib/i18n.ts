// Bilingual UI strings: Chinese (zh-CN) and English (en).
// Pure module: never touches browser APIs; callers pass the locale from detectLocale().
export type Locale = 'zh-CN' | 'en';
export type LocaleSetting = Locale | 'auto';

const STRINGS = {
  // panel
  needsKeysPrefix: { 'zh-CN': '尚未配置 GitHub token 和 Jev key，', en: 'GitHub token and Jev key are not configured. ' },
  openOptions: { 'zh-CN': '前往设置', en: 'Open settings' },
  searchPlaceholderPrefix: { 'zh-CN': '用自然语言搜索 {username} 的 stars，例如：', en: 'Search {username}’s stars in natural language, e.g. ' },
  searchAriaLabel: { 'zh-CN': '搜索 {username} 的 star 仓库', en: 'Search {username}’s starred repos' },
  searchButton: { 'zh-CN': '搜索', en: 'Search' },
  shuffleButton: { 'zh-CN': '随机来一句', en: 'Random query' },
  syncingPlaceholder: { 'zh-CN': '正在同步 {username} 的 star 仓库，完成后即可搜索…', en: 'Syncing {username}’s stars, you can search when it finishes…' },
  syncFailed: { 'zh-CN': '同步失败：{message}', en: 'Sync failed: {message}' },
  unknownError: { 'zh-CN': '未知错误', en: 'Unknown error' },
  retry: { 'zh-CN': '重试', en: 'Retry' },
  scoring: { 'zh-CN': '正在用 Jev 打分排序…', en: 'Scoring with Jev…' },
  matchingPlaceholder: { 'zh-CN': '正在匹配最优结果…', en: 'Finding the best match…' },
  noResults: { 'zh-CN': '没有找到相关仓库', en: 'No matching repos found' },
  updatedAt: { 'zh-CN': '更新于 {time}', en: 'Updated {time}' },
  justNow: { 'zh-CN': '刚刚', en: 'just now' },
  relevance: { 'zh-CN': '相关度 {score}', en: 'Relevance {score}' },
  topMatch: { 'zh-CN': '最匹配', en: 'Best match' },
  // sync-indicator
  preparing: { 'zh-CN': '准备中…', en: 'Preparing…' },
  syncedTotal: { 'zh-CN': '已同步 {total} 个仓库', en: '{total} repos synced' },
  syncingTitle: { 'zh-CN': '正在同步 star 仓库', en: 'Syncing starred repos' },
  syncIncomplete: { 'zh-CN': '同步未完成', en: 'Sync incomplete' },
  syncDone: { 'zh-CN': '同步完成', en: 'Sync complete' },
  // popup
  usernamePlaceholder: { 'zh-CN': 'GitHub 用户名', en: 'GitHub username' },
  confirm: { 'zh-CN': '确认', en: 'Confirm' },
  keysMissing: { 'zh-CN': '尚未配置 key，', en: 'Keys are not configured. ' },
  invalidUsername: { 'zh-CN': '用户名格式不正确', en: 'Invalid username format' },
  bgNoResponse: { 'zh-CN': 'background 没有响应，请重新加载扩展', en: 'Background did not respond, please reload the extension' },
  keysNotConfigured: { 'zh-CN': '尚未配置 key', en: 'Keys are not configured' },
  // options
  optionsTitle: { 'zh-CN': 'GStars 设置', en: 'GStars Settings' },
  keysLegend: { 'zh-CN': '密钥（只保存在本机浏览器中）', en: 'Keys (stored only in this browser)' },
  githubTokenHint: { 'zh-CN': '无需勾选任何权限，仅用于提高 API 限流额度。', en: 'No permissions needed; only raises the API rate limit.' },
  paramsLegend: { 'zh-CN': '参数', en: 'Parameters' },
  // Plain-language hints on the options page. {default} is filled from DEFAULT_SETTINGS.
  fullScanHint: {
    'zh-CN': '每次搜索让 Jev 看多少个仓库。star 数不超过这个值时，每个仓库都会打分，结果最全，但仓库越多每次新搜索越贵（1500 个约 6 美分）；超过时只给关键词最匹配的 200 个打分，便宜很多，但关键词没搜到的仓库不会出现。默认 {default}。',
    en: 'How many repos Jev looks at per search. Up to this many stars, every repo is scored: the most complete results, but each new search costs more the more repos there are (about 6 cents for 1,500). Above it, only the 200 best keyword matches are scored: much cheaper, but repos the keywords miss never show up. Default {default}.',
  },
  minScoreHint: {
    'zh-CN': '只显示分数不低于它的结果。0 = 无关，1 = 同领域但不满足，2 = 部分满足，3 = 完全满足。调高结果更少、更准；调低会多出一些沾边的结果。默认 {default}。',
    en: 'Only results scoring at least this are shown. 0 = unrelated, 1 = same field but does not fit, 2 = partly fits, 3 = fits exactly. Higher means fewer, more precise results; lower adds loosely related ones. Default {default}.',
  },
  syncConcurrencyHint: {
    'zh-CN': '同步 star 时同时抓取几批 README（每批 10 个仓库）。越大同步越快；如果同步时提示 GitHub 限流，就调小一些。一般不用改。默认 {default}。',
    en: 'How many batches of READMEs (10 repos each) are fetched at once while syncing stars. Higher syncs faster; lower it if sync reports a GitHub rate limit. Usually no need to change. Default {default}.',
  },
  jevConcurrencyHint: {
    'zh-CN': '搜索时同时给多少个仓库打分。越大结果出来越快，但不影响费用，费用只和打分的仓库数有关。如果提示 Jev 限流，就调小一些。默认 {default}。',
    en: 'How many repos are scored at the same time during a search. Higher shows results faster but does not change the cost, which depends only on how many repos are scored. Lower it if Jev reports a rate limit. Default {default}.',
  },
  languageHint: {
    'zh-CN': '插件界面显示的语言。选“自动”时跟随浏览器语言。不影响搜索：中文、英文或混着写的查询都能搜。',
    en: 'The language of the extension interface. "Auto" follows your browser. It does not affect search: Chinese, English and mixed queries all work.',
  },
  fullScanLabel: { 'zh-CN': '全量打分上限 FULL_SCAN_LIMIT', en: 'Full-scan limit FULL_SCAN_LIMIT' },
  minScoreLabel: { 'zh-CN': '最低相关度 MIN_SCORE（0–3）', en: 'Minimum relevance MIN_SCORE (0–3)' },
  syncConcurrencyLabel: { 'zh-CN': '同步并发数', en: 'Sync concurrency' },
  jevConcurrencyLabel: { 'zh-CN': 'Jev 打分并发数', en: 'Jev scoring concurrency' },
  save: { 'zh-CN': '保存', en: 'Save' },
  testConnection: { 'zh-CN': '测试连接', en: 'Test connection' },
  saved: { 'zh-CN': '已保存', en: 'Saved' },
  saveFailed: { 'zh-CN': '保存失败：{message}', en: 'Save failed: {message}' },
  testingGithub: { 'zh-CN': 'GitHub：测试中…', en: 'GitHub: testing…' },
  testingJev: { 'zh-CN': 'Jev：测试中…', en: 'Jev: testing…' },
  testFailed: { 'zh-CN': '测试失败（{message}）', en: 'Test failed ({message})' },
  languageLabel: { 'zh-CN': '语言 Language', en: 'Language' },
  localeAuto: { 'zh-CN': '自动', en: 'Auto' },
  applyForKey: { 'zh-CN': '去申请', en: 'Get one' },
  // backend errors (github / jev / search)
  githubTokenInvalid: { 'zh-CN': 'GitHub token 无效或已过期', en: 'GitHub token is invalid or expired' },
  githubRateLimited: { 'zh-CN': 'GitHub 限流，约 {minutes} 分钟后恢复，请稍后重试', en: 'GitHub rate limited, retry in about {minutes} min' },
  githubStarsFailed: { 'zh-CN': '获取 star 列表失败（HTTP {status}）', en: 'Failed to fetch star list (HTTP {status})' },
  githubUserNotFound: { 'zh-CN': 'GitHub 用户 {username} 不存在', en: 'GitHub user {username} not found' },
  githubStarsBadFormat: { 'zh-CN': 'star 列表响应格式异常', en: 'Unexpected star list response format' },
  githubBatchReadmeFailed: { 'zh-CN': '批量获取 README 失败（HTTP {status}）', en: 'Failed to batch-fetch READMEs (HTTP {status})' },
  githubReadmeFailed: { 'zh-CN': '获取 {fullName} 的 README 失败（HTTP {status}）', en: 'Failed to fetch {fullName}’s README (HTTP {status})' },
  githubNoToken: { 'zh-CN': '未填写 GitHub token', en: 'GitHub token is empty' },
  githubRateOk: { 'zh-CN': '可用，剩余额度 {remaining}/{limit}', en: 'OK, remaining quota {remaining}/{limit}' },
  githubHttp: { 'zh-CN': 'GitHub 返回 HTTP {status}', en: 'GitHub returned HTTP {status}' },
  jevAuth: { 'zh-CN': 'Jev key 无效或缺失（HTTP 401）', en: 'Jev key is invalid or missing (HTTP 401)' },
  jevRequestFailed: { 'zh-CN': 'Jev 请求失败（HTTP {status}）{detail}', en: 'Jev request failed (HTTP {status}) {detail}' },
  jevNoKey: { 'zh-CN': '未填写 Jev key', en: 'Jev key is empty' },
  jevSampleOk: { 'zh-CN': '可用（示例打分 {score}/3）', en: 'OK (sample score {score}/3)' },
  jevKeyInvalidCheck: { 'zh-CN': 'Jev key 无效或缺失，请在设置页检查', en: 'Jev key is invalid or missing, please check settings' },
  jevAllFailed: { 'zh-CN': 'Jev 打分全部失败：{message}', en: 'All Jev scorings failed: {message}' },
  keywordOnlyNoKey: { 'zh-CN': '未配置 Jev key，当前只显示关键词匹配结果', en: 'Jev key is not configured, showing keyword matches only' },
} as const;

export type StringKey = keyof typeof STRINGS;

/** Example queries rotated in the search box placeholder. */
export const PLACEHOLDER_EXAMPLES: Record<Locale, readonly string[]> = {
  'zh-CN': [
    'claude code 节约token skills',
    '用 Rust 写的命令行工具',
    '本地运行大模型的推理框架',
    '把网页转成 markdown 的工具',
    'React 表单校验库',
    '中文分词和全文检索',
  ],
  en: [
    'claude code skills to save tokens',
    'a CLI tool written in Rust',
    'run LLMs locally',
    'convert web pages to markdown',
    'React form validation library',
    'full-text search engine',
  ],
};

export function resolveLocale(setting: LocaleSetting | undefined, browserLang: string | undefined): Locale {
  if (setting === 'zh-CN' || setting === 'en') return setting;
  const lang = (browserLang ?? '').toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  return 'en';
}

let preferredLocale: Locale | null = null;

/**
 * Records the language chosen in settings ('auto' passes null). Used for background-generated notices
 * (sync failure, invalid Jev key, etc.) that have no UI to ask, so they follow the user setting.
 */
export function setPreferredLocale(locale: Locale | null): void {
  preferredLocale = locale;
}

/** Current locale: user choice first; otherwise detect browser language (chrome.i18n, then navigator.language). */
export function detectLocale(): Locale {
  if (preferredLocale) return preferredLocale;
  try {
    const ui = (globalThis as unknown as { chrome?: { i18n?: { getUILanguage?: () => string } } }).chrome?.i18n?.getUILanguage?.();
    if (ui) return resolveLocale('auto', ui);
    const nav = (globalThis as unknown as { navigator?: { language?: string } }).navigator?.language;
    return resolveLocale('auto', nav);
  } catch {
    return 'en';
  }
}

export function t(locale: Locale, key: StringKey, vars: Record<string, string | number> = {}): string {
  let s: string = STRINGS[key][locale] ?? STRINGS[key].en;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
