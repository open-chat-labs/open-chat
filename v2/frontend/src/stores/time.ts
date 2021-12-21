import { writable } from "svelte/store";

// this is a fairly arbitrary interval but it seems about right
setInterval(() => {
    now.set(Date.now());
}, 5000);

export const now = writable(Date.now());
