import type { ChatSummary } from "@client";

/**
 * The chat list's filter (native design notes §3.2: All / Direct / Groups / Unread), which
 * components_mobile stores as `chatListFilterStore`.
 */
export type ChatListFilter = "all" | "direct" | "groups" | "unread";

/** The filters in the order the native Chats tab shows them. */
export const CHAT_LIST_FILTERS: readonly ChatListFilter[] = ["all", "direct", "groups", "unread"];

/**
 * Whether a chat passes the filter: direct chats, groups (a group or, among favourites, a
 * channel), or those with unread messages (`unread`, the list's own count).
 */
export function passesChatListFilter(
    chat: ChatSummary,
    filter: ChatListFilter,
    unread: number,
): boolean {
    switch (filter) {
        case "all":
            return true;
        case "direct":
            return chat.kind === "direct_chat";
        case "groups":
            return chat.kind !== "direct_chat";
        case "unread":
            return unread > 0;
    }
}

/** A stored filter, or All for anything else (an older or hand-edited value). */
export function chatListFilterFrom(stored: string): ChatListFilter {
    return CHAT_LIST_FILTERS.find((f) => f === stored) ?? "all";
}
