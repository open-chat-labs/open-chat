import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import {
    patchTransformersWebGpuSessionSource,
    TRANSFORMERS_QWEN_DECODER_INPUT_METADATA,
    TRANSFORMERS_GEMMA_DECODER_INPUT_METADATA,
} from "../../transformersWebGpuSequentialSessions.mjs";
import { createQwen3Vl2bGenerationRuntime } from "../../transformersWebGpuQwenGenerationRuntime.mjs";
import { createQwen3Vl2bVisionGeometryRuntime } from "../../transformersWebGpuQwenVisionGeometry.mjs";
import catalog from "../../public/model-catalog.json";

const HIDDEN = 2048;
const FEATURES = 64;
const PATCHES = 256;
const PROMPT_LENGTH = FEATURES + 3;
const IMAGE_POSITIONS = [1, 3, ...Array.from({ length: FEATURES - 2 }, (_, i) => i + 4)];
const OUTPUTS = [0, 1, 2].map((i) => `__openchat_deepstack_features_${i}`);
const INPUTS = [0, 1, 2].map((i) => `__openchat_deepstack_${i}`);
const CACHE_NAMES = Array.from({ length: 28 }, (_, layer) =>
    ["key", "value"].map((kind) => `past_key_values.${layer}.${kind}`),
).flat();
const PRESENT_NAMES = CACHE_NAMES.map((name) => name.replace("past_key_values.", "present."));
const GENERATION = createQwen3Vl2bGenerationRuntime();
const GEOMETRY = createQwen3Vl2bVisionGeometryRuntime();
class PinnedTensor {
    location = "cpu";
    dispose = vi.fn(() => {
        this.location = "none";
    });
    constructor(
        readonly type: string,
        readonly data: Float32Array | BigInt64Array,
        readonly dims: number[],
    ) {}
}
class CallerTensor extends PinnedTensor {}
type Feeds = Record<string, PinnedTensor>;
type Metadata = { name: string; isTensor: boolean; type: string; shape: (string | number)[] };
type Session = {
    inputNames: string[];
    inputMetadata: Metadata[];
    outputNames: string[];
    outputMetadata: Metadata[];
    config: { device: string; dtype: string };
    run: (feeds: Feeds) => Promise<Feeds>;
    release: () => Promise<void>;
};
type Changes = {
    tokenId?: number;
    vision?: (outputs: Feeds) => Feeds;
    privateMetadata?: (metadata: Metadata[]) => Metadata[];
    decoderError?: boolean;
    decoderWait?: () => Promise<void>;
    createWait?: (name: string) => Promise<void>;
    releaseWait?: (name: string) => Promise<void>;
    embedWait?: () => Promise<void>;
    visionWait?: () => Promise<void>;
    rawDecoder?: (feeds: Feeds) => void;
    rawVision?: (feeds: Feeds) => void;
    decoderOutput?: (outputs: Feeds) => Feeds;
    visionMetadata?: (metadata: Metadata[]) => Metadata[];
    learnedDataUnreadable?: boolean;
    gemma?: boolean;
    events?: string[];
    report?: (name: string, phase: string) => void;
    nativeCreated?: (name: string, session: Session) => void;
    tensorConstructor?: (type: string, dims: number[]) => void;
    tensorCreated?: (tensor: PinnedTensor) => void;
};
function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}
function copyMetadata(
    metadata: readonly { name: string; type: string; shape: readonly unknown[] }[],
): Metadata[] {
    return metadata.map((entry) => ({
        ...entry,
        isTensor: true,
        shape: entry.shape.map((dimension) => {
            if (typeof dimension !== "number" && typeof dimension !== "string") {
                throw new Error("Fixture metadata contains a non-scalar dimension");
            }
            return dimension;
        }),
    }));
}
async function harness(changes: Changes = {}) {
    const distPath = path.resolve(
        import.meta.dirname,
        "../../../node_modules/@huggingface/transformers/dist/transformers.web.js",
    );
    const patched = patchTransformersWebGpuSessionSource(
        fs.readFileSync(distPath, "utf8"),
        distPath,
    );
    if (!patched) throw new Error("Missing actual session patch");
    const start = patched.indexOf("async function constructSessions");
    const source = patched.slice(start, patched.indexOf("\nfunction replaceTensors", start));
    const events = changes.events ?? [];
    const decoderRuns: Feeds[] = [];
    const decoderResults: Feeds[] = [];
    const visionResults: Feeds[] = [];
    const visionRuns: Feeds[] = [];
    const embedResults: Feeds[] = [];
    const nativeTensors: PinnedTensor[] = [];
    class RuntimeTensor extends PinnedTensor {
        constructor(type: string, data: Float32Array | BigInt64Array, dims: number[]) {
            changes.tensorConstructor?.(type, dims);
            super(type, data, dims);
            nativeTensors.push(this);
            changes.tensorCreated?.(this);
        }
    }
    const loadedOptions: { name: string; options: Record<string, unknown> }[] = [];
    const createdOptions: { name: string; options: Record<string, unknown> }[] = [];
    const rawSessions = new Map<string, Session>();
    let active = 0;
    const getSession = async (
        _model: string,
        name: string,
        options: {
            session_options: Record<string, unknown> & {
                externalData: { path: string; data: Blob }[];
            };
        },
    ) => {
        events.push(`load:${name}:${active}`);
        loadedOptions.push({ name, options: { ...options.session_options } });
        return {
            buffer_or_path: new Uint8Array(1),
            session_options: {
                ...options.session_options,
                externalData: options.session_options.externalData.map((e) => ({ ...e })),
            },
            session_config: { name },
        };
    };
    const create = async (
        _bytes: Uint8Array,
        options: Record<string, unknown>,
        { name }: { name: string },
    ): Promise<Session> => {
        events.push(`create-start:${name}`);
        createdOptions.push({ name, options: { ...options } });
        await changes.createWait?.(name);
        active++;
        events.push(`create-done:${name}`);
        const privateOriginal = [
            {
                name: "__openchat_input_ids",
                isTensor: true,
                type: "int64",
                shape: ["batch_size", "openchat_token_sequence_length"],
            },
            ...INPUTS.map((name) => ({
                name,
                isTensor: true,
                type: "float32",
                shape: ["batch_size", "sequence_length", HIDDEN],
            })),
            ...copyMetadata(GENERATION.inputMetadata),
        ];
        const privateMetadata = changes.privateMetadata?.(privateOriginal) ?? privateOriginal;
        const originalVision = copyMetadata([
            { name: "pixel_values", type: "float32", shape: ["num_patches", 1536] },
            { name: "image_grid_thw", type: "int64", shape: ["num_images", 3] },
            ...GEOMETRY.inputMetadata,
        ]);
        const metadata: Metadata[] =
            name === "decoder_model_merged"
                ? changes.gemma
                    ? copyMetadata(TRANSFORMERS_GEMMA_DECODER_INPUT_METADATA)
                    : [
                          ...TRANSFORMERS_QWEN_DECODER_INPUT_METADATA.map((m) => ({
                              ...m,
                              shape: [...m.shape],
                          })),
                          ...privateMetadata,
                      ]
                : name === "vision_encoder" && !changes.gemma
                  ? (changes.visionMetadata?.(originalVision) ?? originalVision)
                  : [
                        {
                            name: "input_ids",
                            isTensor: true,
                            type: "int64",
                            shape: [1, "sequence_length"],
                        },
                    ];
        const outputMetadata =
            name === "decoder_model_merged"
                ? copyMetadata([
                      { name: "logits", type: "float32", shape: ["batch_size", 1, 151936] },
                      ...PRESENT_NAMES.map((name) => ({
                          name,
                          type: "float32",
                          shape: ["batch_size", 8, "total_sequence_length", 128],
                      })),
                  ])
                : name === "vision_encoder"
                  ? copyMetadata(
                        ["image_features", ...OUTPUTS].map((name) => ({
                            name,
                            type: "float32",
                            shape: ["num_features", HIDDEN],
                        })),
                    )
                  : copyMetadata([
                        {
                            name: "inputs_embeds",
                            type: "float32",
                            shape: ["batch_size", "sequence_length", HIDDEN],
                        },
                    ]);
        let released = false;
        const session: Session = {
            inputNames: metadata.map((m) => m.name),
            inputMetadata: metadata,
            outputNames: outputMetadata.map((m) => m.name),
            outputMetadata,
            config: { device: "webgpu", dtype: "q4" },
            run: async (feeds) => {
                events.push(`run:${name}`);
                if (name === "embed_tokens") {
                    const ids = feeds.input_ids;
                    await changes.embedWait?.();
                    const result = {
                        inputs_embeds: new RuntimeTensor(
                            "float32",
                            new Float32Array(ids.data.length * HIDDEN),
                            [...ids.dims, HIDDEN],
                        ),
                    };
                    embedResults.push(result);
                    return result;
                }
                if (name === "vision_encoder") {
                    visionRuns.push(feeds);
                    changes.rawVision?.(feeds);
                    await changes.visionWait?.();
                    const outputs: Feeds = {
                        image_features: new RuntimeTensor(
                            "float32",
                            new Float32Array(FEATURES * HIDDEN),
                            [FEATURES, HIDDEN],
                        ),
                    };
                    OUTPUTS.forEach((key, stage) => {
                        const data = new Float32Array(FEATURES * HIDDEN);
                        data.fill(stage + 1, 0, HIDDEN);
                        data.fill(stage + 11, HIDDEN, 2 * HIDDEN);
                        for (let row = 2; row < FEATURES; row++)
                            data.fill(stage + 100 + row, row * HIDDEN, (row + 1) * HIDDEN);
                        outputs[key] = new RuntimeTensor("float32", data, [FEATURES, HIDDEN]);
                    });
                    const result = changes.vision?.(outputs) ?? outputs;
                    visionResults.push(result);
                    return result;
                }
                decoderRuns.push(feeds);
                changes.rawDecoder?.(feeds);
                await changes.decoderWait?.();
                if (changes.decoderError) throw new Error("expected raw decoder failure");
                const sequence =
                    feeds.inputs_embeds.dims[1] + (feeds.__openchat_input_ids?.dims[1] ?? 0);
                const total = (feeds[CACHE_NAMES[0]]?.dims[2] ?? 0) + sequence;
                // The transport reads learned outputs only through their dtype/dimensions.
                // No 56-cache backing allocations are needed to test that ownership contract.
                const learned = (dims: number[]) => {
                    const tensor = new RuntimeTensor("float32", new Float32Array(0), dims);
                    tensor.location = "gpu-buffer";
                    if (changes.learnedDataUnreadable)
                        Object.defineProperty(tensor, "data", {
                            get: () => {
                                throw new Error("Learned output data must not be read");
                            },
                        });
                    return tensor;
                };
                const outputs: Feeds = { logits: learned([1, 1, 151936]) };
                for (const key of PRESENT_NAMES) outputs[key] = learned([1, 8, total, 128]);
                const result = changes.decoderOutput?.(outputs) ?? outputs;
                decoderResults.push(result);
                return result;
            },
            release: async () => {
                if (!released) {
                    released = true;
                    events.push(`release-start:${name}`);
                    await changes.releaseWait?.(name);
                    active--;
                    events.push(`release:${name}:${active}`);
                }
            },
        };
        rawSessions.set(name, session);
        changes.nativeCreated?.(name, session);
        return session;
    };
    type Construct = (
        model: string,
        names: Record<string, string>,
        options: unknown,
        cache: unknown,
    ) => Promise<Record<string, Session>>;
    const construct = new Function(
        "getSession",
        "createInferenceSession",
        `${source};return constructSessions;`,
    )(getSession, create) as Construct;
    const sessions = await construct(
        changes.gemma ? "catalog-owner/compatible-gemma" : "catalog-owner/compatible-qwen",
        {
            embed_tokens: "embed_tokens",
            vision_encoder: "vision_encoder",
            decoder_model_merged: "decoder_model_merged",
            ...(changes.gemma ? { audio_encoder: "audio_encoder" } : {}),
        },
        {
            revision: changes.gemma
                ? "9f4bef82ea6e296bc69f8a2f5939f73af81b07a6"
                : "3e4136ea66ae6e07c110e64fe07da2e029517ab5",
            device: "webgpu",
            dtype: changes.gemma ? "q4f16" : "q4",
            config: { image_token_id: changes.tokenId ?? 151655 },
            session_options: {
                openchat_runtime_adapter: changes.gemma
                    ? "gemma4-e2b-row-v1"
                    : "qwen3-vl-2b-staged-v1",
                graphOptimizationLevel: "all",
                executionProviders: [{ name: "webgpu", preferredLayout: "NHWC" }],
                extra: { session: { original_test_option: "preserved" } },
                openchat_report_staged_session: changes.report,
                ...(changes.gemma
                    ? {
                          openchat_gemma_required_modality: "image",
                          openchat_create_gemma_embed_session: async () => ({
                              release: vi.fn(async () => {}),
                          }),
                      }
                    : {}),
                openchat_get_staged_external_data: async (name: string) => [
                    { path: `${name}.data`, data: new Blob([new Uint8Array(1)]) },
                ],
                openchat_wait_for_staged_webgpu_queue: async (name: string) => {
                    events.push(`drain:${name}`);
                },
                openchat_with_staged_webgpu_release: async (
                    _stage: string,
                    release: () => Promise<void>,
                ) => {
                    events.push(`transition-start:${_stage}`);
                    await release();
                    events.push(`transition-end:${_stage}`);
                },
            },
        },
        { decoder_model_merged: true },
    );
    const ids = new CallerTensor(
        "int64",
        new BigInt64Array([
            10n,
            151655n,
            20n,
            151655n,
            ...Array<bigint>(FEATURES - 2).fill(151655n),
            30n,
        ]),
        [1, PROMPT_LENGTH],
    );
    const imageFeeds = () => ({
        pixel_values: new RuntimeTensor("float32", new Float32Array(PATCHES * 1536), [
            PATCHES,
            1536,
        ]),
        image_grid_thw: new RuntimeTensor("int64", new BigInt64Array([1n, 16n, 16n]), [1, 3]),
    });
    const decoderFeeds = (embeds: Feeds, previous?: Feeds): Feeds => {
        const sequence = embeds.inputs_embeds.dims[1];
        const past = previous?.[PRESENT_NAMES[0]].dims[2] ?? 0;
        return {
            ...embeds,
            attention_mask: new CallerTensor("int64", new BigInt64Array(past + sequence).fill(1n), [
                1,
                past + sequence,
            ]),
            position_ids: new CallerTensor("int64", new BigInt64Array(3 * sequence), [
                3,
                1,
                sequence,
            ]),
            ...Object.fromEntries(
                CACHE_NAMES.map((name, i) => [
                    name,
                    previous?.[PRESENT_NAMES[i]] ??
                        new CallerTensor("float32", new Float32Array(0), [1, 8, 0, 128]),
                ]),
            ),
        };
    };
    const prompt = async () => {
        const embeds = await sessions.embed_tokens.run({ input_ids: ids });
        await sessions.vision_encoder.run(imageFeeds());
        return sessions.decoder_model_merged.run(decoderFeeds(embeds));
    };
    return {
        sessions,
        ids,
        prompt,
        imageFeeds,
        decoderFeeds,
        events,
        decoderRuns,
        decoderResults,
        visionResults,
        visionRuns,
        embedResults,
        nativeTensors,
        loadedOptions,
        createdOptions,
        rawSessions,
        active: () => active,
    };
}

describe("actual generated Qwen DeepStack session transport", () => {
    it("keeps public interfaces while passing actual geometry and generation controls to native sessions", async () => {
        const h = await harness({
            learnedDataUnreadable: true,
            rawVision: (feeds) => {
                expect(Object.keys(feeds)).toEqual([
                    "pixel_values",
                    "image_grid_thw",
                    ...GEOMETRY.inputNames,
                ]);
                const expected = GEOMETRY.makeControls({
                    pixel_values: feeds.pixel_values,
                    image_grid_thw: feeds.image_grid_thw,
                });
                for (const name of GEOMETRY.inputNames) {
                    expect(feeds[name]).toBeInstanceOf(PinnedTensor);
                    expect(feeds[name]).not.toBeInstanceOf(CallerTensor);
                    expect(feeds[name].type).toBe(expected[name].type);
                    expect(feeds[name].dims).toEqual(expected[name].dims);
                    expect(feeds[name].data).toEqual(expected[name].data);
                    expect(feeds[name].dispose).not.toHaveBeenCalled();
                }
            },
            rawDecoder: (feeds) => {
                expect(Object.keys(feeds)).toHaveLength(71);
                const S = feeds.inputs_embeds.dims[1] + feeds.__openchat_input_ids.dims[1];
                const P = feeds[CACHE_NAMES[0]].dims[2],
                    T = P + S;
                const expected = [
                    [3n, 1n, 64n, 1n],
                    [1n, 1n, BigInt(S), BigInt(T)],
                    Array.from({ length: S }, (_, i) => BigInt(i)),
                    [BigInt(T)],
                    [BigInt(P), 0n],
                    [BigInt(T), BigInt(T)],
                    [0n, 0n, 0n, 0n, 0n, 0n, 0n, BigInt(1024 - T)],
                    [0n, 0n, 0n, 0n, 0n, 0n, BigInt(1024 - T), 0n],
                ];
                GENERATION.inputNames.forEach((name, i) => {
                    expect(feeds[name].type).toBe("int64");
                    expect([...feeds[name].data]).toEqual(expected[i]);
                    expect(feeds[name].dispose).not.toHaveBeenCalled();
                });
            },
        });
        expect(h.sessions.decoder_model_merged.inputNames).toHaveLength(59);
        expect(h.sessions.vision_encoder.inputNames).toEqual(["pixel_values", "image_grid_thw"]);
        expect(h.rawSessions.get("vision_encoder")?.inputNames).toHaveLength(15);
        expect(h.rawSessions.get("vision_encoder")?.outputNames).toEqual([
            "image_features",
            ...OUTPUTS,
        ]);
        const output = await h.prompt();
        expect(h.rawSessions.get("decoder_model_merged")?.inputNames).toHaveLength(71);
        expect(Object.keys(output)).toEqual(["logits", ...PRESENT_NAMES]);
        const cached = await h.sessions.embed_tokens.run({
            input_ids: new CallerTensor("int64", new BigInt64Array([99n]), [1, 1]),
        });
        const feeds = h.decoderFeeds(cached, output);
        const next = await h.sessions.decoder_model_merged.run(feeds);
        for (const name of PRESENT_NAMES)
            expect(next[name].dims).toEqual([1, 8, PROMPT_LENGTH + 1, 128]);
        for (const name of GEOMETRY.inputNames)
            expect(h.visionRuns[0][name].dispose).toHaveBeenCalledOnce();
        for (const run of h.decoderRuns)
            for (const name of GENERATION.inputNames)
                expect(run[name].dispose).toHaveBeenCalledOnce();
        for (const tensor of Object.values(feeds)) expect(tensor.dispose).not.toHaveBeenCalled();
        await h.sessions.decoder_model_merged.release();
        expect(h.active()).toBe(0);
    });

    it("uses strict all-WebGPU options for every Qwen stage without changing Gemma options", async () => {
        const h = await harness();
        await h.prompt();
        expect(h.createdOptions.map((entry) => entry.name)).toEqual([
            "vision_encoder",
            "embed_tokens",
            "decoder_model_merged",
        ]);
        for (const { options } of h.createdOptions) {
            expect(options.executionProviders).toEqual([
                { name: "webgpu", preferredLayout: "NCHW" },
            ]);
            expect(options.graphOptimizationLevel).toBe("disabled");
            expect(options.extra).toMatchObject({
                session: { disable_cpu_ep_fallback: "1", original_test_option: "preserved" },
                "ep.webgpuexecutionprovider.enableInt64": "1",
            });
            expect(Object.keys(options).some((key) => key.startsWith("openchat_"))).toBe(false);
        }
        for (const { name } of h.createdOptions) expect(h.events).toContain(`drain:${name}`);
        await h.sessions.decoder_model_merged.release();
        const gemma = await harness({ gemma: true });
        expect(gemma.createdOptions).toHaveLength(1);
        expect(gemma.createdOptions[0].name).toBe("vision_encoder");
        expect(gemma.createdOptions[0].options).toMatchObject({
            executionProviders: [{ name: "webgpu", preferredLayout: "NHWC" }],
            graphOptimizationLevel: "all",
            extra: { session: { original_test_option: "preserved" } },
        });
        expect(gemma.createdOptions[0].options.extra).toEqual({
            session: { original_test_option: "preserved" },
        });
        await gemma.sessions.vision_encoder.release();
        expect(gemma.active()).toBe(0);
    });

    it("places all three feature rows only at original image IDs, then sends zeros for cached steps", async () => {
        const h = await harness();
        const previous = await h.prompt();
        const first = h.decoderRuns[0];
        INPUTS.forEach((key, stage) => {
            expect(first[key]).toBeInstanceOf(PinnedTensor);
            expect(first[key]).not.toBeInstanceOf(CallerTensor);
            expect(first[key].dims).toEqual([1, PROMPT_LENGTH, HIDDEN]);
            const data = first[key].data;
            expect([0, 1, 2, 3, PROMPT_LENGTH - 1].map((row) => data[row * HIDDEN])).toEqual([
                0,
                stage + 1,
                0,
                stage + 11,
                0,
            ]);
            for (let row = 2; row < FEATURES; row++) {
                expect(data[IMAGE_POSITIONS[row] * HIDDEN]).toBe(stage + 100 + row);
                expect(data[IMAGE_POSITIONS[row] * HIDDEN + HIDDEN - 1]).toBe(stage + 100 + row);
            }
            expect(first[key].dispose).toHaveBeenCalledOnce();
        });
        for (const key of OUTPUTS) expect(h.visionResults[0][key].dispose).toHaveBeenCalledOnce();
        expect(h.events.indexOf("release:vision_encoder:0")).toBeLessThan(
            h.events.indexOf("load:decoder_model_merged:0"),
        );
        const cached = await h.sessions.embed_tokens.run({
            input_ids: new CallerTensor("int64", new BigInt64Array([99n]), [1, 1]),
        });
        await h.sessions.decoder_model_merged.run(h.decoderFeeds(cached, previous));
        expect(h.decoderRuns[1].inputs_embeds.dims).toEqual([1, 0, HIDDEN]);
        for (const key of INPUTS) {
            expect(h.decoderRuns[1][key].dims).toEqual([1, 1, HIDDEN]);
            expect(h.decoderRuns[1][key].data.every((v) => v === 0)).toBe(true);
            expect(h.decoderRuns[1][key].dispose).toHaveBeenCalledOnce();
        }
        await h.sessions.decoder_model_merged.release();
        await h.sessions.embed_tokens.release();
        expect(h.active()).toBe(0);
    });

    it("keeps a private immutable copy of the original prompt IDs", async () => {
        const h = await harness();
        const embeds = await h.sessions.embed_tokens.run({ input_ids: h.ids });
        (h.ids.data as BigInt64Array).fill(0n);
        await h.sessions.vision_encoder.run(h.imageFeeds());
        await h.sessions.decoder_model_merged.run(h.decoderFeeds(embeds));
        expect(h.decoderRuns[0][INPUTS[0]].data[HIDDEN]).toBe(1);
    });

    it("rejects a different configured image-token ID before creating sessions", async () => {
        await expect(harness({ tokenId: 151654 })).rejects.toThrow(/image.token/i);
    });

    it.each(["missing", "extra", "rank", "gpu", "count", "nonfinite", "constructor", "buffer"])(
        "fails closed for %s vision output",
        async (kind) => {
            const h = await harness({
                vision: (o) => {
                    if (kind === "missing") delete o[OUTPUTS[1]];
                    if (kind === "extra") o.__openchat_deepstack_features_3 = o[OUTPUTS[0]];
                    if (kind === "rank") o[OUTPUTS[0]].dims.splice(0, 2, 1, FEATURES, HIDDEN);
                    if (kind === "gpu") o[OUTPUTS[0]].location = "gpu-buffer";
                    if (kind === "count")
                        o[OUTPUTS[0]] = new PinnedTensor("float32", new Float32Array(HIDDEN), [
                            1,
                            HIDDEN,
                        ]);
                    if (kind === "nonfinite") (o[OUTPUTS[0]].data as Float32Array)[0] = NaN;
                    if (kind === "constructor")
                        o[OUTPUTS[0]] = new CallerTensor(
                            "float32",
                            new Float32Array(FEATURES * HIDDEN),
                            [FEATURES, HIDDEN],
                        );
                    if (kind === "buffer")
                        o[OUTPUTS[0]] = new PinnedTensor("float32", new Float32Array(HIDDEN), [
                            FEATURES,
                            HIDDEN,
                        ]);
                    return o;
                },
            });
            await expect(h.prompt()).rejects.toThrow(/DeepStack|feature|vision/i);
            expect(h.decoderRuns).toHaveLength(0);
            expect(h.events.some((e) => e.startsWith("load:decoder"))).toBe(false);
        },
    );

    it("rejects missing image-token slots and unsupported multirow prompts", async () => {
        const missing = await harness();
        (missing.ids.data as BigInt64Array).fill(7n);
        await expect(missing.prompt()).rejects.toThrow(/count|image.token/i);
        expect(missing.decoderRuns).toHaveLength(0);
        const multirow = await harness();
        await expect(
            multirow.sessions.embed_tokens.run({
                input_ids: new CallerTensor("int64", new BigInt64Array([151655n, 151655n]), [2, 1]),
            }),
        ).rejects.toThrow(/batch|input_ids/i);
    });

    it.each(["missing", "wrong-rank", "wrong-type", "wrong-name"])(
        "rejects %s private decoder metadata",
        async (kind) => {
            const h = await harness({
                privateMetadata: (m) => {
                    if (kind === "missing") m.splice(3, 1);
                    if (kind === "wrong-rank") m[2].shape = ["batch_size", HIDDEN];
                    if (kind === "wrong-type") m[1].type = "float16";
                    if (kind === "wrong-name") m[3].name = "unreviewed";
                    return m;
                },
            });
            await expect(h.prompt()).rejects.toThrow(/private input/i);
            expect(h.decoderRuns).toHaveLength(0);
            expect(h.active()).toBe(0);
        },
    );

    it("disposes private feeds after raw failure and refuses stale prompt retry", async () => {
        const h = await harness({ decoderError: true });
        await expect(h.prompt()).rejects.toThrow("expected raw decoder failure");
        for (const key of [...INPUTS, ...GENERATION.inputNames])
            expect(h.decoderRuns[0][key].dispose).toHaveBeenCalledOnce();
        await expect(
            h.sessions.decoder_model_merged.run({
                inputs_embeds: new PinnedTensor(
                    "float32",
                    new Float32Array(PROMPT_LENGTH * HIDDEN),
                    [1, PROMPT_LENGTH, HIDDEN],
                ),
            }),
        ).rejects.toThrow(/failed|unavailable|prompt/i);
        expect(h.decoderRuns).toHaveLength(1);
    });

    it("drops unused vision features on release and never reuses them for another request", async () => {
        const h = await harness();
        const embeds = await h.sessions.embed_tokens.run({ input_ids: h.ids });
        await h.sessions.vision_encoder.run(h.imageFeeds());
        await h.sessions.vision_encoder.release();
        await expect(h.sessions.decoder_model_merged.run(h.decoderFeeds(embeds))).rejects.toThrow(
            /feature|prompt|released/i,
        );
        await expect(h.sessions.vision_encoder.run(h.imageFeeds())).rejects.toThrow(
            /released|failed/i,
        );
        expect(h.decoderRuns).toHaveLength(0);
    });

    it("copies feature bytes before upstream drops outputs, preserving negative zero bits", async () => {
        const h = await harness({
            vision: (o) => {
                (o[OUTPUTS[0]].data as Float32Array)[0] = -0;
                return o;
            },
        });
        const embeds = await h.sessions.embed_tokens.run({ input_ids: h.ids });
        const returned = await h.sessions.vision_encoder.run(h.imageFeeds());
        expect(Object.keys(returned)).toEqual(["image_features"]);
        for (const key of OUTPUTS) (h.visionResults[0][key].data as Float32Array).fill(-123);
        await h.sessions.decoder_model_merged.run(h.decoderFeeds(embeds));
        const data = h.decoderRuns[0][INPUTS[0]].data as Float32Array;
        expect(Object.is(data[HIDDEN], -0)).toBe(true);
        expect(data[HIDDEN + 1]).toBe(1);
        expect(data[3 * HIDDEN]).toBe(11);
    });

    it("rejects overlapping decoder calls and disposes late results/private feeds after release", async () => {
        let resolveRun!: () => void;
        const blocked = new Promise<void>((resolve) => {
            resolveRun = resolve;
        });
        const h = await harness({ decoderWait: () => blocked });
        const embeds = await h.sessions.embed_tokens.run({ input_ids: h.ids });
        await h.sessions.vision_encoder.run(h.imageFeeds());
        const feeds = h.decoderFeeds(embeds);
        const running = h.sessions.decoder_model_merged.run(feeds);
        const rejected = expect(running).rejects.toThrow(/released|retired/);
        await vi.waitFor(() => expect(h.decoderRuns).toHaveLength(1));
        await expect(h.sessions.decoder_model_merged.run(feeds)).rejects.toThrow(/already running/);
        let released = false;
        const releasing = h.sessions.decoder_model_merged.release().then(() => {
            released = true;
        });
        await Promise.resolve();
        expect(released).toBe(false);
        expect(h.events).not.toContain("release-start:decoder_model_merged");
        for (const key of [...INPUTS, ...GENERATION.inputNames])
            expect(h.decoderRuns[0][key].dispose).not.toHaveBeenCalled();
        resolveRun();
        await rejected;
        await releasing;
        for (const tensor of Object.values(h.decoderResults[0]))
            expect(tensor.dispose).toHaveBeenCalledOnce();
        for (const key of [...INPUTS, ...GENERATION.inputNames])
            expect(h.decoderRuns[0][key].dispose).toHaveBeenCalledOnce();
        for (const tensor of Object.values(feeds)) expect(tensor.dispose).not.toHaveBeenCalled();
        expect(h.active()).toBe(0);
    });

    it("waits for pending decoder creation before retiring the new session and outer private feeds", async () => {
        const gate = deferred();
        const h = await harness({
            createWait: async (name) => {
                if (name === "decoder_model_merged") await gate.promise;
            },
        });
        const embeds = await h.sessions.embed_tokens.run({ input_ids: h.ids });
        await h.sessions.vision_encoder.run(h.imageFeeds());
        const before = h.nativeTensors.length;
        const running = h.sessions.decoder_model_merged.run(h.decoderFeeds(embeds));
        const rejected = expect(running).rejects.toThrow(/released|retired/);
        await vi.waitFor(() => expect(h.events).toContain("create-start:decoder_model_merged"));
        const owned = h.nativeTensors.slice(before);
        expect(owned).toHaveLength(4); // Three DeepStack inputs and the empty private ID input.
        let completed = 0;
        const releases = [
            h.sessions.decoder_model_merged.release(),
            h.sessions.decoder_model_merged.release(),
        ].map((release) =>
            release.then(() => {
                completed++;
            }),
        );
        await Promise.resolve();
        expect(completed).toBe(0);
        for (const tensor of owned) expect(tensor.dispose).not.toHaveBeenCalled();
        expect(h.events).not.toContain("release-start:decoder_model_merged");
        gate.resolve();
        await rejected;
        await Promise.all(releases);
        expect(h.decoderRuns).toHaveLength(0);
        expect(
            h.events.filter((event) => event === "release-start:decoder_model_merged"),
        ).toHaveLength(1);
        for (const tensor of owned) expect(tensor.dispose).toHaveBeenCalledOnce();
        expect(h.active()).toBe(0);
    });

    it("shares the pending decoder retirement instead of acknowledging a second release early", async () => {
        const gate = deferred();
        const h = await harness({
            releaseWait: async (name) => {
                if (name === "decoder_model_merged") await gate.promise;
            },
        });
        await h.prompt();
        let completed = 0;
        const first = h.sessions.decoder_model_merged.release().then(() => {
            completed++;
        });
        await vi.waitFor(() => expect(h.events).toContain("release-start:decoder_model_merged"));
        const second = h.sessions.decoder_model_merged.release().then(() => {
            completed++;
        });
        await Promise.resolve();
        expect(completed).toBe(0);
        expect(h.active()).toBe(1);
        gate.resolve();
        await Promise.all([first, second]);
        expect(completed).toBe(2);
        expect(
            h.events.filter((event) => event === "release-start:decoder_model_merged"),
        ).toHaveLength(1);
        expect(h.active()).toBe(0);
    });

    it.each(["run", "release"])(
        "waits for pending embedding %s before retiring the facade",
        async (phase) => {
            const gate = deferred();
            const h = await harness({
                embedWait: phase === "run" ? () => gate.promise : undefined,
                releaseWait:
                    phase === "release"
                        ? async (name) => {
                              if (name === "embed_tokens") await gate.promise;
                          }
                        : undefined,
            });
            const running = h.sessions.embed_tokens.run({ input_ids: h.ids });
            const rejected = expect(running).rejects.toThrow(/released|retired/);
            await vi.waitFor(() =>
                expect(h.events).toContain(
                    phase === "run" ? "run:embed_tokens" : "release-start:embed_tokens",
                ),
            );
            let completed = 0;
            const releases = [
                h.sessions.embed_tokens.release(),
                h.sessions.embed_tokens.release(),
            ].map((release) =>
                release.then(() => {
                    completed++;
                }),
            );
            await Promise.resolve();
            expect(completed).toBe(0);
            expect(h.ids.dispose).not.toHaveBeenCalled();
            if (phase === "run") expect(h.events).not.toContain("release-start:embed_tokens");
            gate.resolve();
            await rejected;
            await Promise.all(releases);
            expect(h.embedResults[0].inputs_embeds.dispose).toHaveBeenCalledOnce();
            expect(h.events.filter((event) => event === "release-start:embed_tokens")).toHaveLength(
                1,
            );
            expect(h.ids.dispose).not.toHaveBeenCalled();
            await h.sessions.vision_encoder.release();
            expect(h.active()).toBe(0);
        },
    );

    it("wraps the frozen vision facade mutably and drains its actual native call before release", async () => {
        const gate = deferred();
        const h = await harness({ visionWait: () => gate.promise });
        const vision = h.sessions.vision_encoder;
        expect(Object.isFrozen(vision)).toBe(false);
        expect(Object.getOwnPropertyDescriptor(vision, "run")?.writable).toBe(true);
        expect(vision).not.toBe(h.rawSessions.get("vision_encoder"));
        const originalRun = vision.run;
        vision.run = (...args) => originalRun(...args);
        await h.sessions.embed_tokens.run({ input_ids: h.ids });
        const feeds = h.imageFeeds();
        const running = vision.run(feeds);
        const rejected = expect(running).rejects.toThrow(/released|retired/);
        await vi.waitFor(() => expect(h.visionRuns).toHaveLength(1));
        await expect(vision.run(feeds)).rejects.toThrow(/already running|Concurrent/);
        let completed = 0;
        const releases = [vision.release(), vision.release()].map((release) =>
            release.then(() => {
                completed++;
            }),
        );
        await Promise.resolve();
        expect(completed).toBe(0);
        expect(h.events).not.toContain("release-start:vision_encoder");
        for (const name of GEOMETRY.inputNames)
            expect(h.visionRuns[0][name].dispose).not.toHaveBeenCalled();
        gate.resolve();
        await rejected;
        await Promise.all(releases);
        for (const tensor of Object.values(h.visionResults[0]))
            expect(tensor.dispose).toHaveBeenCalledOnce();
        for (const name of GEOMETRY.inputNames)
            expect(h.visionRuns[0][name].dispose).toHaveBeenCalledOnce();
        for (const tensor of Object.values(feeds)) expect(tensor.dispose).not.toHaveBeenCalled();
        expect(h.events.filter((event) => event === "release-start:vision_encoder")).toHaveLength(
            1,
        );
        expect(h.active()).toBe(0);
    });

    it.each(["geometry", "generation"])(
        "detects native mutation of %s controls and retires owned inputs",
        async (kind) => {
            const h = await harness({
                rawVision:
                    kind === "geometry"
                        ? (feeds) => {
                              (feeds[GEOMETRY.inputNames[0]].data as BigInt64Array)[0] = 100n;
                          }
                        : undefined,
                rawDecoder:
                    kind === "generation"
                        ? (feeds) => {
                              (feeds[GENERATION.inputNames[0]].data as BigInt64Array)[0] = 100n;
                          }
                        : undefined,
            });
            await expect(h.prompt()).rejects.toThrow(/control|geometry/i);
            const runs = kind === "geometry" ? h.visionRuns : h.decoderRuns;
            const names = kind === "geometry" ? GEOMETRY.inputNames : GENERATION.inputNames;
            for (const name of names) expect(runs[0][name].dispose).toHaveBeenCalledOnce();
            const outputs = kind === "geometry" ? h.visionResults : h.decoderResults;
            for (const tensor of Object.values(outputs[0]))
                expect(tensor.dispose).toHaveBeenCalledOnce();
            if (kind === "geometry") expect(h.decoderRuns).toHaveLength(0);
        },
    );

    it.each(["logits-shape", "cache-shape", "cache-type", "missing-cache"])(
        "rejects %s native decoder outputs with complete private cleanup",
        async (kind) => {
            const h = await harness({
                decoderOutput: (outputs) => {
                    if (kind === "logits-shape") outputs.logits.dims[1] = PROMPT_LENGTH;
                    if (kind === "cache-shape") outputs[PRESENT_NAMES[55]].dims[2]--;
                    if (kind === "cache-type")
                        Object.defineProperty(outputs[PRESENT_NAMES[55]], "type", {
                            value: "float16",
                        });
                    if (kind === "missing-cache") delete outputs[PRESENT_NAMES[55]];
                    return outputs;
                },
            });
            await expect(h.prompt()).rejects.toThrow(/logits|present|output/i);
            for (const name of [...INPUTS, ...GENERATION.inputNames])
                expect(h.decoderRuns[0][name].dispose).toHaveBeenCalledOnce();
            for (const tensor of Object.values(h.decoderResults[0]))
                expect(tensor.dispose).toHaveBeenCalledOnce();
            await h.sessions.decoder_model_merged.release();
            expect(h.active()).toBe(0);
        },
    );

    it("rejects a broken decode cache chain before a second native call", async () => {
        const h = await harness();
        const previous = await h.prompt();
        const cached = await h.sessions.embed_tokens.run({
            input_ids: new CallerTensor("int64", new BigInt64Array([99n]), [1, 1]),
        });
        const feeds = h.decoderFeeds(cached, previous);
        feeds[CACHE_NAMES[55]] = new CallerTensor("float32", new Float32Array(0), [
            1,
            8,
            PROMPT_LENGTH - 1,
            128,
        ]);
        await expect(h.sessions.decoder_model_merged.run(feeds)).rejects.toThrow(
            /dimensions|continuity/i,
        );
        expect(h.decoderRuns).toHaveLength(1);
        for (const tensor of Object.values(feeds)) expect(tensor.dispose).not.toHaveBeenCalled();
        await h.sessions.decoder_model_merged.release();
        expect(h.active()).toBe(0);
    });

    it("retires a just-created native session when the compile-done reporter throws", async () => {
        const failure = new Error("expected compile reporter failure");
        const events: string[] = [];
        let raw: Session | undefined;
        await expect(
            harness({
                events,
                report: (_name, phase) => {
                    if (phase === "compile-done") throw failure;
                },
                nativeCreated: (_name, session) => {
                    raw = session;
                    vi.spyOn(session, "release");
                },
            }),
        ).rejects.toBe(failure);
        expect(raw?.release).toHaveBeenCalledOnce();
        expect(events.filter((event) => event.startsWith("load:"))).toEqual([
            "load:vision_encoder:0",
        ]);
        expect(events).toContain("release:vision_encoder:0");
    });

    it.each([new Error("expected feature disposal failure"), undefined, null, 0])(
        "preserves the first transferred vision cleanup error and attempts all disposal: %s",
        async (failure) => {
            const h = await harness({
                vision: (outputs) => {
                    outputs[OUTPUTS[0]].dispose.mockImplementation(() => {
                        throw failure;
                    });
                    outputs.image_features.dispose.mockImplementation(() => {
                        throw new Error("secondary image disposal failure");
                    });
                    return outputs;
                },
            });
            await h.sessions.embed_tokens.run({ input_ids: h.ids });
            await expect(h.sessions.vision_encoder.run(h.imageFeeds())).rejects.toBe(failure);
            for (const tensor of Object.values(h.visionResults[0]))
                expect(tensor.dispose).toHaveBeenCalledOnce();
            for (const name of GEOMETRY.inputNames)
                expect(h.visionRuns[0][name].dispose).toHaveBeenCalledOnce();
            expect(h.decoderRuns).toHaveLength(0);
            await h.sessions.vision_encoder.release();
            expect(h.active()).toBe(0);
        },
    );

    it("preserves a private constructor error while attempting all prior DeepStack feed cleanup", async () => {
        const failure = new Error("expected third private constructor failure");
        let armed = false,
            attempts = 0;
        const allocated: PinnedTensor[] = [];
        const isPrivateShape = (type: string, dims: number[]) =>
            type === "float32" &&
            JSON.stringify(dims) === JSON.stringify([1, PROMPT_LENGTH, HIDDEN]);
        const h = await harness({
            tensorConstructor: (type, dims) => {
                if (armed && isPrivateShape(type, dims) && ++attempts === 3) throw failure;
            },
            tensorCreated: (tensor) => {
                if (armed && isPrivateShape(tensor.type, tensor.dims)) {
                    allocated.push(tensor);
                    if (allocated.length === 1)
                        tensor.dispose.mockImplementation(() => {
                            throw new Error("secondary cleanup failure");
                        });
                }
            },
        });
        const embeds = await h.sessions.embed_tokens.run({ input_ids: h.ids });
        await h.sessions.vision_encoder.run(h.imageFeeds());
        const feeds = h.decoderFeeds(embeds);
        armed = true;
        await expect(h.sessions.decoder_model_merged.run(feeds)).rejects.toBe(failure);
        expect(attempts).toBe(3);
        expect(allocated).toHaveLength(2);
        for (const tensor of allocated) expect(tensor.dispose).toHaveBeenCalledOnce();
        for (const tensor of Object.values(feeds)) expect(tensor.dispose).not.toHaveBeenCalled();
        expect(h.decoderRuns).toHaveLength(0);
        await h.sessions.decoder_model_merged.release();
        await h.sessions.vision_encoder.release();
        expect(h.active()).toBe(0);
    });
});

describe("actual Qwen staged external-data loader", () => {
    type Artifact = { path: string; bytes: number; sha256: string };
    const artifacts: Artifact[] = [
        { path: "onnx/vision_encoder_q4.onnx_data", bytes: 3, sha256: "a".repeat(64) },
        { path: "onnx/vision_encoder_q4_deepstack.onnx_data", bytes: 5, sha256: "b".repeat(64) },
        { path: "onnx/decoder_model_merged_q4.onnx_data", bytes: 7, sha256: "c".repeat(64) },
        { path: "onnx/embed_tokens_q4.onnx_data", bytes: 2, sha256: "d".repeat(64) },
    ];
    function loader(change?: string) {
        const source = fs.readFileSync(
            path.resolve(import.meta.dirname, "../workers/transformersWebGpuInference.worker.ts"),
            "utf8",
        );
        const start = source.indexOf("const getStagedExternalData = async");
        const fn = source.slice(start, source.indexOf("const getJson = async", start));
        const emitted = ts.transpileModule(fn, {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const match = vi.fn(async (url: string) => {
            const artifact = artifacts.find((a) => a.path === url);
            if (!artifact) return undefined;
            const deep = url.includes("deepstack");
            if (deep && change === "missing-cache") return undefined;
            const headers = new Headers({
                "content-length": String(artifact.bytes),
                "x-content-sha256": artifact.sha256,
                "x-openchat-model-revision": "revision",
            });
            if (deep && change === "hash") headers.set("x-content-sha256", "e".repeat(64));
            if (deep && change === "revision") headers.set("x-openchat-model-revision", "other");
            if (deep && change === "length") headers.set("content-length", "4");
            return {
                ok: true,
                headers,
                blob: async () =>
                    new Blob([new Uint8Array(deep && change === "blob-size" ? 4 : artifact.bytes)]),
            };
        });
        const selected =
            change === "missing-manifest"
                ? artifacts.filter((a) => !a.path.includes("deepstack"))
                : artifacts;
        const fnFactory = new Function(
            "spec",
            "CACHE_DIGEST_HEADER",
            "artifactCache",
            "getArtifactUrl",
            `${emitted};return getStagedExternalData;`,
        );
        const get = fnFactory(
            {
                artifacts: selected,
                revision: "revision",
                externalData: catalog.models[0].externalData,
            },
            "x-content-sha256",
            { match },
            (path: string) => path,
        ) as (name: string) => Promise<{ path: string; data: Blob }[]>;
        return { get, match };
    }
    it("provides original and DeepStack vision blobs, keeping decoder/embed single-shard", async () => {
        const h = loader();
        const vision = await h.get("vision_encoder");
        expect(vision.map((v) => [v.path, v.data.size])).toEqual([
            ["vision_encoder_q4.onnx_data", 3],
            ["vision_encoder_q4_deepstack.onnx_data", 5],
        ]);
        expect((await h.get("decoder_model_merged")).map((v) => v.path)).toEqual([
            "decoder_model_merged_q4.onnx_data",
        ]);
        expect((await h.get("embed_tokens")).map((v) => v.path)).toEqual([
            "embed_tokens_q4.onnx_data",
        ]);
        await expect(h.get("unreviewed")).rejects.toThrow(/Unexpected staged/);
    });
    it.each(["missing-manifest", "missing-cache", "hash", "revision", "length", "blob-size"])(
        "refuses a %s DeepStack shard without bypass",
        async (change) => {
            await expect(loader(change).get("vision_encoder")).rejects.toThrow(
                /manifest|metadata|byte size/,
            );
        },
    );
});
