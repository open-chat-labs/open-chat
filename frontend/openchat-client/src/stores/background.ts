import { readable } from "svelte/store";

export const background = readable(
    document && document.visibilityState === "hidden",
    function start(set) {
        function setVisibility() {
            set(document.visibilityState === "hidden");
        }

        // The value is only kept up to date while subscribed, so re-read it on each first
        // subscriber rather than trusting what it was when the last one left
        setVisibility();

        document.addEventListener("visibilitychange", setVisibility);

        return function stop() {
            document.removeEventListener("visibilitychange", setVisibility);
        };
    },
);
