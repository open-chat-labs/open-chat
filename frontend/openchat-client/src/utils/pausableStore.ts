import type { Subscriber, Unsubscriber, Updater } from "svelte/store";
import { tick } from "svelte";

export class PausableStoreManager {
    #paused = false;
    #callbacks: (() => void)[] = [];

    create<T>(initialValue: T, equalityCheck?: (a: T, b: T) => boolean): PausableStore<T> {
        return new PausableStore(initialValue, equalityCheck ?? ((a, b) => a === b), this);
    }

    registerCallback(callback: () => void) {
        this.#callbacks.push(callback);
    }

    pauseForOneTick() {
        this.#paused = true;
        tick().then(() => {
            this.#paused = false;
        })
    }

    get paused() {
        return this.#paused
    }

    set paused(value: boolean) {
        if (!value) {
            // Flush any dirty values
            for (const callback of this.#callbacks) {
                callback();
            }
            this.#callbacks = [];
        }
        this.#paused = value;
    }
}

export class PausableStore<T> {
    #subscriptions: Map<symbol, (value: T) => void> = new Map();
    #value: T;
    #dirtyValue: T | undefined  = undefined;
    readonly #equalityCheck: (a: T, b: T) => boolean;
    readonly #parent: PausableStoreManager;

    constructor(initValue: T, equalityCheck: (a: T, b: T) => boolean, parent: PausableStoreManager) {
        this.#value = initValue;
        this.#equalityCheck = equalityCheck;
        this.#parent = parent;
    }

    subscribe(subscriber: Subscriber<T>): Unsubscriber {
        const id = Symbol();
        this.#subscriptions.set(id, subscriber);
        subscriber(this.#value);
        return () => this.#subscriptions.delete(id);
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

        if (this.#parent.paused) {
            // Register callback to publish the new value once the store is unpaused
            this.#parent.registerCallback(() => this.#publish());
        } else {
            this.#publish();
        }
    }

    update(updater: Updater<T>) {
        const input = this.#dirtyValue ?? this.#value;
        const newValue = updater(input);
        this.set(newValue);
    }

    #publish() {
        if (this.#dirtyValue !== undefined) {
            this.#value = this.#dirtyValue;
            this.#dirtyValue = undefined

            for (const subscription of this.#subscriptions.values()) {
                subscription(this.#value);
            }
        }
    }
}