import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ChatId } from "../../domain/model/chats";
import { GetMessagesResult } from "../../services/chats/getMessages";

export const GET_MESSAGES_REQUESTED = "GET_MESSAGES_REQUESTED";
export const GET_MESSAGES_SUCCEEDED = "GET_MESSAGES_SUCCEEDED";
export const GET_MESSAGES_FAILED = "GET_MESSAGES_FAILED";

export default function(chatId: ChatId, fromId: number, count: number) {
    return async (dispatch: Dispatch<any>) => {
        const request: GetMessagesRequest = {
            chatId,
            fromId,
            count
        };

        const requestEvent: GetMessagesRequestedEvent = {
            type: GET_MESSAGES_REQUESTED,
            payload: request
        };

        dispatch(requestEvent);

        const response = await chatsService.getMessages(chatId, fromId, count);

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: GET_MESSAGES_SUCCEEDED,
                payload: {
                    request: request,
                    result: response.result
                }
            } as GetMessagesSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_MESSAGES_FAILED,
                payload: request
            } as GetMessagesFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type GetMessagesRequestedEvent = {
    type: typeof GET_MESSAGES_REQUESTED,
    payload: GetMessagesRequest
}

export type GetMessagesSucceededEvent = {
    type: typeof GET_MESSAGES_SUCCEEDED,
    payload: {
        request: GetMessagesRequest,
        result: GetMessagesResult
    }
}

export type GetMessagesFailedEvent = {
    type: typeof GET_MESSAGES_FAILED,
    payload: GetMessagesRequest
}

export type GetMessagesRequest = {
    chatId: ChatId,
    fromId: number,
    count: number
}
