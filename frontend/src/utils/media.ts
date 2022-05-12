import type { Message, MessageContent } from "../domain/chat/chat";
import { dataToBlobUrl } from "./blob";

const THUMBNAIL_DIMS = dimensions(30, 30);
const RESIZE_IMAGE_TO = 800;
const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_VIDEO_SIZE = 1024 * 1024 * 5;
export const MAX_AUDIO_SIZE = 1024 * 1024;
const MAX_FILE_SIZE = 1024 * 1024;

export type Dimensions = {
    width: number;
    height: number;
};

function dimensions(width: number, height: number): Dimensions {
    return { width, height };
}

function scaleToFit(toScale: Dimensions, maxDimensions: Dimensions): Dimensions {
    const aspectRatio = toScale.width / toScale.height;
    const maxAspectRatio = maxDimensions.width / maxDimensions.height;

    if (toScale.width <= maxDimensions.width && toScale.height <= maxDimensions.height) {
        return dimensions(toScale.width, toScale.height);
    }

    if (aspectRatio > maxAspectRatio) {
        return dimensions(maxDimensions.width, Math.floor(maxDimensions.width / aspectRatio));
    } else {
        return dimensions(Math.floor(maxDimensions.height * aspectRatio), maxDimensions.height);
    }
}

export async function extractImageThumbnail(
    blobUrl: string,
    mimeType: string
): Promise<MediaExtract> {
    return new Promise<MediaExtract>((resolve, _) => {
        const img = new Image();
        img.onload = () =>
            resolve(changeDimensions(img, mimeType, dimensions(img.width, img.height)));
        img.src = blobUrl;
    });
}

export async function extractVideoThumbnail(
    blobUrl: string,
    mimeType: string
): Promise<[MediaExtract, MediaExtract]> {
    return new Promise<[MediaExtract, MediaExtract]>((resolve, _) => {
        const video = document.createElement("video");
        video.addEventListener("loadedmetadata", () => {
            // if the currentTime is set too early the "seeked" event does not fire on iOS
            // Can't find a better way to deal with it than this
            let attempts = 0;
            const loop = window.setInterval(() => {
                if (attempts > 10) window.clearInterval(loop);
                video.currentTime = 1;
                attempts += 1;
            }, 100);
            video.addEventListener("seeked", () => {
                window.clearInterval(loop);
                resolve(
                    Promise.all([
                        changeDimensions(
                            video,
                            mimeType,
                            dimensions(video.videoWidth, video.videoHeight)
                        ),
                        changeDimensions(
                            video,
                            mimeType,
                            dimensions(video.videoWidth, video.videoHeight),
                            dimensions(video.videoWidth, video.videoHeight)
                        ),
                    ])
                );
            });
        });
        video.src = blobUrl;
    });
}

export function changeDimensions(
    original: HTMLImageElement | HTMLVideoElement,
    mimeType: string,
    originalDimensions: Dimensions,
    newDimensions: Dimensions = THUMBNAIL_DIMS
): Promise<MediaExtract> {
    const { width, height } = scaleToFit(originalDimensions, newDimensions);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const context = canvas.getContext("2d")!;
    context.drawImage(original, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (blob) {
                const reader = new FileReader();
                reader.addEventListener("loadend", () => {
                    resolve({
                        dimensions: originalDimensions,
                        url: canvas.toDataURL(mimeType),
                        data: reader.result as ArrayBuffer,
                    });
                });
                reader.readAsArrayBuffer(blob);
            }
        }, mimeType);
    });
}

type MediaExtract = {
    dimensions: Dimensions;
    url: string;
    data: ArrayBuffer;
};

export function fillMessage(msg: Message): boolean {
    if (
        msg.content.kind === "image_content" ||
        msg.content.kind === "video_content" ||
        msg.content.kind === "giphy_content"
    ) {
        return (
            (msg.content.caption === undefined || msg.content.caption === "") &&
            msg.repliesTo === undefined
        );
    } else if (msg.content.kind === "text_content" && isSocialVideoLink(msg.content.text)) {
        return true;
    } else {
        return false;
    }
}

export function resizeImage(blobUrl: string, mimeType: string): Promise<MediaExtract> {
    // if our image is too big, we'll just create a new version with fixed dimensions
    // there's no very easy way to reduce it to a specific file size
    return new Promise<MediaExtract>((resolve, _) => {
        const img = new Image();
        img.onload = () => {
            resolve(
                changeDimensions(
                    img,
                    mimeType,
                    dimensions(img.width, img.height),
                    dimensions(RESIZE_IMAGE_TO, RESIZE_IMAGE_TO)
                )
            );
        };
        img.src = blobUrl;
    });
}

export function audioRecordingMimeType(): "audio/webm" | "audio/mp4" | undefined {
    // prefer mp4 since it works on iOS and desktop, fallback to webm just in case
    if (MediaRecorder.isTypeSupported("audio/mp4")) {
        return "audio/mp4";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        return "audio/webm";
    }
    return undefined;
}

export async function messageContentFromFile(file: File): Promise<MessageContent> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            if (!e.target) return;

            const mimeType = file.type;
            const isImage = /^image/.test(mimeType);
            const isVideo = /^video/.test(mimeType);
            const isAudio = /^audio/.test(mimeType);
            const isFile = !(isImage || isVideo);
            let data = e.target.result as ArrayBuffer;
            let content: MessageContent;

            if (isVideo && data.byteLength > MAX_VIDEO_SIZE) {
                reject("maxVideoSize");
                return;
            } else if (isAudio && data.byteLength > MAX_AUDIO_SIZE) {
                reject("maxAudioSize");
                return;
            } else if (isFile && data.byteLength > MAX_FILE_SIZE) {
                reject("maxFileSize");
                return;
            }

            const blobUrl = dataToBlobUrl(data, mimeType);

            if (isImage) {
                const extract = await extractImageThumbnail(blobUrl, mimeType);

                if (data.byteLength > MAX_IMAGE_SIZE) {
                    data = (await resizeImage(blobUrl, mimeType)).data;
                }

                content = {
                    kind: "image_content",
                    mimeType: mimeType,
                    width: extract.dimensions.width,
                    height: extract.dimensions.height,
                    blobData: new Uint8Array(data),
                    thumbnailData: extract.url,
                    blobUrl: blobUrl,
                };
            } else if (isVideo) {
                const [thumb, image] = await extractVideoThumbnail(blobUrl, mimeType);

                content = {
                    kind: "video_content",
                    mimeType: mimeType,
                    width: image.dimensions.width,
                    height: image.dimensions.height,
                    imageData: {
                        blobData: new Uint8Array(image.data),
                        blobUrl: image.url,
                    },
                    videoData: {
                        blobData: new Uint8Array(data),
                        blobUrl: blobUrl,
                    },
                    thumbnailData: thumb.url,
                };
            } else if (isAudio) {
                content = {
                    kind: "audio_content",
                    mimeType: mimeType,
                    blobData: new Uint8Array(data),
                    blobUrl: blobUrl,
                };
            } else {
                content = {
                    kind: "file_content",
                    name: file.name,
                    mimeType: mimeType,
                    blobData: new Uint8Array(data),
                    blobUrl: blobUrl,
                    fileSize: data.byteLength,
                };
            }
            resolve(content);
        };
    });
}

/** Youtube link handling */
export const youtubeRegex = (): RegExp =>
    /https:\/\/(?:www.youtube.com\/watch\?v=([^/ ]*)|youtu.be\/([^/ ]*))/i;

export function isYoutubeLink(text: string): boolean {
    return matchesLink(text, text.match(youtubeRegex()));
}

export function containsYoutubeLink(text: string): boolean {
    return containsLink(text, text.match(youtubeRegex()));
}

/** DSocial link handling - not currently used */
export const dsocialRegex = (): RegExp =>
    /https:\/\/(?:dsocial.app|dwqte-viaaa-aaaai-qaufq-cai.ic0.app)\/([^ /]*)(?:[^ ]*)/i;

export function isDsocialLink(text: string): boolean {
    return matchesLink(text, text.match(dsocialRegex()));
}

export function containsDsocialLink(text: string): boolean {
    return containsLink(text, text.match(dsocialRegex()));
}

/** indicates that the message is a video link and nothing else */
export function isSocialVideoLink(text: string): boolean {
    return isYoutubeLink(text);
}

/** indicates that the message contains a video link but also has other content */
export function containsSocialVideoLink(text: string): boolean {
    return containsYoutubeLink(text);
    // return containsDsocialLink(text) || containsYoutubeLink(text);
}

function containsLink(text: string, match: RegExpMatchArray | null): boolean {
    return match ? match[0] !== text : false;
}

function matchesLink(text: string, match: RegExpMatchArray | null): boolean {
    return match ? match[0] === text : false;
}
