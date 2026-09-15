// @vitest-environment node
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi as vitest } from "vitest";
import { patchQwen3Vl2bDecoderGraph } from "../../transformersWebGpuDecoderGraph.mjs";
import {
    patchQwen3Vl2bDeepStackDecoderGraph,
    patchQwen3Vl2bDeepStackVisionGraph,
    QWEN3_VL_2B_DEEPSTACK_DATA,
    QWEN3_VL_2B_DEEPSTACK_DECODER_BYTES,
    QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS,
    QWEN3_VL_2B_DEEPSTACK_DECODER_SHA256,
    QWEN3_VL_2B_DEEPSTACK_VISION_BYTES,
    QWEN3_VL_2B_DEEPSTACK_VISION_OUTPUTS,
    QWEN3_VL_2B_DEEPSTACK_VISION_SHA256,
} from "../../transformersWebGpuDeepStackGraph.mjs";

const require = createRequire(import.meta.url);
const modules = path.resolve(import.meta.dirname, "../../../node_modules");
const schema = require(
    path.join(modules, "onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js"),
).onnx;
const sourcePath = (name: string) =>
    path.resolve(import.meta.dirname, "../../model-overrides/qwen3vl2b/onnx", name);
const visionSource = fs.readFileSync(sourcePath("vision_encoder_q4.onnx"));
const decoderSource = Buffer.from(
    patchQwen3Vl2bDecoderGraph(fs.readFileSync(sourcePath("decoder_model_merged_q4.onnx"))),
);
const decode = (bytes: Uint8Array) => schema.ModelProto.decode(Buffer.from(bytes));
type Model = ReturnType<typeof decode>;
type Named = { name: string };
type Node = Named & {
    input: string[];
    output: string[];
    opType: string;
    attribute: Array<Named & { i: number; f: number; s: Uint8Array }>;
};
const encode = (model: Model) => Buffer.from(schema.ModelProto.encode(model).finish());
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const same = (type: { encode(value: unknown): { finish(): Uint8Array } }, a: unknown, b: unknown) =>
    Buffer.from(type.encode(a).finish()).equals(Buffer.from(type.encode(b).finish()));
const patchedVision = () => decode(patchQwen3Vl2bDeepStackVisionGraph(visionSource));
const patchedDecoder = () => decode(patchQwen3Vl2bDeepStackDecoderGraph(decoderSource));
const prefix = "__openchat/deepstack/";
const boundary = /^\/model\/layers\.[123]\/input_layernorm\/SkipLayerNorm$/;

describe("Pinned Qwen3 DeepStack graph correction", () => {
    it("accepts Node Buffers when the embedding environment has a different Uint8Array realm", () => {
        const otherRealm = runInNewContext("Uint8Array");
        expect(visionSource instanceof otherRealm).toBe(false);
        vitest.stubGlobal("Uint8Array", otherRealm);
        try {
            expect(hash(patchQwen3Vl2bDeepStackVisionGraph(visionSource))).toBe(
                QWEN3_VL_2B_DEEPSTACK_VISION_SHA256,
            );
            expect(hash(patchQwen3Vl2bDeepStackDecoderGraph(decoderSource))).toBe(
                QWEN3_VL_2B_DEEPSTACK_DECODER_SHA256,
            );
        } finally {
            vitest.unstubAllGlobals();
        }
    });

    it("pins immutable outputs, copies input bytes, and preserves unrelated graph metadata and weights", () => {
        for (const [source, patch, bytes, digest, decoder] of [
            [
                visionSource,
                patchQwen3Vl2bDeepStackVisionGraph,
                QWEN3_VL_2B_DEEPSTACK_VISION_BYTES,
                QWEN3_VL_2B_DEEPSTACK_VISION_SHA256,
                false,
            ],
            [
                decoderSource,
                patchQwen3Vl2bDeepStackDecoderGraph,
                QWEN3_VL_2B_DEEPSTACK_DECODER_BYTES,
                QWEN3_VL_2B_DEEPSTACK_DECODER_SHA256,
                true,
            ],
        ] as const) {
            const before = Buffer.from(source);
            const result = patch(source);
            expect(Buffer.isBuffer(result)).toBe(true);
            expect(result.byteLength).toBe(bytes);
            expect(hash(result)).toBe(digest);
            expect(source.equals(before)).toBe(true);
            const original = decode(source);
            const next = decode(result);
            expect(
                same(
                    schema.GraphProto,
                    { node: next.graph.node.filter((n: Named) => !n.name.startsWith(prefix)) },
                    {
                        node: original.graph.node.filter(
                            (n: Named) => !decoder || !boundary.test(n.name),
                        ),
                    },
                ),
            ).toBe(true);
            expect(
                same(
                    schema.GraphProto,
                    {
                        initializer: next.graph.initializer.slice(
                            0,
                            original.graph.initializer.length,
                        ),
                    },
                    { initializer: original.graph.initializer },
                ),
            ).toBe(true);
            expect(
                same(
                    schema.GraphProto,
                    {
                        input: next.graph.input.slice(0, original.graph.input.length),
                        output: next.graph.output.slice(0, original.graph.output.length),
                    },
                    { input: original.graph.input, output: original.graph.output },
                ),
            ).toBe(true);
            for (const key of ["node", "initializer", "input", "output"])
                next.graph[key] = original.graph[key];
            expect(encode(next).equals(encode(original))).toBe(true);
            result[0] ^= 1;
            expect(source.equals(before)).toBe(true);
        }
    });

    it("forks only post-MLP layers5/11/17, reshapes BEFORE its own learned normalization, and keeps image_features", () => {
        const graph = patchedVision().graph;
        expect(graph.node.length).toBe(decode(visionSource).graph.node.length + 15);
        expect(graph.output.map((v: Named) => v.name)).toEqual([
            "image_features",
            ...QWEN3_VL_2B_DEEPSTACK_VISION_OUTPUTS,
        ]);
        for (let i = 0; i < 3; i++) {
            const nodes = graph.node.filter((n: Named) =>
                n.name.startsWith(`${prefix}vision/${i}/`),
            );
            expect(nodes.map((n: Node) => n.opType)).toEqual([
                "Reshape",
                "LayerNormalization",
                "Gemm",
                "Gelu",
                "Gemm",
            ]);
            expect(nodes[0].input[0]).toBe(`/model/layers.${[5, 11, 17][i]}/Add_MLP/output_0`);
            for (let j = 1; j < nodes.length; j++)
                expect(nodes[j].input[0]).toBe(nodes[j - 1].output[0]);
            expect(
                Number(nodes[1].attribute.find((a: Named) => a.name === "epsilon").f),
            ).toBeCloseTo(1e-6, 12);
            expect(Number(nodes[1].attribute.find((a: Named) => a.name === "axis").i)).toBe(-1);
            expect(nodes[1].input.slice(1)).toEqual([
                `__openchat_deepstack_merger_${i}_norm.weight`,
                `__openchat_deepstack_merger_${i}_norm.bias`,
            ]);
            for (const index of [2, 4])
                expect(
                    Number(nodes[index].attribute.find((a: Named) => a.name === "transB").i),
                ).toBe(1);
            expect(Buffer.from(nodes[3].attribute[0].s).toString()).toBe("none");
            expect(nodes[4].output).toEqual([QWEN3_VL_2B_DEEPSTACK_VISION_OUTPUTS[i]]);
            expect(graph.output[i + 1].type.tensorType.elemType).toBe(1);
            expect(
                graph.output[i + 1].type.tensorType.shape.dim.map(
                    (d: { dimParam: string; dimValue: number }) => d.dimParam || Number(d.dimValue),
                ),
            ).toEqual(["num_features", 2048]);
        }
        const shape = graph.initializer.find(
            (t: Named) => t.name === "__openchat_deepstack_merge_shape",
        );
        expect([
            Buffer.from(shape.rawData).readBigInt64LE(0),
            Buffer.from(shape.rawData).readBigInt64LE(8),
        ]).toEqual([-1n, 4096n]);
    });

    it("adds exactly the18 lossless FP32 tensor ranges, with no overlap, gaps, quantization or existing-shard edits", () => {
        const before = decode(visionSource).graph.initializer.length;
        const added = patchedVision().graph.initializer.slice(before);
        expect(added).toHaveLength(19);
        const relativeOffsets = [0, 16384, 67125248, 67133440, 100687872, 100704256];
        const lengths = [16384, 67108864, 8192, 33554432, 16384, 16384];
        const dims = [[4096], [4096, 4096], [2048], [2048, 4096], [4096], [4096]];
        let end = 0;
        for (const [index, tensor] of added.slice(1).entries()) {
            const external = Object.fromEntries(
                tensor.externalData.map((e: { key: string; value: string }) => [e.key, e.value]),
            );
            const offset = Math.floor(index / 6) * 100720640 + relativeOffsets[index % 6];
            expect(external).toEqual({
                location: "vision_encoder_q4_deepstack.onnx_data",
                offset: String(offset),
                length: String(lengths[index % 6]),
            });
            expect(offset).toBe(end);
            expect(tensor.dataType).toBe(1);
            expect(tensor.dataLocation).toBe(1);
            expect(tensor.rawData.length).toBe(0);
            expect(tensor.dims.map(Number)).toEqual(dims[index % 6]);
            end = offset + lengths[index % 6];
        }
        expect(end).toBe(302161920);
        expect(QWEN3_VL_2B_DEEPSTACK_DATA.bytes).toBe(end);
        expect(QWEN3_VL_2B_DEEPSTACK_DATA.sha256).toBe(
            "f331bfc4a32c5dcda5a3589283acd90672f8f903cda0d8f425f8aaaf0b148168",
        );
    });

    it("replaces three fused boundaries with (A+B)+DS then RMS, preserving residual output3 and all consumers", () => {
        const before = decode(decoderSource).graph;
        const after = patchedDecoder().graph;
        expect(after.node.length).toBe(before.node.length + 6);
        expect(after.initializer.length).toBe(before.initializer.length);
        expect(after.input.slice(-4).map((v: Named) => v.name)).toEqual([
            "__openchat_input_ids",
            ...QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS,
        ]);
        for (let i = 0; i < 3; i++) {
            const original = before.node.find(
                (n: Named) => n.name === `/model/layers.${i + 1}/input_layernorm/SkipLayerNorm`,
            );
            const nodes = after.node.filter((n: Named) =>
                n.name.startsWith(`${prefix}decoder/${i}/`),
            );
            expect(nodes.map((n: Node) => n.opType)).toEqual([
                "Add",
                "Add",
                "SimplifiedLayerNormalization",
            ]);
            expect(nodes[0].input).toEqual(original.input.slice(0, 2));
            expect(nodes[1].input).toEqual([
                nodes[0].output[0],
                QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS[i],
            ]);
            expect(nodes[1].output).toEqual([original.output[3]]);
            expect(nodes[2].input).toEqual([original.output[3], original.input[2]]);
            expect(nodes[2].output).toEqual([original.output[0]]);
            expect(nodes[2].attribute).toEqual(
                before.node.find(
                    (n: Named) => n.name === "/model/layers.0/input_layernorm/LayerNorm",
                ).attribute,
            );
            expect(nodes[2].attribute.find((a: Named) => a.name === "epsilon").f).toBe(
                original.attribute.find((a: Named) => a.name === "epsilon").f,
            );
            expect(Number(nodes[2].attribute.find((a: Named) => a.name === "axis").i)).toBe(-1);
            expect(Number(nodes[2].attribute.find((a: Named) => a.name === "stash_type").i)).toBe(
                1,
            );
            const downstream = `/model/layers.${i + 1}/post_attention_layernorm/SkipLayerNorm`;
            expect(after.node.find((n: Named) => n.name === downstream).input[0]).toBe(
                original.output[3],
            );
            const input = after.input.at(i - 3);
            expect(input.type.tensorType.elemType).toBe(1);
            expect(
                input.type.tensorType.shape.dim.map(
                    (d: { dimParam: string; dimValue: number }) => d.dimParam || Number(d.dimValue),
                ),
            ).toEqual(["batch_size", "sequence_length", 2048]);
        }
    });

    it.each(["truncated", "corrupted", "already transformed"])(
        "rejects %s graphs without input mutation",
        (kind) => {
            for (const [source, patch] of [
                [visionSource, patchQwen3Vl2bDeepStackVisionGraph],
                [decoderSource, patchQwen3Vl2bDeepStackDecoderGraph],
            ] as const) {
                const bytes =
                    kind === "truncated"
                        ? source.subarray(0, source.length - 1)
                        : kind === "already transformed"
                          ? patch(source)
                          : Buffer.from(source);
                if (kind === "corrupted") bytes[bytes.length - 1] ^= 1;
                const before = Buffer.from(bytes);
                expect(() => patch(bytes)).toThrow(/Pinned Qwen DeepStack .* source identity/);
                expect(Buffer.from(bytes).equals(before)).toBe(true);
            }
        },
    );

    it("rejects the uncomposed original decoder and a nonbyte input", () => {
        expect(() =>
            patchQwen3Vl2bDeepStackDecoderGraph(
                fs.readFileSync(sourcePath("decoder_model_merged_q4.onnx")),
            ),
        ).toThrow(/source identity/);
        expect(() => patchQwen3Vl2bDeepStackVisionGraph(null as never)).toThrow(/source identity/);
    });
});

const vi = (name: string, dims: number[]) =>
    schema.ValueInfoProto.create({
        name,
        type: {
            tensorType: { elemType: 1, shape: { dim: dims.map((dimValue) => ({ dimValue })) } },
        },
    });
const f32 = (name: string, dims: number[], values: number[]) =>
    schema.TensorProto.create({
        name,
        dataType: 1,
        dims,
        rawData: Buffer.from(Float32Array.from(values).buffer),
    });
function minimal(nodes: unknown[], inputs: unknown[], outputs: unknown[], initializers: unknown[]) {
    return schema.ModelProto.create({
        irVersion: 9,
        opsetImport: [
            { domain: "", version: 21 },
            { domain: "com.microsoft", version: 1 },
        ],
        graph: {
            name: "weight-free-deepstack-regression",
            node: nodes,
            input: inputs,
            output: outputs,
            initializer: initializers,
        },
    });
}
function runtime() {
    const ort = require(path.join(modules, "onnxruntime-web")) as typeof import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmBinary = fs.readFileSync(
        path.join(modules, "onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"),
    );
    ort.env.wasm.wasmPaths = {
        mjs: pathToFileURL(path.join(modules, "onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"))
            .href,
    };
    return ort;
}
const options = {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "disabled",
    logSeverityLevel: 3,
} as const;
const close = (actual: ArrayLike<unknown>, expected: number[], tolerance = 2e-6) => {
    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++)
        expect(Math.abs(Number(actual[i]) - expected[i])).toBeLessThanOrEqual(tolerance);
};

describe("Weight-free execution of actual added DeepStack operators on deployed ORT WASM", () => {
    it("preserves zero-feature baseline and nonzero features through all three residual carries", async () => {
        const ort = runtime();
        const base = decode(decoderSource).graph;
        const transformed = patchedDecoder().graph;
        const oldNodes: unknown[] = [],
            newNodes: unknown[] = [],
            inputs: unknown[] = [],
            outputs: unknown[] = [],
            initializers: unknown[] = [];
        const a = [1, 2, 3, 4, -2, 1, 0.5, 3];
        const b = [0.25, -0.5, 0.75, 1, 0.5, -0.25, 0.125, -1];
        const gamma = [0.75, 1.25, 1, 0.5];
        const feeds: Record<string, InstanceType<typeof ort.Tensor>> = {};
        const boundaries = [1, 2, 3].map((i) =>
            base.node.find(
                (n: Named) => n.name === `/model/layers.${i}/input_layernorm/SkipLayerNorm`,
            ),
        );
        for (let i = 0; i < 3; i++) {
            const original = boundaries[i];
            if (i === 0) {
                inputs.push(vi(original.input[0], [1, 2, 4]));
                feeds[original.input[0]] = new ort.Tensor(
                    "float32",
                    Float32Array.from(a),
                    [1, 2, 4],
                );
            } else {
                // Zero attention delta between boundaries: the real residual output3 must carry on.
                const carry = schema.NodeProto.create({
                    name: `test-carry-${i}`,
                    opType: "Identity",
                    input: [boundaries[i - 1].output[3]],
                    output: [original.input[0]],
                });
                oldNodes.push(carry);
                newNodes.push(carry);
            }
            inputs.push(vi(original.input[1], [1, 2, 4]));
            feeds[original.input[1]] = new ort.Tensor("float32", Float32Array.from(b), [1, 2, 4]);
            initializers.push(f32(original.input[2], [4], gamma));
            outputs.push(vi(original.output[0], [1, 2, 4]), vi(original.output[3], [1, 2, 4]));
            oldNodes.push(original);
            newNodes.push(
                ...transformed.node.filter((n: Named) =>
                    n.name.startsWith(`${prefix}decoder/${i}/`),
                ),
            );
        }
        const oldSession = await ort.InferenceSession.create(
            encode(minimal(oldNodes, inputs, outputs, initializers)),
            options,
        );
        const newSession = await ort.InferenceSession.create(
            encode(
                minimal(
                    newNodes,
                    [
                        ...inputs,
                        ...QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS.map((name) => vi(name, [1, 2, 4])),
                    ],
                    outputs,
                    initializers,
                ),
            ),
            options,
        );
        try {
            const baseline = await oldSession.run(feeds);
            for (const nonzero of [false, true]) {
                const extras = Object.fromEntries(
                    QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS.map((name, i) => [
                        name,
                        new ort.Tensor(
                            "float32",
                            Float32Array.from(
                                a.map((_, j) => (nonzero ? (i + 1) * ((j % 4) - 1.5) * 0.125 : 0)),
                            ),
                            [1, 2, 4],
                        ),
                    ]),
                );
                const result = await newSession.run({ ...feeds, ...extras });
                let carry = a;
                for (let i = 0; i < 3; i++) {
                    carry = carry.map((x, j) =>
                        Math.fround(
                            Math.fround(x + b[j]) +
                                Number(extras[QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS[i]].data[j]),
                        ),
                    );
                    const normalized = carry.map((x, j) => {
                        const row = carry.slice(Math.floor(j / 4) * 4, Math.floor(j / 4) * 4 + 4);
                        return (
                            (x / Math.sqrt(row.reduce((s, n) => s + n * n, 0) / 4 + 1e-6)) *
                            gamma[j % 4]
                        );
                    });
                    close(result[boundaries[i].output[3]].data, carry);
                    close(result[boundaries[i].output[0]].data, normalized);
                    if (!nonzero) {
                        close(
                            result[boundaries[i].output[3]].data,
                            Array.from(baseline[boundaries[i].output[3]].data, Number),
                        );
                        close(
                            result[boundaries[i].output[0]].data,
                            Array.from(baseline[boundaries[i].output[0]].data, Number),
                        );
                    }
                }
                if (nonzero)
                    expect(
                        Math.abs(
                            Number(result[boundaries[2].output[3]].data[0]) -
                                Number(baseline[boundaries[2].output[3]].data[0]),
                        ),
                    ).toBeGreaterThan(0.5);
                for (const tensor of [...Object.values(result), ...Object.values(extras)])
                    tensor.dispose();
            }
            for (const tensor of Object.values(baseline)) tensor.dispose();
        } finally {
            for (const tensor of Object.values(feeds)) tensor.dispose();
            await newSession.release();
            await oldSession.release();
        }
    }, 15_000);

    it("executes post-shuffle LN→Gemm(transB1)→exact GELU→Gemm and rejects the pre-shuffle normalization control", async () => {
        const ort = runtime();
        const nodes = patchedVision().graph.node.filter((n: Named) =>
            n.name.startsWith(`${prefix}vision/0/`),
        );
        const rawShape = Buffer.alloc(16);
        rawShape.writeBigInt64LE(-1n);
        rawShape.writeBigInt64LE(4n, 8);
        const weight1 = [1, 0.1, 0, 0, 0.2, 0.8, 0, 0, 0, 0.3, 1.1, 0, 0, 0, 0.4, 0.9];
        const weight2 = [0.2, 0.4, 0.6, 0.8, -0.3, 0.5, -0.7, 0.9];
        const scale = [1, 1.25, 0.75, 1.5],
            bias = [0.1, -0.2, 0.3, -0.1],
            b1 = [0.1, 0.2, -0.1, 0.3],
            b2 = [0.25, -0.5];
        const initializers = [
            schema.TensorProto.create({
                name: nodes[0].input[1],
                dataType: 7,
                dims: [2],
                rawData: rawShape,
            }),
            f32(nodes[1].input[1], [4], scale),
            f32(nodes[1].input[2], [4], bias),
            f32(nodes[2].input[1], [4, 4], weight1),
            f32(nodes[2].input[2], [4], b1),
            f32(nodes[4].input[1], [2, 4], weight2),
            f32(nodes[4].input[2], [2], b2),
        ];
        const input = [1, 2, 10, 20, -3, 5, 11, 13];
        const outputs = [vi(nodes[1].output[0], [2, 4]), vi(nodes[4].output[0], [2, 2])];
        const session = await ort.InferenceSession.create(
            encode(minimal(nodes, [vi(nodes[0].input[0], [4, 2])], outputs, initializers)),
            options,
        );
        const tensor = new ort.Tensor("float32", Float32Array.from(input), [4, 2]);
        try {
            const result = await session.run({ [nodes[0].input[0]]: tensor });
            const normalized: number[] = [],
                expected: number[] = [],
                wrong: number[] = [];
            // Independent scalar erf approximation, absolute error<1.5e-7; no runtime graph evaluation.
            const erf = (x: number) => {
                const t = 1 / (1 + 0.3275911 * Math.abs(x));
                return (
                    Math.sign(x) *
                    (1 -
                        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
                            t +
                            0.254829592) *
                            t *
                            Math.exp(-x * x))
                );
            };
            for (let row = 0; row < 2; row++) {
                const values = input.slice(row * 4, row * 4 + 4);
                const mean = values.reduce((a, b) => a + b) / 4;
                const variance = values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / 4;
                const norm = values.map(
                    (x, i) => ((x - mean) / Math.sqrt(variance + 1e-6)) * scale[i] + bias[i],
                );
                normalized.push(...norm);
                for (let j = 0; j < 4; j++) {
                    const pair = values.slice(Math.floor(j / 2) * 2, Math.floor(j / 2) * 2 + 2);
                    const m = (pair[0] + pair[1]) / 2;
                    const variance2 = ((pair[0] - m) ** 2 + (pair[1] - m) ** 2) / 2;
                    wrong.push(
                        ((values[j] - m) / Math.sqrt(variance2 + 1e-6)) * scale[j] + bias[j],
                    );
                }
                const hidden = b1.map((b, i) =>
                    norm.reduce((sum, n, j) => sum + n * weight1[i * 4 + j], b),
                );
                const activated = hidden.map((x) => 0.5 * x * (1 + erf(x / Math.SQRT2)));
                expected.push(
                    ...b2.map((b, i) =>
                        activated.reduce((sum, n, j) => sum + n * weight2[i * 4 + j], b),
                    ),
                );
            }
            close(result[nodes[1].output[0]].data, normalized);
            close(result[nodes[4].output[0]].data, expected, 3e-6);
            expect(
                Math.max(
                    ...wrong.map((n, i) =>
                        Math.abs(n - Number(result[nodes[1].output[0]].data[i])),
                    ),
                ),
            ).toBeGreaterThan(1);
            for (const output of Object.values(result)) output.dispose();
        } finally {
            tensor.dispose();
            await session.release();
        }
    }, 15_000);
});
