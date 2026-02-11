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
