import { writable } from "svelte/store";

export const eventListScrollTop = writable<number | undefined>(undefined);

export const eventListLastScrolled = writable<number>(0);

export const eventListScrolling = writable<boolean>(false);

export const communityListScrollTop = writable<number | undefined>(undefined);
