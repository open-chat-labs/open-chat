// i18n for the library. Components never format text themselves: every piece of UI copy is a resource key (a plain
// string such as 'ui.common.cancel') looked up through the translator the host app provides with setI18n().
// The library knows nothing about how the host translates (svelte-i18n, edit modes, levels …).
//
// Without a host translator the bundled English (en.json) is used. A string that isn't a known key renders as
// itself, so props can also take literal text (e.g. user data, or quick prototypes).
import { getContext, setContext } from 'svelte';
import en from './en.json';

export type I18nParams = Record<string, string | number | boolean | Date | null | undefined>;
export type TranslateFn = (key: string, params?: I18nParams) => string;

export interface I18n {
  /** Resolve a resource key. Read reactive state inside it (e.g. a locale store) and components re-render on change. */
  t: TranslateFn;
  /** BCP 47 locale, for components that format numbers or dates. */
  readonly locale?: string;
}

type Dict = { [k: string]: Dict | string };

// TEMPORARY (i18n sweep in progress): per-batch key files are merged over en.json; folded into en.json when done.
const parts = import.meta.glob<Dict>('./parts/*.json', { eager: true, import: 'default' });
const deepMerge = (a: Dict, b: Dict): Dict => {
  const out: Dict = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = typeof v === 'object' && typeof out[k] === 'object' ? deepMerge(out[k] as Dict, v) : v;
  return out;
};
const enAll = Object.values(parts).reduce(deepMerge, en as Dict);

/** The library's English strings, nested under `ui`. Hosts merge them into their own dictionaries. */
export const messages = { en: enAll };

/** Dotted lookup into a nested dictionary ('ui.common.cancel'). */
export function lookup(dict: Dict, key: string): string | undefined {
  if (typeof (dict as Record<string, unknown>)[key] === 'string') return (dict as Record<string, string>)[key];
  let node: Dict | string | undefined = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Formats the ICU MessageFormat subset the library's messages use (the same syntax svelte-i18n / intl-messageformat
 * understand, so hosts can use their own formatter): `{name}`, `{n, plural, =0 {…} one {# item} other {# items}}` and
 * `{x, select, a {…} other {…}}`. Unknown placeholders are left as they are.
 */
export function interpolate(text: string, params: I18nParams = {}, locale = 'en'): string {
  if (!text.includes('{')) return text;
  let i = 0;
  const parse = (hash?: string): string => {
    let out = '';
    while (i < text.length) {
      const c = text[i];
      if (c === '}') return out;
      if (c === '#' && hash !== undefined) {
        out += hash;
        i++;
      } else if (c === '{') {
        i++;
        out += argument(hash);
      } else {
        out += c;
        i++;
      }
    }
    return out;
  };
  const argument = (hash?: string): string => {
    const head = text.slice(i).match(/^\s*(\w+)\s*(?:,\s*(plural|select)\s*,)?/);
    if (!head) return '{';
    i += head[0].length;
    const [, name, kind] = head;
    const value = params[name];
    if (!kind) {
      i = text.indexOf('}', i) + 1;
      return value == null ? `{${name}}` : String(value);
    }
    // options: selector {message} …
    const options: Record<string, string> = {};
    for (;;) {
      const sel = text.slice(i).match(/^\s*(=?\w+)\s*\{/);
      if (!sel) break;
      i += sel[0].length;
      const n = Number(value);
      options[sel[1]] = parse(kind === 'plural' ? new Intl.NumberFormat(locale).format(n) : hash);
      i++; // closing }
    }
    i = text.indexOf('}', i) + 1;
    if (kind === 'select') return options[String(value)] ?? options.other ?? '';
    const n = Number(value);
    return options['=' + n] ?? options[new Intl.PluralRules(locale).select(n)] ?? options.other ?? '';
  };
  return parse();
}

/** Translator over a nested dictionary; falls back to the key itself. */
export function dictionaryTranslator(dict: Dict, locale = 'en'): I18n {
  return { t: (key, params) => interpolate(lookup(dict, key) ?? key, params, locale), locale };
}

export const fallbackI18n: I18n = dictionaryTranslator(enAll);

const KEY = Symbol('openchat-ui-i18n');

/** Call once in the host's root component (or any subtree) to supply translations. */
export function setI18n(i18n: I18n): I18n {
  return setContext(KEY, i18n);
}

/** The translator in scope. Call during component initialisation. */
export function getI18n(): I18n {
  return getContext<I18n | undefined>(KEY) ?? fallbackI18n;
}

/** `const t = useT();` then `t('ui.common.cancel')` in markup — re-evaluates when the host's translator changes. */
export function useT(): TranslateFn {
  const i18n = getI18n();
  return (key, params) => i18n.t(key, params);
}
