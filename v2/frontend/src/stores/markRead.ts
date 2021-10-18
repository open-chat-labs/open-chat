import { get } from "svelte/store";
import type { MarkReadRequest, MarkReadResponse, MessageIndexRange } from "../domain/chat/chat";
import {
    indexIsInRanges,
    insertIndexIntoRanges,
    mergeMessageIndexRanges,
    messageIndexRangesAreEqual,
} from "../domain/chat/chat.utils";
import { unconfirmed } from "./unconfirmed";

const MARK_READ_INTERVAL = 10 * 1000;

export interface MarkMessagesRead {
    markMessagesRead: (request: MarkReadRequest) => Promise<MarkReadResponse>;
}

type MessageRangesByChat = Record<string, MessageIndexRange[]>;

export type MessageReadTracker = {
    markRangeRead: (chatId: string, range: MessageIndexRange) => void;
    markMessageRead: (chatId: string, messageIndex: number, messageId: bigint) => void;
    confirmMessage: (chatId: string, messageIndex: number, messageId: bigint) => boolean;
    syncWithServer: (chatId: string, ranges: MessageIndexRange[]) => void;
    unreadMessageCount: (
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ) => number;
    isRead: (chatId: string, messageIndex: number, messageId: bigint) => boolean;
};

let interval: number | undefined = undefined;

export function stopMarkReadPoller(): void {
    if (interval !== undefined) {
        console.log("stopping the mark read poller");
        clearInterval(interval);
    }
}

export const serverState: MessageRangesByChat = {};
export const waiting: Record<string, Set<bigint>> = {};
export const state: MessageRangesByChat = {};

export function initMarkRead(api: MarkMessagesRead): MessageReadTracker {
    function sendToServer() {
        const req = Object.entries(state).reduce<MarkReadRequest>((req, [chatId, ranges]) => {
            if (ranges.length > 0) {
                req.push({
                    chatId,
                    ranges,
                });
            }
            return req;
        }, [] as MarkReadRequest);

        if (req.length > 0) {
            api.markMessagesRead(req);
        }
    }

    if (interval !== undefined) {
        clearInterval(interval);
    }

    if (process.env.NODE_ENV !== "test") {
        interval = window.setInterval(sendToServer, MARK_READ_INTERVAL);
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
            if (waiting[chatId] === undefined) {
                waiting[chatId] = new Set<bigint>();
            }
            waiting[chatId].add(messageId);
        } else {
            state[chatId] = insertIndexIntoRanges(messageIndex, state[chatId] ?? []);
        }
    }

    function markRangeRead(chatId: string, range: MessageIndexRange) {
        if (!state[chatId]) {
            state[chatId] = [];
        }
        state[chatId] = mergeMessageIndexRanges(state[chatId], [range]);
    }

    function confirmMessage(chatId: string, messageIndex: number, messageId: bigint): boolean {
        // this is called when a message is confirmed so that we can move it from
        // the unconfirmed read to the confirmed read. This means that it will get
        // marked as read on the back end
        if (waiting[chatId] !== undefined && waiting[chatId].has(messageId)) {
            waiting[chatId].delete(messageId);
            markMessageRead(chatId, messageIndex, messageId);
            return true;
        }
        return false;
    }

    function syncWithServer(chatId: string, ranges: MessageIndexRange[]) {
        serverState[chatId] = ranges;

        // if the range from the server is equal to the range on the client and the range on the server merged
        // that means we are in sync and we can clear the local state
        const merged = mergeMessageIndexRanges(serverState[chatId], state[chatId] ?? []);
        if (messageIndexRangesAreEqual(serverState[chatId], merged)) {
            state[chatId] = [];
        }
    }

    function unreadMessageCount(
        chatId: string,
        firstMessageIndex: number,
        latestMessageIndex: number | undefined
    ) {
        const numWaiting = waiting[chatId] === undefined ? 0 : waiting[chatId].size;

        if (latestMessageIndex === undefined) {
            // if we have no latestMessage then we can only have unconfirmed unread messages
            return numWaiting;
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

        // todo - this is wrong at the moment. Waiting needs to be partitioned by chatId OBVIOUSLY
        return latestMessageIndex - lastRead + unread - numWaiting;
    }

    function isRead(chatId: string, messageIndex: number, messageId: bigint) {
        if (get(unconfirmed).has(messageId)) {
            return waiting[chatId] !== undefined && waiting[chatId].has(messageId);
        } else {
            const merged = mergeMessageIndexRanges(serverState[chatId] ?? [], state[chatId] ?? []);
            return indexIsInRanges(messageIndex, merged);
        }
    }

    return {
        markRangeRead,
        markMessageRead,
        confirmMessage,
        syncWithServer,
        unreadMessageCount,
        isRead,
    };
}

export const fakeMessageReadTracker: MessageReadTracker = {
    markRangeRead: (_chatId: string, _range: MessageIndexRange) => {
        return undefined;
    },
    markMessageRead: (_chat: string, _messageIndex: number, _messageId: bigint) => {
        return undefined;
    },
    confirmMessage: (_chatId: string, _messageIndex: number, _messageId: bigint) => {
        return false;
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
