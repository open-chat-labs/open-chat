// Build-time, generation-only graph composition for the pinned Qwen decoder.
// This stages graph bytes only: callers must supply validated host metadata, strict WebGPU
// sessions, and the B=1/S+past<=1024 runtime contract. No learned weights are read or evaluated.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const onnx = createRequire(import.meta.url)(
    path.join(
        import.meta.dirname,
        "../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
    ),
).onnx;

export const QWEN3_VL_2B_GENERATION_SOURCE_BYTES = 5_086_571;
export const QWEN3_VL_2B_GENERATION_SOURCE_SHA256 =
    "dee3961fa1fe66c37f3f716d44a8daf571e12a4c5c6ce7884f99fe31454e83e8";
export const QWEN3_VL_2B_GENERATION_BYTES = 4_896_612;
export const QWEN3_VL_2B_GENERATION_SHA256 =
    "475d9ad51b0da52e7510a8b597bdf42a533e552de3a3b74c58284ae6b2472375";
const SOURCE_BYTES = 4_896_044;
const SOURCE_SHA = "c962dfae3958b772652204069ad8ae646f2e41a72a31ef5416a7394ed94f5c20";
const QUANT_NAME = "lm_head_MatMul_weight_quant";
const SHAPE_NAME = "__openchat_tied_embedding_shape";
const ALIAS_NAME = "__openchat_tied_embedding_quant_2d";
const EXTERNAL = Object.freeze({
    location: "decoder_model_merged_q4.onnx_data",
    offset: 903290880,
    length: 155582464,
});
const HEAD_NAME = "/lm_head/MatMul_Quant";
const HIDDEN_NAME = "/model/layers.28/final_norm_layernorm/output_0";
const SELECTED_NAME = "__openchat_generation_last_hidden";
const SLICE_NAME = "__openchat/generation/last_hidden/Slice";
const WEIGHT_NAMES = Object.freeze([
    "lm_head_MatMul_weight_quant",
    "lm_head_MatMul_weight_scales",
    "lm_head_MatMul_weight_zp",
]);
const CONTROL_VALUES = Object.freeze({ starts: -1, ends: 1024, axes: 1, steps: 1 });
const CONTROL_NAMES = Object.freeze(
    Object.keys(CONTROL_VALUES).map((key) => SELECTED_NAME + "_" + key),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (type, value) => Buffer.from(type.encode(value).finish());
const clone = (type, value) => type.decode(encode(type, value));
const tensorCopy = (tensor) => clone(onnx.TensorProto, tensor);
const dims = (value) =>
    value.type.tensorType.shape.dim.map((dim) => dim.dimParam || Number(dim.dimValue));
function int64Bytes(value) {
    const bytes = Buffer.alloc(8);
    bytes.writeBigInt64LE(BigInt(value));
    return bytes;
}
const hostName = (suffix) => `__openchat_hostmeta_${suffix}`;
const input = (suffix, dims, formula) =>
    Object.freeze({ name: hostName(suffix), type: "int64", dims: Object.freeze(dims), formula });
const HOST_INPUTS = Object.freeze([
    input("rotary_expand_shape", [4], "[3,B,64,1]"),
    input("attention_bias_shape", [4], "[B,1,S,T]"),
    input(
        "rotary_positions",
        ["batch_size", "sequence_length"],
        "reshape(range(0,B*S,1),[B,S]); no past offset",
    ),
    input("total_vector", [1], "[T]"),
    input("causal_starts", [2], "[P,0]"),
    input("causal_ends", [2], "[T,T]"),
    input("key_score_pads", [8], "[0,0,0,0,0,0,0,1024-T]"),
    input("value_pads", [8], "[0,0,0,0,0,0,1024-T,0]"),
]);
const HOST_INPUT_NAMES = Object.freeze(HOST_INPUTS.map((x) => x.name));
const ADDITIONAL_DEAD_INDICES = Object.freeze([8, 9, 12, 13, 14]);
const G = (i) => `/model/layers.${i}/attn/GroupQueryAttention/codex_unfused`;
const hostBySuffix = (suffix) => HOST_INPUTS.find((x) => x.name === hostName(suffix));
function mappingDefinitions() {
    const rows = [];
    const add = (originalName, suffix) => {
        const host = hostBySuffix(suffix);
        assert(host);
        rows.push({
            originalName,
            hostName: host.name,
            type: host.type,
            dims: [...host.dims],
            formula: host.formula,
        });
    };
    add("/model/mrope_dynamic_cache/expand_shape/Concat/output_0", "rotary_expand_shape");
    add("/model/gqa_attention_bias/Target4D/output_0", "attention_bias_shape");
    for (let layer = 0; layer < 28; layer++) {
        for (const side of ["q", "k"])
            add(
                `/model/layers.${layer}/attn/${side}_mrope/PosIds/Reshape/output_0`,
                "rotary_positions",
            );
        for (const [old, replacement] of [
            ["total", "total_vector"],
            ["causal_starts", "causal_starts"],
            ["causal_ends", "causal_ends"],
            ["pads", "key_score_pads"],
            ["v_pads", "value_pads"],
        ])
            add(`${G(layer)}/${old}`, replacement);
    }
    assert.equal(rows.length, 198);
    return rows;
}
const attr = (n) =>
    n.attribute.map((a) => ({
        name: a.name,
        type: a.type,
        i: Number(a.i),
        ints: a.ints.map(Number),
    }));
function graphIndexes(g) {
    const producer = new Map(),
        nodesByName = new Map(),
        consumers = new Map();
    for (const [index, n] of g.node.entries()) {
        assert(!nodesByName.has(n.name), `Duplicate node: ${n.name}`);
        nodesByName.set(n.name, index);
        for (const name of n.output)
            if (name) {
                assert(!producer.has(name), `Duplicate output: ${name}`);
                producer.set(name, index);
            }
        for (const [inputIndex, name] of n.input.entries())
            if (name) {
                const rows = consumers.get(name) ?? [];
                rows.push({ index, inputIndex });
                consumers.set(name, rows);
            }
    }
    return {
        producer,
        nodesByName,
        consumers,
        constants: new Map(g.initializer.map((t) => [t.name, t])),
    };
}
function intValues(t) {
    assert(
        t && t.dataType === 7 && t.externalData.length === 0 && t.dataLocation === 0,
        "Metadata constants must be inline INT64",
    );
    const result = t.rawData.length
        ? Array.from({ length: t.rawData.length / 8 }, (_, i) =>
              Number(Buffer.from(t.rawData).readBigInt64LE(i * 8)),
          )
        : t.int64Data.map(Number);
    assert(result.every((x) => Number.isSafeInteger(x) && x >= 0 && x <= 1024));
    return result;
}
const nodeBinding = (n, index) => ({
    index,
    name: n.name,
    opType: n.opType,
    sha256: hash(encode(onnx.NodeProto, n)),
});
const countOps = (nodes) => nodes.reduce((r, n) => ((r[n.opType] = (r[n.opType] ?? 0) + 1), r), {});

/** Structural proof, not a runtime evaluator. It admits only the pinned repeated patterns. */
function inspectMetadataCut(model) {
    const g = model.graph;
    assert(g && g.node.length === 2464 && g.initializer.length === 759);
    const idx = graphIndexes(g),
        definitions = mappingDefinitions(),
        selected = new Set(),
        leaves = new Set();
    const oldOnlyBoundaries = [
        "/model/shared_dims/attention_mask/Gather_1/output_0",
        "/model/attn_mask_reformat/attn_mask_subgraph/Concat/output_0",
    ];
    const expectedOps = {
        Shape: 115,
        Gather: 200,
        Concat: 171,
        Unsqueeze: 3,
        Mul: 56,
        Reshape: 56,
        Range: 56,
        Sub: 56,
    };
    function walk(index) {
        assert(Number.isInteger(index), "Unknown control producer");
        if (selected.has(index)) return;
        selected.add(index);
        const n = g.node[index];
        assert(
            n.domain === "" && Object.hasOwn(expectedOps, n.opType),
            `Non-control operator entered cut: ${n.name}`,
        );
        if (n.opType === "Shape") return;
        for (const name of n.input) {
            assert(name);
            if (idx.producer.has(name)) walk(idx.producer.get(name));
            else {
                assert(idx.constants.has(name), `Value-dependent root entered cut: ${name}`);
                leaves.add(name);
            }
        }
    }
    for (const name of [...definitions.map((x) => x.originalName), ...oldOnlyBoundaries])
        walk(idx.producer.get(name));
    // Original rejected-control inventory also contains 28 unused batch Gathers.
    for (let layer = 0; layer < 28; layer++) walk(idx.nodesByName.get(`${G(layer)}/batch`));
    assert.equal(selected.size, 713);
    assert.deepEqual(countOps([...selected].map((i) => g.node[i])), expectedOps);
    assert.equal(leaves.size, 12);
    const expectedConstants = {
        "/model/constants/INT64/0": [0],
        "/model/constants/INT64/1": [1],
        "/model/constants/INT64/[0]": [0],
        "/model/constants/INT64/[1]": [1],
        "/model/constants/INT64/[3]": [3],
        "/model/constants/INT64/[64, 1]": [64, 1],
        __codex_unfused_gqa_index_0: [0],
        __codex_unfused_gqa_index_1: [1],
        __codex_unfused_gqa_index_2: [2],
        __codex_unfused_gqa_max_causal_sequence: [1024],
        __codex_unfused_gqa_pad_prefix: [0, 0, 0, 0, 0, 0, 0],
        __codex_unfused_gqa_pad_v_prefix: [0, 0, 0, 0, 0, 0],
    };
    assert.deepEqual([...leaves].sort(), Object.keys(expectedConstants).sort());
    for (const [name, values] of Object.entries(expectedConstants))
        assert.deepEqual(intValues(idx.constants.get(name)), values, name);
    const constant = (suffix) => `/model/constants/INT64/${suffix}`;
    const checkNode = (name, opType, inputs, axis) => {
        const n = g.node[idx.nodesByName.get(name)];
        assert(n, name);
        assert.equal(n.opType, opType);
        assert.equal(n.domain, "");
        assert.deepEqual(n.input, inputs, name);
        assert.deepEqual(
            attr(n),
            axis === undefined ? [] : [{ name: "axis", type: 2, i: axis, ints: [] }],
            name,
        );
        assert.equal(n.output.length, 1);
        return n.output[0];
    };
    const shapes = [];
    function shape(name, root, dims) {
        const output = checkNode(name, "Shape", [root]);
        shapes.push({ nodeIndex: idx.nodesByName.get(name), root, dims });
        return output;
    }
    const maskShape = shape("/model/shared_dims/attention_mask/Shape", "attention_mask", [1, "T"]);
    const maskT = checkNode(
        "/model/shared_dims/attention_mask/Gather_1",
        "Gather",
        [maskShape, constant("1")],
        0,
    );
    const selectedShape = shape(
        "/model/shared_dims/root_input/Shape",
        "__openchat_selected_input_embeddings",
        [1, "S", 2048],
    );
    const batch = checkNode(
        "/model/shared_dims/root_input/Gather_0",
        "Gather",
        [selectedShape, constant("0")],
        0,
    );
    const sequence = checkNode(
        "/model/shared_dims/root_input/Gather_1",
        "Gather",
        [selectedShape, constant("1")],
        0,
    );
    const batchVector = checkNode(
        "/model/attn_mask_reformat/attn_mask_subgraph/BatchSize/Unsqueeze",
        "Unsqueeze",
        [batch, constant("[0]")],
    );
    checkNode(
        "/model/attn_mask_reformat/attn_mask_subgraph/Concat",
        "Concat",
        [batchVector, constant("[1]")],
        0,
    );
    const posShape = shape("/model/mrope_dynamic_cache/pos_ids/Shape", "position_ids", [3, 1, "S"]);
    const posBatch = checkNode(
        "/model/mrope_dynamic_cache/pos_ids/Gather_1",
        "Gather",
        [posShape, constant("[1]")],
        0,
    );
    checkNode(
        "/model/mrope_dynamic_cache/expand_shape/Concat",
        "Concat",
        [constant("[3]"), posBatch, constant("[64, 1]")],
        0,
    );
    const seqVector = checkNode("/model/gqa_attention_bias/Unsqueeze_S", "Unsqueeze", [
        sequence,
        constant("[0]"),
    ]);
    const totalVector = checkNode("/model/gqa_attention_bias/Unsqueeze_T", "Unsqueeze", [
        maskT,
        constant("[0]"),
    ]);
    checkNode(
        "/model/gqa_attention_bias/Target4D",
        "Concat",
        [batchVector, constant("[1]"), seqVector, totalVector],
        0,
    );
    const deadBatchNodes = [];
    for (let layer = 0; layer < 28; layer++) {
        for (const [side, width] of [
            ["q", 2048],
            ["k", 1024],
        ]) {
            const p = `/model/layers.${layer}/attn/${side}_mrope`;
            const dims = shape(
                `${p}/Shape`,
                `/model/layers.${layer}/attn/${side}_norm/Reshape_2/output_0`,
                [1, "S", width],
            );
            const b = checkNode(`${p}/Gather_0`, "Gather", [dims, constant("[0]")], 0),
                s = checkNode(`${p}/Gather_1`, "Gather", [dims, constant("[1]")], 0);
            const length = checkNode(`${p}/TotalLen/Mul`, "Mul", [b, s]);
            const range = checkNode(`${p}/Range`, "Range", [constant("0"), length, constant("1")]);
            const target = checkNode(`${p}/PosIds/Shape/Concat`, "Concat", [b, s], 0);
            checkNode(`${p}/PosIds/Reshape`, "Reshape", [range, target]);
        }
        const p = G(layer),
            c = (suffix) => `__codex_unfused_gqa_${suffix}`;
        const present = shape(`${p}/present_shape`, `present.${layer}.key`, [1, 8, "T", 128]);
        const query = shape(
            `${p}/query_shape`,
            `/model/layers.${layer}/attn/q_mrope/Output/Reshape/output_0`,
            [1, "S", 2048],
        );
        const unusedBatch = checkNode(`${p}/batch`, "Gather", [present, c("index_0")]);
        assert.equal((idx.consumers.get(unusedBatch) ?? []).length, 0);
        assert(!g.output.some((x) => x.name === unusedBatch));
        deadBatchNodes.push(
            nodeBinding(g.node[idx.producer.get(unusedBatch)], idx.producer.get(unusedBatch)),
        );
        const t = checkNode(`${p}/total`, "Gather", [present, c("index_2")]),
            s = checkNode(`${p}/sequence`, "Gather", [query, c("index_1")]);
        const past = checkNode(`${p}/past`, "Sub", [t, s]);
        checkNode(`${p}/causal_starts`, "Concat", [past, c("index_0")], 0);
        checkNode(`${p}/causal_ends`, "Concat", [t, t], 0);
        const pad = checkNode(`${p}/pad_amount`, "Sub", [c("max_causal_sequence"), t]);
        checkNode(`${p}/pads`, "Concat", [c("pad_prefix"), pad], 0);
        checkNode(`${p}/v_pads`, "Concat", [c("pad_v_prefix"), pad, c("index_0")], 0);
    }
    assert.equal(shapes.length, 115);
    const beforeAdditional = new Set(selected);
    const expectedDead = [
        [8, "Sub", "/model/attn_mask_reformat/attn_mask_subgraph/Sub"],
        [9, "Unsqueeze", "/model/attn_mask_reformat/attn_mask_subgraph/Sub/Unsqueeze"],
        [12, "Expand", "/model/attn_mask_reformat/attn_mask_subgraph/Expand"],
        [13, "Cast", "/model/attn_mask_reformat/attn_mask_subgraph/Expand/Cast"],
        [14, "Cast", "/model/attn_mask_reformat/attn_mask_subgraph/Gather/Cast"],
    ];
    const additionalDead = expectedDead.map(([index, opType, name]) => {
        const n = g.node[index];
        assert.equal(n.name, name);
        assert.equal(n.opType, opType);
        assert.equal(n.domain, "");
        assert(!beforeAdditional.has(index));
        selected.add(index);
        return {
            ...nodeBinding(n, index),
            outputConsumers: n.output.map((output) => ({
                output,
                consumers: (idx.consumers.get(output) ?? []).map((x) => x.index),
                graphOutput: g.output.some((v) => v.name === output),
            })),
        };
    });
    for (const row of additionalDead)
        for (const out of row.outputConsumers) {
            assert.equal(out.graphOutput, false);
            assert(
                out.consumers.every((i) => selected.has(i)),
                "Dead chain escapes cut",
            );
        }
    for (const index of [13, 14])
        for (const output of g.node[index].output)
            assert.equal((idx.consumers.get(output) ?? []).length, 0);
    for (const index of ADDITIONAL_DEAD_INDICES)
        for (const name of g.node[index].input)
            assert(
                idx.constants.has(name) || selected.has(idx.producer.get(name)),
                "Dead chain reads values",
            );
    assert.equal(selected.size, 718);
    const crossing = [];
    for (const index of selected)
        for (const name of g.node[index].output) {
            assert(!g.output.some((x) => x.name === name), "Control removal changes graph output");
            if ((idx.consumers.get(name) ?? []).some((x) => !selected.has(x.index)))
                crossing.push(name);
        }
    assert.deepEqual(
        crossing.sort(),
        definitions.map((x) => x.originalName).sort(),
        "Undeclared control boundary",
    );
    const mapping = definitions.map((row) => ({
        ...row,
        originalNodeIndex: idx.producer.get(row.originalName),
    }));
    return { removed: selected, mapping };
}
function cutMetadata(original) {
    const before = onnx.ModelProto.decode(original),
        model = clone(onnx.ModelProto, before),
        proof = inspectMetadataCut(before),
        g = model.graph;
    const originalProducer = graphIndexes(before.graph).producer;
    const map = new Map(proof.mapping.map((x) => [x.originalName, x.hostName])),
        rewires = [],
        retained = [];
    const occupied = new Set(
        [...g.input, ...g.initializer, ...g.output, ...g.valueInfo].map((x) => x.name),
    );
    for (const n of g.node) for (const output of n.output) if (output) occupied.add(output);
    for (const item of HOST_INPUTS) assert(!occupied.has(item.name), "Host input name collision");
    for (const [index, n] of g.node.entries()) {
        if (proof.removed.has(index)) continue;
        for (const [inputIndex, originalName] of n.input.entries())
            if (map.has(originalName)) {
                const hostName = map.get(originalName);
                n.input[inputIndex] = hostName;
                rewires.push({
                    originalNodeIndex: index,
                    retainedNodeIndex: retained.length,
                    nodeName: n.name,
                    inputIndex,
                    originalName,
                    hostName,
                });
            }
        retained.push(n);
    }
    g.node = retained;
    for (const host of HOST_INPUTS)
        g.input.push(
            onnx.ValueInfoProto.create({
                name: host.name,
                type: {
                    tensorType: {
                        elemType: 7,
                        shape: {
                            dim: host.dims.map((d) =>
                                typeof d === "number" ? { dimValue: d } : { dimParam: d },
                            ),
                        },
                    },
                },
            }),
        );
    assert.equal(g.node.length, 1746);
    assert.equal(g.initializer.length, 759);
    assert.equal(g.input.length, before.graph.input.length + 8);
    // Drop only metadata describing removed tensors. Every retained learned ValueInfo stays exact.
    const removedValueInfo = g.valueInfo.filter((v) =>
        proof.removed.has(originalProducer.get(v.name)),
    );
    assert.equal(removedValueInfo.length, 410, "Unexpected removed control metadata");
    g.valueInfo = g.valueInfo.filter((v) => !proof.removed.has(originalProducer.get(v.name)));
    const available = new Set([...g.input, ...g.initializer].map((x) => x.name));
    for (const n of g.node) {
        for (const name of n.input)
            if (name) assert(available.has(name), `Unbound retained input: ${name}`);
        for (const name of n.output)
            if (name) {
                assert(!available.has(name), `Duplicate tensor: ${name}`);
                available.add(name);
            }
    }
    for (const output of g.output) assert(available.has(output.name));
    const beforeOptional = before.graph.node
        .flatMap((n) => n.output)
        .filter((x) => x === "").length;
    assert.equal(g.node.flatMap((n) => n.output).filter((x) => x === "").length, beforeOptional);
    // Every retained protobuf must reconstruct exactly by reversing only declared input slots.
    const restoredNodes = g.node.map((n) => clone(onnx.NodeProto, n));
    for (const r of rewires) {
        assert.equal(restoredNodes[r.retainedNodeIndex].input[r.inputIndex], r.hostName);
        restoredNodes[r.retainedNodeIndex].input[r.inputIndex] = r.originalName;
    }
    const originalRetained = before.graph.node.filter((_, index) => !proof.removed.has(index));
    for (let i = 0; i < restoredNodes.length; i++)
        assert(
            encode(onnx.NodeProto, restoredNodes[i]).equals(
                encode(onnx.NodeProto, originalRetained[i]),
            ),
            "Non-input retained node drift",
        );
    for (let i = 0; i < g.initializer.length; i++)
        assert(
            encode(onnx.TensorProto, g.initializer[i]).equals(
                encode(onnx.TensorProto, before.graph.initializer[i]),
            ),
            "Initializer drift",
        );
    const restored = clone(onnx.ModelProto, model);
    restored.graph.node = before.graph.node;
    restored.graph.input = before.graph.input;
    restored.graph.valueInfo = before.graph.valueInfo;
    assert(
        encode(onnx.ModelProto, restored).equals(Buffer.from(original)),
        "Model/output/opset/valueInfo metadata drift",
    );
    assert.equal(onnx.ModelProto.verify(model), null);
    const bytes = encode(onnx.ModelProto, model);
    assert.equal(bytes.length, 4896050);
    assert.equal(
        hash(bytes),
        "4fec68178da2aa671ce74ded572755428754d54cc161766c708f11bebf43db83",
        "Metadata graph identity changed",
    );
    return bytes;
}
function proveRowMajorMapping(sourceDims, targetDims, byteLength) {
    assert(
        Array.isArray(sourceDims) &&
            sourceDims.length === 3 &&
            sourceDims.every((x) => Number.isSafeInteger(x) && x > 0),
    );
    assert(
        Array.isArray(targetDims) &&
            targetDims.length === 2 &&
            targetDims.every((x) => Number.isSafeInteger(x) && x > 0),
    );
    const [rows, blocks, packedBytes] = sourceDims,
        columns = blocks * packedBytes;
    const sourceElements = rows * columns;
    assert(Number.isSafeInteger(columns) && Number.isSafeInteger(sourceElements));
    assert.deepEqual(
        targetDims,
        [rows, columns],
        "Only the last two contiguous axes may be collapsed",
    );
    assert.equal(byteLength, sourceElements, "UINT8 byte count changed");
    const sourceCoefficients = [columns, packedBytes, 1],
        composedTargetCoefficients = [targetDims[1], packedBytes, 1];
    assert.deepEqual(composedTargetCoefficients, sourceCoefficients);
    assert.equal(
        (rows - 1) * columns + (blocks - 1) * packedBytes + packedBytes - 1,
        byteLength - 1,
    );
    return {
        sourceDims,
        targetDims,
        elementType: "UINT8",
        bytesPerElement: 1,
        sourceElements,
        targetElements: targetDims[0] * targetDims[1],
        sourceOffsetFormula: "(row * blocks + block) * packedBytes + byte",
        targetColumnFormula: "block * packedBytes + byte",
        targetOffsetFormula: "row * columns + targetColumn",
        sourceCoefficients,
        composedTargetCoefficients,
        validCoordinateBounds: [
            [0, rows - 1],
            [0, blocks - 1],
            [0, packedBytes - 1],
        ],
        coveredByteOffsets: [0, byteLength - 1],
        bijective: true,
        universalAffineIdentity: true,
        weightBytesRead: 0,
    };
}

/** Independent structural checks, also exercised against intentionally modified decoded graphs. */
function inspectAliasBoundary(model) {
    const g = model.graph;
    assert(
        g && g.node.length === 2464 && g.initializer.length === 759,
        "Delivered graph cardinality changed",
    );
    const node = g.node[0];
    assert.equal(node.name, "__openchat/tied_embedding/Reshape");
    assert.equal(node.opType, "Reshape");
    assert.equal(node.domain, "");
    assert.deepEqual(node.attribute, []);
    assert.deepEqual(node.input, [QUANT_NAME, SHAPE_NAME]);
    assert.deepEqual(node.output, [ALIAS_NAME]);
    assert.equal(
        g.node.filter((n) => n.output.includes(ALIAS_NAME)).length,
        1,
        "Alias producer changed",
    );
    assert.equal(g.initializer.filter((t) => t.name === QUANT_NAME).length, 1);
    assert.equal(g.initializer.filter((t) => t.name === SHAPE_NAME).length, 1);
    assert(!g.initializer.some((t) => t.name === ALIAS_NAME), "Alias already has an initializer");
    assert(!g.input.some((v) => v.name === ALIAS_NAME));
    assert.deepEqual(
        g.output.map((v) => v.name),
        [
            "logits",
            ...Array.from({ length: 28 }, (_, i) => [
                `present.${i}.key`,
                `present.${i}.value`,
            ]).flat(),
        ],
        "Decoder output contract changed",
    );
    const consumers = g.node
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.input.includes(ALIAS_NAME));
    assert.equal(consumers.length, 1, "Alias must have exactly one consumer");
    const consumer = consumers[0];
    assert.equal(consumer.i, 1);
    assert.equal(consumer.n.name, "__openchat/tied_embedding/GatherBlockQuantized");
    assert.equal(consumer.n.opType, "GatherBlockQuantized");
    assert.equal(consumer.n.domain, "com.microsoft");
    assert.deepEqual(consumer.n.input, [
        ALIAS_NAME,
        "__openchat_input_ids",
        "lm_head_MatMul_weight_scales",
        "lm_head_MatMul_weight_zp",
    ]);
    assert.deepEqual(consumer.n.output, ["__openchat_tied_token_embeddings"]);
    assert.deepEqual(
        consumer.n.attribute.map((a) => [a.name, Number(a.i), a.type]),
        [
            ["bits", 4, 2],
            ["block_size", 32, 2],
            ["gather_axis", 0, 2],
            ["quantize_axis", 1, 2],
        ],
    );
    const quant = g.initializer.find((t) => t.name === QUANT_NAME),
        shape = g.initializer.find((t) => t.name === SHAPE_NAME);
    assert.equal(quant.dataType, 2);
    assert.deepEqual(quant.dims.map(Number), [151936, 64, 16]);
    assert.equal(quant.dataLocation, 1);
    assert.deepEqual(
        quant.externalData.map((x) => [x.key, x.value]),
        [
            ["location", EXTERNAL.location],
            ["offset", String(EXTERNAL.offset)],
            ["length", String(EXTERNAL.length)],
        ],
    );
    for (const key of [
        "rawData",
        "floatData",
        "int32Data",
        "stringData",
        "int64Data",
        "doubleData",
        "uint64Data",
    ])
        assert.equal(quant[key].length, 0, "External weights must not be inlined");
    assert.equal(shape.dataType, 7);
    assert.deepEqual(shape.dims.map(Number), [2]);
    assert.equal(shape.dataLocation, 0);
    assert.deepEqual(shape.externalData, []);
    assert.equal(shape.rawData.length, 0);
    assert.deepEqual(shape.int64Data.map(Number), [151936, 1024]);
    const proof = proveRowMajorMapping(
        quant.dims.map(Number),
        shape.int64Data.map(Number),
        EXTERNAL.length,
    );
    assert(Number.isSafeInteger(EXTERNAL.offset + EXTERNAL.length));
    return { quant, shape, consumerIndex: consumer.i, proof };
}

/** The external initializer is a row-major view, not proof of shared GPU allocation. */
function aliasPackedEmbedding(bytes, delivered) {
    const source = onnx.ModelProto.decode(bytes),
        candidate = clone(onnx.ModelProto, source);
    const { quant } = inspectAliasBoundary(onnx.ModelProto.decode(delivered));
    assert(
        encode(onnx.NodeProto, candidate.graph.node[0]).equals(
            encode(onnx.NodeProto, onnx.ModelProto.decode(delivered).graph.node[0]),
        ),
    );
    const alias = tensorCopy(quant);
    alias.name = ALIAS_NAME;
    alias.dims = [151936, 1024];
    const restoredAlias = tensorCopy(alias);
    restoredAlias.name = quant.name;
    restoredAlias.dims = [...quant.dims];
    assert(
        encode(onnx.TensorProto, restoredAlias).equals(encode(onnx.TensorProto, quant)),
        "Alias changed external data",
    );
    candidate.graph.node.shift();
    candidate.graph.initializer.push(alias);
    assert.equal(candidate.graph.node.length, 1745);
    assert.equal(candidate.graph.initializer.length, 760);
    const restored = clone(onnx.ModelProto, candidate);
    restored.graph.node.unshift(source.graph.node[0]);
    restored.graph.initializer.pop();
    assert(
        encode(onnx.ModelProto, restored).equals(Buffer.from(bytes)),
        "Alias whole-graph reversal failed",
    );
    const result = encode(onnx.ModelProto, candidate);
    assert.equal(result.length, SOURCE_BYTES);
    assert.equal(hash(result), SOURCE_SHA, "Aliased graph identity changed");
    return result;
}
function lastMetadata(value, name = value.name) {
    const result = clone(onnx.ValueInfoProto, value);
    result.name = name;
    delete result.type.tensorType.shape.dim[1].dimParam;
    result.type.tensorType.shape.dim[1].dimValue = 1;
    return result;
}
function controls() {
    return Object.entries(CONTROL_VALUES).map(([key, value]) =>
        onnx.TensorProto.create({
            name: SELECTED_NAME + "_" + key,
            dims: [1],
            dataType: 7,
            rawData: int64Bytes(value),
        }),
    );
}
function structuralCheck(model) {
    assert.equal(onnx.ModelProto.verify(model), null);
    const available = new Set(
        [...model.graph.input, ...model.graph.initializer].map((value) => value.name),
    );
    for (const node of model.graph.node) {
        for (const name of node.input)
            if (name) assert(available.has(name), "Unbound input: " + name);
        for (const name of node.output)
            if (name) {
                assert(!available.has(name), "Duplicate output: " + name);
                available.add(name);
            }
    }
    for (const value of model.graph.output) assert(available.has(value.name));
}
function selectLastLogits(bytes) {
    const original = Buffer.from(bytes);
    assert.equal(original.length, SOURCE_BYTES);
    assert.equal(hash(original), SOURCE_SHA, "Unrecognized full-host decoder graph");
    const source = onnx.ModelProto.decode(original),
        candidate = clone(onnx.ModelProto, source),
        g = candidate.graph;
    assert(
        encode(onnx.ModelProto, source).equals(original),
        "Source protobuf is not byte-round-trippable",
    );
    assert.equal(g.node.length, 1745);
    assert.equal(g.initializer.length, 760);
    assert.equal(g.input.length, 71);
    assert.equal(g.output.length, 57);
    assert.equal(g.valueInfo.length, 1225);
    assert.equal(g.output[0].name, "logits");
    assert.equal(g.output[0].type.tensorType.elemType, 1);
    assert.deepEqual(dims(g.output[0]), ["batch_size", "sequence_length", 151936]);
    assert(!g.valueInfo.some((value) => value.name === "logits"));
    const head = g.node.at(-1),
        hidden = g.valueInfo.find((value) => value.name === HIDDEN_NAME);
    assert.equal(head.name, HEAD_NAME);
    assert.equal(head.opType, "MatMulNBits");
    assert.equal(head.domain, "com.microsoft");
    assert.deepEqual(head.input, [HIDDEN_NAME, ...WEIGHT_NAMES]);
    assert.deepEqual(head.output, ["logits"]);
    assert.deepEqual(
        head.attribute.map((a) => [a.name, Number(a.i)]),
        [
            ["K", 2048],
            ["N", 151936],
            ["bits", 4],
            ["block_size", 32],
        ],
    );
    assert.equal(hidden.type.tensorType.elemType, 1);
    assert.deepEqual(dims(hidden), ["batch_size", "sequence_length", 2048]);
    assert.equal(g.node.filter((node) => node.input.includes(HIDDEN_NAME)).length, 1);
    assert.equal(g.node.filter((node) => node.input.includes("logits")).length, 0);
    assert(!g.output.some((value) => value.name === HIDDEN_NAME));
    const allNames = new Set([
        ...g.node.flatMap((node) => [node.name, ...node.input, ...node.output]),
        ...g.initializer.map((t) => t.name),
        ...g.input.map((t) => t.name),
        ...g.output.map((t) => t.name),
        ...g.valueInfo.map((t) => t.name),
    ]);
    for (const name of [SELECTED_NAME, SLICE_NAME, ...CONTROL_NAMES])
        assert(!allNames.has(name), "Reserved generation name already exists: " + name);
    const controlTensors = controls(),
        slice = onnx.NodeProto.create({
            name: SLICE_NAME,
            opType: "Slice",
            input: [HIDDEN_NAME, ...CONTROL_NAMES],
            output: [SELECTED_NAME],
        });
    const weights = WEIGHT_NAMES.map((name) =>
        source.graph.initializer.find((t) => t.name === name),
    );
    assert(weights.every(Boolean));
    head.input[0] = SELECTED_NAME;
    g.node.splice(1744, 0, slice);
    g.initializer.push(...controlTensors);
    g.output[0] = lastMetadata(g.output[0]);
    g.valueInfo.push(lastMetadata(hidden, SELECTED_NAME));
    structuralCheck(candidate);
    for (let i = 0; i < 1744; i++)
        assert(
            encode(onnx.NodeProto, g.node[i]).equals(encode(onnx.NodeProto, source.graph.node[i])),
        );
    for (let i = 0; i < 760; i++)
        assert(
            encode(onnx.TensorProto, g.initializer[i]).equals(
                encode(onnx.TensorProto, source.graph.initializer[i]),
            ),
        );
    for (let i = 1; i < 57; i++)
        assert(
            encode(onnx.ValueInfoProto, g.output[i]).equals(
                encode(onnx.ValueInfoProto, source.graph.output[i]),
            ),
        );
    const candidateBytes = encode(onnx.ModelProto, candidate),
        reversed = clone(onnx.ModelProto, candidate);
    reversed.graph.node.splice(1744, 1);
    reversed.graph.node.at(-1).input[0] = HIDDEN_NAME;
    reversed.graph.initializer.splice(-4);
    reversed.graph.output[0] = source.graph.output[0];
    reversed.graph.valueInfo.pop();
    assert(encode(onnx.ModelProto, reversed).equals(original), "Exact whole-model reversal failed");
    assert.equal(candidateBytes.length, QWEN3_VL_2B_GENERATION_BYTES);
    assert.equal(
        hash(candidateBytes),
        QWEN3_VL_2B_GENERATION_SHA256,
        "Generation graph identity changed",
    );
    return candidateBytes;
}

export const QWEN3_VL_2B_GENERATION_HOST_INPUTS = HOST_INPUTS;
export const QWEN3_VL_2B_GENERATION_HOST_INPUT_NAMES = HOST_INPUT_NAMES;

/**
 * Compose only the pinned shape-control cut, exact packed initializer alias and last-row head.
 * General forward/scoring is deliberately unsupported. The runtime must validate B=1,
 * 0<S<=S+past<=1024 and all eight host controls before every invocation; this function
 * neither enables the graph nor establishes device placement, model accuracy or phone suitability.
 */
export function patchQwen3Vl2bGenerationGraph(deliveredBytes, options) {
    assert.deepEqual(
        options,
        { scope: "generation-only" },
        "Only generation-only graph scope is admitted",
    );
    if (
        !(Buffer.isBuffer(deliveredBytes) || deliveredBytes instanceof Uint8Array) ||
        deliveredBytes.byteLength !== QWEN3_VL_2B_GENERATION_SOURCE_BYTES ||
        hash(deliveredBytes) !== QWEN3_VL_2B_GENERATION_SOURCE_SHA256
    ) {
        throw new Error(
            "Pinned Qwen generation source identity changed or was already transformed.",
        );
    }
    // Own the protobuf backing bytes; never mutate or return an alias into caller-owned data.
    const original = Buffer.from(deliveredBytes);
    const result = selectLastLogits(aliasPackedEmbedding(cutMetadata(original), original));
    assert.equal(hash(original), QWEN3_VL_2B_GENERATION_SOURCE_SHA256, "Caller input changed");
    return result;
}
