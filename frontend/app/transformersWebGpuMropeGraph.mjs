import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const schema = createRequire(import.meta.url)(
    path.join(
        import.meta.dirname,
        "../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
    ),
).onnx;

const PREFIX = "/model/mrope_";
const RESERVED = "__openchat_mrope_";
const NODE_PREFIX = "__openchat/mrope/";
const SOURCE_NODES_SHA256 = "9380900a809167cb1b44b72565c9e4830b69ba84473668ba177cdb055ac94f42";
const SOURCE_INITIALIZERS_SHA256 =
    "3606bd90ae4e96e8a6ac71b0af26faf5c9fc3484833a4eed6f2103a0b08068ab";
const SELECTOR =
    /^\/model\/mrope_flattened_cache\/(cos|sin)\/(Split|chunk_[012]\/(Gather|Squeeze)|Concat)$/;

export const QWEN3_VL_2B_MROPE_ADDED_INITIALIZERS = 5;
export const QWEN3_VL_2B_MROPE_REPLACED_NODES = 16;

function encoded(type, object) {
    return Buffer.from(type.encode(object).finish());
}

function digest(type, objects) {
    return createHash("sha256")
        .update(Buffer.concat(objects.map((object) => encoded(type, object))))
        .digest("hex");
}

function assertSource(graph) {
    const nodes = graph.node.filter(({ name }) => name.startsWith(PREFIX));
    if (nodes.length !== 31 || digest(schema.NodeProto, nodes) !== SOURCE_NODES_SHA256) {
        throw new Error("Pinned Qwen mRoPE source nodes changed or were already transformed.");
    }
    const required = new Set(nodes.flatMap(({ input }) => input));
    const initializers = graph.initializer.filter(({ name }) => required.has(name));
    if (
        initializers.length !== 10 ||
        initializers.some(
            ({ externalData, dataLocation }) => externalData.length !== 0 || dataLocation !== 0,
        ) ||
        digest(schema.TensorProto, initializers) !== SOURCE_INITIALIZERS_SHA256
    ) {
        throw new Error("Pinned Qwen mRoPE inline constants changed.");
    }
    const names = [
        ...graph.input.map(({ name }) => name),
        ...graph.output.map(({ name }) => name),
        ...graph.initializer.map(({ name }) => name),
        ...graph.node.flatMap((node) => [node.name, ...node.input, ...node.output]),
    ];
    if (names.some((name) => name.startsWith(RESERVED) || name.startsWith(NODE_PREFIX))) {
        throw new Error("Pinned Qwen mRoPE graph already uses a reserved transform name.");
    }
    const removed = graph.node.filter(({ name }) => SELECTOR.test(name));
    const internalOutputs = new Set(
        removed.filter(({ name }) => !name.endsWith("/Concat")).flatMap(({ output }) => output),
    );
    if (
        graph.node.some(
            (node) =>
                !SELECTOR.test(node.name) && node.input.some((name) => internalOutputs.has(name)),
        ) ||
        graph.output.some(({ name }) => internalOutputs.has(name))
    ) {
        throw new Error("Pinned Qwen mRoPE selector has an unexpected external consumer.");
    }
}

function int64Scalar(name, value) {
    const rawData = Buffer.alloc(8);
    rawData.writeBigInt64LE(BigInt(value));
    return schema.TensorProto.create({ name, dataType: 7, dims: [], rawData });
}

/**
 * Correct the pinned export's contiguous T/H/W frequency selection to Qwen3's interleaving.
 * Official reference: HF transformers v4.57.1 modeling_qwen3_vl.py, lines 272–303.
 * H takes indices 1,4,...58; W takes 2,5,...59; all others (including 60–63) retain T.
 * This is NOT RotaryEmbedding.interleaved, and does not restore the export's missing DeepStack.
 * Returns a copy; only sixteen selector nodes and five new inline constants may change.
 */
export function transformQwen3Vl2bInterleavedMrope(sourceModel) {
    if (!sourceModel?.graph) throw new Error("Pinned Qwen mRoPE model has no graph.");
    assertSource(sourceModel.graph);
    const original = encoded(schema.ModelProto, sourceModel);
    const model = schema.ModelProto.decode(original);
    const graph = model.graph;
    const axes = [0, 1, 2].map((axis) => `${RESERVED}axis_${axis}`);
    const masks = [`${RESERVED}height_mask`, `${RESERVED}width_mask`];
    graph.initializer.push(...axes.map((name, index) => int64Scalar(name, index)));
    graph.initializer.push(
        ...masks.map((name, index) =>
            schema.TensorProto.create({
                name,
                dataType: 9,
                dims: [64],
                rawData: Buffer.from(
                    Array.from({ length: 64 }, (_, frequency) =>
                        Number(frequency < 60 && frequency % 3 === index + 1),
                    ),
                ),
            }),
        ),
    );
    let removed = 0;
    graph.node = graph.node.flatMap((node) => {
        const match = node.name.match(SELECTOR);
        if (match === null) return [node];
        removed += 1;
        if (match[2] !== "Split") return [];
        const channel = match[1];
        const base = `/model/mrope_flattened_cache/${channel}`;
        const output = (name) => `${RESERVED}${channel}_${name}`;
        const make = (name, opType, input, result, attribute = []) =>
            schema.NodeProto.create({
                name: `${NODE_PREFIX}${channel}/${name}`,
                opType,
                input,
                output: [result],
                attribute,
            });
        return [
            ...axes.map((axis, index) =>
                make(
                    `axis_${index}`,
                    "Gather",
                    [`${base}/half/Slice/output_0`, axis],
                    output(`axis_${index}`),
                    [{ name: "axis", type: 2, i: 0 }],
                ),
            ),
            make(
                "select_height",
                "Where",
                [masks[0], output("axis_1"), output("axis_0")],
                output("height"),
            ),
            make(
                "select_width",
                "Where",
                [masks[1], output("axis_2"), output("height")],
                `${base}/Concat/output_0`,
            ),
        ];
    });
    if (removed !== QWEN3_VL_2B_MROPE_REPLACED_NODES) {
        throw new Error("Pinned Qwen mRoPE selector replacement count changed.");
    }

    // Prove the transform preserves all metadata, attention/tied-embedding nodes and external data.
    const untouched = graph.node.filter(({ name }) => !name.startsWith(NODE_PREFIX));
    const expectedUntouched = sourceModel.graph.node.filter(({ name }) => !SELECTOR.test(name));
    if (digest(schema.NodeProto, untouched) !== digest(schema.NodeProto, expectedUntouched)) {
        throw new Error("Qwen mRoPE transform changed an unrelated decoder node.");
    }
    if (
        digest(
            schema.TensorProto,
            graph.initializer.slice(0, sourceModel.graph.initializer.length),
        ) !== digest(schema.TensorProto, sourceModel.graph.initializer)
    ) {
        throw new Error("Qwen mRoPE transform changed an existing initializer.");
    }
    const restored = schema.ModelProto.decode(encoded(schema.ModelProto, model));
    restored.graph.node = sourceModel.graph.node;
    restored.graph.initializer = sourceModel.graph.initializer;
    if (!encoded(schema.ModelProto, restored).equals(original)) {
        throw new Error("Qwen mRoPE transform changed unrelated model metadata.");
    }
    return model;
}
