import { writable } from "svelte/store";
import { MessageMap } from "openchat-shared";

type Lookup = MessageMap<string>;

const store = writable<Lookup>(new MessageMap());

export const translationStore = {
    subscribe: store.subscribe,
    translate: (messageId: bigint, translation: string): void =>
        store.update((lookup) => {
            lookup.set(messageId, translation);
            return new MessageMap(lookup.entries());
        }),
    untranslate: (messageId: bigint): void =>
        store.update((lookup) => {
            lookup.delete(messageId);
            return new MessageMap(lookup.entries());
        }),
};
