import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Script } from "node:vm";
import { compileString } from "sass";
import {
    factory,
    isMetaProperty,
    ModuleKind,
    ScriptTarget,
    SyntaxKind,
    transpileModule,
    visitEachChild,
    visitNode,
    type SourceFile,
    type Visitor,
} from "typescript";
import { describe, expect, test, vi } from "vitest";
import { selectLayout } from "./utils/layout";

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

// Execute the real entry point without importing either large Svelte tree. CJS
// transpilation preserves import()'s asynchronous branch selection; only
// import.meta is replaced so this isolated VM receives a controlled build flag.
const bootstrap = transpileModule(main, {
    fileName: "main.ts",
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    transformers: {
        before: [
            (context) => {
                const visit: Visitor = (node) =>
                    isMetaProperty(node) && node.keywordToken === SyntaxKind.ImportKeyword
                        ? factory.createIdentifier("__bootstrapImportMeta")
                        : visitEachChild(node, visit, context);
                return (source) => visitNode(source, visit) as SourceFile;
            },
        ],
    },
}).outputText;

function startBootstrap(flag: string | undefined, narrow: boolean, webRuntime: boolean) {
    const desktopApp = { layout: "v1" };
    const mobileApp = { layout: "v2" };
    const mountedApp = {};
    const body = {};
    const mount = vi.fn(() => mountedApp);
    const chooseLayout = vi.fn(selectLayout);
    const setNativeTheme = vi.fn();
    const writeNativeCssVariables = vi.fn();
    const usesWebInferenceRuntime = vi.fn(() => webRuntime);
    // Deliberately never settles: startup must mount while the shared restore is
    // still in flight, without launching a separate model-selection path.
    const ensureWebModelRestored = vi.fn(() => new Promise<void>(() => {}));
    const imports: Record<string, unknown> = {
        "./web-components/customEmoji": {},
        "./web-components/profileLink": {},
        "./web-components/spoiler": {},
        "@client": { mobileWidth: { value: narrow } },
        svelte: { mount },
        "./theme/themes": { setNativeTheme, writeNativeCssVariables },
        "./utils/layout": { selectLayout: chooseLayout },
        "./utils/onDeviceInference": { usesWebInferenceRuntime },
        "./utils/webInference": { ensureWebModelRestored },
        "./components/App.svelte": { default: desktopApp },
        "./components_mobile/App.svelte": { default: mobileApp },
    };
    const loadModule = vi.fn((name: string) => {
        if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected bootstrap import: ${name}`);
        return imports[name];
    });
    const exported: { default?: Promise<unknown> } = {};
    // VM intrinsics also isolate main's BigInt.prototype.toJSON setup from tests.
    new Script(bootstrap, { filename: "main.ts" }).runInNewContext({
        exports: exported,
        require: loadModule,
        __bootstrapImportMeta: { env: { OC_MOBILE_LAYOUT: flag } },
        document: { body },
    });
    return {
        app: exported.default,
        body,
        desktopApp,
        mobileApp,
        mountedApp,
        mount,
        chooseLayout,
        setNativeTheme,
        writeNativeCssVariables,
        usesWebInferenceRuntime,
        ensureWebModelRestored,
        loadModule,
    };
}

describe("application bootstrap security", () => {
    test("keeps build-time CSP and version injection without loopback telemetry", () => {
        expect(indexHtml).toContain("<%- csp %>");
        expect(indexHtml).toContain("<%- injectScript %>");
        expect(indexHtml).not.toMatch(/<base[^>]+localhost/i);
        expect(indexHtml).not.toContain("127.0.0.1:38291");
        expect(indexHtml).not.toContain("__ocsend");
        expect(indexHtml).not.toContain("/src/main.ts");
    });

    test.each(
        [
            { flag: "v2", narrow: true, layout: "v2" },
            { flag: "v2", narrow: false, layout: "v1" },
            { flag: "v1", narrow: true, layout: "v1" },
            { flag: undefined, narrow: true, layout: "v1" },
        ].flatMap((layout) => [false, true].map((webRuntime) => ({ ...layout, webRuntime }))),
    )(
        "lazily mounts $layout for flag=$flag narrow=$narrow with web runtime=$webRuntime",
        async ({ flag, narrow, layout, webRuntime }) => {
            const result = startBootstrap(flag, narrow, webRuntime);
            expect(result.chooseLayout).toHaveBeenCalledExactlyOnceWith(flag, narrow);
            expect(result.usesWebInferenceRuntime).toHaveBeenCalledExactlyOnceWith();
            expect(result.ensureWebModelRestored).toHaveBeenCalledTimes(webRuntime ? 1 : 0);
            if (webRuntime) expect(result.ensureWebModelRestored).toHaveBeenCalledWith();
            expect(result.setNativeTheme).toHaveBeenCalledTimes(layout === "v2" ? 1 : 0);
            expect(result.writeNativeCssVariables).toHaveBeenCalledTimes(layout === "v1" ? 1 : 0);
            expect(result.mount).not.toHaveBeenCalled();

            // If bootstrap starts awaiting restoration, this stays pending and
            // fails rather than allowing a source-string assertion to pass.
            await expect(result.app).resolves.toBe(result.mountedApp);
            const chosenImport =
                layout === "v2" ? "./components_mobile/App.svelte" : "./components/App.svelte";
            const appImports = result.loadModule.mock.calls
                .map(([name]) => name)
                .filter((name) => name.endsWith("/App.svelte"));
            expect(appImports).toEqual([chosenImport]);
            expect(result.mount).toHaveBeenCalledExactlyOnceWith(
                layout === "v2" ? result.mobileApp : result.desktopApp,
                { target: result.body },
            );
            expect(result.ensureWebModelRestored).toHaveBeenCalledTimes(webRuntime ? 1 : 0);
        },
    );

    test("keeps debug instrumentation out of the entry point", () => {
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
