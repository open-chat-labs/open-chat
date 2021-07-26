import { readable } from "svelte/store";

export const background = readable(
    document && document.visibilityState === "hidden",
    function start(set) {
        function setVisibility() {
            set(document.visibilityState === "hidden");
        }

        document.addEventListener("visibilitychange", function () {
            setVisibility();
        });

        return function stop() {
            window.removeEventListener("visibilitychange", setVisibility);
        };
    }
);
