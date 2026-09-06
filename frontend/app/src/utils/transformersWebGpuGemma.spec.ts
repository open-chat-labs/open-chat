import fs from "node:fs";
import path from "node:path";
import { Tensor as WebGpuOrtTensor } from "onnxruntime-web/webgpu";
import { describe, expect, it, vi } from "vitest";
import {
    patchGemma4DecoderForStandardSoftmaxRouting,
    patchTransformersWebGpuSessionSource,
    TRANSFORMERS_GEMMA_DECODER_INPUT_METADATA,
} from "../../transformersWebGpuSequentialSessions.mjs";
import {
    GEMMA4_AUDIO_TOKEN_ID,
    GEMMA4_BASE_EMBEDDING_LAYOUT,
    GEMMA4_EMBEDDING_SHARD_BYTES,
    GEMMA4_IMAGE_TOKEN_ID,
    GEMMA4_MAX_PROMPT_TOKENS,
    GEMMA4_PER_LAYER_BYTES_PER_TOKEN,
    GEMMA4_PER_LAYER_EMBEDDING_LAYOUT,
    assertGemma4PromptTokenCount,
    createGemma4WebGpuEmbeddingSession,
    gemma4EmbeddingOutputTensors,
    gemma4PerLayerRowId,
    gemma4TokenIds,
} from "./gemma4WebGpuEmbedding";
import {
    GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES,
    GEMMA4_WEBGPU_MAX_SOFT_TOKENS,
    gemma4WebGpuImageTarget,
} from "./transformersWebGpuImageLayout";
import {
    PHONE_GEMMA4_E2B_MODEL_ID,
    TRANSFORMERS_GEMMA_ARTIFACT_BYTES,
    TRANSFORMERS_GEMMA_ARTIFACTS,
    TRANSFORMERS_GEMMA_AUDIO_ARTIFACT_BYTES,
    TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS,
    TRANSFORMERS_GEMMA_DEVICE_MAP,
    TRANSFORMERS_GEMMA_MODEL_ID,
    TRANSFORMERS_GEMMA_REVISION,
    transformersWebGpuModelSpec,
} from "./transformersWebGpuProtocol";

const APP_DIR = path.resolve(import.meta.dirname, "../..");
const FRONTEND_DIR = path.resolve(APP_DIR, "..");

const GEMMA_GQA_ORIGINAL_ATTRIBUTE = Uint8Array.of(
    0x2a,
    0x19,
    0x0a,
    0x12,
    ...new TextEncoder().encode("rotary_interleaved"),
    0x18,
    0x00,
    0xa0,
    0x01,
    0x02,
);
const GEMMA_GQA_ROUTING_ATTRIBUTE = Uint8Array.of(
    0x2a,
    0x19,
    0x0a,
    0x0e,
    ...new TextEncoder().encode("smooth_softmax"),
    0x78,
    0x00,
    0x78,
    0x00,
    0x18,
    0x01,
    0xa0,
    0x01,
    0x02,
);

function repeatedBytes(pattern: Uint8Array, count: number): Uint8Array {
    const result = new Uint8Array(pattern.length * count);
    for (let index = 0; index < count; index++) result.set(pattern, index * pattern.length);
    return result;
}

function countBytes(source: Uint8Array, pattern: Uint8Array): number {
    let count = 0;
    for (let offset = 0; offset <= source.length - pattern.length; offset++) {
        if (pattern.every((value, index) => source[offset + index] === value)) {
            count++;
            offset += pattern.length - 1;
        }
    }
    return count;
}

describe("Gemma 4 E2B all-WebGPU runtime", () => {
    it("marks exactly the 12 pinned GQA nodes for standard non-flash WebGPU attention", () => {
        const original = repeatedBytes(GEMMA_GQA_ORIGINAL_ATTRIBUTE, 12);
        const patched = patchGemma4DecoderForStandardSoftmaxRouting(original);

        expect(patched).toHaveLength(original.length);
        expect(countBytes(original, GEMMA_GQA_ORIGINAL_ATTRIBUTE)).toBe(12);
        expect(countBytes(original, GEMMA_GQA_ROUTING_ATTRIBUTE)).toBe(0);
        expect(countBytes(patched, GEMMA_GQA_ORIGINAL_ATTRIBUTE)).toBe(0);
        expect(countBytes(patched, GEMMA_GQA_ROUTING_ATTRIBUTE)).toBe(12);
        expect(patchGemma4DecoderForStandardSoftmaxRouting(patched)).toEqual(patched);
        expect(() =>
            patchGemma4DecoderForStandardSoftmaxRouting(
                repeatedBytes(GEMMA_GQA_ORIGINAL_ATTRIBUTE, 11),
            ),
        ).toThrow("refusing an unverified FlashAttention bypass");
    });

    it("pins text/image separately from the optional audio add-on", () => {
        const spec = transformersWebGpuModelSpec(PHONE_GEMMA4_E2B_MODEL_ID);
        expect(spec).toMatchObject({
            repository: TRANSFORMERS_GEMMA_MODEL_ID,
            revision: TRANSFORMERS_GEMMA_REVISION,
            dtype: "q4f16",
            artifactBytes: 3_229_930_094,
            modalities: ["text", "image", "audio"],
        });
        expect(TRANSFORMERS_GEMMA_ARTIFACTS.reduce((sum, item) => sum + item.bytes, 0)).toBe(
            TRANSFORMERS_GEMMA_ARTIFACT_BYTES,
        );
        expect(TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS.reduce((sum, item) => sum + item.bytes, 0)).toBe(
            TRANSFORMERS_GEMMA_AUDIO_ARTIFACT_BYTES,
        );
        expect(TRANSFORMERS_GEMMA_ARTIFACTS.map(({ path }) => path)).not.toContain(
            "onnx/audio_encoder_q4f16.onnx",
        );
        expect(TRANSFORMERS_GEMMA_ARTIFACTS.map(({ path }) => path)).not.toContain(
            "onnx/audio_encoder_q4f16.onnx_data",
        );
        expect(spec?.packagedArtifacts).toEqual([]);
        expect(spec?.optionalAudio?.artifacts).toBe(TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS);
        expect(spec?.optionalAudio?.artifacts.map(({ path }) => path)).toEqual([
            "onnx/audio_encoder_q4f16.onnx",
            "onnx/audio_encoder_q4f16.onnx_data",
        ]);
        expect(TRANSFORMERS_GEMMA_DEVICE_MAP).toEqual({
            embed_tokens: "webgpu",
            vision_encoder: "webgpu",
            audio_encoder: "webgpu",
            decoder_model_merged: "webgpu",
        });
    });

    it("pins the row-streamed embedding table byte layout and special-token guard", () => {
        expect(GEMMA4_EMBEDDING_SHARD_BYTES).toBe(1_590_689_792);
        expect(GEMMA4_BASE_EMBEDDING_LAYOUT).toEqual({
            width: 1_536,
            quantizedOffset: 0,
            quantizedRowBytes: 768,
            scalesOffset: 201_326_592,
            scalesRowBytes: 96,
            zeroPointsOffset: 226_492_416,
            zeroPointsRowBytes: 24,
            multiplier: 39.25,
        });
        expect(GEMMA4_PER_LAYER_EMBEDDING_LAYOUT).toEqual({
            width: 8_960,
            quantizedOffset: 232_783_872,
            quantizedRowBytes: 4_480,
            scalesOffset: 1_407_188_992,
            scalesRowBytes: 560,
            zeroPointsOffset: 1_553_989_632,
            zeroPointsRowBytes: 140,
            multiplier: 16,
        });
        expect(gemma4PerLayerRowId(GEMMA4_IMAGE_TOKEN_ID)).toBe(0);
        expect(gemma4PerLayerRowId(GEMMA4_AUDIO_TOKEN_ID)).toBe(0);
        expect(gemma4PerLayerRowId(123)).toBe(123);
        expect(
            gemma4TokenIds({
                type: "int64",
                dims: [1, 3],
                data: new BigInt64Array([2n, 123n, BigInt(GEMMA4_IMAGE_TOKEN_ID)]),
            }),
        ).toEqual([2, 123, GEMMA4_IMAGE_TOKEN_ID]);
        expect(() =>
            gemma4TokenIds({
                type: "int64",
                dims: [1, 1],
                data: new BigInt64Array([262_144n]),
            }),
        ).toThrow("out-of-range token id");

        const embeddingSource = fs.readFileSync(
            path.join(APP_DIR, "src/utils/gemma4WebGpuEmbedding.ts"),
            "utf8",
        );
        expect(embeddingSource).toContain("enable f16;");
        expect(embeddingSource).toContain(
            "let gathered = f16(f16(i32(q) - i32(zp)) * f16(scale));",
        );
        expect(embeddingSource).toContain("let scaled = f16(gathered * f16(params.multiplier));");
    });

    it("returns browser WebGPU tensors that Transformers can recognize", () => {
        const outputs = gemma4EmbeddingOutputTensors(
            [1, 6],
            new Float32Array(6 * GEMMA4_BASE_EMBEDDING_LAYOUT.width),
            new Float32Array(6 * GEMMA4_PER_LAYER_EMBEDDING_LAYOUT.width),
        );

        expect(outputs.inputs_embeds).toBeInstanceOf(WebGpuOrtTensor);
        expect(outputs.per_layer_inputs).toBeInstanceOf(WebGpuOrtTensor);
        expect(outputs.inputs_embeds.dims).toEqual([1, 6, 1_536]);
        expect(outputs.per_layer_inputs.dims).toEqual([1, 6, 35, 256]);

        const embeddingSource = fs.readFileSync(
            path.join(APP_DIR, "src/utils/gemma4WebGpuEmbedding.ts"),
            "utf8",
        );
        expect(embeddingSource).toContain('new WebGpuOrtTensor("float32"');
        expect(embeddingSource).not.toContain("new input.constructor");
    });

    it("shares one embedding pipeline and serializes Qualcomm-safe readbacks", async () => {
        vi.stubGlobal("GPUBufferUsage", {
            STORAGE: 1,
            COPY_SRC: 2,
            COPY_DST: 4,
            UNIFORM: 8,
            MAP_READ: 16,
        });
        vi.stubGlobal("GPUMapMode", { READ: 1 });

        let activeMaps = 0;
        let maxActiveMaps = 0;
        let submittedWhileMapping = false;
        const copiedBytes: number[] = [];
        const createComputePipeline = vi.fn(() => ({ getBindGroupLayout: () => ({}) }));
        const device = {
            limits: { maxStorageBufferBindingSize: 128 * 1024 * 1024 },
            createShaderModule: vi.fn(() => ({})),
            createComputePipeline,
            createBuffer: vi.fn(({ size }: { size: number }) => {
                const storage = new ArrayBuffer(size);
                return {
                    getMappedRange: () => storage,
                    unmap: vi.fn(),
                    mapAsync: vi.fn(async () => {
                        activeMaps++;
                        maxActiveMaps = Math.max(maxActiveMaps, activeMaps);
                        await Promise.resolve();
                        activeMaps--;
                    }),
                    destroy: vi.fn(),
                };
            }),
            createBindGroup: vi.fn(() => ({})),
            createCommandEncoder: vi.fn(() => ({
                beginComputePass: () => ({
                    setPipeline: vi.fn(),
                    setBindGroup: vi.fn(),
                    dispatchWorkgroups: vi.fn(),
                    end: vi.fn(),
                }),
                copyBufferToBuffer: (
                    _source: unknown,
                    _sourceOffset: number,
                    _destination: unknown,
                    _destinationOffset: number,
                    size: number,
                ) => copiedBytes.push(size),
                finish: () => ({}),
            })),
            queue: {
                submit: vi.fn(() => {
                    if (activeMaps > 0) submittedWhileMapping = true;
                }),
            },
        };
        const sparseShard = {
            size: GEMMA4_EMBEDDING_SHARD_BYTES,
            slice: (start: number, end: number) => ({
                arrayBuffer: async () => new ArrayBuffer(end - start),
            }),
        } as unknown as Blob;
        const session = createGemma4WebGpuEmbeddingSession(sparseShard, () => device);
        const inputIds = {
            type: "int64",
            dims: [1, 1],
            data: new BigInt64Array([2n]),
        };

        try {
            for (let run = 0; run < 2; run++) {
                const outputs = await session.run({ input_ids: inputIds });
                for (const output of Object.values(outputs) as Array<{ dispose?: () => void }>) {
                    output.dispose?.();
                }
            }

            expect(createComputePipeline).toHaveBeenCalledOnce();
            expect(maxActiveMaps).toBe(1);
            expect(submittedWhileMapping).toBe(false);
            expect(copiedBytes).toEqual([
                GEMMA4_PER_LAYER_BYTES_PER_TOKEN,
                GEMMA4_BASE_EMBEDDING_LAYOUT.width * Float32Array.BYTES_PER_ELEMENT,
                GEMMA4_PER_LAYER_BYTES_PER_TOKEN,
                GEMMA4_BASE_EMBEDDING_LAYOUT.width * Float32Array.BYTES_PER_ELEMENT,
            ]);
        } finally {
            await session.release();
            vi.unstubAllGlobals();
        }
    });

    it("fails closed before a prompt can exceed phone WebGPU embedding-buffer limits", () => {
        expect(GEMMA4_MAX_PROMPT_TOKENS).toBe(2_048);
        expect(GEMMA4_PER_LAYER_BYTES_PER_TOKEN).toBe(35_840);
        expect(() => assertGemma4PromptTokenCount(1)).not.toThrow();
        expect(() => assertGemma4PromptTokenCount(GEMMA4_MAX_PROMPT_TOKENS)).not.toThrow();
        expect(() => assertGemma4PromptTokenCount(GEMMA4_MAX_PROMPT_TOKENS + 1)).toThrow(
            "2,048-token limit",
        );
        expect(() =>
            assertGemma4PromptTokenCount(1_001, 1_000 * GEMMA4_PER_LAYER_BYTES_PER_TOKEN),
        ).toThrow("1,000-token limit");
        expect(() => assertGemma4PromptTokenCount(Number.NaN)).toThrow(
            "invalid prompt token count",
        );

        const workerSource = fs.readFileSync(
            path.join(APP_DIR, "src/workers/transformersWebGpuInference.worker.ts"),
            "utf8",
        );
        expect(workerSource.indexOf("assertGemma4PromptTokenCount(inputLength")).toBeLessThan(
            workerSource.indexOf(
                "const generated = await model.generate",
                workerSource.indexOf("async function inferGemma"),
            ),
        );
        expect(workerSource).toContain('runtime.kind === "qwen" && name === "embed_tokens"');
    });

    it("keeps Gemma vision attention below the 128 MiB WebGPU binding floor", () => {
        const fp16Bytes = 2;
        const attentionHeads = 12;
        const webGpuMinimumMaxStorageBufferBindingSize = 128 * 1024 * 1024;
        const scoreBufferBytes =
            attentionHeads * GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES ** 2 * fp16Bytes;

        expect(GEMMA4_WEBGPU_MAX_SOFT_TOKENS).toBe(240);
        expect(GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES).toBe(2_160);
        expect(scoreBufferBytes).toBe(111_974_400);
        expect(scoreBufferBytes).toBeLessThan(webGpuMinimumMaxStorageBufferBindingSize);

        // 256 is mathematically under the limit but leaves only 6.5 MiB for backend
        // alignment and concurrent driver intermediates; the 240 cap leaves 21.2 MiB.
        const theoreticalEdgeBytes = attentionHeads * (256 * 9) ** 2 * fp16Bytes;
        expect(theoreticalEdgeBytes).toBe(127_401_984);
        expect(webGpuMinimumMaxStorageBufferBindingSize - theoreticalEdgeBytes).toBe(6_815_744);
        expect(webGpuMinimumMaxStorageBufferBindingSize - scoreBufferBytes).toBe(22_243_328);
    });

    it("decodes the acceptance receipt once at Gemma's safe patch target", () => {
        const target = gemma4WebGpuImageTarget(909, 1_600);
        expect(target).toEqual({ width: 528, height: 960 });
        expect(target.width % 48).toBe(0);
        expect(target.height % 48).toBe(0);
        expect((target.width / 16) * (target.height / 16)).toBeLessThanOrEqual(
            GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES,
        );

        const workerSource = fs.readFileSync(
            path.join(APP_DIR, "src/workers/transformersWebGpuInference.worker.ts"),
            "utf8",
        );
        expect(workerSource).toContain("max_soft_tokens: GEMMA4_WEBGPU_MAX_SOFT_TOKENS");
        expect(workerSource).not.toContain("max_soft_tokens: 280");
    });

    it("stages only the requested encoder and releases it before decoder materialization", async () => {
        const distPath = path.join(
            FRONTEND_DIR,
            "node_modules/@huggingface/transformers/dist/transformers.web.js",
        );
        const patched = patchTransformersWebGpuSessionSource(
            fs.readFileSync(distPath, "utf8"),
            distPath,
        );
        if (patched === null) throw new Error("session transform was not applied");
        const start = patched.indexOf("async function constructSessions");
        const end = patched.indexOf("\nfunction replaceTensors", start);
        const source = patched.slice(start, end);
        expect(source).toContain(TRANSFORMERS_GEMMA_MODEL_ID);
        expect(source).toContain(TRANSFORMERS_GEMMA_REVISION);
        expect(source).toContain("openchat_create_gemma_embed_session");
        expect(source).toContain('modality === "audio" ? "audio_encoder"');

        const events: string[] = [];
        let activeSessions = 0;
        const names = {
            embed_tokens: "embed_tokens",
            decoder_model_merged: "decoder_model_merged",
            audio_encoder: "audio_encoder",
            vision_encoder: "vision_encoder",
        };
        let rawDecoderFeeds: Record<string, unknown> | undefined;
        const session = (name: string) => ({
            inputNames:
                name === "decoder_model_merged"
                    ? TRANSFORMERS_GEMMA_DECODER_INPUT_METADATA.map(({ name }) => name)
                    : [],
            inputMetadata:
                name === "decoder_model_merged"
                    ? TRANSFORMERS_GEMMA_DECODER_INPUT_METADATA.map((item) => ({ ...item }))
                    : [],
            outputNames: [],
            outputMetadata: [],
            config: { device: "webgpu", dtype: "q4f16" },
            run: vi.fn(async (feeds?: Record<string, unknown>) => {
                if (name === "decoder_model_merged") rawDecoderFeeds = feeds;
                return name === "vision_encoder"
                    ? { image_features: { location: "cpu", type: "float32" } }
                    : {};
            }),
            release: vi.fn(async () => {
                activeSessions--;
                events.push(`release:${name}:active=${activeSessions}`);
            }),
        });
        const getSession = vi.fn(
            async (
                _model: string,
                name: string,
                options: { session_options?: { externalData?: Array<{ data: Blob }> } },
                _cache: boolean,
            ) => ({
                buffer_or_path:
                    name === "decoder_model_merged"
                        ? repeatedBytes(GEMMA_GQA_ORIGINAL_ATTRIBUTE, 12)
                        : new Uint8Array([1]),
                session_options: { externalData: options.session_options?.externalData },
                session_config: { name, device: "webgpu", dtype: "q4f16" },
            }),
        );
        const createInferenceSession = vi.fn(
            async (_bytes: Uint8Array, _options: unknown, config: { name: string }) => {
                events.push(`create:${config.name}:active=${activeSessions}`);
                activeSessions++;
                return session(config.name);
            },
        );
        const construct = new Function(
            "getSession",
            "createInferenceSession",
            "Blob",
            `${source}; return constructSessions;`,
        )(getSession, createInferenceSession, Blob) as (
            model: string,
            names: Record<string, string>,
            options: Record<string, unknown>,
            cache: Record<string, boolean>,
        ) => Promise<Record<string, ReturnType<typeof session>>>;
        const embedding = {
            inputNames: ["input_ids"],
            inputMetadata: [],
            outputNames: ["inputs_embeds", "per_layer_inputs"],
            outputMetadata: [],
            config: { device: "webgpu", dtype: "q4f16" },
            run: vi.fn(),
            release: vi.fn(),
        };
        const releaseBarrier = vi.fn(async (stage: string, release: () => Promise<void>) => {
            events.push(`barrier:${stage}:active=${activeSessions}`);
            await release();
        });
        const sessions = await construct(
            TRANSFORMERS_GEMMA_MODEL_ID,
            names,
            {
                revision: TRANSFORMERS_GEMMA_REVISION,
                device: TRANSFORMERS_GEMMA_DEVICE_MAP,
                dtype: Object.fromEntries(Object.keys(names).map((name) => [name, "q4f16"])),
                session_options: {
                    openchat_get_staged_external_data: vi.fn(async (name: string) => [
                        { path: `${name}.data`, data: new Blob([new Uint8Array([1])]) },
                    ]),
                    openchat_wait_for_staged_webgpu_queue: vi.fn(async (name: string) => {
                        events.push(`drain:${name}:active=${activeSessions}`);
                    }),
                    openchat_with_staged_webgpu_release: releaseBarrier,
                    openchat_create_gemma_embed_session: vi.fn(async () => embedding),
                    openchat_gemma_required_modality: "image",
                },
            },
            {},
        );
        expect(events).toContain("create:vision_encoder:active=0");
        expect(events.some((event) => event.startsWith("create:audio_encoder"))).toBe(false);
        expect(events.some((event) => event.startsWith("create:decoder_model_merged"))).toBe(false);
        await sessions.vision_encoder.run();
        class FakeTensor {
            readonly dispose = vi.fn();
            constructor(
                readonly type: string,
                readonly data: Float32Array | BigInt64Array,
                readonly dims: number[],
            ) {}
        }
        const callerKeep = new FakeTensor("int64", new BigInt64Array([0n]), []);
        await sessions.decoder_model_merged.run({
            inputs_embeds: new FakeTensor("float32", new Float32Array([0]), [1, 1, 1_536]),
            num_logits_to_keep: callerKeep,
        });
        expect(releaseBarrier).toHaveBeenCalledWith(
            "image-to-decoder transition",
            expect.any(Function),
        );
        expect(events).toContain("release:vision_encoder:active=0");
        expect(events).toContain("create:decoder_model_merged:active=0");
        const decoderLoad = getSession.mock.calls.find(
            ([, name]) => name === "decoder_model_merged",
        );
        expect(decoderLoad?.[3]).toBe(true);
        const forcedKeep = rawDecoderFeeds?.num_logits_to_keep as FakeTensor;
        expect(forcedKeep).not.toBe(callerKeep);
        expect(forcedKeep.type).toBe("int64");
        expect(forcedKeep.dims).toEqual([]);
        expect([...forcedKeep.data]).toEqual([1n]);
        expect(forcedKeep.dispose).toHaveBeenCalledOnce();
        expect(sessions.audio_encoder).toBeUndefined();
        expect(sessions.embed_tokens).toBe(embedding);
    });
});
