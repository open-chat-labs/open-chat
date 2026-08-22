import { readable } from "svelte/store";

export const background = readable(
    document && document.visibilityState === "hidden",
    function start(set) {
        function setVisibility() {
            set(document.visibilityState === "hidden");
        }

        document.addEventListener("visibilitychange", setVisibility);

        return function stop() {
            document.removeEventListener("visibilitychange", setVisibility);
        };
    }
);
