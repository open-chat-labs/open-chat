export class Immutable<T> {
    #original: Readonly<T>;
    #modified: T | undefined = undefined;
    #clone: (value: Readonly<T>) => T;

    // The clone function is called (at most once) on the first update. It defaults to a deep
    // clone; pass a cheaper cloner when you know which parts of the value the updaters touch.
    constructor(value: T, clone: (value: Readonly<T>) => T = structuredClone) {
        this.#original = value;
        this.#clone = clone;
    }

    value(): Readonly<T> {
        return this.#modified ?? this.#original;
    }

    update(updater: (value: T) => void) {
        this.#modified ??= this.#clone(this.#original);
        updater(this.#modified);
    }
}
