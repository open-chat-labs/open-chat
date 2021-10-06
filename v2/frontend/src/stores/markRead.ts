import { get } from "svelte/store";
import type { ChatSummary, MessageIndexRange } from "../domain/chat/chat";
import { insertIndexIntoRanges } from "../domain/chat/chat.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { rollbar } from "../utils/logging";
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
        capturedMessages: initMessages(),
        pendingMessages: initMessages(),
    };
}

type ChatReadMessages = {
    chat: ChatSummary;
    capturedMessages: Messages;
    pendingMessages: Messages;
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
    const state: Record<string, ChatReadMessages> = {};

    function sendToServer(chatMessages: ChatReadMessages) {
        chatMessages.pendingMessages = chatMessages.capturedMessages;
        chatMessages.capturedMessages = initMessages();
        if (
            chatMessages.pendingMessages.indexRanges.length > 0 ||
            chatMessages.pendingMessages.ids.size > 0
        ) {
            if (chatMessages.chat.kind === "direct_chat") {
                return api
                    .markDirectChatMessagesRead(
                        chatMessages.chat.them,
                        chatMessages.pendingMessages.indexRanges,
                        chatMessages.pendingMessages.ids
                    )
                    .then((resp) => {
                        if (resp === "failure") {
                            rollbar.warn("marking direct chat messages as read failed");
                        }
                    });
            } else if (chatMessages.chat.kind === "group_chat") {
                return api
                    .markGroupChatMessagesRead(
                        chatMessages.chat.chatId,
                        chatMessages.pendingMessages.indexRanges,
                        chatMessages.pendingMessages.ids
                    )
                    .then((resp) => {
                        if (resp === "failure") {
                            rollbar.warn("marking group chat messages as read failed");
                        }
                    });
            }
        }
    }

    if (interval !== undefined) {
        clearInterval(interval);
    }

    if (process.env.NODE_ENV !== "test") {
        interval = setInterval(() => {
            Object.values(state).forEach(sendToServer);
        }, MARK_READ_INTERVAL);
    }

    return {
        markMessageRead: (chat: ChatSummary, messageIndex: number, messageId: bigint): void => {
            if (!state[chat.chatId]) {
                state[chat.chatId] = initChat(chat);
            }
            const chatMessage = state[chat.chatId];
            if (get(unconfirmed).has(messageId)) {
                chatMessage.capturedMessages.ids.add(messageId);
            } else {
                chatMessage.capturedMessages.indexRanges = insertIndexIntoRanges(
                    messageIndex,
                    chatMessage.capturedMessages.indexRanges
                );
            }
        },
    };
}
