import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ChatId, ConfirmedGroupChat, UnconfirmedGroupChat } from "../../model/chats";
import { UserId } from "../../model/users";
import { RootState } from "../../reducers";

import sendMessage from "./sendMessage";
import { addParticipantsByUserId } from "./addParticipants";
import { CONFIRMED_GROUP_CHAT, UNCONFIRMED_GROUP_CHAT } from "../../constants";
import { TextContent } from "../../model/messages";

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

        if (response.kind !== "success") {
            dispatch({
                type: CREATE_GROUP_CHAT_FAILED,
                payload: {
                    tempId,
                    subject,
                    users
                }
            } as CreateGroupChatFailedEvent);

            return;
        }
 
        // 1. Messages may have been added on the UI before the chat was confirmed on the back end. These messages will
        // have been added to the 'chat.unconfirmedMessages' array. So we need to read the values out of this array,
        // then apply the state change to confirm the chat, then send those messages using the new chatId.
        // 2. Likewise participants may have been added to the UI before the chat was confirmed on the back end. 
        // In which case those participants will have been added to the pendingParticipants on the chat and we should now  
        // call addParticipants with them
        const oldChat = getState().chatsState.chats.find(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.id === tempId) as UnconfirmedGroupChat;

        dispatch({
            type: CREATE_GROUP_CHAT_SUCCEEDED,
            payload: {
                tempId,
                chatId: response.result.chatId,
                date: response.result.date
            }
        } as CreateGroupChatSucceededEvent);

        const particpantsToAdd = oldChat.pendingParticipants;
        const messagesToSend = oldChat.messages;

        if (particpantsToAdd.length || messagesToSend.length) {
            const chat = getState().chatsState.chats.find(c => c.kind === CONFIRMED_GROUP_CHAT && c.chatId === response.result.chatId) as ConfirmedGroupChat;

            if (particpantsToAdd.length) {
                dispatch(addParticipantsByUserId(chat, particpantsToAdd));
            }

            messagesToSend.forEach(m => dispatch(sendMessage(chat, m.content as TextContent)));
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
