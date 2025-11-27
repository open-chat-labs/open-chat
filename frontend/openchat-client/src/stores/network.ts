import { BandwidthMonitor, MIN_DOWNLINK } from "openchat-shared";
import { derived } from "svelte/store";

export const bandwidthMonitor = new BandwidthMonitor({
    pollIntervalMs: 10_000,
    probeUrl: "/api/health",
    timeoutMs: 5_000,
});

export const offlineStore = derived(bandwidthMonitor, (status) => {
    return !status.online || (status.bandwidthMbps !== null && status.bandwidthMbps < MIN_DOWNLINK);
});
