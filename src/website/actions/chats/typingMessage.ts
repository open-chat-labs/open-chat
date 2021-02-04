import { ChatId } from "../../model/chats";
import { UserId } from "../../model/users";

export const TYPING_MESSAGE_STARTED_LOCALLY = "TYPING_MESSAGE_STARTED_LOCALLY";
export const TYPING_MESSAGE_STOPPED_LOCALLY = "TYPING_MESSAGE_STOPPED_LOCALLY";
export const TYPING_MESSAGE_STARTED_REMOTELY = "TYPING_MESSAGE_STARTED_REMOTELY";
export const TYPING_MESSAGE_STOPPED_REMOTELY = "TYPING_MESSAGE_STOPPED_REMOTELY";

export function startedLocally(chatId: ChatId) : TypingMessageStartedLocallyEvent {
    return {
        type: TYPING_MESSAGE_STARTED_LOCALLY,
        payload: chatId
    };
}

export function stoppedLocally(chatId: ChatId) : TypingMessageStoppedLocallyEvent {
    return {
        type: TYPING_MESSAGE_STOPPED_LOCALLY,
        payload: chatId
    };
}

export function startedRemotely(chatId: ChatId, userId: UserId) : TypingMessageStartedRemotelyEvent {
    return {
        type: TYPING_MESSAGE_STARTED_REMOTELY,
        payload: {
            chatId,
            userId
        }
    };
}

export function stoppedRemotely(chatId: ChatId, userId: UserId) : TypingMessageStoppedRemotelyEvent {
    return {
        type: TYPING_MESSAGE_STOPPED_REMOTELY,
        payload: {
            chatId,
            userId
        }
    };
}

export type TypingMessageStartedLocallyEvent = {
    type: typeof TYPING_MESSAGE_STARTED_LOCALLY,
    payload: ChatId
}

export type TypingMessageStoppedLocallyEvent = {
    type: typeof TYPING_MESSAGE_STOPPED_LOCALLY,
    payload: ChatId
}

export type TypingMessageStartedRemotelyEvent = {
    type: typeof TYPING_MESSAGE_STARTED_REMOTELY,
    payload: {
        chatId: ChatId,
        userId: UserId
    }
}

export type TypingMessageStoppedRemotelyEvent = {
    type: typeof TYPING_MESSAGE_STOPPED_REMOTELY,
    payload: {
        chatId: ChatId,
        userId: UserId
    }
}
