import { Dispatch } from "react";
import { ChatId } from "../../domain/model/chats";
import dataService, { DataSource } from "../../services/data/CachingDataService";

export const GET_MEDIA_REQUESTED = "GET_MEDIA_REQUESTED";
export const GET_MEDIA_SUCCEEDED = "GET_MEDIA_SUCCEEDED";
export const GET_MEDIA_FAILED = "GET_MEDIA_FAILED";

export default function(chatId: ChatId, messageId: number, key: string, totalBytes: number, chunkSize: number) {
    return async (dispatch: Dispatch<any>) => {
        const requestEvent: GetMediaRequestedEvent = {
            type: GET_MEDIA_REQUESTED,
            payload: {
                chatId,
                messageId,
                key,
                totalBytes,
                chunkSize
            }
        };

        dispatch(requestEvent);

        const response = await dataService.getData(
            DataSource.MediaMessage, 
            key, 
            totalBytes, 
            chunkSize);

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: GET_MEDIA_SUCCEEDED,
                payload: {
                    chatId,
                    messageId,
                    key,
                    totalBytes,
                    chunkSize,
                    data: response.data
                }
            } as GetMediaSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_MEDIA_FAILED,
                payload: {
                    chatId,
                    messageId,
                    key
                }
            } as GetMediaFailedEvent;
        }

        dispatch(outcomeEvent);

        return outcomeEvent;
    }
}

export type GetMediaOutcome = GetMediaSucceededEvent | GetMediaFailedEvent;

export type GetMediaRequestedEvent = {
    type: typeof GET_MEDIA_REQUESTED,
    payload: {
        chatId: ChatId,
        messageId: number,
        key: string,
        totalBytes: number,
        chunkSize: number
    }
}

export type GetMediaSucceededEvent = {
    type: typeof GET_MEDIA_SUCCEEDED,
    payload: {
        chatId: ChatId,
        messageId: number,
        key: string,
        data: Uint8Array
    }
}

export type GetMediaFailedEvent = {
    type: typeof GET_MEDIA_FAILED,
    payload: {
        chatId: ChatId,
        messageId: number,
        key: string
    }
}
