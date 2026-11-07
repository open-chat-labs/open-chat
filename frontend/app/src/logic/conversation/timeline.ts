import { chatIdentifiersEqual, chatIdentifierToString, type ChatIdentifier } from "@client";

// What a conversation's timeline decides around its list (core/ChatEventList), for every tree that
// shows one with the library (src/web's, src/native's): where the unread divider goes, when the
// route's message is gone to, and who is shown typing.

/**
 * The first unread message when a chat was opened: the unread divider stays above it while the
 * chat is open, as messages are read. Worked out once per chat, so a new chat never shows the
 * last one's.
 */
export class FirstUnread {
    #for: { key: string; index: number | undefined } | undefined;

    /** The chat's first unread message as it was when it opened (`firstUnread` asks only then). */
    of(chatId: ChatIdentifier, firstUnread: () => number | undefined): number | undefined {
        const key = chatIdentifierToString(chatId);
        if (this.#for?.key !== key) {
            this.#for = { key, index: firstUnread() };
        }
        return this.#for.index;
    }
}

/**
 * Follows the route's message (a deep link), as the old list does: the list goes to it when it
 * changes, and when the chat does, once the chats have loaded.
 */
export class MessageLink {
    #chatId: ChatIdentifier | undefined;
    #index: number | undefined;

    /**
     * The message to go to now, if any, for the route's chat and message as they are: called as
     * either changes (and as the chats load), once the list is there.
     */
    next(
        chatId: ChatIdentifier | undefined,
        index: number | undefined,
        chatsLoaded: boolean,
    ): number | undefined {
        const sameChat = chatIdentifiersEqual(chatId, this.#chatId);
        const go =
            chatsLoaded &&
            chatId !== undefined &&
            index !== undefined &&
            (!sameChat || index !== this.#index);
        this.#chatId = chatId;
        this.#index = index;
        return go ? index : undefined;
    }
}

/** The names of the others typing in a chat (the user typing elsewhere isn't shown). */
export function othersTyping(
    typers: Iterable<string> | undefined,
    me: string,
    name: (userId: string) => string,
): string[] {
    return [...(typers ?? [])].filter((userId) => userId !== me).map(name);
}
