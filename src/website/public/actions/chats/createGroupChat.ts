import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ChatId } from "../../model/chats";
import { UnconfirmedMessage } from "../../model/messages";
import { UserId } from "../../model/users";
import { RootState } from "../../reducers";

import sendMessage from "./sendMessage";
import { UNCONFIRMED_GROUP_CHAT } from "../../constants";

export const CREATE_GROUP_CHAT_REQUESTED = "CREATE_GROUP_CHAT_REQUESTED";
export const CREATE_GROUP_CHAT_SUCCEEDED = "CREATE_GROUP_CHAT_SUCCEEDED";
export const CREATE_GROUP_CHAT_FAILED = "CREATE_GROUP_CHAT_FAILED";

export default function(subject: string, users: UserId[]) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const tempId = Symbol("id");

        const requestEvent: CreateGroupChatRequestedEvent = {
            type: CREATE_GROUP_CHAT_REQUESTED,
            payload: {
                tempId,
                subject,
                users
            }
        };

        dispatch(requestEvent);

        const response = await chatsService.createGroupChat(subject, users);

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: CREATE_GROUP_CHAT_SUCCEEDED,
                payload: {
                    tempId,
                    chatId: response.result.chatId,
                    date: response.result.date
                }
            } as CreateGroupChatSucceededEvent;
        } else {
            outcomeEvent = {
                type: CREATE_GROUP_CHAT_FAILED,
                payload: {
                    tempId,
                    subject,
                    users
                }
            } as CreateGroupChatFailedEvent;
        }

        // Messages may have been added on the UI before the chat was confirmed on the back end. These messages will
        // have been added to the 'chat.unconfirmedMessages' array. So we need to read the values out of this array,
        // then apply the state change to confirm the chat, then send those messages using the new chatId.
        const chat = getState().chatsState.chats.find(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.id === tempId)!
        const messagesToSend = chat.messages as UnconfirmedMessage[];

        dispatch(outcomeEvent);

        if (response.kind === "success" && messagesToSend.length) {
            const chat = getState().chatsState.chats.find(c => "chatId" in c && c.chatId === response.result.chatId)!;

            messagesToSend.forEach(m => dispatch(sendMessage(chat, m.text)))
        }
    }
}

export type CreateGroupChatRequestedEvent = {
    type: typeof CREATE_GROUP_CHAT_REQUESTED,
    payload: {
        tempId: Symbol,
        subject: string,
        users: UserId[]
    }
}

export type CreateGroupChatSucceededEvent = {
    type: typeof CREATE_GROUP_CHAT_SUCCEEDED,
    payload: {
        tempId: Symbol,
        chatId: ChatId,
        date: Date
    }
}

export type CreateGroupChatFailedEvent = {
    type: typeof CREATE_GROUP_CHAT_FAILED,
    payload: {
        tempId: Symbol,
        subject: string,
        users: UserId[]
    }
}
