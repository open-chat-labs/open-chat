/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

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
    let store = $state(boolFromLS(key, def));
    return {
        get value() {
            return store;
        },
        set value(v: boolean) {
            store = v;
            if (!test) {
                localStorage.setItem(key, store.toString());
            }
        },
        toggle(): void {
            this.value = !this.value;
        },
    };
}
