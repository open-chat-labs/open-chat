import type { AttachmentContent, Message, MessageContent } from "openchat-shared";
import { dataToBlobUrl } from "./blob";

const THUMBNAIL_DIMS = dimensions(30, 30);

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

export async function extractImageThumbnail(
    blobUrl: string,
    mimeType: string,
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
    mimeType: string,
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
                            dimensions(video.videoWidth, video.videoHeight),
                        ),
                        changeDimensions(
                            video,
                            mimeType,
                            dimensions(video.videoWidth, video.videoHeight),
                            dimensions(video.videoWidth, video.videoHeight),
                        ),
                    ]),
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
    newDimensions: Dimensions = THUMBNAIL_DIMS,
): Promise<MediaExtract> {
    const { width, height } = scaleToFit(originalDimensions, newDimensions);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d")!;
    context.drawImage(original, 0, 0, canvas.width, canvas.height);
    const resultMimeType = mimeType === "image/jpeg" ? "image/jpeg" : "image/png";

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
        }, resultMimeType);
    });
}

type MediaExtract = {
    dimensions: Dimensions;
    url: string;
    data: ArrayBuffer;
};

export function fillMessage(msg: Message): boolean {
    if (msg.forwarded || msg.content.kind === "meme_fighter_content") {
        return false;
    }

    if (msg.content.kind === "prize_content") {
        return true;
    }

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

export function stripMetaDataAndResize(blobUrl: string, mimeType: string): Promise<MediaExtract> {
    // if our image is too big, we'll just create a new version with fixed dimensions
    // there's no very easy way to reduce it to a specific file size
    return new Promise<MediaExtract>((resolve, _) => {
        const img = new Image();
        img.onload = () => {
            resolve(
                changeDimensions(img, mimeType, dimensions(img.width, img.height), MAX_DIMENSIONS),
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

export async function messageContentFromFile(
    file: File,
    isDiamond: boolean,
): Promise<AttachmentContent> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            if (!e.target) return;

            const mimeType = file.type;
            const isImage = /^image/.test(mimeType);
            const isSVG = mimeType === "image/svg+xml";
            const isGif = isImage && /gif/.test(mimeType);
            const isVideo = /^video/.test(mimeType);
            const isAudio = /^audio/.test(mimeType);
            const isFile = !(isImage || isVideo || isAudio);
            let data = e.target.result as ArrayBuffer;
            let content: MessageContent;
            const maxSizes = isDiamond ? DIAMOND_MAX_SIZES : FREE_MAX_SIZES;

            if (isVideo && data.byteLength > maxSizes.video) {
                reject("maxVideoSize");
                return;
            } else if (isAudio && data.byteLength > maxSizes.audio) {
                reject("maxAudioSize");
                return;
            } else if (isFile && data.byteLength > maxSizes.file) {
                reject("maxFileSize");
                return;
            }

            const blobUrl = dataToBlobUrl(data, mimeType);

            if (isImage) {
                const extract = await extractImageThumbnail(blobUrl, mimeType);

                if (!isGif || data.byteLength > maxSizes.image) {
                    data = (await stripMetaDataAndResize(blobUrl, mimeType)).data;
                }

                content = {
                    kind: "image_content",
                    mimeType: isSVG ? "image/png" : mimeType,
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
                const quantised = await quantiseWaveform(data.slice(0));
                content = {
                    kind: "audio_content",
                    mimeType: mimeType,
                    blobData: new Uint8Array(data),
                    blobUrl: blobUrl,
                    ...quantised,
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
