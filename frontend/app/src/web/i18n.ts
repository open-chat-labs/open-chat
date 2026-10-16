import { interpolate, lookup, messages, type I18nParams } from "@openchat/ui/src/lib/i18n";
import { addMessages } from "svelte-i18n";

type RawLookup = (key: string) => unknown;
type ParamValue = NonNullable<I18nParams[string]>;
type MessageFormatter = (
    message: string,
    locale: string,
) => { format(values: Record<string, ParamValue>): unknown };

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
    formatter: MessageFormatter,
    lookupRaw: RawLookup,
    key: string,
    params: I18nParams | undefined,
    locale: string,
): string {
    if (key.startsWith("ui.")) {
        const message = lookupRaw(key);
        if (typeof message === "string") {
            return formatMessage(formatter, message, params, locale);
        }
        const english = lookup(messages.en, key);
        if (english !== undefined) {
            return interpolate(english, params, locale);
        }
    }
    return interpolate(key, params, locale);
}

// intl-messageformat throws on a placeholder with no value (the library's params may be null or
// undefined), and svelte-i18n would then show the whole message unformatted. The library's own
// interpolation fills in the rest and leaves just that placeholder as it is.
function formatMessage(
    formatter: MessageFormatter,
    message: string,
    params: I18nParams | undefined,
    locale: string,
): string {
    const values = Object.fromEntries(
        Object.entries(params ?? {}).filter(
            (entry): entry is [string, ParamValue] => entry[1] != null,
        ),
    );
    try {
        return String(formatter(message, locale).format(values));
    } catch {
        return interpolate(message, params, locale);
    }
}
