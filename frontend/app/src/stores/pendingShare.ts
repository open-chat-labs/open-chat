import type { Share } from "@utils/share";
import { writable } from "svelte/store";

/**
 * Holds a Share that's waiting for the share-message modal to pick it up.
 *
 * The publish/subscribe layer in openchat-shared/utils/pubsub is a plain
 * synchronous emitter — events are dropped if no subscriber is registered
 * at publish time. On Android cold-start, the share-target event arrives
 * (and handleShareTarget runs) before SlidingModals has mounted and called
 * subscribe("shareMessage", ...), so the modal never opens.
 *
 * This store buffers the value until SlidingModals mounts and consumes it.
 */
export const pendingShareStore = writable<Share | undefined>(undefined);
