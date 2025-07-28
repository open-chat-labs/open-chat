import { readable } from "svelte/store";

function intervalStore(duration: number) {
    return readable(Date.now(), (set) => {
        // Set initial value immediately
        set(Date.now());

        const interval = window.setInterval(() => {
            set(Date.now());
        }, duration);

        return function stop() {
            window.clearInterval(interval);
        };
    });
}

// this is a fairly arbitrary interval but it seems about right
export const now = intervalStore(5000);

// a more fine-grained "now" used for updating a seconds counter
export const now500 = intervalStore(500);
