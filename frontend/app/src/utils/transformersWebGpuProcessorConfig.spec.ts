import { describe, expect, it } from "vitest";
import {
    TRANSFORMERS_WEBGPU_NORMALIZED_PROCESSOR_MARKER,
    transformersWebGpuProcessorConfig,
} from "./transformersWebGpuProcessorConfig";

const PREPROCESSOR_CONFIG = {
    size: { longest_edge: 16_777_216, shortest_edge: 65_536 },
    patch_size: 16,
    temporal_patch_size: 2,
    merge_size: 2,
    image_mean: [0.5, 0.5, 0.5],
    image_std: [0.5, 0.5, 0.5],
    processor_class: "Qwen3VLProcessor",
    image_processor_type: "Qwen2VLImageProcessorFast",
};

const PROCESSOR_CONFIG = {
    processor_class: "Qwen3VLProcessor",
    image_processor: {
        data_format: "channels_first",
        do_convert_rgb: true,
        do_normalize: true,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        image_processor_type: "Qwen2VLImageProcessorFast",
        image_std: [0.5, 0.5, 0.5],
        merge_size: 2,
        patch_size: 16,
        resample: 3,
        rescale_factor: 1 / 255,
        size: { longest_edge: 16_777_216, shortest_edge: 65_536 },
        temporal_patch_size: 2,
    },
};

function clone(value: object): Record<string, unknown> {
    return structuredClone(value) as Record<string, unknown>;
}

function imageProcessor(config: Record<string, unknown>): Record<string, unknown> {
    const value = config.image_processor;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("test fixture has no image processor");
    }
    return value as Record<string, unknown>;
}

describe("transformersWebGpuProcessorConfig", () => {
    it("merges the official normalization controls into compatible pinned metadata", () => {
        const merged = transformersWebGpuProcessorConfig(PREPROCESSOR_CONFIG, PROCESSOR_CONFIG);

        expect(TRANSFORMERS_WEBGPU_NORMALIZED_PROCESSOR_MARKER).toBe(
            "openchat-qwen-webgpu-normalized-image-input-v1",
        );
        expect(merged).toMatchObject({
            data_format: "channels_first",
            do_convert_rgb: true,
            do_normalize: true,
            do_rescale: true,
            do_resize: true,
            resample: 3,
            rescale_factor: 1 / 255,
            patch_size: 16,
            merge_size: 2,
            temporal_patch_size: 2,
            image_mean: [0.5, 0.5, 0.5],
            image_std: [0.5, 0.5, 0.5],
        });
    });

    it("fails closed when the unified normalization contract is missing or disabled", () => {
        expect(() => transformersWebGpuProcessorConfig(PREPROCESSOR_CONFIG, {})).toThrow(
            /pinned Qwen image processor configuration is incompatible/,
        );
        for (const key of ["do_normalize", "do_rescale", "do_resize", "do_convert_rgb"]) {
            const processor = clone(PROCESSOR_CONFIG);
            imageProcessor(processor)[key] = false;
            expect(() => transformersWebGpuProcessorConfig(PREPROCESSOR_CONFIG, processor)).toThrow(
                /pinned Qwen image processor configuration is incompatible/,
            );
        }
        for (const [key, value] of [
            ["resample", 2],
            ["rescale_factor", 1],
        ] as const) {
            const processor = clone(PROCESSOR_CONFIG);
            imageProcessor(processor)[key] = value;
            expect(() => transformersWebGpuProcessorConfig(PREPROCESSOR_CONFIG, processor)).toThrow(
                /pinned Qwen image processor configuration is incompatible/,
            );
        }
    });

    it("rejects incompatible normalization and vision-layout metadata", () => {
        for (const [key, value] of [
            ["image_mean", [0, 0, 0]],
            ["image_std", [1, 1, 1]],
            ["patch_size", 14],
            ["merge_size", 1],
            ["temporal_patch_size", 1],
        ] as const) {
            const processor = clone(PROCESSOR_CONFIG);
            imageProcessor(processor)[key] = value;
            expect(() => transformersWebGpuProcessorConfig(PREPROCESSOR_CONFIG, processor)).toThrow(
                /pinned Qwen image processor configuration is incompatible/,
            );
        }
    });

    it("rejects jointly wrong metadata, data format, and image bounds", () => {
        for (const [key, value] of [
            ["image_mean", [0, 0, 0]],
            ["image_std", [1, 1, 1]],
            ["patch_size", 14],
            ["merge_size", 1],
            ["temporal_patch_size", 1],
        ] as const) {
            const preprocessor = clone(PREPROCESSOR_CONFIG);
            const processor = clone(PROCESSOR_CONFIG);
            preprocessor[key] = value;
            imageProcessor(processor)[key] = value;
            expect(() => transformersWebGpuProcessorConfig(preprocessor, processor)).toThrow(
                /pinned Qwen image processor configuration is incompatible/,
            );
        }

        const badFormat = clone(PROCESSOR_CONFIG);
        imageProcessor(badFormat).data_format = "channels_last";
        expect(() => transformersWebGpuProcessorConfig(PREPROCESSOR_CONFIG, badFormat)).toThrow(
            /pinned Qwen image processor configuration is incompatible/,
        );

        const badSize = { longest_edge: 16_777_216, shortest_edge: 32_768 };
        const preprocessor = clone(PREPROCESSOR_CONFIG);
        const processor = clone(PROCESSOR_CONFIG);
        preprocessor.size = badSize;
        imageProcessor(processor).size = badSize;
        expect(() => transformersWebGpuProcessorConfig(preprocessor, processor)).toThrow(
            /pinned Qwen image processor configuration is incompatible/,
        );
    });
});
