import { Chat, ChatId, ConfirmedChat, DirectChat, NewDirectChat } from "../model/chats";
import { Option } from "../model/common";
import { LocalMessage, Message, RemoteMessage, UnconfirmedMessage } from "../model/messages";
import { UserId } from "../model/users";
import chatIdsEqual from "../utils/chatIdsEqual";
import userIdsEqual from "../utils/userIdsEqual";
import * as setFunctions from "../utils/setFunctions";
import * as timestamp from "../utils/timestamp";
import { MIN_MESSAGE_ID, PAGE_SIZE } from "../constants";

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
            const chat = state.chats[event.payload];
            let chats = state.chats;
            if (chat.kind !== "newDirect") {
                const messagesIds = getMessageIdsToFillLatestPage(chat.messages, chat.confirmedOnServerUpTo);

                if (messagesIds.length) {
                    chats = chats.slice();
                    const chatCopy = {...chat};
                    chats[event.payload] = chatCopy;
                    chatCopy.messagesToDownload = setFunctions.union(chatCopy.messagesToDownload, messagesIds);
                    addMessagesToChat(chatCopy, messagesIds.map(id => ({
                        kind: "remote",
                        id
                    } as RemoteMessage)));
                }
            }

            return {
                ...state,
                chats: chats,
                selectedChatIndex: event.payload
            };
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            const chats = event.payload;

            sortChats(chats);

            return {
                ...state,
                chats,
                selectedChatIndex: event.payload.length ? 0 : null
            };
        }

        case GET_MESSAGES_BY_ID_REQUESTED: {
            const { chatId, messageIds } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, chatId);
            const chatCopy = { ...chatsCopy[chatIndex] } as ConfirmedChat;
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
            const chatCopy = { ...chatsCopy[chatIndex] } as ConfirmedChat;
            chatsCopy[chatIndex] = chatCopy;
            chatCopy.messages = chatCopy.messages.slice();

            const messageIds = result.messages.map(m => m.id);
            chatCopy.messagesToDownload = setFunctions.except(chatCopy.messagesToDownload, messageIds);
            chatCopy.messagesDownloading = setFunctions.except(chatCopy.messagesDownloading, request.messageIds);

            addMessagesToChat(chatCopy, result.messages, result.latestMessageId);

            sortChats(chatsCopy);

            return {
                ...state,
                chats: chatsCopy
            };
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chatsCopy = state.chats.slice();
            const chatIndex = findChatIndex(chatsCopy, chatId);
            const chatCopy = { ...chatsCopy[chatIndex] } as ConfirmedChat;
            chatsCopy[chatIndex] = chatCopy;

            chatCopy.messagesDownloading = setFunctions.except(chatCopy.messagesDownloading, messageIds);

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
                timestamp: timestamp.getCurrent(),
                text: payload.message
            };
            chatCopy.messages.push(unconfirmedMessage);
            chatCopy.updatedDate = unconfirmedMessage.timestamp;

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

            const chat = chatsCopy[chatIndex];
            let chatCopy;
            if (chat.kind === "newDirect") {
                chatCopy = {
                    kind: "direct",
                    them: chat.them,
                    chatId: payload.chatId,
                    updatedDate: 0,
                    readUpTo: 0,
                    confirmedOnServerUpTo: 0,
                    messagesToDownload: [],
                    messagesDownloading: [],
                    messages: chat.messages
                } as DirectChat
            } else {
                chatCopy = { ...chat };
                chatCopy.messages = chatCopy.messages.slice();
                chatCopy.messagesToDownload = chatCopy.messagesToDownload.slice();
            }

            chatsCopy[chatIndex] = chatCopy;

            const confirmedMessage: LocalMessage = {
                kind: "local",
                id: payload.confirmedMessageId,
                timestamp: payload.confirmedMessageTimestamp,
                sender: payload.sender,
                text: payload.message
            };

            const firstMessage = chatCopy.messages[0];
            const confirmedMessageIndex =
                payload.confirmedMessageId - (firstMessage.kind === "unconfirmed" ? 1 : firstMessage.id);

            const unconfirmedMessageIndex = chatCopy.messages.findIndex(m =>
                m.kind === "unconfirmed" && m.id === payload.unconfirmedMessageId);

            if (confirmedMessageIndex === unconfirmedMessageIndex) {
                chatCopy.messages[unconfirmedMessageIndex] = confirmedMessage;
            } else {
                const messagesToInsert: Message[] = [];
                for (let missingMessageId = unconfirmedMessageIndex + 1; missingMessageId <= confirmedMessageIndex; missingMessageId++) {
                    setFunctions.add(chatCopy.messagesToDownload, missingMessageId);
                    messagesToInsert.push({
                        kind: "remote",
                        id: missingMessageId
                    });
                }

                messagesToInsert.push(confirmedMessage);
                chatCopy.messages.splice(unconfirmedMessageIndex, 1, ...messagesToInsert);
            }

            if (chatCopy.updatedDate < confirmedMessage.timestamp) {
                chatCopy.updatedDate = confirmedMessage.timestamp;
            }

            if (chatCopy.confirmedOnServerUpTo < confirmedMessage.id) {
                chatCopy.confirmedOnServerUpTo = confirmedMessage.id;
            }

            setFunctions.remove(chatCopy.messagesToDownload, confirmedMessage.id);

            sortChats(chatsCopy);

            return {
                chats: chatsCopy,
                selectedChatIndex: state.selectedChatIndex
            };
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const { userId } = event.payload;

            const newChat: NewDirectChat = {
                kind: "newDirect",
                them: userId,
                updatedDate: timestamp.getCurrent(),
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

function addMessagesToChat(chat: ConfirmedChat, messages: (LocalMessage | RemoteMessage)[], confirmedUpToOnServer?: Option<number>) {
    // Ensure messages are sorted by id (they should be already so this should only do a single iteration)
    messages.sort((a, b) => a.id - b.id);

    const lowestCurrentMessageId = chat.messages[0].id as number;
    const lowestNewMessageId = messages[0].id;

    let indexWhereNoLongerPrepending = 0;
    if (lowestNewMessageId < lowestCurrentMessageId) {
        // If we reach here, then we need to prepend at least 1 message to the current array
        const shiftRequired = lowestCurrentMessageId - lowestNewMessageId;
        const toPrepend: Message[] = [];
        for (let i = 0; i < messages.length && messages[i].id < lowestCurrentMessageId; i++) {
            const message = messages[i];
            toPrepend[message.id - lowestCurrentMessageId + shiftRequired] = message;
            indexWhereNoLongerPrepending++;
        }

        // Check for gaps in the array of messages, if found, plug them with RemoteMessages and queue them for download
        for (let id = lowestNewMessageId + 1; id < lowestCurrentMessageId; id++) {
            const index = id - lowestNewMessageId;
            if (!messages[index]) {
                chat.messages[index] = {
                    kind: "remote",
                    id: id
                } as RemoteMessage;

                setFunctions.add(chat.messagesToDownload, id);
            }
        }

        chat.messages.unshift(...toPrepend);
    }

    const lowestMessageId = Math.min(lowestCurrentMessageId, lowestNewMessageId);

    // Now handle the later messages
    for (let index = indexWhereNoLongerPrepending; index < messages.length; index++) {
        const message = messages[index];
        const messageIndex = message.id - lowestMessageId;

        if (messageIndex < chat.messages.length) {
            // This is the only case where we overwrite an existing message, so first check if the existing message is
            // 'local'. If it is we would be replacing it with a message that is the same or worse, so we do nothing.
            if (chat.messages[messageIndex].kind !== "local") {
                chat.messages[messageIndex] = message;
            }
        } else if (messageIndex === chat.messages.length) {
            chat.messages.push(message);
        } else {
            // If we reach here then some messages are missing so we need to add in some RemoteMessages and mark them to
            // be downloaded
            const firstMissingMessageId = chat.confirmedOnServerUpTo + 1;
            const lastMissingMessageId = message.id - 1;
            const lastConfirmedMessageIndex = chat.confirmedOnServerUpTo - lowestMessageId;
            addMissingMessages(firstMissingMessageId, lastMissingMessageId, lastConfirmedMessageIndex);
            chat.messages.push(message);
        }

        if (message.kind === "local" && chat.updatedDate < message.timestamp) {
            chat.updatedDate = message.timestamp;
        }

        if (chat.confirmedOnServerUpTo < message.id) {
            chat.confirmedOnServerUpTo = message.id;
        }
    }

    // If after adding these messages the confirmedOnServerUpTo value we have is still lower than what we got from the
    // server then we need to add some missing messages and mark them to be downloaded.
    if (confirmedUpToOnServer && chat.confirmedOnServerUpTo < confirmedUpToOnServer) {
        addMissingMessages(chat.confirmedOnServerUpTo + 1, confirmedUpToOnServer, chat.confirmedOnServerUpTo + 1);
        chat.confirmedOnServerUpTo = confirmedUpToOnServer;
    }

    function addMissingMessages(fromId: number, toId: number, index: number) {
        const missingMessages: RemoteMessage[] = [];
        for (let id = fromId; id <= toId; id++) {
            missingMessages.push({ kind: "remote", id });
            setFunctions.add(chat.messagesToDownload, id);
        }

        chat.messages.splice(index, 0, ...missingMessages);
    }
}

function getMessageIdsToFillLatestPage(messages: Message[], confirmedOnServerUpTo: number) : number[] {
    const minMessageIdRequired = Math.max(confirmedOnServerUpTo - PAGE_SIZE + 1, MIN_MESSAGE_ID);
    const maxMessageIdRequired = confirmedOnServerUpTo;
    const requiredMessageIds = [];

    if (messages.length && messages[0].kind !== "unconfirmed") {
        const firstMessageId = messages[0].id;
        for (let id = minMessageIdRequired; id <= maxMessageIdRequired; id++) {
            const index = id - firstMessageId;
            if (index < 0 || index >= messages.length || messages[index].kind !== "local") {
                requiredMessageIds.push(id);
            }
        }
    } else {
        for (let id = minMessageIdRequired; id <= maxMessageIdRequired; id++) {
            requiredMessageIds.push(id);
        }
    }

    return requiredMessageIds;
}

function sortChats(chats: Chat[]) {
    chats.sort((a, b) => b.updatedDate - a.updatedDate);
}

function findChatIndex(chats: Chat[], chatId: ChatId) : number {
    return chats.findIndex(c => c.kind !== "newDirect" && c.chatId && chatIdsEqual(chatId, c.chatId));
}

function findDirectChatIndex(chats: Chat[], userId: UserId) : number {
    return chats.findIndex(c => c.kind !== "group" && userIdsEqual(userId, c.them));
}

function findGroupChatIndex(chats: Chat[], chatId: ChatId) : number {
    return chats.findIndex(c => c.kind === "group" && chatIdsEqual(chatId, c.chatId));
}
