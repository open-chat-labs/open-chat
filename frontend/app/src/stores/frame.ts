import { writable } from "svelte/store";

export const framed = writable(false);

console.log("xxx listening out for post message events");
window.addEventListener("message", (ev) => {
    console.log("Event received: ", ev);
});
