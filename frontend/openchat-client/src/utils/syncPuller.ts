import type { SyncHead, SyncSinceResponse, UpdatesResult } from "@shared";

export const SYNC_PULL_TIMEOUT_MS = 60_000;

export type SyncPullerDeps = {
    pull: (since: number) => Promise<SyncSinceResponse>;
    fold: (updates: UpdatesResult) => Promise<void>;
    timeoutMs?: number;
    log?: (message: string, err: unknown) => void;
};

/**
 * The UI half of the cache -> UI sync (see `domain/sync.ts` in openchat-shared). Holds the
 * cursor, the version of the worker's cache the UI has folded up to, and pulls whatever is
 * stamped past it whenever the worker announces a head beyond it.
 *
 * One pull is in flight at a time and heads that arrive meanwhile coalesce into one more pull.
 * An answer for another user, or read at a version behind the cursor (a boot snapshot landed
 * mid-pull), is dropped. A pull that has not answered within the timeout is abandoned so a lost
 * answer cannot wedge the cursor: the next head pulls again from the same cursor.
 *
 * `clear()` starts a new generation, and anything begun before it - a snapshot from an old
 * identity's `getUpdates` stream answering late, a pull still in flight, a fold still queued -
 * is dropped rather than applied to the new session. The user id is not enough for that: the
 * same user can sign out and back in. A snapshot behind the cursor for the same user never
 * moves it backwards.
 */
export class SyncPuller {
    #cursor: SyncHead | undefined = undefined;
    #pendingHead: number | undefined = undefined;
    #inFlight = false;
    #generation = 0;
    // Folds run one at a time so a snapshot and a pulled answer can never interleave
    #folding: Promise<void> = Promise.resolve();

    constructor(private deps: SyncPullerDeps) {}

    get cursor(): SyncHead | undefined {
        return this.#cursor;
    }

    /** Captured by a load before it starts, so a snapshot it delivers after a `clear()` is dropped */
    get generation(): number {
        return this.#generation;
    }

    /**
     * Folds the boot snapshot and seeds the cursor from it. The cursor moves first so a head
     * announced during the fold is kept and pulled once the fold is done; if the fold throws the
     * cursor goes back to where it was, so what the snapshot carried is still owed rather than
     * counted as seen.
     *
     * Dropped if `generation` is not the current one (the load began before a `clear()`), or if
     * a cursor for the same user is already past it (an out-of-order load); a snapshot for a
     * different user while a cursor is set is stale too, since every identity change clears.
     */
    async seed(
        snapshot: SyncSinceResponse,
        fold: (updates: UpdatesResult) => Promise<void>,
        generation: number = this.#generation,
    ): Promise<void> {
        if (generation !== this.#generation || !this.#seedable(snapshot)) {
            this.#logDropped(snapshot, generation);
            return;
        }
        const previous = this.#cursor;
        const seeded = { userId: snapshot.userId, version: snapshot.version };
        this.#cursor = seeded;
        try {
            await this.#exclusive(async () => {
                // Checked again now that the fold's turn has come: it may have queued behind
                // another fold, and a `clear()` meanwhile makes this the old session's snapshot
                if (generation !== this.#generation) {
                    this.#logDropped(snapshot, generation);
                    return;
                }
                await fold(snapshot.updates);
            });
        } catch (err) {
            // only if the cursor is still ours: a `clear()` or a later seed outranks this
            if (this.#cursor === seeded) {
                this.#cursor = previous;
                if (previous === undefined) this.#pendingHead = undefined;
            }
            throw err;
        } finally {
            this.#maybePull();
        }
    }

    /**
     * Forgets the cursor (sign-out) and starts a new generation: heads are ignored, in-flight
     * answers dropped and snapshots from loads begun before this are dropped until the next seed
     */
    clear(): void {
        this.#cursor = undefined;
        this.#pendingHead = undefined;
        this.#generation++;
    }

    onHead({ userId, version }: SyncHead): void {
        if (
            this.#cursor === undefined ||
            this.#cursor.userId !== userId ||
            version <= this.#cursor.version
        ) {
            return;
        }
        this.#pendingHead = Math.max(this.#pendingHead ?? 0, version);
        this.#maybePull();
    }

    #maybePull(): void {
        if (
            this.#inFlight ||
            this.#cursor === undefined ||
            this.#pendingHead === undefined ||
            this.#pendingHead <= this.#cursor.version
        ) {
            return;
        }
        // Cleared before the pull rather than after: a pull that fails must wait for the next
        // head, not retry at once
        this.#pendingHead = undefined;
        this.#inFlight = true;
        this.#pull(this.#cursor.version, this.#generation).finally(() => {
            this.#inFlight = false;
            this.#maybePull();
        });
    }

    async #pull(since: number, generation: number): Promise<void> {
        try {
            const answer = await withTimeout(
                this.deps.pull(since),
                this.deps.timeoutMs ?? SYNC_PULL_TIMEOUT_MS,
            );
            await this.#exclusive(async () => {
                if (!this.#accepts(answer, generation)) return;
                await this.deps.fold(answer.updates);
                // Re-checked after the fold: a snapshot may have moved the cursor past this
                // answer meanwhile, and the cursor never moves backwards
                if (this.#accepts(answer, generation)) {
                    this.#cursor = { userId: answer.userId, version: answer.version };
                }
            });
        } catch (err) {
            this.deps.log?.("Sync pull failed", err);
        }
    }

    #seedable(snapshot: SyncSinceResponse): boolean {
        return (
            this.#cursor === undefined ||
            (this.#cursor.userId === snapshot.userId && snapshot.version >= this.#cursor.version)
        );
    }

    // The generation as well as the user: a pull begun before a `clear()` must not land in the
    // session after it, even when that session belongs to the same user
    #accepts(answer: SyncSinceResponse, generation: number): boolean {
        return (
            generation === this.#generation &&
            this.#cursor !== undefined &&
            this.#cursor.userId === answer.userId &&
            answer.version >= this.#cursor.version
        );
    }

    #logDropped(snapshot: SyncSinceResponse, generation: number): void {
        this.deps.log?.("Sync snapshot dropped", { snapshot: snapshot.version, generation });
    }

    #exclusive(fn: () => Promise<void>): Promise<void> {
        const run = this.#folding.then(fn);
        this.#folding = run.catch(() => undefined);
        return run;
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}
