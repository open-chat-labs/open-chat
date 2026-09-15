// @vitest-environment node
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { patchQwen3Vl2bDecoderGraph } from "../../transformersWebGpuDecoderGraph.mjs";
import { patchQwen3Vl2bDeepStackDecoderGraph } from "../../transformersWebGpuDeepStackGraph.mjs";
import { createQwen3Vl2bGenerationRuntime } from "../../transformersWebGpuQwenGenerationRuntime.mjs";
import {
    patchQwen3Vl2bGenerationGraph,
    QWEN3_VL_2B_GENERATION_SOURCE_BYTES,
    QWEN3_VL_2B_GENERATION_SOURCE_SHA256,
    QWEN3_VL_2B_GENERATION_BYTES,
    QWEN3_VL_2B_GENERATION_SHA256,
    QWEN3_VL_2B_GENERATION_HOST_INPUTS,
} from "../../transformersWebGpuQwenGenerationGraph.mjs";

const schema = createRequire(import.meta.url)(
    path.resolve(
        import.meta.dirname,
        "../../../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
    ),
).onnx;
const source = Buffer.from(
    patchQwen3Vl2bDeepStackDecoderGraph(
        patchQwen3Vl2bDecoderGraph(
            fs.readFileSync(
                path.resolve(
                    import.meta.dirname,
                    "../../model-overrides/qwen3vl2b/onnx/decoder_model_merged_q4.onnx",
                ),
            ),
        ),
    ),
);
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const decode = (bytes: Uint8Array) => schema.ModelProto.decode(bytes);
const encoded = (type: { encode(value: unknown): { finish(): Uint8Array } }, value: unknown) =>
    Buffer.from(type.encode(value).finish());
type Named = { name: string };
type Node = Named & { input: string[]; output: string[]; opType: string; domain: string };
type Value = Named & {
    type: {
        tensorType: {
            elemType: number;
            shape: { dim: Array<{ dimParam: string; dimValue: number }> };
        };
    };
};
const dims = (value: Value) =>
    value.type.tensorType.shape.dim.map((d) => d.dimParam || Number(d.dimValue));
const options = { scope: "generation-only" };

describe("Pinned Qwen generation-only WebGPU decoder composition", () => {
    it("emits the exact composed graph without mutating or aliasing caller bytes", () => {
        const before = Buffer.from(source);
        expect(source.byteLength).toBe(QWEN3_VL_2B_GENERATION_SOURCE_BYTES);
        expect(hash(source)).toBe(QWEN3_VL_2B_GENERATION_SOURCE_SHA256);
        const result = patchQwen3Vl2bGenerationGraph(source, options);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.byteLength).toBe(QWEN3_VL_2B_GENERATION_BYTES);
        expect(hash(result)).toBe(QWEN3_VL_2B_GENERATION_SHA256);
        expect(hash(result)).toBe(
            "475d9ad51b0da52e7510a8b597bdf42a533e552de3a3b74c58284ae6b2472375",
        );
        expect(source.equals(before)).toBe(true);
        result.fill(0);
        expect(source.equals(before)).toBe(true);
    });

    it("retains all original inputs, cache outputs, weights and non-boundary node fields", () => {
        const before = decode(source),
            after = decode(patchQwen3Vl2bGenerationGraph(source, options));
        expect(schema.ModelProto.verify(after)).toBeNull();
        expect([
            after.graph.node.length,
            after.graph.initializer.length,
            after.graph.input.length,
            after.graph.output.length,
        ]).toEqual([1746, 764, 71, 57]);
        expect(
            encoded(schema.GraphProto, {
                input: after.graph.input.slice(0, 63),
                output: after.graph.output.slice(1),
                initializer: after.graph.initializer.slice(0, 759),
            }).equals(
                encoded(schema.GraphProto, {
                    input: before.graph.input,
                    output: before.graph.output.slice(1),
                    initializer: before.graph.initializer,
                }),
            ),
        ).toBe(true);
        expect(after.graph.output.slice(1).map((x: Named) => x.name)).toEqual(
            Array.from({ length: 28 }, (_, i) => [`present.${i}.key`, `present.${i}.value`]).flat(),
        );
        const originals = new Map<string, Node>(before.graph.node.map((n: Node) => [n.name, n]));
        const retainedNames = new Set<string>(after.graph.node.map((n: Node) => n.name));
        const removed = before.graph.node.filter((n: Node) => !retainedNames.has(n.name));
        expect(removed).toHaveLength(719);
        const counts = removed.reduce((out: Record<string, number>, n: Node) => {
            out[n.opType] = (out[n.opType] ?? 0) + 1;
            expect(n.domain).toBe("");
            return out;
        }, {});
        expect(counts).toEqual({
            Shape: 115,
            Gather: 200,
            Concat: 171,
            Unsqueeze: 4,
            Mul: 56,
            Reshape: 57,
            Range: 56,
            Sub: 57,
            Expand: 1,
            Cast: 2,
        });
        let hostSlots = 0;
        const removedOutputs = new Set(removed.flatMap((n: Node) => n.output));
        for (const node of after.graph.node as Node[]) {
            const original = originals.get(node.name);
            if (!original) {
                expect(node.name).toBe("__openchat/generation/last_hidden/Slice");
                continue;
            }
            const restored = schema.NodeProto.decode(encoded(schema.NodeProto, node));
            node.input.forEach((name, i) => {
                if (name === original.input[i]) return;
                if (node.name === "/lm_head/MatMul_Quant") {
                    expect(i).toBe(0);
                    expect(name).toBe("__openchat_generation_last_hidden");
                } else {
                    expect(name.startsWith("__openchat_hostmeta_")).toBe(true);
                    expect(removedOutputs.has(original.input[i])).toBe(true);
                    hostSlots++;
                }
                restored.input[i] = original.input[i];
            });
            expect(
                encoded(schema.NodeProto, restored).equals(encoded(schema.NodeProto, original)),
            ).toBe(true);
        }
        expect(hostSlots).toBe(254);
        const restored = decode(encoded(schema.ModelProto, after));
        for (const key of ["node", "initializer", "input", "output", "valueInfo"])
            restored.graph[key] = before.graph[key];
        expect(encoded(schema.ModelProto, restored).equals(source)).toBe(true);
    });

    it("exposes only the eight declared INT64 metadata inputs and preserves learned value metadata", () => {
        const before = decode(source),
            after = decode(patchQwen3Vl2bGenerationGraph(source, options));
        const runtime = createQwen3Vl2bGenerationRuntime();
        expect(runtime.inputNames).toEqual(
            after.graph.input.slice(63).map((value: Named) => value.name),
        );
        expect(runtime.inputMetadata).toEqual(
            QWEN3_VL_2B_GENERATION_HOST_INPUTS.map((value) => ({
                name: value.name,
                type: value.type,
                shape: [...value.dims],
            })),
        );
        expect(
            after.graph.input.slice(63).map((value: Value) => ({
                name: value.name,
                type: value.type.tensorType.elemType,
                dims: dims(value),
            })),
        ).toEqual(
            QWEN3_VL_2B_GENERATION_HOST_INPUTS.map((x) => ({
                name: x.name,
                type: 7,
                dims: [...x.dims],
            })),
        );
        expect(after.graph.input.slice(63).map((v: Named) => v.name)).toEqual(
            [
                "rotary_expand_shape",
                "attention_bias_shape",
                "rotary_positions",
                "total_vector",
                "causal_starts",
                "causal_ends",
                "key_score_pads",
                "value_pads",
            ].map((x) => `__openchat_hostmeta_${x}`),
        );
        const nextByName = new Map(after.graph.valueInfo.map((v: Named) => [v.name, v]));
        const removedNames = new Set(
            before.graph.node
                .filter((n: Node) => !after.graph.node.some((m: Node) => m.name === n.name))
                .flatMap((n: Node) => n.output),
        );
        for (const value of before.graph.valueInfo as Named[]) {
            if (removedNames.has(value.name) && value.name !== "__openchat_tied_embedding_quant_2d")
                continue;
            expect(
                encoded(schema.ValueInfoProto, nextByName.get(value.name)).equals(
                    encoded(schema.ValueInfoProto, value),
                ),
            ).toBe(true);
        }
        expect(after.graph.valueInfo.length).toBe(before.graph.valueInfo.length - 410 + 1);
    });

    it("aliases the exact packed weight range without changing or copying learned data", () => {
        const graph = decode(patchQwen3Vl2bGenerationGraph(source, options)).graph;
        const quant = graph.initializer.find(
            (v: Named) => v.name === "lm_head_MatMul_weight_quant",
        );
        const alias = graph.initializer[759];
        expect(alias.name).toBe("__openchat_tied_embedding_quant_2d");
        expect(alias.dims.map(Number)).toEqual([151936, 1024]);
        expect(alias.dataType).toBe(2);
        expect(alias.dataLocation).toBe(1);
        expect(alias.rawData.length).toBe(0);
        expect(
            alias.externalData.map((x: { key: string; value: string }) => [x.key, x.value]),
        ).toEqual([
            ["location", "decoder_model_merged_q4.onnx_data"],
            ["offset", "903290880"],
            ["length", "155582464"],
        ]);
        const restored = schema.TensorProto.decode(encoded(schema.TensorProto, alias));
        restored.name = quant.name;
        restored.dims = quant.dims;
        expect(
            encoded(schema.TensorProto, restored).equals(encoded(schema.TensorProto, quant)),
        ).toBe(true);
        for (const [row, block, byte] of [
            [0, 0, 0],
            [151935, 63, 15],
            [73001, 27, 9],
        ]) {
            expect((row * 64 + block) * 16 + byte).toBe(row * 1024 + block * 16 + byte);
        }
        expect(
            graph.node.filter((n: Node) => n.input.includes(alias.name)).map((n: Node) => n.opType),
        ).toEqual(["GatherBlockQuantized"]);
    });

    it("selects exactly the final hidden row for every admitted sequence, retaining head semantics", () => {
        const graph = decode(patchQwen3Vl2bGenerationGraph(source, options)).graph;
        const slice = graph.node.at(-2),
            head = graph.node.at(-1);
        expect(slice.opType).toBe("Slice");
        expect(slice.input[0]).toBe("/model/layers.28/final_norm_layernorm/output_0");
        const values = slice.input
            .slice(1)
            .map((name: string) =>
                Number(
                    Buffer.from(
                        graph.initializer.find((v: Named) => v.name === name).rawData,
                    ).readBigInt64LE(),
                ),
            );
        expect(values).toEqual([-1, 1024, 1, 1]);
        for (let sequence = 1; sequence <= 1024; sequence++) {
            const start = Math.max(sequence + values[0], 0),
                end = Math.min(values[1], sequence);
            expect([start, end, end - start]).toEqual([sequence - 1, sequence, 1]);
        }
        expect(head.input[0]).toBe(slice.output[0]);
        expect(dims(graph.output[0])).toEqual(["batch_size", 1, 151936]);
        expect(graph.output[0].type.tensorType.elemType).toBe(1);
    });

    it("rejects invalid scope, source drift, already-composed graphs, and invalid inputs", () => {
        for (const scope of [
            undefined,
            null,
            {},
            { scope: "forward" },
            { scope: "generation-only", unsafe: true },
        ]) {
            expect(() => patchQwen3Vl2bGenerationGraph(source, scope)).toThrow(/generation-only/);
        }
        const changed = Buffer.from(source);
        changed[changed.length - 1] ^= 1;
        for (const bytes of [
            null,
            undefined,
            new Uint8Array(0),
            changed,
            source.subarray(1),
            patchQwen3Vl2bGenerationGraph(source, options),
        ]) {
            expect(() => patchQwen3Vl2bGenerationGraph(bytes, options)).toThrow(/source identity/);
        }
    });

    it("accepts Node Buffers across embedding Uint8Array realms", () => {
        vi.stubGlobal("Uint8Array", runInNewContext("Uint8Array"));
        try {
            expect(hash(patchQwen3Vl2bGenerationGraph(source, options))).toBe(
                QWEN3_VL_2B_GENERATION_SHA256,
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
