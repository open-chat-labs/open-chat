import { writable } from "svelte/store";
import { type ChatIdentifier, createMapStore } from "openchat-client";

export type ChatListScopeContext = {
    chatsScrollPos: number;
    selectedChat: ChatIdentifier | undefined;
};

export const chatListScopeContext = createMapStore(
    writable(new Map<string, ChatListScopeContext>()),
);
