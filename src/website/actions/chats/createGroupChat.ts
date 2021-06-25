import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import * as chatFunctions from "../../domain/model/chats";
import { ChatId, ConfirmedGroupChat, UnconfirmedGroupChat } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";
import { RootState } from "../../reducers";

import sendMessage from "./sendMessage";
import { TextContent } from "../../domain/model/messages";
import Stopwatch from "../../utils/Stopwatch";
import { CreateGroupChatResponse } from "../../services/chats/createGroupChat";

export const CREATE_GROUP_CHAT_REQUESTED = "CREATE_GROUP_CHAT_REQUESTED";
export const CREATE_GROUP_CHAT_SUCCEEDED = "CREATE_GROUP_CHAT_SUCCEEDED";
export const CREATE_GROUP_CHAT_FAILED = "CREATE_GROUP_CHAT_FAILED";

export default function(subject: string, users: UserId[], chatHistoryVisibleToNewJoiners: boolean) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const timer = Stopwatch.startNew();
        const chatId = chatFunctions.generateChatId();

        const requestEvent: CreateGroupChatRequestedEvent = {
            type: CREATE_GROUP_CHAT_REQUESTED,
            payload: {
                chatId,
                subject,
                users
            }
        };

        dispatch(requestEvent);

        const response = await chatsService.createGroupChat(chatId, subject, users, chatHistoryVisibleToNewJoiners);

        if (response.kind !== "success") {
            dispatch({
                type: CREATE_GROUP_CHAT_FAILED,
                payload: {
                    chatId,
                    subject,
                    users,
                    response
                }
            } as CreateGroupChatFailedEvent);

            return;
        }
 
        // Messages may have been added on the UI before the chat was confirmed on the back end. These messages will
        // have been added to the 'chat.unconfirmedMessages' array. So we need to read the values out of this array,
        // then apply the state change to confirm the chat, then send those messages using the new chatId.
        const oldChat = chatFunctions.getChat(getState().chatsState.chats, chatId)[0] as UnconfirmedGroupChat;

        dispatch({
            type: CREATE_GROUP_CHAT_SUCCEEDED,
            payload: {
                chatId,
                chat: response.result,
                durationMs: timer.getElapsedMs()
            }
        } as CreateGroupChatSucceededEvent);

        const messagesToSend = oldChat.messages;

        if (messagesToSend.length) {
            const chat = chatFunctions.getChat(getState().chatsState.chats, chatId)[0] as ConfirmedGroupChat;
            messagesToSend.forEach(m => dispatch(sendMessage(chat, m.content as TextContent, m.repliesTo)));
        }    
    }
}

export type CreateGroupChatRequestedEvent = {
    type: typeof CREATE_GROUP_CHAT_REQUESTED,
    payload: {
        chatId: ChatId,
        subject: string,
        users: UserId[]
    }
}

export type CreateGroupChatSucceededEvent = {
    type: typeof CREATE_GROUP_CHAT_SUCCEEDED,
    payload: {
        chatId: ChatId,
        chat: ConfirmedGroupChat,
        durationMs: number
    }
}

export type CreateGroupChatFailedEvent = {
    type: typeof CREATE_GROUP_CHAT_FAILED,
    payload: {
        chatId: ChatId,
        subject: string,
        users: UserId[],
        response: CreateGroupChatResponse
    }
}
