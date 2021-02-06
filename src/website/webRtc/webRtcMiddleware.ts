import { Middleware } from "redux";
import { RootState } from "../reducers";
import { SEND_MESSAGE_REQUESTED, SendMessageRequestedEvent } from "../actions/chats/sendMessage";
import {
    CURRENT_USER_TYPING,
    CURRENT_USER_STOPPED_TYPING,
    CurrentUserTypingEvent,
    CurrentUserStoppedTypingEvent,
    REMOTE_USER_TYPING,
    REMOTE_USER_STOPPED_TYPING
} from "../actions/chats/userTyping";
import * as chatFunctions from "../model/chats";
import RtcConnectionHandler from "./RtcConnectionHandler";
import { Chat } from "../model/chats";

const webRtcMiddleware : Middleware<{}, RootState> = store => next => event => {
    switch (event.type) {
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
            const [chat] = chatFunctions.getChatById(store.getState().chatsState.chats, chatId);
            const p2pMessage = {
                kind: REMOTE_USER_TYPING,
                chatId: chat.chatId
            };
            sendMessage(p2pMessage, chat);
            break;
        }

        case CURRENT_USER_STOPPED_TYPING: {
            const chatId = (event as CurrentUserStoppedTypingEvent).payload;
            const [chat] = chatFunctions.getChatById(store.getState().chatsState.chats, chatId);
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
    RtcConnectionHandler.sendMessage(users, JSON.stringify(message));
}
