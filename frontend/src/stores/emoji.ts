import { writable } from "svelte/store";
const { subscribe, set } = writable<string | undefined>(undefined);

export const emojiStore = {
    subscribe,
    set,
};
