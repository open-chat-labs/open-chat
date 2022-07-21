import { readable } from "svelte/store";

// this is a fairly arbitrary interval but it seems about right
const INTERVAL = 5000;

export const now = readable(Date.now(), (set) => {
    const interval = window.setInterval(() => {
        set(Date.now());
    }, INTERVAL);

    return function stop() {
        window.clearInterval(interval);
    };
});

// a more fine-grained "now" used for updating a seconds counter
export const now500 = readable(Date.now(), (set) => {
    const interval = window.setInterval(() => {
        set(Date.now());
    }, 500);

    return function stop() {
        window.clearInterval(interval);
    };
});
