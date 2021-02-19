import { Dispatch } from "react";
import chatsService from "../../services/chats/service";
import { UserId } from "../../domain/model/users";
import { ChatId } from "../../domain/model/chats";
import { RemoveParticipantResponse } from "../../services/chats/removeParticipant";
import Stopwatch from "../../utils/Stopwatch";

export const REMOVE_PARTICIPANT_REQUESTED = "REMOVE_PARTICIPANT_REQUESTED";
export const REMOVE_PARTICIPANT_SUCCEEDED = "REMOVE_PARTICIPANT_SUCCEEDED";
export const REMOVE_PARTICIPANT_FAILED = "REMOVE_PARTICIPANT_FAILED";

export default function(chatId: ChatId, userId: UserId) {
    return async (dispatch: Dispatch<any>) => {
        const timer = Stopwatch.startNew();

        const requestEvent: RemoveParticipantRequestedEvent = {
            type: REMOVE_PARTICIPANT_REQUESTED,
            payload: {
                chatId,
                userId
            }
        };
    
        dispatch(requestEvent);

        const response = await chatsService.removeParticipant(chatId, userId);

        if (response === RemoveParticipantResponse.Success) {
            dispatch({
                type: REMOVE_PARTICIPANT_SUCCEEDED,
                payload: {
                    chatId,
                    userId,
                    durationMs: timer.getElapsedMs()
                }
            } as RemoveParticipantSucceededEvent);
        } else {
            dispatch({ 
                type: REMOVE_PARTICIPANT_FAILED,
                payload: {
                    chatId,
                    userId,
                    durationMs: timer.getElapsedMs()
                }    
             } as RemoveParticipantFailedEvent);
        }
    };
}

export type RemoveParticipantRequestedEvent = {
    type: typeof REMOVE_PARTICIPANT_REQUESTED,
    payload: {
        chatId: ChatId,
        userId: UserId
    }
}

export type RemoveParticipantSucceededEvent = {
    type: typeof REMOVE_PARTICIPANT_SUCCEEDED,
    payload: {
        chatId: ChatId,
        userId: UserId,
        durationMs: number
    }
}

export type RemoveParticipantFailedEvent = {
    type: typeof REMOVE_PARTICIPANT_FAILED,
    payload: {
        chatId: ChatId,
        userId: UserId,
        durationMs: number
    }
}
