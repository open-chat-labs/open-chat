import { get } from "svelte/store";
import { beforeEach, describe, expect, test, vi } from "vitest";

const english = () => Promise.resolve({ hello: "Hello" });
const french = () => Promise.resolve({ hello: "Bonjour" });
const failure = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

// Runs against the real svelte-i18n with fake loaders, fresh module state per test
async function load(initialLocale: string, loaders: Record<string, (() => Promise<object>)[]>) {
    vi.resetModules();
    const i18n = await import("svelte-i18n");
    const { withEnglishFallback } = await import("./localeFallback");
    const attempts: Record<string, number> = {};
    const registerLoaders = () => {
        for (const [code, answers] of Object.entries(loaders)) {
            i18n.register(code, () => {
                const n = attempts[code] ?? 0;
                attempts[code] = n + 1;
                return answers[Math.min(n, answers.length - 1)]();
            });
        }
    };
    registerLoaders();
    const loaded = await withEnglishFallback(
        i18n.init({ fallbackLocale: "en", initialLocale }),
        registerLoaders,
    );
    return { i18n, loaded };
}

// Invariant 2 of #9636: a failed locale load leaves the app in English, or showing the reload
// prompt if English fails too.
describe("withEnglishFallback", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    test("keeps the initial locale when it loads", async () => {
        const { i18n, loaded } = await load("fr", { en: [english], fr: [french] });

        expect(loaded).toBe(true);
        expect(get(i18n._)("hello")).toBe("Bonjour");
    });

    test("falls back to English when the user's locale fails", async () => {
        const { i18n, loaded } = await load("fr", { en: [english], fr: [failure] });

        expect(loaded).toBe(true);
        expect(get(i18n.locale)).toBe("en");
        expect(get(i18n._)("hello")).toBe("Hello");
    });

    test("reports failure, with no locale set, when English fails too", async () => {
        const { i18n, loaded } = await load("en", { en: [failure] });

        expect(loaded).toBe(false);
        expect(get(i18n.locale)).toBeFalsy();
    });
});
