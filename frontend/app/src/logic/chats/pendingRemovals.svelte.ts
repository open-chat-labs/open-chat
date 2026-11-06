import { SvelteSet } from "svelte/reactivity";

// Leaving a group or deleting a chat from the list with Undo (native design notes §1: destructive
// actions show Undo), when the backend can't undo it: the chat leaves the list at once, and the
// leave or delete is only sent once the Undo has had its time. Undo puts the chat back and sends
// nothing. Anything still waiting when the list goes away is sent then, and its Undo has to go
// with it (`settled`).

export class PendingRemovals {
    #delay: number;
    #timers = new Map<
        string,
        { timer: ReturnType<typeof setTimeout>; commit: () => void; settled: () => void }
    >();
    #hidden = new SvelteSet<string>();

    /** `delay`: how long Undo is offered (the toast's time). */
    constructor(delay: number) {
        this.#delay = delay;
    }

    /** Whether the chat (its key) is off the list, waiting to be left or deleted. */
    has(key: string): boolean {
        return this.#hidden.has(key);
    }

    /**
     * Takes the chat off the list, and runs `commit` (the leave or delete) once the Undo has had
     * its time. `settled` runs once the wait is over, whether it was sent or undone: the Undo
     * offered for it can go then. A chat already waiting keeps its first commit.
     */
    remove(key: string, commit: () => void, settled: () => void = () => {}): void {
        if (this.#timers.has(key)) return;
        const timer = setTimeout(() => this.#commit(key), this.#delay);
        this.#timers.set(key, { timer, commit, settled });
        this.#hidden.add(key);
    }

    /** Undo: the chat comes back, and nothing is sent. */
    undo(key: string): void {
        const pending = this.#timers.get(key);
        if (pending === undefined) return;
        clearTimeout(pending.timer);
        this.#timers.delete(key);
        this.#hidden.delete(key);
        pending.settled();
    }

    /** Sends everything still waiting (the list is going away). */
    flush(): void {
        for (const key of [...this.#timers.keys()]) this.#commit(key);
    }

    #commit(key: string): void {
        const pending = this.#timers.get(key);
        if (pending === undefined) return;
        clearTimeout(pending.timer);
        this.#timers.delete(key);
        // it stays off the list: the leave or delete takes it off for good (or puts it back if it
        // fails, through the client's own undo); this list's part is done
        this.#hidden.delete(key);
        pending.settled();
        pending.commit();
    }
}
