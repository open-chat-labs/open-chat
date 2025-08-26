/**
 * Periodically check whether there is a new service worker available
 */

import { Poller } from "../utils/poller";

let poller: Poller | undefined = undefined;

export async function startSwCheckPoller(): Promise<void> {
    if ("serviceWorker" in navigator) {
        if (poller === undefined) {
            poller = new Poller(checkServiceWorker, 60000);
        }
    }
}

async function checkServiceWorker() {
    const reg = await navigator.serviceWorker.getRegistration(import.meta.env.OC_SERVICE_WORKER_PATH);
    if (reg) {
        console.log("SW: checking for a new root service worker");
        await reg.update(); // this should get the new service worker and install it if it's available
    }
}
