import { Dispatch } from "react";
import chatsService from "../../services/chats/service";
import { ChatId } from "../../domain/model/chats";
import { GetMessagesResult } from "../../services/chats/getMessages";

export const GET_MESSAGES_BY_ID_REQUESTED = "GET_MESSAGES_BY_ID_REQUESTED";
export const GET_MESSAGES_BY_ID_SUCCEEDED = "GET_MESSAGES_BY_ID_SUCCEEDED";
export const GET_MESSAGES_BY_ID_FAILED = "GET_MESSAGES_BY_ID_FAILED";

export default function(chatId: ChatId, messageIds: number[]) {
    return async (dispatch: Dispatch<any>) => {
        const request: GetMessagesByIdRequest = {
            chatId,
            messageIds
        };

        const requestEvent: GetMessagesByIdRequestedEvent = {
            type: GET_MESSAGES_BY_ID_REQUESTED,
            payload: request
        };

        dispatch(requestEvent);

        const response = await chatsService.getMessagesById(chatId, messageIds);

        let outcomeEvent: GetMessagesByIdReponseEvent; 

        if (response.kind === "success") {
            outcomeEvent = {
                type: GET_MESSAGES_BY_ID_SUCCEEDED,
                payload: {
                    request: request,
                    result: response.result
                }
            };
        } else {
            outcomeEvent = {
                type: GET_MESSAGES_BY_ID_FAILED,
                payload: request
            };
        }

        dispatch(outcomeEvent);
    }
}

export type GetMessagesByIdRequestedEvent = {
    type: typeof GET_MESSAGES_BY_ID_REQUESTED,
    payload: GetMessagesByIdRequest
}

export type GetMessagesByIdReponseEvent = GetMessagesByIdSucceededEvent | GetMessagesByIdFailedEvent;

export type GetMessagesByIdSucceededEvent = {
    type: typeof GET_MESSAGES_BY_ID_SUCCEEDED,
    payload: {
        request: GetMessagesByIdRequest,
        result: GetMessagesResult
    }
}

export type GetMessagesByIdFailedEvent = {
    type: typeof GET_MESSAGES_BY_ID_FAILED,
    payload: GetMessagesByIdRequest
}

export type GetMessagesByIdRequest = {
    chatId: ChatId,
    messageIds: number[]
}
