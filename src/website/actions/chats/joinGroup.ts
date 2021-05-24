import { Dispatch } from "react";
import chatsService from "../../services/chats/service";
import { ChatId } from "../../domain/model/chats";
import * as chatFunctions from "../../domain/model/chats";
import { JoinGroupResult } from "../../services/chats/joinGroup";
import ChatsUpdater from "../../domain/ChatsUpdater";
import { RootState } from "../../reducers";

export const JOIN_GROUP_REQUESTED = "JOIN_GROUP_REQUESTED";
export const JOIN_GROUP_SUCCEEDED = "JOIN_GROUP_SUCCEEDED";
export const JOIN_GROUP_FAILED = "JOIN_GROUP_FAILED";
export const JOIN_GROUP_FAILED_ALREADY_IN_GROUP = "JOIN_GROUP_FAILED_ALREADY_IN_GROUP";

export default function(chatId: ChatId) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const state = getState();
        if (chatFunctions.tryGetChat(state.chatsState.chats, chatId)[0]) {
            alert("You are already in this chat");
            return;
        }

        const requestEvent: JoinGroupRequestedEvent = {
            type: JOIN_GROUP_REQUESTED,
            payload: {
                chatId
            }
        };

        dispatch(requestEvent);

        const result = await chatsService.joinGroup(chatId);

        if (result === JoinGroupResult.Success) {
            dispatch({
                type: JOIN_GROUP_SUCCEEDED,
                payload: {
                    chatId
                }
            } as JoinGroupSucceededEvent);

            await ChatsUpdater.triggerUpdate();
        } else if (result === JoinGroupResult.AlreadyInGroup) {
            dispatch({
                type: JOIN_GROUP_FAILED_ALREADY_IN_GROUP,
                payload: {
                    chatId,
                    result
                }
            } as JoinGroupFailedAlreadyInGroupEvent);
        } else {
            dispatch({
                type: JOIN_GROUP_FAILED,
                payload: {
                    chatId,
                    result
                }
            } as JoinGroupFailedEvent);
        }
    };
}

export type JoinGroupRequestedEvent = {
    type: typeof JOIN_GROUP_REQUESTED,
    payload: {
        chatId: ChatId
    }
}

export type JoinGroupSucceededEvent = {
    type: typeof JOIN_GROUP_SUCCEEDED,
    payload: {
        chatId: ChatId
    }
}

export type JoinGroupFailedEvent = {
    type: typeof JOIN_GROUP_FAILED,
    payload: {
        chatId: ChatId,
        result: JoinGroupResult
    }
}

export type JoinGroupFailedAlreadyInGroupEvent = {
    type: typeof JOIN_GROUP_FAILED_ALREADY_IN_GROUP,
    payload: {
        chatId: ChatId
    }
}
