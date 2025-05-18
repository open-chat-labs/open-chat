import type { Readable, StartStopNotifier, Subscriber, Unsubscriber, Updater, Writable } from "svelte/store";

export type ReadableStore<T> = Readable<T> & MaybeDirty;
export type WritableStore<T> = Writable<T> & MaybeDirty;
export type EqualityCheck<T> = (a: T, b: T) => boolean;
type MaybeDirty = { maybeDirty() : boolean };
type Stores = ReadableStore<unknown> | [ReadableStore<unknown>, ...Array<ReadableStore<unknown>>] | Array<ReadableStore<unknown>>;
type StoresValues<T> =
    T extends Readable<infer U> ? U : { [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

let paused = false;
let publishesPending: (() => void)[] = [];

export function setPaused(value: boolean) {
    if (paused && !value) {
        // Publish any dirty values
        for (const callback of publishesPending) {
            callback();
        }
        publishesPending = [];
    }
    paused = value;
}

export function writable<T>(value: T, start?: StartStopNotifier<T>, equalityCheck?: EqualityCheck<T>): WritableStore<T> {
    return new _Writable(value, start, equalityCheck);
}

export function readable<T>(value: T, start: StartStopNotifier<T>): ReadableStore<T> {
    const store = writable(value, start);
    return {
        subscribe: store.subscribe,
        maybeDirty: store.maybeDirty,
    };
}

export function derived<S extends Stores, T>(_stores: S, _fn: (values: StoresValues<S>) => T, _initial_value?: T | undefined): ReadableStore<T> {
    throw new Error('not implemented');
}

class _Writable<T> {
    #subscriptions: Map<symbol, (value: T) => void> = new Map();
    #value: T;
    #dirtyValue: T | undefined = undefined;
    #publishPending: boolean = false;
    #stop: Unsubscriber | undefined = undefined;
    readonly #start: StartStopNotifier<T> | undefined;
    readonly #equalityCheck: (a: T, b: T) => boolean;

    constructor(initValue: T, start?: StartStopNotifier<T>, equalityCheck?: (a: T, b: T) => boolean) {
        this.#value = initValue;
        this.#start = start;
        this.#equalityCheck = equalityCheck ?? ((a, b) => a === b);
    }

    subscribe(subscriber: Subscriber<T>): Unsubscriber {
        const id = Symbol();
        this.#subscriptions.set(id, subscriber);

        if (this.#subscriptions.size === 1 && this.#start !== undefined) {
            this.#stop = this.#start(this.set, this.update) ?? undefined;
        }

        subscriber(this.#value);
        return () => this.#unsubscribe(id);
    }

    value(allowDirty = false): T {
        return allowDirty && this.#dirtyValue !== undefined
            ? this.#dirtyValue
            : this.#value;
    }

    set(newValue: T) {
        if (this.#equalityCheck(newValue, this.#value)) {
            this.#dirtyValue = undefined;
            return;
        }

        this.#dirtyValue = newValue;

        if (paused) {
            if (!this.#publishPending) {
                // Register callback to publish the new value once the store is unpaused
                publishesPending.push(() => this.#publish());
                this.#publishPending = true;
            }
        } else {
            this.#publish();
        }
    }

    update(updater: Updater<T>) {
        const input = this.#dirtyValue ?? this.#value;
        const newValue = updater(input);
        this.set(newValue);
    }

    maybeDirty(): boolean {
        return this.#dirtyValue !== undefined;
    }

    #publish() {
        if (this.#dirtyValue !== undefined) {
            this.#value = this.#dirtyValue;

            for (const subscription of this.#subscriptions.values()) {
                subscription(this.#value);
            }

            this.#dirtyValue = undefined
        }
        this.#publishPending = false;
    }

    #unsubscribe(id: symbol) {
        this.#subscriptions.delete(id);
        if (this.#subscriptions.size === 0 && this.#stop !== undefined) {
            this.#stop();
        }
    }
}
