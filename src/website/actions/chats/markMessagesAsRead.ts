import { ChatId } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";

export const MARK_MESSAGES_AS_READ = "MARK_MESSAGES_AS_READ";
export const MARK_ALL_MESSAGES_AS_READ = "MARK_ALL_MESSAGES_AS_READ";
export const MARK_MESSAGES_AS_READ_BY_CLIENT_ID = "MARK_MESSAGES_AS_READ_BY_CLIENT_ID";
export const MARK_MESSAGES_AS_READ_REMOTELY = "MARK_MESSAGES_AS_READ_REMOTELY";
export const MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY = "MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY";

export function markAllMessagesAsReadLocally(chatId: ChatId) : MarkAllMessagesAsReadEvent {
    return {
        type: MARK_ALL_MESSAGES_AS_READ,
        payload: {
            chatId
        }
    };
}

export function markMessagesAsReadLocally(chatId: ChatId, messageIds: number[]) : MarkMessagesAsReadEvent {
    return {
        type: MARK_MESSAGES_AS_READ,
        payload: {
            chatId,
            messageIds
        }
    };
}

export function markMessagesAsReadByClientIdLocally(chatId: ChatId, clientMessageIds: string[]) : MarkMessagesAsReadByClientIdEvent {
    return {
        type: MARK_MESSAGES_AS_READ_BY_CLIENT_ID,
        payload: {
            chatId,
            clientMessageIds
        }
    };
}


export function markMessagesAsReadRemotely(userId: UserId, messageIds: number[]) : MarkMessagesAsReadRemotelyEvent {
    return {
        type: MARK_MESSAGES_AS_READ_REMOTELY,
        payload: {
            userId,
            messageIds
        }
    };
}

export function markMessagesAsReadByClientIdRemotely(userId: UserId, clientMessageIds: string[]) : MarkMessagesAsReadByClientIdRemotelyEvent {
    return {
        type: MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY,
        payload: {
            userId,
            clientMessageIds
        }
    };
}

export type MarkMessagesAsReadEvent = {
    type: typeof MARK_MESSAGES_AS_READ,
    payload: {
        chatId: ChatId,
        messageIds: number[]
    }
}

export type MarkAllMessagesAsReadEvent = {
    type: typeof MARK_ALL_MESSAGES_AS_READ,
    payload: {
        chatId: ChatId,
    }
}

export type MarkMessagesAsReadByClientIdEvent = {
    type: typeof MARK_MESSAGES_AS_READ_BY_CLIENT_ID,
    payload: {
        chatId: ChatId,
        clientMessageIds: string[]
    }
}

export type MarkMessagesAsReadRemotelyEvent = {
    type: typeof MARK_MESSAGES_AS_READ_REMOTELY,
    payload: {
        userId: UserId,
        messageIds: number[]
    }
}

export type MarkMessagesAsReadByClientIdRemotelyEvent = {
    type: typeof MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY,
    payload: {
        userId: UserId,
        clientMessageIds: string[]
    }
}
