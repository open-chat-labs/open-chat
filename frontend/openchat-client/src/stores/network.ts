import { MIN_DOWNLINK } from "openchat-shared";
import { derived, writable } from "svelte/store";

const networkInformation = writable<NetworkInformation | undefined>(undefined, (set) => {
    if ("connection" in navigator) {
        const update = () => set(navigator.connection);
        navigator.connection?.addEventListener("change", update);
        update();
        return () => {
            navigator.connection?.removeEventListener("change", update);
        };
    }
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
