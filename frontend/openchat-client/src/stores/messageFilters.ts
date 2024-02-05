import { writable } from "svelte/store";

export type MessageFilter = {
    id: bigint;
    regex: RegExp;
};

export const messageFiltersStore = writable<MessageFilter[]>([]);