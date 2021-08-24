import type { DirectMessage, GroupMessage, MessageContent } from "../domain/chat/chat";
import { dataToBlobUrl } from "./blob";

const THUMBNAIL_DIMS = dimensions(30, 30);
const RESIZE_IMAGE_TO = 800;
const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_VIDEO_SIZE = 1024 * 1024 * 5;
export const MAX_AUDIO_SIZE = 1024 * 1024;
const MAX_FILE_SIZE = 1024 * 1024;

type Dimensions = {
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
): Promise<MediaExtract> {
    return new Promise<MediaExtract>((resolve, _) => {
        const video = document.createElement("video");
        video.addEventListener("loadedmetadata", () => {
            video.addEventListener("seeked", () => {
                resolve(
                    changeDimensions(
                        video,
                        mimeType,
                        dimensions(video.videoWidth, video.videoHeight)
                    )
                );
            });
            video.currentTime = 1;
        });
        video.src = blobUrl;
    });
}

function changeDimensions(
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
                        thumbnailUrl: canvas.toDataURL(mimeType),
                        thumbnailData: reader.result as ArrayBuffer,
                    });
                });
                reader.readAsArrayBuffer(blob);
            }
        }, mimeType);
    });
}

type MediaExtract = {
    dimensions: Dimensions;
    thumbnailUrl: string;
    thumbnailData: ArrayBuffer;
};

export function fillMessage(msg: GroupMessage | DirectMessage): boolean {
    if (msg.content.kind === "media_content") {
        return (
            (msg.content.caption === undefined || msg.content.caption === "") &&
            msg.repliesTo === undefined &&
            !/audio/.test(msg.content.mimeType)
        );
    }
    return false;
}

export function messageMetaData(content: MessageContent): Promise<string> | undefined {
    if (content.kind === "file_content" && content.blobData) {
        return content.blobData
            .then((blob) => blob?.byteLength ?? content.blobReference?.blobSize ?? 0)
            .then((size) => `${content.mimeType}-${(size / 1000).toFixed(2)}kb`);
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

            if (isImage || isVideo) {
                const blobUrl = dataToBlobUrl(data, mimeType);

                const extract = isImage
                    ? await extractImageThumbnail(blobUrl, mimeType)
                    : await extractVideoThumbnail(blobUrl, mimeType);

                if (isImage && data.byteLength > MAX_IMAGE_SIZE) {
                    data = (await resizeImage(blobUrl, mimeType)).thumbnailData;
                }

                URL.revokeObjectURL(blobUrl);

                content = {
                    kind: "media_content",
                    mimeType: mimeType,
                    width: extract.dimensions.width,
                    height: extract.dimensions.height,
                    blobData: Promise.resolve(new Uint8Array(data)),
                    thumbnailData: extract.thumbnailUrl,
                };
            } else if (isAudio) {
                content = {
                    kind: "media_content",
                    mimeType: mimeType,
                    width: 0,
                    height: 0,
                    blobData: Promise.resolve(new Uint8Array(data)),
                    thumbnailData: "",
                };
            } else {
                content = {
                    kind: "file_content",
                    name: file.name,
                    mimeType: mimeType,
                    blobData: Promise.resolve(new Uint8Array(data)),
                };
            }
            resolve(content);
        };
    });
}
