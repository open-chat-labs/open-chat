import produce from "immer";

import * as chatFunctions from "../model/chats";
import {
    Chat,
    ChatId,
    ConfirmedChat,
    UnconfirmedDirectChat,
    UnconfirmedGroupChat,
    ChatFilter
} from "../model/chats";
import { Option, Timestamp } from "../model/common";
import { LocalMessage } from "../model/messages";
import * as setFunctions from "../utils/setFunctions";
import { CONFIRMED_GROUP_CHAT, MIN_MESSAGE_ID, PAGE_SIZE, UNCONFIRMED_DIRECT_CHAT, UNCONFIRMED_GROUP_CHAT } from "../constants";

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

import {
    ADD_PARTICIPANTS_REQUESTED,
    ADD_PARTICIPANTS_FAILED,
    AddParticipantsRequestedEvent,
    AddParticipantsSucceededEvent,
    AddParticipantsFailedEvent
} from "../actions/chats/addParticipants";

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
    SetupNewDirectChatSucceededEvent |
    AddParticipantsRequestedEvent |
    AddParticipantsSucceededEvent |
    AddParticipantsFailedEvent;

export default produce((state: ChatsState, event: Event) => {
    switch (event.type) {
        case CHAT_SELECTED: {
            state.selectedChatIndex = event.payload;
            let chat = state.chats[state.selectedChatIndex];
            if ("chatId" in chat && chat.latestConfirmedMessageId) {
                chat = chatFunctions.getChat(state.chats, { index: state.selectedChatIndex })[0] as ConfirmedChat;
                const minMessageIdRequired = Math.max((chat.latestConfirmedMessageId ?? 0) - PAGE_SIZE, MIN_MESSAGE_ID);
                chatFunctions.extendMessagesRangeDownTo(chat, minMessageIdRequired);
                chatFunctions.queueMissingMessagesForDownload(chat);
            }
            break;
        }

        case CREATE_GROUP_CHAT_REQUESTED: {
            const { tempId, subject, users } = event.payload;
            const newChat: UnconfirmedGroupChat = {
                kind: UNCONFIRMED_GROUP_CHAT,
                id: tempId,
                subject,
                initialParticipants: users,
                pendingParticipants: [],
                messages: []
            };

            state.chats.unshift(newChat);
            state.selectedChatIndex = 0;
            break;
        }

        case CREATE_GROUP_CHAT_SUCCEEDED: {
            const { tempId, chatId, date } = event.payload;
            const chatIndex = state.chats.findIndex(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.id === tempId);
            const chat = state.chats[chatIndex] as UnconfirmedGroupChat;
            const newChat = chatFunctions.newConfirmedGroupChat(
                chatId,
                chat.subject,
                chat.initialParticipants,
                date);

            state.chats[chatIndex] = newChat;
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

        case GET_MESSAGES_BY_ID_REQUESTED: {
            const { chatId, messageIds } = event.payload;
            const chat = chatFunctions.getChatById(state.chats, chatId);
            setFunctions.unionWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_BY_ID_SUCCEEDED: {
            const { request, result } = event.payload;
            const chat = chatFunctions.getChatById(state.chats, request.chatId);
            setFunctions.exceptWith(chat.messagesDownloading, request.messageIds);
            chatFunctions.addMessages(chat, result.messages);
            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chat = chatFunctions.getChatById(state.chats, chatId);
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
                const currentChat = chatFunctions.tryGetChat(state.chats, { chatId: updatedChat.chatId })[0] as Option<ConfirmedChat>;

                if (currentChat) {
                    // These messages have just come from the server so are all of type LocalMessage
                    const messages = updatedChat.messages as LocalMessage[];
                    chatFunctions.addMessages(currentChat, messages);
                } else if (!(unconfirmedGroupChat && chatFunctions.isGroupChat(updatedChat) && unconfirmedGroupChat.subject === updatedChat.subject)) {
                    state.chats.push(updatedChat);
                }
            }

            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex);
            state.chatsSyncedUpTo = latestUpdateTimestamp;
            break;
        }

        case SEND_MESSAGE_REQUESTED: {
            const payload = event.payload;

            const [chat, index] = chatFunctions.getChat(state.chats, {
                chatId: ("chatId" in payload && payload.chatId) ? payload.chatId : undefined,
                userId: "userId" in payload ? payload.userId : undefined,
                unconfirmedChatId: payload.kind === "newGroup" ? payload.unconfirmedChatId : undefined
            });
            chatFunctions.addUnconfirmedMessage(chat, payload.message);

            state.chats.splice(index, 1);
            state.chats.unshift(chat);
            state.selectedChatIndex = 0;
            break;
        }

        case SEND_MESSAGE_SUCCEEDED: {
            const payload = event.payload;
            const filter = {
                chatId: payload.chatId,
                userId: "userId" in payload ? payload.userId : undefined
            } as ChatFilter;

            // SEND_MESSAGE_SUCCEEDED will never happen on a NewGroupChat since messages need to be sent using either a
            // userId or a chatId and a NewGroupChat has neither.
            let [chat, index] = chatFunctions.getChat(state.chats, filter) as [Exclude<Chat, UnconfirmedGroupChat>, number];
            if (chat.kind === UNCONFIRMED_DIRECT_CHAT) {
                chat = chatFunctions.newConfirmedDirectChat(
                    payload.chatId,
                    chat.them,
                    payload.message.date,
                    0,
                    chat.messages);
                state.chats[index] = chat;
            }

            chatFunctions.addMessage(chat, payload.message);

            state.selectedChatIndex = chatFunctions.sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const { userId } = event.payload;
            const newChat: UnconfirmedDirectChat = {
                kind: UNCONFIRMED_DIRECT_CHAT,
                them: userId,
                messages: []
            };

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
            const [chat, _] = chatFunctions.getChat(state.chats, filter);

            if (chat.kind === UNCONFIRMED_GROUP_CHAT) {
                // We can't add the particpants until the chat is confirmed 
                // so store them for later
                setFunctions.unionWith(chat.pendingParticipants, users);           
            } else if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Add the particpants immediately and remove them if the call fails
                setFunctions.unionWith(chat.participants, users); 
            }
            break;
        }

        case ADD_PARTICIPANTS_FAILED: {
            const { chatId, users } = event.payload;
            const [chat, _] = chatFunctions.getChat(state.chats, { chatId });

            if (chat.kind === CONFIRMED_GROUP_CHAT) {
                // Adding the participants failed so remove them from the chat
                setFunctions.exceptWith(chat.participants, users);
            }
        }
    }
}, initialState);

