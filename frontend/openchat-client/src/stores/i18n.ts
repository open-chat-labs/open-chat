import { addMessages } from "svelte-i18n";

type LocaleDictionary = {
    [key: string]: LocaleDictionary | string | Array<string | LocaleDictionary> | null;
};

export function applyTranslationCorrection(locale: string, key: string, value: string): void {
    addMessages(locale, toLocaleDictionary(key, value));
}

/**
 * This takes a record where the key is the dotted path e.g. "a.b.c" with a value and converts
 * it to a nested dictionary as used by svelte-i18n e.g. { a: { b: { c: value }}}
 */
function toLocaleDictionary(key: string, value: string): LocaleDictionary {
    const expanded: LocaleDictionary = {};

    const keyParts = key.split(".");

    let level = expanded;

    keyParts.forEach((nestedKey, i) => {
        if (!level[nestedKey]) {
            if (i === keyParts.length - 1) {
                level[nestedKey] = value;
            } else {
                level[nestedKey] = {};
            }
        }
        level = level[nestedKey] as LocaleDictionary;
    });

    return expanded;
}
