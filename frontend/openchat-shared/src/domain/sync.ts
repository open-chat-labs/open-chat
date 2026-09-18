import type { ChatIdentifier, UpdatesResult } from "./chat";

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
 */

/** A range of a chat's timeline that the UI is currently showing, in event indexes. `to` absent = to the end. */
export type SyncWindow = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    from: number;
    to: number | undefined;
};

export type SyncHead = {
    userId: string;
    version: number;
};

export type SyncSinceResponse = {
    userId: string;
    /** The head as it was BEFORE the rows were read: the cursor the UI should move to */
    version: number;
    updates: UpdatesResult;
};
