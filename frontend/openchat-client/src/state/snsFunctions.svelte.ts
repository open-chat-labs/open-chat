import type { NervousSystemFunction } from "@shared";
import { SvelteMap } from "svelte/reactivity";

const storageKeyPrefix = "sns_functions_";

export class SnsFunctions {
    private _functionsMap: Map<string, Map<number, NervousSystemFunction>>;

    // Everything cached in localStorage is loaded up front so that `get` stays pure - it is called
    // from within a derived store and must not read storage or write reactive state.
    constructor() {
        this._functionsMap = new SvelteMap();
        this.fromStorage();
    }

    get(snsCanisterId: string): Map<number, NervousSystemFunction> | undefined {
        return this._functionsMap.get(snsCanisterId);
    }

    set(snsCanisterId: string, list: NervousSystemFunction[]): void {
        const functions = new Map(list.map((f): [number, NervousSystemFunction] => [f.id, f]));
        this._functionsMap.set(snsCanisterId, functions);
        this.toStorage(snsCanisterId);
    }

    private fromStorage() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key === null || !key.startsWith(storageKeyPrefix)) continue;
            const json = localStorage.getItem(key);
            if (json === null) continue;
            try {
                this._functionsMap.set(
                    key.slice(storageKeyPrefix.length),
                    new Map(JSON.parse(json)),
                );
            } catch {
                // ignore anything we can't parse - it will be refreshed from the governance canister
            }
        }
    }

    private toStorage(snsCanisterId: string) {
        const functions = this._functionsMap.get(snsCanisterId);
        if (functions === undefined) {
            return;
        }

        localStorage.setItem(storageKeyPrefix + snsCanisterId, JSON.stringify([...functions]));
    }
}
