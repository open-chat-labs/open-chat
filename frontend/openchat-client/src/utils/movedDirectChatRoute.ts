import {
    routeForChatIdentifier,
    routeForMessage,
    routeForMessageContext,
    type ChatListScope,
    type DirectChatIdentifier,
} from "@shared";

/**
 * The route to `chatId`, a direct chat moved there, onto the other user's new id after they were
 * migrated to a MultiUser canister, from the one in a route at `messageIndex`, and in the thread at
 * `threadMessageIndex`, or with the thread under `messageIndex` open. The chat keeps its messages,
 * and so their indexes, so the route keeps them too.
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
