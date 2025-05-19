import type { Subscriber, Unsubscriber } from "svelte/store";

export type EqualityCheck<T> = (a: T, b: T) => boolean;

export class WritableStore<T> {
    #subs: Set<Subscriber<T>> = new Set();
    #val: T;
    #eq: EqualityCheck<T>;
    constructor(init: T, eq: EqualityCheck<T> = (a: T, b: T) => a === b) {
        this.#val = init;
        this.#eq = eq;
    }

    #publish() {
        this.#subs.forEach((sub) => {
            sub(this.#val);
        });
    }

    set(val: T) {
        if (!this.#eq(val, this.#val)) {
            this.#val = val;
            this.#publish();
        }
    }

    update(fn: (val: T) => T) {
        this.set(fn(this.#val));
    }

    get current() {
        return this.#val;
    }

    subscribe(sub: Subscriber<T>): Unsubscriber {
        this.#subs.add(sub);
        sub(this.#val);
        return () => {
            this.#subs.delete(sub);
        };
    }
}

export function writable<T>(init: T, eq?: EqualityCheck<T>) {
    return new WritableStore(init, eq);
}
