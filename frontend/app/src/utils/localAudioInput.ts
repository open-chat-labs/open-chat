import type { BlobReference, MessageContent } from "@client";
import { isExactConfiguredLocalStorageBlob } from "./configuredLocalBlobUrl";
import type { ImagePageLocation, PublicBlobLoader } from "./localImageInput";

// Voice input is intentionally narrower than the generic chat attachment limit. Loading stays
// bounded before an optional speech add-on sees any bytes, which prevents a long/corrupt attachment
// from allocating unbounded memory in the WebView.
export const MAX_LOCAL_AI_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_LOCAL_AI_AUDIO_DURATION_MS = 30_000n;
const AUDIO_FETCH_TIMEOUT_MS = 8_000;
export const AGENT_AUDIO_FETCH_TIMEOUT_MS = 15_000;
const MAX_AUDIO_MIME_CHARS = 128;
const AUDIO_MIME =
    /^audio\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;\s*[a-z0-9!#$&^_.+-]+=(?:"[^"\r\n]{1,64}"|[a-z0-9!#$&^_.+-]+))*$/i;

export type LocalAudioInput = {
    audio: Uint8Array;
    audioMimeType: string;
};

function normalizedAudioMimeType(value: string): string | undefined {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 &&
        normalized.length <= MAX_AUDIO_MIME_CHARS &&
        AUDIO_MIME.test(normalized)
        ? normalized
        : undefined;
}

function safeAudioBytes(bytes: Uint8Array | undefined): Uint8Array | undefined {
    return bytes !== undefined &&
        bytes.byteLength > 0 &&
        bytes.byteLength <= MAX_LOCAL_AI_AUDIO_BYTES
        ? bytes
        : undefined;
}

function isLoopback(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function remoteHttpsCannotFetchLocalBlob(
    url: string,
    page: ImagePageLocation | undefined,
    content: Extract<MessageContent, { kind: "audio_content" }>,
    blobUrlPattern: string | undefined,
): boolean {
    return (
        page?.protocol === "https:" &&
        !isLoopback(page.hostname) &&
        isExactConfiguredLocalStorageBlob(url, content.blobReference, blobUrlPattern)
    );
}

async function fetchBoundedAudio(url: string): Promise<Uint8Array | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return undefined;
        const contentLength = response.headers.get("Content-Length");
        if (
            contentLength !== null &&
            (/^\d+$/.test(contentLength) === false ||
                Number(contentLength) > MAX_LOCAL_AI_AUDIO_BYTES)
        ) {
            return undefined;
        }
        const reader = response.body?.getReader();
        if (reader === undefined) return undefined;
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value === undefined || value.byteLength === 0) continue;
            total += value.byteLength;
            if (total > MAX_LOCAL_AI_AUDIO_BYTES) {
                controller.abort();
                await reader.cancel().catch(() => undefined);
                return undefined;
            }
            chunks.push(value);
        }
        if (total === 0) return undefined;
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return bytes;
    } catch {
        return undefined;
    } finally {
        // Early header/status rejection must also cancel an unread network response body.
        controller.abort();
        clearTimeout(timeout);
    }
}

async function loadReferencedAudio(
    loader: PublicBlobLoader,
    ref: BlobReference,
): Promise<Uint8Array | undefined> {
    let cancelTimeout: (() => void) | undefined;
    try {
        const timeout = new Promise<undefined>((resolve) => {
            const timeoutId = setTimeout(resolve, AGENT_AUDIO_FETCH_TIMEOUT_MS);
            cancelTimeout = () => clearTimeout(timeoutId);
        });
        return safeAudioBytes(await Promise.race([loader(ref, MAX_LOCAL_AI_AUDIO_BYTES), timeout]));
    } catch {
        return undefined;
    } finally {
        cancelTimeout?.();
    }
}

/** Resolve one encoded voice message without broadening the configured blob-origin boundary. */
export async function localAudioInput(
    content: MessageContent,
    loadPublicBlob?: PublicBlobLoader,
    page: ImagePageLocation | undefined = typeof window === "undefined"
        ? undefined
        : window.location,
    blobUrlPattern: string | undefined = import.meta.env.OC_BLOB_URL_PATTERN,
): Promise<LocalAudioInput | undefined> {
    if (content.kind !== "audio_content") return undefined;
    const audioMimeType = normalizedAudioMimeType(content.mimeType);
    if (
        audioMimeType === undefined ||
        content.durationMs <= 0n ||
        content.durationMs > MAX_LOCAL_AI_AUDIO_DURATION_MS
    ) {
        return undefined;
    }

    const inMemory = safeAudioBytes(content.blobData);
    if (inMemory !== undefined) return { audio: inMemory, audioMimeType };

    if (
        content.blobUrl !== undefined &&
        !remoteHttpsCannotFetchLocalBlob(content.blobUrl, page, content, blobUrlPattern)
    ) {
        const fetched = await fetchBoundedAudio(content.blobUrl);
        if (fetched !== undefined) return { audio: fetched, audioMimeType };
    }

    if (content.blobReference !== undefined && loadPublicBlob !== undefined) {
        const referenced = await loadReferencedAudio(loadPublicBlob, content.blobReference);
        if (referenced !== undefined) return { audio: referenced, audioMimeType };
    }
    return undefined;
}
