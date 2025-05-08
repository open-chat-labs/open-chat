import type { NervousSystemFunction } from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

const storageKeyPrefix = "sns_functions_";

export class SnsFunctions {
    private _functionsMap: SvelteMap<string, Map<number, NervousSystemFunction>>;
    private _loaded: SvelteSet<string>;

    constructor() {
        this._functionsMap = new SvelteMap();
        this._loaded = new SvelteSet();
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
