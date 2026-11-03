import type { BlobReference, OpenChat, VaultFileChunkResponse } from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VaultMediaReview, type ReviewOutcome } from "./vaultMediaReview.svelte";

const ref: BlobReference = { canisterId: "bucket", blobId: 1n };

function clientWith(vaultFileChunk: () => Promise<VaultFileChunkResponse>): OpenChat {
    return {
        vaultFileChunk,
        reportedMediaUrl: () => "https://example.invalid/blob",
    } as Partial<OpenChat> as OpenChat;
}

describe("VaultMediaReview", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test("a vault call that never settles ends in error rather than loading forever", async () => {
        const outcomes: ReviewOutcome[] = [];
        const review = new VaultMediaReview(
            clientWith(() => new Promise(() => {})),
            [ref],
            true,
            (o) => outcomes.push(o),
            1000,
        );
        const fetching = review.fetchAll();
        expect(review.stage).toBe("loading");
        await vi.advanceTimersByTimeAsync(1000);
        await fetching;
        expect(review.stage).toBe("error");
        review.dispose();
        expect(outcomes).toEqual(["error"]);
    });

    test("a direct fetch that never settles is aborted and ends in error", async () => {
        let signal: AbortSignal | undefined;
        vi.stubGlobal(
            "fetch",
            (_url: string, init: RequestInit) =>
                new Promise((_resolve, reject) => {
                    signal = init.signal ?? undefined;
                    signal?.addEventListener("abort", () => reject(new Error("aborted")));
                }),
        );
        const review = new VaultMediaReview(
            clientWith(() => new Promise(() => {})),
            [ref],
            false,
            undefined,
            1000,
        );
        const fetching = review.fetchAll();
        await vi.advanceTimersByTimeAsync(1000);
        await fetching;
        expect(signal?.aborted).toBe(true);
        expect(review.stage).toBe("error");
    });

    test("a vault chunk that arrives in time is shown", async () => {
        const outcomes: ReviewOutcome[] = [];
        const review = new VaultMediaReview(
            clientWith(() =>
                Promise.resolve({
                    kind: "success",
                    bytes: new Uint8Array([1]),
                    chunkIndex: 0,
                    chunkCount: 1,
                    totalSize: 1n,
                    mimeType: "image/png",
                } as VaultFileChunkResponse),
            ),
            [ref],
            true,
            (o) => outcomes.push(o),
            1000,
        );
        await review.fetchAll();
        expect(review.stage).toBe("view");
        expect(review.items).toHaveLength(1);
        review.dispose();
        expect(outcomes).toEqual(["viewed"]);
    });
});
