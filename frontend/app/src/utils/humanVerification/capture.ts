// Captures a single frame from the (unmirrored) video source as a JPEG that
// fits inside the verifier canister's per-frame byte budget. The preview is
// mirrored with CSS only, so the canvas capture here is already unmirrored.

const MAX_DIMENSION = 960;
const INITIAL_QUALITY = 0.85;
const TARGET_BYTES = 280 * 1024;

export async function captureJpegFrame(
    video: HTMLVideoElement,
    maxBytes: number = TARGET_BYTES,
): Promise<Uint8Array | undefined> {
    const { videoWidth, videoHeight } = video;
    if (videoWidth === 0 || videoHeight === 0) return undefined;

    let scale = Math.min(1, MAX_DIMENSION / Math.max(videoWidth, videoHeight));
    let quality = INITIAL_QUALITY;

    // Re-encode ladder: drop quality first, then dimensions, until under budget
    for (let attempt = 0; attempt < 5; attempt++) {
        const blob = await encode(video, videoWidth * scale, videoHeight * scale, quality);
        if (blob === undefined) return undefined;
        if (blob.size <= maxBytes) {
            return new Uint8Array(await blob.arrayBuffer());
        }
        if (quality > 0.6) {
            quality -= 0.15;
        } else {
            scale *= 0.75;
        }
    }
    return undefined;
}

function encode(
    video: HTMLVideoElement,
    width: number,
    height: number,
    quality: number,
): Promise<Blob | undefined> {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    const ctx = canvas.getContext("2d");
    if (ctx === null) return Promise.resolve(undefined);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob ?? undefined), "image/jpeg", quality),
    );
}
