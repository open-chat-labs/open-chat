// Main-thread side of the video transcode worker (see
// openchat-worker/src/transcodeWorker.ts). Resolves to the transcoded file
// plus the hash of the original, or undefined when the original bytes should
// be uploaded unchanged.
import type { TranscodeRequest, TranscodeResponse } from "@worker/transcodeWorker";

export type VideoTranscodeOptions = {
    websiteVersion: string;
    onProgress?: (progress: number | undefined) => void;
};

export type TranscodedVideo = {
    file: File;
    // SHA3-256 of the original bytes, sent with the upload (see VideoContent.sourceHash)
    sourceHash: Uint8Array;
};

// No message from the worker for this long and it is presumed dead: a worker the browser
// kills for memory fires no error event on the parent, and a stalled decoder never resolves.
// Progress arrives at least every 1%, so a healthy transcode never goes quiet this long.
const STALL_TIMEOUT_MS = 60_000;

// Transcodes run one at a time: each is CPU-bound and reports through a single progress
// store, so a video picked during one waits for it to settle. Only videos queue here -
// every other attachment kind is unaffected.
let pending: Promise<unknown> = Promise.resolve();

export function transcodeVideo(
    file: File,
    maxBytes: number,
    options: VideoTranscodeOptions,
): Promise<TranscodedVideo | undefined> {
    // Cheap up-front gate — the worker checks again, but there's no point
    // fetching it on a browser without WebCodecs at all.
    if (typeof VideoEncoder === "undefined") return Promise.resolve(undefined);

    const next = pending.then(() => runTranscode(file, maxBytes, options));
    pending = next.catch(() => undefined);
    return next;
}

function runTranscode(
    file: File,
    maxBytes: number,
    { websiteVersion, onProgress }: VideoTranscodeOptions,
): Promise<TranscodedVideo | undefined> {
    return new Promise((resolve) => {
        const workerUrl = `/transcode_worker.js?v=${websiteVersion}`;
        const worker = new Worker(new URL(workerUrl, import.meta.url), { type: "module" });
        let stallTimer: ReturnType<typeof setTimeout> | undefined;

        function finish(result: TranscodedVideo | undefined) {
            clearTimeout(stallTimer);
            worker.terminate();
            onProgress?.(undefined);
            resolve(result);
        }

        function resetStallTimer() {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => {
                console.warn("VIDEO_TRANSCODE: worker stalled, uploading original");
                finish(undefined);
            }, STALL_TIMEOUT_MS);
        }

        worker.onerror = (ev) => {
            console.warn("VIDEO_TRANSCODE: worker failed, uploading original", ev.message);
            finish(undefined);
        };

        worker.onmessageerror = () => {
            console.warn("VIDEO_TRANSCODE: undecodable worker message, uploading original");
            finish(undefined);
        };

        worker.onmessage = (ev: MessageEvent<TranscodeResponse>) => {
            resetStallTimer();
            const msg = ev.data;
            switch (msg.kind) {
                case "progress":
                    onProgress?.(msg.value);
                    break;
                case "done": {
                    const name = file.name.replace(/\.[^.]+$/, "") + ".mp4";
                    finish({
                        file: new File([msg.buffer], name, { type: msg.mimeType }),
                        sourceHash: msg.sourceHash,
                    });
                    break;
                }
                case "skipped":
                    console.debug("VIDEO_TRANSCODE: skipped -", msg.reason);
                    finish(undefined);
                    break;
                case "unsupported":
                    console.debug("VIDEO_TRANSCODE: unsupported -", msg.reason);
                    finish(undefined);
                    break;
                case "error":
                    console.warn("VIDEO_TRANSCODE: failed, uploading original -", msg.message);
                    finish(undefined);
                    break;
            }
        };

        onProgress?.(0);
        resetStallTimer();
        const req: TranscodeRequest = { kind: "transcode", file, maxBytes };
        worker.postMessage(req);
    });
}
