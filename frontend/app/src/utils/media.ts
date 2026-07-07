import type { MessageContent, StoredMediaContent } from "openchat-client";

let current: HTMLMediaElement | undefined;

// Reserve a media element's box synchronously from its send-time dimensions.
// This reproduces the old JS sizing (calculateMediaDimensions) in CSS:
//   width  = min(available width, max(200, natural width))
//   height = width x aspect ratio, capped at min(2/3 viewport, 400px);
//            when the height cap binds, the width narrows to cap x ratio so
//            the aspect ratio is always preserved (expressed here as the
//            third min() term feeding the cap back into the width).
// The available width comes from CSS shrink-to-fit: the message bubble is
// capped at its --max-width, and max-width: 100% resolves against it.
// Rendering the box correctly in the FIRST layout pass matters: the old
// height style was computed in onMount from measured DOM widths, so every
// (re)mount of a media row collapsed for a frame and then snapped back —
// which the virtual list had to compensate for mid-scroll on every window
// re-entry.
export function reservedMediaStyle(
    width: number | undefined,
    height: number | undefined,
): string | undefined {
    if (!width || !height) return undefined;
    const w = Math.round(width);
    const ratio = width / height;
    // The width must stay fully definite: a percentage inside width's min()
    // is cyclic while the bubble shrink-to-fits and falls back to the
    // placeholder thumbnail's intrinsic size. max-width: 100% is the
    // standard non-cyclic way to hand the container cap to the image, and
    // since the final width can only shrink from the cap-derived term, the
    // height cap still holds through the aspect ratio.
    return (
        `aspect-ratio: ${width} / ${height}; ` +
        `width: min(max(200px, ${w}px), calc(min(66.67dvh, 400px) * ${ratio.toFixed(4)})); ` +
        `max-width: 100%; height: auto;`
    );
}

export function isStoreMediaContent(content: MessageContent): content is StoredMediaContent {
    return ["file_content", "audio_content", "video_content", "image_content"].includes(
        content.kind,
    );
}

export function urlForMediaContent(content: MessageContent): string | undefined {
    if (isStoreMediaContent(content)) {
        switch (content.kind) {
            case "video_content":
                return content.videoData.blobUrl;
            default:
                return content.blobUrl;
        }
    }
    return undefined;
}

export function setPlayingMedia(element: HTMLMediaElement) {
    if (current !== undefined && current !== element && current.duration > 0 && !current.paused) {
        current.pause();
    }
    current = element;
}

// Get video metadata and resolve its duration!
export async function getVideoDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = url;
        video.onloadedmetadata = () => {
            resolve(video.duration);
        };
        // Handle potential errors (e.g., 404 or corrupted file)
        video.onerror = () => resolve(0);
    });
}

// FOR NATIVE DEV MODE ONLY!
//
// Rewrite url for dev purposes only! If env is not dev, url is left intact!
export function getProxyAdjustedBlobUrl(blobUrl: string | undefined): string | undefined {
    const isNative =
        import.meta.env.OC_APP_TYPE === "android" || import.meta.env.OC_APP_TYPE === "ios";
    if (blobUrl && import.meta.env.OC_BUILD_ENV === "development" && isNative) {
        try {
            const url = new URL(blobUrl);
            const icUrl = import.meta.env.OC_IC_URL;

            if (url.host.includes("localhost:8080")) {
                const canisterId = url.hostname.split(".")[0];
                const remainingPath = url.pathname + url.search;

                // Reconstruct url that allows request proxying!
                return `${icUrl}/media-proxy/${canisterId}${remainingPath}`;
            }
        } catch (e) {
            console.log("Malformed url", e);
        }
    }

    return blobUrl;
}
