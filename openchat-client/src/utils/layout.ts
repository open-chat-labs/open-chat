import type { Dimensions } from "./media";

export function calculateMediaDimensions(
    content: Dimensions,
    parentWidth: number,
    containerPaddingWidth: number,
    windowHeight: number,
    maxWidthFraction = 0.8
): Dimensions {
    const ratio = content.height / content.width;
    const availWidth = parentWidth * maxWidthFraction - containerPaddingWidth;
    const availHeight = Math.min((2 * windowHeight) / 3, 400);

    let width = Math.min(availWidth, Math.max(200, content.width));
    let height = width * ratio;

    if (height > availHeight) {
        height = availHeight;
        // Allow the image to be stretched in this rare case
        width = Math.max(90 - containerPaddingWidth, height / ratio);
    }

    return {
        width,
        height,
    };
}
