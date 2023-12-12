import { writable } from "svelte/store";

export const messageFiltersStore = writable<RegExp[]>([]);