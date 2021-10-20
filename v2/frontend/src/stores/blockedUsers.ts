import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

let initialised = false;
const store = writable(new Set<string>());
export const blockedUsers = {
    ...createSetStore(store),
    set: (val: Set<string>): void => {
        // we only want to set this once from the server
        // from then on we will maintain it locally
        if (!initialised) {
            store.set(val);
            initialised = true;
        }
    },
};
