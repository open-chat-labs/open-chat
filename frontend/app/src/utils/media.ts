import type { MessageContent, StoredMediaContent } from "openchat-client";

let current: HTMLMediaElement | undefined;

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
