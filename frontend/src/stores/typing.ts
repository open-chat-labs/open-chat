import { writable } from "svelte/store";

export type TypersByChat = Record<string, Set<string>>;

type UserTyping = {
    chatId: string;
    timeout: number;
};

const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

// Every user who is typing will appear once in 'store' and once in 'usersTyping'.
const store = writable<TypersByChat>({});
const usersTyping = new Map<string, UserTyping>();

export const typing = {
    subscribe: store.subscribe,
    add: (chatId: string, userId: string): void =>
        store.update((chats) => {
            // Start a timeout which will mark the user as having stopped typing if no further 'user typing' events are
            // received within MARK_TYPING_STOPPED_INTERVAL_MS.
            const timeout = window.setTimeout(
                () => _delete(userId),
                MARK_TYPING_STOPPED_INTERVAL_MS
            );

            const existingEntry = usersTyping.get(userId);
            if (existingEntry) {
                // Clear the existing timeout since it is no longer relevant.
                window.clearTimeout(existingEntry.timeout);

                // Users can only be typing in a single chat at a time, so if this user is now typing in a different
                // chat to before, then we should mark that they have stopped typing in the previous one.
                if (existingEntry.chatId !== chatId) {
                    chats[existingEntry.chatId].delete(userId);
                } else {
                    // If the user is still typing in the same chat, then there is no change to the state of the store,
                    // so we can set the new timeout and return the previous state as is.
                    existingEntry.timeout = timeout;
                    return chats;
                }
            }

            // Mark that the user is typing in the new chat and include the timeout so that if subsequent events are
            // received we can clear the timeout.
            usersTyping.set(userId, { chatId, timeout });

            if (chats[chatId] === undefined) {
                chats[chatId] = new Set<string>();
            }
            chats[chatId].add(userId);
            return {
                ...chats,
            };
        }),
    delete: (chatId: string, userId: string): void => _delete(userId),
};

function _delete(userId: string): void {
    const existingEntry = usersTyping.get(userId);
    if (existingEntry) {
        window.clearTimeout(existingEntry.timeout);
        usersTyping.delete(userId);

        store.update((chats) => {
            chats[existingEntry.chatId].delete(userId);
            return {
                ...chats,
            };
        });
    }
}
