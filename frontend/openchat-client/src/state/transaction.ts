type PublishFunction = () => void;

export class StoreTransaction {
    #pubs: PublishFunction[] = [];

    push(pub: PublishFunction) {
        this.#pubs.push(pub);
    }

    commit() {
        this.#pubs.forEach((p) => p());
        this.#pubs = [];
    }
}
