import { WritableStore, type EqualityCheck } from "./writable";

export class LocalStorageStore<V> extends WritableStore<V> {
    #key: string;
    #serialise: (key: V) => string;
    #deserialise: (key: string) => V;

    #initialise() {
        const val = localStorage.getItem(this.#key);
        if (val != null) {
            super.set(this.#deserialise(val));
        }
    }

    constructor(
        key: string,
        defVal: V,
        serialiser?: (key: V) => string,
        deserialiser?: (primitive: string) => V,
        eq?: EqualityCheck<V>,
    ) {
        super(defVal, eq);
        this.#key = key;
        this.#serialise = serialiser ?? ((v) => v as string);
        this.#deserialise = deserialiser ?? ((v) => v as V);
        this.#initialise();
    }

    set(val: V) {
        if (val === undefined) {
            localStorage.removeItem(this.#key);
        } else {
            localStorage.setItem(this.#key, this.#serialise(val));
        }
        super.set(val);
    }
}

export class LocalStorageBoolStore extends LocalStorageStore<boolean> {
    constructor(key: string, defVal: boolean) {
        super(
            key,
            defVal,
            (b) => b.toString(),
            (b) => b === "true",
        );
    }

    toggle = () => {
        this.set(!this.current);
    };
}
