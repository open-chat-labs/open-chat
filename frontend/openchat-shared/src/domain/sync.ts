import type { UpdatesResult } from "./chat";

/**
 * Cache -> UI sync as a versioned pull.
 *
 * The worker's chat cache has one monotonically increasing version counter (the "head"). Every
 * commit that changes something the UI could show stamps what it touched with the next version
 * and advances the head. After every write pass the worker announces the head (`sync_head`);
 * the UI holds a cursor and, when the head is past it, asks `syncSince` for everything stamped
 * after the cursor. The answer comes from the cache, not from the writer, so nothing the UI
 * missed (a fold that threw, a listener registered late) is ever lost: it is still stamped past
 * the cursor and comes back on the next pull.
 *
 * The answer carries every updated event stamped after the cursor, for every chat: the UI
 * already keeps only those for the chat on screen and inside its loaded ranges, and the log is
 * bounded on the worker side, so the worker never needs to know what the UI is showing.
 */

export type SyncHead = {
    userId: string;
    version: number;
};

/**
 * A `syncSince` answer, and also the boot snapshot `getUpdates` resolves on an initial load:
 * everything in the cache, read at `version`, which seeds the UI's cursor.
 */
export type SyncSinceResponse = {
    userId: string;
    /** The head as it was BEFORE the rows were read: the cursor the UI should move to */
    version: number;
    updates: UpdatesResult;
};
