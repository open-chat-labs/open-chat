import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { stoppedLocally as typingStopped } from "./typingMessage";
import * as chatFunctions from "../../model/chats";

export const CHAT_SELECTED = "CHAT_SELECTED";

export default function(index: number) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {
        const chatsState = getState().chatsState;

        if (index === chatsState.selectedChatIndex) {
            return;
        }

        if (chatsState.selectedChatIndex != null) {
            const prevChat = chatsState.chats[chatsState.selectedChatIndex];
            if (chatFunctions.isConfirmedChat(prevChat) && prevChat.meTyping) {
                dispatch(typingStopped(prevChat.chatId));
            }
        }

        const event: ChatSelectedEvent = {
            type: CHAT_SELECTED,
            payload: index
        };

        dispatch(event);
    }
}

export type ChatSelectedEvent = {
    type: typeof CHAT_SELECTED,
    payload: number
}
