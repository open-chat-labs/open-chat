import type { BlobReference, MessageContent } from "@client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    AGENT_IMAGE_FETCH_TIMEOUT_MS,
    localImageBytes,
    MAX_AI_IMAGE_DOWNLOAD_BYTES,
} from "./localImageInput";

const REF: BlobReference = {
    canisterId: "ucwa4-rx777-77774-qaada-cai",
    blobId: 42n,
};
const LOCAL_URL = `http://${REF.canisterId}.raw.localhost:8080/blobs/${REF.blobId}`;
const LOCAL_PATTERN = "http://{canisterId}.raw.localhost:8080/{blobType}";
const NON_DEFAULT_PORT_PATTERN = "http://{canisterId}.raw.localhost:4943/{blobType}";

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function image(extra: Record<string, unknown>): MessageContent {
    return { kind: "image_content", mimeType: "image/png", ...extra } as unknown as MessageContent;
}

describe("localImageBytes", () => {
    it.each(["non-ok", "oversized-length", "invalid-length", "bodyless"] as const)(
        "aborts the fetch without consuming an early rejected %s response",
        async (reason) => {
            const response = new Response(reason === "bodyless" ? null : new Uint8Array([1]), {
                status: reason === "non-ok" ? 404 : reason === "bodyless" ? 204 : 200,
                headers: {
                    "Content-Length":
                        reason === "oversized-length"
                            ? String(MAX_AI_IMAGE_DOWNLOAD_BYTES + 1)
                            : reason === "invalid-length"
                              ? "invalid"
                              : "1",
                },
            });
            const getReader =
                response.body === null ? vi.fn() : vi.spyOn(response.body, "getReader");
            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
            await expect(
                localImageBytes(
                    image({
                        blobUrl: "https://media.example/image.png",
                    }),
                ),
            ).resolves.toBeUndefined();
            expect(fetchSpy.mock.calls[0][1]?.signal?.aborted).toBe(true);
            expect(getReader).not.toHaveBeenCalled();
        },
    );

    it("uses bounded in-memory bytes without fetching", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const loader = vi.fn();
        const bytes = new Uint8Array([1, 2, 3]);

        expect(await localImageBytes(image({ blobData: bytes }), loader)).toEqual(bytes);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(loader).not.toHaveBeenCalled();
    });

    it("uses the ordinary full URL before the agent fallback on a loopback page", async () => {
        const bytes = new Uint8Array([7, 8, 9]);
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(bytes, { status: 200 }));
        const loader = vi.fn();

        await expect(
            localImageBytes(image({ blobUrl: LOCAL_URL, blobReference: REF }), loader),
        ).resolves.toEqual(bytes);
        expect(fetchSpy).toHaveBeenCalledWith(
            LOCAL_URL,
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(loader).not.toHaveBeenCalled();
    });

    it("skips the mixed-content raw.localhost fetch on a remote HTTPS page", async () => {
        const bytes = new Uint8Array([11, 12, 13]);
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const loader = vi.fn(async () => bytes);

        await expect(
            localImageBytes(
                image({ blobUrl: LOCAL_URL, blobReference: REF }),
                loader,
                {
                    protocol: "https:",
                    hostname: "openchat-dev.example.ts.net",
                },
                LOCAL_PATTERN,
            ),
        ).resolves.toEqual(bytes);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(loader).toHaveBeenCalledWith(REF, MAX_AI_IMAGE_DOWNLOAD_BYTES);
    });

    it("skips the configured non-default local gateway port on remote HTTPS", async () => {
        const url = `http://${REF.canisterId}.raw.localhost:4943/blobs/${REF.blobId}`;
        const bytes = new Uint8Array([14, 15]);
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const loader = vi.fn(async () => bytes);

        await expect(
            localImageBytes(
                image({ blobUrl: url, blobReference: REF }),
                loader,
                { protocol: "https:", hostname: "openchat-dev.example.ts.net" },
                NON_DEFAULT_PORT_PATTERN,
            ),
        ).resolves.toEqual(bytes);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(loader).toHaveBeenCalledWith(REF, MAX_AI_IMAGE_DOWNLOAD_BYTES);
    });

    it("falls back to the agent when an ordinary fetch fails", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network error"));
        const bytes = new Uint8Array([21, 22]);
        const loader = vi.fn(async () => bytes);

        await expect(
            localImageBytes(
                image({ blobUrl: "https://example.test/image", blobReference: REF }),
                loader,
            ),
        ).resolves.toEqual(bytes);
        expect(loader).toHaveBeenCalledWith(REF, MAX_AI_IMAGE_DOWNLOAD_BYTES);
    });

    it("times out a stalled agent fallback", async () => {
        vi.useFakeTimers();
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const loader = vi.fn(() => new Promise<Uint8Array | undefined>(() => undefined));
        const pending = localImageBytes(
            image({ blobUrl: LOCAL_URL, blobReference: REF }),
            loader,
            {
                protocol: "https:",
                hostname: "openchat-dev.example.ts.net",
            },
            LOCAL_PATTERN,
        );

        await vi.advanceTimersByTimeAsync(AGENT_IMAGE_FETCH_TIMEOUT_MS);
        await expect(pending).resolves.toBeUndefined();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects oversized in-memory or fetched images", async () => {
        const oversized = new Uint8Array(MAX_AI_IMAGE_DOWNLOAD_BYTES + 1);
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(oversized, { status: 200 }));
        const loader = vi.fn();

        await expect(
            localImageBytes(image({ blobData: oversized }), loader),
        ).resolves.toBeUndefined();
        await expect(
            localImageBytes(image({ blobUrl: "https://example.test/image" }), loader),
        ).resolves.toBeUndefined();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("stops reading a chunked response as soon as it exceeds the byte limit", async () => {
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(MAX_AI_IMAGE_DOWNLOAD_BYTES));
                controller.enqueue(new Uint8Array([1]));
            },
            cancel() {
                cancelled = true;
            },
        });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 200 }));

        await expect(
            localImageBytes(image({ blobUrl: "https://example.test/chunked-image" })),
        ).resolves.toBeUndefined();
        expect(cancelled).toBe(true);
    });
});
