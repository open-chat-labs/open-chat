import { writable } from "svelte/store";
import type { BaseEmoji } from "emoji-mart";
const { subscribe, set } = writable<BaseEmoji | undefined>(undefined);

export const emojiStore = {
    subscribe,
    set,
};
