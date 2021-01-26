import markAsReadHandler from "../../services/markAsReadHandler";
import { ChatId } from "../../model/chats";

export const MARK_MESSAGE_AS_READ = "MARK_MESSAGE_AS_READ";

export default function(chatId: ChatId, messageId: number) : MarkMessageAsReadEvent {
    markAsReadHandler.markRead(chatId, messageId);

    return {
        type: MARK_MESSAGE_AS_READ,
        payload: {
            chatId,
            messageId
        }
    };
}

export type MarkMessageAsReadEvent = {
    type: typeof MARK_MESSAGE_AS_READ,
    payload: {
        chatId: ChatId,
        messageId: number
    }
}

