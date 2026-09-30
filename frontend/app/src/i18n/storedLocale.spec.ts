import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configKeys } from "../utils/config";
import { supportedLanguages } from "./i18n";

const codes = supportedLanguages.map((l) => l.code);

// A page load: fresh module state, so i18n.ts initialises the real svelte-i18n from localStorage
// and the browser's language, and loads the real translations.
async function loadPage(browserLanguage = "en-GB") {
    vi.resetModules();
    vi.spyOn(navigator, "language", "get").mockReturnValue(browserLanguage);
    const { _, locale } = await import("svelte-i18n");
    const i18n = await import("./i18n");
    const { rtlStore } = await import("../stores/rtl");
    await vi.waitFor(() => expect(get(locale)).toBeTruthy());
    return {
        setLocale: i18n.setLocale,
        close: () => get(_)("close"),
        locale: () => get(locale),
        language: () => i18n.languageCode(get(locale)),
        canEditTranslations: () => i18n.hasEditableTranslations(get(locale)),
        rtl: () => get(rtlStore),
    };
}

// Each language's translations are in the file named after its code
const translations = import.meta.glob<{ close: string }>("./*.json", { import: "default" });

async function translationOfClose(code: string): Promise<string> {
    return (await translations[`./${code}.json`]()).close;
}

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
        expect(page.language()).toBe(code);
    });

    test("Hebrew chosen in the language selector survives a reload", async () => {
        const page = await loadPage();
        expect(page.close()).toBe("Close");

        await page.setLocale("iw");

        expect(localStorage.getItem(configKeys.locale)).toBe("iw");
        expect(page.close()).toBe("סגור");
        expect(page.language()).toBe("iw");
        expect(page.rtl()).toBe(true);

        const reloaded = await loadPage();

        expect(localStorage.getItem(configKeys.locale)).toBe("iw");
        expect(reloaded.close()).toBe("סגור");
        expect(reloaded.language()).toBe("iw");
        expect(reloaded.rtl()).toBe(true);
    });

    // The locale which svelte-i18n reports, and sets as the document's language, is the canonical
    // one whether it came from init() or from setLocale
    test("Hebrew is known to svelte-i18n by its canonical code", async () => {
        const page = await loadPage();
        await page.setLocale("iw");
        expect(page.locale()).toBe("he");

        const reloaded = await loadPage();
        expect(reloaded.locale()).toBe("he");
    });

    // What the translation corrections review screen does with a correction's locale
    test("a Hebrew correction's locale can be loaded and read from another language", async () => {
        await loadPage();
        const { _, locale } = await import("svelte-i18n");
        const { i18nLocale } = await import("./i18n");

        await locale.set(i18nLocale("iw"));
        await locale.set("en-GB");

        expect(get(_)("close", { locale: i18nLocale("iw") })).toBe("סגור");
        expect(get(_)("close")).toBe("Close");
    });

    // Before the fix a reload left svelte-i18n on "he", and the language selectors then stored
    // that (or the browser's dialect of it) in place of "iw"
    test.each(["he", "he-IL", "iw-IL"])("a stored %s is Hebrew too", async (stored) => {
        localStorage.setItem(configKeys.locale, stored);

        const page = await loadPage();

        expect(page.close()).toBe("סגור");
        expect(page.language()).toBe("iw");
        expect(page.rtl()).toBe(true);
    });

    test.each(["he", "he-IL", "iw-IL"])(
        "a browser set to %s gets Hebrew when nothing is stored",
        async (browserLanguage) => {
            const page = await loadPage(browserLanguage);

            expect(page.close()).toBe("סגור");
            expect(page.language()).toBe("iw");
        },
    );

    test("a stored locale wins over the browser's language", async () => {
        localStorage.setItem(configKeys.locale, "en");

        const page = await loadPage("he-IL");

        expect(page.close()).toBe("Close");
        expect(page.language()).toBe("en");
        expect(page.rtl()).toBe(false);
    });

    test("a dialect of the chosen language is kept", async () => {
        const page = await loadPage("fr-CA");
        await page.setLocale("fr");

        expect(localStorage.getItem(configKeys.locale)).toBe("fr-CA");

        const reloaded = await loadPage("fr-CA");

        expect(reloaded.locale()).toBe("fr-CA");
        expect(reloaded.close()).toBe("Fermer");
        expect(reloaded.language()).toBe("fr");
    });

    test.each(["ar-SA", "fa-IR"])(
        "a dialect of a right to left language (%s) is too",
        async (stored) => {
            localStorage.setItem(configKeys.locale, stored);

            const page = await loadPage();

            expect(page.rtl()).toBe(true);
        },
    );

    test("falls back to English for a language there are no translations for", async () => {
        const page = await loadPage("sv-SE");

        expect(page.close()).toBe("Close");
        expect(page.rtl()).toBe(false);
    });
});

// Whether the user's profile offers the toggle for suggesting corrections to the translations
describe("editing translations", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    test.each(codes)("is offered for %s unless it is English", async (code) => {
        localStorage.setItem(configKeys.locale, code);

        const page = await loadPage();

        expect(page.canEditTranslations()).toBe(code !== "en");
    });

    test.each(["en", "en-GB", "en-US"])("is not offered to a browser set to %s", async (lang) => {
        const page = await loadPage(lang);

        expect(page.canEditTranslations()).toBe(false);
    });

    test.each(["fr", "fr-CA", "he-IL", "ar-SA"])(
        "is offered to a browser set to %s",
        async (browserLanguage) => {
            const page = await loadPage(browserLanguage);

            expect(page.close()).not.toBe("Close");
            expect(page.canEditTranslations()).toBe(true);
        },
    );

    // The locale is the browser's, but all there is to show is the English fallback
    test.each(["sv", "sv-SE", "pt-BR"])(
        "is not offered to a browser set to %s, which there are no translations for",
        async (browserLanguage) => {
            const page = await loadPage(browserLanguage);

            expect(page.locale()).toBe(browserLanguage);
            expect(page.close()).toBe("Close");
            expect(page.canEditTranslations()).toBe(false);
        },
    );

    // Chinese and Japanese are "cn" and "jp" to OpenChat, which no browser's language matches, so
    // these users are in English until they pick their language
    test.each([
        ["zh-CN", "cn"],
        ["zh", "cn"],
        ["ja", "jp"],
        ["ja-JP", "jp"],
    ])(
        "is offered to a browser set to %s only once %s is chosen",
        async (browserLanguage, code) => {
            const page = await loadPage(browserLanguage);

            expect(page.close()).toBe("Close");
            expect(page.canEditTranslations()).toBe(false);

            await page.setLocale(code);

            expect(page.close()).toBe(await translationOfClose(code));
            expect(page.canEditTranslations()).toBe(true);

            const reloaded = await loadPage(browserLanguage);

            expect(reloaded.canEditTranslations()).toBe(true);
        },
    );

    test("is withdrawn on switching to English", async () => {
        const page = await loadPage("fr-FR");
        expect(page.canEditTranslations()).toBe(true);

        await page.setLocale("en");

        expect(page.canEditTranslations()).toBe(false);
    });
});

describe("languageCode", () => {
    test.each([
        ["fr", "fr"],
        ["fr-CA", "fr"],
        ["en-GB", "en"],
        ["he", "iw"],
        ["he-IL", "iw"],
        ["cn", "cn"],
        ["sv-SE", "sv"],
        [null, "en"],
        [undefined, "en"],
    ])("of %s is %s", async (locale, code) => {
        const { languageCode } = await import("./i18n");
        expect(languageCode(locale)).toBe(code);
    });

    test.each(codes)("of the locale svelte-i18n knows %s by is that code", async (code) => {
        const { i18nLocale, languageCode } = await import("./i18n");
        expect(languageCode(i18nLocale(code))).toBe(code);
    });
});
