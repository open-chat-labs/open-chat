import { afterEach, describe, expect, test, vi } from "vitest";

// vitest resolves with the "browser" condition, which maps the bare "url" import in
// rollup.extras.mjs to a polyfill without fileURLToPath.
vi.mock("url", () => import("node:url"));

// jsdom has no matchMedia, which the themes read as they are imported. Hoisted so it is in place
// before the imports below.
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

import { STARTUP_DARK_BACKGROUND } from "../../rollup.extras.mjs";
import { clearStartupBackground, currentTheme, themes, themeType } from "./themes";

// What index.html's startup script reads to decide whether to paint the page dark
const STARTUP_THEME_MODE_KEY = "openchat_startup_theme_mode";

describe("the theme mode remembered for the next page load", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        themeType.set("system");
        localStorage.clear();
    });

    test("follows the theme in use", () => {
        const unsubscribe = currentTheme.subscribe(() => {});

        themeType.set("dark");
        expect(localStorage.getItem(STARTUP_THEME_MODE_KEY)).toBe("dark");

        themeType.set("light");
        expect(localStorage.getItem(STARTUP_THEME_MODE_KEY)).toBe("light");

        unsubscribe();
    });

    test("follows the mobile layout's theme", async () => {
        // its own copy of the themes, as switching to the mobile layout's is for good
        vi.resetModules();
        const { setNativeTheme } = await import("./themes");
        const { themeV2Appearance } = await import("./themeV2");

        setNativeTheme();
        expect(localStorage.getItem(STARTUP_THEME_MODE_KEY)).toBe("dark");

        themeV2Appearance.set("light");
        expect(localStorage.getItem(STARTUP_THEME_MODE_KEY)).toBe("light");
    });

    test("is not needed for the theme to apply when storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("denied");
        });
        let mode: string | undefined;
        const unsubscribe = currentTheme.subscribe((theme) => (mode = theme.mode));
        expect(mode).toBe("light");
        unsubscribe();
    });
});

describe("the background painted by index.html", () => {
    test("is the default dark theme's", () => {
        expect(STARTUP_DARK_BACKGROUND).toBe(themes.dark.bg.toLowerCase());
    });

    afterEach(() => {
        vi.useRealTimers();
        document.documentElement.removeAttribute("style");
    });

    // Invariant: it outlasts the body's 300ms background fade, then goes.
    test("is cleared once the app's own background has faded in", () => {
        vi.useFakeTimers();
        document.documentElement.style.backgroundColor = "#1b1c21";

        clearStartupBackground();
        vi.advanceTimersByTime(300);
        expect(document.documentElement.style.backgroundColor).not.toBe("");

        vi.advanceTimersByTime(700);
        expect(document.documentElement.style.backgroundColor).toBe("");
    });
});
