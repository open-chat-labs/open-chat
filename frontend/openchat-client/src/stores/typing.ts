import { MessageContext, MessageContextMap, chatIdentifiersEqual } from "openchat-shared";
import { writable, derived } from "svelte/store";

export type TypersByKey = MessageContextMap<Set<string>>;

type UserTyping = {
    context: MessageContext;
    timeout: number;
};
type UsersTyping = Record<string, UserTyping>;

function contextsMatch(a: MessageContext, b: MessageContext): boolean {
    return (
        chatIdentifiersEqual(a.chatId, b.chatId) &&
        a.threadRootMessageIndex === b.threadRootMessageIndex
    );
}

export function isTyping(
    usersTyping: UsersTyping,
    userId: string,
    context: MessageContext
): boolean {
    const userTyping = usersTyping[userId];
    if (userTyping === undefined) return false;
    return contextsMatch(context, userTyping.context);
}

const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

const usersTyping = writable<UsersTyping>({});

export const typing = {
    subscribe: usersTyping.subscribe,
    startTyping: (context: MessageContext, userId: string): void =>
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

            // Mark the context that the user is typing in and include the timeout so that if subsequent events are
            // received we can clear the timeout.
            users[userId] = { context, timeout };

            return users;
        }),
    stopTyping: (userId: string): void => _delete(userId),
};

// a derived store to show users typing by message context
export const byContext = derived([usersTyping], ([$users]) => {
    return Object.entries($users).reduce((byContext, [userId, { context }]) => {
        if (!byContext.has(context)) {
            byContext.set(context, new Set<string>());
        }
        byContext.get(context)?.add(userId);
        return byContext;
    }, new MessageContextMap<Set<string>>());
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
