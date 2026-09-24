// Pure functions, no browser APIs.
// Random query: pick a topic and language from the user's own starred repos and fill a template.
// Templates only, no generative model; seeds come from the user's repos so results always exist.
import type { Locale } from '../i18n';

export interface SuggestSeed {
  topics: string[];
  language: string | null;
}

/** Returns a [0, 1) random number; injectable sequence for tests */
export type Random = () => number;

type Template = (topic: string, other: string, language: string) => string;

const TEMPLATES: Record<Locale, { withLanguage: Template[]; twoTopics: Template[]; oneTopic: Template[] }> = {
  'zh-CN': {
    withLanguage: [
      (topic, _o, lang) => `有没有用 ${lang} 写的 ${topic} 工具`,
      (topic, _o, lang) => `找一个 ${lang} 实现的 ${topic} 项目`,
      (topic, _o, lang) => `${topic} 相关的库，最好是 ${lang}`,
    ],
    twoTopics: [
      (topic, other) => `把 ${topic} 和 ${other} 结合起来的项目`,
      (topic, other) => `同时涉及 ${topic} 与 ${other} 的仓库`,
    ],
    oneTopic: [
      (topic) => `我收藏过哪些 ${topic} 相关的项目`,
      (topic) => `推荐几个做 ${topic} 的仓库`,
      (topic) => `想找一个好用的 ${topic} 方案`,
    ],
  },
  en: {
    withLanguage: [
      (topic, _o, lang) => `a ${topic} tool written in ${lang}`,
      (topic, _o, lang) => `${lang} library for ${topic}`,
      (topic, _o, lang) => `looking for a ${topic} project in ${lang}`,
    ],
    twoTopics: [
      (topic, other) => `projects that combine ${topic} and ${other}`,
      (topic, other) => `something for ${topic} with ${other}`,
    ],
    oneTopic: [
      (topic) => `which ${topic} projects did I star`,
      (topic) => `a good ${topic} solution`,
      (topic) => `repos about ${topic}`,
    ],
  },
};

function pick<T>(items: readonly T[], random: Random): T | undefined {
  return items[Math.floor(random() * items.length)];
}

/** Topic slugs (e.g. `machine-learning`) read more natural with spaces. */
function humanizeTopic(topic: string): string {
  return topic.replace(/-/g, ' ');
}

/**
 * Builds one query from seed repos; null when no topic is available.
 * Prefers seeds with topics: language template when a language exists, two-topic template when a second topic exists.
 */
export function suggestQuery(seeds: readonly SuggestSeed[], locale: Locale, random: Random = Math.random): string | null {
  const seed = pick(
    seeds.filter((s) => s.topics.length > 0),
    random,
  );
  if (!seed) return null;

  const topic = pick(seed.topics, random) as string;
  const others = seed.topics.filter((t) => t !== topic);
  const templates = TEMPLATES[locale];
  const choices: [Template[], string][] = [[templates.oneTopic, '']];
  if (seed.language) choices.push([templates.withLanguage, '']);
  if (others.length > 0) choices.push([templates.twoTopics, pick(others, random) as string]);

  const [group, other] = pick(choices, random) as [Template[], string];
  const template = pick(group, random) as Template;
  return template(humanizeTopic(topic), humanizeTopic(other), seed.language ?? '');
}
