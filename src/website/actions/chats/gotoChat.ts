import { Dispatch } from "react";
import { Option } from "../../domain/model/common";
import { LocalMessage } from "../../domain/model/messages";
import { RootState } from "../../reducers";
import { ChatsState } from "../../reducers/chatsReducer";
import chatsService from "../../services/chats/service";
import * as chatFunctions from "../../domain/model/chats";
import CurrentUserTypingHandler from "../../domain/CurrentUserTypingHandler";
import MarkAsReadHandler from "../../domain/MarkAsReadHandler";
import { ChatId, ConfirmedChat } from "../../domain/model/chats";

export const GOTO_CHAT = "GOTO_CHAT";

export function gotoChatById(chatId: ChatId, messageId?: number, fromHistory?: boolean) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const chatsState = getState().chatsState;
        let chatIndex = chatFunctions.findChatIndex(chatsState.chats, chatId);
        if (chatIndex == -1) {
            chatIndex = 0;
        }
        return gotoChat(dispatch, chatsState, chatIndex, messageId, fromHistory);
    }
}

export function gotoChatByIndex(chatIndex: number, messageId?: number) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const chatsState = getState().chatsState;
        return gotoChat(dispatch, chatsState, chatIndex, messageId, false);
    }
}

async function gotoChat(dispatch: Dispatch<any>, chatsState: ChatsState, chatIndex: number, messageId?: number, fromHistory?: boolean) : Promise<Option<GotoChatEvent>> {

    if (chatIndex === chatsState.selectedChatIndex && !messageId) {
        return null;
    }

    if (chatsState.selectedChatIndex != null && chatIndex !== chatsState.selectedChatIndex) {
        const prevChat = chatsState.chats[chatsState.selectedChatIndex];
        if (chatFunctions.isConfirmedChat(prevChat)) {
            CurrentUserTypingHandler.markTypingStopped(prevChat.chatId);
            MarkAsReadHandler.updateServer();
        }
    }

    // Load missing messages if necessary
    let missingMessages: LocalMessage[] = [];
    if (messageId) {
        let foundMessage = false;
        const chat = chatsState.chats[chatIndex] as ConfirmedChat;
        if (chat) {
            missingMessages = await loadMissingMessages(chat, messageId);
            foundMessage = missingMessages.find(m => m.id === messageId) != undefined;
        }
        if (!foundMessage) {
            return null;
        }            
    }

    const event: GotoChatEvent = {
        type: GOTO_CHAT,
        payload: {
            chatIndex,
            messageId: messageId ?? null,
            missingMessages,
            fromHistory: fromHistory ?? false
        }
    };

    dispatch(event);

    return event;
}

async function loadMissingMessages(chat: ConfirmedChat, messageId: number) : Promise<LocalMessage[]> {
    const excessMessages = 20;
    const from = Math.max(1, messageId - excessMessages);
    const to = chat.minLocalMessageId ?? (messageId + excessMessages);

    let pageSize = to - from;
    if (pageSize > 0) {
        // Load missing messages
        const result = await chatsService.getMessages(chat.chatId, from, pageSize);
        if (result.kind !== "success") {
            console.log(result);
        } else {
            return result.result.messages;
        }
    }

    return [];
}

export type GotoChatEvent = {
    type: typeof GOTO_CHAT,
    payload: {
        chatIndex: number,
        messageId: Option<number>,
        missingMessages: LocalMessage[],
        fromHistory: boolean
    }
}
