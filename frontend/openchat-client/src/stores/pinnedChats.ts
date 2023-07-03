import { chatIdentifiersEqual, type ChatIdentifier, ChatListScope } from "openchat-shared";
import { Writable, get, writable } from "svelte/store";

export type PinnedByScope = Record<ChatListScope["kind"], ChatIdentifier[]>;

export const pinnedChatsStore = createStore(
    writable<PinnedByScope>({
        group_chat: [],
        direct_chat: [],
        favourite: [],
        community: [],
        none: [],
    })
);

function createStore(store: Writable<PinnedByScope>) {
    return {
        subscribe: store.subscribe,
        set: store.set,
        pinned: (scope: ChatListScope["kind"], chatId: ChatIdentifier): boolean => {
            return get(store)[scope].find((id) => chatIdentifiersEqual(id, chatId)) !== undefined;
        },
        pin: (scope: ChatListScope["kind"], chatId: ChatIdentifier): void => {
            store.update((rec) => {
                const ids = rec[scope];
                if (!ids.find((id) => chatIdentifiersEqual(id, chatId))) {
                    return {
                        ...rec,
                        [scope]: [chatId, ...ids],
                    };
                }
                return rec;
            });
        },
        unpin: (scope: ChatListScope["kind"], chatId: ChatIdentifier): void => {
            store.update((rec) => {
                const ids = rec[scope];
                const index = ids.findIndex((id) => chatIdentifiersEqual(id, chatId));
                if (index >= 0) {
                    const ids_clone = [...ids];
                    ids_clone.splice(index, 1);
                    return {
                        ...rec,
                        [scope]: ids_clone,
                    };
                }
                return rec;
            });
        },
    };
}
