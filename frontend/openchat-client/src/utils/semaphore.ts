export class Semaphore {
    #queue: (() => Promise<unknown>)[] = [];
    #available: number;

    constructor(max: number) {
        this.#available = max;
    }

    execute<T>(func: () => Promise<T>) {
        return new Promise<T>((resolve, reject) => {
            const wrapped = () => func().then(resolve).catch(reject);
            if (this.#available > 0) {
                this.#available--;
                wrapped().finally(() => this.onComplete());
            } else {
                this.#queue.push(wrapped);
            }
        });
    }

    private onComplete() {
        const next = this.#queue.shift();
        if (next) {
            next().finally(() => this.onComplete());
        } else {
            this.#available++;
        }
    }
}