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
