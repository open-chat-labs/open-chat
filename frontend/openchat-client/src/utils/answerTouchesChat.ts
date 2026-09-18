import { type ChatIdentifier, type ChatSummary, chatIdentifiersEqual } from "@shared";

/**
 * Whether a folded updates answer changed `chatId`: its summary came back (for a channel, as
 * part of its community), or events in it were updated. A pulled answer carries only what
 * changed since the cursor, so anything else in it is about other chats or global state.
 */
export function answerTouchesChat(
    chatId: ChatIdentifier,
    chatsAddedUpdated: ChatSummary[],
    updatedEventCount: number,
): boolean {
    return (
        updatedEventCount > 0 || chatsAddedUpdated.some((c) => chatIdentifiersEqual(c.id, chatId))
    );
}
