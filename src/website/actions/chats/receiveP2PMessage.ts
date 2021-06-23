import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { ChatId } from "../../domain/model/chats";
import { P2PMessage } from "../../domain/model/messages";

export const RECEIVE_P2P_MESSAGE = "RECEIVE_P2P_MESSAGE";

export default function(chatId: ChatId, message: P2PMessage) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {

        // If the sender is blocked then ignore this message
        const blockedUsers = getState().chatsState.blockedUsers;
        if (blockedUsers.includes(message.sender)) {    
            return null;
        }

        const event: ReceiveP2PMessageEvent = {
            type: RECEIVE_P2P_MESSAGE,
            payload: {
                chatId,
                message
            }
        };
        dispatch(event);
        return event;
    };
}

export type ReceiveP2PMessageEvent = {
    type: typeof RECEIVE_P2P_MESSAGE,
    payload: {
        chatId: ChatId,
        message: P2PMessage
    }
}
