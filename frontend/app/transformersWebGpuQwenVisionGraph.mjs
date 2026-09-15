import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { createQwen3Vl2bVisionGeometryRuntime } from "./transformersWebGpuQwenVisionGeometry.mjs";

// Build-time only. No loader uses this transform yet. The browser never decodes ONNX.
const schema = createRequire(import.meta.url)(
    path.join(
        import.meta.dirname,
        "../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
    ),
).onnx;
export const QWEN3_VL_2B_VISION_GEOMETRY_SOURCE_BYTES = 395100;
export const QWEN3_VL_2B_VISION_GEOMETRY_SOURCE_SHA256 =
    "0b494b36663cc3ce66a34b33fb03e7f722c2957d10db29d55fe63854e7d358be";
export const QWEN3_VL_2B_VISION_GEOMETRY_BYTES = 576592;
export const QWEN3_VL_2B_VISION_GEOMETRY_SHA256 =
    "b62a78861a16cb0023156cc20dc6d8d7f0d97c99ce2360a9b4670d2f9327f6ac";
export const QWEN3_VL_2B_VISION_GEOMETRY_PROGRAM_SHA256 =
    "d5f436653de94d90b19e708a019bcec9aadd19182e41fdddc18f5f42ce6fd450";
export const QWEN3_VL_2B_VISION_GEOMETRY_CONSTANTS_SHA256 =
    "7f4e2210888b2f0fddf70502c9d2cd57b58115a2e01f8d7767d6f1c3d893f3b6";
export const QWEN3_VL_2B_VISION_GEOMETRY_INPUTS =
    createQwen3Vl2bVisionGeometryRuntime().inputMetadata;
export const QWEN3_VL_2B_VISION_GEOMETRY_OUTPUTS = Object.freeze([
    "image_features",
    "__openchat_deepstack_features_0",
    "__openchat_deepstack_features_1",
    "__openchat_deepstack_features_2",
]);
// Retain the exact namespace of the numerically qualified grouped graph. Names are
// internal ONNX values, not an externally enabled diagnostic mode.
const PREFIX = "__openchat_diag_vision_head_groups/";
const GROUPED_SHA = "fa82bccef6da52fc60805eb092146e095309aaa4391c2bc51fa3e732afbda905";
const CUT_INDICES = Array.from({ length: 111 }, (_, i) => i).filter(
    (i) => (i >= 2 && i <= 44) || (i >= 51 && i <= 88) || (i >= 93 && i <= 102),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (type, item) => Buffer.from(type.encode(item).finish());
const encodedModel = (model) => encode(schema.ModelProto, model);
const digest = (type, items) => hash(Buffer.concat(items.map((item) => encode(type, item))));
const clone = (type, item) => type.decode(encode(type, item));
const shape = (value) =>
    value.type.tensorType.shape.dim.map((d) => d.dimParam || Number(d.dimValue));
const node = (name, opType, input, output, attribute = []) => ({
    name,
    opType,
    input,
    output: [output],
    attribute,
});
const integer = (name, i) => ({ name, type: 2, i });
const integerTensor = (name, n) => ({ name, dataType: 7, dims: [1], int64Data: [n] });

function attentionTemplate() {
    const nodes = [],
        initializers = [integerTensor("head_axis", 1), integerTensor("unit_step", 1)];
    const contexts = [];
    for (let group = 0; group < 4; group++) {
        const prefix = "group" + group;
        initializers.push(
            integerTensor(prefix + "/start", group * 4),
            integerTensor(prefix + "/end", (group + 1) * 4),
        );
        for (const input of ["q", "kt", "v"]) {
            nodes.push(
                node(
                    prefix + "/slice_" + input,
                    "Slice",
                    [input, prefix + "/start", prefix + "/end", "head_axis", "unit_step"],
                    prefix + "/" + input,
                ),
            );
        }
        nodes.push(
            node(prefix + "/qk", "MatMul", [prefix + "/q", prefix + "/kt"], prefix + "/scores"),
            node(prefix + "/scale", "Mul", [prefix + "/scores", "scale"], prefix + "/scaled"),
            node(prefix + "/bias", "Add", [prefix + "/scaled", "mask"], prefix + "/biased"),
            node(prefix + "/softmax", "Softmax", [prefix + "/biased"], prefix + "/probs", [
                integer("axis", -1),
            ]),
            node(
                prefix + "/context",
                "MatMul",
                [prefix + "/probs", prefix + "/v"],
                prefix + "/context",
            ),
        );
        contexts.push(prefix + "/context");
    }
    nodes.push(node("join_heads", "Concat", contexts, "context", [integer("axis", 1)]));
    return {
        nodes: nodes.map((n) => clone(schema.NodeProto, schema.NodeProto.create(n))),
        initializers: initializers.map((t) =>
            clone(schema.TensorProto, schema.TensorProto.create(t)),
        ),
    };
}

function groupedGraph(original) {
    const model = schema.ModelProto.decode(Buffer.from(original)),
        graph = model.graph;
    const template = attentionTemplate(),
        starts = new Map(),
        removed = new Set();
    for (let layer = 0; layer < 24; layer++) {
        const prefix = "/model/layers." + layer + "/attn/mha/codex_unfused/";
        const start = graph.node.findIndex((n) => n.name === prefix + "qk");
        assert(start >= 0, "Missing fixed vision attention boundary");
        const chain = graph.node.slice(start, start + 5);
        assert.deepEqual(
            chain.map((n) => n.name),
            ["qk", "scale", "bias", "softmax", "context"].map((n) => prefix + n),
        );
        assert.deepEqual(
            chain.map((n) => n.opType),
            ["MatMul", "Mul", "Add", "Softmax", "MatMul"],
        );
        assert.deepEqual(
            chain.map((n) => n.input),
            [
                [prefix + "q", prefix + "kt"],
                [prefix + "scores", "__codex_unfused_mha_scale"],
                [prefix + "scaled", "/model/vision_rope/attn_mask/UnsqueezeBatchHead/output_0"],
                [prefix + "biased"],
                [prefix + "probs", prefix + "v"],
            ],
        );
        assert.deepEqual(
            chain.map((n) => n.output),
            ["scores", "scaled", "biased", "probs", "context"].map((n) => [prefix + n]),
        );
        assert.equal(Number(chain[3].attribute[0].i), -1);
        for (const n of chain.slice(0, 4)) {
            const users = graph.node.filter((candidate) => candidate.input.includes(n.output[0]));
            assert.equal(users.length, 1);
            assert(chain.includes(users[0]) && !graph.output.some((v) => v.name === n.output[0]));
        }
        const local = PREFIX + "layer" + layer + "/";
        const bindings = new Map([
            ["q", chain[0].input[0]],
            ["kt", chain[0].input[1]],
            ["v", chain[4].input[1]],
            ["mask", chain[2].input[1]],
            ["scale", chain[1].input[1]],
            ["context", chain[4].output[0]],
        ]);
        const constants = new Set(template.initializers.map((t) => t.name));
        const rename = (name) =>
            bindings.get(name) ?? (constants.has(name) ? PREFIX + name : local + name);
        starts.set(
            start,
            template.nodes.map((source) => {
                const n = clone(schema.NodeProto, source);
                n.name = local + source.name;
                n.input = source.input.map(rename);
                n.output = source.output.map(rename);
                return n;
            }),
        );
        chain.forEach((n) => removed.add(n.name));
    }
    graph.node = graph.node.flatMap((n, i) => starts.get(i) ?? (removed.has(n.name) ? [] : [n]));
    graph.initializer.push(
        ...template.initializers.map((source) => {
            const t = clone(schema.TensorProto, source);
            t.name = PREFIX + source.name;
            return t;
        }),
    );
    assert.equal(graph.node.length, 1861);
    assert.equal(graph.initializer.length, 560);
    // This binds all head slices, their ordering, complete masks and scale/softmax semantics
    // to the full-encoder graph already compared at all four learned outputs.
    assert.equal(hash(encodedModel(model)), GROUPED_SHA, "Qualified head-group graph changed");
    return model;
}

/** Replace only source-bound geometry with private inputs; keep one dynamic graph for 55 grids.
 * Runtime MUST supply createQwen3Vl2bVisionGeometryRuntime controls before each native call.
 * This is not self-contained model interchange: the original two-input public contract belongs
 * to the later session facade. No graph download, weight read or model execution occurs here.
 */
export function patchQwen3Vl2bVisionGeometryGraph(bytes) {
    assert(
        (Buffer.isBuffer(bytes) || bytes instanceof Uint8Array) &&
            bytes.byteLength === QWEN3_VL_2B_VISION_GEOMETRY_SOURCE_BYTES &&
            hash(bytes) === QWEN3_VL_2B_VISION_GEOMETRY_SOURCE_SHA256,
        "Pinned complete Qwen vision source changed or was already transformed",
    );
    const original = Buffer.from(bytes),
        before = schema.ModelProto.decode(Buffer.from(original)),
        g = before.graph;
    assert(encodedModel(before).equals(original), "Noncanonical source graph");
    assert.equal(g.node.length, 1189);
    assert.equal(g.initializer.length, 550);
    assert.equal(g.initializer.filter((t) => t.externalData.length).length, 524);
    assert.deepEqual(
        g.input.map((v) => [v.name, v.type.tensorType.elemType, shape(v)]),
        [
            ["pixel_values", 1, ["num_patches", 1536]],
            ["image_grid_thw", 7, ["num_images", 3]],
        ],
    );
    assert.deepEqual(
        g.output.map((v) => v.name),
        QWEN3_VL_2B_VISION_GEOMETRY_OUTPUTS,
    );
    for (const output of g.output) {
        assert.equal(output.type.tensorType.elemType, 1);
        assert.deepEqual(shape(output), ["num_features", 2048]);
    }
    const cut = CUT_INDICES.map((i) => g.node[i]),
        cutNames = new Set(cut.map((n) => n.name));
    assert.equal(digest(schema.NodeProto, cut), QWEN3_VL_2B_VISION_GEOMETRY_PROGRAM_SHA256);
    const seen = new Set(["image_grid_thw", "pixel_values"]),
        constants = [];
    for (const n of cut) {
        assert.equal(n.domain, "");
        assert.equal(n.output.length, 1);
        for (const name of n.input) {
            if (name === "pixel_values") assert.equal(n.opType, "Shape");
            if (!seen.has(name)) {
                const t = g.initializer.find((t) => t.name === name);
                assert(
                    t && t.externalData.length === 0 && t.dataLocation !== 1,
                    "Learned geometry dependency",
                );
                constants.push(t);
                seen.add(name);
            }
        }
        n.output.forEach((name) => seen.add(name));
    }
    assert.equal(constants.length, 16);
    assert.equal(
        digest(schema.TensorProto, constants),
        QWEN3_VL_2B_VISION_GEOMETRY_CONSTANTS_SHA256,
    );
    const crossing = cut
        .flatMap((n) => n.output)
        .filter(
            (name) =>
                g.node.some((n) => !cutNames.has(n.name) && n.input.includes(name)) ||
                g.output.some((v) => v.name === name),
        );
    assert.deepEqual(
        crossing,
        QWEN3_VL_2B_VISION_GEOMETRY_INPUTS.map((v) => v.name),
    );
    const privateInputs = QWEN3_VL_2B_VISION_GEOMETRY_INPUTS.map((item) => {
        const v = g.valueInfo.find((v) => v.name === item.name);
        assert(
            v &&
                !g.input.some((x) => x.name === item.name) &&
                !g.initializer.some((x) => x.name === item.name),
        );
        assert.equal(v.type.tensorType.elemType, item.type === "float32" ? 1 : 7);
        assert.deepEqual(shape(v), item.shape);
        return clone(schema.ValueInfoProto, v);
    });
    const model = groupedGraph(original),
        grouped = encodedModel(model);
    model.graph.node = model.graph.node.filter((n) => !cutNames.has(n.name));
    model.graph.input.push(...privateInputs);
    assert.equal(model.graph.node.length, 1770);
    assert.equal(model.graph.initializer.length, 560);
    assert.equal(model.graph.input.length, 15);
    assert.equal(model.graph.output.length, 4);
    assert.equal(schema.ModelProto.verify(model), null);
    const result = encodedModel(model),
        after = schema.ModelProto.decode(result);
    // Every retained grouped node and every original/external initializer remain byte-identical.
    const groupedModel = schema.ModelProto.decode(grouped);
    assert.equal(
        digest(schema.NodeProto, after.graph.node),
        digest(
            schema.NodeProto,
            groupedModel.graph.node.filter((n) => !cutNames.has(n.name)),
        ),
    );
    assert.equal(
        digest(schema.TensorProto, after.graph.initializer),
        digest(schema.TensorProto, groupedModel.graph.initializer),
    );
    const produced = new Set([...after.graph.input, ...after.graph.initializer].map((v) => v.name));
    for (const n of after.graph.node) {
        for (const name of n.input) if (name) assert(produced.has(name), "Dangling input: " + name);
        for (const name of n.output)
            if (name) {
                assert(!produced.has(name));
                produced.add(name);
            }
    }
    for (const output of after.graph.output) assert(produced.has(output.name));
    // Exact reversal proves no output, opset, metadata, external data, or unrelated graph edits.
    after.graph.node = before.graph.node;
    after.graph.initializer = before.graph.initializer;
    after.graph.input = before.graph.input;
    assert(encodedModel(after).equals(original), "Unrelated graph content changed");
    assert.equal(result.byteLength, QWEN3_VL_2B_VISION_GEOMETRY_BYTES);
    assert.equal(
        hash(result),
        QWEN3_VL_2B_VISION_GEOMETRY_SHA256,
        "Pinned geometry graph output changed",
    );
    return result;
}
