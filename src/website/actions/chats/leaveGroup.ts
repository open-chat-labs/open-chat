import { Dispatch } from "react";
import chatsService from "../../services/chats/service";
import { ChatId } from "../../domain/model/chats";
import { LeaveGroupResult } from "../../services/chats/leaveGroup";
import { startSpinning, stopSpinning } from "../app/modalSpinner";

export const LEAVE_GROUP_REQUESTED = "LEAVE_GROUP_REQUESTED";
export const LEAVE_GROUP_SUCCEEDED = "LEAVE_GROUP_SUCCEEDED";
export const LEAVE_GROUP_FAILED = "LEAVE_GROUP_FAILED";

export default function(chatId: ChatId) {
    return async (dispatch: Dispatch<any>) => {

        dispatch(startSpinning());

        const requestEvent: LeaveGroupRequestedEvent = {
            type: LEAVE_GROUP_REQUESTED,
            payload: {
                chatId
            }
        };

        dispatch(requestEvent);

        const result = await chatsService.leaveGroup(chatId);

        if (result === LeaveGroupResult.Success) {
            dispatch({
                type: LEAVE_GROUP_SUCCEEDED,
                payload: {
                    chatId
                }
            } as LeaveGroupSucceededEvent);
        } else {
            dispatch({ 
                type: LEAVE_GROUP_FAILED,
                payload: {
                    chatId,
                    result 
                }    
             } as LeaveGroupFailedEvent);
        }

        dispatch(stopSpinning());
    };
}

export type LeaveGroupRequestedEvent = {
    type: typeof LEAVE_GROUP_REQUESTED,
    payload: {
        chatId: ChatId
    }
}

export type LeaveGroupSucceededEvent = {
    type: typeof LEAVE_GROUP_SUCCEEDED,
    payload: {
        chatId: ChatId
    }
}

export type LeaveGroupFailedEvent = {
    type: typeof LEAVE_GROUP_FAILED,
    payload: {
        chatId: ChatId,
        result: LeaveGroupResult
    }
}
