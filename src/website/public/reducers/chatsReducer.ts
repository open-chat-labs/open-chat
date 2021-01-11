import { Chat, ChatId, ConfirmedChat, DirectChat, NewDirectChat } from "../model/chats";
import { Option } from "../model/common";
import { ConfirmedMessage, LocalMessage, Message, RemoteMessage, UnconfirmedMessage } from "../model/messages";
import { UserId } from "../model/users";
import * as setFunctions from "../utils/setFunctions";
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
                const messagesIds = getMessageIdsToFillLatestPage(chat.confirmedMessages, chat.latestKnownMessageId);

                if (messagesIds.length) {
                    chats = chats.slice();
                    const chatCopy = { ...chat };
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

            return {
                ...state,
                chats,
                selectedChatIndex: chats.length ? 0 : null
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
            chatCopy.confirmedMessages = chatCopy.confirmedMessages.slice();
            chatCopy.unconfirmedMessages = chatCopy.unconfirmedMessages.slice();

            const messageIds = result.messages.map(m => m.id);
            chatCopy.messagesToDownload = setFunctions.except(chatCopy.messagesToDownload, messageIds);
            chatCopy.messagesDownloading = setFunctions.except(chatCopy.messagesDownloading, request.messageIds);

            addMessagesToChat(chatCopy, result.messages, result.latestMessageId);

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

            const unconfirmedMessage : UnconfirmedMessage = {
                kind: "unconfirmed",
                id: payload.unconfirmedMessageId,
                date: new Date(),
                text: payload.message
            };

            const chatCopy = { ...chatsCopy[chatIndex] };
            chatCopy.unconfirmedMessages = [...chatCopy.unconfirmedMessages, unconfirmedMessage];
            chatCopy.updatedDate = unconfirmedMessage.date;

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
                : findGroupChatIndex(chatsCopy, payload.chatId);

            const chat = chatsCopy[chatIndex];
            let chatCopy;
            if (chat.kind === "newDirect") {
                chatCopy = {
                    kind: "direct",
                    them: chat.them,
                    chatId: payload.chatId,
                    updatedDate: new Date(),
                    readUpTo: 0,
                    latestKnownMessageId: 0,
                    messagesToDownload: [],
                    messagesDownloading: [],
                    confirmedMessages: [],
                    unconfirmedMessages: chat.unconfirmedMessages
                } as DirectChat
            } else {
                chatCopy = { ...chat };
                chatCopy.messagesToDownload = chatCopy.messagesToDownload.slice();
                chatCopy.confirmedMessages = chatCopy.confirmedMessages.slice();
                chatCopy.unconfirmedMessages = chatCopy.unconfirmedMessages.slice();
            }

            chatsCopy[chatIndex] = chatCopy;

            const confirmedMessage: LocalMessage = {
                kind: "local",
                id: payload.confirmedMessageId,
                date: payload.confirmedMessageDate,
                sender: payload.sender,
                text: payload.message
            };

            const unconfirmedMessageIndex = chatCopy.unconfirmedMessages.findIndex(m =>
                m.kind === "unconfirmed" && m.id === payload.unconfirmedMessageId);

            if (unconfirmedMessageIndex >= 0) {
                chatCopy.unconfirmedMessages.splice(unconfirmedMessageIndex, 1);
            }

            addMessageToChat(chatCopy, confirmedMessage);
            setFunctions.remove(chatCopy.messagesToDownload, confirmedMessage.id);

            const selectedChatIndex = sortChatsAndReturnSelectedIndex(chatsCopy, state.selectedChatIndex!);

            return {
                ...state,
                chats: chatsCopy,
                selectedChatIndex
            };
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const { userId } = event.payload;

            const newChat: NewDirectChat = {
                kind: "newDirect",
                them: userId,
                updatedDate: new Date(),
                unconfirmedMessages: []
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

function addMessageToChat(chat: ConfirmedChat, message: ConfirmedMessage) {
    addMessagesToChat(chat, [message]);
}

function addMessagesToChat(chat: ConfirmedChat, messages: ConfirmedMessage[], latestKnownMessageId?: Option<number>) {
    // Ensure messages are sorted by id (they should be already so this should only do a single iteration)
    messages.sort((a, b) => a.id - b.id);

    const lowestCurrentMessageId = chat.confirmedMessages[0].id;
    const lowestNewMessageId = messages[0].id;

    let indexWhereNoLongerPrepending = 0;
    if (lowestNewMessageId < lowestCurrentMessageId) {
        // If we reach here, then we need to prepend at least 1 message to the current array
        const shiftRequired = lowestCurrentMessageId - lowestNewMessageId;
        const toPrepend: ConfirmedMessage[] = [];
        for (let i = 0; i < messages.length && messages[i].id < lowestCurrentMessageId; i++) {
            const message = messages[i];
            toPrepend[message.id - lowestCurrentMessageId + shiftRequired] = message;
            indexWhereNoLongerPrepending++;
        }

        // Check for gaps in the array of messages, if found, plug them with RemoteMessages and queue them for download
        for (let id = lowestNewMessageId + 1; id < lowestCurrentMessageId; id++) {
            const index = id - lowestNewMessageId;
            if (!messages[index]) {
                chat.confirmedMessages[index] = {
                    kind: "remote",
                    id: id
                } as RemoteMessage;

                setFunctions.add(chat.messagesToDownload, id);
            }
        }

        chat.confirmedMessages.unshift(...toPrepend);
    }

    const lowestMessageId = Math.min(lowestCurrentMessageId, lowestNewMessageId);

    // Now handle the later messages
    for (let index = indexWhereNoLongerPrepending; index < messages.length; index++) {
        const message = messages[index];
        const messageIndex = message.id - lowestMessageId;

        if (messageIndex < chat.confirmedMessages.length) {
            // This is the only case where we overwrite an existing message, so first check if the existing message is
            // 'local'. If it is we would be replacing it with a message that is the same or worse, so we do nothing.
            if (chat.confirmedMessages[messageIndex].kind !== "local") {
                chat.confirmedMessages[messageIndex] = message;
            }
        } else if (messageIndex === chat.confirmedMessages.length) {
            chat.confirmedMessages.push(message);
        } else {
            // If we reach here then some messages are missing so we need to fill the gaps with RemoteMessages and mark
            // them to be downloaded
            const firstMissingMessageId = chat.confirmedMessages[chat.confirmedMessages.length - 1].id + 1;
            const lastMissingMessageId = message.id - 1;
            const indexToInsertAt = chat.confirmedMessages.length;
            addMissingMessages(firstMissingMessageId, lastMissingMessageId, indexToInsertAt);
            chat.confirmedMessages.push(message);
        }

        if (message.kind === "local") {
            if (chat.updatedDate < message.date) {
                chat.updatedDate = message.date;
            }
        }

        if (chat.latestKnownMessageId < message.id) {
            chat.latestKnownMessageId = message.id;
        }
    }

    // If after adding these messages the latestKnownMessageId value we have is still lower than what we got from the
    // server then we need to add some missing messages and mark them to be downloaded.
    if (latestKnownMessageId && chat.latestKnownMessageId < latestKnownMessageId) {
        addMissingMessages(chat.latestKnownMessageId + 1, latestKnownMessageId, chat.latestKnownMessageId + 1);
        chat.latestKnownMessageId = latestKnownMessageId;
    }

    function addMissingMessages(fromId: number, toId: number, index: number) {
        const missingMessages: RemoteMessage[] = [];
        for (let id = fromId; id <= toId; id++) {
            missingMessages.push({ kind: "remote", id });
            setFunctions.add(chat.messagesToDownload, id);
        }

        chat.confirmedMessages.splice(index, 0, ...missingMessages);
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

function sortChatsAndReturnSelectedIndex(chats: Chat[], selectedIndex: number) {
    const selectedChat = chats[selectedIndex];
    chats.sort((a, b) => b.updatedDate.getTime() - a.updatedDate.getTime());
    return chats.indexOf(selectedChat);
}

function findChatIndex(chats: Chat[], chatId: ChatId) : number {
    return chats.findIndex(c => c.kind !== "newDirect" && c.chatId && chatId === c.chatId);
}

function findDirectChatIndex(chats: Chat[], userId: UserId) : number {
    return chats.findIndex(c => c.kind !== "group" && userId === c.them);
}

function findGroupChatIndex(chats: Chat[], chatId: ChatId) : number {
    return chats.findIndex(c => c.kind === "group" && chatId === c.chatId);
}
