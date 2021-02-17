import produce from "immer";

import * as chatFunctions from "../domain/model/chats";
import { Chat, ChatFilter, ChatId, UnconfirmedGroupChat } from "../domain/model/chats";
import { Option, Timestamp } from "../domain/model/common";
import * as setFunctions from "../utils/setFunctions";
import {
    CONFIRMED_GROUP_CHAT,
    PAGE_SIZE,
    UNCONFIRMED_GROUP_CHAT
} from "../constants";

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
    GET_MESSAGES_FAILED,
    GET_MESSAGES_REQUESTED,
    GET_MESSAGES_SUCCEEDED,
    GetMessagesFailedEvent,
    GetMessagesRequestedEvent,
    GetMessagesSucceededEvent
} from "../actions/chats/getMessages";

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

import {
    ADD_PARTICIPANTS_FAILED,
    ADD_PARTICIPANTS_REQUESTED,
    AddParticipantsFailedEvent,
    AddParticipantsRequestedEvent,
    AddParticipantsSucceededEvent
} from "../actions/chats/addParticipants";
import {
    MARK_MESSAGES_AS_READ,
    MARK_MESSAGES_AS_READ_BY_CLIENT_ID,
    MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY,
    MARK_MESSAGES_AS_READ_REMOTELY,
    MarkMessagesAsReadByClientIdEvent,
    MarkMessagesAsReadByClientIdRemotelyEvent,
    MarkMessagesAsReadEvent,
    MarkMessagesAsReadRemotelyEvent
} from "../actions/chats/markMessagesAsRead";
import {
    MARK_MESSAGES_AS_READ_SERVER_SYNC_SUCCEEDED,
    MarkMessagesAsReadServerSyncSucceededEvent
} from "../actions/chats/markMessagesAsReadServerSync";
import { RECEIVE_P2P_MESSAGE, ReceiveP2PMessageEvent } from "../actions/chats/receiveP2PMessage";
import {
    CurrentUserStoppedTypingEvent,
    CurrentUserTypingEvent,
    REMOTE_USER_STOPPED_TYPING,
    REMOTE_USER_TYPING,
    RemoteUserStoppedTypingEvent,
    RemoteUserTypingEvent
} from "../actions/chats/userTyping";

export type ChatsState = {
    chats: Chat[],
    selectedChatIndex: Option<number>,
    chatsSyncedUpTo: Option<Timestamp>,
    runUpdateChatsTask: boolean
}

const initialState: ChatsState = {
    chats: [],
    selectedChatIndex: null,
    chatsSyncedUpTo: null,
    runUpdateChatsTask: false
};

type Event =
    AddParticipantsRequestedEvent |
    AddParticipantsSucceededEvent |
    AddParticipantsFailedEvent |
    ChatSelectedEvent |
    CreateGroupChatRequestedEvent |
    CreateGroupChatSucceededEvent |
    CreateGroupChatFailedEvent |
    CurrentUserTypingEvent |
    CurrentUserStoppedTypingEvent |
    GetAllChatsRequestedEvent |
    GetAllChatsSucceededEvent |
    GetAllChatsFailedEvent |
    GetMessagesRequestedEvent |
    GetMessagesSucceededEvent |
    GetMessagesFailedEvent |
    GetMessagesByIdRequestedEvent |
    GetMessagesByIdSucceededEvent |
    GetMessagesByIdFailedEvent |
    GetUpdatedChatsSucceededEvent |
    MarkMessagesAsReadEvent |
    MarkMessagesAsReadByClientIdEvent |
    MarkMessagesAsReadRemotelyEvent |
    MarkMessagesAsReadByClientIdRemotelyEvent |
    MarkMessagesAsReadServerSyncSucceededEvent |
    ReceiveP2PMessageEvent |
    RemoteUserTypingEvent |
    RemoteUserStoppedTypingEvent |
    SendMessageRequestedEvent |
    SendMessageSucceededEvent |
    SendMessageFailedEvent |
    SetupNewDirectChatSucceededEvent;

export default produce((state: ChatsState, event: Event) => {
    maintainScrollOfSelectedChat(state);
    switch (event.type) {
        case CHAT_SELECTED: {
            if (state.selectedChatIndex != null) {
                const prevChat = state.chats[state.selectedChatIndex];
                chatFunctions.saveDraftMessage(prevChat);
            }

            state.selectedChatIndex = event.payload;
            let chat = state.chats[state.selectedChatIndex];
            if (chatFunctions.isConfirmedChat(chat) && chat.latestConfirmedMessageId) {
                const minMessageId = chatFunctions.getMinMessageId(chat);
                const minMessageIdRequired = Math.max((chat.latestConfirmedMessageId ?? 0) + 1 - PAGE_SIZE, minMessageId);
                if (minMessageId !== minMessageIdRequired) {
                    chatFunctions.extendMessagesRangeDownTo(chat, minMessageIdRequired, true);
                    chatFunctions.queueMissingMessagesForDownload(chat);
                }
            }

            chatFunctions.restoreDraftMessage(chat);
            break;
        }

        case CREATE_GROUP_CHAT_REQUESTED: {
            const { tempId, subject, users } = event.payload;
            const newChat = chatFunctions.newUnconfirmedGroupChat(tempId, subject, users);
            state.chats.unshift(newChat);
            state.selectedChatIndex = 0;
            break;
        }

        case CREATE_GROUP_CHAT_SUCCEEDED: {
            const { tempId, chat } = event.payload;
            const chatIndex = state.chats.findIndex(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.id === tempId);

            state.chats[chatIndex] = chat;
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp } = event.payload;
            return {
                chats,
                selectedChatIndex: chats.length ? 0 : null,
                chatsSyncedUpTo: latestUpdateTimestamp,
                runUpdateChatsTask: true
            };
        }

        case GET_MESSAGES_REQUESTED: {
            const { chatId, fromId, count } = event.payload;
            const [chat] = chatFunctions.getChatById(state.chats, chatId);
            const messageIds = [];
            for (let i = fromId; i < fromId + count; i++) {
                messageIds.push(i);
            }
            setFunctions.unionWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_SUCCEEDED: {
            const { request, result } = event.payload;
            const [chat, index] = chatFunctions.getChatById(state.chats, request.chatId);
            const messageIds = [];
            for (let i = request.fromId; i < request.fromId + request.count; i++) {
                messageIds.push(i);
            }
            setFunctions.exceptWith(chat.messagesDownloading, messageIds);
            chatFunctions.addMessages(chat, result.messages, index === state.selectedChatIndex);
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case GET_MESSAGES_FAILED: {
            const { chatId, fromId, count } = event.payload;
            const [chat] = chatFunctions.getChatById(state.chats, chatId);
            const messageIds = [];
            for (let i = fromId; i < fromId + count; i++) {
                messageIds.push(i);
            }
            setFunctions.exceptWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_BY_ID_REQUESTED: {
            const { chatId, messageIds } = event.payload;
            const [chat] = chatFunctions.getChatById(state.chats, chatId);
            setFunctions.unionWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_BY_ID_SUCCEEDED: {
            const { request, result } = event.payload;
            const [chat, index] = chatFunctions.getChatById(state.chats, request.chatId);
            setFunctions.exceptWith(chat.messagesDownloading, request.messageIds);
            chatFunctions.addMessages(chat, result.messages, index === state.selectedChatIndex);
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chat = chatFunctions.getChatById(state.chats, chatId)[0];
            setFunctions.exceptWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_UPDATED_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp } = event.payload;
            if (!chats.length) {
                return;
            }

            const unconfirmedGroupChat = state.chats.find(c => c.kind === UNCONFIRMED_GROUP_CHAT) as UnconfirmedGroupChat;

            for (const updatedChat of chats) {
                const filter = {
                    chatId: updatedChat.chatId,
                    userId: chatFunctions.isDirectChat(updatedChat) ? updatedChat.them : undefined
                };
                let [currentChat, index] = chatFunctions.tryFindChat(state.chats, filter);

                if (currentChat) {
                    const isSelectedChat = index === state.selectedChatIndex;
                    state.chats[index] = chatFunctions.mergeUpdates(currentChat as Exclude<Chat, UnconfirmedGroupChat>, updatedChat, isSelectedChat);
                } else if (!(unconfirmedGroupChat && chatFunctions.isGroupChat(updatedChat) && unconfirmedGroupChat.subject === updatedChat.subject)) {
                    state.chats.push(updatedChat);
                }
            }

            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex);
            state.chatsSyncedUpTo = latestUpdateTimestamp;
            break;
        }

        case MARK_MESSAGES_AS_READ: {
            const { chatId, messageIds } = event.payload;
            const [chat] = chatFunctions.getChatById(state.chats, chatId);
            chatFunctions.markMessagesAsReadLocally(chat, messageIds);
            break;
        }

        case MARK_MESSAGES_AS_READ_BY_CLIENT_ID: {
            const { chatId, clientMessageIds } = event.payload;
            const [chat] = chatFunctions.getChatById(state.chats, chatId);
            chatFunctions.markMessagesAsReadByClientIdLocally(chat, clientMessageIds);
            break;
        }

        case MARK_MESSAGES_AS_READ_REMOTELY: {
            const { userId, messageIds } = event.payload;
            const [chat] = chatFunctions.getChatByUserId(state.chats, userId);
            if (chatFunctions.isConfirmedChat(chat)) {
                chatFunctions.markMessagesAsReadRemotely(chat, messageIds);
            }
            break;
        }

        case MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY: {
            const { userId, clientMessageIds } = event.payload;
            const [chat] = chatFunctions.getChatByUserId(state.chats, userId);
            if (chatFunctions.isConfirmedChat(chat)) {
                chatFunctions.markMessagesAsReadByClientIdRemotely(chat, clientMessageIds);
            }
            break;
        }

        case MARK_MESSAGES_AS_READ_SERVER_SYNC_SUCCEEDED: {
            const { chatId, fromId, toId } = event.payload.request;
            const [chat] = chatFunctions.getChatById(state.chats, chatId);
            chatFunctions.markMessagesAsReadOnServer(chat, fromId, toId);
            break;
        }

        case RECEIVE_P2P_MESSAGE: {
            const { chatId, message } = event.payload;
            const [chat] = chatFunctions.tryGetChatById(state.chats, chatId);

            // Chat may not exist locally yet
            if (chat) {
                chatFunctions.addP2PMessage(chat, message);
                state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            }
            break;
        }

        case REMOTE_USER_TYPING: {
            const { chatId, userId } = event.payload;
            const [chat] = chatFunctions.tryGetChatById(state.chats, chatId);

            // Chat may not exist locally yet
            if (chat) {
                if (chatFunctions.isDirectChat(chat)) {
                    chat.themTyping = true;
                } else {
                    setFunctions.add(chat.participantsTyping, userId);
                }
            }
            break;
        }

        case REMOTE_USER_STOPPED_TYPING: {
            const { chatId, userId } = event.payload;
            const [chat] = chatFunctions.tryGetChatById(state.chats, chatId);

            // Chat may not exist locally yet
            if (chat) {
                if (chatFunctions.isDirectChat(chat)) {
                    chat.themTyping = false;
                } else {
                    setFunctions.remove(chat.participantsTyping, userId);
                }
            }
            break;
        }

        case SEND_MESSAGE_REQUESTED: {
            const payload = event.payload;
            const [chat, index] = chatFunctions.getChat(state.chats, payload.chat);
            chatFunctions.addUnconfirmedMessage(chat, payload.clientMessageId, payload.content, payload.repliesTo);

            state.chats.splice(index, 1);
            state.chats.unshift(chat);
            state.selectedChatIndex = 0;
            break;
        }

        case SEND_MESSAGE_SUCCEEDED: {
            const updatedChat = event.payload;
            const filter = {
                chatId: updatedChat.chatId,
                userId: chatFunctions.isDirectChat(updatedChat) ? updatedChat.them : undefined
            } as ChatFilter;

            // SEND_MESSAGE_SUCCEEDED will never happen on a NewGroupChat since messages need to be sent using either a
            // userId or a chatId and a NewGroupChat has neither.
            let [chat, index] = chatFunctions.findChat(state.chats, filter) as [Exclude<Chat, UnconfirmedGroupChat>, number];

            state.chats[index] = chatFunctions.mergeUpdates(chat, updatedChat, index === state.selectedChatIndex);
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const { userId } = event.payload;
            const newChat = chatFunctions.newUnconfirmedDirectChat(userId);
            state.chats.unshift(newChat);
            state.selectedChatIndex = 0;
            break;
        }

        case ADD_PARTICIPANTS_REQUESTED: {
            const { chatId, users } = event.payload;
            const filter = {
                chatId: chatId as ChatId,
                unconfirmedChatId: chatId as Symbol                
            };
            const [chat] = chatFunctions.findChat(state.chats, filter);

            if (chat.kind === UNCONFIRMED_GROUP_CHAT) {
                // We can't add the participants until the chat is confirmed
                // so store them for later
                setFunctions.unionWith(chat.pendingParticipants, users);           
            } else if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Add the participants immediately and remove them if the call fails
                setFunctions.unionWith(chat.participants, users); 
            }
            break;
        }

        case ADD_PARTICIPANTS_FAILED: {
            const { chatId, users } = event.payload;
            const [chat] = chatFunctions.getChatById(state.chats, chatId);

            if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Adding the participants failed so remove them from the chat
                setFunctions.exceptWith(chat.participants, users);
            }
            break;
        }
    }
}, initialState);

const maintainScrollOfSelectedChat = (state: ChatsState) => {
    if (state.selectedChatIndex !== null) {
        chatFunctions.maintainScroll(state.chats[state.selectedChatIndex]);
    }
}
