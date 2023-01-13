/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { writable } from "svelte/store";

const test = process.env.NODE_ENV === "test";

export function boolFromLS(key: string, def: boolean): boolean {
    if (test) return def;

    const val = localStorage.getItem(key);
    switch (val) {
        case "true":
            return true;
        case "false":
            return false;
        default:
            return def;
    }
}

export function createLsBoolStore(key: string, def: boolean) {
    const store = writable<boolean>(boolFromLS(key, def));
    return {
        subscribe: store.subscribe,
        set: (state: boolean): void =>
            store.update((_) => {
                if (!test) {
                    localStorage.setItem(key, state.toString());
                }
                return state;
            }),
        toggle: (): void =>
            store.update((val) => {
                if (!test) {
                    localStorage.setItem(key, (!val).toString());
                }
                return !val;
            }),
    };
}
