import catalog from "../../public/model-catalog.json";
import { parseWebGpuModelCatalog, webGpuGenerationOptions } from "./webGpuModelCatalog";
// @vitest-environment node
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { compileFunction } from "node:vm";
import {
    createSourceFile,
    isFunctionDeclaration,
    ModuleKind,
    ScriptTarget,
    transpileModule,
} from "typescript";
import { describe, expect, it, vi } from "vitest";
import { patchQwen3Vl2bDecoderGraph } from "../../transformersWebGpuDecoderGraph.mjs";
import {
    patchQwen3Vl2bDeepStackDecoderGraph,
    QWEN3_VL_2B_DEEPSTACK_DECODER_SHA256,
} from "../../transformersWebGpuDeepStackGraph.mjs";
import {
    assertQwen3VlWebGpuContext,
    QWEN3_VL_WEBGPU_MAX_CONTEXT_TOKENS,
} from "./transformersWebGpuQwenContext";
import {
    transformersWebGpuImageGridPatchCount,
    TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
} from "./transformersWebGpuImageLayout";
import { resolveTransformersWebGpuMaxOutputTokens } from "../stores/transformersWebGpuSettings";
import { assertCompletedGeneration, completionEosTokenIds } from "./transformersWebGpuCompletion";

describe("Qwen's evaluated causal context budget", () => {
    it.each([
        [929, 96],
        [1024, 1],
        [1023, 2],
        [1, 96],
    ])("accepts %i prompt tokens with %i generated tokens", (length, generated) => {
        expect(() => assertQwen3VlWebGpuContext([1, length], length, generated)).not.toThrow();
    });

    it.each([
        [930, 96],
        [1025, 1],
        [1024, 2],
    ])("rejects %i prompt tokens with %i generated tokens", (length, generated) => {
        expect(() => assertQwen3VlWebGpuContext([1, length], length, generated)).toThrow(
            `requires ${length + generated - 1} positions`,
        );
    });

    it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
        "rejects an invalid completion allowance: %s",
        (generated) => {
            expect(() => assertQwen3VlWebGpuContext([1, 1], 1, generated)).toThrow(
                "positive safe integer",
            );
        },
    );

    it.each([
        { shape: [], count: 0 },
        { shape: [1], count: 1 },
        { shape: [1, 2, 1], count: 2 },
        { shape: [2, 10], count: 20 },
        { shape: [0, 1], count: 0 },
        { shape: [1, 0], count: 0 },
        { shape: [1, -1], count: -1 },
        { shape: [1, 1.5], count: 1.5 },
        { shape: [1, NaN], count: 1 },
        { shape: [1, Infinity], count: 1 },
        { shape: [1, 10], count: 9 },
        { shape: [1, 10], count: 11 },
        { shape: [1, 10], count: NaN },
        { shape: [1, Number.MAX_SAFE_INTEGER + 1], count: Number.MAX_SAFE_INTEGER + 1 },
    ])("rejects malformed input shape/count: $shape / $count", ({ shape, count }) => {
        expect(() => assertQwen3VlWebGpuContext(shape, count, 1)).toThrow(
            "invalid single-request input token shape",
        );
    });

    it("honors the configured output cap without changing the prompt", () => {
        const allowance = resolveTransformersWebGpuMaxOutputTokens(96, 1);
        expect(allowance).toBe(1);
        expect(() => assertQwen3VlWebGpuContext([1, 1024], 1024, allowance)).not.toThrow();
    });

    it("matches the actual delivered decoder table, scalar, and pinned graph identity", () => {
        const require = createRequire(import.meta.url);
        const schema = require(
            path.resolve(
                import.meta.dirname,
                "../../../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
            ),
        ).onnx;
        const source = fs.readFileSync(
            path.resolve(
                import.meta.dirname,
                "../../model-overrides/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
            ),
        );
        const delivered = patchQwen3Vl2bDeepStackDecoderGraph(patchQwen3Vl2bDecoderGraph(source));
        expect(createHash("sha256").update(delivered).digest("hex")).toBe(
            QWEN3_VL_2B_DEEPSTACK_DECODER_SHA256,
        );
        type Initializer = {
            name: string;
            dims: Array<number | { toString(): string }>;
            dataType: number;
            rawData: Uint8Array;
            int64Data: Array<number | { toString(): string }>;
        };
        const initializers: Initializer[] = schema.ModelProto.decode(delivered).graph.initializer;
        const tables = initializers.filter(
            (entry) => entry.name === "__codex_unfused_gqa_causal_table",
        );
        const scalars = initializers.filter(
            (entry) => entry.name === "__codex_unfused_gqa_max_causal_sequence",
        );
        expect(tables).toHaveLength(1);
        expect(scalars).toHaveLength(1);
        expect(tables[0].dims.map(Number)).toEqual([
            QWEN3_VL_WEBGPU_MAX_CONTEXT_TOKENS,
            QWEN3_VL_WEBGPU_MAX_CONTEXT_TOKENS,
        ]);
        expect(tables[0].dataType).toBe(schema.TensorProto.DataType.FLOAT);
        expect(tables[0].rawData.byteLength).toBe(QWEN3_VL_WEBGPU_MAX_CONTEXT_TOKENS ** 2 * 4);
        expect(scalars[0].dims).toEqual([]);
        expect(scalars[0].dataType).toBe(schema.TensorProto.DataType.INT64);
        expect(scalars[0].int64Data.map(Number)).toEqual([QWEN3_VL_WEBGPU_MAX_CONTEXT_TOKENS]);
    });
});

// Execute the real worker function, not a copied version of its guard/generation
// ordering. Only the model, processor and browser-dependent boundaries are mocked.
const workerSource = fs.readFileSync(
    path.resolve(import.meta.dirname, "../workers/transformersWebGpuInference.worker.ts"),
    "utf8",
);
const parsedWorker = createSourceFile("worker.ts", workerSource, ScriptTarget.ES2022, true);
const qwenFunction = parsedWorker.statements.find(
    (entry) => isFunctionDeclaration(entry) && entry.name?.text === "inferQwen",
);
if (qwenFunction === undefined) throw new Error("The real Qwen worker function was not found.");
const workerFunctionCode = transpileModule(qwenFunction.getText(parsedWorker), {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
}).outputText;

class TestTensor {
    data: BigInt64Array;
    dispose = vi.fn();
    constructor(
        public dims: number[],
        count = dims.reduce((a, b) => a * b, 1),
    ) {
        this.data = new BigInt64Array(count);
    }
    slice(_batch: unknown, range: number[]): TestTensor {
        return new TestTensor([1, range[1] - range[0]]);
    }
}

function workerHarness(shape: number[], count = shape.reduce((a, b) => a * b, 1)) {
    const ids = new TestTensor(shape, count);
    const grid = new TestTensor([1, 3]);
    grid.data.set([1n, 32n, 20n]);
    const pixels = new TestTensor([640, 1]);
    const inputs = { input_ids: ids, image_grid_thw: grid, pixel_values: pixels };
    const output = new TestTensor([1, (shape.at(-1) ?? 0) + 1]);
    output.data[output.data.length - 1] = 2n;
    const generate = vi.fn(async () => output);
    const processor = Object.assign(
        vi.fn(async () => inputs),
        {
            apply_chat_template: vi.fn(() => "complete formatted image and text prompt"),
            batch_decode: vi.fn(() => ["result"]),
        },
    );
    const invoke = compileFunction(
        `const {
            modelSpec, webGpuGenerationOptions, loadQwenRuntime, post, syntheticNeutralImage, decodeBoundedImage, Tensor,
            transformersWebGpuImageGridPatchCount, TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
            assertQwen3VlWebGpuContext, assertCompletedGeneration, completionEosTokenIds, disposeTensors
        } = context;
        ${workerFunctionCode}
        return (message) => inferQwen({modelSpec, ...message});`,
        ["context"],
    )({
        modelSpec: parseWebGpuModelCatalog(catalog).models[0],
        webGpuGenerationOptions,
        loadQwenRuntime: async () => ({
            processor,
            model: { generate, _prepare_generation_config: () => ({ eos_token_id: 2 }) },
        }),
        post: vi.fn(),
        syntheticNeutralImage: vi.fn(() => "neutral image"),
        decodeBoundedImage: vi.fn(async () => "caller image"),
        Tensor: TestTensor,
        transformersWebGpuImageGridPatchCount,
        TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
        assertQwen3VlWebGpuContext,
        assertCompletedGeneration,
        completionEosTokenIds,
        disposeTensors: (tensors: TestTensor[]) => tensors.forEach((tensor) => tensor.dispose()),
    }) as (request: {
        requestId: string;
        prompt: string;
        maxTokens?: number;
        image?: Uint8Array;
    }) => Promise<string>;
    return { invoke, generate, ids, grid, pixels, output };
}

describe("Actual Qwen worker context gate", () => {
    it.each([undefined, new Uint8Array([1])])(
        "rejects over-budget processor tokens before generation, including neutral-image requests: %s",
        async (image) => {
            const run = workerHarness([1, 930]);
            await expect(run.invoke({ requestId: "test", prompt: "short", image })).rejects.toThrow(
                "requires 1025 positions",
            );
            expect(run.generate).not.toHaveBeenCalled();
            for (const tensor of [run.ids, run.grid, run.pixels]) {
                expect(tensor.dispose).toHaveBeenCalledOnce();
            }
        },
    );

    it.each([
        { shape: [2, 10], count: 20 },
        { shape: [1, 10], count: 9 },
        { shape: [1, 0], count: 0 },
    ])(
        "rejects malformed actual processor tensors before generation: $shape",
        async ({ shape, count }) => {
            const run = workerHarness(shape, count);
            await expect(run.invoke({ requestId: "test", prompt: "input" })).rejects.toThrow(
                "invalid single-request input token shape",
            );
            expect(run.generate).not.toHaveBeenCalled();
            expect(run.ids.dispose).toHaveBeenCalledOnce();
        },
    );

    it.each([
        { length: 929, requested: undefined, expected: 96 },
        { length: 1024, requested: 1, expected: 1 },
    ])(
        "preserves generation arguments and cleanup at the accepted boundary: $length",
        async ({ length, requested, expected }) => {
            const run = workerHarness([1, length]);
            await expect(
                run.invoke({ requestId: "test", prompt: "input", maxTokens: requested }),
            ).resolves.toBe("result");
            expect(run.generate).toHaveBeenCalledExactlyOnceWith({
                input_ids: run.ids,
                image_grid_thw: run.grid,
                pixel_values: run.pixels,
                max_new_tokens: expected,
                do_sample: false,
                temperature: 1,
                top_p: 1,
                top_k: 50,
                repetition_penalty: 1,
            });
            for (const tensor of [run.ids, run.grid, run.pixels, run.output]) {
                expect(tensor.dispose).toHaveBeenCalledOnce();
            }
        },
    );

    it("keeps this guard out of the independent Gemma path", () => {
        const gemma = parsedWorker.statements.find(
            (entry) => isFunctionDeclaration(entry) && entry.name?.text === "inferGemma",
        );
        expect(gemma).toBeDefined();
        expect(gemma!.getText(parsedWorker)).not.toContain("assertQwen3VlWebGpuContext");
    });
});
