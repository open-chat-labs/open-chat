export class Lazy<T> {
    #value: T | undefined;

    constructor(private readonly initFn: () => T) {}

    public get(): T {
        return this.#value ??= this.initFn();
    }
}