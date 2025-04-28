import { MessageMap } from "openchat-shared";
import { writable } from "svelte/store";

type Lookup = MessageMap<string>;

const store = writable<Lookup>(new MessageMap());

export const translationStore = {
    subscribe: store.subscribe,
    translate: (messageId: bigint, translation: string): void =>
        store.update((lookup) => {
            lookup.set(messageId, translation);
            return lookup.clone();
        }),
    untranslate: (messageId: bigint): void =>
        store.update((lookup) => {
            lookup.delete(messageId);
            return lookup.clone();
        }),
};
