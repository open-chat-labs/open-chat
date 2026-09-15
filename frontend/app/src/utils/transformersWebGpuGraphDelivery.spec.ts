// @vitest-environment node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { compileFunction } from "node:vm";
import {
    createSourceFile,
    isFunctionDeclaration,
    isIdentifier,
    isTypeAliasDeclaration,
    isVariableStatement,
    transpileModule,
    ScriptTarget,
    ModuleKind,
} from "typescript";
import { describe, expect, it, vi } from "vitest";
import { patchQwen3Vl2bDecoderGraph } from "../../transformersWebGpuDecoderGraph.mjs";
import {
    patchQwen3Vl2bDeepStackDecoderGraph,
    patchQwen3Vl2bDeepStackVisionGraph,
} from "../../transformersWebGpuDeepStackGraph.mjs";
import {
    patchQwen3Vl2bGenerationGraph,
    QWEN3_VL_2B_GENERATION_BYTES,
    QWEN3_VL_2B_GENERATION_SHA256,
} from "../../transformersWebGpuQwenGenerationGraph.mjs";
import {
    patchQwen3Vl2bVisionGeometryGraph,
    QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
    QWEN3_VL_2B_VISION_GEOMETRY_SHA256,
} from "../../transformersWebGpuQwenVisionGraph.mjs";
import { TRANSFORMERS_QWEN_ARTIFACTS } from "./transformersWebGpuProtocol";

const app = path.resolve(import.meta.dirname, "../..");
const config = fs.readFileSync(path.join(app, "vite.config.ts"), "utf8");
const parsedConfig = createSourceFile("vite.config.ts", config, ScriptTarget.ES2022, true);
const requiredDeclarations = new Set([
    "QWEN3_VL_2B_MODEL_ROUTE_PREFIX",
    "Qwen3Vl2bModelOverride",
    "qwen3Vl2bModelOverrides",
    "qwen3Vl2bModelOverridesPlugin",
]);
const selectedDeclarations = parsedConfig.statements.filter((statement) => {
    const names = isVariableStatement(statement)
        ? statement.declarationList.declarations.flatMap((declaration) =>
              isIdentifier(declaration.name) ? [declaration.name.text] : [],
          )
        : (isFunctionDeclaration(statement) || isTypeAliasDeclaration(statement)) && statement.name
          ? [statement.name.text]
          : [];
    return names.some((name) => requiredDeclarations.delete(name));
});
if (requiredDeclarations.size !== 0) {
    throw new Error("The real model graph delivery implementation was not found.");
}
const code = transpileModule(
    selectedDeclarations.map((statement) => statement.getText(parsedConfig)).join("\n"),
    { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext } },
).outputText;
type Reply = {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: Uint8Array | string): void;
};
type Middleware = (
    request: { method: string; url: string },
    reply: Reply,
    next: () => void,
) => void;
function harness(failRead = false) {
    const read = vi.fn((file: string) => {
        const bytes = fs.readFileSync(file);
        if (failRead) bytes[bytes.length - 1] ^= 1;
        return bytes;
    });
    const make = compileFunction(
        `const { path, __dirname, fs, patchQwen3Vl2bDecoderGraph,
            patchQwen3Vl2bDeepStackDecoderGraph, patchQwen3Vl2bDeepStackVisionGraph,
            patchQwen3Vl2bGenerationGraph, patchQwen3Vl2bVisionGeometryGraph,
            QWEN3_VL_2B_GENERATION_BYTES, QWEN3_VL_2B_VISION_GEOMETRY_BYTES } = context;
        const transformersWebGpuSpikeEnabled = true;
        ${code}
        return qwen3Vl2bModelOverridesPlugin();`,
        ["context"],
    );
    let middleware: Middleware | undefined;
    const errors = vi.fn();
    make({
        path,
        __dirname: app,
        fs: { ...fs, readFileSync: read },
        patchQwen3Vl2bDecoderGraph,
        patchQwen3Vl2bDeepStackDecoderGraph,
        patchQwen3Vl2bDeepStackVisionGraph,
        patchQwen3Vl2bGenerationGraph,
        patchQwen3Vl2bVisionGeometryGraph,
        QWEN3_VL_2B_GENERATION_BYTES,
        QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
    }).configureServer({
        middlewares: {
            use(callback: Middleware) {
                middleware = callback;
            },
        },
        config: { logger: { error: errors } },
    });
    return {
        read,
        errors,
        request(name: string, method = "GET") {
            const headers = new Map<string, string>();
            let body: Uint8Array | string | undefined;
            const reply: Reply = {
                statusCode: 200,
                setHeader(key, value) {
                    headers.set(key.toLowerCase(), value);
                },
                end(value) {
                    body = value;
                },
            };
            const next = vi.fn();
            middleware!(
                {
                    method,
                    url:
                        "/hf-model/onnx-community/Qwen3-VL-2B-Instruct-ONNX/resolve/3e4136ea66ae6e07c110e64fe07da2e029517ab5/onnx/" +
                        name,
                },
                reply,
                next,
            );
            return { status: reply.statusCode, headers, body, next };
        },
    };
}
describe("Actual development graph delivery", () => {
    it.each([
        ["vision_encoder_q4.onnx", "decoder_model_merged_q4.onnx"],
        ["decoder_model_merged_q4.onnx", "vision_encoder_q4.onnx"],
    ])("keeps distinct transformed graph caches when %s is served before %s", (first, second) => {
        const server = harness();
        for (const name of [first, second, first, second]) {
            const expected = TRANSFORMERS_QWEN_ARTIFACTS.find(
                (file) => file.path === "onnx/" + name,
            )!;
            const result = server.request(name);
            expect(result.status).toBe(200);
            expect(result.next).not.toHaveBeenCalled();
            expect(result.body).toBeInstanceOf(Uint8Array);
            const bytes = result.body as Uint8Array;
            expect(bytes.byteLength).toBe(expected.bytes);
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected.sha256);
            expect(result.headers.get("content-length")).toBe(String(expected.bytes));
        }
        expect(server.read).toHaveBeenCalledTimes(2);
        expect(server.errors).not.toHaveBeenCalled();
    });
    it("HEAD has the delivered byte count without a response body", () => {
        const server = harness();
        const head = server.request("vision_encoder_q4.onnx", "HEAD");
        expect(head.status).toBe(200);
        expect(head.headers.get("content-length")).toBe(String(QWEN3_VL_2B_VISION_GEOMETRY_BYTES));
        expect(head.body).toBeUndefined();
        server.request("vision_encoder_q4.onnx");
        expect(server.read).toHaveBeenCalledOnce();
    });
    it("fails closed on source drift without retaining a failed transform", () => {
        const server = harness(true);
        for (let attempt = 0; attempt < 2; attempt++) {
            const result = server.request("vision_encoder_q4.onnx");
            expect(result.status).toBe(503);
            expect(result.body).toBe("pinned model transform failed");
        }
        expect(server.read).toHaveBeenCalledTimes(2);
    });
});

describe("Actual packaged graph delivery", () => {
    it("emits the same generation-only decoder and complete vision graphs as development", () => {
        const rollup = fs.readFileSync(path.join(app, "rollup.config.mjs"), "utf8");
        const start = rollup.indexOf("const graphDir =");
        const end = rollup.indexOf("\n        },", start);
        expect(start).toBeGreaterThan(0);
        expect(end).toBeGreaterThan(start);
        expect(rollup.indexOf("const graphDir =", start + 1)).toBe(-1);
        // Execute only the actual graph-emission branch: no Rollup build or runtime asset copies.
        const emit = compileFunction(
            `const { path, __dirname, fs, createHash,
                patchQwen3Vl2bDecoderGraph, patchQwen3Vl2bDeepStackDecoderGraph,
                patchQwen3Vl2bDeepStackVisionGraph, patchQwen3Vl2bGenerationGraph,
                patchQwen3Vl2bVisionGeometryGraph, QWEN3_VL_2B_GENERATION_BYTES,
                QWEN3_VL_2B_VISION_GEOMETRY_BYTES, QWEN3_VL_2B_GENERATION_SHA256,
                QWEN3_VL_2B_VISION_GEOMETRY_SHA256 } = context;
            ${rollup.slice(start, end)}`,
            ["context"],
        );
        const assets: Array<{ type: string; fileName: string; source: Uint8Array }> = [];
        emit.call(
            { emitFile: (asset: (typeof assets)[number]) => assets.push(asset) },
            {
                path,
                __dirname: app,
                fs,
                createHash,
                // No catalog supplied: packaged adapter assets must survive model removal.
                QWEN3_VL_2B_GENERATION_SHA256,
                QWEN3_VL_2B_VISION_GEOMETRY_SHA256,
                patchQwen3Vl2bDecoderGraph,
                patchQwen3Vl2bDeepStackDecoderGraph,
                patchQwen3Vl2bDeepStackVisionGraph,
                patchQwen3Vl2bGenerationGraph,
                patchQwen3Vl2bVisionGeometryGraph,
                QWEN3_VL_2B_GENERATION_BYTES,
                QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
            },
        );
        expect(assets).toHaveLength(2);
        const server = harness();
        for (const asset of assets) {
            const name = path.basename(asset.fileName);
            const manifest = TRANSFORMERS_QWEN_ARTIFACTS.find(
                (entry) => entry.path === `onnx/${name}`,
            )!;
            expect(asset.type).toBe("asset");
            expect(asset.source.byteLength).toBe(manifest.bytes);
            expect(createHash("sha256").update(asset.source).digest("hex")).toBe(manifest.sha256);
            expect(
                Buffer.compare(
                    Buffer.from(asset.source),
                    Buffer.from(server.request(name).body as Uint8Array),
                ),
            ).toBe(0);
        }
    });
});
