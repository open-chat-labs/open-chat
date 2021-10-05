import produce from "immer";

import * as chatFunctions from "../domain/model/chats";
import * as historyFunctions from "../domain/historyFunctions";
import { Chat, UnconfirmedGroupChat } from "../domain/model/chats";
import { Option, Timestamp } from "../domain/model/common";
import * as setFunctions from "../utils/setFunctions";
import { ViewMode } from "../domain/model/viewMode";

import {
    CONFIRMED_DIRECT_CHAT,
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
import { SWITCH_VIEW_MODE_REQUESTED, SwitchViewModeRequestedEvent } from "../actions/app/switchViewMode";

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
    SEND_MESSAGE_FAILED,
    SEND_MESSAGE_REQUESTED,
    SEND_MESSAGE_SUCCEEDED,
    SendMessageFailedEvent,
    SendMessageRequestedEvent,
    SendMessageSucceededEvent
} from "../actions/chats/sendMessage";

import {
    ADD_PARTICIPANTS_SUCCEEDED,
    AddParticipantsSucceededEvent
} from "../actions/chats/addParticipants";

import {
    REMOVE_PARTICIPANT_FAILED,
    REMOVE_PARTICIPANT_REQUESTED,
    RemoveParticipantFailedEvent,
    RemoveParticipantRequestedEvent,
} from "../actions/chats/removeParticipant";

import {
    MARK_ALL_MESSAGES_AS_READ,
    MARK_MESSAGES_AS_READ,
    MARK_MESSAGES_AS_READ_BY_CLIENT_ID,
    MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY,
    MARK_MESSAGES_AS_READ_REMOTELY,
    MarkAllMessagesAsReadEvent,
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

import { 
    USER_BLOCKED,
    USER_UNBLOCKED,
    UserBlockedEvent,
    UserUnblockedEvent
} from "../actions/chats/blockUser";

import { 
    NOTIFICATIONS_MUTED,
    NOTIFICATIONS_UNMUTED,
    NotificationsMutedEvent,
    NotificationsUnmutedEvent
} from "../actions/chats/toggleNotifications";

import { GOTO_HOME, GotoHomeEvent } from "../actions/app/gotoHome";
import { UserId } from "../domain/model/users";

export type ChatsState = {
    chats: Chat[],
    selectedChatIndex: Option<number>,
    chatsSyncedUpTo: Option<Timestamp>,
    runUpdateChatsTask: boolean,
    blockedUsers: UserId[]
}

const initialState: ChatsState = {
    chats: [],
    selectedChatIndex: null,
    chatsSyncedUpTo: null,
    runUpdateChatsTask: false,
    blockedUsers: []
};

type Event =
    AddParticipantsSucceededEvent |
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
    GotoHomeEvent |
    LeaveGroupSucceededEvent |
    MarkAllMessagesAsReadEvent |
    MarkMessagesAsReadEvent |
    MarkMessagesAsReadByClientIdEvent |
    MarkMessagesAsReadRemotelyEvent |
    MarkMessagesAsReadByClientIdRemotelyEvent |
    MarkMessagesAsReadServerSyncSucceededEvent |
    NotificationsMutedEvent |
    NotificationsUnmutedEvent |
    ReceiveP2PMessageEvent |
    RemoveParticipantFailedEvent |
    RemoveParticipantRequestedEvent |
    RemoteUserTypingEvent |
    RemoteUserStoppedTypingEvent |
    ReplyToMessageSelectedEvent |
    ReplyToMessageCancelledEvent |
    SendMessageRequestedEvent |
    SendMessageFailedEvent |
    SendMessageSucceededEvent |
    SendMessageFailedEvent |
    SessionExpiredEvent |
    SwitchViewModeRequestedEvent |
    UserBlockedEvent |
    UserUnblockedEvent |
    UserLoggedOutEvent;

export default produce((state: ChatsState, event: Event) => {
    maintainScrollOfSelectedChat(state);
    switch (event.type) {
        case GOTO_HOME: {
            if (state.selectedChatIndex != null) {
                const prevChat = state.chats[state.selectedChatIndex];
                chatFunctions.saveDraftMessage(prevChat);
                chatFunctions.freeMediaData(prevChat);
            }

            state.selectedChatIndex = null;
            break;
        }

        case GOTO_CHAT: {
            const { chatIndex, messageId, missingMessages, fromHistory } = event.payload;
            const hasChanged = state.selectedChatIndex == chatIndex;

            if (state.selectedChatIndex != null && hasChanged) {
                const prevChat = state.chats[state.selectedChatIndex];
                chatFunctions.saveDraftMessage(prevChat);
                chatFunctions.freeMediaData(prevChat);
            }

            if (!fromHistory) {
                historyFunctions.pushOrReplaceChat(state.chats[chatIndex].chatId, history?.state?.chatId ?? false);
            }

            state.selectedChatIndex = chatIndex;
            
            const chat = state.chats[state.selectedChatIndex!];

            if (chatFunctions.isConfirmedChat(chat)) {
                chat.messageToSelect = messageId;

                if (missingMessages.length > 0) {
                    chatFunctions.addMessages(chat, missingMessages, true);
                }    

                if (hasChanged) {
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
            selectChatAndPushToHistory(state, 0);
            break;
        }

        case CREATE_GROUP_CHAT_SUCCEEDED: {
            const { chat } = event.payload;
            const chatIndex = state.chats.findIndex(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.chatId === chat.chatId);
            state.chats[chatIndex] = chat;
            const newChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            selectChatAndPushToHistory(state, newChatIndex!);
            break;
        }

        case CREATE_GROUP_CHAT_FAILED: {
            const { chatId } = event.payload;
            const chatIndex = state.chats.findIndex(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.chatId === chatId);
            state.chats.splice(chatIndex, 1);
            selectChatAndPushToHistory(state, 0);
            break;
        }

        case DIRECT_CHAT_CREATED: {
            const { chat } = event.payload;
            state.chats.unshift(chat);
            selectChatAndPushToHistory(state, 0);
            break;
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp, selectedChatIndex, blockedUsers } = event.payload;
            const historicalChatId = history?.state?.chatId ?? null;
            
            // If the path exists but it does not match a known chatId 
            // then replace the path with "/"
            if (document.location.pathname.length > 0 && selectedChatIndex == null) {
                historyFunctions.replaceLatestWithHome();       
            }
            
            if (selectedChatIndex != null) {
                if (historicalChatId == null) { 
                    // If there is a selected chat and there is no existing history (or it is already "/") 
                    // then replace the path with "/"
                    historyFunctions.replaceLatestWithHome();       
                }     

                const chatId = chats[selectedChatIndex].chatId;
                if (historicalChatId != chatId) {
                    // If the selected chat is different to the current chat in the history 
                    // then push the chatId as a new path
                    historyFunctions.pushOrReplaceChat(chatId, false);
                }
            }

            return {
                chats,
                selectedChatIndex,
                chatsSyncedUpTo: latestUpdateTimestamp,
                runUpdateChatsTask: true,
                blockedUsers
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
            const newChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            state.selectedChatIndex = newChatIndex;
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
            const newChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            state.selectedChatIndex = newChatIndex;
            break;
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chat = chatFunctions.getConfirmedChat(state.chats, chatId)[0];
            setFunctions.exceptWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_UPDATED_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp, blockedUsers } = event.payload;
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

            const newChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex);
            if (newChatIndex != null && newChatIndex >= 0) {
                selectChatAndPushToHistory(state, newChatIndex!);        
            }
            state.chatsSyncedUpTo = latestUpdateTimestamp;
            state.blockedUsers = blockedUsers;
            break;
        }

        case MARK_MESSAGES_AS_READ: {
            const { chatId, messageIds } = event.payload;
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
            chatFunctions.markMessagesAsReadLocally(chat, messageIds);
            break;
        }
        
        case MARK_ALL_MESSAGES_AS_READ: {
            const { chatId } = event.payload;
            const [chat] = chatFunctions.getConfirmedChat(state.chats, chatId);
            chatFunctions.markMessagesAsReadLocally(chat, chat.unreadMessageIds);
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
                const newChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
                selectChatAndPushToHistory(state, newChatIndex!);
            }
            break;
        }

        case REMOTE_USER_TYPING: {
            const { chatId, userId } = event.payload;
            const [chat] = chatFunctions.tryGetChat(state.chats, chatId);

            // Chat may not exist locally yet
            if (chat) {
                if (chatFunctions.isDirectChat(chat)) {
                    chat.themTyping = !state.blockedUsers.includes(chat.them);
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
            selectChatAndPushToHistory(state, 0);
            break;
        }

        case SEND_MESSAGE_SUCCEEDED: {
            const updatedChat = event.payload.chat;
            // SEND_MESSAGE_SUCCEEDED will never happen on a NewGroupChat since messages need to be sent using either a
            // userId or a chatId and a NewGroupChat has neither.
            let [chat, index] = chatFunctions.getChat(state.chats, updatedChat.chatId) as [Exclude<Chat, UnconfirmedGroupChat>, number];

            state.chats[index] = chatFunctions.mergeUpdates(chat, updatedChat, index === state.selectedChatIndex);
            const newChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            selectChatAndPushToHistory(state, newChatIndex!);
            break;
        }

        case SEND_MESSAGE_FAILED: {
            const { chatId, clientMessageId } = event.payload;
            const [chat, _index] = chatFunctions.getChat(state.chats,chatId);            
            const messageIndex = chat.messages.findIndex(m => m.kind !== "remote" && m.clientMessageId === clientMessageId);
            if (messageIndex >= 0) {
                chat.messages.splice(messageIndex, 1);
            }
            break;
        }

        case ADD_PARTICIPANTS_SUCCEEDED: {
            const { chatId, users } = event.payload;
            const [chat] = chatFunctions.getChat(state.chats, chatId);
            if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Add the participants immediately and remove them if the call fails
                setFunctions.unionWith(chat.participants, users); 
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
                const newChatIndex = state.chats.length
                    ? 0
                    : null;
                if (newChatIndex != null) {
                    selectChatAndPushToHistory(state, newChatIndex);
                } else {
                    history.back();
                }
            }
            break;
        }

        case SWITCH_VIEW_MODE_REQUESTED: {
            const { viewMode } = event.payload;
            if (viewMode === ViewMode.Desktop) {
                if (state.selectedChatIndex == null && state.chats.length > 0) {
                    selectChatAndPushToHistory(state, 0);
                }
            }
            break;
        }

        case USER_BLOCKED: {
            const { userId } = event.payload;
            setFunctions.add(state.blockedUsers, userId);
            break;
        }

        case USER_UNBLOCKED: {
            const { userId } = event.payload;
            setFunctions.remove(state.blockedUsers, userId);
            break;
        }

        case NOTIFICATIONS_MUTED:
        case NOTIFICATIONS_UNMUTED: {
            const { chatId } = event.payload;
            const [chat] = chatFunctions.getChat(state.chats, chatId);
            if (chat.kind === CONFIRMED_GROUP_CHAT || chat.kind === CONFIRMED_DIRECT_CHAT ) {
                chat.muted = event.type === NOTIFICATIONS_MUTED;
            }
            break;
        }
    }
}, initialState);

function maintainScrollOfSelectedChat(state: ChatsState) {
    if (state.selectedChatIndex !== null) {
        chatFunctions.maintainScroll(state.chats[state.selectedChatIndex]);
    }
}

function selectChatAndPushToHistory(state: ChatsState, index: number) {
    const id = state.chats[index]?.chatId;
    if (id) {
        const replace = state.selectedChatIndex != null;
        historyFunctions.pushOrReplaceChat(id, replace);
        state.selectedChatIndex = index;
    }
}
