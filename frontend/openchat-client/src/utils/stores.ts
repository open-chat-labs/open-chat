import type { StartStopNotifier, Readable as SvelteReadable, Subscriber, Writable as SvelteWritable, Unsubscriber, Updater } from "svelte/store";
export type { StartStopNotifier, Subscriber, Unsubscriber, Updater } from "svelte/store";
import { untrack } from "svelte";

export type Readable<T> = SvelteReadable<T> & { get value(): T } & MaybeDirty;
export type Writable<T> = SvelteWritable<T> & { get value(): T } & MaybeDirty;
export type EqualityCheck<T> = (a: T, b: T) => boolean;
type MaybeDirty = { get dirty() : boolean };
type Stores = SvelteReadable<unknown> | [SvelteReadable<unknown>, ...Array<SvelteReadable<unknown>>] | Array<SvelteReadable<unknown>>;
type StoresValues<T> =
    T extends SvelteReadable<infer U> ? U : { [K in keyof T]: T[K] extends SvelteReadable<infer U> ? U : never };

let paused = false;
// Callbacks to publish dirty values from writable stores
let publishesPending: (() => void)[] = [];
// Callbacks to push new values to their subscribers
let subscriptionsPending: (() => void)[] = [];

const NOOP = () => {};

export function pauseStores() {
    paused = true;
}

export function unpauseStores() {
    if (!paused) return;

    // Publish the changes to the writable stores
    for (const callback of publishesPending) {
        callback();
    }
    publishesPending = [];
    paused = false;

    // Run the derived store subscriptions
    runSubscriptions();
}

function runSubscriptions() {
    for (const callback of subscriptionsPending) {
        callback();
    }
    subscriptionsPending = [];
}

export function writable<T>(value: T, start?: StartStopNotifier<T>, equalityCheck?: EqualityCheck<T>): Writable<T> {
    return new _Writable(value, start, equalityCheck);
}

export function readable<T>(value: T, start: StartStopNotifier<T>, equalityCheck?: EqualityCheck<T>): Readable<T> {
    const store = writable(value, start, equalityCheck);
    return {
        subscribe: store.subscribe,
        value: store.value,
        dirty: store.dirty,
    };
}

export function derived<S extends Stores, T>(stores: S, fn: (values: StoresValues<S>) => T, equalityCheck?: EqualityCheck<T>): Readable<T> {
    return new _Derived(stores, fn, equalityCheck ?? ((a, b) => a === b));
}

export function get<T>(store: Readable<T>): T {
    return store.value;
}

class _Writable<T> {
    readonly #subscriptions: Map<symbol, [(value: T) => void, (() => void) | undefined]> = new Map();
    readonly #start: StartStopNotifier<T> | undefined;
    readonly #equalityCheck: (a: T, b: T) => boolean;
    #value: T;
    #dirty: boolean = false;
    #dirtyValue: T | undefined = undefined;
    #publishPending: boolean = false;
    #started: boolean = false;
    #stop: Unsubscriber | undefined = undefined;

    constructor(initValue: T, start?: StartStopNotifier<T>, equalityCheck?: (a: T, b: T) => boolean) {
        this.#value = initValue;
        this.#start = start;
        this.#equalityCheck = equalityCheck ?? ((a, b) => a === b);
    }

    subscribe(subscriber: Subscriber<T>, invalidate?: () => void): Unsubscriber {
        const id = Symbol();
        this.#subscriptions.set(id, [subscriber, invalidate]);

        if (this.#subscriptions.size === 1) {
            if (this.#start !== undefined) {
                const stop = this.#start(this.set, this.update);
                if (typeof stop === 'function') {
                    this.#stop = stop;
                }
            }
            this.#started = true;
        }

        subscriber(this.#value);
        return () => this.#unsubscribe(id);
    }

    get value(): T {
        return this.#dirty ? this.#dirtyValue as T : this.#value;
    }

    set(newValue: T) {
        if (this.#equalityCheck(newValue, this.#value)) {
            this.#resetDirtyValue();
            return;
        }

        this.#setDirtyValue(newValue);

        if (paused) {
            if (!this.#publishPending) {
                // Register callback to publish the new value once stores are unpaused
                publishesPending.push(() => this.#publish());
                this.#publishPending = true;
            }
        } else {
            this.#publish();
        }
    }

    update(updateFn: Updater<T>) {
        const newValue = updateFn(this.#value);
        this.set(newValue);
    }

    get dirty(): boolean {
        return this.#dirty;
    }

    #publish() {
        if (this.#dirty) {
            this.#value = this.#dirtyValue as T;
            this.#resetDirtyValue();

            if (this.#started) {
                const shouldRunSubscriptions = !paused && subscriptionsPending.length === 0;
                for (const [subscription, invalidate] of this.#subscriptions.values()) {
                    invalidate?.();
                    subscriptionsPending.push(() => subscription(this.#value));
                }

                if (shouldRunSubscriptions) {
                    runSubscriptions();
                }
            }
        }
        this.#publishPending = false;
    }

    #unsubscribe(id: symbol) {
        this.#subscriptions.delete(id);
        if (this.#subscriptions.size === 0) {
            if (typeof this.#stop === "function") {
                this.#stop();
            }
            this.#started = false;
        }
    }

    #setDirtyValue(value: T) {
        this.#dirtyValue = value;
        this.#dirty = true;
    }

    #resetDirtyValue() {
        this.#dirtyValue = undefined;
        this.#dirty = false;
    }
}

class _Derived<S extends Stores, T> {
    readonly #innerStore: _Writable<T>;
    readonly #storesArray: Readable<unknown>[] = [];
    readonly #storeValues: unknown[] = [];
    readonly #single;
    readonly #fn: (values: StoresValues<S>) => T;
    #started = false;
    #pending = 0;
    #unsubscribers: Unsubscriber[] = [];

    constructor(stores: S, fn: (values: StoresValues<S>) => T, equalityCheck?: EqualityCheck<T>) {
        this.#innerStore = new _Writable(undefined as T, (_) => this.#start(), equalityCheck);
        const isArray = Array.isArray(stores);
        this.#single = !isArray;
        this.#storesArray = isArray ? stores.map(convertStore) : [convertStore(stores)];
        this.#fn = fn;
    }

    subscribe(subscriber: Subscriber<T>, invalidate?: () => void): Unsubscriber {
        return this.#innerStore.subscribe(subscriber, invalidate);
    }

    get value(): T {
        const unsub = this.#started ? undefined : this.subscribe(NOOP);
        const value = this.#innerStore.value;
        unsub?.();
        return value;
    }

    get dirty(): boolean {
        return this.#pending !== 0 || this.#storesArray.some((s) => s.dirty);
    }

    #start() {
        if (this.#started) return;
        for (const [index, store] of this.#storesArray.entries()) {
            const unsub = untrack(() => store.subscribe(
                (v) => {
                    (this.#storeValues as unknown[])[index] = v;
                    this.#pending &= ~(1 << index);
                    if (this.#started) {
                        this.#sync();
                    }
                },
                () => this.#pending |= 1 << index
            ));
            if (typeof unsub === 'function') {
                this.#unsubscribers.push(unsub);
            }
        }
        this.#started = true;
        this.#sync();
        return () => this.#stop();
    }

    #stop() {
        for (const unsub of this.#unsubscribers) {
            unsub();
        }
        this.#unsubscribers = [];
        this.#started = false;
    }

    #sync() {
        if (this.dirty) {
            return;
        }
        const newValue = this.#fn((this.#single ? this.#storeValues[0] : this.#storeValues) as StoresValues<S>);
        this.#innerStore.set(newValue);
    }
}

function convertStore<T>(store: Readable<T> | SvelteReadable<T>): Readable<T> {
    if ("dirty" in store && "value" in store) {
        return store;
    }
    let value: T;
    store.subscribe((v) => value = v);
    return {
        subscribe: (start, invalidate) => store.subscribe(start, invalidate),
        get dirty() {
            return false;
        },
        get value() {
            return value;
        },
    };
}
