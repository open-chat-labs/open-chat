import { init, locale, addMessages, getLocaleFromNavigator } from "svelte-i18n";

import en from "./en.json";
import cn from "./cn.json";
import it from "./it.json";

export const supportedLanguages = [
    {
        name: "English",
        code: "en",
        json: en,
    },
    {
        name: "Italiano",
        code: "it",
        json: it,
    },
    {
        name: "中文",
        code: "cn",
        json: cn,
    },
];

supportedLanguages.forEach(({ code, json }) => {
    addMessages(code, json);
});

init({
    fallbackLocale: "en",
    initialLocale: getStoredLocale(),
});

export function getStoredLocale(): string {
    return localStorage.getItem("openchat_locale") ?? getLocaleFromNavigator();
}

export function setLocale(code: string): void {
    locale.set(code);
    localStorage.setItem("openchat_locale", code);
}
