import type { TranslationCorrection, TranslationCorrections } from "openchat-shared";
import { addMessages } from "svelte-i18n";
import { writable } from "svelte/store";

type LocaleDictionary = {
    [key: string]: LocaleDictionary | string | Array<string | LocaleDictionary> | null;
};

export const translationCorrectionsStore = writable<TranslationCorrections>({});

export function applyTranslationCorrections(
    userId: string,
    corrections: TranslationCorrections,
): void {
    translationCorrectionsStore.set(corrections);
    Object.entries(corrections).forEach(([locale, byLocale]) => {
        addMessages(locale, toLocaleDictionary(userId, byLocale));
    });
}

/**
 * This takes a record where the key is the dotted path e.g. "a.b.c" with a value and converts
 * it to a nested dictionary as used by svelte-i18n e.g. { a: { b: { c: value }}}
 */
function toLocaleDictionary(
    userId: string,
    byLocale: Record<string, TranslationCorrection>,
): LocaleDictionary {
    const expanded: LocaleDictionary = {};

    for (const translationKey in byLocale) {
        const correction = byLocale[translationKey];
        const keyParts = translationKey.split(".");

        // filter out any corrections made by another user which have not yet been approved
        if (!correction.approved && correction.proposedBy !== userId) {
            continue;
        }

        let level = expanded;

        keyParts.forEach((nestedKey, i) => {
            if (!level[nestedKey]) {
                if (i === keyParts.length - 1) {
                    level[nestedKey] = correction.value;
                } else {
                    level[nestedKey] = {};
                }
            }
            level = level[nestedKey] as LocaleDictionary;
        });
    }

    return expanded;
}
