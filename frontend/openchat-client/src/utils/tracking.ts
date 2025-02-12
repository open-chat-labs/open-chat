import type { Identity } from "@dfinity/agent";
import type { OpenChatConfig } from "../config";
import { Usergeek } from "usergeek-ic-js";

const shouldTrack = import.meta.env.OC_NODE_ENV === "production";

export function initialiseTracking({ icUrl, userGeekApiKey }: OpenChatConfig): void {
    if (shouldTrack) {
        const apiKey = userGeekApiKey;
        const host = icUrl;
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
