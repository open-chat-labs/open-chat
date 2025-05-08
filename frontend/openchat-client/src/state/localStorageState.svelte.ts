export class LocalStorageState<V> {
    #key: string;
    #defVal: V;
    #serialise: (key: V) => string;
    #deserialise: (key: string) => V;
    #value = $state<V>();

    #initialise(): V {
        const val = localStorage.getItem(this.#key);
        if (val == null) {
            return this.#defVal;
        }
        return this.#deserialise(val);
    }

    constructor(
        key: string,
        defVal: V,
        serialiser?: (key: V) => string,
        deserialiser?: (primitive: string) => V,
    ) {
        this.#key = key;
        this.#defVal = defVal;
        this.#serialise = serialiser ?? ((v) => v as string);
        this.#deserialise = deserialiser ?? ((v) => v as V);
        this.#value = this.#initialise();
    }

    get value(): V {
        return this.#value ?? this.#defVal;
    }

    set value(val: V | undefined) {
        if (val === undefined) {
            localStorage.removeItem(this.#key);
        } else {
            localStorage.setItem(this.#key, this.#serialise(val));
        }
        this.#value = val;
    }
}

export class LocalStorageBoolState extends LocalStorageState<boolean> {
    constructor(key: string, defVal: boolean) {
        super(key, defVal);
    }

    toggle() {
        this.value = !this.value;
    }
}
