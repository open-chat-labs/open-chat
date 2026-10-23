// Cropping an image the user picked (an avatar, a banner, a profile background), in every tree: the
// file read, and the area they chose scaled to the size it's saved at.

import type { Dimensions } from "@client";

// in the source image's pixels
export type CropArea = { x: number; y: number; width: number; height: number };
export type CroppedImage = { url: string; data: Uint8Array };

export const AVATAR_SIZE: Dimensions = { width: 150, height: 150 };
export const BANNER_SIZE: Dimensions = { width: 600, height: 300 };
// desktop's (and the new web UI's) profile background; the mobile app saves it as a banner
export const PROFILE_BACKGROUND_SIZE: Dimensions = { width: 600, height: 800 };

/** The picked file as a data URL, for the cropper to show. */
export function readImageFile(file: File): Promise<string> {
    return readAsDataUrl(file);
}

function readAsDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/** The area of `source` (a data URL) scaled to `size`: its data URL and its bytes to upload. */
export async function cropImage(
    source: string,
    area: CropArea,
    size: Dimensions,
): Promise<CroppedImage | undefined> {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas
        .getContext("2d")
        ?.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height);
    // as the old wrappers asked for it ("image/jpg" isn't a type the canvas knows, so it's a PNG)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpg"));
    if (blob === null) return undefined;
    // the URL from the bytes already encoded, not a second encode of the canvas
    const [url, bytes] = await Promise.all([readAsDataUrl(blob), blob.arrayBuffer()]);
    return { url, data: new Uint8Array(bytes) };
}
