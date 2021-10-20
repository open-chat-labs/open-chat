import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

const store = writable(new Set<string>());
export const blockedUsers = {
    ...createSetStore(store),
    merge: (inbound: Set<string>) =>
        store.update((current) => {
            // if a user is in the inbound but not in the current that means we unblocked locally
            // anything that is in inbound but not in current should be added
            return current;
        }),
};
