export class Debouncer<T> {
    #timerId: number | undefined;

    constructor(private func: (input: T) => unknown, private delayMs: number) {}

    public execute(input: T) {
        window.clearTimeout(this.#timerId);
        this.#timerId = window.setTimeout(
            () => {
                this.#timerId = undefined;
                this.func(input);
            },
            this.delayMs);
    }
}