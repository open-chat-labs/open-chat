import type { AttachmentContent, Message } from "openchat-shared";
import { LazyFile } from "openchat-shared";
import { dataToBlobUrl } from "./blob";

const THUMBNAIL_DIMS = dimensions(30, 30);
const DEFAULT_JPEG_QUALITY = 0.75;

export type MaxMediaSizes = {
    image: number;
    video: number;
    audio: number;
    file: number;
};

export const MAX_DIMENSIONS = dimensions(1500, 1500);

export const FREE_MAX_SIZES: MaxMediaSizes = {
    image: 1024 * 1024,
    video: 1024 * 1024 * 5,
    audio: 1024 * 1024,
    file: 1024 * 1024,
};

export const DIAMOND_MAX_SIZES: MaxMediaSizes = {
    image: 1024 * 1024 * 5,
    video: 1024 * 1024 * 50,
    audio: 1024 * 1024 * 20,
    file: 1024 * 1024 * 5,
};

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

export async function extractImageThumbnail(file: File): Promise<MediaExtract> {
    const bitmap = await createImageBitmap(file);
    return changeDimensions(bitmap, file.type, dimensions(bitmap.width, bitmap.height));
}

export async function extractVideoThumbnail(file: File): Promise<[MediaExtract, MediaExtract]> {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true; // may help with autoplay/seek on some browsers
    video.src = objectUrl;

    try {
        await new Promise<void>((resolve, reject) => {
            video.addEventListener("loadedmetadata", () => resolve(), { once: true });
            video.addEventListener("error", () => reject(new Error("failed to load video")), {
                once: true,
            });
        });

        // Seek to 1 seecond, should be okay with iOS
        video.currentTime = 1;

        // Wait for the seek to complete
        await new Promise<void>((resolve, reject) => {
            const seekTimeout = setTimeout(() => reject(new Error("video seek timeout")), 5000);
            video.addEventListener(
                "seeked",
                () => {
                    clearTimeout(seekTimeout);
                    resolve();
                },
                { once: true },
            );

            // TODO any fallbacks for video.readyState < 2?
        });

        const originalDim = dimensions(video.videoWidth, video.videoHeight);
        const resized = await Promise.all([
            changeDimensions(video, file.type, originalDim, THUMBNAIL_DIMS),
            changeDimensions(video, file.type, originalDim, originalDim),
        ]);

        return resized;
    } finally {
        // Always clean up the object URL
        URL.revokeObjectURL(objectUrl);
        video.src = "";
        // helps release memory
        video.load();
    }
}

export async function stripMetaDataAndResize(file: File): Promise<MediaExtract> {
    // Directly create bitmap from the File (works on web + Tauri, no tainting)
    const bitmap = await createImageBitmap(file);
    const result = await changeDimensions(
        bitmap,
        file.type,
        dimensions(bitmap.width, bitmap.height),
        MAX_DIMENSIONS,
    );

    // Free memory as soon as we're done with the bitmap
    bitmap.close();
    return result;
}

export async function changeDimensions(
    source: ImageBitmap | HTMLImageElement | HTMLVideoElement,
    mimeType: string,
    originalDimensions: Dimensions,
    newDimensions: Dimensions = THUMBNAIL_DIMS,
): Promise<MediaExtract> {
    const { width, height } = scaleToFit(originalDimensions, newDimensions);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d")!;
    context.drawImage(source, 0, 0, width, height);

    const resultMimeType = mimeType === "image/jpeg" ? "image/jpeg" : "image/png";

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, resultMimeType, DEFAULT_JPEG_QUALITY);
    });

    if (!blob) {
        throw new Error("Failed to create blob from canvas");
    }

    const arrayBuffer = await blob.arrayBuffer();

    return {
        dimensions: originalDimensions,
        url: canvas.toDataURL(resultMimeType, DEFAULT_JPEG_QUALITY),
        data: arrayBuffer,
    };
}

type MediaExtract = {
    dimensions: Dimensions;
    url: string;
    data: ArrayBuffer;
};

export function fillMessage(msg: Message): boolean {
    if (msg.forwarded || msg.content.kind === "meme_fighter_content") return false;
    if (msg.content.kind === "prize_content") return true;
    if (
        msg.content.kind === "image_content" ||
        msg.content.kind === "video_content" ||
        msg.content.kind === "giphy_content"
    ) {
        return (
            (msg.content.caption === undefined || msg.content.caption === "") &&
            msg.repliesTo === undefined
        );
    } else {
        return false;
    }
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

function reduceWaveform(channels: Float32Array[]): Uint8Array {
    const targetSamples = 120;
    const bits = 8;
    const maxLevel = (1 << bits) - 1;
    const frameCount = channels[0].length;
    const samplesPerBucket = frameCount / targetSamples;
    const samples = new Uint8Array(targetSamples);

    function summariseBlock(start: number, end: number) {
        let sumsq = 0;
        let count = 0;
        for (let c = 0; c < channels.length; c++) {
            const ch = channels[c];
            for (let i = start; i < end; i++) {
                const v = ch[i];
                sumsq += v * v;
                count++;
            }
        }
        return Math.sqrt(sumsq / Math.max(1, count));
    }

    const raw = new Float32Array(targetSamples);
    let maxRaw = 0;
    for (let s = 0; s < targetSamples; s++) {
        const start = Math.floor(s * samplesPerBucket);
        const end = Math.min(Math.floor((s + 1) * samplesPerBucket), frameCount);
        const val = summariseBlock(start, end);
        raw[s] = val;
        if (val > maxRaw) maxRaw = val;
    }

    const normaliser = maxRaw > 0 ? 1 / maxRaw : 1;
    for (let s = 0; s < targetSamples; s++) {
        const q = Math.round(raw[s] * normaliser * maxLevel);
        samples[s] = Math.min(maxLevel, Math.max(0, q));
    }

    return samples;
}

export async function quantiseWaveform(
    bytes: ArrayBuffer,
): Promise<{ durationMs: bigint; samples: Uint8Array }> {
    const ctx = new AudioContext();
    const audioBuffer = await ctx.decodeAudioData(bytes);

    const channels = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        channels.push(audioBuffer.getChannelData(c));
    }
    const samples = reduceWaveform(channels);
    const durationMs = BigInt(Math.floor(audioBuffer.duration * 1000));

    return { samples, durationMs };
}

// HANDLE ATTACHED MEDIA

type MediaType = "image" | "svg" | "gif" | "video" | "audio" | "file";

function mimeToMediaType(mimeType: string): MediaType {
    if (/^video/.test(mimeType)) return "video";
    if (/^audio/.test(mimeType)) return "audio";
    if (/^image/.test(mimeType)) {
        if (/gif/.test(mimeType)) return "gif";
        else return "image";
    }
    if (mimeType === "image/svg+xml") return "svg";

    return "file";
}

// Process selected image!
//
// Creates a thumbnail, and resizes the image if necessary. Returns the content
// data shape.
// TODO blob data should be loaded lazyily for any content
async function handleImageFile(
    file: File,
    maxSizes: MaxMediaSizes,
    mediaType: MediaType,
): Promise<AttachmentContent> {
    const isGif = mediaType === "gif";
    const isSvg = mediaType === "svg";

    // Get image thumbnail!
    const bitmap = await createImageBitmap(file);
    const thumbnail = await changeDimensions(
        bitmap,
        file.type,
        dimensions(bitmap.width, bitmap.height),
    );
    bitmap.close();

    // If it's not gif, and file size is larger than allowed, resize!
    const data =
        !isGif || file.size > maxSizes.image
            ? (await stripMetaDataAndResize(file)).data
            : await file.arrayBuffer();
    const blobUrl = dataToBlobUrl(data, file.type);

    return {
        kind: "image_content",
        mimeType: isSvg ? "image/png" : file.type,
        width: thumbnail.dimensions.width,
        height: thumbnail.dimensions.height,
        blobData: new Uint8Array(data),
        thumbnailData: thumbnail.url,
        blobUrl: blobUrl,
    };
}

// Handle video files
//
// Extracts video thumbnail and a full image, then reads the video data and
// returns the attachment content.
// TODO blob data should be loaded lazyily for any content
async function handleVideoFile(file: File): Promise<AttachmentContent> {
    const [thumb, image] = await extractVideoThumbnail(file);

    // TODO resize video instead of checking max dims?
    const data = await file.arrayBuffer();
    const blobUrl = dataToBlobUrl(data, file.type);

    return {
        kind: "video_content",
        mimeType: file.type,
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
}

// Handle audio files
//
// Waveform is quantised and attachment content returned.
// TODO - blob data should be loaded lazyily for any content
// TODO - should we be concerned about reducing audio size?
async function handleAudioFiles(file: File): Promise<AttachmentContent> {
    const data = await file.arrayBuffer();
    const blobUrl = dataToBlobUrl(data, file.type);
    const quantised = await quantiseWaveform(data.slice(0));
    return {
        kind: "audio_content",
        mimeType: file.type,
        blobData: new Uint8Array(data),
        blobUrl: blobUrl,
        ...quantised,
    };
}

// Handle regular files
//
// Anything that's not an image, video, audio...
// TODO extract an image from the file where possible (i.e. first page of pdf document)
async function handleRegularFiles(file: File): Promise<AttachmentContent> {
    const data = await file.arrayBuffer();
    const blobUrl = dataToBlobUrl(data, file.type);
    return {
        kind: "file_content",
        name: file.name,
        mimeType: file.type,
        blobData: new Uint8Array(data),
        blobUrl: blobUrl,
        fileSize: data.byteLength,
    };
}

export async function messageContentFromFile(
    file: File | LazyFile,
    isDiamond: boolean,
): Promise<AttachmentContent> {
    return new Promise(async (resolve, reject) => {
        const dataSizeInBytes = file.size;
        const mediaType = mimeToMediaType(file.type);
        const maxSizes = isDiamond ? DIAMOND_MAX_SIZES : FREE_MAX_SIZES;
        const f: File = file instanceof LazyFile ? await file.load() : file;

        switch (mediaType) {
            case "image":
            case "gif":
            case "svg":
                resolve(await handleImageFile(f, maxSizes, mediaType));
                break;

            case "video":
                if (dataSizeInBytes > maxSizes.video) return reject("maxVideoSize");
                resolve(await handleVideoFile(f));
                break;

            case "audio":
                if (dataSizeInBytes > maxSizes.audio) return reject("maxAudioSize");
                resolve(await handleAudioFiles(f));
                break;

            // File is default!
            default:
                if (dataSizeInBytes > maxSizes.file) return reject("maxFileSize");
                resolve(handleRegularFiles(f));
        }
    });
}

/** twitter link */
export const twitterLinkRegex = (): RegExp =>
    /https?:\/\/(twitter|x)\.com\/[^/]+\/status(es)?\/(\d+)[?^ ]*/i;

/** Youtube link handling - various formats
 * https://youtu.be/SWgxgpGZerc
 * https://www.youtube.com/watch?v=SWgxgpGZerc
 * https://youtube.com/shorts/u1I0Z8ePtKM?feature=share
 * https://www.youtube.com/shorts/u1I0Z8ePtKM
 */
export const youtubeRegex = (): RegExp =>
    /https:\/\/(?:www.youtube.com\/watch\?v=([^/\s]*)|youtu.be\/([^/\s]*)|(?:www\.)?youtube.com\/shorts\/([^/\s]*))/i;

export const instagramRegex = (): RegExp =>
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;

export const spotifyRegex = (): RegExp => /\/(album|artist|show|episode|track|playlist)\/(\w+)/i;

// https://oc.app/community/yf5kc-uaaaa-aaaar-a7qfq-cai/channel/2656124989/1863
// or https://oc.app/community/yf5kc-uaaaa-aaaar-a7qfq-cai/channel/2656124989/1863/2
export const communityMessageRegex = (): RegExp =>
    /\/community\/([a-z0-9_-]+)\/channel\/(\d+)\/(\d+)(?:\/(\d+))?/i;

// https://oc.app/group/s5ihe-dqaaa-aaaac-a3elq-cai/172
// or https://oc.app/group/s5ihe-dqaaa-aaaac-a3elq-cai/172/3
export const groupMessageRegex = (): RegExp => /\/group\/([a-z0-9_-]+)\/(\d+)(?:\/(\d+))?/i;

export function isYoutubeLink(text: string): boolean {
    return matchesLink(text, text.match(youtubeRegex()));
}

export function containsYoutubeLink(text: string): boolean {
    return containsLink(text, text.match(youtubeRegex()));
}

/** DSocial link handling - not currently used */
export const dsocialRegex = (): RegExp =>
    /https:\/\/(?:dsocial.app|dwqte-viaaa-aaaai-qaufq-cai.ic0.app)\/([^\s/]*)(?:[^ ]*)/i;

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
