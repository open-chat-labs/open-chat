import { Middleware } from "redux";
import { RootState } from "../../reducers";
import { SEND_MESSAGE_REQUESTED, SendMessageRequestedEvent } from "../../actions/chats/sendMessage";
import {
    CURRENT_USER_TYPING,
    CURRENT_USER_STOPPED_TYPING,
    CurrentUserTypingEvent,
    CurrentUserStoppedTypingEvent,
    REMOTE_USER_TYPING,
    REMOTE_USER_STOPPED_TYPING
} from "../../actions/chats/userTyping";
import * as chatFunctions from "../model/chats";
import RtcConnectionsHandler from "./RtcConnectionsHandler";
import { Chat } from "../model/chats";
import {
    MARK_MESSAGES_AS_READ_BY_CLIENT_ID,
    MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY,
    MARK_MESSAGES_AS_READ,
    MARK_MESSAGES_AS_READ_REMOTELY,
    MarkMessagesAsReadByClientIdEvent,
    MarkMessagesAsReadEvent
} from "../../actions/chats/markMessagesAsRead";

const webRtcMiddleware : Middleware<{}, RootState> = store => next => event => {
    switch (event.type) {
        case MARK_MESSAGES_AS_READ: {
            const { chatId, messageIds } = (event as MarkMessagesAsReadEvent).payload;
            const [chat] = chatFunctions.getChat(store.getState().chatsState.chats, chatId);
            if (chatFunctions.isDirectChat(chat)) {
                const p2pMessage = {
                    kind: MARK_MESSAGES_AS_READ_REMOTELY,
                    messageIds
                };
                sendMessage(p2pMessage, chat);
            }
            break;
        }

        case MARK_MESSAGES_AS_READ_BY_CLIENT_ID: {
            const { chatId, clientMessageIds } = (event as MarkMessagesAsReadByClientIdEvent).payload;
            const [chat] = chatFunctions.getChat(store.getState().chatsState.chats, chatId);
            if (chatFunctions.isDirectChat(chat)) {
                const p2pMessage = {
                    kind: MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY,
                    clientMessageIds
                };
                sendMessage(p2pMessage, chat);
            }
            break;
        }

        case SEND_MESSAGE_REQUESTED: {
            const { chat, clientMessageId, content } = (event as SendMessageRequestedEvent).payload;
            if (content.kind === "text" && chatFunctions.isConfirmedChat(chat)) {
                const p2pMessage = {
                    kind: SEND_MESSAGE_REQUESTED,
                    chatId: chat.chatId,
                    clientMessageId,
                    content
                };
                sendMessage(p2pMessage, chat);
            }
            break;
        }

        case CURRENT_USER_TYPING: {
            const chatId = (event as CurrentUserTypingEvent).payload;
            const [chat] = chatFunctions.getChat(store.getState().chatsState.chats, chatId);

            if (chatFunctions.isDirectChat(chat)) {
                const blockedUsers = store.getState().chatsState.blockedUsers;
                if (blockedUsers.includes(chat.them)) {
                    break;
                }
            }

            const p2pMessage = {
                kind: REMOTE_USER_TYPING,
                chatId: chat.chatId
            };
            sendMessage(p2pMessage, chat);
            break;
        }

        case CURRENT_USER_STOPPED_TYPING: {
            const chatId = (event as CurrentUserStoppedTypingEvent).payload;
            const [chat] = chatFunctions.getChat(store.getState().chatsState.chats, chatId);
            const p2pMessage = {
                kind: REMOTE_USER_STOPPED_TYPING,
                chatId: chat.chatId
            };
            sendMessage(p2pMessage, chat);
            break;
        }
    }

    return next(event);
}

export default webRtcMiddleware;

function sendMessage(message: {}, chat: Chat) {
    const users = chatFunctions.getUsers(chat);
    RtcConnectionsHandler.sendMessage(users, JSON.stringify(message));
}
