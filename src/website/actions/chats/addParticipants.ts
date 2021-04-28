import { Dispatch } from "react";
import chatsService from "../../services/chats/service";
import { UserId, UserSummary } from "../../domain/model/users";
import { RootState } from "../../reducers";
import { ChatId, GroupChat } from "../../domain/model/chats";
import { UNCONFIRMED_GROUP_CHAT } from "../../constants";
import Stopwatch from "../../utils/Stopwatch";

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
        const timer = Stopwatch.startNew();

        {
            const requestEvent: AddParticipantsRequestedEvent = {
                type: ADD_PARTICIPANTS_REQUESTED,
                payload: {
                    chatId: chat.chatId,
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
                    users: userIds,
                    durationMs: timer.getElapsedMs()
                }
            } as AddParticipantsSucceededEvent);
        } else {
            dispatch({ 
                type: ADD_PARTICIPANTS_FAILED,
                payload: {
                    chatId: chat.chatId,
                    users: userIds,
                    durationMs: timer.getElapsedMs()
                }    
             } as AddParticipantsFailedEvent);
        }
    };
}

export type AddParticipantsRequestedEvent = {
    type: typeof ADD_PARTICIPANTS_REQUESTED,
    payload: {
        chatId: ChatId,
        users: UserId[]
    }
}

export type AddParticipantsSucceededEvent = {
    type: typeof ADD_PARTICIPANTS_SUCCEEDED,
    payload: {
        chatId: ChatId,
        users: UserId[],
        durationMs: number
    }
}

export type AddParticipantsFailedEvent = {
    type: typeof ADD_PARTICIPANTS_FAILED,
    payload: {
        chatId: ChatId,
        users: UserId[],
        durationMs: number
    }
}
