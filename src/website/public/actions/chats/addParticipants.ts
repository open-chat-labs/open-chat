import { Dispatch } from "react";
import chatsService from "../../services/chats/service";
import { UserId, UserSummary } from "../../model/users";
import { RootState } from "../../reducers";
import { ChatId, GroupChat } from "../../model/chats";
import { CONFIRMED_GROUP_CHAT, UNCONFIRMED_GROUP_CHAT } from "../../constants";

export const ADD_PARTICIPANTS_REQUESTED = "ADD_PARTICIPANTS_REQUESTED";
export const ADD_PARTICIPANTS_SUCCEEDED = "ADD_PARTICIPANTS_SUCCEEDED";
export const ADD_PARTICIPANTS_FAILED = "ADD_PARTICIPANTS_FAILED";

export function addParticipantsByUsername(chat: GroupChat, usernames: string[]) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {

        const userIds : UserId[] = Object
            .values(getState().usersState.userDictionary)
            .filter(user => usernames.includes((user as UserSummary).username))
            .map(user => (user as UserSummary).userId);

        if (userIds.length === 0) {
            return;
        }

        dispatch(addParticipantsByUserId(chat, userIds));
    };
}

export function addParticipantsByUserId(chat: GroupChat, userIds: UserId[]) {
    return async (dispatch: Dispatch<any>) => {

        {
            const chatId: ChatId | Symbol = chat.kind === CONFIRMED_GROUP_CHAT 
                ? chat.chatId 
                : chat.id;

            const requestEvent: AddParticipantsRequestedEvent = {
                type: ADD_PARTICIPANTS_REQUESTED,
                payload: {
                    chatId,
                    users: userIds
                }
            };
        
            dispatch(requestEvent);
        }

        if (chat.kind === UNCONFIRMED_GROUP_CHAT)
            return;

        const response = await chatsService.addParticipants(chat.chatId, userIds);

        if (response.kind === "success") {
            dispatch({
                type: ADD_PARTICIPANTS_SUCCEEDED,
                payload: {
                    chatId: chat.chatId,
                    users: userIds
                }
            } as AddParticipantsSucceededEvent);
        } else {
            dispatch({ 
                type: ADD_PARTICIPANTS_FAILED,
                payload: {
                    chatId: chat.chatId,
                    users: userIds
                }    
             } as AddParticipantsFailedEvent);
        }
    };
}

export type AddParticipantsRequestedEvent = {
    type: typeof ADD_PARTICIPANTS_REQUESTED,
    payload: {
        chatId: ChatId | Symbol,
        users: UserId[]
    }
}

export type AddParticipantsSucceededEvent = {
    type: typeof ADD_PARTICIPANTS_SUCCEEDED,
    payload: {
        chatId: ChatId,
        users: UserId[]
    }
}

export type AddParticipantsFailedEvent = {
    type: typeof ADD_PARTICIPANTS_FAILED,
    payload: {
        chatId: ChatId,
        users: UserId[]
    }
}
