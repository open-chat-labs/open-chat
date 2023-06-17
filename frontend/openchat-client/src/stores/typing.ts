import { ChatIdentifier, ChatMap } from "openchat-shared";
import { writable, derived } from "svelte/store";

export type TypersByKey = ChatMap<Set<string>>;

type UserTyping = {
    chatId: ChatIdentifier;
    threadRootMessageIndex?: number;
    timeout: number;
};
type UsersTyping = Record<string, UserTyping>;

export function isTyping(
    usersTyping: UsersTyping,
    userId: string,
    chatId: ChatIdentifier,
    threadRootMessageIndex?: number
): boolean {
    const userTyping = usersTyping[userId];
    if (userTyping === undefined) return false;
    if (threadRootMessageIndex === undefined) return userTyping.chatId === chatId;
    return (
        userTyping.chatId === chatId && userTyping.threadRootMessageIndex === threadRootMessageIndex
    );
}

const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

const usersTyping = writable<UsersTyping>({});

export const typing = {
    subscribe: usersTyping.subscribe,
    startTyping: (chatId: ChatIdentifier, userId: string, threadRootMessageIndex?: number): void =>
        usersTyping.update((users) => {
            // Start a timeout which will mark the user as having stopped typing if no further 'user typing' events are
            // received within MARK_TYPING_STOPPED_INTERVAL_MS.
            const timeout = window.setTimeout(
                () => _delete(userId),
                MARK_TYPING_STOPPED_INTERVAL_MS
            );

            const existingEntry = users[userId];
            if (existingEntry) {
                // Clear the existing timeout since it is no longer relevant.
                window.clearTimeout(existingEntry.timeout);
            }

            // Mark that the user is typing in the new chat and include the timeout so that if subsequent events are
            // received we can clear the timeout.
            users[userId] = { chatId, timeout, threadRootMessageIndex };

            return users;
        }),
    stopTyping: (userId: string): void => _delete(userId),
};

// a derived store to show users typing by chat
export const byChat = derived([usersTyping], ([$users]) => {
    return Object.entries($users).reduce((byChat, [userId, { chatId }]) => {
        if (!byChat.has(chatId)) {
            byChat.set(chatId, new Set<string>());
        }
        byChat.get(chatId)?.add(userId);
        return byChat;
    }, new ChatMap<Set<string>>());
});

// a derived store to show users typing by thread
export const byThread = derived([usersTyping], ([$users]) => {
    return Object.entries($users).reduce(
        (byThread, [userId, { chatId, threadRootMessageIndex }]) => {
            if (threadRootMessageIndex === undefined) return byThread;
            const key = `${chatId}_${threadRootMessageIndex}`;
            if (byThread[key] === undefined) {
                byThread[key] = new Set<string>();
            }
            byThread[key].add(userId);
            return byThread;
        },
        {} as Record<string, Set<string>>
    );
});

function _delete(userId: string): void {
    usersTyping.update((users) => {
        const existingEntry = users[userId];
        if (existingEntry) {
            window.clearTimeout(existingEntry.timeout);
            delete users[userId];
        }
        return users;
    });
}
