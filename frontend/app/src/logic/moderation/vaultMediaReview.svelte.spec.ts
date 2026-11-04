import type {
    BlobReference,
    OpenChat,
    VaultFileChunkResponse,
    VaultFileInfoResponse,
} from "@client";
import { MediaReviewGate, VaultMediaReview, type ReviewOutcome } from "./vaultMediaReview.svelte";

type VaultClient = Pick<OpenChat, "vaultFileChunk" | "vaultFileInfo" | "reportedMediaUrl">;

const BIG: BlobReference = { canisterId: "bucket", blobId: 1n };
const SMALL: BlobReference = { canisterId: "bucket", blobId: 2n };

function chunk(chunkIndex: number, chunkCount: number): VaultFileChunkResponse {
    return {
        kind: "success",
        bytes: new Uint8Array([chunkIndex]),
        chunkIndex,
        chunkCount,
        totalSize: BigInt(chunkCount),
        mimeType: "video/mp4",
    };
}

function info(size: number): VaultFileInfoResponse {
    return { kind: "success", hash: "", mimeType: "video/mp4", size: BigInt(size) };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

// BIG (two chunks, the second held back until the test releases it) and SMALL (one chunk)
function heldBackClient() {
    const bigSecondChunk = deferred<VaultFileChunkResponse>();
    const calls: [bigint, number][] = [];
    const client: VaultClient = {
        reportedMediaUrl: () => "",
        vaultFileInfo: async (_, fileId) => info(fileId === BIG.blobId ? 36_000_000 : 800_000),
        vaultFileChunk: async (_, fileId, chunkIndex) => {
            calls.push([fileId, chunkIndex]);
            if (fileId === SMALL.blobId) return chunk(0, 1);
            return chunkIndex === 0 ? chunk(0, 2) : bigSecondChunk.promise;
        },
    };
    return {
        client: client as OpenChat,
        calls,
        releaseBig: () => bigSecondChunk.resolve(chunk(1, 2)),
    };
}

beforeEach(() => {
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:test/${n++}`);
    URL.revokeObjectURL = vi.fn();
});

describe("the vault media review", () => {
    test("invariant 1: closing before every file has loaded never reports viewed", async () => {
        const { client, releaseBig } = heldBackClient();
        const results: ReviewOutcome[] = [];
        const review = new VaultMediaReview(client, [BIG, SMALL], true, (o) => results.push(o));
        const fetching = review.fetchAll();
        await settle();
        review.dispose();
        releaseBig();
        await fetching;
        expect(results).toEqual([]);

        const finished = heldBackClient();
        const completed = new VaultMediaReview(finished.client, [BIG, SMALL], true, (o) =>
            results.push(o),
        );
        const fetchingAll = completed.fetchAll();
        finished.releaseBig();
        await fetchingAll;
        completed.dispose();
        expect(results).toEqual(["viewed"]);
    });

    test("invariant 2: a file's chunks are requested in order, one at a time", async () => {
        const requested: number[] = [];
        let inFlight = 0;
        let maxInFlight = 0;
        const client: VaultClient = {
            reportedMediaUrl: () => "",
            vaultFileInfo: async () => info(3),
            vaultFileChunk: async (_, __, chunkIndex) => {
                requested.push(chunkIndex);
                maxInFlight = Math.max(maxInFlight, ++inFlight);
                await settle();
                inFlight--;
                return chunk(chunkIndex, 3);
            },
        };
        const review = new VaultMediaReview(client as OpenChat, [BIG], true);
        await review.fetchAll();
        expect(requested).toEqual([0, 1, 2]);
        expect(maxInFlight).toBe(1);
    });

    test("invariant 3: the smallest file is fetched first and shown while larger ones load", async () => {
        const { client, calls, releaseBig } = heldBackClient();
        const review = new VaultMediaReview(client, [BIG, SMALL], true);
        const fetching = review.fetchAll();
        await settle();
        expect(calls[0]).toEqual([SMALL.blobId, 0]);
        expect(review.stage).toBe("loading");
        expect(review.items).toHaveLength(1);
        releaseBig();
        await fetching;
        expect(review.items).toHaveLength(2);
    });

    test("invariant 4: media that won't play opens the gate only with the advisory", async () => {
        const results: ReviewOutcome[] = [];
        const client: VaultClient = {
            reportedMediaUrl: () => "",
            vaultFileInfo: async () => info(1),
            vaultFileChunk: async () => chunk(0, 1),
        };
        const review = new VaultMediaReview(client as OpenChat, [BIG], true, (o) =>
            results.push(o),
        );
        await review.fetchAll();
        review.markUnplayable(0);
        review.dispose();
        expect(results).toEqual(["unplayable"]);

        const gate = new MediaReviewGate();
        gate.apply(results[0]);
        expect(gate.reviewed).toBe(true);
        expect(gate.unplayable).toBe(true);
    });
});
