import {
    chatIdentifiersEqual,
    chatIdentifierToString,
    isPreviewing,
    type ChatIdentifier,
    type ChatSummary,
} from "@client";

// What a conversation's timeline decides around its list (core/ChatEventList), for every tree that
// shows one with the library (src/web's, src/native's): where the unread divider goes and when it
// goes, where a chat with unread messages opens, when the route's message is gone to, and who is
// shown typing.

/**
 * A chat's first unread message as it opens (`firstUnread`: the client's read state's), as the
 * client works it out when it selects the chat: none for a chat being previewed, where nothing has
 * been read, so every message would count as unread from the first.
 */
export function firstUnreadOnOpen(
    chat: ChatSummary,
    firstUnread: (
        chatId: ChatIdentifier,
        latestMessageIndex: number | undefined,
    ) => number | undefined,
): number | undefined {
    if (isPreviewing(chat)) return undefined;
    return firstUnread(chat.id, chat.latestMessage?.event.messageIndex);
}

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

    /**
     * Every message from the first unread on has been read: the divider goes for the rest of the
     * visit (the screen lets it linger a moment first). Nothing for another chat.
     */
    seen(chatId: ChatIdentifier): void {
        if (this.#for?.key === chatIdentifierToString(chatId)) {
            this.#for = { key: this.#for.key, index: undefined };
        }
    }

    /**
     * Whether the divider (`firstUnread`, as `of` gave it) has been read through, so it can go
     * (`seen`, once the screen has let it linger): there is one, the chat is the one selected, and
     * no message is left unread (`unreadLeft`, asked only then). Never while the chat isn't
     * selected though the screen still shows it (HeldWhileLeaving: going back, or another chat
     * opened over it from a quote, a link or a notification): nothing was read then, and the
     * divider stays for when it's back.
     */
    static readThrough(
        firstUnread: number | undefined,
        selected: boolean,
        unreadLeft: () => number,
    ): boolean {
        return firstUnread !== undefined && selected && unreadLeft() === 0;
    }
}

/**
 * Where a chat with unread messages opens, for a list put there after the chat is selected (the
 * native conversation, pushed once the URL has changed). As the client selects a chat it loads
 * the messages around the first unread and announces it (setSelectedChat, loadingMessageWindow),
 * which a list already there goes to (ChatEventList); a list that comes after has missed it, so it
 * goes there itself, once that message is among what it has. Once per chat, and never when the
 * route names a message: a link goes to its own.
 */
export class OpenAtUnread {
    #handled: string | undefined;

    /** The message to go to now, if any. */
    next(
        chatId: ChatIdentifier,
        firstUnread: number | undefined,
        routeMessage: number | undefined,
        has: (messageIndex: number) => boolean,
    ): number | undefined {
        const key = chatIdentifierToString(chatId);
        if (this.#handled === key) return undefined;
        if (routeMessage !== undefined || firstUnread === undefined) {
            this.#handled = key;
            return undefined;
        }
        if (!has(firstUnread)) return undefined;
        this.#handled = key;
        return firstUnread;
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

/**
 * Where who's typing shows (native plan 04, "Typing", which the web follows too): a received-style
 * bubble at the end of a DM's messages, or a strip resting on the composer in a group or channel
 * and in any thread (the old UIs showed it over the composer everywhere). A DM whose loaded
 * messages stop short of the latest (a reply link or a search hit loaded an older stretch) has no
 * end for the bubble to follow, so it shows on the strip until the latest are loaded.
 */
export type TypingPlacement = "bubble" | "strip";

export function typingPlacement(
    chatKind: ChatSummary["kind"],
    threadRootMessageIndex: number | undefined,
    newerMessagesToLoad: boolean = false,
): TypingPlacement {
    return chatKind === "direct_chat" &&
        threadRootMessageIndex === undefined &&
        !newerMessagesToLoad
        ? "bubble"
        : "strip";
}
