import { notEq } from "../state/utils";
import { writable } from "../utils/stores";
import { createMapStore } from "./mapStore";

/** Who deleted a message, and when. */
export type RevealedDeletion = { deletedBy: string; timestamp: bigint };

/**
 * The deletions of the messages revealed this session through the new UIs (`peekDeletedMessage`),
 * by message id, as they were when revealed: the revealed content replaces them in the merged
 * message, and the server's copy may not show the deletion yet. `hideRevealedMessage` hides one
 * again by it.
 */
export const revealedDeletionsStore = createMapStore(
    writable(new Map<bigint, RevealedDeletion>(), undefined, notEq),
);
