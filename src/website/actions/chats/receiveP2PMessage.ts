import { ChatId } from "../../domain/model/chats";
import { P2PMessage } from "../../domain/model/messages";

export const RECEIVE_P2P_MESSAGE = "RECEIVE_P2P_MESSAGE";

export default function(chatId: ChatId, message: P2PMessage) : ReceiveP2PMessageEvent {
    return {
        type: RECEIVE_P2P_MESSAGE,
        payload: {
            chatId,
            message
        }
    };
}

export type ReceiveP2PMessageEvent = {
    type: typeof RECEIVE_P2P_MESSAGE,
    payload: {
        chatId: ChatId,
        message: P2PMessage
    }
}
