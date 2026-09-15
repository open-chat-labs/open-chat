// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileFunction } from "node:vm";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { loadConfigFromFile } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createTransformersWebGpuDevRuntimeVersion,
    TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META,
} from "./transformersWebGpuDevRuntimeVersion";

const APP_DIR = path.resolve(import.meta.dirname, "../..");
const source = fs.readFileSync(path.join(APP_DIR, "vite.config.ts"), "utf8");
const pluginStart = source.indexOf("function ocWorkerPlugin(): Plugin {");
const pluginEnd = source.indexOf("// TODO use vite for prod build!", pluginStart);
if (pluginStart < 0 || pluginEnd < 0)
    throw new Error("The real worker build plugin was not found.");
const pluginCode = transpileModule(source.slice(pluginStart, pluginEnd), {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
}).outputText;

const targetsStart = source.indexOf("const workerEntry =");
const targetsEnd = source.indexOf("const TRANSFORMERS_WEBGPU_ASSET_PREFIX", targetsStart);
if (targetsStart < 0 || targetsEnd < 0) throw new Error("The real worker targets were not found.");
const targetsCode = transpileModule(source.slice(targetsStart, targetsEnd), {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
}).outputText;
type WorkerTarget = { entry: string; fileName: string; sequentialWebGpuSessions: boolean };
const realWorkerTargets = compileFunction(
    `const { path, __dirname, enabled } = context;
    const transformersWebGpuFeatureEnabled = () => enabled;
    ${targetsCode}
    return workerTargets;`,
    ["context"],
) as (context: Record<string, unknown>) => WorkerTarget[];

type WorkerBuildOptions = {
    plugins: Array<{ name: string }>;
    build: { outDir: string; lib: { fileName(): string } };
};
type WorkerPlugin = {
    configureServer(server: Record<string, unknown>): Promise<void>;
    transformIndexHtml(): Array<{ attrs: { content: string } }>;
};
const makePlugin = compileFunction(
    `const { build, path, __dirname, workerTargets, workerBuildDir,
        transformersWebGpuOrtJspiAlias, ocPackageAliases, devTransformersWebGpuRuntimeVersion,
        TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META, transformersWebGpuSpikeEnabled,
        transformersWebGpuSequentialSessionsPlugin, transformersWebGpuOrtSessionConfigPlugin,
        chokidar, fs } = context;
    ${pluginCode}
    return ocWorkerPlugin();`,
    ["context"],
) as (context: Record<string, unknown>) => WorkerPlugin;

const temporaryDirectories: string[] = [];
afterEach(() => {
    vi.useRealTimers();
    for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

async function harness() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "openchat-worker-build-"));
    temporaryDirectories.push(directory);
    const helper = path.join(directory, "src/utils/transformersWebGpuQwenContext.ts");
    const workerBuildDir = path.join(directory, "node_modules/.oc-worker");
    const runtime = createTransformersWebGpuDevRuntimeVersion("1000.0.test");
    const handlers = new Map<string, () => void>();
    let watched: string[] = [];
    const watcher = {
        on: vi.fn((event: string, callback: () => void) => {
            handlers.set(event, callback);
            return watcher;
        }),
        close: vi.fn(),
    };
    let failNextBuild: boolean | string = false;
    const build = vi.fn(async (options: WorkerBuildOptions) => {
        if (failNextBuild === true || failNextBuild === options.build.lib.fileName()) {
            failNextBuild = false;
            throw new Error("controlled worker build failure");
        }
        fs.mkdirSync(options.build.outDir, { recursive: true });
        fs.writeFileSync(
            path.join(options.build.outDir, options.build.lib.fileName()),
            "// generated worker fixture\n",
        );
    });
    const send = vi.fn();
    const error = vi.fn();
    const plugin = makePlugin({
        build,
        path,
        transformersWebGpuSequentialSessionsPlugin: () => ({ name: "sequential-sessions" }),
        transformersWebGpuOrtSessionConfigPlugin: () => ({ name: "early-int64-config" }),
        __dirname: directory,
        workerTargets: realWorkerTargets({ path, __dirname: directory, enabled: true }),
        workerBuildDir,
        transformersWebGpuOrtJspiAlias: {
            find: "onnxruntime-web/webgpu",
            replacement: "onnxruntime-web/jspi",
        },
        ocPackageAliases: [],
        devTransformersWebGpuRuntimeVersion: runtime,
        TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META,
        transformersWebGpuSpikeEnabled: true,
        chokidar: {
            watch: (paths: string[]) => {
                watched = paths;
                return watcher;
            },
        },
        fs,
    });
    await plugin.configureServer({
        middlewares: { use: vi.fn() },
        ws: { send },
        config: { logger: { error } },
        httpServer: undefined,
    });
    vi.useFakeTimers();
    const isWatched = (file: string) =>
        watched.some((entry) => file === entry || file.startsWith(`${entry}${path.sep}`));
    const change = async (file: string) => {
        if (isWatched(file)) handlers.get("change")?.();
        await vi.advanceTimersByTimeAsync(151);
    };
    return {
        directory,
        helper,
        workerBuildDir,
        runtime,
        plugin,
        build,
        modelBuilds: () =>
            build.mock.calls.filter(
                ([options]) => options.build.lib.fileName() === "transformers_webgpu_worker.js",
            ),
        send,
        error,
        watched,
        isWatched,
        change,
        failNext: (fileName?: string) => {
            failNextBuild = fileName ?? true;
        },
    };
}

describe("development model worker build dependency closure", () => {
    it("retains the video worker independently of the optional model worker in both build paths", () => {
        const rollup = fs.readFileSync(path.join(APP_DIR, "rollup.config.mjs"), "utf8");
        expect(rollup).toContain('src: "../openchat-worker/lib/transcode_worker.js*"');
        const production = fs.readFileSync(path.join(APP_DIR, "build-workers.mjs"), "utf8");
        const start = production.indexOf("const targets =");
        const end = production.indexOf("for (const target of targets)", start);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);
        const productionTargets = compileFunction(
            `${production.slice(start, end)}; return targets;`,
            ["transformersWebGpuSpikeEnabled"],
        ) as (enabled: boolean) => WorkerTarget[];
        for (const enabled of [false, true]) {
            const dev = realWorkerTargets({ path, __dirname: APP_DIR, enabled });
            const prod = productionTargets(enabled);
            for (const targets of [dev, prod]) {
                expect(targets.filter(({ fileName }) => fileName === "worker.js")).toHaveLength(1);
                expect(
                    targets.filter(({ fileName }) => fileName === "transcode_worker.js"),
                ).toEqual([expect.objectContaining({ sequentialWebGpuSessions: false })]);
                expect(
                    targets.filter(({ sequentialWebGpuSessions }) => sequentialWebGpuSessions),
                ).toEqual(
                    enabled
                        ? [expect.objectContaining({ fileName: "transformers_webgpu_worker.js" })]
                        : [],
                );
            }
            expect(prod.map(({ fileName }) => fileName).sort()).toEqual(
                [...dev.map(({ fileName }) => fileName), "service_worker.js"].sort(),
            );
        }
    });

    it("does not advance the model runtime when video worker generation fails", async () => {
        const test = await harness();
        const generation = test.runtime.current();
        test.failNext("transcode_worker.js");
        await test.change(
            path.resolve(test.directory, "../openchat-worker/src/transcodeWorker.ts"),
        );
        await vi.waitFor(() => expect(test.error).toHaveBeenCalledTimes(1));
        expect(test.runtime.current()).toBe(generation);
        expect(test.send).not.toHaveBeenCalled();
        await test.change(test.helper);
        await vi.waitFor(() => expect(test.send).toHaveBeenCalledTimes(1));
        expect(test.runtime.current()).toBe("1000.0.test.webgpu.2");
        for (const [options] of test.build.mock.calls) {
            if (options.build.lib.fileName() !== "transformers_webgpu_worker.js") {
                expect(options.plugins).toEqual([]);
            }
        }
    });

    it("rebuilds and rotates the runtime for every generic helper without watching generated outputs", async () => {
        const test = await harness();
        const helperFiles = [
            "src/utils/gemma4WebGpuEmbedding.ts",
            "src/utils/imageDimensions.ts",
            "src/utils/transformersWebGpuAudio.ts",
            "src/utils/transformersWebGpuDeviceRetirement.ts",
            "src/utils/transformersWebGpuImageLayout.ts",
            "src/utils/transformersWebGpuQwenContext.ts",
            "src/utils/transformersWebGpuCompletion.ts",
            "src/utils/transformersWebGpuOrtDiagnostics.ts",
            "src/utils/transformersWebGpuPipelineCompilation.ts",
            "src/utils/transformersWebGpuProcessorConfig.ts",
            "src/utils/transformersWebGpuProtocol.ts",
        ];
        for (const [index, relative] of helperFiles.entries()) {
            const file = path.join(test.directory, relative);
            expect(test.isWatched(file), relative).toBe(true);
            await test.change(file);
            await vi.waitFor(() => expect(test.send).toHaveBeenCalledTimes(index + 1));
            expect(test.runtime.current()).toBe(`1000.0.test.webgpu.${index + 2}`);
            expect(test.plugin.transformIndexHtml()[0].attrs.content).toBe(test.runtime.current());
        }
        expect(test.build).toHaveBeenCalledTimes(3 * (helperFiles.length + 1));
        for (const file of [
            path.join(test.directory, "transformersWebGpuSequentialSessions.mjs"),
            path.join(test.directory, "transformersWebGpuOrtSessionConfig.mjs"),
            path.join(test.workerBuildDir, "transformers_webgpu_worker.js"),
            path.join(test.workerBuildDir, "transformers_webgpu_worker.js.map"),
            path.join(test.directory, "../openchat-worker/lib/worker.js"),
        ]) {
            expect(test.isWatched(file)).toBe(false);
            await test.change(file);
        }
        expect(test.build).toHaveBeenCalledTimes(3 * (helperFiles.length + 1));
        expect(test.error).not.toHaveBeenCalled();
    });

    it("uses both build transforms only for the model worker in development and production", async () => {
        const test = await harness();
        const check = (options: WorkerBuildOptions) =>
            expect(options.plugins).toEqual(
                options.build.lib.fileName() === "transformers_webgpu_worker.js"
                    ? [{ name: "sequential-sessions" }, { name: "early-int64-config" }]
                    : [],
            );
        for (const [options] of test.build.mock.calls) check(options);
        const production = fs.readFileSync(path.join(APP_DIR, "build-workers.mjs"), "utf8");
        const start = production.indexOf("const targets =");
        expect(start).toBeGreaterThan(0);
        const run = compileFunction(
            `const { path, __dirname, build, transformersWebGpuSpikeEnabled,
                transformersWebGpuSequentialSessionsPlugin, transformersWebGpuOrtSessionConfigPlugin,
                transformersWebGpuOrtJspiAlias, ocPackageAliases } = context;
            return (async () => { ${production.slice(start)} })();`,
            ["context"],
        );
        for (const enabled of [false, true]) {
            const build = vi.fn(async (options: WorkerBuildOptions) => check(options));
            await run({
                path,
                __dirname: APP_DIR,
                build,
                transformersWebGpuSpikeEnabled: enabled,
                transformersWebGpuSequentialSessionsPlugin: () => ({ name: "sequential-sessions" }),
                transformersWebGpuOrtSessionConfigPlugin: () => ({ name: "early-int64-config" }),
                transformersWebGpuOrtJspiAlias: {},
                ocPackageAliases: [],
            });
            expect(build).toHaveBeenCalledTimes(enabled ? 4 : 3);
        }
    });

    it("reloads transitive statically imported config helpers after edits and a failed reload", async () => {
        // These real imports give Vite ownership of build-helper restart/freshness; the separate
        // runtime-source watcher must not pretend query-busting a parent invalidates its children.
        for (const module of [
            "transformersWebGpuSequentialSessions",
            "transformersWebGpuOrtSessionConfig",
        ]) {
            expect(source).toContain(`from "./${module}.mjs"`);
        }
        expect(source).not.toContain("?worker-build=");
        expect(source).not.toContain("buildAttempt");
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "openchat-config-freshness-"));
        temporaryDirectories.push(directory);
        const config = path.join(directory, "vite.config.mjs");
        const parent = path.join(directory, "parent.mjs");
        const leaf = path.join(directory, "leaf.mjs");
        fs.writeFileSync(
            config,
            `import { factory } from './parent.mjs'; export default { define: factory() };`,
        );
        fs.writeFileSync(
            parent,
            `import { createRequire } from 'node:module';
            import path from 'node:path'; import { leaf } from './leaf.mjs';
            const marker = createRequire(import.meta.url)(path.join(import.meta.dirname, 'marker.cjs'));
            export function factory() { return { value: leaf(), embedded: leaf.toString(), marker,
                sourceUrl: import.meta.url, sourceDir: import.meta.dirname }; }`,
        );
        fs.writeFileSync(
            path.join(directory, "marker.cjs"),
            `module.exports = 'source-relative-ok';`,
        );
        const writeLeaf = (value: string) =>
            fs.writeFileSync(leaf, `export function leaf() { return ${JSON.stringify(value)}; }`);
        const load = () =>
            loadConfigFromFile(
                { command: "serve", mode: "development" },
                config,
                directory,
                "silent",
            );
        const check = async (value: string) => {
            const result = await load();
            expect(result).not.toBeNull();
            expect(result!.config.define).toMatchObject({
                value,
                marker: "source-relative-ok",
                sourceUrl: pathToFileURL(parent).href,
                sourceDir: directory,
            });
            expect(result!.config.define!.embedded).toContain(JSON.stringify(value));
            expect(result!.dependencies.map((file) => path.resolve(file)).sort()).toEqual(
                [config, parent, leaf].sort(),
            );
        };
        writeLeaf("initial");
        await check("initial");
        writeLeaf("updated");
        await check("updated");
        fs.writeFileSync(leaf, "export function {");
        await expect(load()).rejects.toThrow();
        writeLeaf("corrected");
        await check("corrected");
    });
});
