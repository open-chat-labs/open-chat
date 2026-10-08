import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { selectLayout } from "./layout";

// vitest resolves with the "browser" condition, which maps the bare "url" import in
// rollup.extras.mjs to a polyfill without fileURLToPath.
vi.mock("url", () => import("node:url"));

import { generateStartupScript } from "../../rollup.extras.mjs";

// jsdom has no matchMedia, which the startup script reads as it runs
const osPrefersDark = { dark: false };
window.matchMedia = ((query: string) =>
    ({
        matches: query === "(prefers-color-scheme: dark)" && osPrefersDark.dark,
    }) as MediaQueryList) as typeof window.matchMedia;

type Chunk = { fileName: string; moduleIds: string[]; imports: string[]; isEntry: boolean };

function chunk(fileName: string, moduleIds: string[], imports: string[] = []): Chunk {
    return { fileName, moduleIds, imports, isEntry: false };
}

const root = "/repo/frontend/app";
const chunks: Chunk[] = [
    { ...chunk("entry.js", [], ["main.js", "vendor.js"]), isEntry: true },
    chunk("main.js", [`${root}/src/main.ts`], ["vendor.js"]),
    chunk("vendor.js", []),
    chunk("desktop.js", [`${root}/src/components/App.svelte`], ["vendor.js", "shared.js"]),
    chunk("mobile.js", [`${root}/src/components_mobile/App.svelte`], ["main.js", "shared.js"]),
    chunk("shared.js", [`${root}/src/utils/urls.ts`], ["vendor.js", "deep.js"]),
    chunk("deep.js", [`${root}/src/utils/share.ts`]),
    chunk("lazy.js", [`${root}/src/components/Admin.svelte`], ["desktop.js"]),
    chunk("en.js", [`${root}/src/i18n/en.json`]),
    chunk("fr.js", [`${root}/src/i18n/fr.json`]),
    chunk("cn.js", [`${root}/src/i18n/cn.json`]),
];

// What rollup.config.mjs passes for a web build
const mobileLayout = `(window.OC_CONFIG?.OC_MOBILE_LAYOUT ?? "v1")`;

class FakeWorker {
    constructor(
        public url: string,
        public options: WorkerOptions,
    ) {}
}

function run(script = generateStartupScript({ chunks, version: "1.2.3", mobileLayout })): string[] {
    new Function(script)();
    return [...document.head.querySelectorAll("link[rel=modulepreload]")].map(
        (l) => l.getAttribute("href")!,
    );
}

function configure(flag: string | undefined, width: number) {
    vi.stubGlobal("OC_CONFIG", flag === undefined ? undefined : { OC_MOBILE_LAYOUT: flag });
    vi.stubGlobal("innerWidth", width);
}

describe("the startup script in index.html", () => {
    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB");
        configure(undefined, 1200);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.head.innerHTML = "";
        document.documentElement.style.removeProperty("background-color");
        osPrefersDark.dark = false;
        localStorage.clear();
        window.OC_PRESTARTED_WORKER = undefined;
    });

    function startupBackground(): string {
        run();
        return document.documentElement.style.backgroundColor;
    }

    test("paints the page dark when the theme last used was a dark one", () => {
        localStorage.setItem("openchat_startup_theme_mode", "dark");
        expect(startupBackground()).not.toBe("");
    });

    test("leaves the page alone when the theme last used was a light one, whatever the OS prefers", () => {
        localStorage.setItem("openchat_startup_theme_mode", "light");
        osPrefersDark.dark = true;
        expect(startupBackground()).toBe("");
    });

    test("goes by the OS preference on a first visit", () => {
        expect(startupBackground()).toBe("");
        osPrefersDark.dark = true;
        expect(startupBackground()).not.toBe("");
    });

    test("paints the mobile layout dark on a first visit, as that is its default theme", () => {
        configure("v2", 400);
        expect(startupBackground()).not.toBe("");
    });

    test("preloads the desktop App chunk and everything it statically imports", () => {
        expect(run()).toEqual(["/desktop.js", "/shared.js", "/deep.js", "/en.js"]);
    });

    test("preloads the mobile App chunk for the v2 layout on a narrow viewport", () => {
        configure("v2", 400);
        expect(run()).toEqual(["/mobile.js", "/shared.js", "/deep.js", "/en.js"]);
    });

    test("preloads the App tree which selectLayout goes on to pick", () => {
        for (const width of [767, 768]) {
            document.head.innerHTML = "";
            configure("v2", width);
            const app = selectLayout("v2", width < 768) === "v2" ? "mobile" : "desktop";
            expect(run()[0], `v2 at ${width}px`).toBe(`/${app}.js`);
        }
    });

    test("preloads the stored locale as well as the English fallback", () => {
        localStorage.setItem("openchat_locale", "fr");
        expect(run().slice(-2)).toEqual(["/en.js", "/fr.js"]);
    });

    test("falls back to the browser's language, ignoring its region", () => {
        vi.spyOn(navigator, "language", "get").mockReturnValue("fr-CA");
        expect(run().slice(-2)).toEqual(["/en.js", "/fr.js"]);
    });

    test("still preloads when localStorage is unavailable", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(run()).toEqual(["/desktop.js", "/shared.js", "/deep.js", "/en.js"]);
    });

    test("starts this version's worker for WorkerAgent to pick up", () => {
        run();
        const worker = window.OC_PRESTARTED_WORKER as unknown as FakeWorker;
        expect(worker.url).toBe("/worker.js?v=1.2.3");
        expect(worker.options).toEqual({ type: "module" });
    });

    test("still preloads when the worker cannot be started", () => {
        vi.stubGlobal("Worker", undefined);
        expect(run()).toEqual(["/desktop.js", "/shared.js", "/deep.js", "/en.js"]);
        expect(window.OC_PRESTARTED_WORKER).toBeUndefined();
    });

    test("fails the build when an App chunk or the English locale cannot be found", () => {
        const without = (fileName: string) => ({
            chunks: chunks.filter((c) => c.fileName !== fileName),
            version: "1.2.3",
            mobileLayout,
        });
        expect(() => generateStartupScript(without("desktop.js"))).toThrow(/App\.svelte/);
        expect(() => generateStartupScript(without("mobile.js"))).toThrow(/App\.svelte/);
        expect(() => generateStartupScript(without("en.js"))).toThrow(/en locale/);
    });
});
