import { ChatId } from "../../model/chats";

export const MARK_MESSAGES_AS_READ = "MARK_MESSAGES_AS_READ";
export const MARK_MESSAGES_AS_READ_BY_CLIENT_ID = "MARK_MESSAGES_AS_READ_BY_CLIENT_ID";

export function markMessagesAsRead(chatId: ChatId, messageIds: number[]) : MarkMessagesAsReadEvent {
    return {
        type: MARK_MESSAGES_AS_READ,
        payload: {
            chatId,
            messageIds
        }
    };
}

export function markMessagesAsReadByClientId(chatId: ChatId, clientMessageIds: string[]) : MarkMessagesAsReadByClientIdEvent {
    return {
        type: MARK_MESSAGES_AS_READ_BY_CLIENT_ID,
        payload: {
            chatId,
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

export type MarkMessagesAsReadByClientIdEvent = {
    type: typeof MARK_MESSAGES_AS_READ_BY_CLIENT_ID,
    payload: {
        chatId: ChatId,
        clientMessageIds: string[]
    }
}
