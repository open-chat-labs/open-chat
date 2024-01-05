import type { TranslationCorrections } from "openchat-shared";
import { addMessages } from "svelte-i18n";

type LocaleDictionary = {
    [key: string]: LocaleDictionary | string | Array<string | LocaleDictionary> | null;
};

export function applyTranslationCorrections(corrections: TranslationCorrections): void {
    Object.entries(corrections).forEach(([locale, byLocale]) => {
        addMessages(locale, toLocaleDictionary(byLocale));
    });
}

/**
 * This takes a record where the key is the dotted path e.g. "a.b.c" with a value and converts
 * it to a nested dictionary as used by svelte-i18n e.g. { a: { b: { c: value }}}
 */
function toLocaleDictionary(rec: Record<string, string>): LocaleDictionary {
    const expanded: LocaleDictionary = {};

    for (const key in rec) {
        const value = rec[key];
        const keys = key.split(".");

        let level = expanded;

        keys.forEach((nestedKey, i) => {
            if (!level[nestedKey]) {
                if (i === keys.length - 1) {
                    level[nestedKey] = value;
                } else {
                    level[nestedKey] = {};
                }
            }
            level = level[nestedKey] as LocaleDictionary;
        });
    }

    return expanded;
}
