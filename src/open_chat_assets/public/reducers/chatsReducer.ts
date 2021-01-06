import * as assert from "assert";

import { Chat, ChatId, DirectChat } from "../model/chats";
import { Option } from "../model/common";
import { ConfirmedMessage, Message, MissingMessage, UnconfirmedMessage } from "../model/messages";
import { UserId } from "../model/users";
import { chatIdsEqual, userIdsEqual } from "../utils";

import { CHAT_SELECTED, ChatSelectedEvent } from "../actions/chats/selectChat";
import { SETUP_NEW_DIRECT_CHAT_SUCCEEDED, SetupNewDirectChatSucceededEvent } from "../actions/chats/setupNewDirectChat";

import {
    GET_ALL_CHATS_SUCCEEDED,
    GetAllChatsFailedEvent,
    GetAllChatsRequestedEvent,
    GetAllChatsSucceededEvent
} from "../actions/chats/getAllChats";

import {
    GET_MESSAGES_BY_ID_FAILED,
    GET_MESSAGES_BY_ID_REQUESTED,
    GET_MESSAGES_BY_ID_SUCCEEDED,
    GetMessagesByIdFailedEvent,
    GetMessagesByIdRequestedEvent,
    GetMessagesByIdSucceededEvent
} from "../actions/chats/getMessagesById";

import {
    SEND_MESSAGE_REQUESTED,
    SEND_MESSAGE_SUCCEEDED,
    SendMessageFailedEvent,
    SendMessageRequestedEvent,
    SendMessageSucceededEvent
} from "../actions/chats/sendMessage";

type State = {
    chats: Chat[],
    selectedChatIndex: Option<number>
}

const initialState: State = {
    chats: [],
    selectedChatIndex: null
};

type Event =
    ChatSelectedEvent |
    GetAllChatsRequestedEvent |
    GetAllChatsSucceededEvent |
    GetAllChatsFailedEvent |
    GetMessagesByIdRequestedEvent |
    GetMessagesByIdSucceededEvent |
    GetMessagesByIdFailedEvent |
    SendMessageRequestedEvent |
    SendMessageSucceededEvent |
    SendMessageFailedEvent |
    SetupNewDirectChatSucceededEvent;

export default function(state: State = initialState, event: Event) : State {
    switch (event.type) {
        case CHAT_SELECTED: {
            return {
                ...state,
                selectedChatIndex: event.payload
            };
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            return {
                ...state,
                chats: event.payload,
                selectedChatIndex: event.payload.length ? 0 : null
            };
        }

        case GET_MESSAGES_BY_ID_REQUESTED: {
            const { chatId, messageIds } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, chatId);
            const chatCopy = { ...chatsCopy[chatIndex] };
            chatsCopy[chatIndex] = chatCopy;
            chatCopy.missingMessagesRequested = new Set<number>(chatCopy.missingMessagesRequested);

            messageIds.forEach(chatCopy.missingMessagesRequested.add);

            return {
                ...state,
                chats: chatsCopy
            };
        }

        case GET_MESSAGES_BY_ID_SUCCEEDED: {
            const { request, result } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, request.chatId);
            const chatCopy = { ...chatsCopy[chatIndex] };
            chatsCopy[chatIndex] = chatCopy;
            chatCopy.messages = chatCopy.messages.slice();
            chatCopy.missingMessages = new Set<number>(chatCopy.missingMessages);
            chatCopy.missingMessagesRequested = new Set<number>(chatCopy.missingMessagesRequested);

            addMessagesToChat(chatCopy, result.messages);
            result.messages.forEach(m => chatCopy.missingMessages.delete(m.id));
            request.messageIds.forEach(chatCopy.missingMessagesRequested.delete);

            return {
                ...state,
                chats: chatsCopy
            };
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, chatId);
            const chatCopy = { ...chatsCopy[chatIndex] };
            chatsCopy[chatIndex] = chatCopy;
            chatCopy.missingMessagesRequested = new Set<number>(chatCopy.missingMessagesRequested);

            messageIds.forEach(chatCopy.missingMessagesRequested.delete);

            return {
                ...state,
                chats: chatsCopy
            };
        }

        case SEND_MESSAGE_REQUESTED: {
            const payload = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = payload.kind === "direct"
                ? findDirectChatIndex(chatsCopy, payload.userId)
                : findGroupChatIndex(chatsCopy, payload.chatId);

            const chatCopy = { ...chatsCopy[chatIndex] };
            chatCopy.messages = chatCopy.messages.slice();

            const unconfirmedMessage : UnconfirmedMessage = {
                kind: "unconfirmed",
                id: payload.unconfirmedMessageId,
                text: payload.message
            };
            chatCopy.messages.push(unconfirmedMessage);

            chatsCopy.splice(chatIndex, 1);
            chatsCopy.unshift(chatCopy);

            return {
                chats: chatsCopy,
                selectedChatIndex: 0
            };
        }

        case SEND_MESSAGE_SUCCEEDED: {
            const payload = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = payload.kind === "direct"
                ? findDirectChatIndex(chatsCopy, payload.userId)
                : findGroupChatIndex(chatsCopy, payload.chatId);

            const chatCopy = { ...chatsCopy[chatIndex] };
            chatsCopy[chatIndex] = chatCopy;
            chatCopy.messages = chatCopy.messages.slice();
            chatCopy.missingMessages = new Set<number>(chatCopy.missingMessages);

            const firstMessage = chatCopy.messages[0];
            assert.notStrictEqual(firstMessage.kind, "unconfirmed");

            const confirmedMessage: ConfirmedMessage = {
                kind: "confirmed",
                id: payload.confirmedMessageId,
                timestamp: payload.confirmedMessageTimestamp,
                sender: payload.sender,
                text: payload.message
            };

            const firstMessageId = firstMessage.id as number;
            const confirmedMessageIndex = payload.confirmedMessageId - firstMessageId;
            const unconfirmedMessageIndex = chatCopy.messages.findIndex(m => m.kind === "unconfirmed" && m.id === payload.unconfirmedMessageId);

            if (confirmedMessageIndex === unconfirmedMessageIndex) {
                chatCopy.messages[unconfirmedMessageIndex] = confirmedMessage;
            } else {
                const messagesToInsert: Message[] = [];
                for (let id = unconfirmedMessageIndex; id < confirmedMessageIndex; id++) {
                    chatCopy.missingMessages.add(id);
                    messagesToInsert.push({
                        kind: "missing",
                        id
                    });
                }

                messagesToInsert.push(confirmedMessage);
                chatCopy.messages.splice(unconfirmedMessageIndex, 1, ...messagesToInsert);
            }

            chatCopy.missingMessages.delete(confirmedMessage.id);

            if (chatCopy.confirmedOnServerUpTo < confirmedMessage.id) {
                chatCopy.confirmedOnServerUpTo = confirmedMessage.id;
            }

            if (chatCopy.latestMessageId < confirmedMessage.id) {
                chatCopy.latestMessageId = confirmedMessage.id;
            }

            return {
                chats: chatsCopy,
                selectedChatIndex: state.selectedChatIndex
            };
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const { userId } = event.payload;

            const newChat: DirectChat = {
                kind: "direct",
                them: userId,
                chatId: 0,
                updatedDate: 0,
                latestMessageId: 0,
                readUpTo: 0,
                confirmedOnServerUpTo: 0,
                missingMessages: new Set<number>(),
                missingMessagesRequested: new Set<number>(),
                messages: []
            };

            return {
                ...state,
                chats: [newChat, ...state.chats],
                selectedChatIndex: 0
            };
        }

        default:
          return state;
    }
}

function addMessagesToChat(chat: Chat, messages: ConfirmedMessage[]) {
    messages.sort((a, b) => a.id - b.id);

    const firstMessageId = chat.messages[0].id as number;
    messages.forEach(m => {
        const messageIndex = m.id - firstMessageId;

        if (messageIndex < chat.messages.length) {
            chat.messages[messageIndex] = m;
        } else if (messageIndex === chat.messages.length) {
            chat.messages.push(m);
        } else {
            const missingMessagesCount = messageIndex - chat.messages.length;
            const missingMessages: MissingMessage[] = [];
            for (let i = 1; i <= missingMessagesCount; i++) {
                missingMessages.push({ kind: "missing", id: chat.confirmedOnServerUpTo + i });
            }
            const lastConfirmedMessageIndex = chat.confirmedOnServerUpTo - firstMessageId;

            chat.messages.splice(lastConfirmedMessageIndex, 0, ...missingMessages);
            chat.messages.push(m);
        }

        if (chat.confirmedOnServerUpTo < m.id) {
            chat.confirmedOnServerUpTo = m.id;
        }

        if (chat.latestMessageId < m.id) {
            chat.latestMessageId = m.id;
        }
    });
}

function findChatIndex(chats: Chat[], chatId: ChatId) : number {
    return chats.findIndex(c => c.chatId && chatIdsEqual(chatId, c.chatId));
}

function findDirectChatIndex(chats: Chat[], userId: UserId) : number {
    return chats.findIndex(c => c.kind === "direct" && userIdsEqual(userId, c.them));
}

function findGroupChatIndex(chats: Chat[], chatId: ChatId) : number {
    return chats.findIndex(c => c.kind === "group" && chatIdsEqual(chatId, c.chatId));
}

function sortMessages(left: Message, right: Message) : number {
    if (left.kind === "unconfirmed") {
        return right.kind === "unconfirmed" ? 0 : 1;
    } else if (right.kind === "unconfirmed") {
        return -1;
    }

    return left.id - right.id;
}
