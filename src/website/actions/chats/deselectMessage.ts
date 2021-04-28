import { ChatId } from "../../domain/model/chats";

export const DESELECT_MESSAGE = "DESELECT_MESSAGE";

export default function(chatId: ChatId) : DeselectMessageEvent {
    return {
        type: DESELECT_MESSAGE,
        payload: {
            chatId
        }
    };
}

export type DeselectMessageEvent = {
    type: typeof DESELECT_MESSAGE,
    payload: {
        chatId: ChatId,
    }
}