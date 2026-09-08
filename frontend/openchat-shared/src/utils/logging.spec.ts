import { describe, expect, test } from "vitest";
import { normaliseSourceMapUrls } from "./logging";

// These expectations are the other half of a contract: `scripts/upload-source-maps.mjs` registers
// each map as `http://dynamichost/<path relative to frontend/app/build>`. If a frame's filename
// does not normalise to exactly that, Rollbar finds no map and the trace stays minified with no
// error anywhere.
function frames(...filenames: unknown[]) {
    const payload = { body: { trace: { frames: filenames.map((filename) => ({ filename })) } } };
    normaliseSourceMapUrls(payload);
    return payload.body.trace.frames.map((f) => f.filename);
}

describe("normaliseSourceMapUrls", () => {
    test("collapses every origin the bundle is served from", () => {
        expect(
            frames(
                "https://oc.app/main-D_Idsc5v.js",
                "https://webtest.oc.app/main-D_Idsc5v.js",
                "https://6hsbt-vqaaa-aaaaf-aaafq-cai.icp0.io/main-D_Idsc5v.js",
                "http://tauri.localhost/main-D_Idsc5v.js",
            ),
        ).toEqual(Array(4).fill("http://dynamichost/main-D_Idsc5v.js"));
    });

    test("drops the worker's cache-busting query", () => {
        expect(frames("https://oc.app/worker.js?v=2.0.2052")).toEqual([
            "http://dynamichost/worker.js",
        ]);
    });

    test("keeps a nested chunk's directory", () => {
        expect(frames("https://oc.app/assets/lazy-abc123.js")).toEqual([
            "http://dynamichost/assets/lazy-abc123.js",
        ]);
    });

    test("leaves extension frames alone so the extension filter still matches", () => {
        expect(
            frames(
                "chrome-extension://cadiboklkpojfamcoggejbbdjcoiljjk/inpage.js",
                "moz-extension://abc/inject.js",
                "safari-web-extension://abc/inject.js",
            ),
        ).toEqual([
            "chrome-extension://cadiboklkpojfamcoggejbbdjcoiljjk/inpage.js",
            "moz-extension://abc/inject.js",
            "safari-web-extension://abc/inject.js",
        ]);
    });

    test("tolerates frames with no usable filename", () => {
        expect(frames(undefined, "", "<anonymous>", 42)).toEqual([
            undefined,
            "",
            "<anonymous>",
            42,
        ]);
    });

    test("walks every trace in a chain", () => {
        const payload = {
            body: {
                trace_chain: [
                    { frames: [{ filename: "https://oc.app/a.js" }] },
                    { frames: [{ filename: "https://oc.app/b.js?v=1" }] },
                ],
            },
        };
        normaliseSourceMapUrls(payload);
        expect(payload.body.trace_chain.map((t) => t.frames[0].filename)).toEqual([
            "http://dynamichost/a.js",
            "http://dynamichost/b.js",
        ]);
    });

    test("ignores payloads with no trace at all", () => {
        expect(() => normaliseSourceMapUrls({ body: { message: { body: "hello" } } })).not.toThrow();
        expect(() => normaliseSourceMapUrls({})).not.toThrow();
    });
});
