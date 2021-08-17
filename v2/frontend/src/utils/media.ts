import type { MessageContent } from "../domain/chat/chat";
import { dataToBlobUrl } from "./blob";

const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_VIDEO_SIZE = 1024 * 1024 * 5;
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

export async function extractImageThumbnail(blobUrl: string): Promise<MediaExtract> {
    return new Promise<MediaExtract>((resolve, _) => {
        const img = new Image();
        img.onload = () => resolve(extractThumbnail(img, dimensions(img.width, img.height)));
        img.src = blobUrl;
    });
}

export async function extractVideoThumbnail(blobUrl: string): Promise<MediaExtract> {
    return new Promise<MediaExtract>((resolve, _) => {
        const video = document.createElement("video");
        video.addEventListener("loadedmetadata", () => {
            video.addEventListener("seeked", () => {
                resolve(extractThumbnail(video, dimensions(video.videoWidth, video.videoHeight)));
            });
            video.currentTime = 1;
        });
        video.src = blobUrl;
    });
}

function extractThumbnail(
    original: HTMLImageElement | HTMLVideoElement,
    mediaDimensions: Dimensions
): MediaExtract {
    const { width, height } = scaleToFit(mediaDimensions, dimensions(20, 20));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const context = canvas.getContext("2d")!;
    context.drawImage(original, 0, 0, canvas.width, canvas.height);
    return {
        dimensions: mediaDimensions,
        thumbnailData: canvas.toDataURL(),
    };
}

type MediaExtract = {
    dimensions: Dimensions;
    thumbnailData: string;
};

export async function messageContentFromFile(file: File): Promise<MessageContent> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            if (!e.target) return;

            const mimeType = file.type;
            const isImage = /^image/.test(mimeType);
            const isVideo = /^video/.test(mimeType);
            const isFile = !(isImage || isVideo);
            const data = e.target.result as ArrayBuffer;
            let content: MessageContent;

            if (isImage && data.byteLength > MAX_IMAGE_SIZE) {
                reject("maxImageSize");
                return;
            } else if (isVideo && data.byteLength > MAX_VIDEO_SIZE) {
                reject("maxVideoSize");
                return;
            } else if (isFile && data.byteLength > MAX_FILE_SIZE) {
                reject("maxFileSize");
                return;
            }

            if (isImage || isVideo) {
                const blobUrl = dataToBlobUrl(data, mimeType);

                const extract = isImage
                    ? await extractImageThumbnail(blobUrl)
                    : await extractVideoThumbnail(blobUrl);

                URL.revokeObjectURL(blobUrl);

                content = {
                    kind: "media_content",
                    mimeType: mimeType,
                    width: extract.dimensions.width,
                    height: extract.dimensions.height,
                    blobData: Promise.resolve(new Uint8Array(data)),
                    thumbnailData: extract.thumbnailData,
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
