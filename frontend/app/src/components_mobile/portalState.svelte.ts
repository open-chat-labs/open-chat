import { unmount } from "svelte";

type Component = Record<string, unknown>;
type OnClose = () => void;
type Mounted = [Component, OnClose | undefined];

/**
 * This simply tracks the open portal. Note that it only allows for one open portal at the moment
 * This might not always be good enough, but for now it seems to be.
 */
class PortalState {
    #mounted: Mounted | undefined;

    open(mounted: Component, onClose?: OnClose): boolean {
        this.close();
        this.#mounted = [mounted, onClose];
        return true;
    }

    close(): boolean {
        if (this.#mounted !== undefined) {
            const [comp, onClose] = this.#mounted;
            this.#mounted = undefined;
            unmount(comp);
            onClose?.();
        }
        return false;
    }
}

export const portalState = new PortalState();
