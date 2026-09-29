// Runs async requests of which only the most recently started one may deliver its result. A
// response that arrives after a newer request has started is dropped, so a slow answer to an old
// question can't overwrite the answer to the current one.
export class LatestOnly {
    #latest = 0;

    public run<T>(request: () => Promise<T>, onResult: (value: T) => void): Promise<void> {
        const id = ++this.#latest;
        return request().then((value) => {
            if (id === this.#latest) {
                onResult(value);
            }
        });
    }
}
