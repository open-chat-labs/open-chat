import { writable } from "svelte/store";

type Lookup = Map<number, string>;

const store = writable<Lookup>(new Map());

export const translationStore = {
    subscribe: store.subscribe,
    translate: (messageId: bigint, translation: string): void =>
        store.update((lookup) => {
            lookup.set(Number(messageId), translation);
            return new Map([...lookup]);
        }),
    untranslate: (messageId: bigint): void =>
        store.update((lookup) => {
            lookup.delete(Number(messageId));
            return new Map([...lookup]);
        }),
};
