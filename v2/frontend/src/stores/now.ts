import { writable } from "svelte/store";

setInterval(() => {
    now.set(Date.now());
}, 5000);

export const now = writable(Date.now());
