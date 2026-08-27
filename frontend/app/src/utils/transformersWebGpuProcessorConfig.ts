type JsonObject = Record<string, unknown>;

export const TRANSFORMERS_WEBGPU_NORMALIZED_PROCESSOR_MARKER =
    "openchat-qwen-webgpu-normalized-image-input-v1";

const INVALID_PROCESSOR_CONFIG_MESSAGE =
    "The pinned Qwen image processor configuration is incompatible. Open On-device models and tap Retry download.";

function failProcessorConfig(): never {
    throw new Error(INVALID_PROCESSOR_CONFIG_MESSAGE);
}

function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchingOfficialTriplets(left: unknown, right: unknown): boolean {
    return (
        Array.isArray(left) &&
        Array.isArray(right) &&
        left.length === 3 &&
        right.length === 3 &&
        left.every(
            (value, index) => typeof value === "number" && value === 0.5 && right[index] === 0.5,
        )
    );
}

function matchingPositiveIntegers(
    left: JsonObject,
    right: JsonObject,
    key: "patch_size" | "merge_size" | "temporal_patch_size",
): boolean {
    const expected = { patch_size: 16, merge_size: 2, temporal_patch_size: 2 }[key];
    return left[key] === expected && right[key] === expected;
}

function hasOfficialImageSize(value: unknown): boolean {
    return (
        isJsonObject(value) &&
        Object.keys(value).length === 2 &&
        value.shortest_edge === 65_536 &&
        value.longest_edge === 16_777_216
    );
}

/** Merge the legacy metadata with the official unified processor config, or fail closed. */
export function transformersWebGpuProcessorConfig(
    preprocessorValue: unknown,
    processorValue: unknown,
): JsonObject {
    if (!isJsonObject(preprocessorValue) || !isJsonObject(processorValue)) {
        return failProcessorConfig();
    }
    const imageProcessorValue = processorValue.image_processor;
    if (!isJsonObject(imageProcessorValue)) return failProcessorConfig();

    if (
        preprocessorValue.processor_class !== "Qwen3VLProcessor" ||
        processorValue.processor_class !== "Qwen3VLProcessor" ||
        imageProcessorValue.image_processor_type !== "Qwen2VLImageProcessorFast" ||
        imageProcessorValue.image_processor_type !== preprocessorValue.image_processor_type ||
        imageProcessorValue.data_format !== "channels_first" ||
        imageProcessorValue.do_normalize !== true ||
        imageProcessorValue.do_rescale !== true ||
        imageProcessorValue.do_resize !== true ||
        imageProcessorValue.do_convert_rgb !== true ||
        imageProcessorValue.resample !== 3 ||
        imageProcessorValue.rescale_factor !== 1 / 255
    ) {
        return failProcessorConfig();
    }

    if (
        !matchingOfficialTriplets(imageProcessorValue.image_mean, preprocessorValue.image_mean) ||
        !matchingOfficialTriplets(imageProcessorValue.image_std, preprocessorValue.image_std) ||
        !matchingPositiveIntegers(imageProcessorValue, preprocessorValue, "patch_size") ||
        !matchingPositiveIntegers(imageProcessorValue, preprocessorValue, "merge_size") ||
        !matchingPositiveIntegers(imageProcessorValue, preprocessorValue, "temporal_patch_size") ||
        !hasOfficialImageSize(imageProcessorValue.size) ||
        !hasOfficialImageSize(preprocessorValue.size)
    ) {
        return failProcessorConfig();
    }

    return { ...preprocessorValue, ...imageProcessorValue };
}
