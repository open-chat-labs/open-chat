import type { OptionUpdate } from "@shared";

export class Updatable<T> {
    #value: T;
    #updated = false;

    constructor(value: T, updated = false) {
        this.#value = value;
        this.#updated = updated;
    }

    get value() {
        return this.#value;
    }

    set value(value: T) {
        if (this.#value !== value) {
            this.#value = value;
            this.#updated = true;
        }
    }

    get updated() {
        return this.#updated;
    }

    updateIfNotUndefined(value: T | undefined) {
        if (value !== undefined) {
            this.value = value;
        }
    }

    mutate(fn: (current: T) => void) {
        fn(this.#value);
        this.#updated = true;
    }
}

export class UpdatableOption<T> {
    #value: T | undefined;
    #updated = false;

    constructor(value: T | undefined, updated = false) {
        this.#value = value;
        this.#updated = updated;
    }

    get value(): T | undefined {
        return this.#value;
    }

    set value(value: T | undefined) {
        this.#value = value;
        this.#updated = true;
    }

    get updated() {
        return this.#updated;
    }

    applyOptionUpdate(update: OptionUpdate<T>) {
        if (update !== undefined) {
            if (update === "set_to_none") {
                this.value = undefined;
            } else {
                this.value = update.value;
            }
        }
    }
}
