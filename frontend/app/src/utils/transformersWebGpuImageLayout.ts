export type TransformersWebGpuImageLayout = Readonly<{
    frameWidth: number;
    frameHeight: number;
    drawWidth: number;
    drawHeight: number;
    drawX: number;
    drawY: number;
}>;

// The proven SM8650 ceiling is below 720 raw 16x16 patches. Keep a margin while allowing a
// portrait document to use 320x512 instead of being stretched into the old 288x512 rectangle.
const PATCH_SIZE = 16;
const FRAME_ALIGNMENT = 32;
const MIN_FRAME_EDGE = 256;
const MAX_FRAME_EDGE = 512;
export const TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES = 640;
const MAX_FRAME_PIXELS = TRANSFORMERS_WEBGPU_MAX_RAW_IMAGE_PATCHES * PATCH_SIZE * PATCH_SIZE;

const GEMMA4_POOLING_KERNEL_SIZE = 3;
// Gemma 4's unfused vision attention materializes an fp16 [1, 12, patches, patches]
// score tensor. 240 soft tokens become 2,160 raw patches after 3x3 pooling, so that
// tensor is 111,974,400 bytes: safely below WebGPU's 128 MiB minimum maximum storage
// binding size. The theoretical 256-token edge leaves only 6.5 MiB of headroom; 240
// leaves 21.2 MiB for backend padding/alignment and concurrent driver intermediates.
export const GEMMA4_WEBGPU_MAX_SOFT_TOKENS = 240;
const GEMMA4_SIDE_ALIGNMENT = PATCH_SIZE * GEMMA4_POOLING_KERNEL_SIZE;
export const GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES =
    GEMMA4_WEBGPU_MAX_SOFT_TOKENS * GEMMA4_POOLING_KERNEL_SIZE ** 2;

export const TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT: TransformersWebGpuImageLayout =
    Object.freeze({
        frameWidth: 288,
        frameHeight: 512,
        drawWidth: 288,
        drawHeight: 512,
        drawX: 0,
        drawY: 0,
    });

function positiveDimensions(width: number, height: number): boolean {
    return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0;
}

/**
 * Select an aligned frame under the proven phone patch ceiling, then letterbox an aspect-preserving
 * decode into it. Maximizing decoded content area makes small receipt text legible; padding wins
 * over stretching, so digits and named months keep their actual glyph shapes.
 */
export function transformersWebGpuImageLayout(
    sourceWidth: number,
    sourceHeight: number,
): TransformersWebGpuImageLayout {
    if (!positiveDimensions(sourceWidth, sourceHeight)) {
        return TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT;
    }

    let best:
        | (TransformersWebGpuImageLayout & { contentPixels: number; paddingPixels: number })
        | undefined;
    for (
        let frameWidth = MIN_FRAME_EDGE;
        frameWidth <= MAX_FRAME_EDGE;
        frameWidth += FRAME_ALIGNMENT
    ) {
        for (
            let frameHeight = MIN_FRAME_EDGE;
            frameHeight <= MAX_FRAME_EDGE;
            frameHeight += FRAME_ALIGNMENT
        ) {
            const framePixels = frameWidth * frameHeight;
            if (framePixels > MAX_FRAME_PIXELS) continue;
            const scale = Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
            const drawWidth = Math.max(1, Math.min(frameWidth, Math.round(sourceWidth * scale)));
            const drawHeight = Math.max(1, Math.min(frameHeight, Math.round(sourceHeight * scale)));
            const contentPixels = drawWidth * drawHeight;
            const paddingPixels = framePixels - contentPixels;
            const candidate = {
                frameWidth,
                frameHeight,
                drawWidth,
                drawHeight,
                drawX: Math.floor((frameWidth - drawWidth) / 2),
                drawY: Math.floor((frameHeight - drawHeight) / 2),
                contentPixels,
                paddingPixels,
            };
            if (
                best === undefined ||
                candidate.contentPixels > best.contentPixels ||
                (candidate.contentPixels === best.contentPixels &&
                    candidate.paddingPixels < best.paddingPixels) ||
                (candidate.contentPixels === best.contentPixels &&
                    candidate.paddingPixels === best.paddingPixels &&
                    framePixels < best.frameWidth * best.frameHeight)
            ) {
                best = candidate;
            }
        }
    }
    if (best === undefined) return TRANSFORMERS_WEBGPU_FALLBACK_IMAGE_LAYOUT;
    const { contentPixels: _contentPixels, paddingPixels: _paddingPixels, ...layout } = best;
    return layout;
}

/**
 * Match the pinned Gemma4 image processor's aspect-preserving target exactly. Decoding directly
 * to this size avoids first shrinking receipt text to Qwen's 640-patch frame and then enlarging
 * already-lost digits back to Gemma's capped 2,160-patch input.
 */
export function gemma4WebGpuImageTarget(
    sourceWidth: number,
    sourceHeight: number,
): Readonly<{ width: number; height: number }> {
    if (!positiveDimensions(sourceWidth, sourceHeight)) {
        throw new Error("Gemma received invalid encoded image dimensions.");
    }
    const targetPixels = GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES * PATCH_SIZE ** 2;
    const factor = Math.sqrt(targetPixels / (sourceWidth * sourceHeight));
    let height =
        Math.floor((factor * sourceHeight) / GEMMA4_SIDE_ALIGNMENT) * GEMMA4_SIDE_ALIGNMENT;
    let width = Math.floor((factor * sourceWidth) / GEMMA4_SIDE_ALIGNMENT) * GEMMA4_SIDE_ALIGNMENT;
    if (height === 0 && width === 0) {
        throw new Error("Gemma could not derive a non-empty image target.");
    }
    const maxSide =
        Math.floor(GEMMA4_WEBGPU_MAX_RAW_IMAGE_PATCHES / GEMMA4_POOLING_KERNEL_SIZE ** 2) *
        GEMMA4_SIDE_ALIGNMENT;
    if (height === 0) {
        height = GEMMA4_SIDE_ALIGNMENT;
        width = Math.min(Math.floor(sourceWidth / sourceHeight) * GEMMA4_SIDE_ALIGNMENT, maxSide);
    } else if (width === 0) {
        width = GEMMA4_SIDE_ALIGNMENT;
        height = Math.min(Math.floor(sourceHeight / sourceWidth) * GEMMA4_SIDE_ALIGNMENT, maxSide);
    }
    return { width, height };
}

/** Read the processor's single-image T/H/W grid without lossy bigint arithmetic. */
export function transformersWebGpuImageGridPatchCount(
    values: Iterable<number | bigint>,
): number | undefined {
    const grid = [...values];
    if (grid.length !== 3) return undefined;
    let product = 1;
    for (const value of grid) {
        const numeric = typeof value === "bigint" ? Number(value) : value;
        if (!Number.isSafeInteger(numeric) || numeric < 1) return undefined;
        product *= numeric;
        if (!Number.isSafeInteger(product)) return undefined;
    }
    return product;
}
