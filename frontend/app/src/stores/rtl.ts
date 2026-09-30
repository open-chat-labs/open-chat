import { derived } from "svelte/store";
import { locale } from "svelte-i18n";
import { languageCode } from "../i18n/i18n";

const rtlLanguages = ["ar", "iw", "fa"];

const rtlStore = derived(locale, ($locale) => rtlLanguages.includes(languageCode($locale)));

export { rtlStore };
