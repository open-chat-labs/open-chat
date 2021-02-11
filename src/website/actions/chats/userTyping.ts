import { ChatId } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";

export const CURRENT_USER_TYPING = "CURRENT_USER_TYPING";
export const CURRENT_USER_STOPPED_TYPING = "CURRENT_USER_STOPPED_TYPING";
export const REMOTE_USER_TYPING = "REMOTE_USER_TYPING";
export const REMOTE_USER_STOPPED_TYPING = "REMOTE_USER_STOPPED_TYPING";

export function currentUserTyping(chatId: ChatId) : CurrentUserTypingEvent {
    return {
        type: CURRENT_USER_TYPING,
        payload: chatId
    };
}

export function currentUserStoppedTyping(chatId: ChatId) : CurrentUserStoppedTypingEvent {
    return {
        type: CURRENT_USER_STOPPED_TYPING,
        payload: chatId
    };
}

export function remoteUserTyping(chatId: ChatId, userId: UserId) : RemoteUserTypingEvent {
    return {
        type: REMOTE_USER_TYPING,
        payload: {
            chatId,
            userId
        }
    };
}

export function remoteUserStoppedTyping(chatId: ChatId, userId: UserId) : RemoteUserStoppedTypingEvent {
    return {
        type: REMOTE_USER_STOPPED_TYPING,
        payload: {
            chatId,
            userId
        }
    };
}

export type CurrentUserTypingEvent = {
    type: typeof CURRENT_USER_TYPING,
    payload: ChatId
}

export type CurrentUserStoppedTypingEvent = {
    type: typeof CURRENT_USER_STOPPED_TYPING,
    payload: ChatId
}

export type RemoteUserTypingEvent = {
    type: typeof REMOTE_USER_TYPING,
    payload: {
        chatId: ChatId,
        userId: UserId
    }
}

export type RemoteUserStoppedTypingEvent = {
    type: typeof REMOTE_USER_STOPPED_TYPING,
    payload: {
        chatId: ChatId,
        userId: UserId
    }
}
