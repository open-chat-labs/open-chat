import type { EventWrapper, Message } from "@shared";

// A message the user sent that the backend doesn't have yet (sending, queued or failed) has an
// index of its own making: the next after the chat's latest, or after the one sent before it. The
// chat shows such messages only while they run on from its loaded events without a gap
// (`mergeEventsAndLocalUpdatesWithRange`), so when one of them is deleted, those after it move
// down into its place. Otherwise deleting the first of two queued messages hid the second (#10591).

/**
 * Whether a local message at `index` is still just past the chat's confirmed events (the latest
 * the chat's summary has, `latestConfirmed`), where the local run of messages starts. One at or
 * below it is out of date: others have posted since it was written. Unknown, it isn't.
 */
export function pastConfirmed(index: number, latestConfirmed: number | undefined): boolean {
    return latestConfirmed !== undefined && index > latestConfirmed;
}

/** Where a deleted local message was. */
export type RemovedPlace = { index: number; messageIndex: number };

/**
 * A local message as it is once the one at `removed` has gone: one after it one place down, its
 * message index too; one before it as it was (the same object, so nothing changes for it).
 */
export function closeGap<T extends EventWrapper<Message>>(message: T, removed: RemovedPlace): T {
    if (message.index <= removed.index) return message;
    const messageIndex = message.event.messageIndex;
    return {
        ...message,
        index: message.index - 1,
        event: {
            ...message.event,
            messageIndex: messageIndex > removed.messageIndex ? messageIndex - 1 : messageIndex,
        },
    };
}
