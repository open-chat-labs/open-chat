import type { ChatEvent, DeletedContent, EventWrapper, RevealedDeletion } from "@client";

// A revealed deleted message shows its content in place of its deletion (the client merges the
// revealed content over it), so who deleted it and when come from what was kept as it was revealed
// (`revealedDeletionsStore`, `peekDeletedMessage`), else from the message as the server has it:
// the chat's (or thread's) server events, before the local updates are merged in.

/**
 * A revealed message's deletion: as kept when it was revealed (`kept`), else the server's copy's,
 * by its id; none where neither has it (revealed elsewhere, the server's copy not deleted yet).
 */
export function revealedDeletion(
    kept: RevealedDeletion | undefined,
    serverEvents: readonly EventWrapper<ChatEvent>[],
    messageId: bigint,
): DeletedContent | undefined {
    if (kept !== undefined) return { kind: "deleted_content", ...kept };
    return deletionOf(serverEvents, messageId);
}

/**
 * A message's deletion as the server has it, by its id; none where the server's copy isn't
 * deleted (yet) or isn't loaded.
 */
export function deletionOf(
    serverEvents: readonly EventWrapper<ChatEvent>[],
    messageId: bigint,
): DeletedContent | undefined {
    for (let i = serverEvents.length - 1; i >= 0; i--) {
        const event = serverEvents[i].event;
        if (event.kind !== "message" || event.messageId !== messageId) continue;
        return event.content.kind === "deleted_content" ? event.content : undefined;
    }
    return undefined;
}
