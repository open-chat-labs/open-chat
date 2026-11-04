// The languages a community can be in, by code, with their own names and one flag each. A flag is a quick visual cue
// next to the name only: a language isn't a country, so it's never shown on its own.

export interface Language {
  code: string;
  /** The language's own name. */
  label: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

const FLAGS: Record<string, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  es: '🇪🇸',
  pt: '🇵🇹',
  tr: '🇹🇷',
  pl: '🇵🇱',
  nl: '🇳🇱',
  ru: '🇷🇺',
  uk: '🇺🇦',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  hi: '🇮🇳',
  vi: '🇻🇳',
  id: '🇮🇩',
  ar: '🇸🇦',
  th: '🇹🇭',
  fa: '🇮🇷',
  he: '🇮🇱',
};

// own names (as LANGUAGES has them) and the library's English key, for lists that carry a name instead of a code
const BY_NAME: Record<string, string> = {
  ...Object.fromEntries(LANGUAGES.map((l) => [l.label.toLowerCase(), l.code])),
  'ui.explorecommunities.english': 'en',
  'العربية': 'ar',
  'ไทย': 'th',
};

/** The white flag, for a language without one of its own. */
export const NO_FLAG = '🏳️';

/**
 * A language's flag, from its code ("pt", "pt-BR", "zh_CN"), its own name ("Português") or the library's English key;
 * the white flag when it has none.
 */
export function languageFlag(language: string): string {
  const value = language.trim().toLowerCase();
  const code = BY_NAME[value] ?? value.split(/[-_]/)[0];
  return FLAGS[code] ?? NO_FLAG;
}
