import { setConnectionUnusable } from "@shared";
import { derived, writable } from "svelte/store";

// Whether the worker's queries say the connection is unusable, see `ConnectionHealth` in
// openchat-agent. The browser's own estimates (`navigator.connection.downlink`) aren't used: they
// come from recent traffic, so they stopped changing once the app treated the connection as
// unusable and sent nothing, and the app stayed offline until it was reopened.
const connectionUnusable = writable<boolean>(false);

// Called with each change the worker reports
export function connectionUnusableChanged(unusable: boolean): void {
    setConnectionUnusable(unusable);
    connectionUnusable.set(unusable);
}

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
    [networkOffline, connectionUnusable],
    ([$networkOffline, $connectionUnusable]) => $networkOffline || $connectionUnusable,
);
