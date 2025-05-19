import type { Readable, StartStopNotifier, Subscriber, Unsubscriber, Updater, Writable } from "svelte/store";

export type ReadableStore<T> = Readable<T> & MaybeDirty;
export type WritableStore<T> = Writable<T> & MaybeDirty;
export type EqualityCheck<T> = (a: T, b: T) => boolean;
type MaybeDirty = { maybeDirty() : boolean };
type Stores = ReadableStore<unknown> | [ReadableStore<unknown>, ...Array<ReadableStore<unknown>>] | Array<ReadableStore<unknown>>;
type StoresValues<T> =
    T extends ReadableStore<infer U> ? U : { [K in keyof T]: T[K] extends ReadableStore<infer U> ? U : never };

let paused = false;
let publishesPending: (() => void)[] = [];

export function pauseStores() {
    paused = true;
}

export function unpauseStores() {
    if (paused) {
        // Publish any dirty values
        for (const callback of publishesPending) {
            callback();
        }
        publishesPending = [];
    }
    paused = false;
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

export function derived<S extends Stores, T>(stores: S, fn: (values: StoresValues<S>) => T, equalityCheck?: EqualityCheck<T>): ReadableStore<T> {
    return new _Derived(stores, fn, equalityCheck ?? ((a, b) => a === b));
}

class _Writable<T> {
    #subscriptions: Map<symbol, (value: T) => void> = new Map();
    #value: T;
    #dirtyValue: T | undefined = undefined;
    #publishPending: boolean = false;
    readonly #start: StartStopNotifier<T> | undefined;
    #stop: Unsubscriber | undefined = undefined;
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
        if (this.#subscriptions.size === 0 && typeof this.#stop === "function") {
            this.#stop();
        }
    }
}

class _Derived<S extends Stores, T> {
    readonly #subscriptions: Map<symbol, (value: T) => void> = new Map();
    readonly #storesArray: ReadableStore<unknown>[] = [];
    readonly #storeValues: unknown[] = [];
    readonly #single;
    readonly #fn: (values: StoresValues<S>) => T;
    readonly #equalityCheck: (a: T, b: T) => boolean;
    #value: T | undefined;
    #started = false;
    #unsubscribers: Unsubscriber[] = [];

    constructor(stores: S, fn: (values: StoresValues<S>) => T, equalityCheck: EqualityCheck<T>) {
        this.#storesArray = Array.isArray(stores) ? stores : [stores];
        this.#single = this.#storesArray.length === 1;
        this.#fn = fn;
        this.#equalityCheck = equalityCheck;
    }

    subscribe(subscriber: Subscriber<T>): Unsubscriber {
        const id = Symbol();
        this.#subscriptions.set(id, subscriber);

        if (this.#subscriptions.size === 1 && this.#start !== undefined) {
            this.#start();
        }

        subscriber(this.#value!);
        return () => this.#unsubscribe(id);
    }

    maybeDirty(): boolean {
        return this.#storesArray.some((s) => s.maybeDirty());
    }

    #start() {
        if (this.#started) return;
        for (const [index, store] of this.#storesArray.entries()) {
            const unsub = store.subscribe((v) => {
                (this.#storeValues as unknown[])[index] = v;
                if (this.#started) {
                    this.#sync();
                }
            });
            if (typeof unsub === 'function') {
                this.#unsubscribers.push(unsub);
            }
        }
        this.#started = true;
        this.#sync();
    }

    #sync() {
        if (this.#storesArray.some((s) => s.maybeDirty())) {
            return;
        }
        const newValue = this.#fn((this.#single ? this.#storeValues[0] : this.#storeValues) as StoresValues<S>);
        if (this.#value !== undefined && this.#equalityCheck(newValue, this.#value)) {
            return;
        }

        this.#value = newValue;
    }

    #unsubscribe(id: symbol) {
        this.#subscriptions.delete(id);
        if (this.#subscriptions.size === 0) {
            for (const unsub of this.#unsubscribers) {
                unsub();
            }
            this.#unsubscribers = [];
            this.#started = false;
        }
    }
}
