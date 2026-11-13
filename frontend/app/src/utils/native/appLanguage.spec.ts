import { configKeys } from "@shared";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The first import inside a test counts against its timeout, which a loaded CI runner can pass
vi.setConfig({ testTimeout: 20_000 });

// Not a vi.fn, which handles the promises it returns, so a rejection nothing catches would pass
const shell = vi.hoisted(() => ({ sent: [] as string[], older: false }));
vi.mock("tauri-plugin-oc-api", () => ({
    setAppLanguage: (language: string) => {
        shell.sent.push(language);
        return shell.older
            ? Promise.reject(new Error("command set_app_language not found"))
            : Promise.resolve();
    },
}));

// An app start with `stored` as the language chosen in the app: the real svelte-i18n setup
async function start(stored: string) {
    vi.resetModules();
    localStorage.setItem(configKeys.locale, stored);
    vi.spyOn(navigator, "language", "get").mockReturnValue("sv-SE");
    const { setLocale } = await import("@i18n/i18n");
    const { followLanguageInShell } = await import("./appLanguage");
    return { setLocale, followLanguageInShell };
}

beforeEach(() => {
    shell.sent = [];
    shell.older = false;
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

test("invariant 4 the shell is told the app's language at start and on every change", async () => {
    const { setLocale, followLanguageInShell } = await start("cn");

    followLanguageInShell();
    await vi.waitFor(() => expect(shell.sent).toEqual(["cn"]));

    await setLocale("de");
    await vi.waitFor(() => expect(shell.sent).toEqual(["cn", "de"]));

    // a language the app has no translations for shows English, so the shell's text is English
    await setLocale("sv");
    await vi.waitFor(() => expect(shell.sent).toEqual(["cn", "de", "en"]));
});

test("invariant 4 an older shell's rejection of the command is swallowed", async () => {
    shell.older = true;
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
        const { setLocale, followLanguageInShell } = await start("fr");

        followLanguageInShell();
        await vi.waitFor(() => expect(shell.sent).toEqual(["fr"]));
        await setLocale("it");
        await vi.waitFor(() => expect(shell.sent).toEqual(["fr", "it"]));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(unhandled).not.toHaveBeenCalled();
    } finally {
        process.off("unhandledRejection", unhandled);
    }
});
