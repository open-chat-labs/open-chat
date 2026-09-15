import { describe, expect, it } from "vitest";
import { intrinsicImageDimensions } from "./imageDimensions";
import {
    GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES,
    TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT,
    TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
    gemma4WebGpuImageTarget,
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

    it("resamples a near-aligned 809x1280 input to fill its selected 320x512 frame", () => {
        const layout = transformersWebGpuImageLayout(809, 1280);
        expect(layout).toEqual({
            frameWidth: 320,
            frameHeight: 512,
            drawWidth: 320,
            drawHeight: 512,
            drawX: 0,
            drawY: 0,
        });
        expect((layout.frameWidth / 16) * (layout.frameHeight / 16)).toBe(640);
        expect(layout.drawWidth).toBe(layout.frameWidth);
        expect(layout.drawHeight).toBe(layout.frameHeight);
    });

    it("adapts landscape and square inputs while staying below the phone patch ceiling", () => {
        expect(transformersWebGpuImageLayout(1280, 809)).toEqual({
            frameWidth: 512,
            frameHeight: 320,
            drawWidth: 512,
            drawHeight: 320,
            drawX: 0,
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

    it.each([
        [909, 1600, 320, 512],
        [1124, 1397, 352, 448],
        [300, 500, 320, 512],
        [500, 300, 512, 320],
        [640, 480, 448, 352],
        [480, 640, 352, 448],
        [1024, 700, 480, 320],
        [700, 1024, 320, 480],
    ])(
        "fills the near-aligned frame for %ix%i without changing its %ix%i grid",
        (sourceWidth, sourceHeight, frameWidth, frameHeight) => {
            const layout = transformersWebGpuImageLayout(sourceWidth, sourceHeight);
            expect(layout).toEqual({
                frameWidth,
                frameHeight,
                drawWidth: frameWidth,
                drawHeight: frameHeight,
                drawX: 0,
                drawY: 0,
            });
            expect(
                transformersWebGpuImageGridPatchCount([1, frameHeight / 16, frameWidth / 16]),
            ).toBeLessThanOrEqual(TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES);
        },
    );

    it.each([
        [224, 512, 256, 512, 224, 512, 16, 0],
        [225, 512, 256, 512, 225, 512, 15, 0],
        [227, 512, 256, 512, 227, 512, 14, 0],
        [512, 224, 512, 256, 512, 224, 0, 16],
        [512, 225, 512, 256, 512, 225, 0, 15],
        [512, 227, 512, 256, 512, 227, 0, 14],
    ])(
        "keeps %ix%i letterboxed when alignment padding or aspect enlargement exceeds its bound",
        (
            sourceWidth,
            sourceHeight,
            frameWidth,
            frameHeight,
            drawWidth,
            drawHeight,
            drawX,
            drawY,
        ) => {
            expect(transformersWebGpuImageLayout(sourceWidth, sourceHeight)).toEqual({
                frameWidth,
                frameHeight,
                drawWidth,
                drawHeight,
                drawX,
                drawY,
            });
        },
    );

    it.each([
        [228, 512, 256, 512],
        [512, 228, 512, 256],
    ])(
        "fills %ix%i just inside the 12.5 percent enlargement bound",
        (sourceWidth, sourceHeight, frameWidth, frameHeight) => {
            expect(transformersWebGpuImageLayout(sourceWidth, sourceHeight)).toEqual({
                frameWidth,
                frameHeight,
                drawWidth: frameWidth,
                drawHeight: frameHeight,
                drawX: 0,
                drawY: 0,
            });
        },
    );

    it.each([
        [1, 200, 256, 512, 3, 512, 126, 0],
        [200, 1, 512, 256, 512, 3, 0, 126],
    ])(
        "preserves all content of extreme %ix%i inputs using centered letterboxing",
        (
            sourceWidth,
            sourceHeight,
            frameWidth,
            frameHeight,
            drawWidth,
            drawHeight,
            drawX,
            drawY,
        ) => {
            expect(transformersWebGpuImageLayout(sourceWidth, sourceHeight)).toEqual({
                frameWidth,
                frameHeight,
                drawWidth,
                drawHeight,
                drawX,
                drawY,
            });
        },
    );

    it("bounds alignment resampling, content containment, frame edges and patch counts across dimensions", () => {
        const dimensions = [
            1, 2, 31, 32, 33, 127, 224, 225, 227, 228, 255, 256, 257, 288, 320, 384, 448, 511, 512,
            513, 1024, 4096,
        ];
        const mismatches: string[] = [];
        for (const sourceWidth of dimensions) {
            for (const sourceHeight of dimensions) {
                const layout = transformersWebGpuImageLayout(sourceWidth, sourceHeight);
                const { frameWidth, frameHeight, drawWidth, drawHeight, drawX, drawY } = layout;
                for (const edge of [frameWidth, frameHeight]) {
                    expect(edge).toBeGreaterThanOrEqual(256);
                    expect(edge).toBeLessThanOrEqual(512);
                    expect(edge % 32).toBe(0);
                }
                expect(
                    transformersWebGpuImageGridPatchCount([1, frameHeight / 16, frameWidth / 16]),
                ).toBeLessThanOrEqual(TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES);
                expect(drawWidth).toBeGreaterThanOrEqual(1);
                expect(drawHeight).toBeGreaterThanOrEqual(1);
                expect(drawX).toBeGreaterThanOrEqual(0);
                expect(drawY).toBeGreaterThanOrEqual(0);
                expect(drawX + drawWidth).toBeLessThanOrEqual(frameWidth);
                expect(drawY + drawHeight).toBeLessThanOrEqual(frameHeight);

                // Compare against the existing integer-rounded, aspect-preserving contain decode.
                // A sub-32px deficit alone permits >12.5% enlargement near the minimum frame edge.
                const scale = Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
                const containWidth = Math.max(
                    1,
                    Math.min(frameWidth, Math.round(sourceWidth * scale)),
                );
                const containHeight = Math.max(
                    1,
                    Math.min(frameHeight, Math.round(sourceHeight * scale)),
                );
                const scaledWidth = frameWidth * containHeight;
                const scaledHeight = frameHeight * containWidth;
                const shouldFill =
                    frameWidth - containWidth < 32 &&
                    frameHeight - containHeight < 32 &&
                    8 * Math.max(scaledWidth, scaledHeight) <=
                        9 * Math.min(scaledWidth, scaledHeight);
                const expectedWidth = shouldFill ? frameWidth : containWidth;
                const expectedHeight = shouldFill ? frameHeight : containHeight;
                if (
                    drawWidth !== expectedWidth ||
                    drawHeight !== expectedHeight ||
                    drawX !== Math.floor((frameWidth - expectedWidth) / 2) ||
                    drawY !== Math.floor((frameHeight - expectedHeight) / 2)
                ) {
                    mismatches.push(`${sourceWidth}x${sourceHeight}`);
                }
                if (shouldFill) {
                    expect(
                        Math.max(drawWidth * containHeight, drawHeight * containWidth) /
                            Math.min(drawWidth * containHeight, drawHeight * containWidth),
                    ).toBeLessThanOrEqual(1.125);
                }
            }
        }
        expect(mismatches, mismatches.slice(0, 12).join(", ")).toHaveLength(0);
    });

    it.each([
        [909, 1600, 528, 960],
        [1124, 1397, 624, 816],
        [640, 480, 816, 624],
        [480, 640, 624, 816],
        [1, 200, 48, 10512],
        [200, 1, 10512, 48],
    ])(
        "leaves the independent Gemma target for %ix%i unchanged at %ix%i",
        (sourceWidth, sourceHeight, width, height) => {
            expect(gemma4WebGpuImageTarget(sourceWidth, sourceHeight)).toEqual({ width, height });
            expect((width / 16) * (height / 16)).toBeLessThanOrEqual(
                GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES,
            );
        },
    );

    it("fails the model boundary closed when the processor grid exceeds 640 patches", () => {
        expect(transformersWebGpuImageGridPatchCount([1n, 32n, 20n])).toBe(
            TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES,
        );
        expect(transformersWebGpuImageGridPatchCount([1n, 32n, 21n])).toBe(672);
        expect(transformersWebGpuImageGridPatchCount([1n, 0n, 20n])).toBeUndefined();
        expect(transformersWebGpuImageGridPatchCount([1n, 32n])).toBeUndefined();
    });
});
