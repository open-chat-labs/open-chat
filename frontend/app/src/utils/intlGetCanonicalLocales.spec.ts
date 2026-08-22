import { getCanonicalLocales as polyfill } from "@formatjs/intl-getcanonicallocales";
import { supportedLanguages } from "../i18n/i18n";
import { getCanonicalLocales } from "./intlGetCanonicalLocales";

// svelte-i18n's init() only uses getCanonicalLocales(initialLocale)[0], where
// initialLocale is one of our language codes or a navigator.language tag.
// Pin that the native shim agrees with the polyfill it replaces for those.
describe("Intl.getCanonicalLocales shim", () => {
    const inputs = [
        ...supportedLanguages.map((l) => l.code),
        "en-US",
        "en-GB",
        "fr-CA",
        "pt-BR",
        "zh-Hans-CN",
        "zh-TW",
        "ja-JP",
        "iw",
        "iw-IL",
        "sr-Latn",
        "de-DE-u-co-phonebk",
    ];

    test.each(inputs)("matches the polyfill for %s", (input) => {
        expect(getCanonicalLocales(input)).toEqual(polyfill(input));
    });

    test("throws on malformed tags like the polyfill", () => {
        expect(() => polyfill("zh-cmn")).toThrow();
        expect(() => getCanonicalLocales("zh-cmn")).toThrow();
    });

    test("undefined gives an empty list", () => {
        expect(getCanonicalLocales(undefined)).toEqual([]);
        expect(polyfill(undefined)).toEqual([]);
    });
});
