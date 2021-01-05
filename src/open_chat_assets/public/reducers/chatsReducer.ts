import { Chat, ChatId, DirectChat } from "../model/chats";
import { Option } from "../model/common";
import { ConfirmedMessage, Message, UnconfirmedMessage } from "../model/messages";
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
            }
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            return {
                ...state,
                chats: event.payload,
                selectedChatIndex: event.payload.length ? 0 : null
            };
        }

        case SEND_MESSAGE_REQUESTED: {
            const payload = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = payload.kind === "direct"
                ? findDirectChatIndex(chatsCopy, payload.userId)
                : findGroupChatIndex(chatsCopy, payload.chatId);

            const chatCopy = { ...chatsCopy[chatIndex] };
            const unconfirmedMessage : UnconfirmedMessage = {
                kind: "unconfirmed",
                id: payload.unconfirmedMessageId,
                text: payload.message
            };
            chatCopy.messages.push(unconfirmedMessage);

            chatsCopy.splice(chatIndex, 1);

            return {
                chats: [chatCopy, ...chatsCopy],
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
            const messageIndex = chatCopy.messages.findIndex(m => m.kind === "unconfirmed" && m.id === payload.unconfirmedMessageId);
            const confirmedMessage: ConfirmedMessage = {
                kind: "confirmed",
                id: payload.confirmedMessageId,
                timestamp: payload.confirmedMessageTimestamp,
                sender: 0, // TODO Get the actual value
                text: payload.message
            }
            chatCopy.messages[messageIndex] = confirmedMessage;
            chatCopy.messages.sort(sortMessages);

            if (chatCopy.latestMessageId < confirmedMessage.id) {
                chatCopy.latestMessageId = confirmedMessage.id;
            }

            // TODO Check for any missing messages / duplicates

            return {
                chats: chatsCopy,
                selectedChatIndex: state.selectedChatIndex
            };
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const user = event.payload;

            const newChat: DirectChat = {
                kind: "direct",
                them: user.userId,
                updatedDate: 0,
                latestMessageId: 0,
                readUpTo: 0,
                missingMessages: [],
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
