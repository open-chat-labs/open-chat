import { Dispatch } from "react";
import { Option } from "../../domain/model/common";
import { RootState } from "../../reducers";
import { ChatsState } from "../../reducers/chatsReducer";
import * as chatFunctions from "../../domain/model/chats";
import CurrentUserTypingHandler from "../../domain/CurrentUserTypingHandler";
import MarkAsReadHandler from "../../domain/MarkAsReadHandler";
import { ChatId } from "../../domain/model/chats";

export const GOTO_CHAT = "GOTO_CHAT";

export function gotoChatById(chatId: ChatId, messageId?: number) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {
        const chatsState = getState().chatsState;
        const chatIndex = chatFunctions.findChatIndex(chatsState.chats, chatId);
        return gotoChat(dispatch, chatsState, chatIndex, messageId);
    }
}

export function gotoChatByIndex(chatIndex: number, messageId?: number) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {
        const chatsState = getState().chatsState;
        return gotoChat(dispatch, chatsState, chatIndex, messageId);
    }
}

function gotoChat(dispatch: Dispatch<any>, chatsState: ChatsState, chatIndex: number, messageId?: number) : Option<GotoChatEvent> {

    if (chatIndex === chatsState.selectedChatIndex && !messageId) {
        return null;
    }

    if (chatsState.selectedChatIndex != null) {
        const prevChat = chatsState.chats[chatsState.selectedChatIndex];
        if (chatFunctions.isConfirmedChat(prevChat)) {
            CurrentUserTypingHandler.markTypingStopped(prevChat.chatId);
            MarkAsReadHandler.updateServer();
        }
    }

    const event: GotoChatEvent = {
        type: GOTO_CHAT,
        payload: {
            chatIndex: chatIndex !== chatsState.selectedChatIndex ? chatIndex : null,
            messageId: messageId ?? null,
        }
    };

    dispatch(event);

    return event;
}

export type GotoChatEvent = {
    type: typeof GOTO_CHAT,
    payload: {
        chatIndex: Option<number>,
        messageId: Option<number>
    }
}
