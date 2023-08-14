import { register, init, locale, getLocaleFromNavigator, _ } from "svelte-i18n";
import { configKeys } from "../utils/config";

import { get } from "svelte/store";

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
];

export const supportedLanguagesByCode = supportedLanguages.reduce((rec, lang) => {
    rec[lang.code] = lang;
    return rec;
}, {} as Record<string, { name: string; code: string }>);

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

init({
    fallbackLocale: "en",
    initialLocale: getStoredLocale(),
});

export function getStoredLocale(): string {
    return localStorage.getItem(configKeys.locale) ?? (getLocaleFromNavigator() || "en");
}

export function setLocale(code: string): void {
    locale.set(code);
    localStorage.setItem(configKeys.locale, code);
}

export function i18nFormatter(str: string): string {
    return get(_)(str);
}
