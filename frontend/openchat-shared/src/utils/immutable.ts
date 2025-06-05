export class Immutable<T> {
    #original: Readonly<T>;
    #modified: T | undefined = undefined;

    constructor(value: T) {
        this.#original = value;
    }

    value(): Readonly<T> {
        return this.#modified ?? this.#original;
    }

    update(updater: (value: T) => void) {
        this.#modified ??= structuredClone(this.#original);
        updater(this.#modified);
    }
}