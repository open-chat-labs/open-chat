import {
    routeForChatIdentifier,
    routeForMessage,
    type ChatListScope,
    type DirectChatIdentifier,
} from "@shared";

/**
 * The route to `chatId`, a direct chat moved there, onto the other user's new id after they were
 * migrated to a MultiUser canister, from the one in a route at `messageIndex`. The chat keeps its
 * messages, and so their indexes, so the route keeps it too.
 */
export function routeForMovedDirectChat(
    scope: ChatListScope["kind"],
    chatId: DirectChatIdentifier,
    messageIndex: number | undefined,
): string {
    return messageIndex === undefined
        ? routeForChatIdentifier(scope, chatId)
        : routeForMessage(scope, { chatId }, messageIndex);
}
