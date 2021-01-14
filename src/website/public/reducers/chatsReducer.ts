import produce from "immer";

import {
    Chat,
    ChatId,
    ConfirmedChat,
    DirectChat,
    GroupChat,
    NewDirectChat,
    NewGroupChat
} from "../model/chats";
import { Option, Timestamp } from "../model/common";
import { LocalMessage } from "../model/messages";
import { UserId } from "../model/users";
import * as setFunctions from "../utils/setFunctions";
import { PAGE_SIZE } from "../constants";

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

export type ChatsState = {
    chats: Chat[],
    selectedChatIndex: Option<number>,
    chatsSyncedUpTo: Option<Timestamp>
}

const initialState: ChatsState = {
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

export default produce((state: ChatsState, event: Event) => {
    switch (event.type) {
        case CHAT_SELECTED: {
            state.selectedChatIndex = event.payload;
            let chat = state.chats[state.selectedChatIndex];
            if ("chatId" in chat) {
                chat = getChatForModification(state.chats, { index: state.selectedChatIndex })[0] as ConfirmedChat;
                chat.extendMessagesRangeDownTo((chat.latestConfirmedMessageId ?? 0) - PAGE_SIZE);
                chat.queueMissingMessagesForDownload();
            }
            break;
        }

        case CREATE_GROUP_CHAT_REQUESTED: {
            const { tempId, subject, users } = event.payload;
            const newChat: NewGroupChat = new NewGroupChat(
                tempId,
                subject,
                users);

            state.chats.unshift(newChat);
            state.selectedChatIndex = 0;
            break;
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

            state.chats[chatIndex] = newChat;
            state.selectedChatIndex = sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp } = event.payload;
            return {
                chats,
                selectedChatIndex: chats.length ? 0 : null,
                chatsSyncedUpTo: latestUpdateTimestamp
            };
        }

        case GET_MESSAGES_BY_ID_REQUESTED: {
            const { chatId, messageIds } = event.payload;
            const chat = getChatByIdForModification(state.chats, chatId);

            setFunctions.unionWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_MESSAGES_BY_ID_SUCCEEDED: {
            const { request, result } = event.payload;
            const chat = getChatByIdForModification(state.chats, request.chatId);

            setFunctions.exceptWith(chat.messagesDownloading, request.messageIds);
            chat.addMessages(result.messages);

            state.selectedChatIndex = sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case GET_MESSAGES_BY_ID_FAILED: {
            const { chatId, messageIds } = event.payload;
            const chat = getChatByIdForModification(state.chats, chatId);

            setFunctions.exceptWith(chat.messagesDownloading, messageIds);
            break;
        }

        case GET_UPDATED_CHATS_SUCCEEDED: {
            const { chats, latestUpdateTimestamp } = event.payload;
            if (!chats.length) {
                return;
            }

            for (const updatedChat of chats) {
                const currentChat = tryGetChatForModification(state.chats, { chatId: updatedChat.chatId })[0] as Option<ConfirmedChat>;

                if (currentChat) {
                    // These messages have just come from the server so are all of type LocalMessage
                    const messages = updatedChat.messages as LocalMessage[];
                    currentChat.addMessages(messages);
                } else {
                    state.chats.push(updatedChat);
                }
            }

            state.selectedChatIndex = sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex);
            state.chatsSyncedUpTo = latestUpdateTimestamp;
            break;
        }

        case SEND_MESSAGE_REQUESTED: {
            const payload = event.payload;

            const [chat, index] = getChatForModification(state.chats, {
                chatId: ("chatId" in payload && payload.chatId) ? payload.chatId : undefined,
                userId: "userId" in payload ? payload.userId : undefined
            });
            chat.addUnconfirmedMessage(payload.message);

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
            let [chat, index] = getChatForModification(state.chats, filter) as [Exclude<Chat, NewGroupChat>, number];
            if (chat instanceof NewDirectChat) {
                chat = new DirectChat(
                    payload.chatId,
                    chat.them,
                    payload.message.date,
                    0,
                    chat.messages);
                state.chats[index] = chat;
            }

            chat.addMessage(payload.message);

            state.selectedChatIndex = sortChatsAndReturnSelectedIndex(state.chats, state.selectedChatIndex!);
            break;
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const { userId } = event.payload;
            const newChat: NewDirectChat = new NewDirectChat(userId);

            state.chats.unshift(newChat);
            state.selectedChatIndex = 0;
            break;
        }
    }
}, initialState);

function getChatForModification(chats: Chat[], filter: ChatFilter) : [Chat, number] {
    return tryGetChatForModification(chats, filter) as [Chat, number];
}

function getChatByIdForModification(chats: Chat[], chatId: ChatId) : ConfirmedChat {
    return tryGetChatForModification(chats, { chatId })[0] as ConfirmedChat;
}

// If the chat is found, this will clone it then update the chats array to contain the new entry in place of the old one
function tryGetChatForModification(chats: Chat[], filter: ChatFilter) : [Option<Chat>, number] {
    let index: number = -1;
    if (filter.index != null) {
        index = filter.index;
    }
    if (index === -1 && filter.chatId) {
        index = findChatIndex(chats, filter.chatId);
    }
    if (index === -1 && filter.userId) {
        index = findDirectChatIndex(chats, filter.userId);
    }
    if (index === -1) {
        return [null, -1];
    }
    const chat = chats[index].clone();
    chats[index] = chat;
    return [chat, index];
}

type ChatFilter = {
    index?: number,
    chatId?: ChatId,
    userId?: UserId
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
            return 1;
        }

        // If only 'b' is confirmed, then 'a' should appear first
        if ("updatedDate" in b) {
            return -1;
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
