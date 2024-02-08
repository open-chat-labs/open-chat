import { register, init, locale, getLocaleFromNavigator, _ } from "svelte-i18n";
import { get, writable } from "svelte/store";
import { configKeys } from "../utils/config";
import { type InterpolationValues, type Level, type MessageFormatter } from "openchat-client";

export const translationCodes: Record<string, string> = {
    cn: "zh-cn",
    de: "de",
    es: "es",
    en: "en",
    fr: "fr",
    it: "it",
    jp: "ja",
    ru: "ru",
    vi: "vi",
    iw: "iw",
    hi: "hi",
};

export const supportedLanguages = [
    {
        name: "English",
        code: "en",
    },
    {
        name: "Français",
        code: "fr",
    },
    {
        name: "Deutsch",
        code: "de",
    },
    {
        name: "Italiano",
        code: "it",
    },
    {
        name: "Español",
        code: "es",
    },
    {
        name: "Tiếng Việt",
        code: "vi",
    },
    {
        name: "中文",
        code: "cn",
    },
    {
        name: "日本",
        code: "jp",
    },
    {
        name: "русский",
        code: "ru",
    },
    {
        name: "עִברִית",
        code: "iw",
    },
    {
        name: "हिंदी",
        code: "hi",
    },
];

export const supportedLanguagesByCode = supportedLanguages.reduce(
    (rec, lang) => {
        rec[lang.code] = lang;
        return rec;
    },
    {} as Record<string, { name: string; code: string }>,
);

// this can't be done in a loop from supportedLanguages because rollup won't understand that
register("en", () => import("./en.json"));
register("cn", () => import("./cn.json"));
register("de", () => import("./de.json"));
register("es", () => import("./es.json"));
register("fr", () => import("./fr.json"));
register("it", () => import("./it.json"));
register("jp", () => import("./jp.json"));
register("ru", () => import("./ru.json"));
register("vi", () => import("./vi.json"));
register("iw", () => import("./iw.json"));
register("hi", () => import("./hi.json"));

export function getStoredLocale(): string {
    const fromStorage = localStorage.getItem(configKeys.locale);

    if (fromStorage === null) {
        return getLocaleFromNavigator() || "en";
    }

    return setDialectIfMatchesBrowserLocale(fromStorage);
}

export async function setLocale(code: string): Promise<void> {
    code = setDialectIfMatchesBrowserLocale(code);

    localStorage.setItem(configKeys.locale, code);

    if (get(locale) !== code) {
        await locale.set(code);
    }
}

export function i18nFormatter(str: string): string {
    return get(_)(str);
}

function setDialectIfMatchesBrowserLocale(code: string): string {
    const localeFromNavigator = getLocaleFromNavigator();

    // If the browser is set to a dialect of the chosen locale, use that dialect, else use the locale passed in.
    // Eg. if the user selects "en" and the browser is set to "en-US", then we use "en-US"
    if (localeFromNavigator !== null && localeFromNavigator.startsWith(code)) {
        return localeFromNavigator;
    }

    return code;
}

init({
    fallbackLocale: "en",
    initialLocale: getStoredLocale(),
});

export function interpolate(
    formatter: MessageFormatter,
    { key, params, level, lowercase }: ResourceKey,
): string {
    if (level !== undefined) {
        const levelTxt = formatter(`level.${level}`);
        const p = params ?? {};
        return formatter(key, {
            values: { ...p, level: lowercase ? levelTxt.toLowerCase() : levelTxt },
        });
    } else {
        return formatter(key, { values: params });
    }
}

export const editmode = writable<boolean>(false);
export const editingLabel = writable<ResourceKey | undefined>(undefined);

export type ResourceKey = {
    kind: "resource_key";
    key: string;
    level?: Level;
    lowercase: boolean;
    params?: InterpolationValues;
};

export function i18nKey(
    key: string,
    params?: InterpolationValues,
    level?: Level,
    lowercase = false,
): ResourceKey {
    return {
        kind: "resource_key",
        key,
        params,
        level,
        lowercase,
    };
}
