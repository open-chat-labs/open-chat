import { i18nKey, type ChatListScope, type ResourceKey } from "@client";

/** What the middle says when a chat list has nothing selected: a title and a line under it. */
export type NoChatSelectedText = { title: ResourceKey; body: ResourceKey };

/**
 * The words for a chat list with nothing selected, by its scope: a community's channels, the
 * favourites (which says how to add some), or the chats. The old desktop's `NoChatSelected`.
 */
export function noChatSelectedText(scope: ChatListScope["kind"]): NoChatSelectedText {
    switch (scope) {
        case "community":
            return { title: i18nKey("noChannelSelected"), body: i18nKey("selectAChannel") };
        case "favourite":
            return { title: i18nKey("noChatSelected"), body: i18nKey("selectAFavourite") };
        default:
            return { title: i18nKey("noChatSelected"), body: i18nKey("selectAChat") };
    }
}

/**
 * What the middle says with nothing selected in it: the chat list's words while that list has
 * chats to pick from. Nothing beside an empty list, which says so itself ("No conversations yet"),
 * nor beside anything other than a chat list (the activity feed, the threads), which `chatList`
 * then isn't.
 */
export function middleWithoutChatText(
    chatList: ChatListScope | undefined,
    listHasChats: boolean,
): NoChatSelectedText | undefined {
    return chatList !== undefined && listHasChats ? noChatSelectedText(chatList.kind) : undefined;
}
