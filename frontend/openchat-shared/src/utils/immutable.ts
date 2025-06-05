export class Immutable<T> {
    #original: Readonly<T>;
    #modified: T | undefined = undefined;

    constructor(value: T, devMode = false) {
        this.#original = devMode ? Object.freeze(value) : value;
    }

    value(): Readonly<T> {
        return this.#modified ?? this.#original;
    }

    update(updater: (value: T) => void) {
        this.#modified ??= structuredClone(this.#original);
        updater(this.#modified);
    }
}