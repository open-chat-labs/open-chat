import { type Updater, type Writable, writable } from "svelte/store";

export class PausableStoreManager {
    #paused = false;
    #callbacks: (() => void)[] = [];

    create<T>(initialValue: T): PausableStore<T> {
        return new PausableStore(initialValue, this);
    }

    registerCallback(callback: () => void) {
        this.#callbacks.push(callback);
    }

    get paused() {
        return this.#paused
    }

    set paused(value: boolean) {
        if (!value) {
            for (const callback of this.#callbacks) {
                callback();
            }
            this.#callbacks = [];
        }
        this.#paused = value;
    }
}

export class PausableStore<T> {
    #store: Writable<T>;
    #value: T;
    #dirtyValue: T | undefined  = undefined;
    #parent: PausableStoreManager;

    constructor(initValue: T, parent: PausableStoreManager) {
        this.#store = writable(initValue);
        this.#value = initValue;
        this.#parent = parent;

        this.#store.subscribe((v) => this.#value = v);
    }

    value(allowDirty = false): T {
        return allowDirty && this.#dirtyValue !== undefined
            ? this.#dirtyValue
            : this.#value;
    }

    set(newValue: T) {
        if (this.#parent.paused) {
            this.#dirtyValue = newValue;
            this.#parent.registerCallback(() => {
                if (this.#dirtyValue !== undefined) {
                    this.#store.set(this.#dirtyValue);
                    this.#dirtyValue = undefined;
                }
            });
        } else {
            this.#store.set(newValue);
        }
    }

    update(updater: Updater<T>) {
        const input = this.#dirtyValue ?? this.#value;
        const newValue = updater(input);
        this.set(newValue);
    }
}