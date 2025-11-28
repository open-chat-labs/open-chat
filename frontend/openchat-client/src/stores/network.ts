import { ConnectivityMonitor, MIN_DOWNLINK } from "openchat-shared";
import { derived } from "svelte/store";

export const connectivityMonitor = new ConnectivityMonitor({
    pollIntervalMs: 30_000,
    probeUrl: "/.well-known/assetlinks.json",
    timeoutMs: 5_000,
});

export const offlineStore = derived(connectivityMonitor, (status) => {
    return (
        !status.online ||
        (status.estimatedDownlinkMbps !== null && status.estimatedDownlinkMbps < MIN_DOWNLINK)
    );
});
