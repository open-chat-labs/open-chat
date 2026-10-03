import type { DirectChatIdentifier } from "@shared";

/**
 * When the other user in a direct chat is migrated to a MultiUser canister, they get a new id, and
 * the chat is moved onto it: an updates answer removes the chat under their old id and adds it
 * under the new one, with nothing to link the two. This picks out the chats among `removed`, the
 * user ids of the direct chats an answer removed, which were moved rather than deleted: those whose
 * user's latest id differs from the id the chat was under, and which there is now a chat with under
 * that latest id. Each is mapped to the chat it was moved to.
 */
export function movedDirectChats(
    removed: string[],
    latestUserId: (userId: string) => string,
    hasChat: (chatId: DirectChatIdentifier) => boolean,
): Map<string, DirectChatIdentifier> {
    const moved = new Map<string, DirectChatIdentifier>();
    for (const userId of removed) {
        const latest = latestUserId(userId);
        if (latest === userId) continue;
        const chatId: DirectChatIdentifier = { kind: "direct_chat", userId: latest };
        if (hasChat(chatId)) {
            moved.set(userId, chatId);
        }
    }
    return moved;
}
