import { writable } from "svelte/store";

export const messageFilters = writable<RegExp[]>([]);