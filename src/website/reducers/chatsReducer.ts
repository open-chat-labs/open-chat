import produce from "immer";

import * as chatFunctions from "../domain/model/chats";
import { Chat, UnconfirmedGroupChat } from "../domain/model/chats";
import { Option, Timestamp } from "../domain/model/common";
import * as setFunctions from "../utils/setFunctions";
import {
    CONFIRMED_GROUP_CHAT,
    PAGE_SIZE,
    UNCONFIRMED_GROUP_CHAT
} from "../constants";

import { GOTO_CHAT, GotoChatEvent } from "../actions/chats/gotoChat";
import { DIRECT_CHAT_CREATED, DirectChatCreatedEvent } from "../actions/chats/gotoUser";
import { GET_UPDATED_CHATS_SUCCEEDED, GetUpdatedChatsSucceededEvent } from "../actions/chats/getUpdatedChats";
import { RECEIVE_P2P_MESSAGE, ReceiveP2PMessageEvent } from "../actions/chats/receiveP2PMessage";
import { USER_LOGGED_OUT, UserLoggedOutEvent } from "../actions/signin/logout";
import { SESSION_EXPIRED, SessionExpiredEvent } from "../actions/signin/notifySessionExpired";

import {
    CREATE_GROUP_CHAT_REQUESTED,
    CREATE_GROUP_CHAT_SUCCEEDED,
    CREATE_GROUP_CHAT_FAILED,
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
    AddParticipantsRequestedEvent
} from "../actions/chats/addParticipants";

import {
    REMOVE_PARTICIPANT_FAILED,
    REMOVE_PARTICIPANT_REQUESTED,
    RemoveParticipantFailedEvent,
    RemoveParticipantRequestedEvent,
} from "../actions/chats/removeParticipant";

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

import {
    CurrentUserStoppedTypingEvent,
    CurrentUserTypingEvent,
    REMOTE_USER_STOPPED_TYPING,
    REMOTE_USER_TYPING,
    RemoteUserStoppedTypingEvent,
    RemoteUserTypingEvent
} from "../actions/chats/userTyping";

import {
    REPLY_TO_MESSAGE_SELECTED,
    REPLY_TO_MESSAGE_CANCELLED,
    ReplyToMessageSelectedEvent,
    ReplyToMessageCancelledEvent
} from "../actions/chats/replyToMessage";

import {
    LEAVE_GROUP_SUCCEEDED,
    LeaveGroupSucceededEvent
} from "../actions/chats/leaveGroup";

import {
    DESELECT_MESSAGE,
    DeselectMessageEvent
} from "../actions/chats/deselectMessage";

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
    AddParticipantsFailedEvent |
    CreateGroupChatRequestedEvent |
    CreateGroupChatSucceededEvent |
    CreateGroupChatFailedEvent |
    CurrentUserTypingEvent |
    CurrentUserStoppedTypingEvent |
    DeselectMessageEvent |
    DirectChatCreatedEvent |
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
    GotoChatEvent |
    LeaveGroupSucceededEvent |
    MarkMessagesAsReadEvent |
    MarkMessagesAsReadByClientIdEvent |
    MarkMessagesAsReadRemotelyEvent |
    MarkMessagesAsReadByClientIdRemotelyEvent |
    MarkMessagesAsReadServerSyncSucceededEvent |
    ReceiveP2PMessageEvent |
    RemoveParticipantFailedEvent |
    RemoveParticipantRequestedEvent |
    RemoteUserTypingEvent |
    RemoteUserStoppedTypingEvent |
    ReplyToMessageSelectedEvent |
    ReplyToMessageCancelledEvent |
    SendMessageRequestedEvent |
    SendMessageSucceededEvent |
    SendMessageFailedEvent |
    SessionExpiredEvent |
    UserLoggedOutEvent;

export default produce((state: ChatsState, event: Event) => {
    maintainScrollOfSelectedChat(state);
    switch (event.type) {
        case GOTO_CHAT: {
            const { chatIndex, messageId, missingMessages } = event.payload;
            const hasChatChanged = chatIndex != null;
            if (!hasChatChanged && (messageId == null || state.selectedChatIndex == null)) {
                break;
            }

            if (hasChatChanged) {    
                if (state.selectedChatIndex != null) {
                    const prevChat = state.chats[state.selectedChatIndex];
                    chatFunctions.saveDraftMessage(prevChat);
                    chatFunctions.freeMediaData(prevChat);
                }

                state.selectedChatIndex = chatIndex;
            }
            
            const chat = state.chats[state.selectedChatIndex!];

            if (chatFunctions.isConfirmedChat(chat)) {
                chat.messageToSelect = messageId;

                if (missingMessages.length > 0) {
                    chatFunctions.addMessages(chat, missingMessages, true);
                }    

                if (hasChatChanged) {
                    if (chat.maxLocalMessageId) {
                        const minMessageIdOnServer = chatFunctions.getMinMessageIdOnServer(chat);
                        const minLocalMessageId = chatFunctions.getMinMessageId(chat.messages);
                        const minLocalMessageIdRequired = Math.max((chat.maxLocalMessageId ?? 0) + 1 - PAGE_SIZE, minMessageIdOnServer);            
                        if (minLocalMessageId !== minLocalMessageIdRequired) {
                            chatFunctions.extendMessagesRangeDownTo(chat, minLocalMessageIdRequired, true);
                            chatFunctions.queueMissingMessagesForDownload(chat);
                        }
                    }

                    chatFunctions.restoreDraftMessage(chat);
                }
            }
            break;
        }

        case CREATE_GROUP_CHAT_REQUESTED: {
            const { chatId, subject, users } = event.payload;
            const newChat = chatFunctions.newUnconfirmedGroupChat(chatId, subject, users);
            state.chats.unshift(newChat);
            state.selectedChatIndex = 0;
            break;
        }

        case CREATE_GROUP_CHAT_SUCCEEDED: {
            const { chat } = event.payload;
            const chatIndex = state.chats.findIndex(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.chatId === chat.chatId);
            state.chats[chatIndex] = chat;
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case CREATE_GROUP_CHAT_FAILED: {
            const { chatId } = event.payload;
            const chatIndex = state.chats.findIndex(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.chatId === chatId);
            state.chats.splice(chatIndex, 1);
            state.selectedChatIndex = 0;
            break;
        }

        case DIRECT_CHAT_CREATED: {
            const { chat } = event.payload;
            state.chats.unshift(chat);
            state.selectedChatIndex = 0;
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
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
            const messageIds = [];
            for (let i = fromId; i < fromId + count; i++) {
                messageIds.push(i);
            }
            setFunctions.unionWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_SUCCEEDED: {
            const { request, result } = event.payload;
            const [chat, index] = chatFunctions.getConfirmedChat(state.chats, request.chatId);
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
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
            const messageIds = [];
            for (let i = fromId; i < fromId + count; i++) {
                messageIds.push(i);
            }
            setFunctions.exceptWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_BY_ID_REQUESTED: {
            const { chatId, messageIds } = event.payload;
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
            setFunctions.unionWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_BY_ID_SUCCEEDED: {
            const { request, result } = event.payload;
            const [chat, index] = chatFunctions.getConfirmedChat(state.chats, request.chatId);
            setFunctions.exceptWith(chat.messagesDownloading, request.messageIds);
            chatFunctions.addMessages(chat, result.messages, index === state.selectedChatIndex);
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chat = chatFunctions.getConfirmedChat(state.chats, chatId)[0];
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
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
            chatFunctions.markMessagesAsReadLocally(chat, messageIds);
            break;
        }

        case MARK_MESSAGES_AS_READ_BY_CLIENT_ID: {
            const { chatId, clientMessageIds } = event.payload;
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
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
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
            chatFunctions.markMessagesAsReadOnServer(chat, fromId, toId);
            break;
        }

        case RECEIVE_P2P_MESSAGE: {
            const { chatId, message } = event.payload;
            const [chat] = chatFunctions.tryGetChat(state.chats, chatId);

            // Chat may not exist locally yet
            if (chat) {
                chatFunctions.addP2PMessage(chat, message);
                state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            }
            break;
        }

        case REMOTE_USER_TYPING: {
            const { chatId, userId } = event.payload;
            const [chat] = chatFunctions.tryGetChat(state.chats, chatId);

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
            const [chat] = chatFunctions.tryGetChat(state.chats, chatId);

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
            const [chat, index] = chatFunctions.getChat(state.chats, payload.chat.chatId);
            chatFunctions.addUnconfirmedMessage(chat, payload.clientMessageId, payload.content, payload.repliesTo);            
            chat.replyContext = null;            
            state.chats.splice(index, 1);
            state.chats.unshift(chat);
            state.selectedChatIndex = 0;
            break;
        }

        case SEND_MESSAGE_SUCCEEDED: {
            const updatedChat = event.payload.chat;
            // SEND_MESSAGE_SUCCEEDED will never happen on a NewGroupChat since messages need to be sent using either a
            // userId or a chatId and a NewGroupChat has neither.
            let [chat, index] = chatFunctions.getChat(state.chats, event.payload.chat.chatId) as [Exclude<Chat, UnconfirmedGroupChat>, number];

            state.chats[index] = chatFunctions.mergeUpdates(chat, updatedChat, index === state.selectedChatIndex);
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case ADD_PARTICIPANTS_REQUESTED: {
            const { chatId, users } = event.payload;
            const [chat] = chatFunctions.getChat(state.chats, chatId);

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
            const [chat] = chatFunctions.getChat(state.chats, chatId);

            if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Adding the participants failed so remove them from the chat
                setFunctions.exceptWith(chat.participants, users);
            }
            break;
        }

        case REMOVE_PARTICIPANT_REQUESTED: {
            const { chatId, userId } = event.payload;
            const [chat] = chatFunctions.getChat(state.chats, chatId);
            if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Remove the participant immediately but add them back if the call fails
                setFunctions.remove(chat.participants, userId);
            }
            break;
        }

        case REMOVE_PARTICIPANT_FAILED: {
            const { chatId, userId } = event.payload;
            const [chat] = chatFunctions.getChat(state.chats, chatId);
            if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Removing the participant failed so add them back to the chat
                setFunctions.add(chat.participants, userId);
            }
            break;
        }

        case SESSION_EXPIRED:
        case USER_LOGGED_OUT: {
            return initialState;
        }

        case REPLY_TO_MESSAGE_SELECTED: {
            const { replyContext, privateChatId } = event.payload;
            const chatId = privateChatId ?? replyContext.chatId;
            const [chat] = chatFunctions.getChat(state.chats, chatId);
            chat.replyContext = replyContext;
            break;
        }

        case REPLY_TO_MESSAGE_CANCELLED: {
            const { chatId } = event.payload;
            const [ chat ] = chatFunctions.getChat(state.chats, chatId);
            chat.replyContext = null;
            break;
        }

        case DESELECT_MESSAGE: {
            const { chatId } = event.payload;
            const [ chat ] = chatFunctions.getConfirmedChat(state.chats, chatId);
            if (chat) {
                chat.messageToSelect = null;
            }
            break;
        }

        case LEAVE_GROUP_SUCCEEDED: {
            const { chatId } = event.payload;
            const [chat] = chatFunctions.getChat(state.chats, chatId);
            if (chat.kind === CONFIRMED_GROUP_CHAT) {
                chatFunctions.removeChat(state.chats, chatId);
                state.selectedChatIndex = state.chats.length
                    ? 0
                    : null;
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
