import { Actor, HttpAgent } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import type { PublicBlobMediaKind } from "@shared";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageBucketClient } from "./storageBucket.client";
import {
    MAX_PUBLIC_AUDIO_BYTES,
    MAX_PUBLIC_AUDIO_BLOB_QUERIES,
    MAX_PUBLIC_BLOB_QUERIES,
    MAX_PUBLIC_IMAGE_BYTES,
    PUBLIC_BLOB_AGENT_TIMEOUT_MS,
    PUBLIC_BLOB_CHUNK_BYTES,
    createAnonymousPublicBlobAgent,
    downloadPublicAudioBlob,
    downloadPublicImageBlob,
    downloadPublicMediaBlob,
    publicBlobIdlFactory,
    type PublicBlobHttpRequest,
    type PublicBlobHttpResponse,
} from "./publicBlob";

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

const PNG_MIME = "image/png";

function response(
    body: Uint8Array,
    start: number,
    total: number,
    mimeType = PNG_MIME,
): PublicBlobHttpResponse {
    return {
        status_code: 206,
        body,
        headers: [
            ["Content-Type", mimeType],
            ["Content-Length", body.byteLength.toString()],
            ["Content-Range", `bytes ${start}-${start + body.byteLength - 1}/${total}`],
        ],
        upgrade: [],
    };
}

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

describe("downloadPublicImageBlob", () => {
    it("reads a public image in bounded Range queries", async () => {
        const total = PUBLIC_BLOB_CHUNK_BYTES + 3;
        const first = new Uint8Array(PUBLIC_BLOB_CHUNK_BYTES);
        first.set(PNG_BYTES);
        const second = new Uint8Array([8, 9, 10]);
        const query = vi
            .fn<(request: PublicBlobHttpRequest) => Promise<PublicBlobHttpResponse>>()
            .mockResolvedValueOnce(response(first, 0, total))
            .mockResolvedValueOnce(response(second, first.byteLength, total));

        const bytes = await downloadPublicImageBlob(42n, total, query);

        expect(bytes).toHaveLength(total);
        expect(bytes?.slice(-3)).toEqual(second);
        expect(query).toHaveBeenNthCalledWith(1, {
            url: "/blobs/42",
            method: "GET",
            body: new Uint8Array(),
            headers: [["Range", `bytes=0-${PUBLIC_BLOB_CHUNK_BYTES}`]],
        });
        expect(query).toHaveBeenNthCalledWith(2, {
            url: "/blobs/42",
            method: "GET",
            body: new Uint8Array(),
            headers: [["Range", `bytes=${PUBLIC_BLOB_CHUNK_BYTES}-${PUBLIC_BLOB_CHUNK_BYTES * 2}`]],
        });
    });

    it("rejects a blob before allocation when the declared total exceeds the caller cap", async () => {
        const query = vi.fn(async () => response(PNG_BYTES, 0, MAX_PUBLIC_IMAGE_BYTES + 1));

        await expect(
            downloadPublicImageBlob(1n, MAX_PUBLIC_IMAGE_BYTES, query),
        ).resolves.toBeUndefined();
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("rejects undersized non-final chunks instead of making attacker-sized query loops", async () => {
        expect(MAX_PUBLIC_BLOB_QUERIES).toBe(4);
        const query = vi.fn(async () => response(PNG_BYTES, 0, MAX_PUBLIC_IMAGE_BYTES));

        await expect(
            downloadPublicImageBlob(1n, MAX_PUBLIC_IMAGE_BYTES, query),
        ).resolves.toBeUndefined();
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("rejects non-raster MIME types", async () => {
        const query = vi.fn(async () =>
            response(PNG_BYTES, 0, PNG_BYTES.byteLength, "image/svg+xml"),
        );

        await expect(downloadPublicImageBlob(1n, 1024, query)).resolves.toBeUndefined();
    });

    it("rejects malformed or discontinuous Content-Range responses", async () => {
        const query = vi.fn(
            async (): Promise<PublicBlobHttpResponse> => ({
                ...response(PNG_BYTES, 0, PNG_BYTES.byteLength),
                headers: [
                    ["Content-Type", PNG_MIME],
                    ["Content-Length", PNG_BYTES.byteLength.toString()],
                    ["Content-Range", `bytes 1-${PNG_BYTES.byteLength}/${PNG_BYTES.byteLength}`],
                ],
            }),
        );

        await expect(downloadPublicImageBlob(1n, 1024, query)).resolves.toBeUndefined();
    });

    it("rejects invalid caller caps without making a query", async () => {
        const query = vi.fn(async () => response(PNG_BYTES, 0, PNG_BYTES.byteLength));

        await expect(downloadPublicImageBlob(1n, 0, query)).resolves.toBeUndefined();
        await expect(
            downloadPublicImageBlob(1n, MAX_PUBLIC_IMAGE_BYTES + 1, query),
        ).resolves.toBeUndefined();
        expect(query).not.toHaveBeenCalled();
    });

    it("rejects sender-controlled MIME metadata that does not match the file signature", async () => {
        const query = vi.fn(async () => response(new Uint8Array(16).fill(1), 0, 16));

        await expect(downloadPublicImageBlob(1n, 1024, query)).resolves.toBeUndefined();
    });

    it("uses an anonymous no-retry agent for sender-selected public canisters", async () => {
        const source = HttpAgent.createSync({
            host: "http://127.0.0.1:4943",
            identity: Ed25519KeyIdentity.generate(new Uint8Array(32).fill(7)),
            verifyQuerySignatures: false,
        });
        const publicAgent = createAnonymousPublicBlobAgent(source);

        expect((await source.getPrincipal()).toText()).not.toBe("2vxsx-fae");
        expect((await publicAgent.getPrincipal()).toText()).toBe("2vxsx-fae");
        expect(publicAgent.config.retryTimes).toBe(0);
    });
});

const WEBM_BYTES = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
]);
const MP4_BYTES = new Uint8Array([
    0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x6d, 0x70, 0x34, 0x32,
]);
const OGG_BYTES = new Uint8Array(27);
OGG_BYTES.set([0x4f, 0x67, 0x67, 0x53, 0]);
const WAV_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

function rangeQuery(bytes: Uint8Array, mimeType: string) {
    return vi.fn(async (request: PublicBlobHttpRequest) => {
        const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers[0][1]);
        expect(range).not.toBeNull();
        const start = Number(range![1]);
        return response(bytes.slice(start, Number(range![2])), start, bytes.length, mimeType);
    });
}

function publicStorageClient(
    query: (request: PublicBlobHttpRequest) => Promise<PublicBlobHttpResponse>,
) {
    const identity = Ed25519KeyIdentity.generate(new Uint8Array(32).fill(7));
    const source = HttpAgent.createSync({
        host: "http://127.0.0.1:4943",
        identity,
        verifyQuerySignatures: false,
    });
    let anonymousAgent: HttpAgent | undefined;
    vi.spyOn(Actor, "createActor").mockImplementation((factory, options) => {
        if (factory === publicBlobIdlFactory) {
            anonymousAgent = options.agent as HttpAgent;
            return { http_request: query } as never;
        }
        return {} as never;
    });
    const client = new StorageBucketClient(identity, source, "ucwa4-rx777-77774-qaada-cai");
    return { client, anonymousAgent, source };
}

describe("explicit bounded public audio", () => {
    it.each([
        ["audio/webm;codecs=opus", WEBM_BYTES],
        ["audio/mp4", MP4_BYTES],
        ["audio/x-m4a", MP4_BYTES],
        ["audio/ogg", OGG_BYTES],
        ["audio/wav", WAV_BYTES],
        ["audio/x-wav", WAV_BYTES],
    ])("accepts the recognized %s voice container", async (mimeType, bytes) => {
        const query = rangeQuery(bytes, mimeType);
        await expect(downloadPublicAudioBlob(55n, MAX_PUBLIC_AUDIO_BYTES, query)).resolves.toEqual(
            bytes,
        );
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("keeps omission image-only and rejects unknown kinds before any query", async () => {
        const query = rangeQuery(WEBM_BYTES, "audio/webm");
        for (const kind of ["video", "file", null, 1] as unknown as PublicBlobMediaKind[]) {
            await expect(downloadPublicMediaBlob(55n, 1024, query, kind)).resolves.toBeUndefined();
        }
        expect(query).not.toHaveBeenCalled();
        await expect(downloadPublicMediaBlob(55n, 1024, query)).resolves.toBeUndefined();
        expect(query).toHaveBeenCalledTimes(1);
        await expect(
            downloadPublicMediaBlob(55n, MAX_PUBLIC_AUDIO_BYTES, query),
        ).resolves.toBeUndefined();
        expect(query).toHaveBeenCalledTimes(1);
        const image = rangeQuery(PNG_BYTES, PNG_MIME);
        await expect(downloadPublicMediaBlob(55n, MAX_PUBLIC_IMAGE_BYTES, image)).resolves.toEqual(
            PNG_BYTES,
        );
        await expect(
            downloadPublicMediaBlob(55n, MAX_PUBLIC_IMAGE_BYTES, image, "audio"),
        ).resolves.toBeUndefined();
    });

    it("accepts exactly 10 MiB in seven bounded queries and rejects over-limit caps without a query", async () => {
        const bytes = new Uint8Array(MAX_PUBLIC_AUDIO_BYTES);
        bytes.set(WEBM_BYTES);
        const query = rangeQuery(bytes, "audio/webm");
        expect(MAX_PUBLIC_AUDIO_BLOB_QUERIES).toBe(7);
        const downloaded = await downloadPublicAudioBlob(55n, MAX_PUBLIC_AUDIO_BYTES, query);
        expect(downloaded).toHaveLength(bytes.length);
        expect(Buffer.compare(Buffer.from(downloaded!), Buffer.from(bytes))).toBe(0);
        expect(query).toHaveBeenCalledTimes(7);
        query.mockClear();
        for (const cap of [
            0,
            -1,
            1.5,
            Number.NaN,
            Number.POSITIVE_INFINITY,
            MAX_PUBLIC_AUDIO_BYTES + 1,
        ]) {
            await expect(downloadPublicAudioBlob(55n, cap, query)).resolves.toBeUndefined();
        }
        expect(query).not.toHaveBeenCalled();
    });

    it("rejects an over-cap declared audio total before requesting more chunks", async () => {
        const first = new Uint8Array(PUBLIC_BLOB_CHUNK_BYTES);
        first.set(WEBM_BYTES);
        const query = vi.fn(async () =>
            response(first, 0, MAX_PUBLIC_AUDIO_BYTES + 1, "audio/webm"),
        );
        await expect(
            downloadPublicAudioBlob(55n, MAX_PUBLIC_AUDIO_BYTES, query),
        ).resolves.toBeUndefined();
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("rejects unsupported MIME, non-audio content and mismatched container signatures", async () => {
        for (const mimeType of [
            "application/octet-stream",
            "text/html",
            "video/webm",
            "audio/unknown",
            PNG_MIME,
        ]) {
            await expect(
                downloadPublicAudioBlob(55n, 1024, rangeQuery(WEBM_BYTES, mimeType)),
            ).resolves.toBeUndefined();
        }
        for (const mimeType of ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"]) {
            await expect(
                downloadPublicAudioBlob(55n, 1024, rangeQuery(PNG_BYTES, mimeType)),
            ).resolves.toBeUndefined();
        }
        const invalidBox = MP4_BYTES.slice();
        invalidBox[3] = 24;
        await expect(
            downloadPublicAudioBlob(55n, 1024, rangeQuery(invalidBox, "audio/mp4")),
        ).resolves.toBeUndefined();
        const imageBrand = MP4_BYTES.slice();
        imageBrand.set([0x61, 0x76, 0x69, 0x66], 8);
        imageBrand.set([0x61, 0x76, 0x69, 0x66], 16);
        await expect(
            downloadPublicAudioBlob(55n, 1024, rangeQuery(imageBrand, "audio/mp4")),
        ).resolves.toBeUndefined();
    });

    it("retains range size, continuity, total and MIME consistency checks for audio", async () => {
        const first = new Uint8Array(PUBLIC_BLOB_CHUNK_BYTES);
        first.set(WEBM_BYTES);
        const total = first.length + 3;
        for (const second of [
            response(new Uint8Array(3), first.length + 1, total + 1, "audio/webm"),
            response(new Uint8Array(4), first.length, total + 1, "audio/webm"),
            response(new Uint8Array(3), first.length, total, "audio/ogg"),
            { ...response(new Uint8Array(3), first.length, total, "audio/webm"), status_code: 200 },
        ]) {
            const query = vi
                .fn()
                .mockResolvedValueOnce(response(first, 0, total, "audio/webm"))
                .mockResolvedValueOnce(second);
            await expect(
                downloadPublicAudioBlob(55n, MAX_PUBLIC_AUDIO_BYTES, query),
            ).resolves.toBeUndefined();
            expect(query).toHaveBeenCalledTimes(2);
        }
        const undersized = vi.fn(async () => response(WEBM_BYTES, 0, total, "audio/webm"));
        await expect(
            downloadPublicAudioBlob(55n, MAX_PUBLIC_AUDIO_BYTES, undersized),
        ).resolves.toBeUndefined();
        expect(undersized).toHaveBeenCalledTimes(1);
        const duplicateHeader = response(WEBM_BYTES, 0, WEBM_BYTES.length, "audio/webm");
        duplicateHeader.headers.push(["content-type", "audio/webm"]);
        await expect(
            downloadPublicAudioBlob(
                55n,
                1024,
                vi.fn(async () => duplicateHeader),
            ),
        ).resolves.toBeUndefined();
    });

    it("does not retry rejected public Range queries through the authenticated wrapper", async () => {
        vi.useFakeTimers();
        const failure = new Error("public Range unavailable");
        const query = vi.fn().mockRejectedValue(failure);
        const { client } = publicStorageClient(query);
        const result = client.downloadPublicBlob(55n, MAX_PUBLIC_AUDIO_BYTES, "audio");
        const assertion = expect(result).rejects.toBe(failure);
        await vi.runAllTimersAsync();
        await assertion;
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("shares the original 12s transport deadline across requests rather than resetting it", async () => {
        vi.useFakeTimers();
        const sourceFetch = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(new Uint8Array([1])))
            .mockImplementationOnce(
                (_input, init) =>
                    new Promise((_resolve, reject) => {
                        init?.signal?.addEventListener(
                            "abort",
                            () => reject(new Error("deadline reached")),
                            { once: true },
                        );
                    }),
            );
        const source = HttpAgent.createSync({ host: "http://127.0.0.1:4943", fetch: sourceFetch });
        const boundedFetch = createAnonymousPublicBlobAgent(source).config.fetch!;
        const initial = await boundedFetch("http://127.0.0.1:4943");
        await initial.arrayBuffer();
        await vi.advanceTimersByTimeAsync(8000);
        const pending = boundedFetch("http://127.0.0.1:4943");
        const assertion = expect(pending).rejects.toThrow("deadline reached");
        await vi.advanceTimersByTimeAsync(PUBLIC_BLOB_AGENT_TIMEOUT_MS - 8000);
        await assertion;
        expect(sourceFetch).toHaveBeenCalledTimes(2);
    });

    it("keeps the deadline after response headers until a stalled HTTP body is aborted", async () => {
        vi.useFakeTimers();
        const cancel = vi.fn();
        const sourceFetch = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                new ReadableStream({
                    start(controller) {
                        controller.enqueue(new Uint8Array([1]));
                    },
                    cancel,
                }),
            ),
        );
        const source = HttpAgent.createSync({ host: "http://127.0.0.1:4943", fetch: sourceFetch });
        const boundedFetch = createAnonymousPublicBlobAgent(source).config.fetch!;
        const response = await boundedFetch("http://127.0.0.1:4943");
        expect(vi.getTimerCount()).toBe(1);
        const reading = response.arrayBuffer();
        const assertion = expect(reading).rejects.toMatchObject({ name: "AbortError" });
        await vi.advanceTimersByTimeAsync(PUBLIC_BLOB_AGENT_TIMEOUT_MS);
        await assertion;
        expect(sourceFetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("cleans up the HTTP body deadline at EOF and on consumer cancellation", async () => {
        vi.useFakeTimers();
        const sourceFetch = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
        const source = HttpAgent.createSync({ host: "http://127.0.0.1:4943", fetch: sourceFetch });
        const boundedFetch = createAnonymousPublicBlobAgent(source).config.fetch!;
        const complete = await boundedFetch("http://127.0.0.1:4943");
        expect(new Uint8Array(await complete.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
        expect(vi.getTimerCount()).toBe(0);

        const cancel = vi.fn();
        sourceFetch.mockResolvedValueOnce(new Response(new ReadableStream({ cancel })));
        const unfinished = await boundedFetch("http://127.0.0.1:4943");
        await unfinished.body!.cancel("consumer stopped");
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(sourceFetch.mock.calls[1][1]?.signal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("does not start another HTTP request once the shared deadline has expired", async () => {
        vi.useFakeTimers();
        const sourceFetch = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(new Uint8Array([1])));
        const source = HttpAgent.createSync({ host: "http://127.0.0.1:4943", fetch: sourceFetch });
        const boundedFetch = createAnonymousPublicBlobAgent(source).config.fetch!;
        const response = await boundedFetch("http://127.0.0.1:4943");
        await response.arrayBuffer();
        await vi.advanceTimersByTimeAsync(PUBLIC_BLOB_AGENT_TIMEOUT_MS);
        await expect(boundedFetch("http://127.0.0.1:4943")).rejects.toMatchObject({
            name: "AbortError",
        });
        expect(sourceFetch).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("carries the explicit media kind through all client and worker forwarding boundaries", () => {
        const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
        expect(source("../../../../openchat-client/src/openchat.ts")).toMatch(
            /send\(\{ kind: "downloadPublicBlob", ref, maxBytes, mediaKind \}\)/,
        );
        expect(source("../../../../openchat-worker/src/worker.ts")).toMatch(
            /downloadPublicBlob\(payload\.ref, payload\.maxBytes, payload\.mediaKind\)/,
        );
        expect(source("../openchatAgent.ts")).toMatch(
            /downloadPublicBlob\(ref\.blobId, maxBytes, mediaKind\)/,
        );
        expect(source("../../../../openchat-shared/src/domain/worker.ts")).toContain(
            "mediaKind?: PublicBlobMediaKind",
        );
    });
});
