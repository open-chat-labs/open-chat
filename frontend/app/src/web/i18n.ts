import { interpolate, messages, type I18nParams } from "@openchat/ui/lib/i18n";
import { addMessages } from "svelte-i18n";

type Format = (key: string, options: { values?: I18nParams }) => string;
type RawLookup = (key: string) => unknown;

// @openchat/ui ships its English copy under the "ui." keys. Merged into svelte-i18n's English
// dictionary, the app's other locales fall back to it until they are translated.
export function addUiMessages(): void {
    addMessages("en", messages.en);
}

// The library passes either a resource key or literal text (a user's name, a chat's title…).
// Keys go through svelte-i18n so the app's locale and translation overrides apply; anything
// svelte-i18n doesn't know is literal text, formatted like the library would format it.
export function uiTranslate(
    format: Format,
    lookup: RawLookup,
    key: string,
    params: I18nParams | undefined,
    locale: string,
): string {
    if (typeof lookup(key) === "string") {
        return format(key, { values: params });
    }
    return interpolate(key, params, locale);
}
