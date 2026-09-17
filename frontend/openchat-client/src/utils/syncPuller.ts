import type { SyncHead, SyncSinceResponse, SyncWindow, UpdatesResult } from "@shared";

export const SYNC_PULL_TIMEOUT_MS = 60_000;

export type SyncPullerDeps = {
    pull: (since: number, windows: SyncWindow[]) => Promise<SyncSinceResponse>;
    fold: (updates: UpdatesResult) => Promise<void>;
    windows: () => SyncWindow[];
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
 */
export class SyncPuller {
    #cursor: SyncHead | undefined = undefined;
    #pendingHead: number | undefined = undefined;
    #inFlight = false;
    // Folds run one at a time so a snapshot and a pulled answer can never interleave
    #folding: Promise<void> = Promise.resolve();

    constructor(private deps: SyncPullerDeps) {}

    get cursor(): SyncHead | undefined {
        return this.#cursor;
    }

    /**
     * Folds the boot snapshot and seeds the cursor from it. The cursor moves first so a head
     * announced during the fold is kept and pulled once the fold is done.
     */
    async seed(
        snapshot: SyncSinceResponse,
        fold: (updates: UpdatesResult) => Promise<void>,
    ): Promise<void> {
        this.#cursor = { userId: snapshot.userId, version: snapshot.version };
        await this.#exclusive(() => fold(snapshot.updates));
        this.#maybePull();
    }

    /** Forgets the cursor (sign-out): heads are ignored and in-flight answers dropped until the next seed */
    clear(): void {
        this.#cursor = undefined;
        this.#pendingHead = undefined;
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
        this.#pull(this.#cursor.version).finally(() => {
            this.#inFlight = false;
            this.#maybePull();
        });
    }

    async #pull(since: number): Promise<void> {
        try {
            const answer = await withTimeout(
                this.deps.pull(since, this.deps.windows()),
                this.deps.timeoutMs ?? SYNC_PULL_TIMEOUT_MS,
            );
            await this.#exclusive(async () => {
                if (!this.#accepts(answer)) return;
                await this.deps.fold(answer.updates);
                // Re-checked after the fold: a snapshot may have moved the cursor past this
                // answer meanwhile, and the cursor never moves backwards
                if (this.#accepts(answer)) {
                    this.#cursor = { userId: answer.userId, version: answer.version };
                }
            });
        } catch (err) {
            this.deps.log?.("Sync pull failed", err);
        }
    }

    #accepts(answer: SyncSinceResponse): boolean {
        return (
            this.#cursor !== undefined &&
            this.#cursor.userId === answer.userId &&
            answer.version >= this.#cursor.version
        );
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
