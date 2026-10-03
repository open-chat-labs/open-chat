import {
    routeForChatIdentifier,
    routeForMessage,
    routeForMessageContext,
    type ChatListScope,
    type DirectChatIdentifier,
} from "@shared";

/**
 * When the other user in a direct chat is migrated to a MultiUser canister, they get a new id, and
 * the chat is moved onto it: an updates answer removes the chat under their old id and, in the same
 * answer, adds it under the new one, with nothing to link the two. A chat is only moved if there's
 * no chat under the new id already, else both are kept. This picks out the chats among `removed`,
 * the user ids of the direct chats an answer removed, which were moved rather than deleted: those
 * whose user's latest id differs from the id the chat was under, and which the same answer adds a
 * chat under that latest id for, one there wasn't before. Each is mapped to the chat it was moved to.
 */
export function movedDirectChats(
    removed: string[],
    latestUserId: (userId: string) => string,
    isAddedChat: (chatId: DirectChatIdentifier) => boolean,
): Map<string, DirectChatIdentifier> {
    const moved = new Map<string, DirectChatIdentifier>();
    for (const userId of removed) {
        const latest = latestUserId(userId);
        if (latest === userId) continue;
        const chatId: DirectChatIdentifier = { kind: "direct_chat", userId: latest };
        if (isAddedChat(chatId)) {
            moved.set(userId, chatId);
        }
    }
    return moved;
}

/**
 * The route to `chatId`, a chat moved there from the one in a route at `messageIndex`, and in the
 * thread at `threadMessageIndex`, or with the thread under `messageIndex` open. The chat keeps its
 * messages, and so their indexes, so the route keeps them too.
 */
export function routeForMovedDirectChat(
    scope: ChatListScope["kind"],
    chatId: DirectChatIdentifier,
    messageIndex: number | undefined,
    threadMessageIndex: number | undefined,
    open: boolean,
): string {
    if (messageIndex === undefined) {
        return routeForChatIdentifier(scope, chatId);
    }
    if (threadMessageIndex !== undefined) {
        return routeForMessage(
            scope,
            { chatId, threadRootMessageIndex: messageIndex },
            threadMessageIndex,
        );
    }
    return open
        ? routeForMessageContext(scope, { chatId, threadRootMessageIndex: messageIndex }, true)
        : routeForMessage(scope, { chatId }, messageIndex);
}
