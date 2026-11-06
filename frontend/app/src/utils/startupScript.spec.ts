import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { selectLayout, type LayoutInputs } from "./layout";

// vitest resolves with the "browser" condition, which maps the bare "url" import in
// rollup.extras.mjs to a polyfill without fileURLToPath.
vi.mock("url", () => import("node:url"));

import {
    APP_FONTS_URL,
    fontsLink,
    generateStartupScript,
    nativeLayoutFlag,
    WEB_FONTS_URL,
    webLayoutFlag,
} from "../../rollup.extras.mjs";

// jsdom has no matchMedia, which the startup script reads as it runs
const osPrefersDark = { dark: false };
// the primary pointer: a mouse unless a test says otherwise
const pointer = { coarse: false, hover: true };
window.matchMedia = ((query: string) =>
    ({
        matches:
            (query === "(prefers-color-scheme: dark)" && osPrefersDark.dark) ||
            (query === "(pointer: coarse)" && pointer.coarse) ||
            (query === "(hover: hover)" && pointer.hover),
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
    chunk("web.js", [`${root}/src/web/App.svelte`], ["vendor.js", "deep.js"]),
    chunk("native.js", [`${root}/src/native/App.svelte`], ["vendor.js", "deep.js"]),
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

// `webLayout`: whether the build has the new web UI (OC_WEB_LAYOUT=v3, a build-time flag)
function run(
    script = generateStartupScript({ chunks, version: "1.2.3", mobileLayout, webLayout: false }),
): string[] {
    new Function(script)();
    return [...document.head.querySelectorAll("link[rel=modulepreload]")].map(
        (l) => l.getAttribute("href")!,
    );
}

function configure(flag: string | undefined, width: number, native = false) {
    vi.stubGlobal("OC_CONFIG", flag === undefined ? undefined : { OC_MOBILE_LAYOUT: flag });
    vi.stubGlobal("innerWidth", width);
    // What isTauriApp looks for
    if (native) vi.stubGlobal("__TAURI_INTERNALS__", {});
    else delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

const withWebLayout = () =>
    generateStartupScript({ chunks, version: "1.2.3", mobileLayout, webLayout: true });

const withLayouts = (webLayout: boolean, nativeLayout: boolean) =>
    generateStartupScript({ chunks, version: "1.2.3", mobileLayout, webLayout, nativeLayout });

// What selectLayout gets in main.ts for what configure() and `pointer` set up
function layoutInputs(
    flag: string | undefined,
    web: boolean,
    native: boolean,
    width: number,
    nativeApp: boolean,
    override?: LayoutInputs["override"],
): LayoutInputs {
    return {
        mobileLayoutFlag: flag,
        webLayoutFlag: web ? "v3" : "",
        nativeLayoutFlag: native ? "v4" : "",
        width,
        coarsePointer: pointer.coarse,
        canHover: pointer.hover,
        nativeApp,
        override,
    };
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
        pointer.coarse = false;
        pointer.hover = true;
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

    test("preloads the new web App chunk in a v3 build on a wide viewport", () => {
        expect(run(withWebLayout())).toEqual(["/web.js", "/deep.js", "/en.js"]);
    });

    test("preloads the native App chunk in a v4 build in the apps and on a phone", () => {
        configure("v2", 1200, true);
        expect(run(withLayouts(true, true))).toEqual(["/native.js", "/deep.js", "/en.js"]);
        configure("v2", 390);
        pointer.coarse = true;
        pointer.hover = false;
        expect(run(withLayouts(true, true))[0]).toBe("/native.js");
    });

    test("preloads the App tree which selectLayout goes on to pick", () => {
        const trees = { v1: "desktop", v2: "mobile", v3: "web", v4: "native" };
        const pointers = [
            { coarse: false, hover: true },
            { coarse: true, hover: false },
            { coarse: true, hover: true },
        ];
        for (const web of [false, true]) {
            for (const nativeLayout of [false, true]) {
                for (const flag of ["v2", undefined]) {
                    for (const width of [767, 768, 1024]) {
                        for (const nativeApp of [false, true]) {
                            for (const p of pointers) {
                                document.head.innerHTML = "";
                                configure(flag, width, nativeApp);
                                Object.assign(pointer, p);
                                const inputs = layoutInputs(
                                    flag,
                                    web,
                                    nativeLayout,
                                    width,
                                    nativeApp,
                                );
                                const app = trees[selectLayout(inputs)];
                                expect(
                                    run(withLayouts(web, nativeLayout))[0],
                                    JSON.stringify(inputs),
                                ).toBe(`/${app}.js`);
                            }
                        }
                    }
                }
            }
        }
    });

    test("goes by the stored layout override, as selectLayout does", () => {
        const trees = { v1: "desktop", v2: "mobile", v3: "web", v4: "native" };
        for (const override of ["mobile", "desktop"] as const) {
            for (const width of [390, 1200]) {
                document.head.innerHTML = "";
                localStorage.setItem("openchat_layout_override", override);
                configure(undefined, width);
                const app =
                    trees[
                        selectLayout(layoutInputs(undefined, true, true, width, false, override))
                    ];
                expect(run(withLayouts(true, true))[0], `${override}, ${width}px`).toBe(
                    `/${app}.js`,
                );
            }
        }
    });

    test("doesn't need a web App chunk in a build without the new web UI", () => {
        const withoutWeb = chunks.filter((c) => c.fileName !== "web.js");
        const script = generateStartupScript({
            chunks: withoutWeb,
            version: "1.2.3",
            mobileLayout,
        });
        expect(run(script)).toEqual(["/desktop.js", "/shared.js", "/deep.js", "/en.js"]);
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
            webLayout: true,
        });
        expect(() => generateStartupScript(without("desktop.js"))).toThrow(/App\.svelte/);
        expect(() => generateStartupScript(without("mobile.js"))).toThrow(/App\.svelte/);
        expect(() => generateStartupScript(without("web.js"))).toThrow(/App\.svelte/);
        expect(() =>
            generateStartupScript({ ...without("native.js"), nativeLayout: true }),
        ).toThrow(/App\.svelte/);
        expect(() => generateStartupScript(without("en.js"))).toThrow(/en locale/);
    });
});

describe("the font stylesheet in index.html", () => {
    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.head.innerHTML = "";
        pointer.coarse = false;
        pointer.hover = true;
    });

    function stylesheets(script: string): string[] {
        new Function(script)();
        return [...document.head.querySelectorAll("link[rel=stylesheet]")].map(
            (l) => l.getAttribute("href")!,
        );
    }

    test("is linked from the html in a build without the new web UI", () => {
        expect(fontsLink(false)).toContain(APP_FONTS_URL);
        expect(
            stylesheets(generateStartupScript({ chunks, version: "1.2.3", mobileLayout })),
        ).toEqual([]);
    });

    test("is asked for by the startup script in a build with the new web UI", () => {
        expect(fontsLink(true)).toBe("");
        for (const width of [767, 768]) {
            for (const native of [false, true]) {
                document.head.innerHTML = "";
                configure(undefined, width, native);
                const web =
                    selectLayout(layoutInputs(undefined, true, false, width, native)) === "v3";
                expect(stylesheets(withWebLayout()), `${width}px, native ${native}`).toEqual([
                    web ? WEB_FONTS_URL : APP_FONTS_URL,
                ]);
            }
        }
    });

    test("is the web fonts for the native tree too", () => {
        // a phone
        pointer.coarse = true;
        pointer.hover = false;
        for (const nativeApp of [false, true]) {
            document.head.innerHTML = "";
            configure(undefined, 390, nativeApp);
            expect(stylesheets(withLayouts(false, true)), `native app ${nativeApp}`).toEqual([
                WEB_FONTS_URL,
            ]);
        }
    });
});

describe("the OC_WEB_LAYOUT a build sees", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test("is the flag in a web build", () => {
        vi.stubEnv("OC_APP_TYPE", "");
        vi.stubEnv("OC_WEB_LAYOUT", "v3");
        expect(webLayoutFlag()).toBe("v3");
    });

    test("leaves the new web UI out of a native build whatever the flag says", () => {
        vi.stubEnv("OC_WEB_LAYOUT", "v3");
        for (const appType of ["android", "ios"]) {
            vi.stubEnv("OC_APP_TYPE", appType);
            expect(webLayoutFlag(), appType).toBe("");
        }
    });
});

describe("the OC_NATIVE_LAYOUT a build sees", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test("is the flag, in a web build and a native one alike", () => {
        vi.stubEnv("OC_NATIVE_LAYOUT", "v4");
        for (const appType of ["", "android", "ios"]) {
            vi.stubEnv("OC_APP_TYPE", appType);
            expect(nativeLayoutFlag(), appType).toBe("v4");
        }
    });
});
