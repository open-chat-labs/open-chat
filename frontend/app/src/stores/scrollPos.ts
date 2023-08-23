import { writable } from "svelte/store";

export const chatListScroll = writable<number>(0);

export const eventListScrollTop = writable<number | undefined>(undefined);

export const eventListLastScrolled = writable<number>(0);
