import { routeForChatIdentifier, type ChatListScope, type ChatSummary } from "@client";

/**
 * Where a chat list with nothing selected goes (ROUTES.md, decision 7): its first chat, pinned ones
 * included, that isn't archived; a community's first channel likewise. Nowhere on a narrow screen,
 * which shows the list itself, or for a list with no such chat.
 */
export function firstChatRoute(
    scope: ChatListScope["kind"],
    chats: readonly ChatSummary[],
    narrow: boolean,
): string | undefined {
    if (narrow) return undefined;
    const first = chats.find((chat) => !chat.membership.archived);
    return first && routeForChatIdentifier(scope, first.id);
}

/**
 * Where going to the first chat lands: its route with the URL's query kept, so what the list was
 * opened with (an overlay, the thread list's ?threads) stays open over it.
 */
export function firstChatUrl(route: string, search: string): string {
    return `${route}${search}`;
}
