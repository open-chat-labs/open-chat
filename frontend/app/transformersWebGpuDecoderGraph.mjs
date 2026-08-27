import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const nodeRequire = createRequire(import.meta.url);
const schema = nodeRequire(
    path.join(
        import.meta.dirname,
        "../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js",
    ),
).onnx;

export const QWEN3_VL_2B_DECODER_SOURCE_BYTES = 5_086_584;
export const QWEN3_VL_2B_DECODER_SOURCE_SHA256 =
    "0b309c7423500f5226b07e1895adbecb245105a61abe065dedeb5ae136da335c";

// Locked after protobuf encoding. Any graph change must be reviewed as a new immutable artifact.
export const QWEN3_VL_2B_DECODER_PATCHED_BYTES = 5_087_381;
export const QWEN3_VL_2B_DECODER_PATCHED_SHA256 =
    "1c7b80033889ec7e5168e3d35942041e0aafcbb259a417f378da0432b434e04d";

export const QWEN3_VL_2B_DECODER_TOKEN_IDS_INPUT = "__openchat_input_ids";
export const QWEN3_VL_2B_DECODER_SELECTED_EMBEDS = "__openchat_selected_input_embeddings";

export const QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA = Object.freeze({
    location: "decoder_model_merged_q4.onnx_data",
    offset: 903_290_880,
    bytes: 199_340_032,
    end: 1_102_630_912,
    sha256: "6c3b078ca20e4233f27de203812ba74c6b29d5ae4208932857886582ec6aa50d",
});

const INPUT_EMBEDS = "inputs_embeds";
const QUANT = "lm_head_MatMul_weight_quant";
const SCALES = "lm_head_MatMul_weight_scales";
const ZERO_POINT = "lm_head_MatMul_weight_zp";
const QUANT_SHAPE = "__openchat_tied_embedding_shape";
const QUANT_2D = "__openchat_tied_embedding_quant_2d";
const GATHERED = "__openchat_tied_token_embeddings";

const SOURCE_INPUT_CONSUMERS = Object.freeze([
    "/model/shared_dims/root_input/Shape",
    "/model/layers.0/input_layernorm/LayerNorm",
    "/model/layers.0/post_attention_layernorm/SkipLayerNorm",
]);

const EXPECTED_INITIALIZERS = Object.freeze({
    [QUANT]: {
        dataType: 2,
        dims: [151_936, 64, 16],
        offset: 903_290_880,
        bytes: 155_582_464,
    },
    [SCALES]: {
        dataType: 1,
        dims: [151_936, 64],
        offset: 1_058_873_344,
        bytes: 38_895_616,
    },
    [ZERO_POINT]: {
        dataType: 2,
        dims: [151_936, 32],
        offset: 1_097_768_960,
        bytes: 4_861_952,
    },
});

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function asNumber(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) {
        throw new Error(`Pinned Qwen decoder ${label} is not a safe integer.`);
    }
    return number;
}

function assertArrayEquals(actual, expected, label) {
    if (
        actual.length !== expected.length ||
        actual.some((value, index) => value !== expected[index])
    ) {
        throw new Error(
            `Pinned Qwen decoder ${label} changed: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
        );
    }
}

function externalDataMap(initializer) {
    return Object.fromEntries(initializer.externalData.map(({ key, value }) => [key, value]));
}

function nodeObject(node) {
    return schema.NodeProto.toObject(node, {
        longs: String,
        enums: String,
        bytes: String,
        defaults: false,
        arrays: true,
        objects: true,
    });
}

function verifySourceModel(model) {
    if (asNumber(model.irVersion, "IR version") !== 10) {
        throw new Error("Pinned Qwen decoder IR version changed.");
    }
    const opsets = model.opsetImport.map(({ domain, version }) => [
        domain,
        asNumber(version, `opset ${domain || "ai.onnx"}`),
    ]);
    if (
        JSON.stringify(opsets) !==
        JSON.stringify([
            ["", 21],
            ["com.microsoft", 1],
        ])
    ) {
        throw new Error(`Pinned Qwen decoder opsets changed: ${JSON.stringify(opsets)}.`);
    }
    const graph = model.graph;
    if (graph === null || graph === undefined) {
        throw new Error("Pinned Qwen decoder has no graph.");
    }

    const reserved = new Set([
        QWEN3_VL_2B_DECODER_TOKEN_IDS_INPUT,
        QWEN3_VL_2B_DECODER_SELECTED_EMBEDS,
        QUANT_SHAPE,
        QUANT_2D,
        GATHERED,
    ]);
    const names = [
        ...graph.input.map(({ name }) => name),
        ...graph.output.map(({ name }) => name),
        ...graph.initializer.map(({ name }) => name),
        ...graph.node.flatMap((node) => [node.name, ...node.input, ...node.output]),
    ];
    if (names.some((name) => reserved.has(name))) {
        throw new Error("Pinned Qwen decoder already uses a reserved OpenChat graph name.");
    }

    const embedsInput = graph.input.find(({ name }) => name === INPUT_EMBEDS);
    const tensorType = embedsInput?.type?.tensorType;
    const dims = tensorType?.shape?.dim ?? [];
    if (
        tensorType?.elemType !== 1 ||
        dims.length !== 3 ||
        dims[0].dimParam !== "batch_size" ||
        dims[1].dimParam !== "sequence_length" ||
        asNumber(dims[2].dimValue, "embedding width") !== 2_048
    ) {
        throw new Error("Pinned Qwen decoder inputs_embeds metadata changed.");
    }

    const consumers = graph.node
        .filter((node) => node.input.includes(INPUT_EMBEDS))
        .map(({ name }) => name);
    assertArrayEquals(consumers, SOURCE_INPUT_CONSUMERS, "inputs_embeds consumers");

    let previousEnd = QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA.offset;
    for (const [name, expected] of Object.entries(EXPECTED_INITIALIZERS)) {
        const initializer = graph.initializer.find((candidate) => candidate.name === name);
        if (initializer === undefined) {
            throw new Error(`Pinned Qwen decoder initializer ${name} is missing.`);
        }
        assertArrayEquals(
            initializer.dims.map((value) => asNumber(value, `${name} dimension`)),
            expected.dims,
            `${name} dimensions`,
        );
        if (initializer.dataType !== expected.dataType || initializer.dataLocation !== 1) {
            throw new Error(`Pinned Qwen decoder initializer ${name} storage metadata changed.`);
        }
        const external = externalDataMap(initializer);
        if (
            external.location !== QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA.location ||
            Number(external.offset) !== expected.offset ||
            Number(external.length) !== expected.bytes ||
            expected.offset !== previousEnd
        ) {
            throw new Error(`Pinned Qwen decoder initializer ${name} external range changed.`);
        }
        previousEnd = expected.offset + expected.bytes;
    }
    if (previousEnd !== QWEN3_VL_2B_TIED_EMBEDDING_EXTERNAL_DATA.end) {
        throw new Error("Pinned Qwen tied embedding range no longer reaches the shard boundary.");
    }
    return graph;
}

function attribute(name, value) {
    return schema.AttributeProto.fromObject({ name, i: String(value), type: "INT" });
}

function transformModel(model) {
    const graph = verifySourceModel(model);
    const originalNodes = graph.node.map(nodeObject);

    graph.initializer.push(
        schema.TensorProto.fromObject({
            name: QUANT_SHAPE,
            dataType: 7,
            dims: [2],
            int64Data: ["151936", "1024"],
        }),
    );
    graph.input.push(
        schema.ValueInfoProto.fromObject({
            name: QWEN3_VL_2B_DECODER_TOKEN_IDS_INPUT,
            type: {
                tensorType: {
                    elemType: 7,
                    shape: {
                        dim: [
                            { dimParam: "batch_size" },
                            { dimParam: "openchat_token_sequence_length" },
                        ],
                    },
                },
            },
        }),
    );

    for (const node of graph.node) {
        node.input = node.input.map((name) =>
            name === INPUT_EMBEDS ? QWEN3_VL_2B_DECODER_SELECTED_EMBEDS : name,
        );
    }
    graph.node.unshift(
        schema.NodeProto.fromObject({
            name: "__openchat/tied_embedding/Reshape",
            opType: "Reshape",
            input: [QUANT, QUANT_SHAPE],
            output: [QUANT_2D],
        }),
        schema.NodeProto.fromObject({
            name: "__openchat/tied_embedding/GatherBlockQuantized",
            opType: "GatherBlockQuantized",
            domain: "com.microsoft",
            input: [QUANT_2D, QWEN3_VL_2B_DECODER_TOKEN_IDS_INPUT, SCALES, ZERO_POINT],
            output: [GATHERED],
            attribute: [
                attribute("bits", 4),
                attribute("block_size", 32),
                attribute("gather_axis", 0),
                attribute("quantize_axis", 1),
            ],
        }),
        schema.NodeProto.fromObject({
            name: "__openchat/tied_embedding/Concat",
            opType: "Concat",
            input: [INPUT_EMBEDS, GATHERED],
            output: [QWEN3_VL_2B_DECODER_SELECTED_EMBEDS],
            attribute: [attribute("axis", 1)],
        }),
    );
    return { graph, originalNodes };
}

function verifyPatchedModel(model, originalNodes) {
    const graph = model.graph;
    const privateInputs = graph.input.filter(
        ({ name }) => name === QWEN3_VL_2B_DECODER_TOKEN_IDS_INPUT,
    );
    if (privateInputs.length !== 1) {
        throw new Error("Patched Qwen decoder does not have exactly one private token-ID input.");
    }
    const privateType = privateInputs[0].type?.tensorType;
    const privateDims = privateType?.shape?.dim ?? [];
    if (
        privateType?.elemType !== 7 ||
        privateDims.length !== 2 ||
        privateDims[0].dimParam !== "batch_size" ||
        privateDims[1].dimParam !== "openchat_token_sequence_length"
    ) {
        throw new Error("Patched Qwen decoder private token-ID metadata is invalid.");
    }

    const [reshape, gather, concat, ...sourceNodes] = graph.node;
    if (
        reshape?.name !== "__openchat/tied_embedding/Reshape" ||
        reshape.opType !== "Reshape" ||
        gather?.name !== "__openchat/tied_embedding/GatherBlockQuantized" ||
        gather.opType !== "GatherBlockQuantized" ||
        gather.domain !== "com.microsoft" ||
        concat?.name !== "__openchat/tied_embedding/Concat" ||
        concat.opType !== "Concat"
    ) {
        throw new Error("Patched Qwen decoder tied-embedding nodes are missing or reordered.");
    }
    assertArrayEquals(reshape.input, [QUANT, QUANT_SHAPE], "tied Reshape inputs");
    assertArrayEquals(
        gather.input,
        [QUANT_2D, QWEN3_VL_2B_DECODER_TOKEN_IDS_INPUT, SCALES, ZERO_POINT],
        "tied GatherBlockQuantized inputs",
    );
    assertArrayEquals(concat.input, [INPUT_EMBEDS, GATHERED], "tied Concat inputs");

    const originalInputConsumers = graph.node.filter((node) => node.input.includes(INPUT_EMBEDS));
    if (originalInputConsumers.length !== 1 || originalInputConsumers[0].name !== concat.name) {
        throw new Error("Patched Qwen decoder still consumes inputs_embeds outside the selector.");
    }
    const selectedConsumers = graph.node
        .filter((node) => node.input.includes(QWEN3_VL_2B_DECODER_SELECTED_EMBEDS))
        .map(({ name }) => name);
    assertArrayEquals(selectedConsumers, SOURCE_INPUT_CONSUMERS, "selected embedding consumers");

    const expectedSourceNodes = originalNodes.map((node) => ({
        ...node,
        input: node.input.map((name) =>
            name === INPUT_EMBEDS ? QWEN3_VL_2B_DECODER_SELECTED_EMBEDS : name,
        ),
    }));
    const actualSourceNodes = sourceNodes.map(nodeObject);
    if (JSON.stringify(actualSourceNodes) !== JSON.stringify(expectedSourceNodes)) {
        throw new Error(
            "Patched Qwen decoder changed source nodes beyond the embedding input edge.",
        );
    }

    const shapeInitializers = graph.initializer.filter(({ name }) => name === QUANT_SHAPE);
    if (shapeInitializers.length !== 1 || shapeInitializers[0].dataLocation !== 0) {
        throw new Error("Patched Qwen decoder tied shape initializer is invalid.");
    }
    if (graph.initializer.length !== 754) {
        throw new Error("Patched Qwen decoder initializer count changed unexpectedly.");
    }
    const externalInitializers = graph.initializer.filter(({ dataLocation }) => dataLocation === 1);
    if (externalInitializers.length !== 648) {
        throw new Error("Patched Qwen decoder unexpectedly added external model data.");
    }

    const quantConsumers = graph.node.filter((node) => node.input.includes(QUANT));
    if (
        quantConsumers.length !== 2 ||
        !quantConsumers.some(({ name }) => name === "/lm_head/MatMul_Quant") ||
        !quantConsumers.some(({ name }) => name === reshape.name)
    ) {
        throw new Error(
            "Patched Qwen decoder does not tie the existing LM-head quant initializer.",
        );
    }
}

/**
 * Adds an exact internal autoregressive embedding path to the audited Qwen3-VL decoder graph.
 *
 * The multimodal prompt still enters through `inputs_embeds`. Cached steps send an empty
 * `[batch, 0, 2048]` prompt tensor and token IDs through the private input. Concat on axis 1 is an
 * exact branch selector, while GatherBlockQuantized reuses the decoder's tied LM-head q4 ranges.
 */
export function patchQwen3Vl2bDecoderGraph(sourceBytes) {
    const bytes = sourceBytes instanceof Uint8Array ? sourceBytes : new Uint8Array(sourceBytes);
    const sourceHash = sha256(bytes);
    if (
        bytes.byteLength !== QWEN3_VL_2B_DECODER_SOURCE_BYTES ||
        sourceHash !== QWEN3_VL_2B_DECODER_SOURCE_SHA256
    ) {
        throw new Error(
            `Pinned Qwen decoder source changed (${bytes.byteLength} bytes, sha256 ${sourceHash}); refusing the tied-embedding transform.`,
        );
    }

    const model = schema.ModelProto.decode(bytes);
    const { originalNodes } = transformModel(model);
    const patched = schema.ModelProto.encode(model).finish();
    const patchedHash = sha256(patched);
    if (
        patched.byteLength !== QWEN3_VL_2B_DECODER_PATCHED_BYTES ||
        patchedHash !== QWEN3_VL_2B_DECODER_PATCHED_SHA256
    ) {
        throw new Error(
            `Deterministic Qwen decoder transform changed (${patched.byteLength} bytes, sha256 ${patchedHash}).`,
        );
    }
    verifyPatchedModel(schema.ModelProto.decode(patched), originalNodes);
    return patched;
}
