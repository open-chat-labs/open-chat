import { interpolate, lookup, messages, type I18nParams } from "@openchat/ui/src/lib/i18n";
import { ErrorCode, IntlMessageFormat } from "intl-messageformat";
import { addMessages } from "svelte-i18n";

type RawLookup = (key: string) => unknown;

// @openchat/ui ships its English copy under the "ui." keys. Merged into svelte-i18n's English
// dictionary, the app's other locales fall back to it until they are translated.
export function addUiMessages(): void {
    addMessages("en", messages.en);
}

// The library passes either one of its resource keys (all under "ui.") or literal text (a user's
// name, a chat's title…). Only its keys go through svelte-i18n's dictionaries, so the app's locale
// and translation overrides apply to them, while literal text that happens to match one of the
// app's own keys (a group called "home") stays as it is. With no locale loaded, svelte-i18n knows
// no keys, so the library's bundled English is used.
export function uiTranslate(
    lookupRaw: RawLookup,
    key: string,
    params: I18nParams | undefined,
    locale: string,
): string {
    if (key.startsWith("ui.")) {
        const message = lookupRaw(key);
        if (typeof message === "string") {
            return formatMessage(key, message, params, locale);
        }
        const english = lookup(messages.en, key);
        if (english !== undefined) {
            return interpolate(english, params, locale);
        }
    }
    return interpolate(key, params, locale);
}

// By locale and message. svelte-i18n's own getMessageFormatter is memoised on the message alone,
// so it would keep formatting in whichever locale a message was first formatted in.
const formatters = new Map<string, IntlMessageFormat | undefined>();

function formatter(key: string, message: string, locale: string): IntlMessageFormat | undefined {
    const cacheKey = `${locale}\n${message}`;
    if (!formatters.has(cacheKey)) {
        try {
            formatters.set(
                cacheKey,
                new IntlMessageFormat(message, locale, undefined, { ignoreTag: true }),
            );
        } catch (err) {
            console.warn(`[@openchat/ui] Message "${key}" (${locale}) has a syntax error`, err);
            formatters.set(cacheKey, undefined);
        }
    }
    return formatters.get(cacheKey);
}

// Anything that won't format falls back to the library's own interpolation, which fills in what
// it can and leaves the rest as it is. A placeholder with no value (the library's params may be
// null or undefined) is expected; any other failure is a broken translation, so it is logged.
function formatMessage(
    key: string,
    message: string,
    params: I18nParams | undefined,
    locale: string,
): string {
    const format = formatter(key, message, locale);
    if (format === undefined) {
        return interpolate(message, params, locale);
    }
    try {
        return String(format.format(formatValues(params)));
    } catch (err) {
        if ((err as { code?: unknown }).code !== ErrorCode.MISSING_VALUE) {
            console.warn(`[@openchat/ui] Message "${key}" (${locale}) failed to format`, err);
        }
        return interpolate(message, params, locale);
    }
}

// intl-messageformat only takes strings and numbers as they are (a boolean or a Date comes back as
// a list of parts), so the rest are written the way the library's own interpolation writes them.
function formatValues(params: I18nParams | undefined): Record<string, string | number> {
    const values: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(params ?? {})) {
        if (value != null) {
            values[name] = typeof value === "number" ? value : String(value);
        }
    }
    return values;
}
