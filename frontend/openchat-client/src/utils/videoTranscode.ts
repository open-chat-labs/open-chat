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

export function transcodeVideo(
    file: File,
    { websiteVersion, onProgress }: VideoTranscodeOptions,
): Promise<TranscodedVideo | undefined> {
    // Cheap up-front gate — the worker checks again, but there's no point
    // fetching it on a browser without WebCodecs at all.
    if (typeof VideoEncoder === "undefined") return Promise.resolve(undefined);

    return new Promise((resolve) => {
        const workerUrl = `/transcode_worker.js?v=${websiteVersion}`;
        const worker = new Worker(new URL(workerUrl, import.meta.url), { type: "module" });

        function finish(result: TranscodedVideo | undefined) {
            worker.terminate();
            onProgress?.(undefined);
            resolve(result);
        }

        worker.onerror = (ev) => {
            console.warn("VIDEO_TRANSCODE: worker failed, uploading original", ev.message);
            finish(undefined);
        };

        worker.onmessage = (ev: MessageEvent<TranscodeResponse>) => {
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
        const req: TranscodeRequest = { kind: "transcode", file };
        worker.postMessage(req);
    });
}
