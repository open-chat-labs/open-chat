import {
    defaultChat,
    routeForChatIdentifier,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
} from "@client";

/**
 * Where a chat list with nothing selected goes (ROUTES.md, decision 7), as the old UI's
 * selectDefaultChat: the chat last opened in its scope while it's still in the list, else its
 * first that isn't archived (pinned ones included); a community's channels likewise. Nowhere on a
 * narrow screen, which shows the list itself, or for a list with no such chat.
 */
export function defaultChatRoute(
    scope: ChatListScope["kind"],
    chats: readonly ChatSummary[],
    lastSelected: ChatIdentifier | undefined,
    narrow: boolean,
): string | undefined {
    if (narrow) return undefined;
    const chat = defaultChat(chats, lastSelected);
    return chat && routeForChatIdentifier(scope, chat.id);
}

/**
 * Where going to that chat lands: its route with the URL's query kept, so what the list was
 * opened with (an overlay, the thread list's ?threads) stays open over it.
 */
export function defaultChatUrl(route: string, search: string): string {
    return `${route}${search}`;
}
