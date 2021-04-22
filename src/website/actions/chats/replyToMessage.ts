import { ChatId } from "../../domain/model/chats";

export const REPLY_TO_MESSAGE_SELECTED = "REPLY_TO_MESSAGE_SELECTED";
export const REPLY_TO_MESSAGE_CANCELLED = "REPLY_TO_MESSAGE_CANCELLED";

export function selectReplyToMessage(chatId: ChatId, messageId: number) : ReplyToMessageSelectedEvent {
    return {
        type: REPLY_TO_MESSAGE_SELECTED,
        payload: { chatId, messageId }
    };
}

export function cancelReplyToMessage(chatId: ChatId) : ReplyToMessageCancelledEvent {
    return {
        type: REPLY_TO_MESSAGE_CANCELLED,
        payload: { chatId }
    };
}

export type ReplyToMessageSelectedEvent = {
    type: typeof REPLY_TO_MESSAGE_SELECTED,
    payload: {
        chatId: ChatId,
        messageId: number
    }
}

export type ReplyToMessageCancelledEvent = {
    type: typeof REPLY_TO_MESSAGE_CANCELLED,
    payload: {
        chatId: ChatId
    }
}
