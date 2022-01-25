import type { ScrollStrategy } from "../domain/chat/chat";
import { writable } from "svelte/store";

function boolFromLS(key: string, def: boolean): boolean {
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

export const enterSend = createLsBoolStore("openchat_entersend", true);

function createLsBoolStore(key: string, def: boolean) {
    const store = writable<boolean>(boolFromLS(key, def));
    return {
        subscribe: store.subscribe,
        toggle: (): void =>
            store.update((val) => {
                localStorage.setItem(key, (!val).toString());
                return !val;
            }),
    };
}

const scrollStratStore = writable<ScrollStrategy>(
    (localStorage.getItem("openchat_scrollstrategy") || "latestMessage") as ScrollStrategy
);

export const scrollStrategy = {
    subscribe: scrollStratStore.subscribe,
    set: (strategy: ScrollStrategy): void => {
        scrollStratStore.set(strategy);
        localStorage.setItem("openchat_scrollstrategy", strategy);
    },
};
