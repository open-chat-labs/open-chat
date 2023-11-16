import { writable } from "svelte/store";

export type NetworkStatus = "offline" | "online";

export const networkStatus = writable<NetworkStatus>(
    navigator.onLine ? "online" : "offline",
    (set) => {
        function online() {
            set("online");
        }
        function offline() {
            set("offline");
        }
        window.addEventListener("online", online);
        window.addEventListener("offline", offline);
        return () => {
            window.removeEventListener("online", online);
            window.removeEventListener("offline", offline);
        };
    },
);
