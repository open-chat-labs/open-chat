import { Principal } from "@icp-sdk/core/principal";
import type { OpenChatConfig } from "../config";

type UsergeekApi = typeof import("usergeek-ic-js").Usergeek;

const shouldTrack = import.meta.env.OC_NODE_ENV === "production";

// Resolves to the initialised Usergeek instance. The library is only loaded (and
// initialised) off the critical path, once the browser is idle.
let usergeek: Promise<UsergeekApi> | undefined;

const noopUsergeek = {
    init: () => undefined,
    setPrincipal: () => undefined,
    trackSession: () => undefined,
    trackEvent: () => undefined,
} as unknown as UsergeekApi;

function whenIdle(fn: () => void): void {
    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(fn, { timeout: 3000 });
    } else {
        setTimeout(fn, 0);
    }
}

export function initialiseTracking({ icUrl, userGeekApiKey }: OpenChatConfig): void {
    if (shouldTrack) {
        const apiKey = userGeekApiKey;
        const host = icUrl;
        usergeek = new Promise((resolve) => {
            whenIdle(() => {
                import("usergeek-ic-js")
                    .then(({ Usergeek }) => {
                        Usergeek.init({ apiKey, host });
                        console.log("Usergeek initialised");
                        resolve(Usergeek);
                    })
                    .catch((err) => {
                        console.debug("Usergeek failed to initialise", err);
                        resolve(noopUsergeek);
                    });
            });
        });
    }
}

export function startTrackingSession(identityPrincipal: string): void {
    if (shouldTrack) {
        usergeek?.then((u) => {
            u.setPrincipal(Principal.fromText(identityPrincipal));
            u.trackSession();
        });
    }
}

export function endTrackingSession(): void {
    if (shouldTrack) {
        usergeek?.then((u) => u.setPrincipal(undefined));
    }
}

export function trackEvent(eventName: string): void {
    if (shouldTrack) {
        usergeek?.then((u) => u.trackEvent(eventName));
    }
}
