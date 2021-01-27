import MarkAsReadHandler from "../../services/MarkAsReadHandler";
import { ChatId } from "../../model/chats";

export const MARK_MESSAGES_AS_READ = "MARK_MESSAGES_AS_READ";

export default function(chatId: ChatId, messageIds: number[]) : MarkMessagesAsReadEvent {
    MarkAsReadHandler.markRead(chatId, messageIds);

    return {
        type: MARK_MESSAGES_AS_READ,
        payload: {
            chatId,
            messageIds
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

