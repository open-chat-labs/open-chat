import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

const store = writable(new Set<string>());
export const blockedUsers = {
    ...createSetStore(store),
};
