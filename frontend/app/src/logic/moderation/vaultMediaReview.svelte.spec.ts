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

    test("a slow download that keeps making progress is not cut off", async () => {
        let reads = 0;
        const body = {
            getReader: () => ({
                read: () =>
                    new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) =>
                        setTimeout(
                            () =>
                                resolve(
                                    ++reads <= 3
                                        ? { done: false, value: new Uint8Array([reads]) }
                                        : { done: true, value: undefined },
                                ),
                            800,
                        ),
                    ),
            }),
        };
        vi.stubGlobal("fetch", () =>
            Promise.resolve({
                status: 200,
                ok: true,
                headers: new Headers({ "content-type": "video/mp4" }),
                body,
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
        // Four reads at 800ms each: 3.2s in total, well past the 1s stall timeout
        await vi.advanceTimersByTimeAsync(3200);
        await fetching;
        expect(review.stage).toBe("view");
        expect(review.items[0]?.mimeType).toBe("video/mp4");
    });

    test("a session knocked out of order by a stale call restarts once from chunk 0", async () => {
        const requested: number[] = [];
        const chunk = (chunkIndex: number): VaultFileChunkResponse => ({
            kind: "success",
            bytes: new Uint8Array([chunkIndex]),
            chunkIndex,
            chunkCount: 2,
            totalSize: 2n,
            mimeType: "image/png",
        });
        let firstChunkOne = true;
        const client = {
            vaultFileChunk: (_c: string, _b: bigint, chunkIndex: number) => {
                requested.push(chunkIndex);
                if (chunkIndex === 1 && firstChunkOne) {
                    firstChunkOne = false;
                    return Promise.resolve({ kind: "session_required" } as VaultFileChunkResponse);
                }
                return Promise.resolve(chunk(chunkIndex));
            },
        } as Partial<OpenChat> as OpenChat;
        const review = new VaultMediaReview(client, [ref], true, undefined, 1000);
        await review.fetchAll();
        expect(requested).toEqual([0, 1, 0, 1]);
        expect(review.stage).toBe("view");
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
