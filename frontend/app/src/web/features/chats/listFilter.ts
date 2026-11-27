import type { ChatListScope } from "@client";
import {
    CHAT_LIST_FILTERS,
    chatListFilterFrom,
    type ChatListFilter,
} from "@src/logic/chats/chatListFilter";

// The chat list's filter (All / Direct / Groups / Unread), remembered on this browser per scope.
// The panel's tabs (ChatListPanel's filterLabels) are in CHAT_LIST_FILTERS' order, so a tab's
// index is the filter's index there.

/**
 * Which remembered filter a scope's list uses: DMs and groups keep the one mobile and native keep
 * (`chatListFilterStore`), Favourites one of its own; a community's channels have no filter.
 */
export type ListFilterMemory = "chats" | "favourite";

export function listFilterMemory(scope: ChatListScope["kind"]): ListFilterMemory | undefined {
    switch (scope) {
        case "chats":
        case "favourite":
            return scope;
        case "community":
        case "none":
            return undefined;
    }
}

/** The tab a remembered filter selects: All for nothing remembered or anything unknown. */
export function listFilterIndex(stored: string | undefined): number {
    return CHAT_LIST_FILTERS.indexOf(chatListFilterFrom(stored ?? "all"));
}

/** The filter a tab is. */
export function listFilterAt(index: number): ChatListFilter {
    return CHAT_LIST_FILTERS[index] ?? "all";
}

/**
 * Remembers a picked tab. Storage that can't be written (full, or blocked) keeps nothing; the tab
 * stays picked for as long as the list shows.
 */
export function rememberListFilter(store: { set(value: string): void }, index: number): void {
    try {
        store.set(listFilterAt(index));
    } catch (err) {
        console.warn("Couldn't remember the chat list's filter", err);
    }
}
