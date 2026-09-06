import { MIN_DOWNLINK } from "@shared";
import { derived, writable } from "svelte/store";

const networkInformation = writable<NetworkInformation | undefined>(undefined, (set) => {
    const connection = "connection" in navigator ? navigator.connection : undefined;
    if (connection === undefined) return;

    // Some Android WebViews expose navigator.connection without the EventTarget methods, so the
    // value is readable but not subscribable. Calling addEventListener on those threw
    // "navigator.connection?.addEventListener is not a function" and took the store's start
    // function down with it.
    if (typeof connection.addEventListener !== "function") {
        set(connection);
        return;
    }

    const update = () => set(connection);
    connection.addEventListener("change", update);
    update();
    return () => {
        connection.removeEventListener("change", update);
    };
});

const networkOffline = writable<boolean>(!navigator.onLine, (set) => {
    const online = () => set(false);
    const offline = () => set(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
        window.removeEventListener("online", online);
        window.removeEventListener("offline", offline);
    };
});

export const offlineStore = derived(
    [networkInformation, networkOffline],
    ([$networkInformation, $networkOffline]) => {
        return (
            $networkOffline ||
            ($networkInformation !== undefined && $networkInformation.downlink < MIN_DOWNLINK)
        );
    },
);
