import {
    Chat,
    ChatId,
    ConfirmedChat,
    DirectChat,
    GroupChat,
    NewDirectChat,
    NewGroupChat,
    UnconfirmedChat
} from "../model/chats";
import { Option, Timestamp } from "../model/common";
import { ConfirmedMessage, LocalMessage, Message, RemoteMessage, UnconfirmedMessage } from "../model/messages";
import { UserId } from "../model/users";
import * as setFunctions from "../utils/setFunctions";
import { MIN_MESSAGE_ID, PAGE_SIZE } from "../constants";

import { CHAT_SELECTED, ChatSelectedEvent } from "../actions/chats/selectChat";
import { SETUP_NEW_DIRECT_CHAT_SUCCEEDED, SetupNewDirectChatSucceededEvent } from "../actions/chats/setupNewDirectChat";

import {
    CREATE_GROUP_CHAT_REQUESTED,
    CREATE_GROUP_CHAT_SUCCEEDED,
    CreateGroupChatFailedEvent,
    CreateGroupChatRequestedEvent,
    CreateGroupChatSucceededEvent
} from "../actions/chats/createGroupChat";

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

import { GET_UPDATED_CHATS_SUCCEEDED, GetUpdatedChatsSucceededEvent } from "../actions/chats/getUpdatedChats";

import {
    SEND_MESSAGE_REQUESTED,
    SEND_MESSAGE_SUCCEEDED,
    SendMessageFailedEvent,
    SendMessageRequestedEvent,
    SendMessageSucceededEvent
} from "../actions/chats/sendMessage";

type State = {
    chats: Chat[],
    selectedChatIndex: Option<number>,
    chatsSyncedUpTo: Option<Timestamp>
}

const initialState: State = {
    chats: [],
    selectedChatIndex: null,
    chatsSyncedUpTo: null
};

type Event =
    ChatSelectedEvent |
    CreateGroupChatRequestedEvent |
    CreateGroupChatSucceededEvent |
    CreateGroupChatFailedEvent |
    GetAllChatsRequestedEvent |
    GetAllChatsSucceededEvent |
    GetAllChatsFailedEvent |
    GetMessagesByIdRequestedEvent |
    GetMessagesByIdSucceededEvent |
    GetMessagesByIdFailedEvent |
    GetUpdatedChatsSucceededEvent |
    SendMessageRequestedEvent |
    SendMessageSucceededEvent |
    SendMessageFailedEvent |
    SetupNewDirectChatSucceededEvent;

export default function(state: State = initialState, event: Event) : State {
    switch (event.type) {
        case CHAT_SELECTED: {
            const selectedChatIndex = event.payload;
            let chat = state.chats[selectedChatIndex];
            let chats = state.chats;
            if ("chatId" in chat) {
                const chatCopy = chat.clone();
                chats = chats.slice();
                chats[selectedChatIndex] = chatCopy;
                chatCopy.messages = chatCopy.messages.slice();
                chatCopy.messagesToDownload = chatCopy.messagesToDownload.slice();
                chatCopy.earliestConfirmedMessageId = chatCopy.latestConfirmedMessageId - PAGE_SIZE;
                chatCopy.queueMissingMessagesForDownload();
            }

            return {
                ...state,
                chats,
                selectedChatIndex
            };
        }

        case CREATE_GROUP_CHAT_REQUESTED: {
            const { tempId, subject, users } = event.payload;

            const newChat: NewGroupChat = new NewGroupChat(
                tempId,
                subject,
                users);

            return {
                ...state,
                chats: [newChat, ...state.chats],
                selectedChatIndex: 0
            };
        }

        case CREATE_GROUP_CHAT_SUCCEEDED: {
            const { tempId, chatId, date } = event.payload;

            const chatIndex = state.chats.findIndex(c => c instanceof NewGroupChat && c.id === tempId);
            const chat = state.chats[chatIndex] as NewGroupChat;
            const newChat = new GroupChat(
                chatId,
                chat.subject,
                chat.participants,
                date);

            const chatsCopy = state.chats.slice();
            chatsCopy[chatIndex] = newChat;

            const selectedChatIndex = sortChatsAndReturnSelectedIndex(chatsCopy, state.selectedChatIndex!);

            return {
                ...state,
                chats: chatsCopy,
                selectedChatIndex
            };
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp } = event.payload;

            return {
                ...state,
                chats,
                selectedChatIndex: chats.length ? 0 : null,
                chatsSyncedUpTo: latestUpdateTimestamp
            };
        }

        case GET_MESSAGES_BY_ID_REQUESTED: {
            const { chatId, messageIds } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, chatId);
            const chatCopy = (chatsCopy[chatIndex] as ConfirmedChat).clone();
            chatsCopy[chatIndex] = chatCopy;

            chatCopy.messagesDownloading = setFunctions.union(chatCopy.messagesDownloading, messageIds);

            return {
                ...state,
                chats: chatsCopy
            };
        }

        case GET_MESSAGES_BY_ID_SUCCEEDED: {
            const { request, result } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, request.chatId);
            const chatCopy = (chatsCopy[chatIndex] as ConfirmedChat).clone();
            chatsCopy[chatIndex] = chatCopy;
            chatCopy.messages = chatCopy.messages.slice();
            chatCopy.messagesDownloading = setFunctions.except(chatCopy.messagesDownloading, request.messageIds);

            chatCopy.addMessages(result.messages);

            const selectedChatIndex = sortChatsAndReturnSelectedIndex(chatsCopy, state.selectedChatIndex!);

            return {
                ...state,
                chats: chatsCopy,
                selectedChatIndex
            };
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, chatId);
            const chatCopy = (chatsCopy[chatIndex] as ConfirmedChat).clone();
            chatsCopy[chatIndex] = chatCopy;

            chatCopy.messagesDownloading = setFunctions.except(chatCopy.messagesDownloading, messageIds);

            return {
                ...state,
                chats: chatsCopy
            };
        }

        case GET_UPDATED_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp } = event.payload;

            if (!chats.length) {
                return state;
            }

            const chatsCopy = state.chats.slice();
            chats.forEach(c => {
                const chatIndex = findChatIndex(chatsCopy, c.chatId);
                if (chatIndex >= 0) {
                    const chatCopy = (chatsCopy[chatIndex] as ConfirmedChat).clone();
                    chatsCopy[chatIndex] = chatCopy;
                    // These messages have just come from the server so are all of type LocalMessage
                    const messages = c.messages as LocalMessage[];
                    chatCopy.addMessages(messages);
                } else {
                    chatsCopy.push(c);
                }
            });

            const selectedChatIndex = sortChatsAndReturnSelectedIndex(chatsCopy, state.selectedChatIndex);

            return {
                ...state,
                chats: chatsCopy,
                selectedChatIndex,
                chatsSyncedUpTo: latestUpdateTimestamp
            };
        }

        case SEND_MESSAGE_REQUESTED: {
            const payload = event.payload;
            const chatsCopy = state.chats.slice();
            let chatIndex: number = -1;
            if ("chatId" in payload && payload.chatId !== null) {
                chatIndex = findChatIndex(chatsCopy, payload.chatId);
            } else if ("userId" in payload) {
                chatIndex = findDirectChatIndex(chatsCopy, payload.userId);
            } else if ("unconfirmedChatId" in payload) {
                chatIndex = findNewGroupChatIndex(chatsCopy, payload.unconfirmedChatId);
            }

            const chatCopy = chatsCopy[chatIndex].clone();
            chatCopy.addUnconfirmedMessage(payload.message);

            chatsCopy.splice(chatIndex, 1);
            chatsCopy.unshift(chatCopy);

            return {
                ...state,
                chats: chatsCopy,
                selectedChatIndex: 0
            };
        }

        case SEND_MESSAGE_SUCCEEDED: {
            const payload = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = payload.kind === "direct"
                ? findDirectChatIndex(chatsCopy, payload.userId)
                : findChatIndex(chatsCopy, payload.chatId);

            // SEND_MESSAGE_SUCCEEDED will never happen on a NewGroupChat since messages need to be sent using either a
            // userId or a chatId and a NewGroupChat has neither.
            const chat = chatsCopy[chatIndex] as Exclude<Chat, NewGroupChat>;
            let chatCopy: ConfirmedChat;
            if (chat instanceof NewDirectChat) {
                chatCopy = new DirectChat(
                    payload.chatId,
                    chat.them,
                    payload.message.date,
                    0,
                    chat.messages);
            } else {
                chatCopy = chat.clone();
                chatCopy.messagesToDownload = chatCopy.messagesToDownload.slice();
                chatCopy.messages = chatCopy.messages.slice();
            }

            chatsCopy[chatIndex] = chatCopy;

            chatCopy.addMessage(payload.message);

            const selectedChatIndex = sortChatsAndReturnSelectedIndex(chatsCopy, state.selectedChatIndex!);

            return {
                ...state,
                chats: chatsCopy,
                selectedChatIndex
            };
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const { userId } = event.payload;

            const newChat: NewDirectChat = new NewDirectChat(userId);

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

function sortChatsAndReturnSelectedIndex(chats: Chat[], selectedIndex: Option<number>) {
    const selectedChat = selectedIndex !== null ? chats[selectedIndex] : null;
    chats.sort((a, b) => {
        if ("updatedDate" in a) {
            if ("updatedDate" in b) {
                // If both are confirmed then compare the updated dates
                return b.updatedDate.getTime() - a.updatedDate.getTime();
            }
            // If only 'a' is confirmed, then 'b' should appear first
            return -1;
        }

        // If only 'b' is confirmed, then 'a' should appear first
        if ("updatedDate" in b) {
            return 1;
        }

        // If neither are confirmed then treat them equally (this should be extremely rare)
        return 0;
    });
    return selectedChat !== null ? chats.indexOf(selectedChat) : 0;
}

function findChatIndex(chats: Chat[], chatId: ChatId) : number {
    return chats.findIndex(c => "chatId" in c && c.chatId && chatId === c.chatId);
}

function findDirectChatIndex(chats: Chat[], userId: UserId) : number {
    return chats.findIndex(c => "them" in c && userId === c.them);
}

function findNewGroupChatIndex(chats: Chat[], id: Symbol) : number {
    return chats.findIndex(c => c instanceof NewGroupChat && id === c.id);
}
