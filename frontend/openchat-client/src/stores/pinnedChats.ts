import {
    chatIdentifiersEqual,
    type ChatIdentifier,
    GroupChatIdentifier,
    DirectChatIdentifier,
    ChannelIdentifier,
} from "openchat-shared";
import { immutableStore } from "./immutable";
import { get } from "svelte/store";

export const pinnedChatsStore = createStore<ChatIdentifier>();
export const pinnedGroupChatsStore = createStore<GroupChatIdentifier>();
export const pinnedDirectChatsStore = createStore<DirectChatIdentifier>();
export const pinnedFavouriteChatsStore = createStore<ChatIdentifier>();
export const pinnedChannelsStore = createStore<ChannelIdentifier>();

function createStore<T extends ChatIdentifier>() {
    const store = immutableStore<T[]>([]);
    return {
        subscribe: store.subscribe,
        set: store.set,
        includes: (chatId: T): boolean => {
            return get(store).find((id) => chatIdentifiersEqual(id, chatId)) !== undefined;
        },
        pin: (chatId: T): void => {
            store.update((ids) => {
                if (!ids.find((id) => chatIdentifiersEqual(id, chatId))) {
                    const ids_clone = [chatId, ...ids];
                    return ids_clone;
                }
                return ids;
            });
        },
        unpin: (chatId: T): void => {
            store.update((ids) => {
                const index = ids.findIndex((id) => chatIdentifiersEqual(id, chatId));
                if (index >= 0) {
                    const ids_clone = [...ids];
                    ids_clone.splice(index, 1);
                    return ids_clone;
                }
                return ids;
            });
        },
    };
}
