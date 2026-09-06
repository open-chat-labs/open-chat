import type { MessageContent } from "@client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    AGENT_AUDIO_FETCH_TIMEOUT_MS,
    MAX_LOCAL_AI_AUDIO_BYTES,
    MAX_LOCAL_AI_AUDIO_DURATION_MS,
    localAudioInput,
} from "./localAudioInput";

const REF = { canisterId: "ucwa4-rx777-77774-qaada-cai", blobId: 42n };
const PATTERN = "http://{canisterId}.raw.localhost:4943/{blobType}";
const LOCAL_URL = `http://${REF.canisterId}.raw.localhost:4943/blobs/${REF.blobId}`;
const REMOTE_PAGE = { protocol: "https:", hostname: "openchat-dev.example.ts.net" };

function voice(extra: Record<string, unknown> = {}): MessageContent {
    return {
        kind: "audio_content",
        mimeType: "audio/webm;codecs=opus",
        samples: new Uint8Array([1]),
        durationMs: 2_000n,
        ...extra,
    } as MessageContent;
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("bounded generic voice input", () => {
    it.each(["non-ok", "oversized-length", "invalid-length", "bodyless"] as const)(
        "aborts the fetch without consuming an early rejected %s response",
        async (reason) => {
            const response = new Response(reason === "bodyless" ? null : new Uint8Array([1]), {
                status: reason === "non-ok" ? 404 : reason === "bodyless" ? 204 : 200,
                headers: {
                    "Content-Length":
                        reason === "oversized-length"
                            ? String(MAX_LOCAL_AI_AUDIO_BYTES + 1)
                            : reason === "invalid-length"
                              ? "invalid"
                              : "1",
                },
            });
            const getReader =
                response.body === null ? vi.fn() : vi.spyOn(response.body, "getReader");
            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
            await expect(
                localAudioInput(
                    voice({
                        blobUrl: "https://media.example/voice.webm",
                    }),
                ),
            ).resolves.toBeUndefined();
            expect(fetchSpy.mock.calls[0][1]?.signal?.aborted).toBe(true);
            expect(getReader).not.toHaveBeenCalled();
        },
    );

    it("uses inline bytes and normalized MIME without a download", async () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const loader = vi.fn();
        await expect(
            localAudioInput(
                voice({ blobData: bytes, mimeType: " AUDIO/WEBM;codecs=opus " }),
                loader,
            ),
        ).resolves.toEqual({ audio: bytes, audioMimeType: "audio/webm;codecs=opus" });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(loader).not.toHaveBeenCalled();
    });

    it("accepts the exact duration and byte limits", async () => {
        const bytes = new Uint8Array(MAX_LOCAL_AI_AUDIO_BYTES);
        const result = await localAudioInput(
            voice({ blobData: bytes, durationMs: MAX_LOCAL_AI_AUDIO_DURATION_MS }),
        );
        expect(result?.audio).toBe(bytes);
        expect(result?.audioMimeType).toBe("audio/webm;codecs=opus");
    });

    it.each([
        { durationMs: 0n },
        { durationMs: -1n },
        { durationMs: MAX_LOCAL_AI_AUDIO_DURATION_MS + 1n },
        { mimeType: "text/html" },
        { mimeType: "audio/webm\r\nx-injected: value" },
        { mimeType: `audio/${"x".repeat(128)}` },
    ])("rejects invalid metadata before fetching: %#", async (extra) => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const loader = vi.fn();
        await expect(
            localAudioInput(voice({ blobData: new Uint8Array([1]), ...extra }), loader),
        ).resolves.toBeUndefined();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(loader).not.toHaveBeenCalled();
    });

    it("streams a settled voice URL", async () => {
        const bytes = new Uint8Array([2, 3, 4]);
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(bytes));
        await expect(
            localAudioInput(voice({ blobUrl: "https://media.example/voice.webm" })),
        ).resolves.toEqual({ audio: bytes, audioMimeType: "audio/webm;codecs=opus" });
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://media.example/voice.webm",
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it("skips only the exact configured local blob URL on remote HTTPS and uses the bounded bridge", async () => {
        const bytes = new Uint8Array([3, 4]);
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const loader = vi.fn(async () => bytes);
        await expect(
            localAudioInput(
                voice({ blobUrl: LOCAL_URL, blobReference: REF }),
                loader,
                REMOTE_PAGE,
                PATTERN,
            ),
        ).resolves.toEqual({ audio: bytes, audioMimeType: "audio/webm;codecs=opus" });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(loader).toHaveBeenCalledWith(REF, MAX_LOCAL_AI_AUDIO_BYTES);
    });

    it.each([
        `${LOCAL_URL}?redirect=1`,
        LOCAL_URL.replace(":4943/", ":8080/"),
        LOCAL_URL.replace(".raw.localhost", ".raw.localhost.example"),
        LOCAL_URL.replace("/blobs/42", "/blobs/43"),
    ])("does not extend the configured-local exception to a different URL: %s", async (url) => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockRejectedValue(new TypeError("network error"));
        const bytes = new Uint8Array([4]);
        await expect(
            localAudioInput(
                voice({ blobUrl: url, blobReference: REF }),
                async () => bytes,
                REMOTE_PAGE,
                PATTERN,
            ),
        ).resolves.toEqual({ audio: bytes, audioMimeType: "audio/webm;codecs=opus" });
        expect(fetchSpy).toHaveBeenCalledWith(url, expect.any(Object));
    });

    it("rejects missing, empty and oversized in-memory or bridge bytes", async () => {
        await expect(localAudioInput(voice())).resolves.toBeUndefined();
        for (const bytes of [new Uint8Array(), new Uint8Array(MAX_LOCAL_AI_AUDIO_BYTES + 1)]) {
            await expect(localAudioInput(voice({ blobData: bytes }))).resolves.toBeUndefined();
            await expect(
                localAudioInput(voice({ blobReference: REF }), async () => bytes),
            ).resolves.toBeUndefined();
        }
    });

    it.each(["-1", "invalid", String(MAX_LOCAL_AI_AUDIO_BYTES + 1)])(
        "rejects unsafe Content-Length %s",
        async (length) => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(new Uint8Array([1]), { headers: { "Content-Length": length } }),
            );
            await expect(
                localAudioInput(voice({ blobUrl: "https://media.example/voice.webm" })),
            ).resolves.toBeUndefined();
        },
    );

    it("cancels a streamed response immediately when it crosses the size limit", async () => {
        const cancel = vi.fn();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(MAX_LOCAL_AI_AUDIO_BYTES));
                controller.enqueue(new Uint8Array([1]));
            },
            cancel,
        });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body));
        await expect(
            localAudioInput(voice({ blobUrl: "https://media.example/voice.webm" })),
        ).resolves.toBeUndefined();
        expect(cancel).toHaveBeenCalledOnce();
    });

    it("times out a stalled public-blob bridge", async () => {
        vi.useFakeTimers();
        const pending = localAudioInput(
            voice({ blobReference: REF }),
            () => new Promise(() => undefined),
        );
        await vi.advanceTimersByTimeAsync(AGENT_AUDIO_FETCH_TIMEOUT_MS);
        await expect(pending).resolves.toBeUndefined();
    });
});
