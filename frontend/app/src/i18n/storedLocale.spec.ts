import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configKeys } from "../utils/config";
import { supportedLanguages } from "./i18n";

const codes = supportedLanguages.map((l) => l.code);

// A page load: fresh module state, so i18n.ts initialises the real svelte-i18n from localStorage
// and the browser's language, and loads the real translations. The default browser language is
// one there are no translations for, so that it never supplies a dialect of the stored locale.
async function loadPage(browserLanguage = "sv-SE") {
    vi.resetModules();
    vi.spyOn(navigator, "language", "get").mockReturnValue(browserLanguage);
    const { _, locale } = await import("svelte-i18n");
    const { setLocale } = await import("./i18n");
    const { rtlStore } = await import("../stores/rtl");
    await vi.waitFor(() => expect(get(locale)).toBeTruthy());
    return {
        setLocale,
        close: () => get(_)("close"),
        locale: () => get(locale),
        rtl: () => get(rtlStore),
    };
}

// Each language's translations are in the file named after its code
const translations = import.meta.glob<{ close: string }>("./*.json", { import: "default" });

async function translationOfClose(code: string): Promise<string> {
    return (await translations[`./${code}.json`]()).close;
}

// Our language codes are not all current language tags ("iw" is the deprecated code for Hebrew),
// and svelte-i18n has to take them as they are: up to 3.7.2 its init() canonicalised the initial
// locale, so a stored "iw" became "he", which has no translations, and Hebrew was lost on reload.
describe("the stored locale", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    test.each(codes)("%s is still the language after a reload", async (code) => {
        localStorage.setItem(configKeys.locale, code);
        const translation = await translationOfClose(code);
        // Or loading nothing but the English fallback would pass
        expect(translation === "Close").toBe(code === "en");

        const page = await loadPage();

        expect(page.close()).toBe(translation);
        // The right to left store, the language selectors and the translation codes key on this
        expect(page.locale()).toBe(code);
    });

    test("Hebrew chosen in the language selector survives a reload", async () => {
        const page = await loadPage();
        expect(page.close()).toBe("Close");

        await page.setLocale("iw");

        expect(localStorage.getItem(configKeys.locale)).toBe("iw");
        expect(page.close()).toBe("סגור");
        expect(page.rtl()).toBe(true);

        const reloaded = await loadPage();

        expect(localStorage.getItem(configKeys.locale)).toBe("iw");
        expect(reloaded.close()).toBe("סגור");
        expect(reloaded.rtl()).toBe(true);
    });

    test("a dialect of the chosen language is kept", async () => {
        const page = await loadPage("fr-CA");
        await page.setLocale("fr");

        expect(localStorage.getItem(configKeys.locale)).toBe("fr-CA");

        const reloaded = await loadPage("fr-CA");

        expect(reloaded.locale()).toBe("fr-CA");
        expect(reloaded.close()).toBe("Fermer");
    });

    test("the browser's language is used when nothing is stored", async () => {
        const page = await loadPage("fr-CA");

        expect(page.locale()).toBe("fr-CA");
        expect(page.close()).toBe("Fermer");
    });

    test("falls back to English for a language there are no translations for", async () => {
        const page = await loadPage("sv-SE");

        expect(page.close()).toBe("Close");
    });

    test("falls back to English for a stored locale which is not a valid language tag", async () => {
        localStorage.setItem(configKeys.locale, "fr_CA");

        const page = await loadPage();

        expect(page.locale()).toBe("en");
        expect(page.close()).toBe("Close");
    });
});
