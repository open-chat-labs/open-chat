import { get } from "svelte/store";
import type { ChatSummary, MessageIndexRange } from "../domain/chat/chat";
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
                    .then((ids) => {
                        if (ids.length > 0) {
                            console.log("marking: reprocessing messageIds: ", ids);
                        }
                        chatMessages.capturedMessages = {
                            indexRanges: chatMessages.capturedMessages.indexRanges,
                            ids: new Set<bigint>([...chatMessages.capturedMessages.ids, ...ids]),
                        };
                    });
            } else if (chatMessages.chat.kind === "group_chat") {
                return api
                    .markGroupChatMessagesRead(
                        chatMessages.chat.chatId,
                        chatMessages.pendingMessages.indexRanges,
                        chatMessages.pendingMessages.ids
                    )
                    .then((ids) => {
                        chatMessages.capturedMessages = {
                            indexRanges: chatMessages.capturedMessages.indexRanges,
                            ids: new Set<bigint>([...chatMessages.capturedMessages.ids, ...ids]),
                        };
                    });
            }
        }
    }

    if (interval !== undefined) {
        clearInterval(interval);
    }

    interval = setInterval(() => {
        Object.values(state).forEach(sendToServer);
    }, MARK_READ_INTERVAL);

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
