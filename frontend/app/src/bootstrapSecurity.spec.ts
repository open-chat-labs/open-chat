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
import { resolveDevAllowedHost, resolveLocalDevAllowedHost } from "../devAllowedHost.mjs";
import { resolveDevHmrConfig } from "../devHmr";
import { resolveDevPort } from "../devPort";

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

function startBootstrap(
    flag: string | undefined,
    narrow: boolean,
    webRuntime: boolean,
    options: {
        nativeClient?: boolean;
        prepare?: () => Promise<boolean>;
        failDeferredComponentImports?: boolean;
    } = {},
) {
    const desktopApp = { layout: "v1" };
    const mobileApp = { layout: "v2" };
    const mountedApp = {};
    const startupFailure = { layout: "startup-failure" };
    const body = {};
    const mount = vi.fn(() => mountedApp);
    const chooseLayout = vi.fn(selectLayout);
    const setNativeTheme = vi.fn();
    const writeNativeCssVariables = vi.fn();
    const usesWebInferenceRuntime = vi.fn(() => webRuntime);
    const isNativeClient = vi.fn(() => options.nativeClient ?? true);
    const prepareServiceWorkerBeforeApplicationStart = vi.fn(
        options.prepare ?? (() => Promise.resolve(true)),
    );
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
        "./utils/onDeviceInference": { usesWebInferenceRuntime, isNativeClient },
        "@client/utils/updateSw": { prepareServiceWorkerBeforeApplicationStart },
        "./components_shared/StartupFailure.svelte": { default: startupFailure },
        "./utils/webInference": { ensureWebModelRestored },
        "./components/App.svelte": { default: desktopApp },
        "./components_mobile/App.svelte": { default: mobileApp },
    };
    let bootstrapEvaluated = false;
    const loadModule = vi.fn((name: string) => {
        if (
            bootstrapEvaluated &&
            options.failDeferredComponentImports &&
            name.endsWith(".svelte")
        ) {
            throw new Error("Deferred component chunk is unavailable under the stale controller");
        }
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
        // Mocked browser APIs reject with this realm's Error objects.
        Error,
    });
    bootstrapEvaluated = true;
    return {
        app: exported.default,
        body,
        desktopApp,
        mobileApp,
        mountedApp,
        startupFailure,
        prepareServiceWorkerBeforeApplicationStart,
        isNativeClient,
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
    test("the production compiler includes the same shared ambient declarations as typecheck", () => {
        const rollup = readAppFile("rollup.config.mjs");
        const compiler = rollup.slice(rollup.indexOf("typescript({"), rollup.indexOf("inject({"));
        expect(compiler).toContain('"../global.d.ts"');
        expect(readAppFile("tsconfig.json")).toContain('"../global.d.ts"');
    });

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
        ].flatMap((layout) =>
            [false, true].flatMap((webRuntime) =>
                [false, true].map((nativeClient) => ({ ...layout, webRuntime, nativeClient })),
            ),
        ),
    )(
        "lazily mounts $layout for flag=$flag narrow=$narrow with web runtime=$webRuntime native=$nativeClient",
        async ({ flag, narrow, layout, webRuntime, nativeClient }) => {
            const result = startBootstrap(flag, narrow, webRuntime, { nativeClient });
            expect(result.mount).not.toHaveBeenCalled();
            // Restoration deliberately never settles: neither browser preparation nor lazy imports
            // may accidentally make the application await the model runtime.
            await expect(result.app).resolves.toBe(result.mountedApp);
            expect(result.prepareServiceWorkerBeforeApplicationStart).toHaveBeenCalledTimes(
                nativeClient ? 0 : 1,
            );
            expect(result.chooseLayout).toHaveBeenCalledExactlyOnceWith(flag, narrow);
            expect(result.usesWebInferenceRuntime).toHaveBeenCalledExactlyOnceWith();
            expect(result.ensureWebModelRestored).toHaveBeenCalledTimes(webRuntime ? 1 : 0);
            if (webRuntime) expect(result.ensureWebModelRestored).toHaveBeenCalledWith();
            expect(result.setNativeTheme).toHaveBeenCalledTimes(layout === "v2" ? 1 : 0);
            expect(result.writeNativeCssVariables).toHaveBeenCalledTimes(layout === "v1" ? 1 : 0);
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

    test("browser startup waits for worker preparation before loading either app tree", async () => {
        let finishPreparation!: (ready: boolean) => void;
        const preparation = new Promise<boolean>((resolve) => {
            finishPreparation = resolve;
        });
        const result = startBootstrap("v2", true, true, {
            nativeClient: false,
            prepare: () => preparation,
        });
        expect(result.prepareServiceWorkerBeforeApplicationStart).toHaveBeenCalledOnce();
        expect(result.chooseLayout).not.toHaveBeenCalled();
        expect(result.ensureWebModelRestored).not.toHaveBeenCalled();
        expect(result.mount).not.toHaveBeenCalled();
        expect(result.loadModule.mock.calls.some(([name]) => name.endsWith("/App.svelte"))).toBe(
            false,
        );
        finishPreparation(true);
        await expect(result.app).resolves.toBe(result.mountedApp);
        expect(result.chooseLayout).toHaveBeenCalledExactlyOnceWith("v2", true);
        expect(result.ensureWebModelRestored).toHaveBeenCalledOnce();
    });

    test("a browser worker navigation stops this startup without mounting or restoring a model", async () => {
        const result = startBootstrap("v2", true, true, {
            nativeClient: false,
            prepare: () => Promise.resolve(false),
        });
        await expect(result.app).resolves.toBeUndefined();
        expect(result.mount).not.toHaveBeenCalled();
        expect(result.chooseLayout).not.toHaveBeenCalled();
        expect(result.ensureWebModelRestored).not.toHaveBeenCalled();
    });

    test("worker preparation failure mounts recovery instead of either application", async () => {
        const result = startBootstrap("v2", true, true, {
            nativeClient: false,
            prepare: () => Promise.reject(new Error("worker preparation failed")),
        });
        await expect(result.app).resolves.toBe(result.mountedApp);
        expect(result.mount).toHaveBeenCalledExactlyOnceWith(result.startupFailure, {
            target: result.body,
            props: { message: "worker preparation failed", recovery: "new-tab" },
        });
        expect(result.chooseLayout).not.toHaveBeenCalled();
        expect(result.ensureWebModelRestored).not.toHaveBeenCalled();
        expect(result.loadModule.mock.calls.some(([name]) => name.endsWith("/App.svelte"))).toBe(
            false,
        );
    });

    test("recovery remains available when the stale controller cannot load deferred component chunks", async () => {
        const result = startBootstrap("v2", true, true, {
            nativeClient: false,
            prepare: () => Promise.reject(new Error("worker preparation failed")),
            failDeferredComponentImports: true,
        });
        await expect(result.app).resolves.toBe(result.mountedApp);
        expect(result.mount).toHaveBeenCalledExactlyOnceWith(result.startupFailure, {
            target: result.body,
            props: { message: "worker preparation failed", recovery: "new-tab" },
        });
        expect(result.chooseLayout).not.toHaveBeenCalled();
        expect(result.ensureWebModelRestored).not.toHaveBeenCalled();
        const recoveryImport = result.loadModule.mock.calls.findIndex(
            ([name]) => name === "./components_shared/StartupFailure.svelte",
        );
        expect(recoveryImport).toBeGreaterThanOrEqual(0);
        expect(result.loadModule.mock.invocationCallOrder[recoveryImport]).toBeLessThan(
            result.prepareServiceWorkerBeforeApplicationStart.mock.invocationCallOrder[0],
        );
        expect(result.loadModule.mock.calls.some(([name]) => name.endsWith("/App.svelte"))).toBe(
            false,
        );
    });

    test("native startup never invokes browser service-worker maintenance", async () => {
        const result = startBootstrap("v2", true, true, {
            nativeClient: true,
            prepare: () => {
                throw new Error("browser-only API");
            },
        });
        await expect(result.app).resolves.toBe(result.mountedApp);
        expect(result.prepareServiceWorkerBeforeApplicationStart).not.toHaveBeenCalled();
        expect(result.mount).toHaveBeenCalledExactlyOnceWith(result.mobileApp, {
            target: result.body,
        });
    });

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

    test("uses one configurable port for the dev listener and HMR client", () => {
        expect(resolveDevPort(undefined)).toBe(5001);
        expect(resolveDevPort("5003")).toBe(5003);
        for (const invalid of ["", "0", "65536", "5003.5", "not-a-port", " 5003 "]) {
            expect(() => resolveDevPort(invalid)).toThrow("OC_DEV_PORT must be a valid TCP port");
        }
        expect(viteConfig).toContain("resolveDevPort(process.env.OC_DEV_PORT)");
        expect(viteConfig).toMatch(/server:\s*\{[\s\S]*?\bport,[\s\S]*?strictPort/);
        expect(resolveDevHmrConfig(5003, undefined)).toEqual({
            protocol: "ws",
            port: 5003,
            clientPort: 5003,
        });
        expect(resolveDevHmrConfig(5003, "openchat-dev.example.ts.net")).toEqual({
            protocol: "wss",
            host: "openchat-dev.example.ts.net",
            port: 5003,
            clientPort: 443,
        });
        expect(viteConfig).toContain("resolveDevHmrConfig(port, devAllowedHost)");
        expect(viteConfig).toContain("hmr: devHmr");
        expect(viteConfig).toContain("strictPort: true");
    });

    test("allows only one explicitly configured development proxy hostname", () => {
        expect(resolveDevAllowedHost(undefined)).toBeUndefined();
        expect(resolveDevAllowedHost("openchat-dev.example.ts.net")).toBe(
            "openchat-dev.example.ts.net",
        );
        expect(resolveDevAllowedHost("OPENCHAT-DEV.EXAMPLE.TS.NET")).toBe(
            "openchat-dev.example.ts.net",
        );
        expect(
            resolveLocalDevAllowedHost("development", "local", "OPENCHAT-DEV.EXAMPLE.TS.NET"),
        ).toBe("openchat-dev.example.ts.net");
        expect(
            resolveLocalDevAllowedHost("production", "local", "openchat-dev.example.ts.net"),
        ).toBeUndefined();
        expect(
            resolveLocalDevAllowedHost("development", "ic", "openchat-dev.example.ts.net"),
        ).toBeUndefined();
        for (const invalid of [
            " openchat-dev.example.ts.net",
            "https://openchat-dev.example.ts.net",
            "openchat-dev.example.ts.net:443",
            "openchat-dev.example.ts.net/path",
            ".example.ts.net",
            "example..ts.net",
        ]) {
            expect(() => resolveDevAllowedHost(invalid)).toThrow("OC_DEV_ALLOWED_HOST");
        }
        expect(viteConfig).toContain("resolveLocalDevAllowedHost(");
        expect(viteConfig).toContain('"import.meta.env.OC_DEV_ALLOWED_HOST"');
        expect(viteConfig).toContain('allowedHosts: ["host.docker.internal"');
        expect(viteConfig).not.toContain("allowedHosts: true");
    });

    test("keeps Svelte component dependencies on the application's initialized runtime", () => {
        const exclusionList = /optimizeDeps:\s*\{[\s\S]*?exclude:\s*\[([^\]]*)\]/.exec(
            viteConfig,
        )?.[1];
        expect(exclusionList).toBeDefined();
        const excludedPackages = Array.from(
            exclusionList?.matchAll(/["']([^"']+)["']/g) ?? [],
            ([, packageName]) => packageName,
        );
        expect(excludedPackages).toEqual(
            expect.arrayContaining(["component-lib", "svelte-material-icons"]),
        );
    });

    test("rewrites the external development host before proxying replica API calls", () => {
        expect(viteConfig).toMatch(
            /"\/api":\s*\{[\s\S]*?target:\s*`http:\/\/\$\{dfxJson\.networks\.local\.bind\}`,[\s\S]*?changeOrigin:\s*true/,
        );
        expect(viteConfig).toContain('proxyRequest.removeHeader("x-forwarded-host")');
        expect(viteConfig).toContain('proxyRequest.removeHeader("x-forwarded-port")');
        expect(viteConfig).toContain('proxyRequest.removeHeader("forwarded")');
    });
});
