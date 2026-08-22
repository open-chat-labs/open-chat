import type { ChatIdentifier, ChatListScope, MessageContext } from "../domain";

// Kept free of runtime imports: the service worker bundles this module directly
// (see openchat-service-worker) and must not pull in the rest of the shared package.

export function routeForMessage(
    scope: ChatListScope["kind"],
    ctx: MessageContext,
    messageIndex: number,
): string {
    return ctx.threadRootMessageIndex === undefined
        ? `${routeForMessageContext(scope, ctx)}/${messageIndex}`
        : `${routeForMessageContext(scope, ctx)}/${messageIndex}?open=true`;
}

export function routeForMessageContext(
    scope: ChatListScope["kind"],
    { chatId, threadRootMessageIndex }: MessageContext,
    open = false,
): string {
    return threadRootMessageIndex === undefined
        ? routeForChatIdentifier(scope, chatId)
        : `${routeForChatIdentifier(scope, chatId)}/${threadRootMessageIndex}${
              open ? "?open=true" : ""
          }`;
}

export function routeForChatIdentifier(scope: ChatListScope["kind"], id: ChatIdentifier): string {
    switch (scope) {
        case "favourite":
            switch (id.kind) {
                case "direct_chat":
                    return `/favourite/user/${id.userId}`;
                case "group_chat":
                    return `/favourite/group/${id.groupId}`;
                case "channel":
                    return `/favourite/community/${id.communityId}/channel/${id.channelId}`;
            }
            break;
        default:
            switch (id.kind) {
                case "direct_chat":
                    return `/chats/user/${id.userId}`;
                case "group_chat":
                    return `/chats/group/${id.groupId}`;
                case "channel":
                    return `/community/${id.communityId}/channel/${id.channelId}`;
            }
    }
}
