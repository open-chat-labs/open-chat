import { MIN_DOWNLINK } from "../constants";

// The IC mainnet, whose root key is baked into the agent libraries. Every other network has its
// own, which has to be fetched before any certificate can be verified.
export function isMainnet(icUrl: string): boolean {
    return icUrl.includes("icp-api.io");
}

export function offline(): boolean {
    return !navigator.onLine || criticalBandwith();
}

function criticalBandwith(): boolean {
    return (
        "connection" in navigator &&
        navigator.connection !== undefined &&
        navigator.connection.downlink < MIN_DOWNLINK
    );
}
