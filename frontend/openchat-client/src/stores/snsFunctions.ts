import { writable } from "svelte/store";
import type { NervousSystemFunction } from "openchat-agent";

const storageKeyPrefix = "sns_functions_";

export class SnsFunctions {
    private _functionsMap: Map<string, Map<number, NervousSystemFunction>>;
    private _loaded: Set<string>;

    constructor() {
        this._functionsMap = new Map();
        this._loaded = new Set();
    }

    get(snsCanisterId: string): Map<number, NervousSystemFunction> | undefined {
        if (!this._loaded.has(snsCanisterId)) {
            this.fromStorage(snsCanisterId);
        }

        return this._functionsMap.get(snsCanisterId);
    }

    set(snsCanisterId: string, list: NervousSystemFunction[]): void {
        const functions = new Map(list.map((f): [number, NervousSystemFunction] => [f.id, f]));
        this._functionsMap.set(snsCanisterId, functions);
        this.toStorage(snsCanisterId);
    }

    clone(): SnsFunctions {
        const clone = new SnsFunctions();
        clone._functionsMap = new Map(this._functionsMap);
        clone._loaded = new Set(this._loaded);
        return clone;
    }

    private fromStorage(snsCanisterId: string) {
        const json = localStorage.getItem(storageKeyPrefix + snsCanisterId);
        if (json !== null) {
            this._functionsMap.set(snsCanisterId, new Map(JSON.parse(json)));
        }
        this._loaded.add(snsCanisterId);
    }

    private toStorage(snsCanisterId: string) {
        const functions = this._functionsMap.get(snsCanisterId);
        if (functions === undefined) {
            return;
        }

        localStorage.setItem(storageKeyPrefix + snsCanisterId, JSON.stringify([...functions]));
    }
}

const store = writable<SnsFunctions>(new SnsFunctions());

export const snsFunctions = {
    subscribe: store.subscribe,
    set: (snsCanisterId: string, list: NervousSystemFunction[]): void =>
        store.update((fs) => {
            const clone = fs.clone();
            clone.set(snsCanisterId, list);
            return clone;
        }),
};
