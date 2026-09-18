import type { SyncSinceResponse, UpdatesResult } from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SyncPuller } from "./syncPuller";

type Deferred = {
    promise: Promise<SyncSinceResponse>;
    resolve: (answer: SyncSinceResponse) => void;
    reject: (err: unknown) => void;
};

function deferred(): Deferred {
    let resolve!: Deferred["resolve"];
    let reject!: Deferred["reject"];
    const promise = new Promise<SyncSinceResponse>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const updates = (tag: string) => ({ tag }) as unknown as UpdatesResult;
const answer = (version: number, userId = "u1"): SyncSinceResponse => ({
    userId,
    version,
    updates: updates(`v${version}`),
});

function harness(timeoutMs?: number) {
    const pulls: { since: number; deferred: Deferred }[] = [];
    const folded: string[] = [];
    const errors: string[] = [];
    const puller = new SyncPuller({
        pull: (since) => {
            const d = deferred();
            pulls.push({ since, deferred: d });
            return d.promise;
        },
        fold: async (u) => {
            folded.push((u as unknown as { tag: string }).tag);
        },
        timeoutMs,
        log: (message) => errors.push(message),
    });
    return { puller, pulls, folded, errors };
}

// lets the promise chains inside the puller settle
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SyncPuller", () => {
    beforeEach(() => vi.useRealTimers());
    afterEach(() => vi.useRealTimers());

    test("folds the snapshot, then pulls from its version when a head is past it", async () => {
        const { puller, pulls, folded } = harness();

        await puller.seed(answer(3), async (u) => {
            folded.push("snapshot:" + (u as unknown as { tag: string }).tag);
        });
        expect(puller.cursor).toEqual({ userId: "u1", version: 3 });
        expect(pulls).toHaveLength(0);

        puller.onHead({ userId: "u1", version: 5 });
        expect(pulls.map((p) => p.since)).toEqual([3]);

        pulls[0].deferred.resolve(answer(5));
        await settle();

        expect(folded).toEqual(["snapshot:v3", "v5"]);
        expect(puller.cursor?.version).toBe(5);
    });

    test("ignores heads before the seed, for another user, or not past the cursor", async () => {
        const { puller, pulls } = harness();

        puller.onHead({ userId: "u1", version: 5 });
        await puller.seed(answer(3), async () => {});
        puller.onHead({ userId: "u2", version: 9 });
        puller.onHead({ userId: "u1", version: 3 });
        puller.onHead({ userId: "u1", version: 2 });

        expect(pulls).toHaveLength(0);
    });

    test("one pull in flight: heads arriving meanwhile coalesce into one more pull", async () => {
        const { puller, pulls, folded } = harness();
        await puller.seed(answer(1), async () => {});

        puller.onHead({ userId: "u1", version: 2 });
        puller.onHead({ userId: "u1", version: 3 });
        puller.onHead({ userId: "u1", version: 4 });
        expect(pulls).toHaveLength(1);

        pulls[0].deferred.resolve(answer(2));
        await settle();

        // the coalesced pull starts from the new cursor
        expect(pulls.map((p) => p.since)).toEqual([1, 2]);
        pulls[1].deferred.resolve(answer(4));
        await settle();
        expect(folded).toEqual(["v2", "v4"]);
        expect(pulls).toHaveLength(2);
    });

    test("an answer that already covers the pending head needs no further pull", async () => {
        const { puller, pulls } = harness();
        await puller.seed(answer(1), async () => {});

        puller.onHead({ userId: "u1", version: 2 });
        puller.onHead({ userId: "u1", version: 3 });
        pulls[0].deferred.resolve(answer(3));
        await settle();

        expect(pulls).toHaveLength(1);
    });

    test("drops an answer for another user or behind the cursor", async () => {
        const { puller, pulls, folded } = harness();
        await puller.seed(answer(1), async () => {});

        puller.onHead({ userId: "u1", version: 2 });
        pulls[0].deferred.resolve(answer(2, "u2"));
        await settle();
        expect(folded).toEqual([]);
        expect(puller.cursor?.version).toBe(1);

        puller.onHead({ userId: "u1", version: 3 });
        // a boot snapshot lands mid-pull and outranks the older answer
        await puller.seed(answer(7), async () => {
            folded.push("snapshot");
        });
        pulls[1].deferred.resolve(answer(3));
        await settle();

        expect(folded).toEqual(["snapshot"]);
        expect(puller.cursor?.version).toBe(7);
    });

    test("a snapshot arriving while a pulled answer is folding waits for that fold", async () => {
        const order: string[] = [];
        const pulled = deferred();
        let releaseFold!: () => void;
        const puller = new SyncPuller({
            pull: () => pulled.promise,
            fold: async () => {
                order.push("fold:start");
                await new Promise<void>((resolve) => (releaseFold = resolve));
                order.push("fold:end");
            },
        });

        await puller.seed(answer(1), async () => {});
        puller.onHead({ userId: "u1", version: 2 });
        pulled.resolve(answer(2));
        await settle();
        expect(order).toEqual(["fold:start"]);

        const seeded = puller.seed(answer(5), async () => {
            order.push("snapshot");
        });
        await settle();
        expect(order).toEqual(["fold:start"]);

        releaseFold();
        await seeded;
        expect(order).toEqual(["fold:start", "fold:end", "snapshot"]);
        // the older answer did not move the cursor back
        expect(puller.cursor?.version).toBe(5);
    });

    test("a pull that fails waits for the next head rather than retrying at once", async () => {
        const { puller, pulls, errors } = harness();
        await puller.seed(answer(1), async () => {});

        puller.onHead({ userId: "u1", version: 2 });
        puller.onHead({ userId: "u1", version: 3 });
        pulls[0].deferred.reject(new Error("boom"));
        await settle();

        expect(errors).toEqual(["Sync pull failed"]);
        // the head that arrived during the failed pull is still owed a pull
        expect(pulls.map((p) => p.since)).toEqual([1, 1]);
        pulls[1].deferred.reject(new Error("boom"));
        await settle();
        expect(pulls).toHaveLength(2);

        puller.onHead({ userId: "u1", version: 4 });
        expect(pulls).toHaveLength(3);
    });

    test("a pull that does not answer in time is abandoned and the next head pulls again", async () => {
        vi.useFakeTimers();
        const { puller, pulls, errors } = harness(1000);
        await puller.seed(answer(1), async () => {});

        puller.onHead({ userId: "u1", version: 2 });
        await vi.advanceTimersByTimeAsync(1001);
        expect(errors).toEqual(["Sync pull failed"]);
        expect(puller.cursor?.version).toBe(1);

        puller.onHead({ userId: "u1", version: 3 });
        expect(pulls.map((p) => p.since)).toEqual([1, 1]);

        // the late answer to the abandoned pull is ignored
        pulls[0].deferred.resolve(answer(2));
        pulls[1].deferred.resolve(answer(3));
        await vi.advanceTimersByTimeAsync(0);
        expect(puller.cursor?.version).toBe(3);
    });

    test("a snapshot from a load begun before clear() is dropped", async () => {
        const { puller, folded, errors } = harness();
        const generation = puller.generation;

        puller.clear();
        await puller.seed(answer(4, "old-user"), async () => folded.push("stale"), generation);

        expect(folded).toEqual([]);
        expect(puller.cursor).toBeUndefined();
        expect(errors).toEqual(["Sync snapshot dropped"]);

        // the load begun after the clear seeds as normal
        await puller.seed(answer(1), async () => folded.push("fresh"), puller.generation);
        expect(folded).toEqual(["fresh"]);
        expect(puller.cursor).toEqual({ userId: "u1", version: 1 });
    });

    test("a snapshot behind the cursor, or for another user, never seeds", async () => {
        const { puller, folded } = harness();
        await puller.seed(answer(5), async () => folded.push("v5"));

        await puller.seed(answer(3), async () => folded.push("v3"));
        await puller.seed(answer(9, "u2"), async () => folded.push("u2"));
        expect(folded).toEqual(["v5"]);
        expect(puller.cursor).toEqual({ userId: "u1", version: 5 });

        // the same version is folded again: a duplicate is harmless, a hole is not
        await puller.seed(answer(5), async () => folded.push("v5-again"));
        expect(folded).toEqual(["v5", "v5-again"]);
    });

    test("a snapshot whose fold throws puts the cursor back, so what it carried is still owed", async () => {
        const { puller, pulls } = harness();
        const boom = async () => {
            throw new Error("boom");
        };

        await expect(puller.seed(answer(3), boom)).rejects.toThrow("boom");
        expect(puller.cursor).toBeUndefined();

        await puller.seed(answer(3), async () => {});
        await expect(puller.seed(answer(6), boom)).rejects.toThrow("boom");
        expect(puller.cursor?.version).toBe(3);

        // the next head pulls from the old cursor, covering what the failed snapshot held
        puller.onHead({ userId: "u1", version: 6 });
        expect(pulls.map((p) => p.since)).toEqual([3]);
    });

    test("a snapshot queued behind a fold is dropped if clear() runs before its turn", async () => {
        const pulled = deferred();
        let releaseFold!: () => void;
        const folded: string[] = [];
        const puller = new SyncPuller({
            pull: () => pulled.promise,
            fold: () => new Promise<void>((resolve) => (releaseFold = resolve)),
        });
        await puller.seed(answer(1), async () => {});
        puller.onHead({ userId: "u1", version: 2 });
        pulled.resolve(answer(2));
        await settle();

        // passes the check on the way in, then waits for the pulled answer's fold
        const seeded = puller.seed(answer(5), async () => {
            folded.push("stale");
        });
        puller.clear();
        releaseFold();
        await seeded;

        expect(folded).toEqual([]);
        expect(puller.cursor).toBeUndefined();
    });

    test("a pull begun before clear() is dropped even when the same user signs back in", async () => {
        const { puller, pulls, folded } = harness();
        await puller.seed(answer(1), async () => {});
        puller.onHead({ userId: "u1", version: 4 });

        puller.clear();
        await puller.seed(answer(2), async () => {});
        pulls[0].deferred.resolve(answer(4));
        await settle();

        expect(folded).toEqual([]);
        expect(puller.cursor?.version).toBe(2);
    });

    test("clear drops the cursor and any in-flight answer", async () => {
        const { puller, pulls, folded } = harness();
        await puller.seed(answer(1), async () => {});
        puller.onHead({ userId: "u1", version: 2 });

        puller.clear();
        pulls[0].deferred.resolve(answer(2));
        await settle();

        expect(folded).toEqual([]);
        expect(puller.cursor).toBeUndefined();
        puller.onHead({ userId: "u1", version: 3 });
        expect(pulls).toHaveLength(1);
    });
});
