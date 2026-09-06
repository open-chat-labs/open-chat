import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileFunction, constants } from "node:vm";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
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

type WorkerBuildOptions = {
    plugins: Array<{ name: string }>;
    build: { outDir: string; lib: { fileName(): string } };
};
type WorkerPlugin = {
    configureServer(server: Record<string, unknown>): Promise<void>;
    transformIndexHtml(): Array<{ attrs: { content: string } }>;
};
const makePlugin = compileFunction(
    `const { build, path, pathToFileURL, __dirname, workerTargets, workerBuildDir,
        transformersWebGpuOrtJspiAlias, ocPackageAliases, devTransformersWebGpuRuntimeVersion,
        TRANSFORMERS_WEBGPU_DEV_RUNTIME_VERSION_META, transformersWebGpuSpikeEnabled,
        chokidar, fs } = context;
    ${pluginCode}
    return ocWorkerPlugin();`,
    ["context"],
    { importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER },
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
    const helper = path.join(directory, "transformersWebGpuSequentialSessions.mjs");
    const writeHelper = (version: string) =>
        fs.writeFileSync(
            helper,
            `export function transformersWebGpuSequentialSessionsPlugin() { return { name: ${JSON.stringify(version)} }; }`,
        );
    writeHelper("initial-transform");
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
    let failNextBuild = false;
    const build = vi.fn(async (options: WorkerBuildOptions) => {
        if (failNextBuild) {
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
        pathToFileURL,
        __dirname: directory,
        workerTargets: [
            { entry: "worker.ts", fileName: "worker.js", sequentialWebGpuSessions: false },
            {
                entry: "model.ts",
                fileName: "transformers_webgpu_worker.js",
                sequentialWebGpuSessions: true,
            },
        ],
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
        writeHelper,
        workerBuildDir,
        runtime,
        plugin,
        build,
        send,
        error,
        watched,
        isWatched,
        change,
        failNext: () => {
            failNextBuild = true;
        },
    };
}

describe("development model worker build dependency closure", () => {
    it("rebuilds and rotates the runtime for every generic helper without watching generated outputs", async () => {
        const test = await harness();
        const helperFiles = [
            "src/utils/gemma4WebGpuEmbedding.ts",
            "src/utils/imageDimensions.ts",
            "src/utils/transformersWebGpuAudio.ts",
            "src/utils/transformersWebGpuDeviceRetirement.ts",
            "src/utils/transformersWebGpuImageLayout.ts",
            "src/utils/transformersWebGpuOrtDiagnostics.ts",
            "src/utils/transformersWebGpuPipelineCompilation.ts",
            "src/utils/transformersWebGpuProcessorConfig.ts",
            "src/utils/transformersWebGpuProtocol.ts",
            "transformersWebGpuSequentialSessions.mjs",
        ];
        for (const [index, relative] of helperFiles.entries()) {
            const file = path.join(test.directory, relative);
            expect(test.isWatched(file), relative).toBe(true);
            await test.change(file);
            await vi.waitFor(() => expect(test.send).toHaveBeenCalledTimes(index + 1));
            expect(test.runtime.current()).toBe(`1000.0.test.webgpu.${index + 2}`);
            expect(test.plugin.transformIndexHtml()[0].attrs.content).toBe(test.runtime.current());
        }
        expect(test.build).toHaveBeenCalledTimes(2 * (helperFiles.length + 1));
        for (const file of [
            path.join(test.workerBuildDir, "transformers_webgpu_worker.js"),
            path.join(test.workerBuildDir, "transformers_webgpu_worker.js.map"),
            path.join(test.directory, "../openchat-worker/lib/worker.js"),
        ]) {
            expect(test.isWatched(file)).toBe(false);
            await test.change(file);
        }
        expect(test.build).toHaveBeenCalledTimes(2 * (helperFiles.length + 1));
        expect(test.error).not.toHaveBeenCalled();
    });

    it("uses newly edited transform code after success and after a failed attempt", async () => {
        const test = await harness();
        expect(test.build.mock.calls[1][0].plugins[0].name).toBe("initial-transform");
        test.writeHelper("updated-transform");
        await test.change(test.helper);
        await vi.waitFor(() => expect(test.send).toHaveBeenCalledTimes(1));
        expect(test.build.mock.calls[3][0].plugins[0].name).toBe("updated-transform");
        const successfulGeneration = test.runtime.current();

        test.writeHelper("failed-attempt-transform");
        test.failNext();
        await test.change(test.helper);
        await vi.waitFor(() => expect(test.error).toHaveBeenCalledTimes(1));
        expect(test.runtime.current()).toBe(successfulGeneration);
        expect(test.send).toHaveBeenCalledTimes(1);

        test.writeHelper("retry-transform");
        await test.change(test.helper);
        await vi.waitFor(() => expect(test.send).toHaveBeenCalledTimes(2));
        expect(test.build.mock.calls.at(-1)?.[0].plugins[0].name).toBe("retry-transform");
        expect(test.runtime.current()).toBe("1000.0.test.webgpu.3");

        fs.writeFileSync(test.helper, "export function {");
        await test.change(test.helper);
        await vi.waitFor(() => expect(test.error).toHaveBeenCalledTimes(2));
        expect(test.runtime.current()).toBe("1000.0.test.webgpu.3");
        expect(test.send).toHaveBeenCalledTimes(2);
        test.writeHelper("syntax-retry-transform");
        await test.change(test.helper);
        await vi.waitFor(() => expect(test.send).toHaveBeenCalledTimes(3));
        expect(test.build.mock.calls.at(-1)?.[0].plugins[0].name).toBe("syntax-retry-transform");
        expect(test.runtime.current()).toBe("1000.0.test.webgpu.4");
    });
});
