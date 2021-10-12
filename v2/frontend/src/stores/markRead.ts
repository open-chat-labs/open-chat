import { get } from "svelte/store";
import type { MarkReadRequest, MarkReadResponse, MessageIndexRange } from "../domain/chat/chat";
import {
    indexIsInRanges,
    insertIndexIntoRanges,
    mergeMessageIndexRanges,
} from "../domain/chat/chat.utils";
import { unconfirmed } from "./unconfirmed";

const MARK_READ_INTERVAL = 10 * 1000;

export interface MarkMessagesRead {
    markMessagesRead: (request: MarkReadRequest) => Promise<MarkReadResponse>;
}

type MessageRangesByChat = Record<string, MessageIndexRange[]>;

export type MessageReadTracker = {
    markMessageRead: (chatId: string, messageIndex: number, messageId: bigint) => void;
    confirmMessage: (chatId: string, messageIndex: number, messageId: bigint) => void;
    syncWithServer: (chatId: string, ranges: MessageIndexRange[]) => void;
    unreadMessageCount: (
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ) => number;
    isRead: (chatId: string, messageIndex: number, messageId: bigint) => boolean;
};

let interval: NodeJS.Timer | undefined = undefined;

export function stopMarkReadPoller(): void {
    if (interval !== undefined) {
        console.log("stopping the mark read poller");
        clearInterval(interval);
    }
}

export const serverState: MessageRangesByChat = {};
export const waiting: Set<bigint> = new Set<bigint>();
export let state: MessageRangesByChat = {};
export let pendingState: MessageRangesByChat = {};

export function initMarkRead(api: MarkMessagesRead): MessageReadTracker {
    function sendToServer() {
        pendingState = {
            ...state,
        };
        state = {};

        const req = Object.entries(pendingState).reduce<MarkReadRequest>(
            (req, [chatId, ranges]) => {
                if (ranges.length > 0) {
                    req.push({
                        chatId,
                        ranges,
                    });
                }
                return req;
            },
            [] as MarkReadRequest
        );

        if (req.length > 0) {
            console.log("read: sending to server: ", req);
            api.markMessagesRead(req);
        }
    }

    if (interval !== undefined) {
        clearInterval(interval);
    }

    if (process.env.NODE_ENV !== "test") {
        interval = setInterval(sendToServer, MARK_READ_INTERVAL);
    }

    // if the user closes the window, try to flush any unsynced changes to the server
    if (process.env.NODE_ENV !== "test") {
        window.onbeforeunload = sendToServer;
    }

    function markMessageRead(chatId: string, messageIndex: number, messageId: bigint) {
        if (!state[chatId]) {
            state[chatId] = [];
        }
        if (get(unconfirmed).has(messageId)) {
            // if a message is unconfirmed we will just tuck it away until we are told it has been confirmed
            waiting.add(messageId);
        } else {
            state[chatId] = insertIndexIntoRanges(messageIndex, state[chatId] ?? []);
        }
    }

    function confirmMessage(chatId: string, messageIndex: number, messageId: bigint) {
        // this is called when a message is confirmed so that we can move it from
        // the unconfirmed read to the confirmed read. This means that it will get
        // marked as read on the back end
        if (waiting.has(messageId)) {
            waiting.delete(messageId);
            console.log("read: confirming message at index ", messageIndex);
            markMessageRead(chatId, messageIndex, messageId);
            console.log("read: after confirm: ", state[chatId]);
        }
    }

    function syncWithServer(chatId: string, ranges: MessageIndexRange[]) {
        serverState[chatId] = ranges;
    }

    function unreadMessageCount(
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ) {
        if (latestMessageIndex === undefined) {
            // if we have no latestMessage then we can only have unconfirmed unread messages
            return waiting.size;
        }

        const merged = mergeMessageIndexRanges(serverState[chatId] ?? [], state[chatId] ?? []);
        if (merged.length === 0) {
            // all messages are unread
            return latestMessageIndex - firstMessageIndex + 1;
        }

        const [, unread, lastRead] = merged.reduce(
            ([first, unread], { from, to }) => {
                return [to + 1, unread + Math.max(from, first) - first, to];
            },
            [firstMessageIndex, 0, 0] // [firstIndex, unreadCount, lastReadIndex]
        );

        return latestMessageIndex - lastRead + unread - waiting.size;
    }

    function isRead(chatId: string, messageIndex: number, messageId: bigint) {
        if (get(unconfirmed).has(messageId)) {
            return waiting.has(messageId);
        } else {
            const merged = mergeMessageIndexRanges(serverState[chatId] ?? [], state[chatId] ?? []);
            return indexIsInRanges(messageIndex, merged);
        }
    }

    return {
        markMessageRead,
        confirmMessage,
        syncWithServer,
        unreadMessageCount,
        isRead,
    };
}

export const fakeMessageReadTracker: MessageReadTracker = {
    markMessageRead: (_chat: string, _messageIndex: number, _messageId: bigint) => {
        return undefined;
    },
    confirmMessage: (_chatId: string, _messageIndex: number, _messageId: bigint) => {
        return undefined;
    },
    syncWithServer: (_chatId: string, _ranges: MessageIndexRange[]) => {
        return undefined;
    },
    unreadMessageCount: (
        _chatId: string,
        _firstMessageIndex: number,
        _latestMessageIndex: number | undefined
    ) => {
        return 0;
    },
    isRead: (_chat: string, _messageIndex: number, _messageId: bigint) => {
        return false;
    },
};
