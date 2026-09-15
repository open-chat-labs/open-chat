import catalog from "../../public/model-catalog.json";
import { parseWebGpuModelCatalog, webGpuGenerationOptions } from "./webGpuModelCatalog";
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileFunction } from "node:vm";
import {
    createSourceFile,
    isClassDeclaration,
    isFunctionDeclaration,
    ModuleKind,
    ScriptTarget,
    transpileModule,
} from "typescript";
import { describe, expect, it, vi } from "vitest";
import { assertCompletedGeneration, completionEosTokenIds } from "./transformersWebGpuCompletion";
import { assertQwen3VlWebGpuContext } from "./transformersWebGpuQwenContext";
import {
    transformersWebGpuImageGridPatchCount,
    TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
} from "./transformersWebGpuImageLayout";

const tensor = (data: ArrayLike<unknown>, dims = [1, data.length]) => ({ data, dims });
const input = tensor([5n, 9n]);
const eos = completionEosTokenIds([2, 3]);

describe("generated token completion guard", () => {
    it.each([new BigInt64Array([5n, 9n, 8n, 2n]), [5, 9, 8, 3]].map((data) => ({ data })))(
        "accepts an actual EOS before or exactly at the cap: $data",
        ({ data }) => {
            expect(() => assertCompletedGeneration(input, tensor(data), 2, eos)).not.toThrow();
            expect(() => assertCompletedGeneration(input, tensor(data), 96, eos)).not.toThrow();
        },
    );
    it("does not treat an EOS in the prompt as completion", () => {
        expect(() => assertCompletedGeneration(tensor([2]), tensor([2, 8]), 1, eos)).toThrow(
            "output token limit",
        );
    });
    it("rejects short non-EOS stops and tokens after EOS", () => {
        expect(() => assertCompletedGeneration(input, tensor([5, 9, 8]), 96, eos)).toThrow(
            "stopped without",
        );
        expect(() => assertCompletedGeneration(input, tensor([5, 9, 2, 8]), 96, eos)).toThrow(
            "tokens after",
        );
    });
    it.each(
        [null, undefined, [], "2", [2, null], -1, 1.5, NaN, Infinity, 9007199254740992n].map(
            (value) => ({ value }),
        ),
    )("fails closed on invalid or disabled effective EOS: $value", ({ value }) =>
        expect(() => completionEosTokenIds(value)).toThrow("EOS tokens"),
    );
    it("normalizes safe number/bigint EOS without coercing strings", () => {
        expect(completionEosTokenIds([0, 2, 2n, 3n])).toEqual([0n, 2n, 3n]);
    });
    it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
        "rejects invalid allowance %s",
        (cap) =>
            expect(() => assertCompletedGeneration(input, tensor([5, 9, 2]), cap, eos)).toThrow(
                "positive safe integer",
            ),
    );
    it.each([
        { data: [5, 9, 2], dims: [3] },
        { data: [5, 9, 2], dims: [2, 3] },
        { data: [5, 9, 2], dims: [1, 2] },
        { data: [], dims: [1, 0] },
        { data: [5, 9, 2], dims: [1, 3.5] },
        { data: [5, 9, 2], dims: [1, NaN] },
        { data: [5, 9, 2], dims: [1, 3, 1] },
    ])("rejects malformed output shapes: $dims", (output) => {
        expect(() => assertCompletedGeneration(input, output, 96, eos)).toThrow("token tensor");
    });
    it("rejects malformed input, empty/overlong generation, and changed prefixes", () => {
        expect(() =>
            assertCompletedGeneration(tensor([5], [2, 1]), tensor([5, 2]), 96, eos),
        ).toThrow("token tensor");
        expect(() => assertCompletedGeneration(input, input, 96, eos)).toThrow("token count");
        expect(() => assertCompletedGeneration(input, tensor([5, 9, 8, 2]), 1, eos)).toThrow(
            "token count",
        );
        expect(() => assertCompletedGeneration(input, tensor([5, 8, 2]), 96, eos)).toThrow(
            "different input prefix",
        );
    });
    it.each(["2", null, undefined, -1, 1.5, NaN, Infinity, 9007199254740992n])(
        "rejects invalid actual generated IDs: %s",
        (value) =>
            expect(() => assertCompletedGeneration(input, tensor([5, 9, value]), 1, eos)).toThrow(
                "token ID",
            ),
    );
});

// Use the installed implementation to prove EOS precedence, not a copied merge policy.
const library = path.resolve(
    import.meta.dirname,
    "../../../node_modules/@huggingface/transformers/src",
);
const { GenerationConfig } = await import(
    /* @vite-ignore */ pathToFileURL(path.join(library, "generation/configuration_utils.js")).href
);
const { pick } = await import(
    /* @vite-ignore */ pathToFileURL(path.join(library, "utils/core.js")).href
);
const modelSource = createSourceFile(
    "modeling_utils.js",
    fs.readFileSync(path.join(library, "models/modeling_utils.js"), "utf8"),
    ScriptTarget.ES2022,
    true,
);
const modelClass = modelSource.statements.find(
    (node) => isClassDeclaration(node) && node.name?.text === "PreTrainedModel",
);
if (modelClass === undefined || !isClassDeclaration(modelClass))
    throw new Error("Installed model class not found.");
const prepareMethod = modelClass.members.find(
    (node) => node.name?.getText(modelSource) === "_prepare_generation_config",
);
if (prepareMethod === undefined) throw new Error("Installed generation config resolver not found.");
const prepare = compileFunction(
    `return ({ ${prepareMethod.getText(modelSource)} })._prepare_generation_config;`,
    ["GenerationConfig", "pick"],
)(GenerationConfig, pick);

describe("installed effective EOS configuration", () => {
    it("respects all nested/model/call precedence and explicit null", () => {
        const model = {
            config: {
                eos_token_id: 1,
                decoder: { eos_token_id: 2 },
                generator: { eos_token_id: 3 },
                text_config: { eos_token_id: 4 },
            },
            generation_config: { eos_token_id: [5, 6] },
        };
        expect(prepare.call(model, null, {}).eos_token_id).toEqual([5, 6]);
        expect(prepare.call({ ...model, generation_config: null }, null, {}).eos_token_id).toBe(4);
        expect(prepare.call(model, { eos_token_id: 7 }, {}).eos_token_id).toBe(7);
        expect(prepare.call(model, null, { eos_token_id: 8 }).eos_token_id).toBe(8);
        expect(() =>
            completionEosTokenIds(
                prepare.call({ ...model, generation_config: { eos_token_id: null } }, null, {})
                    .eos_token_id,
            ),
        ).toThrow("disabled");
    });
});

const workerSource = fs.readFileSync(
    path.resolve(import.meta.dirname, "../workers/transformersWebGpuInference.worker.ts"),
    "utf8",
);
const worker = createSourceFile("worker.ts", workerSource, ScriptTarget.ES2022, true);
class TestTensor {
    dispose = vi.fn();
    constructor(
        public dims: number[],
        public data: ArrayLike<number | bigint>,
    ) {}
    slice(_batch: unknown, range: number[]) {
        return new TestTensor(
            [1, range[1] - range[0]],
            Array.from(this.data).slice(range[0], range[1]),
        );
    }
}

function harness(kind: "Qwen" | "Gemma", tail: number[], config: unknown = [2, 3]) {
    const node = worker.statements.find(
        (entry) => isFunctionDeclaration(entry) && entry.name?.text === `infer${kind}`,
    );
    if (node === undefined) throw new Error("Actual worker function not found.");
    const code = transpileModule(node.getText(worker), {
        compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
    }).outputText;
    const ids = new TestTensor([1, 2], [5n, 9n]);
    const grid = new TestTensor([1, 3], [1n, 32n, 20n]);
    const pixels = new TestTensor([640, 1], new Float32Array(640));
    const inputs = { input_ids: ids, image_grid_thw: grid, pixel_values: pixels };
    const output = new TestTensor([1, 2 + tail.length], [5n, 9n, ...tail.map(BigInt)]);
    const model = {
        config: { eos_token_id: 99, text_config: { eos_token_id: 98 } },
        generation_config: { eos_token_id: config },
        generate: vi.fn(async () => output),
        _prepare_generation_config: prepare,
    };
    const processor = Object.assign(
        vi.fn(async () => inputs),
        {
            apply_chat_template: vi.fn(() => "formatted input"),
            batch_decode: vi.fn(() => ['{"completeLooking":true}']),
        },
    );
    const invoke = compileFunction(
        `const { modelSpec, webGpuGenerationOptions, loadQwenRuntime, loadGemmaRuntime, post, syntheticNeutralImage, decodeBoundedImage, decodeGemmaImage, Tensor, transformersWebGpuImageGridPatchCount, TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES, assertQwen3VlWebGpuContext, assertGemma4PromptTokenCount, onnx, completionEosTokenIds, assertCompletedGeneration, disposeTensors } = context;
        ${code}
        return (message) => infer${kind}({modelSpec, ...message});`,
        ["context"],
    )({
        modelSpec: parseWebGpuModelCatalog(catalog).models[kind === "Qwen" ? 0 : 1],
        webGpuGenerationOptions,
        loadQwenRuntime: async () => ({ processor, model }),
        loadGemmaRuntime: async () => ({ processor, model }),
        post: vi.fn(),
        syntheticNeutralImage: vi.fn(),
        decodeBoundedImage: vi.fn(),
        decodeGemmaImage: vi.fn(),
        Tensor: TestTensor,
        transformersWebGpuImageGridPatchCount,
        TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
        assertQwen3VlWebGpuContext,
        assertGemma4PromptTokenCount: vi.fn(),
        onnx: {},
        completionEosTokenIds,
        assertCompletedGeneration,
        disposeTensors: (tensors: TestTensor[]) => tensors.forEach((value) => value.dispose()),
    });
    return { invoke, model, processor, output, inputs };
}

describe.each(["Qwen", "Gemma"] as const)("actual %s worker completion gate", (kind) => {
    it("rejects capped output before decode even when its text would look complete", async () => {
        const run = harness(kind, [8, 8]);
        await expect(
            run.invoke({ requestId: "test", prompt: "input", maxTokens: 2 }),
        ).rejects.toThrow("output token limit");
        expect(run.processor.batch_decode).not.toHaveBeenCalled();
        for (const value of [...Object.values(run.inputs), run.output])
            expect(value.dispose).toHaveBeenCalledOnce();
    });
    it("rejects unexplained early stops without publishing partial text", async () => {
        const run = harness(kind, [8]);
        await expect(run.invoke({ requestId: "test", prompt: "input" })).rejects.toThrow(
            "stopped without",
        );
        expect(run.processor.batch_decode).not.toHaveBeenCalled();
    });
    it.each([undefined, 2, 200])(
        "accepts final EOS, preserving existing generation options for cap %s",
        async (maxTokens) => {
            const run = harness(kind, [8, 3]);
            await expect(
                run.invoke({ requestId: "test", prompt: "input", maxTokens }),
            ).resolves.toBe('{"completeLooking":true}');
            expect(run.model.generate).toHaveBeenCalledExactlyOnceWith({
                ...run.inputs,
                max_new_tokens: Math.min(maxTokens ?? 96, 96),
                do_sample: false,
                temperature: 1,
                top_p: 1,
                top_k: 50,
                repetition_penalty: 1,
                ...(kind === "Gemma" ? { num_logits_to_keep: 1 } : {}),
            });
            expect(run.processor.batch_decode).toHaveBeenCalledOnce();
            expect(run.output.dispose).toHaveBeenCalledOnce();
        },
    );
    it("rejects disabled EOS before generating rather than falling back to model/tokenizer EOS", async () => {
        const run = harness(kind, [2], null);
        await expect(run.invoke({ requestId: "test", prompt: "input" })).rejects.toThrow(
            "disabled",
        );
        expect(run.model.generate).not.toHaveBeenCalled();
        for (const value of Object.values(run.inputs)) expect(value.dispose).toHaveBeenCalledOnce();
    });
});
