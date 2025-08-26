import { NOOP } from "openchat-shared";
import { untrack } from "svelte";
import type {
    StartStopNotifier,
    Subscriber,
    Readable as SvelteReadable,
    Writable as SvelteWritable,
    Unsubscriber,
    Updater,
} from "svelte/store";

export type { StartStopNotifier, Subscriber, Unsubscriber, Updater } from "svelte/store";
export type EqualityCheck<T> = (a: T, b: T) => boolean;

export interface Readable<T> extends SvelteReadable<T> {
    get value(): T;
    get dirty(): boolean;
}
export interface Writable<T> extends SvelteWritable<T>, Readable<T> {}

type Stores =
    | SvelteReadable<unknown>
    | [SvelteReadable<unknown>, ...Array<SvelteReadable<unknown>>]
    | Array<SvelteReadable<unknown>>;
type StoresValues<T> = T extends SvelteReadable<infer U>
    ? U
    : { [K in keyof T]: T[K] extends SvelteReadable<infer U> ? U : never };

let pauseCount = 0;
// Callbacks to publish dirty values from writable stores
const publishesPending: (() => void)[] = [];
// Callbacks to push new values to their subscribers
let subscriptionsPending: (() => void)[] = [];
// Callbacks to retry syncing derived stores whose dependencies were dirty when last attempted
let derivedStoresToRetry: (() => void)[] = [];

export function withPausedStores<T>(fn: () => T) {
    try {
        pauseCount++;
        return fn();
    } finally {
        if (pauseCount === 1) {
            // Publish all changes to writable stores
            executeCallbacks(publishesPending);

            // Unpause
            pauseCount = 0;

            // Run the derived store subscriptions
            runSubscriptions();
        } else {
            pauseCount--;
        }
    }
}

function runSubscriptions() {
    while (subscriptionsPending.length > 0) {
        // Execute all pending subscription callbacks
        executeCallbacks(subscriptionsPending);

        // Once the subscriptions are processed, queue up any derived stores which need to be retried and loop again
        subscriptionsPending = derivedStoresToRetry;
        derivedStoresToRetry = [];
    }
}

function executeCallbacks(callbacks: (() => void)[]) {
    for (let index = 0; index < callbacks.length; index++) {
        callbacks[index]();
    }
    callbacks.length = 0;
}

export function writable<T>(
    value: T,
    start?: StartStopNotifier<T>,
    equalityCheck?: EqualityCheck<T>,
): Writable<T> {
    return new _Writable(value, start, equalityCheck);
}

export function readable<T>(
    value: T,
    start: StartStopNotifier<T>,
    equalityCheck?: EqualityCheck<T>,
): Readable<T> {
    const store = writable(value, start, equalityCheck);
    return {
        subscribe: (subscriber: Subscriber<T>, invalidate?: () => void) =>
            store.subscribe(subscriber, invalidate),
        value: store.value,
        dirty: store.dirty,
    };
}

export function derived<S extends Stores, T>(
    stores: S,
    fn: (values: StoresValues<S>) => T,
    equalityCheck?: EqualityCheck<T>,
): Readable<T> {
    return new _Derived(stores, fn, equalityCheck ?? ((a, b) => a === b));
}

export function get<T>(store: Readable<T>): T {
    return store.value;
}

class _Writable<T> {
    readonly #subscriptions: Map<symbol, [(value: T) => void, (() => void) | undefined]> =
        new Map();
    readonly #start: StartStopNotifier<T> | undefined;
    readonly #equalityCheck: (a: T, b: T) => boolean;
    #value: T;
    #publishPending: boolean = false;
    #started: boolean = false;
    #stop: Unsubscriber | undefined = undefined;

    constructor(
        initValue: T,
        start?: StartStopNotifier<T>,
        equalityCheck?: (a: T, b: T) => boolean,
    ) {
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
                if (typeof stop === "function") {
                    this.#stop = stop;
                }
            }
            this.#started = true;
        }

        subscriber(this.#value);
        return () => this.#unsubscribe(id);
    }

    get value(): T {
        return this.#value;
    }

    set(newValue: T) {
        if (this.#started && this.#equalityCheck(newValue, this.#value)) {
            return;
        }

        this.#value = newValue;

        if (pauseCount === 0 || !this.#started) {
            this.#publishPending = true;
            this.#publish();
        } else {
            if (!this.#publishPending) {
                // Register callback to publish the new value once stores are unpaused
                publishesPending.push(() => this.#publish());
                this.#publishPending = true;
            }
        }
    }

    update(updateFn: Updater<T>) {
        const newValue = updateFn(this.#value);
        this.set(newValue);
    }

    get dirty(): boolean {
        return this.#publishPending;
    }

    #publish() {
        if (this.#publishPending) {
            this.#publishPending = false;

            if (this.#started) {
                const shouldRunSubscriptions =
                    pauseCount === 0 && subscriptionsPending.length === 0;

                for (const [subscription, invalidate] of this.#subscriptions.values()) {
                    invalidate?.();
                    subscriptionsPending.push(() => subscription(this.#value));
                }

                if (shouldRunSubscriptions) {
                    runSubscriptions();
                }
            }
        }
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
}

class _Derived<S extends Stores, T> {
    readonly #innerStore: _Writable<T>;
    readonly #storesArray: Readable<unknown>[] = [];
    readonly #storeValues: unknown[] = [];
    readonly #single;
    readonly #fn: (values: StoresValues<S>) => T;
    #started = false;
    #recalculationPending = false;
    #queuedForRetry = false;
    #dependenciesPending = 0;
    #unsubscribers: Unsubscriber[] = [];
    // The first time you call `value` a subscription will be created, ensuring subsequent accesses are fast
    // eslint-disable-next-line no-unused-private-class-members
    #valueSubscriber: Unsubscriber | undefined = undefined;

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
        this.#valueSubscriber ??= this.subscribe(NOOP);
        return this.#innerStore.value;
    }

    get dirty(): boolean {
        return this.#recalculationPending || this.#dependenciesDirty();
    }

    #start() {
        if (this.#started) return;
        for (const [index, store] of this.#storesArray.entries()) {
            const unsub = untrack(() =>
                store.subscribe(
                    (v) => {
                        (this.#storeValues as unknown[])[index] = v;
                        this.#dependenciesPending &= ~(1 << index);
                        this.#recalculationPending = true;
                        if (this.#started) {
                            this.#sync(false);
                        }
                    },
                    () => (this.#dependenciesPending |= 1 << index),
                ),
            );
            if (typeof unsub === "function") {
                this.#unsubscribers.push(unsub);
            }
        }
        this.#started = true;
        this.#sync(true);
        return () => this.#stop();
    }

    #stop() {
        for (const unsub of this.#unsubscribers) {
            unsub();
        }
        this.#unsubscribers = [];
        this.#started = false;
    }

    #sync(force: boolean) {
        if (!force) {
            // Exit early if no recalculation required
            if (!this.#recalculationPending) {
                return;
            }
            // If any dependencies are still dirty, queue this store to be retried
            if (this.#dependenciesDirty()) {
                if (!this.#queuedForRetry) {
                    derivedStoresToRetry.push(() => {
                        this.#queuedForRetry = false;
                        this.#sync(false);
                    });
                    this.#queuedForRetry = true;
                }
                return;
            }
        }

        const newValue = this.#fn(
            (this.#single ? this.#storeValues[0] : this.#storeValues) as StoresValues<S>,
        );
        this.#recalculationPending = false;
        this.#innerStore.set(newValue);
    }

    #dependenciesDirty() {
        return this.#dependenciesPending !== 0 || this.#storesArray.some((s) => s.dirty);
    }
}

function convertStore<T>(store: Readable<T> | SvelteReadable<T>): Readable<T> {
    if (store === undefined) {
        const err = new Error();
        console.log(err.stack);
    }
    if ("dirty" in store && "value" in store) {
        return store;
    }
    let value: T;
    store.subscribe((v) => (value = v));
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
