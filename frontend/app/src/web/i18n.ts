import { interpolate, lookup, messages, type I18nParams } from "@openchat/ui/lib/i18n";
import { addMessages } from "svelte-i18n";

type Format = (key: string, options: { values?: I18nParams }) => string;
type RawLookup = (key: string) => unknown;

// @openchat/ui ships its English copy under the "ui." keys. Merged into svelte-i18n's English
// dictionary, the app's other locales fall back to it until they are translated.
export function addUiMessages(): void {
    addMessages("en", messages.en);
}

// The library passes either one of its resource keys (all under "ui.") or literal text (a user's
// name, a chat's title…). Only its keys go through svelte-i18n, so the app's locale and translation
// overrides apply to them, while literal text that happens to match one of the app's own keys (a
// group called "home") stays as it is. With no locale loaded, svelte-i18n knows no keys, so the
// library's bundled English is used.
export function uiTranslate(
    format: Format,
    lookupRaw: RawLookup,
    key: string,
    params: I18nParams | undefined,
    locale: string,
): string {
    if (key.startsWith("ui.")) {
        if (typeof lookupRaw(key) === "string") {
            return format(key, { values: params });
        }
        const english = lookup(messages.en, key);
        if (english !== undefined) {
            return interpolate(english, params, locale);
        }
    }
    return interpolate(key, params, locale);
}
