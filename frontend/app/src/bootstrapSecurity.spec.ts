import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileString } from "sass";
import { describe, expect, test } from "vitest";

const appRoot = existsSync(resolve(process.cwd(), "app", "index.html"))
    ? resolve(process.cwd(), "app")
    : process.cwd();
const readAppFile = (path: string) => readFileSync(resolve(appRoot, path), "utf8");
const indexHtml = readAppFile("index.html");
const main = readAppFile("src/main.ts");
const globalStyles = readAppFile("src/styles/global.scss");
const rollupExtras = readAppFile("rollup.extras.mjs");
const svelteConfig = readAppFile("svelte.config.js");
const viteConfig = readAppFile("vite.config.ts");

describe("application bootstrap security", () => {
    test("keeps build-time CSP and version injection without loopback telemetry", () => {
        expect(indexHtml).toContain("<%- csp %>");
        expect(indexHtml).toContain("<%- injectScript %>");
        expect(indexHtml).not.toMatch(/<base[^>]+localhost/i);
        expect(indexHtml).not.toContain("127.0.0.1:38291");
        expect(indexHtml).not.toContain("__ocsend");
        expect(indexHtml).not.toContain("/src/main.ts");
    });

    test("selects desktop or mobile root without debug instrumentation", () => {
        expect(main).toContain("./components/App.svelte");
        expect(main).toContain("./components_mobile/App.svelte");
        expect(main).toContain("v2 ? mount(AppV2");
        expect(main).toContain(": mount(App");
        expect(main).not.toContain("__ocsend");
        expect(main).not.toContain("OC-DEBUG");
    });

    test("retains the cross-platform Windows Sass path fix", () => {
        expect(rollupExtras).toContain("export const stylesDir");
        expect(rollupExtras).toContain("@use 'mixins' as *");
        expect(svelteConfig).toContain("loadPaths: [stylesDir]");
        expect(svelteConfig).toContain("includePaths: [stylesDir]");
        expect(viteConfig).toContain("loadPaths: [stylesDir]");
        expect(viteConfig).toContain("includePaths: [stylesDir]");
        expect(globalStyles.split(/\r?\n/, 1)[0]).toContain("@use");
        expect(globalStyles).toContain("./mixins");

        const globalStylesPath = resolve(appRoot, "src/styles/global.scss");
        expect(() =>
            compileString(
                "@use 'sass:math'; @use 'sass:map'; @use 'mixins' as *;\n" + globalStyles,
                {
                    loadPaths: [resolve(appRoot, "src/styles")],
                    url: pathToFileURL(globalStylesPath),
                },
            ),
        ).not.toThrow();
    });
});
