/* eslint-disable @typescript-eslint/no-explicit-any */
import { unmount } from "svelte";

/**
 * This simply tracks the open portal. Note that it only allows for one open portal at the moment
 * This might not always be good enough.
 */
class PortalState {
    #mounted: Record<string, any> | undefined;

    open(mounted: Record<string, any>) {
        this.close();
        this.#mounted = mounted;
    }

    close() {
        if (this.#mounted !== undefined) {
            unmount(this.#mounted);
            this.#mounted = undefined;
        }
    }
}

export const portalState = new PortalState();
