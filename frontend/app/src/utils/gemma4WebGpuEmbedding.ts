import { Tensor as WebGpuOrtTensor } from "onnxruntime-web/webgpu";

/**
 * Phone-bounded Gemma 4 embedding facade.
 *
 * The official q4f16 embed graph contains a 1.59 GB external-data shard. Loading it as an ORT
 * session at the same time as the 1.52 GB decoder destroys the phone's WebGPU device. Both graph
 * operators are row gathers, so this facade reads only the exact compressed rows selected by
 * input_ids and performs the audited q4/f16 dequantization on the active WebGPU device.
 */

export const GEMMA4_VOCAB_SIZE = 262_144;
export const GEMMA4_IMAGE_TOKEN_ID = 258_880;
export const GEMMA4_AUDIO_TOKEN_ID = 258_881;
export const GEMMA4_PER_LAYER_BYTES_PER_TOKEN = 35 * 256 * Float32Array.BYTES_PER_ELEMENT;
// Each prompt token materializes 35 * 256 float32 per-layer values. Keeping the prompt at or below
// 2,048 tokens bounds that output to 70 MiB, below the 128 MiB storage-buffer limit commonly
// exposed by Android WebGPU implementations while leaving room for the base embedding output.
export const GEMMA4_MAX_PROMPT_TOKENS = 2_048;

export function assertGemma4PromptTokenCount(
    tokenCount: number,
    maxStorageBufferBindingSize?: number,
): void {
    if (!Number.isSafeInteger(tokenCount) || tokenCount < 1) {
        throw new Error("Gemma returned an invalid prompt token count.");
    }
    const deviceLimit =
        Number.isSafeInteger(maxStorageBufferBindingSize) && maxStorageBufferBindingSize! > 0
            ? Math.floor(maxStorageBufferBindingSize! / GEMMA4_PER_LAYER_BYTES_PER_TOKEN)
            : GEMMA4_MAX_PROMPT_TOKENS;
    const effectiveLimit = Math.min(GEMMA4_MAX_PROMPT_TOKENS, deviceLimit);
    if (tokenCount > effectiveLimit) {
        throw new Error(
            `Gemma input exceeds the ${effectiveLimit.toLocaleString("en-US")}-token limit of this mobile WebGPU device. Shorten the message or use a smaller attachment.`,
        );
    }
}

export type Gemma4QuantizedTableLayout = {
    readonly width: number;
    readonly quantizedOffset: number;
    readonly quantizedRowBytes: number;
    readonly scalesOffset: number;
    readonly scalesRowBytes: number;
    readonly zeroPointsOffset: number;
    readonly zeroPointsRowBytes: number;
    readonly multiplier: number;
};

export const GEMMA4_BASE_EMBEDDING_LAYOUT: Gemma4QuantizedTableLayout = {
    width: 1_536,
    quantizedOffset: 0,
    quantizedRowBytes: 768,
    scalesOffset: 201_326_592,
    scalesRowBytes: 96,
    zeroPointsOffset: 226_492_416,
    zeroPointsRowBytes: 24,
    multiplier: 39.25,
};

export const GEMMA4_PER_LAYER_EMBEDDING_LAYOUT: Gemma4QuantizedTableLayout = {
    width: 35 * 256,
    quantizedOffset: 232_783_872,
    quantizedRowBytes: 4_480,
    scalesOffset: 1_407_188_992,
    scalesRowBytes: 560,
    zeroPointsOffset: 1_553_989_632,
    zeroPointsRowBytes: 140,
    multiplier: 16,
};

export const GEMMA4_EMBEDDING_SHARD_BYTES = 1_590_689_792;

type RawOrtTensor = {
    readonly type: string;
    readonly dims: readonly number[];
    readonly data?: BigInt64Array | bigint[];
    readonly cpuData?: BigInt64Array;
};

export type Gemma4EmbeddingSession = {
    readonly inputNames: readonly string[];
    readonly inputMetadata: readonly unknown[];
    readonly outputNames: readonly string[];
    readonly outputMetadata: readonly unknown[];
    readonly config: { readonly device: "webgpu"; readonly dtype: "q4f16" };
    run(feeds: { input_ids?: RawOrtTensor }): Promise<Record<string, unknown>>;
    release(): Promise<void>;
};

export function gemma4EmbeddingOutputTensors(
    inputDims: readonly number[],
    inputsEmbeds: Float32Array,
    perLayerInputs: Float32Array,
) {
    const dims = inputDims.map(Number);
    if (dims.length !== 2 || !dims.every((value) => Number.isSafeInteger(value) && value > 0)) {
        throw new Error("Gemma received invalid embedding input dimensions.");
    }
    const [batchSize, sequenceLength] = dims;
    const expectedBaseValues = batchSize * sequenceLength * GEMMA4_BASE_EMBEDDING_LAYOUT.width;
    const expectedPerLayerValues =
        batchSize * sequenceLength * GEMMA4_PER_LAYER_EMBEDDING_LAYOUT.width;
    if (
        inputsEmbeds.length !== expectedBaseValues ||
        perLayerInputs.length !== expectedPerLayerValues
    ) {
        throw new Error("Gemma produced invalid embedding output dimensions.");
    }
    return {
        inputs_embeds: new WebGpuOrtTensor("float32", inputsEmbeds, [
            batchSize,
            sequenceLength,
            GEMMA4_BASE_EMBEDDING_LAYOUT.width,
        ]),
        per_layer_inputs: new WebGpuOrtTensor("float32", perLayerInputs, [
            batchSize,
            sequenceLength,
            35,
            256,
        ]),
    };
}

type GpuBufferLike = {
    getMappedRange(): ArrayBuffer;
    unmap(): void;
    mapAsync(mode: number): Promise<void>;
    destroy(): void;
};

type GpuDeviceLike = {
    readonly limits?: { readonly maxStorageBufferBindingSize?: number };
    createShaderModule(descriptor: { code: string }): unknown;
    createComputePipeline(descriptor: {
        layout: "auto";
        compute: { module: unknown; entryPoint: string };
    }): {
        getBindGroupLayout(index: number): unknown;
    };
    createBuffer(descriptor: {
        size: number;
        usage: number;
        mappedAtCreation?: boolean;
    }): GpuBufferLike;
    createBindGroup(descriptor: {
        layout: unknown;
        entries: Array<{ binding: number; resource: { buffer: GpuBufferLike } }>;
    }): unknown;
    createCommandEncoder(): {
        beginComputePass(): {
            setPipeline(pipeline: unknown): void;
            setBindGroup(index: number, bindGroup: unknown): void;
            dispatchWorkgroups(x: number, y?: number): void;
            end(): void;
        };
        copyBufferToBuffer(
            source: GpuBufferLike,
            sourceOffset: number,
            destination: GpuBufferLike,
            destinationOffset: number,
            size: number,
        ): void;
        finish(): unknown;
    };
    readonly queue: {
        submit(commands: unknown[]): void;
    };
};

type GpuConstants = {
    readonly STORAGE: number;
    readonly COPY_SRC: number;
    readonly COPY_DST: number;
    readonly UNIFORM: number;
    readonly MAP_READ: number;
    readonly READ: number;
};

function gpuConstants(): GpuConstants {
    const scope = globalThis as typeof globalThis & {
        GPUBufferUsage?: Record<string, number>;
        GPUMapMode?: Record<string, number>;
    };
    const usage = scope.GPUBufferUsage;
    const map = scope.GPUMapMode;
    if (usage === undefined || map === undefined) {
        throw new Error("WebGPU buffer constants are unavailable for Gemma embeddings.");
    }
    return {
        STORAGE: usage.STORAGE,
        COPY_SRC: usage.COPY_SRC,
        COPY_DST: usage.COPY_DST,
        UNIFORM: usage.UNIFORM,
        MAP_READ: usage.MAP_READ,
        READ: map.READ,
    };
}

export function gemma4PerLayerRowId(tokenId: number): number {
    return tokenId === GEMMA4_IMAGE_TOKEN_ID || tokenId === GEMMA4_AUDIO_TOKEN_ID ? 0 : tokenId;
}

export function gemma4TokenIds(input: RawOrtTensor): number[] {
    if (
        input.type !== "int64" ||
        input.dims.length !== 2 ||
        !input.dims.every((value) => Number.isSafeInteger(value) && value >= 0)
    ) {
        throw new Error("The Gemma embedding facade received invalid int64 input_ids.");
    }
    const values = input.data ?? input.cpuData;
    if (values === undefined || values.length !== input.dims[0] * input.dims[1]) {
        throw new Error("The Gemma embedding facade received inaccessible input_ids data.");
    }
    return Array.from(values, (value) => {
        const token = Number(value);
        if (!Number.isSafeInteger(token) || token < 0 || token >= GEMMA4_VOCAB_SIZE) {
            throw new Error("The Gemma embedding facade received an out-of-range token id.");
        }
        return token;
    });
}

function embeddingShader(): string {
    return `
enable f16;
struct Params {
  token_count: u32,
  width: u32,
  quantized_row_bytes: u32,
  scales_row_bytes: u32,
  zero_points_row_bytes: u32,
  multiplier: f32,
};
@group(0) @binding(0) var<storage, read> quantized: array<u32>;
@group(0) @binding(1) var<storage, read> scales: array<u32>;
@group(0) @binding(2) var<storage, read> zero_points: array<u32>;
@group(0) @binding(3) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(4) var<uniform> params: Params;

fn byte_at(words: ptr<storage, array<u32>, read>, byte_index: u32) -> u32 {
  let word = (*words)[byte_index >> 2u];
  return (word >> ((byte_index & 3u) * 8u)) & 255u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let linear = gid.x + gid.y * 4194240u;
  let total = params.token_count * params.width;
  if (linear >= total) { return; }
  let row = linear / params.width;
  let column = linear - row * params.width;

  let packed_q = byte_at(&quantized, row * params.quantized_row_bytes + column / 2u);
  let q = (packed_q >> ((column & 1u) * 4u)) & 15u;
  let block = column / 32u;
  let scale_half = row * (params.scales_row_bytes / 2u) + block;
  let packed_scale = scales[scale_half / 2u];
  let scale_pair = unpack2x16float(packed_scale);
  let scale = select(scale_pair.x, scale_pair.y, (scale_half & 1u) == 1u);
  let packed_zp = byte_at(&zero_points, row * params.zero_points_row_bytes + block / 2u);
  let zp = (packed_zp >> ((block & 1u) * 4u)) & 15u;
  // The pinned ONNX graph's GatherBlockQuantized and Mul outputs are float16, followed by a
  // float32 Cast. Preserve both float16 rounding points instead of silently changing model math.
  let gathered = f16(f16(i32(q) - i32(zp)) * f16(scale));
  let scaled = f16(gathered * f16(params.multiplier));
  output_values[linear] = f32(scaled);
}`;
}

function mappedInputBuffer(device: GpuDeviceLike, bytes: Uint8Array, usage: number): GpuBufferLike {
    const buffer = device.createBuffer({
        size: Math.max(4, bytes.byteLength),
        usage,
        mappedAtCreation: true,
    });
    new Uint8Array(buffer.getMappedRange()).set(bytes);
    buffer.unmap();
    return buffer;
}

function uniformBytes(tokenCount: number, layout: Gemma4QuantizedTableLayout): Uint8Array {
    const data = new ArrayBuffer(32);
    const view = new DataView(data);
    view.setUint32(0, tokenCount, true);
    view.setUint32(4, layout.width, true);
    view.setUint32(8, layout.quantizedRowBytes, true);
    view.setUint32(12, layout.scalesRowBytes, true);
    view.setUint32(16, layout.zeroPointsRowBytes, true);
    view.setFloat32(20, layout.multiplier, true);
    return new Uint8Array(data);
}

type CompressedRows = {
    quantized: Uint8Array;
    scales: Uint8Array;
    zeroPoints: Uint8Array;
};

async function runDequantization(
    device: GpuDeviceLike,
    pipeline: ReturnType<GpuDeviceLike["createComputePipeline"]>,
    rows: CompressedRows,
    tokenCount: number,
    layout: Gemma4QuantizedTableLayout,
): Promise<Float32Array> {
    if (tokenCount === 0) return new Float32Array();
    const constants = gpuConstants();
    const quantized = mappedInputBuffer(device, rows.quantized, constants.STORAGE);
    const scales = mappedInputBuffer(device, rows.scales, constants.STORAGE);
    const zeroPoints = mappedInputBuffer(device, rows.zeroPoints, constants.STORAGE);
    const params = mappedInputBuffer(device, uniformBytes(tokenCount, layout), constants.UNIFORM);
    const outputBytes = tokenCount * layout.width * Float32Array.BYTES_PER_ELEMENT;
    const output = device.createBuffer({
        size: outputBytes,
        usage: constants.STORAGE | constants.COPY_SRC,
    });
    const readback = device.createBuffer({
        size: outputBytes,
        usage: constants.COPY_DST | constants.MAP_READ,
    });
    try {
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: quantized } },
                { binding: 1, resource: { buffer: scales } },
                { binding: 2, resource: { buffer: zeroPoints } },
                { binding: 3, resource: { buffer: output } },
                { binding: 4, resource: { buffer: params } },
            ],
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        const groups = Math.ceil((tokenCount * layout.width) / 64);
        pass.dispatchWorkgroups(Math.min(groups, 65_535), Math.ceil(groups / 65_535));
        pass.end();
        encoder.copyBufferToBuffer(output, 0, readback, 0, outputBytes);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(constants.READ);
        return new Float32Array(readback.getMappedRange()).slice();
    } finally {
        try {
            readback.unmap();
        } catch {
            // A rejected map does not leave a mapped buffer.
        }
        quantized.destroy();
        scales.destroy();
        zeroPoints.destroy();
        params.destroy();
        output.destroy();
        readback.destroy();
    }
}

async function readRow(
    shard: Blob,
    tokenId: number,
    layout: Gemma4QuantizedTableLayout,
): Promise<CompressedRows> {
    const [quantized, scales, zeroPoints] = await Promise.all([
        shard
            .slice(
                layout.quantizedOffset + tokenId * layout.quantizedRowBytes,
                layout.quantizedOffset + (tokenId + 1) * layout.quantizedRowBytes,
            )
            .arrayBuffer(),
        shard
            .slice(
                layout.scalesOffset + tokenId * layout.scalesRowBytes,
                layout.scalesOffset + (tokenId + 1) * layout.scalesRowBytes,
            )
            .arrayBuffer(),
        shard
            .slice(
                layout.zeroPointsOffset + tokenId * layout.zeroPointsRowBytes,
                layout.zeroPointsOffset + (tokenId + 1) * layout.zeroPointsRowBytes,
            )
            .arrayBuffer(),
    ]);
    if (
        quantized.byteLength !== layout.quantizedRowBytes ||
        scales.byteLength !== layout.scalesRowBytes ||
        zeroPoints.byteLength !== layout.zeroPointsRowBytes
    ) {
        throw new Error("Gemma's cached embedding shard ended inside a selected token row.");
    }
    return {
        quantized: new Uint8Array(quantized),
        scales: new Uint8Array(scales),
        zeroPoints: new Uint8Array(zeroPoints),
    };
}

async function packedRows(
    shard: Blob,
    tokenIds: readonly number[],
    layout: Gemma4QuantizedTableLayout,
    rowCache: Map<number, Promise<CompressedRows>>,
): Promise<CompressedRows> {
    const rows = await Promise.all(
        tokenIds.map((tokenId) => {
            let row = rowCache.get(tokenId);
            if (row === undefined) {
                row = readRow(shard, tokenId, layout);
                rowCache.set(tokenId, row);
            }
            return row;
        }),
    );
    const quantized = new Uint8Array(tokenIds.length * layout.quantizedRowBytes);
    const scales = new Uint8Array(tokenIds.length * layout.scalesRowBytes);
    const zeroPoints = new Uint8Array(tokenIds.length * layout.zeroPointsRowBytes);
    rows.forEach((row, index) => {
        quantized.set(row.quantized, index * layout.quantizedRowBytes);
        scales.set(row.scales, index * layout.scalesRowBytes);
        zeroPoints.set(row.zeroPoints, index * layout.zeroPointsRowBytes);
    });
    return { quantized, scales, zeroPoints };
}

export function createGemma4WebGpuEmbeddingSession(
    shard: Blob,
    getDevice: () => unknown,
): Gemma4EmbeddingSession {
    if (shard.size !== GEMMA4_EMBEDDING_SHARD_BYTES) {
        throw new Error("Gemma's cached embedding shard has the wrong byte size.");
    }
    const baseRows = new Map<number, Promise<CompressedRows>>();
    const perLayerRows = new Map<number, Promise<CompressedRows>>();
    let released = false;
    let pipelineDevice: GpuDeviceLike | undefined;
    let embeddingPipeline: ReturnType<GpuDeviceLike["createComputePipeline"]> | undefined;

    const pipeline = (device: GpuDeviceLike) => {
        if (pipelineDevice !== device || embeddingPipeline === undefined) {
            pipelineDevice = device;
            // Base and per-layer tables use the same bindings and WGSL. Their dimensions and
            // quantization layouts are uniform data, so compiling a second identical pipeline only
            // adds driver work. In particular, back-to-back pipeline creation can crash Qualcomm's
            // Android Vulkan compiler instead of returning a recoverable WebGPU error.
            embeddingPipeline = device.createComputePipeline({
                layout: "auto",
                compute: {
                    module: device.createShaderModule({ code: embeddingShader() }),
                    entryPoint: "main",
                },
            });
        }
        return embeddingPipeline;
    };

    return {
        inputNames: ["input_ids"],
        inputMetadata: [
            { name: "input_ids", type: "int64", shape: ["batch_size", "sequence_length"] },
        ],
        outputNames: ["inputs_embeds", "per_layer_inputs"],
        outputMetadata: [
            {
                name: "inputs_embeds",
                type: "float32",
                shape: ["batch_size", "sequence_length", 1_536],
            },
            {
                name: "per_layer_inputs",
                type: "float32",
                shape: ["batch_size", "sequence_length", 35, 256],
            },
        ],
        config: { device: "webgpu", dtype: "q4f16" },
        async run(feeds) {
            if (released) throw new Error("The Gemma embedding facade was released.");
            const input = feeds.input_ids;
            if (input === undefined)
                throw new Error("The Gemma embedding facade received no input_ids.");
            const ids = gemma4TokenIds(input);
            const device = getDevice() as GpuDeviceLike | undefined;
            if (device === undefined || typeof device.createComputePipeline !== "function") {
                throw new Error("The WebGPU device is unavailable for Gemma token embeddings.");
            }
            assertGemma4PromptTokenCount(ids.length, device.limits?.maxStorageBufferBindingSize);
            const activePipeline = pipeline(device);
            const [baseCompressed, perLayerCompressed] = await Promise.all([
                packedRows(shard, ids, GEMMA4_BASE_EMBEDDING_LAYOUT, baseRows),
                packedRows(
                    shard,
                    ids.map(gemma4PerLayerRowId),
                    GEMMA4_PER_LAYER_EMBEDDING_LAYOUT,
                    perLayerRows,
                ),
            ]);
            // Keep only one mapped readback and one queue submission in flight. Run the larger
            // per-layer table first so its GPU buffers are gone before the smaller base table is
            // dispatched; this gives Android WebGPU the lowest transient peak without changing the
            // resulting tensors or model math.
            const perLayerInputs = await runDequantization(
                device,
                activePipeline,
                perLayerCompressed,
                ids.length,
                GEMMA4_PER_LAYER_EMBEDDING_LAYOUT,
            );
            const inputsEmbeds = await runDequantization(
                device,
                activePipeline,
                baseCompressed,
                ids.length,
                GEMMA4_BASE_EMBEDDING_LAYOUT,
            );
            return gemma4EmbeddingOutputTensors(input.dims, inputsEmbeds, perLayerInputs);
        },
        async release() {
            released = true;
            baseRows.clear();
            perLayerRows.clear();
            pipelineDevice = undefined;
            embeddingPipeline = undefined;
        },
    };
}
