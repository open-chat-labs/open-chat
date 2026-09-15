// @vitest-environment jsdom
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { patchQwen3Vl2bDeepStackVisionGraph } from "../../transformersWebGpuDeepStackGraph.mjs";
import {
    patchQwen3Vl2bVisionGeometryGraph,
    QWEN3_VL_2B_VISION_GEOMETRY_BYTES,
    QWEN3_VL_2B_VISION_GEOMETRY_SHA256,
    QWEN3_VL_2B_VISION_GEOMETRY_SOURCE_SHA256,
    QWEN3_VL_2B_VISION_GEOMETRY_PROGRAM_SHA256,
    QWEN3_VL_2B_VISION_GEOMETRY_CONSTANTS_SHA256,
    QWEN3_VL_2B_VISION_GEOMETRY_INPUTS,
    QWEN3_VL_2B_VISION_GEOMETRY_OUTPUTS,
} from "../../transformersWebGpuQwenVisionGraph.mjs";

// Only the decoded ONNX fields inspected by this contract are declared here.
// The generated protobuf codecs still preserve every uninspected field on round trips.
type ProtoInteger = number | { toString(): string };
type AttributeProto = { name: string; i: ProtoInteger };
type NodeProto = {
    name: string;
    opType: string;
    input: string[];
    output: string[];
    attribute: AttributeProto[];
};
type TensorProto = {
    name: string;
    externalData: { key: string; value: string }[];
    dataLocation: number;
    int64Data: ProtoInteger[];
};
type ValueInfoProto = {
    name: string;
    type: {
        tensorType: {
            elemType: number;
            shape: {
                dim: { dimParam: string; dimValue: ProtoInteger }[];
            };
        };
    };
};
type GraphProto = {
    node: NodeProto[];
    initializer: TensorProto[];
    input: ValueInfoProto[];
    output: ValueInfoProto[];
    valueInfo: ValueInfoProto[];
};
type ModelProto = { graph: GraphProto };
type ProtoCodec<T> = {
    encode(value: T): { finish(): Uint8Array };
    decode(bytes: Uint8Array): T;
    verify(value: T): string | null;
};
type OnnxSchema = {
    ModelProto: ProtoCodec<ModelProto>;
    GraphProto: ProtoCodec<GraphProto>;
    NodeProto: ProtoCodec<NodeProto>;
    TensorProto: ProtoCodec<TensorProto>;
    ValueInfoProto: ProtoCodec<ValueInfoProto>;
};
const schema: OnnxSchema = createRequire(import.meta.url)(
    path.resolve(
        import.meta.dirname,
        "../../../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
    ),
).onnx;
const raw = readFileSync(
    path.resolve(
        import.meta.dirname,
        "../../model-overrides/qwen3vl2b/onnx/vision_encoder_q4.onnx",
    ),
);
const source = Buffer.from(patchQwen3Vl2bDeepStackVisionGraph(raw));
const result = patchQwen3Vl2bVisionGeometryGraph(source);
const decode = (bytes: Uint8Array) => schema.ModelProto.decode(bytes);
const encode = <T>(type: ProtoCodec<T>, value: T) => Buffer.from(type.encode(value).finish());
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
// Compare every byte natively, avoiding per-element deep-equality traversal of ONNX buffers.
const expectSameBytes = (actual: Uint8Array, expected: Uint8Array) => {
    expect(actual.byteLength).toBe(expected.byteLength);
    expect(
        Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength).equals(
            Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength),
        ),
    ).toBe(true);
};
const required = <T>(value: T | undefined): T => {
    expect(value).toBeDefined();
    if (value === undefined) throw new Error("Required source-bound ONNX entry is absent");
    return value;
};
const digest = <T>(type: ProtoCodec<T>, items: T[]) =>
    hash(Buffer.concat(items.map((item) => encode(type, item))));
const before = decode(source),
    after = decode(result);
const prefix = "__openchat_diag_vision_head_groups/";
const cut = before.graph.node.filter(
    (_, i) => (i >= 2 && i <= 44) || (i >= 51 && i <= 88) || (i >= 93 && i <= 102),
);
const cutNames = new Set(cut.map((n) => n.name));
const dim = (v: ValueInfoProto) =>
    v.type.tensorType.shape.dim.map((d) => d.dimParam || Number(d.dimValue));

describe("Qwen complete vision host-geometry graph (not enabled)", () => {
    it("binds source and output bytes, preserves caller storage and rejects reapplication or source drift", () => {
        expect(hash(source)).toBe(QWEN3_VL_2B_VISION_GEOMETRY_SOURCE_SHA256);
        expect(result.length).toBe(QWEN3_VL_2B_VISION_GEOMETRY_BYTES);
        expect(hash(result)).toBe(QWEN3_VL_2B_VISION_GEOMETRY_SHA256);
        expect([
            after.graph.node.length,
            after.graph.initializer.length,
            after.graph.input.length,
            after.graph.output.length,
        ]).toEqual([1770, 560, 15, 4]);
        expect(schema.ModelProto.verify(after)).toBeNull();
        const storage = Buffer.concat([Buffer.from([8]), source, Buffer.from([9])]),
            saved = Buffer.from(storage);
        expectSameBytes(patchQwen3Vl2bVisionGeometryGraph(storage.subarray(1, -1)), result);
        expectSameBytes(storage, saved);
        const owned = Buffer.from(source);
        patchQwen3Vl2bVisionGeometryGraph(owned).fill(0);
        expectSameBytes(owned, source);
        const changed = Buffer.from(source);
        changed[changed.length - 1] ^= 1;
        for (const bad of [changed, result, raw, source.subarray(1), Array.from(source), null])
            expect(() => patchQwen3Vl2bVisionGeometryGraph(bad)).toThrow(/Pinned/);
    });

    it("accepts a Node Buffer even when the JavaScript Uint8Array constructor belongs to another realm", () => {
        // Mirrors Buffer-vs-jsdom/Vitest realm separation without changing the graph decoder.
        const foreignUint8Array = runInNewContext("Uint8Array");
        expect(source instanceof foreignUint8Array).toBe(false);
        expect(source instanceof Uint8Array).toBe(false);
        expect(Buffer.isBuffer(source)).toBe(true);
        expectSameBytes(patchQwen3Vl2bVisionGeometryGraph(source), result);
    });

    it("cuts exactly the source-bound 91 nodes/16 inline constants and supplies all 13 crossings", () => {
        expect(cut).toHaveLength(91);
        expect(digest(schema.NodeProto, cut)).toBe(QWEN3_VL_2B_VISION_GEOMETRY_PROGRAM_SHA256);
        const seen = new Set(["pixel_values", "image_grid_thw"]),
            constants: TensorProto[] = [];
        for (const n of cut) {
            for (const name of n.input) {
                if (name === "pixel_values") expect(n.opType).toBe("Shape");
                if (!seen.has(name)) {
                    const t = required(before.graph.initializer.find((t) => t.name === name));
                    expect(t.externalData).toEqual([]);
                    expect(t.dataLocation).not.toBe(1);
                    constants.push(t);
                    seen.add(name);
                }
            }
            n.output.forEach((name: string) => seen.add(name));
        }
        expect(constants).toHaveLength(16);
        expect(digest(schema.TensorProto, constants)).toBe(
            QWEN3_VL_2B_VISION_GEOMETRY_CONSTANTS_SHA256,
        );
        const crossing = cut
            .flatMap((n) => n.output)
            .filter((name: string) =>
                before.graph.node.some((n) => !cutNames.has(n.name) && n.input.includes(name)),
            );
        expect(crossing).toEqual(QWEN3_VL_2B_VISION_GEOMETRY_INPUTS.map((x) => x.name));
        expect(after.graph.node.some((n) => cutNames.has(n.name))).toBe(false);
        expect(digest(schema.ValueInfoProto, after.graph.input.slice(0, 2))).toBe(
            digest(schema.ValueInfoProto, before.graph.input),
        );
        after.graph.input.slice(2).forEach((v, index) => {
            const metadata = QWEN3_VL_2B_VISION_GEOMETRY_INPUTS[index];
            expect(v.name).toBe(metadata.name);
            expect(dim(v)).toEqual(metadata.shape);
            expect(v.type.tensorType.elemType).toBe(metadata.type === "float32" ? 1 : 7);
            expect(encode(schema.ValueInfoProto, v)).toEqual(
                encode(
                    schema.ValueInfoProto,
                    required(before.graph.valueInfo.find((x) => x.name === v.name)),
                ),
            );
        });
        expect(after.graph.node.every((n) => !n.input.includes("image_grid_thw"))).toBe(true);
    });

    it("retains all learned/pixel nodes, complete external weight descriptors and all four dynamic outputs", () => {
        const chains = new Set(
            before.graph.node
                .filter((n) =>
                    /\/attn\/mha\/codex_unfused\/(qk|scale|bias|softmax|context)$/.test(n.name),
                )
                .map((n) => n.name),
        );
        expect(chains.size).toBe(120);
        const unchanged = before.graph.node.filter(
            (n) => !cutNames.has(n.name) && !chains.has(n.name),
        );
        expect(unchanged).toHaveLength(978);
        expect(
            digest(
                schema.NodeProto,
                after.graph.node.filter((n) => !n.name.startsWith(prefix)),
            ),
        ).toBe(digest(schema.NodeProto, unchanged));
        expect(digest(schema.TensorProto, after.graph.initializer.slice(0, 550))).toBe(
            digest(schema.TensorProto, before.graph.initializer),
        );
        const external = (g: GraphProto) => g.initializer.filter((t) => t.externalData.length);
        expect(external(after.graph)).toHaveLength(524);
        expect(digest(schema.TensorProto, external(after.graph))).toBe(
            digest(schema.TensorProto, external(before.graph)),
        );
        expect(digest(schema.ValueInfoProto, after.graph.output)).toBe(
            digest(schema.ValueInfoProto, before.graph.output),
        );
        expect(after.graph.output.map((v) => v.name)).toEqual(QWEN3_VL_2B_VISION_GEOMETRY_OUTPUTS);
        after.graph.output.forEach((v) => expect(dim(v)).toEqual(["num_features", 2048]));
        for (const index of [
            0, 1, 45, 46, 47, 48, 49, 50, 89, 90, 91, 92, 103, 104, 105, 106, 107, 108, 109, 110,
        ]) {
            const n = before.graph.node[index];
            expect(
                encode(schema.NodeProto, required(after.graph.node.find((v) => v.name === n.name))),
            ).toEqual(encode(schema.NodeProto, n));
        }
        const deepStack = (g: GraphProto) =>
            g.node.filter((n) => n.name.startsWith("__openchat/deepstack/"));
        expect(deepStack(after.graph)).toHaveLength(15);
        expect(digest(schema.NodeProto, deepStack(after.graph))).toBe(
            digest(schema.NodeProto, deepStack(before.graph)),
        );
    });

    it("groups only head axis 1 into four disjoint groups while retaining every sequence position and mask", () => {
        const constants = new Map(
            after.graph.initializer.slice(550).map((t) => [t.name, t.int64Data.map(Number)]),
        );
        expect(constants.size).toBe(10);
        const mask = "/model/vision_rope/attn_mask/UnsqueezeBatchHead/output_0";
        expect(
            after.graph.node.filter((n) => n.opType === "Add" && n.input.includes(mask)),
        ).toHaveLength(96);
        for (let layer = 0; layer < 24; layer++) {
            const local = prefix + "layer" + layer + "/",
                context = "/model/layers." + layer + "/attn/mha/codex_unfused/context";
            const nodes = after.graph.node.filter((n) => n.name.startsWith(local));
            expect(nodes).toHaveLength(33);
            expect(nodes.filter((n) => n.opType === "Slice")).toHaveLength(12);
            for (let group = 0; group < 4; group++) {
                for (const label of ["q", "kt", "v"]) {
                    const n = required(
                        nodes.find((n) => n.name === local + "group" + group + "/slice_" + label),
                    );
                    expect(n.input.slice(1).map((name: string) => constants.get(name))).toEqual([
                        [group * 4],
                        [(group + 1) * 4],
                        [1],
                        [1],
                    ]);
                }
                const softmax = required(
                    nodes.find((n) => n.name === local + "group" + group + "/softmax"),
                );
                expect(softmax.attribute.map((a) => [a.name, Number(a.i)])).toEqual([["axis", -1]]);
                const scale = required(
                    nodes.find((n) => n.name === local + "group" + group + "/scale"),
                );
                expect(scale.input[1]).toBe("__codex_unfused_mha_scale");
            }
            const join = required(nodes.at(-1));
            expect(join.opType).toBe("Concat");
            expect(join.input).toEqual([0, 1, 2, 3].map((i) => local + "group" + i + "/context"));
            expect(join.output).toEqual([context]);
            expect(join.attribute.map((a) => [a.name, Number(a.i)])).toEqual([["axis", 1]]);
        }
    });

    it("has no dangling inputs, optional empty outputs stay legal, and exact reversal restores the complete source", () => {
        const produced = new Set(
            [...after.graph.input, ...after.graph.initializer].map((v) => v.name),
        );
        for (const n of after.graph.node) {
            for (const name of n.input) if (name) expect(produced.has(name), name).toBe(true);
            for (const name of n.output)
                if (name) {
                    expect(produced.has(name), name).toBe(false);
                    produced.add(name);
                }
        }
        for (const out of after.graph.output) expect(produced.has(out.name)).toBe(true);
        const restored = decode(result);
        restored.graph = {
            ...restored.graph,
            node: before.graph.node,
            initializer: before.graph.initializer,
            input: before.graph.input,
        };
        expectSameBytes(encode(schema.ModelProto, restored), source);
        expectSameBytes(
            encode(schema.GraphProto, {
                ...after.graph,
                node: before.graph.node,
                initializer: before.graph.initializer,
                input: before.graph.input,
            }),
            encode(schema.GraphProto, before.graph),
        );
    });
});
