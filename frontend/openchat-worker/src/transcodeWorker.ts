// Client-side video transcode worker (issue #9252).
//
// Re-encodes the video track of an uploaded clip to H.264 (avc1), max 720p,
// ~2 Mbps, keyframe every 2s, using WebCodecs via mediabunny. Audio is copied
// through untouched whenever the output container can carry it (AAC in
// practically every phone recording). The output is written with the moov box
// first ("faststart") so range-served playback can begin before the whole
// file has arrived.
//
// Anything we can't handle — no WebCodecs, an undecodable source, an audio
// track we would have to drop — reports back so the main thread uploads the
// original bytes exactly as before. This path is purely additive.
import {
    BlobSource,
    BufferTarget,
    canEncodeVideo,
    Conversion,
    Input,
    MATROSKA,
    MP4,
    Mp4OutputFormat,
    Output,
    QTFF,
    Quality,
    WEBM,
} from "mediabunny";
import { sha3_256 } from "js-sha3";

// Only the containers a browser will hand us; ALL_FORMATS drags in mp3/ogg/
// wav/flac/mpeg-ts/hls demuxers too and roughly doubles the bundle.
const INPUT_FORMATS = [MP4, QTFF, WEBM, MATROSKA];

export type TranscodeRequest = {
    kind: "transcode";
    file: Blob;
};

export type TranscodeResponse =
    | { kind: "progress"; value: number }
    // sourceHash: SHA3-256 of the original bytes, the same hash the storage bucket keys blobs
    // by, so a transcoded upload can still be checked against blocks recorded on the original
    | { kind: "done"; buffer: ArrayBuffer; mimeType: string; sourceHash: Uint8Array }
    // Source already meets the target; upload the original bytes.
    | { kind: "skipped"; reason: string }
    // We can't (or shouldn't) transcode in this environment; upload the original bytes.
    | { kind: "unsupported"; reason: string }
    | { kind: "error"; message: string };

const TARGET_SHORT_SIDE = 720;
const TARGET_LONG_SIDE = 1280;
const TARGET_BITRATE = 2_000_000;
// Sources a little over the target are not worth a lossy generation.
const BITRATE_TOLERANCE = 1.25;
const KEYFRAME_INTERVAL_SECS = 2;
const TARGET_QUALITY = new Quality({ bitrate: TARGET_BITRATE });

function post(msg: TranscodeResponse, transfer?: Transferable[]) {
    (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

// SHA3-256 over the blob in slices: the source is only bounded by what the
// user picked, so it is never pulled into memory whole just to be hashed.
async function hashBlob(blob: Blob): Promise<Uint8Array> {
    const SLICE = 8 * 1024 * 1024;
    const hasher = sha3_256.create();
    for (let offset = 0; offset < blob.size; offset += SLICE) {
        hasher.update(await blob.slice(offset, offset + SLICE).arrayBuffer());
    }
    return new Uint8Array(hasher.arrayBuffer());
}

function fitTo(width: number, height: number): { width: number; height: number } {
    const landscape = width >= height;
    const maxW = landscape ? TARGET_LONG_SIDE : TARGET_SHORT_SIDE;
    const maxH = landscape ? TARGET_SHORT_SIDE : TARGET_LONG_SIDE;
    const scale = Math.min(1, maxW / width, maxH / height);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function transcode(file: Blob): Promise<void> {
    if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
        return post({ kind: "unsupported", reason: "no WebCodecs" });
    }

    const input = new Input({ source: new BlobSource(file), formats: INPUT_FORMATS });
    try {
        const track = await input.getPrimaryVideoTrack();
        if (track === null) {
            return post({ kind: "unsupported", reason: "no video track" });
        }

        const codec = await track.getCodec();
        const duration = await input.computeDuration();
        const bitrate = duration > 0 ? (file.size * 8) / duration : Infinity;
        const { displayWidth, displayHeight } = track;
        const target = fitTo(displayWidth, displayHeight);
        const alreadySmall = target.width === displayWidth && target.height === displayHeight;

        if (codec === "avc" && alreadySmall && bitrate <= TARGET_BITRATE * BITRATE_TOLERANCE) {
            return post({
                kind: "skipped",
                reason: `already avc ${displayWidth}x${displayHeight} @ ${Math.round(bitrate / 1000)}kbps`,
            });
        }

        if (!(await track.canDecode())) {
            return post({ kind: "unsupported", reason: `cannot decode ${codec}` });
        }
        if (!(await canEncodeVideo("avc", { ...target, quality: TARGET_QUALITY }))) {
            return post({ kind: "unsupported", reason: "cannot encode avc" });
        }

        const output = new Output({
            format: new Mp4OutputFormat({ fastStart: "in-memory" }),
            target: new BufferTarget(),
        });

        // AAC encoder priming leaves many files with audio starting slightly
        // before 0. mediabunny's default trim start of 0 would then force an
        // audio re-encode (or, without AudioEncoder, drop the track); anchoring
        // the trim at the real first timestamp keeps the packets copied verbatim.
        const firstTimestamp = await input.getFirstTimestamp();

        const conversion = await Conversion.init({
            input,
            output,
            tracks: "primary",
            trim: firstTimestamp < 0 ? { start: firstTimestamp } : undefined,
            video: {
                codec: "avc",
                width: target.width,
                height: target.height,
                fit: "contain",
                quality: TARGET_QUALITY,
                keyFrameInterval: KEYFRAME_INTERVAL_SECS,
                // Phone clips carry their rotation in the track matrix; keep
                // it as metadata rather than baking a rotate into every frame.
                allowRotationMetadata: true,
            },
            // No audio options: mediabunny copies the encoded packets through
            // when the codec fits an MP4, and only re-encodes otherwise.
            showWarnings: false,
        });

        // Losing a track the user recorded is worse than a big file.
        const dropped = conversion.discardedTracks.find((t) => t.reason !== "discarded_by_user");
        if (dropped !== undefined || !conversion.isValid) {
            return post({
                kind: "unsupported",
                reason: `would drop ${dropped?.track.type ?? "?"} track (${dropped?.reason ?? "invalid"})`,
            });
        }

        let lastReported = -1;
        conversion.onProgress = (p) => {
            const pct = Math.floor(p * 100);
            if (pct !== lastReported) {
                lastReported = pct;
                post({ kind: "progress", value: p });
            }
        };

        await conversion.execute();

        const buffer = output.target.buffer;
        if (buffer === null) {
            return post({ kind: "error", message: "conversion produced no output" });
        }
        if (buffer.byteLength >= file.size) {
            return post({ kind: "skipped", reason: "output not smaller than source" });
        }
        const sourceHash = await hashBlob(file);
        post({ kind: "done", buffer, mimeType: "video/mp4", sourceHash }, [buffer]);
    } finally {
        input.dispose();
    }
}

self.onmessage = (ev: MessageEvent<TranscodeRequest>) => {
    if (ev.data?.kind !== "transcode") return;
    transcode(ev.data.file).catch((err) => {
        post({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    });
};
