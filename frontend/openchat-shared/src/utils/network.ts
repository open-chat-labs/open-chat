import { MIN_DOWNLINK } from "../constants";

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
