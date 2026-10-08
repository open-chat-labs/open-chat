// @vitest-environment node
import { describe, expect, test } from "vitest";
import { withCsp } from "./rollup-plugin-android-bundle.mjs";
import { generateCspForScripts } from "./rollup.extras.mjs";

// The OTA zips are cut from the website build's index.html, so they used to carry the
// website CSP. Its connect-src has no http://asset.localhost, so tapping a recent photo in
// the message composer's attachment tray failed with "TypeError: Failed to fetch".

const SCRIPTS = [`window.OC_WEBSITE_VERSION = "2.0.0";`, `var parcelRequire;`];

const websiteCsp = () => generateCspForScripts(SCRIPTS, false, false);
const otaCsp = () => generateCspForScripts(SCRIPTS, false, true);

const indexHtml = (csp: string) =>
    `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}" /></head><body></body></html>`;

function directives(html: string): Map<string, string[]> {
    const metas = [
        ...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/g),
    ];
    expect(metas.length).toBe(1);
    const content = metas[0][1];
    return new Map(
        content
            .split(";")
            .map((d) => d.trim().split(/\s+/))
            .filter(([name]) => name)
            .map(([name, ...sources]) => [name, sources]),
    );
}

const scriptHashes = (html: string) =>
    (directives(html).get("script-src") ?? []).filter((s) => s.startsWith("'sha256-"));

describe("OTA bundle CSP", () => {
    test("invariant 1: the OTA index.html lets fetch reach the asset and ipc protocols", () => {
        const connect = directives(withCsp(indexHtml(websiteCsp()), otaCsp())).get("connect-src");
        expect(connect).toContain("http://asset.localhost");
        expect(connect).toContain("http://ipc.localhost");
    });

    test("invariant 2: the OTA index.html keeps the website's inline-script hashes", () => {
        const website = indexHtml(websiteCsp());
        const hashes = scriptHashes(website);
        expect(hashes).toHaveLength(SCRIPTS.length);
        expect(scriptHashes(withCsp(website, otaCsp()))).toEqual(hashes);
    });

    test("invariant 3: the website CSP stays free of the native-only sources", () => {
        const all = [...directives(indexHtml(websiteCsp())).values()].flat();
        expect(all).not.toContain("http://asset.localhost");
        expect(all).not.toContain("http://ipc.localhost");
    });

    test("invariant 4: the build fails rather than zip an index.html whose CSP it could not replace", () => {
        expect(() => withCsp("<html><head></head></html>", otaCsp())).toThrow();
        const twice = indexHtml(websiteCsp()).replace("</head>", `${indexHtml("x")}</head>`);
        expect(() => withCsp(twice, otaCsp())).toThrow();
    });
});
