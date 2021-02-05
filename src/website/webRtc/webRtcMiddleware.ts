import { Middleware } from "redux";
import { RootState } from "../reducers";
import { SEND_MESSAGE_REQUESTED, SendMessageRequestedEvent } from "../actions/chats/sendMessage";
import {
    TYPING_MESSAGE_STARTED_LOCALLY,
    TYPING_MESSAGE_STARTED_REMOTELY,
    TYPING_MESSAGE_STOPPED_LOCALLY,
    TYPING_MESSAGE_STOPPED_REMOTELY,
    TypingMessageStartedLocallyEvent,
    TypingMessageStoppedLocallyEvent
} from "../actions/chats/typingMessage";
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

        case TYPING_MESSAGE_STARTED_LOCALLY: {
            const chatId = (event as TypingMessageStartedLocallyEvent).payload;
            const [chat] = chatFunctions.getChatById(store.getState().chatsState.chats, chatId);
            const p2pMessage = {
                kind: TYPING_MESSAGE_STARTED_REMOTELY,
                chatId: chat.chatId
            };
            sendMessage(p2pMessage, chat);
            break;
        }

        case TYPING_MESSAGE_STOPPED_LOCALLY: {
            const chatId = (event as TypingMessageStoppedLocallyEvent).payload;
            const [chat] = chatFunctions.getChatById(store.getState().chatsState.chats, chatId);
            const p2pMessage = {
                kind: TYPING_MESSAGE_STOPPED_REMOTELY,
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
