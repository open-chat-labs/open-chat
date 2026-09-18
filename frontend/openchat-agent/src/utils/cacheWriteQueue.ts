export const CACHE_WRITE_MAX_WAIT_MS = 30_000;

/**
 * Runs the tasks that read the chats cache, fetch, and write the result back one at a time, so
 * no task writes back a state it read before another task's write and undoes that write.
 *
 * A task that has not finished `maxWaitMs` after it started stops holding up the tasks behind
 * it. Those then run alongside it, which was the old behaviour, rather than waiting on a hung
 * call forever.
 */
export class CacheWriteQueue {
    #tail: Promise<void> = Promise.resolve();

    constructor(private maxWaitMs: number = CACHE_WRITE_MAX_WAIT_MS) {}

    async run<T>(task: () => Promise<T>): Promise<T> {
        const turn = this.#tail;
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => (finish = resolve));
        this.#tail = turn.then(() => settledOrTimeout(finished, this.maxWaitMs));
        await turn;
        try {
            return await task();
        } finally {
            finish();
        }
    }
}

function settledOrTimeout(promise: Promise<void>, ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        promise.then(() => {
            clearTimeout(timer);
            resolve();
        });
    });
}
