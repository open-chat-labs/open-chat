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

export const QWEN3_VL_2B_DEEPSTACK_DATA = Object.freeze({
    location: "vision_encoder_q4_deepstack.onnx_data",
    bytes: 302_161_920,
    sha256: "f331bfc4a32c5dcda5a3589283acd90672f8f903cda0d8f425f8aaaf0b148168",
});
export const QWEN3_VL_2B_DEEPSTACK_VISION_SOURCE_BYTES = 388_996;
export const QWEN3_VL_2B_DEEPSTACK_VISION_SOURCE_SHA256 =
    "9e4585fdc96e118b27412133e3a37dca85f1abd471015accad9e76bc9959e6c3";
export const QWEN3_VL_2B_DEEPSTACK_DECODER_SOURCE_BYTES = 5_085_647;
export const QWEN3_VL_2B_DEEPSTACK_DECODER_SOURCE_SHA256 =
    "29df8b402b9dc86a3e2683911f1e4a28067f12713ae3c1715851feb0e39b20e3";
export const QWEN3_VL_2B_DEEPSTACK_VISION_BYTES = 395_100;
export const QWEN3_VL_2B_DEEPSTACK_VISION_SHA256 =
    "0b494b36663cc3ce66a34b33fb03e7f722c2957d10db29d55fe63854e7d358be";
export const QWEN3_VL_2B_DEEPSTACK_DECODER_BYTES = 5_086_571;
export const QWEN3_VL_2B_DEEPSTACK_DECODER_SHA256 =
    "dee3961fa1fe66c37f3f716d44a8daf571e12a4c5c6ce7884f99fe31454e83e8";
export const QWEN3_VL_2B_DEEPSTACK_VISION_OUTPUTS = Object.freeze(
    [0, 1, 2].map((i) => `__openchat_deepstack_features_${i}`),
);
export const QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS = Object.freeze(
    [0, 1, 2].map((i) => `__openchat_deepstack_${i}`),
);

const PREFIX = "__openchat/deepstack/";
const RESERVED = "__openchat_deepstack";
const SHAPE = `${RESERVED}_merge_shape`;
const TAPS = [5, 11, 17];
// Original Qwen revision89644892e4d85e24eaac8bacfd4f463576704203 stores these six
// BF16 tensors consecutively for each merger. Lossless FP32 expansion doubles each
// byte range, retaining this order. The existing final merger is NOT reused.
const TENSOR_LAYOUT = Object.freeze([
    { suffix: "linear_fc1.bias", dims: [4096], offset: 0, bytes: 16_384 },
    { suffix: "linear_fc1.weight", dims: [4096, 4096], offset: 16_384, bytes: 67_108_864 },
    { suffix: "linear_fc2.bias", dims: [2048], offset: 67_125_248, bytes: 8_192 },
    { suffix: "linear_fc2.weight", dims: [2048, 4096], offset: 67_133_440, bytes: 33_554_432 },
    { suffix: "norm.bias", dims: [4096], offset: 100_687_872, bytes: 16_384 },
    { suffix: "norm.weight", dims: [4096], offset: 100_704_256, bytes: 16_384 },
]);
const MERGER_BYTES = 100_720_640;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (type, value) => Buffer.from(type.encode(value).finish());
const encodedModel = (model) => encode(schema.ModelProto, model);
const digestObjects = (type, objects) =>
    hash(Buffer.concat(objects.map((object) => encode(type, object))));
const attributeInt = (name, i) => ({ name, type: 2, i });
const value = (name, dims) =>
    schema.ValueInfoProto.create({
        name,
        type: {
            tensorType: {
                elemType: 1,
                shape: {
                    dim: dims.map((d) =>
                        typeof d === "number" ? { dimValue: d } : { dimParam: d },
                    ),
                },
            },
        },
    });
const node = (name, opType, input, output, attribute = []) =>
    schema.NodeProto.create({
        name: `${PREFIX}${name}`,
        opType,
        input,
        output,
        attribute,
    });

function readPinned(bytes, expectedBytes, expectedHash, kind) {
    if (
        !(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array) ||
        bytes.byteLength !== expectedBytes ||
        hash(bytes) !== expectedHash
    ) {
        throw new Error(
            `Pinned Qwen DeepStack ${kind} source identity changed or was already transformed.`,
        );
    }
    // Decode an owned copy: protobuf rawData views must never alias caller-owned input.
    const original = Buffer.from(bytes);
    const model = schema.ModelProto.decode(Buffer.from(original));
    const graph = model.graph;
    const names = [
        ...graph.input.map((x) => x.name),
        ...graph.output.map((x) => x.name),
        ...graph.initializer.map((x) => x.name),
        ...graph.valueInfo.map((x) => x.name),
        ...graph.node.flatMap((n) => [n.name, ...n.input, ...n.output]),
    ];
    if (names.some((name) => name.startsWith(RESERVED) || name.startsWith(PREFIX))) {
        throw new Error("Pinned Qwen DeepStack source has a reserved name collision.");
    }
    return { original, model };
}

function preserve(original, model, expectedBytes, expectedHash, replaced = new Set()) {
    const before = schema.ModelProto.decode(original);
    const untouched = model.graph.node.filter((n) => !n.name.startsWith(PREFIX));
    const expected = before.graph.node.filter((n) => !replaced.has(n.name));
    if (
        digestObjects(schema.NodeProto, untouched) !== digestObjects(schema.NodeProto, expected) ||
        digestObjects(
            schema.TensorProto,
            model.graph.initializer.slice(0, before.graph.initializer.length),
        ) !== digestObjects(schema.TensorProto, before.graph.initializer)
    ) {
        throw new Error("Qwen DeepStack transform changed unrelated nodes or existing weights.");
    }
    const restored = schema.ModelProto.decode(encodedModel(model));
    for (const key of ["node", "initializer", "input", "output"])
        restored.graph[key] = before.graph[key];
    if (!encodedModel(restored).equals(encodedModel(before))) {
        throw new Error("Qwen DeepStack transform changed unrelated model metadata.");
    }
    const result = encodedModel(model);
    if (result.byteLength !== expectedBytes || hash(result) !== expectedHash) {
        throw new Error("Pinned Qwen DeepStack output identity changed.");
    }
    return result;
}

/** Add the three missing learned post-shuffle mergers, leaving every existing tensor untouched.
 * Reference: transformers v4.57.1 Qwen3VLVisionModel.forward and Qwen3VLVisionPatchMerger.
 * This does not download weights or run sessions; the caller must supply the pinned companion shard.
 */
export function patchQwen3Vl2bDeepStackVisionGraph(bytes) {
    const { original, model } = readPinned(
        bytes,
        QWEN3_VL_2B_DEEPSTACK_VISION_SOURCE_BYTES,
        QWEN3_VL_2B_DEEPSTACK_VISION_SOURCE_SHA256,
        "vision",
    );
    const graph = model.graph;
    const rawData = Buffer.alloc(16);
    rawData.writeBigInt64LE(-1n, 0);
    rawData.writeBigInt64LE(4096n, 8);
    graph.initializer.push(
        schema.TensorProto.create({ name: SHAPE, dataType: 7, dims: [2], rawData }),
    );
    for (let i = 0; i < 3; i++) {
        for (const tensor of TENSOR_LAYOUT) {
            graph.initializer.push(
                schema.TensorProto.create({
                    name: `${RESERVED}_merger_${i}_${tensor.suffix}`,
                    dataType: 1,
                    dims: tensor.dims,
                    dataLocation: 1,
                    externalData: [
                        { key: "location", value: QWEN3_VL_2B_DEEPSTACK_DATA.location },
                        { key: "offset", value: String(i * MERGER_BYTES + tensor.offset) },
                        { key: "length", value: String(tensor.bytes) },
                    ],
                }),
            );
        }
    }
    let forks = 0;
    graph.node = graph.node.flatMap((originalNode) => {
        const i = TAPS.findIndex((layer) => originalNode.name === `/model/layers.${layer}/Add_MLP`);
        if (i === -1) return [originalNode];
        forks++;
        const name = (suffix) => `${RESERVED}_merger_${i}_${suffix}`;
        const make = (suffix, opType, input, output, attrs = []) =>
            node(`vision/${i}/${suffix}`, opType, input, [output], attrs);
        return [
            originalNode,
            make("reshape", "Reshape", [originalNode.output[0], SHAPE], name("reshaped")),
            make(
                "norm",
                "LayerNormalization",
                [name("reshaped"), name("norm.weight"), name("norm.bias")],
                name("normalized"),
                [
                    { name: "epsilon", type: 1, f: 1e-6 },
                    attributeInt("axis", -1),
                    attributeInt("stash_type", 1),
                ],
            ),
            make(
                "linear_fc1",
                "Gemm",
                [name("normalized"), name("linear_fc1.weight"), name("linear_fc1.bias")],
                name("hidden"),
                [attributeInt("transB", 1)],
            ),
            make("gelu", "Gelu", [name("hidden")], name("activated"), [
                { name: "approximate", type: 3, s: Buffer.from("none") },
            ]),
            make(
                "linear_fc2",
                "Gemm",
                [name("activated"), name("linear_fc2.weight"), name("linear_fc2.bias")],
                QWEN3_VL_2B_DEEPSTACK_VISION_OUTPUTS[i],
                [attributeInt("transB", 1)],
            ),
        ];
    });
    if (forks !== 3) throw new Error("Pinned Qwen DeepStack vision tap count changed.");
    graph.output.push(
        ...QWEN3_VL_2B_DEEPSTACK_VISION_OUTPUTS.map((name) => value(name, ["num_features", 2048])),
    );
    return preserve(
        original,
        model,
        QWEN3_VL_2B_DEEPSTACK_VISION_BYTES,
        QWEN3_VL_2B_DEEPSTACK_VISION_SHA256,
    );
}

/** Add each visual-only dense DeepStack input AFTER decoder layers0/1/2 and BEFORE the
 * next layer's input RMS norm. Inputs must be zero outside visual positions and on cached
 * token steps. The worker owns that mask; these graphs contain no application semantics.
 */
export function patchQwen3Vl2bDeepStackDecoderGraph(bytes) {
    const { original, model } = readPinned(
        bytes,
        QWEN3_VL_2B_DEEPSTACK_DECODER_SOURCE_BYTES,
        QWEN3_VL_2B_DEEPSTACK_DECODER_SOURCE_SHA256,
        "decoder",
    );
    const graph = model.graph;
    const replaced = new Set();
    // Match the exact unfused normalization already present at layer0, including
    // explicit axis=-1 and FLOAT accumulation, rather than depending on defaults.
    const referenceNorm = graph.node.find(
        (n) => n.name === "/model/layers.0/input_layernorm/LayerNorm",
    );
    graph.node = graph.node.flatMap((originalNode) => {
        const i = [1, 2, 3].findIndex(
            (layer) => originalNode.name === `/model/layers.${layer}/input_layernorm/SkipLayerNorm`,
        );
        if (i === -1) return [originalNode];
        if (
            originalNode.opType !== "SkipSimplifiedLayerNormalization" ||
            originalNode.domain !== "com.microsoft" ||
            originalNode.input.length !== 3 ||
            originalNode.output.length !== 4 ||
            originalNode.output[1] ||
            originalNode.output[2]
        ) {
            throw new Error("Pinned Qwen DeepStack decoder residual boundary changed.");
        }
        replaced.add(originalNode.name);
        const residual = `${RESERVED}_residual_${i}`;
        // Keep association (A+B)+DS and output3 as the unnormalized residual. Attention's
        // later residual path consumes output3; adding only after RMS norm would be incorrect.
        return [
            node(`decoder/${i}/residual`, "Add", originalNode.input.slice(0, 2), [residual]),
            node(
                `decoder/${i}/inject`,
                "Add",
                [residual, QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS[i]],
                [originalNode.output[3]],
            ),
            node(
                `decoder/${i}/norm`,
                "SimplifiedLayerNormalization",
                [originalNode.output[3], originalNode.input[2]],
                [originalNode.output[0]],
                referenceNorm.attribute,
            ),
        ];
    });
    if (replaced.size !== 3)
        throw new Error("Pinned Qwen DeepStack decoder boundary count changed.");
    graph.input.push(
        ...QWEN3_VL_2B_DEEPSTACK_DECODER_INPUTS.map((name) =>
            value(name, ["batch_size", "sequence_length", 2048]),
        ),
    );
    return preserve(
        original,
        model,
        QWEN3_VL_2B_DEEPSTACK_DECODER_BYTES,
        QWEN3_VL_2B_DEEPSTACK_DECODER_SHA256,
        replaced,
    );
}
