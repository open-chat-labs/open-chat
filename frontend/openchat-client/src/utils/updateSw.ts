/**
 * Periodically check whether there is a new service worker available
 */

import { Poller } from "../utils/poller";

export async function startSwCheckPoller(): Promise<void> {
    if ("serviceWorker" in navigator) {
        new Poller(checkServiceWorker, 60000);
    }
}

async function checkServiceWorker() {
    const reg = await navigator.serviceWorker.getRegistration("sw.js");
    if (reg) {
        console.log("SW: checking for a new root service worker");
        await reg.update(); // this should get the new service worker and install it if it's available
    }
}
