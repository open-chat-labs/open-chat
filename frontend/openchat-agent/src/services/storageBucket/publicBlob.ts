import { AnonymousIdentity, HttpAgent, type ActorMethod } from "@icp-sdk/core/agent";
import type { IDL } from "@icp-sdk/core/candid";
import type { PublicBlobMediaKind } from "@shared";

// Leave headroom below the storage bucket's 1.5 MiB response ceiling for Candid/HTTP metadata.
// Range requests do not use the HTTP streaming callback, so this path stays a short sequence of
// ordinary read-only HttpAgent queries and works when a phone cannot resolve `*.raw.localhost`.
export const PUBLIC_BLOB_CHUNK_BYTES = (3 << 19) - 1024;
export const MAX_PUBLIC_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PUBLIC_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_PUBLIC_BLOB_QUERIES = Math.ceil(MAX_PUBLIC_IMAGE_BYTES / PUBLIC_BLOB_CHUNK_BYTES);
export const MAX_PUBLIC_AUDIO_BLOB_QUERIES = Math.ceil(
    MAX_PUBLIC_AUDIO_BYTES / PUBLIC_BLOB_CHUNK_BYTES,
);
export const PUBLIC_BLOB_AGENT_TIMEOUT_MS = 12_000;

const MAX_FILE_ID = (1n << 128n) - 1n;
const RASTER_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
]);
// Browser voice recordings use WebM or MP4; the other accepted voice containers
// remain explicitly bounded. This is not an arbitrary attachment download API.
const AUDIO_MIME_TYPES = new Set([
    "audio/webm",
    "audio/mp4",
    "audio/x-m4a",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
]);

export interface PublicBlobHttpRequest {
    url: string;
    method: string;
    body: Uint8Array | number[];
    headers: Array<[string, string]>;
}

export interface PublicBlobHttpResponse {
    body: Uint8Array | number[];
    headers: Array<[string, string]>;
    upgrade: [] | [boolean];
    status_code: number;
}

export interface PublicBlobHttpService {
    http_request: ActorMethod<[PublicBlobHttpRequest], PublicBlobHttpResponse>;
}

export type PublicBlobQuery = (request: PublicBlobHttpRequest) => Promise<PublicBlobHttpResponse>;

// A deliberately narrow local IDL for the public HTTP query. The canister response also carries an
// optional streaming_strategy field; Candid record width subtyping lets this Range-only client omit
// it, and every accepted 206 response is bounded and assembled locally. Keeping this separate avoids
// hand-editing generated StorageBucket bindings, which would be overwritten on regeneration.
export const publicBlobIdlFactory: IDL.InterfaceFactory = ({ IDL }) => {
    const HttpRequest = IDL.Record({
        url: IDL.Text,
        method: IDL.Text,
        body: IDL.Vec(IDL.Nat8),
        headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    });
    const HttpResponse = IDL.Record({
        body: IDL.Vec(IDL.Nat8),
        headers: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
        upgrade: IDL.Opt(IDL.Bool),
        status_code: IDL.Nat16,
    });
    return IDL.Service({
        http_request: IDL.Func([HttpRequest], [HttpResponse], ["query"]),
    });
};

function deadlineFetch(sourceFetch: typeof fetch, deadline: number): typeof fetch {
    return async (input, init) => {
        if (Date.now() >= deadline) {
            throw new DOMException("Public blob query deadline exceeded", "AbortError");
        }
        const controller = new AbortController();
        const upstreamSignal = init?.signal;
        const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
        if (upstreamSignal?.aborted) {
            abortFromUpstream();
        } else {
            upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
        }
        const timeoutId = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
        let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
        let finished = false;
        function cleanup() {
            finished = true;
            clearTimeout(timeoutId);
            upstreamSignal?.removeEventListener("abort", abortFromUpstream);
            controller.signal.removeEventListener("abort", abortBody);
        }
        function abortBody() {
            if (finished) return;
            cleanup();
            bodyController?.error(controller.signal.reason);
            void bodyReader?.cancel(controller.signal.reason).catch(() => undefined);
        }
        try {
            const response = await sourceFetch(input, { ...init, signal: controller.signal });
            if (controller.signal.aborted) {
                await response.body?.cancel(controller.signal.reason).catch(() => undefined);
                throw controller.signal.reason;
            }
            if (response.body === null) {
                cleanup();
                return response;
            }
            const reader = response.body.getReader();
            bodyReader = reader;
            // Fetch resolves at headers. HttpAgent reads the body afterward, so retain
            // the same absolute deadline through EOF, failure or consumer cancellation.
            const body = new ReadableStream<Uint8Array>({
                start(streamController) {
                    bodyController = streamController;
                    controller.signal.addEventListener("abort", abortBody, { once: true });
                },
                async pull(streamController) {
                    try {
                        const next = await reader.read();
                        if (finished) return;
                        if (next.done) {
                            cleanup();
                            streamController.close();
                        } else {
                            streamController.enqueue(next.value);
                        }
                    } catch (error) {
                        if (!finished) {
                            cleanup();
                            streamController.error(error);
                        }
                    }
                },
                cancel(reason) {
                    cleanup();
                    controller.abort(reason);
                    return reader.cancel(reason);
                },
            });
            return new Response(body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        } catch (error) {
            cleanup();
            void bodyReader?.cancel(error).catch(() => undefined);
            throw error;
        }
    };
}

/**
 * Clone only the transport/network configuration needed for a bounded public query. The selected
 * blob canister is message-controlled, so it must never receive the signed user's principal. The
 * single overall deadline is shared by all chunks and agent retries are disabled.
 */
export function createAnonymousPublicBlobAgent(agent: HttpAgent): HttpAgent {
    const sourceFetch = agent.config.fetch ?? globalThis.fetch;
    return HttpAgent.createSync({
        ...agent.config,
        host: agent.host.toString(),
        identity: new AnonymousIdentity(),
        fetch: deadlineFetch(sourceFetch, Date.now() + PUBLIC_BLOB_AGENT_TIMEOUT_MS),
        retryTimes: 0,
        rootKey: agent.rootKey ?? undefined,
        shouldFetchRootKey: false,
        shouldSyncTime: false,
    });
}

function uniqueHeader(headers: Array<[string, string]>, name: string): string | undefined {
    const values = headers
        .filter(([key]) => key.localeCompare(name, undefined, { sensitivity: "accent" }) === 0)
        .map(([, value]) => value.trim());
    return values.length === 1 && values[0].length > 0 ? values[0] : undefined;
}

function normalizedMediaMimeType(
    value: string | undefined,
    mediaKind: PublicBlobMediaKind,
): string | undefined {
    const mimeType = value?.split(";", 1)[0].trim().toLowerCase();
    const allowed = mediaKind === "audio" ? AUDIO_MIME_TYPES : RASTER_IMAGE_MIME_TYPES;
    return mimeType !== undefined && allowed.has(mimeType) ? mimeType : undefined;
}

type ParsedContentRange = { start: number; end: number; total: number };

function parseContentRange(value: string | undefined): ParsedContentRange | undefined {
    const match = /^bytes (0|[1-9]\d*)-(0|[1-9]\d*)\/(0|[1-9]\d*)$/.exec(value ?? "");
    if (match === null) return undefined;
    const [start, end, total] = match.slice(1).map(Number);
    if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        !Number.isSafeInteger(total) ||
        start < 0 ||
        end < start ||
        total < 1 ||
        end >= total
    ) {
        return undefined;
    }
    return { start, end, total };
}

function validCap(maxBytes: number, limit: number): boolean {
    return Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= limit;
}

/**
 * Download one public StorageBucket raster image through anonymous HttpAgent query plumbing.
 * Failure is intentionally collapsed to `undefined`: this is an optional fallback for a locally
 * unreadable blob URL, never an authorization or mutation API.
 */
export async function downloadPublicImageBlob(
    fileId: bigint,
    maxBytes: number,
    query: PublicBlobQuery,
): Promise<Uint8Array | undefined> {
    return downloadPublicMediaBlob(fileId, maxBytes, query, "image");
}

export async function downloadPublicAudioBlob(
    fileId: bigint,
    maxBytes: number,
    query: PublicBlobQuery,
): Promise<Uint8Array | undefined> {
    return downloadPublicMediaBlob(fileId, maxBytes, query, "audio");
}

/**
 * Read one explicit media kind through the same anonymous, bounded Range path.
 * Omission retains the image-only policy; even untyped/older worker callers must
 * not turn an unknown kind into a permissive attachment download.
 */
export async function downloadPublicMediaBlob(
    fileId: bigint,
    maxBytes: number,
    query: PublicBlobQuery,
    mediaKind: PublicBlobMediaKind = "image",
): Promise<Uint8Array | undefined> {
    if (mediaKind !== "image" && mediaKind !== "audio") return undefined;
    const limit = mediaKind === "audio" ? MAX_PUBLIC_AUDIO_BYTES : MAX_PUBLIC_IMAGE_BYTES;
    const maxQueries =
        mediaKind === "audio" ? MAX_PUBLIC_AUDIO_BLOB_QUERIES : MAX_PUBLIC_BLOB_QUERIES;
    if (fileId < 0n || fileId > MAX_FILE_ID || !validCap(maxBytes, limit)) return undefined;

    let expectedTotal: number | undefined;
    let expectedMimeType: string | undefined;
    let output: Uint8Array | undefined;
    let offset = 0;
    let queryCount = 0;

    do {
        queryCount += 1;
        if (queryCount > maxQueries) return undefined;
        const request: PublicBlobHttpRequest = {
            url: `/blobs/${fileId}`,
            method: "GET",
            body: new Uint8Array(),
            // The storage bucket interprets the second value as an exclusive limit and reports the
            // conventional inclusive end in Content-Range.
            headers: [["Range", `bytes=${offset}-${offset + PUBLIC_BLOB_CHUNK_BYTES}`]],
        };
        const response = await query(request);
        if (response.status_code !== 206) return undefined;

        const bytes =
            response.body instanceof Uint8Array ? response.body : new Uint8Array(response.body);
        const range = parseContentRange(uniqueHeader(response.headers, "Content-Range"));
        const contentLength = uniqueHeader(response.headers, "Content-Length");
        const mimeType = normalizedMediaMimeType(
            uniqueHeader(response.headers, "Content-Type"),
            mediaKind,
        );
        if (
            range === undefined ||
            range.start !== offset ||
            range.end !== offset + bytes.byteLength - 1 ||
            bytes.byteLength !== Math.min(PUBLIC_BLOB_CHUNK_BYTES, range.total - offset) ||
            contentLength === undefined ||
            !/^\d+$/.test(contentLength) ||
            Number(contentLength) !== bytes.byteLength ||
            mimeType === undefined
        ) {
            return undefined;
        }

        if (expectedTotal === undefined) {
            if (range.total > maxBytes) return undefined;
            expectedTotal = range.total;
            expectedMimeType = mimeType;
            output = new Uint8Array(expectedTotal);
        } else if (range.total !== expectedTotal || mimeType !== expectedMimeType) {
            return undefined;
        }

        if (output === undefined || offset + bytes.byteLength > output.byteLength) return undefined;
        output.set(bytes, offset);
        offset += bytes.byteLength;
    } while (expectedTotal !== undefined && offset < expectedTotal);

    return output !== undefined &&
        offset === output.byteLength &&
        expectedMimeType !== undefined &&
        (mediaKind === "audio"
            ? audioSignatureMatches(output, expectedMimeType)
            : imageSignatureMatches(output, expectedMimeType))
        ? output
        : undefined;
}

// Recognize the advertised container, not a decoded audio stream. The caller's
// encoded-byte/duration limits and the decoder's sample/duration limits still apply.
function audioSignatureMatches(bytes: Uint8Array, mimeType: string): boolean {
    switch (mimeType) {
        case "audio/webm":
            return bytesEqual(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
        case "audio/ogg":
            return bytes.byteLength >= 27 && bytesEqual(bytes, [0x4f, 0x67, 0x67, 0x53, 0]);
        case "audio/wav":
        case "audio/x-wav":
            return (
                bytesEqual(bytes, [0x52, 0x49, 0x46, 0x46]) &&
                bytesEqual(bytes, [0x57, 0x41, 0x56, 0x45], 8)
            );
        case "audio/mp4":
        case "audio/x-m4a": {
            if (bytes.byteLength < 16 || !bytesEqual(bytes, [0x66, 0x74, 0x79, 0x70], 4))
                return false;
            const boxLength = new DataView(
                bytes.buffer,
                bytes.byteOffset,
                bytes.byteLength,
            ).getUint32(0);
            if (boxLength < 16 || boxLength > bytes.byteLength || boxLength % 4 !== 0) return false;
            const brands = ["isom", "iso2", "mp41", "mp42", "M4A ", "M4B "];
            for (let offset = 8; offset + 4 <= Math.min(boxLength, 4096); offset += 4) {
                if (offset === 12) continue; // minor version, not a compatible brand
                const brand = String.fromCharCode(...bytes.subarray(offset, offset + 4));
                if (brands.includes(brand)) return true;
            }
            return false;
        }
        default:
            return false;
    }
}

function bytesEqual(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
    return (
        bytes.byteLength >= offset + expected.length &&
        expected.every((value, index) => bytes[offset + index] === value)
    );
}

function imageSignatureMatches(bytes: Uint8Array, mimeType: string): boolean {
    switch (mimeType) {
        case "image/jpeg":
            return bytesEqual(bytes, [0xff, 0xd8, 0xff]);
        case "image/png":
            return bytesEqual(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case "image/webp":
            return (
                bytesEqual(bytes, [0x52, 0x49, 0x46, 0x46]) &&
                bytesEqual(bytes, [0x57, 0x45, 0x42, 0x50], 8)
            );
        case "image/gif":
            return (
                bytesEqual(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
                bytesEqual(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
            );
        case "image/bmp":
            return bytesEqual(bytes, [0x42, 0x4d]);
        default:
            return false;
    }
}
