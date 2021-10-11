import { get } from "svelte/store";
import type { MarkReadRequest, MessageIndexRange } from "../domain/chat/chat";
import { insertIndexIntoRanges, mergeMessageIndexRanges } from "../domain/chat/chat.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { unconfirmed } from "./unconfirmed";

const MARK_READ_INTERVAL = 10 * 1000;

type MessageRangesByChat = Record<string, MessageIndexRange[]>;

export type MessageReadTracker = {
    markMessageRead: (chatId: string, messageIndex: number, messageId: bigint) => void;
    confirmMessage: (chatId: string, messageIndex: number, messageId: bigint) => void;
    syncWithServer: (chatId: string, ranges: MessageIndexRange[]) => void;
    unreadMessageCount: (
        chatId: string,
        firstMessageIndex: number,
        lastMessageIndex: number | undefined
    ) => number;
};

let interval: NodeJS.Timer | undefined = undefined;

export function stopMarkReadPoller(): void {
    if (interval !== undefined) {
        console.log("stopping the mark read poller");
        clearInterval(interval);
    }
}

export function initMarkRead(api: ServiceContainer): MessageReadTracker {
    const waiting: Set<bigint> = new Set<bigint>();
    let state: MessageRangesByChat = {};
    let pendingState: MessageRangesByChat = {};

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
            markMessageRead(chatId, messageIndex, messageId);
        }
    }

    function syncWithServer(chatId: string, ranges: MessageIndexRange[]) {
        state[chatId] = mergeMessageIndexRanges(state[chatId] ?? [], ranges);
    }

    function unreadMessageCount(
        chatId: string,
        firstMessageIndex: number,
        lastMessageIndex: number | undefined
    ) {
        if (lastMessageIndex === undefined) {
            // if we have no latestMessage then we cannot have any unread messages
            return 0;
        }

        if (state[chatId] === undefined || state[chatId].length === 0) {
            return lastMessageIndex - firstMessageIndex + 1;
        }

        const [, unread, lastRead] = state[chatId].reduce(
            ([first, unread], { from, to }) => {
                return [to + 1, unread + Math.max(from, first) - first, to];
            },
            [firstMessageIndex, 0, 0] // [firstIndex, unreadCount, lastReadIndex]
        );

        return lastMessageIndex - lastRead + unread + waiting.size;
    }

    return {
        markMessageRead,
        confirmMessage,
        syncWithServer,
        unreadMessageCount,
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
        _lastMessageIndex: number | undefined
    ) => {
        return 0;
    },
};
