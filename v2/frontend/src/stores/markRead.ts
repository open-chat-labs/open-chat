import { get } from "svelte/store";
import type { ChatSummary, MarkReadRequest, MessageIndexRange } from "../domain/chat/chat";
import { insertIndexIntoRanges } from "../domain/chat/chat.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { unconfirmed } from "./unconfirmed";

const MARK_READ_INTERVAL = 2000;

function initMessages(): Messages {
    return {
        indexRanges: [],
        ids: new Set<bigint>(),
    };
}

function initChat(chat: ChatSummary): ChatReadMessages {
    return {
        chat,
        messages: initMessages(),
    };
}

type ChatReadMessages = {
    chat: ChatSummary;
    messages: Messages;
};

type Messages = {
    indexRanges: MessageIndexRange[];
    ids: Set<bigint>;
};

export type MessageReadTracker = {
    markMessageRead: (chat: ChatSummary, messageIndex: number, messageId: bigint) => void;
};

let interval: NodeJS.Timer | undefined = undefined;

export function stopMarkReadPoller(): void {
    if (interval !== undefined) {
        console.log("stopping the mark read poller");
        clearInterval(interval);
    }
}

export function initMarkRead(api: ServiceContainer): MessageReadTracker {
    let state: Record<string, ChatReadMessages> = {};
    let pendingState: Record<string, ChatReadMessages> = {};

    function sendToServer() {
        pendingState = {
            ...state,
        };
        state = {};

        const req = Object.entries(pendingState).reduce<MarkReadRequest>(
            (req, [chatId, messages]) => {
                if (messages.messages.indexRanges.length > 0) {
                    req.push({
                        chatId,
                        ranges: messages.messages.indexRanges,
                    });
                }
                return req;
            },
            [] as MarkReadRequest
        );

        api.markMessagesRead(req);
    }

    if (interval !== undefined) {
        clearInterval(interval);
    }

    if (process.env.NODE_ENV !== "test") {
        interval = setInterval(sendToServer, MARK_READ_INTERVAL);
    }

    return {
        markMessageRead: (chat: ChatSummary, messageIndex: number, messageId: bigint): void => {
            if (!state[chat.chatId]) {
                state[chat.chatId] = initChat(chat);
            }
            const chatMessage = state[chat.chatId];
            if (get(unconfirmed).has(messageId)) {
                chatMessage.messages.ids.add(messageId);
            } else {
                chatMessage.messages.indexRanges = insertIndexIntoRanges(
                    messageIndex,
                    chatMessage.messages.indexRanges
                );
            }
        },
    };
}
