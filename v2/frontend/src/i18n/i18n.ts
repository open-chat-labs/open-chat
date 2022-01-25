import { init, locale, addMessages, getLocaleFromNavigator } from "svelte-i18n";

import en from "./en.json";
import ar from "./ar.json";
import fr from "./fr.json";
import cn from "./cn.json";

// todo we should be loading these async on demand
addMessages("en", en);
addMessages("ar", ar);
addMessages("fr", fr);
addMessages("cn", cn);

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
