import type { Identity } from "@dfinity/agent";
import { Usergeek } from "usergeek-ic-js";

const shouldTrack = process.env.NODE_ENV === "production";

export function initialiseTracking(): void {
    if (shouldTrack) {
        const apiKey = "process.env.USERGEEK_APIKEY";
        const host = process.env.IC_URL;
        Usergeek.init({ apiKey, host });
        console.log("Usergeek initialised");
    }
}

export function startTrackingSession(identity: Identity): void {
    if (shouldTrack) {
        Usergeek.setPrincipal(identity.getPrincipal());
        Usergeek.trackSession();
    }
}

export function endTrackingSession(): void {
    if (shouldTrack) {
        Usergeek.setPrincipal(undefined);
    }
}

export function trackEvent(eventName: string): void {
    if (shouldTrack) {
        Usergeek.trackEvent(eventName);
    }
}
