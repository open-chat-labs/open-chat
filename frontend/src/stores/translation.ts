import { writable } from "svelte/store";

type Lookup = Record<number, string>;

const store = writable<Lookup>({});

export const translationStore = {
    subscribe: store.subscribe,
    translate: (messageId: bigint, translation: string): void =>
        store.update((lookup) => {
            lookup[Number(messageId)] = translation;
            return lookup;
        }),
    untranslate: (messageId: bigint): void =>
        store.update((lookup) => {
            delete lookup[Number(messageId)];
            return lookup;
        }),
};
