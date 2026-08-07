// @vitest-environment node

import resolve from "@rollup/plugin-node-resolve";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rollup, type OutputAsset, type OutputChunk } from "rollup";
import { afterEach, describe, expect, it } from "vitest";
import { wasmUrlAsset } from "./rollup-plugin-wasm-url.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) => rm(directory, { recursive: true, force: true })),
    );
});

describe("wasmUrlAsset", () => {
    it("emits Wllama's ?url import byte-for-byte and exports a reachable asset URL", async () => {
        const directory = await mkdtemp(path.join(tmpdir(), "openchat-wasm-url-"));
        temporaryDirectories.push(directory);
        const entry = path.join(directory, "entry.mjs");
        const outputDirectory = path.join(directory, "build");
        await writeFile(
            entry,
            'import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url"; export default wasmUrl;',
        );

        const bundle = await rollup({
            input: entry,
            plugins: [
                wasmUrlAsset(),
                resolve({
                    browser: true,
                    modulePaths: [path.resolve(process.cwd(), "node_modules")],
                }),
            ],
        });
        const result = await bundle.write({
            assetFileNames: "assets/[name]-[hash][extname]",
            dir: outputDirectory,
            entryFileNames: "entry.mjs",
            format: "es",
        });
        await bundle.close();

        const asset = result.output.find(
            (output): output is OutputAsset =>
                output.type === "asset" && output.fileName.endsWith(".wasm"),
        );
        const entryChunk = result.output.find(
            (output): output is OutputChunk => output.type === "chunk" && output.isEntry,
        );
        expect(asset).toBeDefined();
        expect(entryChunk).toBeDefined();

        const packageWasm = path.resolve(
            process.cwd(),
            "node_modules/@wllama/wllama/esm/wasm/wllama.wasm",
        );
        const expectedBytes = await readFile(packageWasm);
        expect(Buffer.compare(Buffer.from(asset!.source), expectedBytes)).toBe(0);
        expect(entryChunk!.code).toContain(asset!.fileName);

        const builtModule = await import(
            `${pathToFileURL(path.join(outputDirectory, entryChunk!.fileName)).href}?test=${Date.now()}`
        );
        const emittedAssetPath = fileURLToPath(builtModule.default as string);
        expect(path.normalize(emittedAssetPath)).toBe(
            path.normalize(path.join(outputDirectory, asset!.fileName)),
        );
        expect(Buffer.compare(await readFile(emittedAssetPath), expectedBytes)).toBe(0);
    });

    it("resolves every Wllama package import used by the production inference module", async () => {
        const inferenceSource = await readFile(
            path.resolve(process.cwd(), "app/src/utils/webInference.ts"),
            "utf8",
        );
        const packageImports = Array.from(
            inferenceSource.matchAll(/(?:from\s+|import\()\s*["'](@wllama\/wllama[^"']*)["']/g),
            (match) => match[1],
        );
        expect(packageImports.length).toBeGreaterThan(0);

        const virtualEntry = "virtual:openchat-wllama-imports";
        const bundle = await rollup({
            input: virtualEntry,
            onwarn(warning, defaultHandler) {
                if (warning.code === "UNRESOLVED_IMPORT") {
                    throw new Error("Unresolved production import: " + warning.message);
                }
                defaultHandler(warning);
            },
            plugins: [
                {
                    name: "wllama-import-fixture",
                    resolveId(id) {
                        return id === virtualEntry ? virtualEntry : null;
                    },
                    load(id) {
                        return id === virtualEntry
                            ? packageImports
                                  .map((specifier) => "import " + JSON.stringify(specifier) + ";")
                                  .join("\n")
                            : null;
                    },
                },
                wasmUrlAsset(),
                resolve({
                    browser: true,
                    modulePaths: [path.resolve(process.cwd(), "node_modules")],
                }),
            ],
        });
        await bundle.generate({ format: "es" });
        await bundle.close();
    });
});
