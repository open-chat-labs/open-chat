import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { selectLayout } from "./layout";

// vitest resolves with the "browser" condition, which maps the bare "url" import in
// rollup.extras.mjs to a polyfill without fileURLToPath.
vi.mock("url", () => import("node:url"));

import { generateStartupScript } from "../../rollup.extras.mjs";

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
        localStorage.clear();
        window.OC_PRESTARTED_WORKER = undefined;
    });

    test("preloads the desktop App chunk and everything it statically imports", () => {
        expect(run()).toEqual(["/desktop.js", "/shared.js", "/deep.js", "/en.js"]);
    });

    test("preloads the mobile App chunk for the v2 layout on a narrow viewport", () => {
        configure("v2", 400);
        expect(run()).toEqual(["/mobile.js", "/shared.js", "/deep.js", "/en.js"]);
    });

    test("leaves out what the entry already preloads", () => {
        configure("v2", 400);
        const preloaded = run();
        expect(preloaded).not.toContain("/main.js");
        expect(preloaded).not.toContain("/vendor.js");
    });

    test("preloads the App tree which selectLayout goes on to pick", () => {
        for (const flag of [undefined, "v1", "v2"]) {
            for (const width of [400, 767, 768, 1200]) {
                document.head.innerHTML = "";
                configure(flag, width);
                const app = selectLayout(flag ?? "v1", width < 768) === "v2" ? "mobile" : "desktop";
                expect(run()[0], `${flag} at ${width}px`).toBe(`/${app}.js`);
            }
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

    test("preloads only English for a language there is no locale for", () => {
        vi.spyOn(navigator, "language", "get").mockReturnValue("sv-SE");
        expect(run()).toEqual(["/desktop.js", "/shared.js", "/deep.js", "/en.js"]);
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
