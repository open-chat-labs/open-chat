import { describe, expect, it } from "vitest";
import { intrinsicImageDimensions } from "./imageDimensions";
import {
    TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT,
    TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
    transformersWebGpuImageGridPatchCount,
    transformersWebGpuImageLayout,
} from "./transformersWebGpuImageLayout";

function pngHeader(width: number, height: number): ArrayBuffer {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width, false);
    view.setUint32(20, height, false);
    return bytes.buffer;
}

function jpegHeader(width: number, height: number, orientation?: number): ArrayBuffer {
    const exif =
        orientation === undefined
            ? []
            : [
                  0xff,
                  0xe1,
                  0x00,
                  0x22,
                  0x45,
                  0x78,
                  0x69,
                  0x66,
                  0x00,
                  0x00,
                  0x49,
                  0x49,
                  0x2a,
                  0x00,
                  0x08,
                  0x00,
                  0x00,
                  0x00,
                  0x01,
                  0x00,
                  0x12,
                  0x01,
                  0x03,
                  0x00,
                  0x01,
                  0x00,
                  0x00,
                  0x00,
                  orientation,
                  0x00,
                  0x00,
                  0x00,
                  0x00,
                  0x00,
                  0x00,
                  0x00,
              ];
    return new Uint8Array([
        0xff,
        0xd8,
        ...exif,
        0xff,
        0xe0,
        0x00,
        0x04,
        0x00,
        0x00,
        0xff,
        0xc0,
        0x00,
        0x08,
        0x08,
        height >> 8,
        height & 0xff,
        width >> 8,
        width & 0xff,
        0x01,
    ]).buffer;
}

describe("all-WebGPU image layout", () => {
    it("reads dimensions from PNG and JPEG headers without decoding their pixels", () => {
        expect(intrinsicImageDimensions(pngHeader(900, 700))).toEqual({
            width: 900,
            height: 700,
        });
        expect(intrinsicImageDimensions(jpegHeader(809, 1280))).toEqual({
            width: 809,
            height: 1280,
        });
        expect(intrinsicImageDimensions(jpegHeader(1280, 809, 6))).toEqual({
            width: 809,
            height: 1280,
        });
        expect(intrinsicImageDimensions(new Uint8Array([1, 2, 3]).buffer)).toBeUndefined();
    });

    it("gives the reported 809x1280 mobile receipt an undistorted 320x512 frame", () => {
        const layout = transformersWebGpuImageLayout(809, 1280);
        expect(layout).toEqual({
            frameWidth: 320,
            frameHeight: 512,
            drawWidth: 320,
            drawHeight: 506,
            drawX: 0,
            drawY: 3,
        });
        expect((layout.frameWidth / 16) * (layout.frameHeight / 16)).toBe(640);
        expect(layout.drawWidth / layout.drawHeight).toBeCloseTo(809 / 1280, 2);
    });

    it("adapts landscape and square inputs while staying below the phone patch ceiling", () => {
        expect(transformersWebGpuImageLayout(1280, 809)).toEqual({
            frameWidth: 512,
            frameHeight: 320,
            drawWidth: 506,
            drawHeight: 320,
            drawX: 3,
            drawY: 0,
        });
        expect(transformersWebGpuImageLayout(1000, 1000)).toEqual({
            frameWidth: 384,
            frameHeight: 384,
            drawWidth: 384,
            drawHeight: 384,
            drawX: 0,
            drawY: 0,
        });
    });

    it("keeps the proven fallback when encoded dimensions are unavailable", () => {
        expect(transformersWebGpuImageLayout(0, 1280)).toBe(
            TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT,
        );
    });

    it("fails the model boundary closed when the processor grid exceeds 640 patches", () => {
        expect(transformersWebGpuImageGridPatchCount([1n, 32n, 20n])).toBe(
            TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
        );
        expect(transformersWebGpuImageGridPatchCount([1n, 32n, 21n])).toBe(672);
        expect(transformersWebGpuImageGridPatchCount([1n, 0n, 20n])).toBeUndefined();
        expect(transformersWebGpuImageGridPatchCount([1n, 32n])).toBeUndefined();
    });
});
