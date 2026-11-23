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

/**
 * The local messages (failed or queued) that were written after a message which has now been sent
 * again and confirmed, retimed to just after it, in the order they were written. The chat orders
 * its messages by time, and the confirmed one takes the time the backend gave it when it went: a
 * failed message written after it, keeping its own earlier time, showed above it. Those written
 * before it, or already later than it, are left as they are (not returned).
 */
export function keptAfterResent<T extends EventWrapper<Message>>(
    local: readonly T[],
    writtenAt: bigint,
    confirmedAt: bigint,
): T[] {
    const after = local
        .filter((m) => m.timestamp > writtenAt && m.timestamp <= confirmedAt)
        .sort((a, b) =>
            a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.index - b.index,
        );
    return after.map((m, i) => ({ ...m, timestamp: confirmedAt + BigInt(i + 1) }));
}

/**
 * A failed message sent again at the end, now (others have posted since it was written), and the
 * local messages written after it, put back in the order they were written: it first, then they,
 * each just after the one before. They swap places as well as times, so that it takes the lowest of
 * their indexes: it was given the next after theirs, which left a gap the chat doesn't show past,
 * and it vanished while on its way. Returns it as it now is, and those that changed.
 */
export function reorderAfterResent<T extends EventWrapper<Message>>(
    resent: T,
    local: readonly T[],
    writtenAt: bigint,
): { resent: T; kept: T[] } {
    const after = local
        .filter((m) => m.timestamp > writtenAt && m.timestamp <= resent.timestamp)
        .sort((a, b) =>
            a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.index - b.index,
        );
    if (after.length === 0) return { resent, kept: [] };
    const all = [resent, ...after];
    const indexes = all.map((m) => m.index).sort((a, b) => a - b);
    const messageIndexes = all.map((m) => m.event.messageIndex).sort((a, b) => a - b);
    const placed = all.map((m, i) => ({
        ...m,
        index: indexes[i],
        timestamp: resent.timestamp + BigInt(i),
        event: { ...m.event, messageIndex: messageIndexes[i] },
    }));
    return { resent: placed[0], kept: placed.slice(1) };
}
