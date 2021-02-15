import { Dispatch } from "react";
import { RootState } from "../../reducers";
import * as chatFunctions from "../../domain/model/chats";
import CurrentUserTypingHandler from "../../domain/CurrentUserTypingHandler";
import MarkAsReadHandler from "../../domain/MarkAsReadHandler";

export const CHAT_SELECTED = "CHAT_SELECTED";

export default function(index: number, messageId?: number) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {
        const chatsState = getState().chatsState;

        if (index === chatsState.selectedChatIndex) {
            return;
        }

        if (chatsState.selectedChatIndex != null) {
            const prevChat = chatsState.chats[chatsState.selectedChatIndex];
            if (chatFunctions.isConfirmedChat(prevChat)) {
                CurrentUserTypingHandler.markTypingStopped(prevChat.chatId);
                MarkAsReadHandler.updateServer();
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
