import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ConfirmedChat } from "../../domain/model/chats";
import { PAGE_SIZE } from "../../constants";
import { Option, Timestamp } from "../../domain/model/common";
import { HttpError } from "../../errors/httpError";

export const GET_ALL_CHATS_REQUESTED = "GET_ALL_CHATS_REQUESTED";
export const GET_ALL_CHATS_SUCCEEDED = "GET_ALL_CHATS_SUCCEEDED";
export const GET_ALL_CHATS_FAILED = "GET_ALL_CHATS_FAILED";

export default function() {
    return async (dispatch: Dispatch<any>) => {
        const requestEvent: GetAllChatsRequestedEvent = {
            type: GET_ALL_CHATS_REQUESTED
        };

        dispatch(requestEvent);

        const response = await chatsService.getChats({
            updatedSince: null,
            messageCountForTopChat: PAGE_SIZE
        });

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: GET_ALL_CHATS_SUCCEEDED,
                payload: {
                    chats: response.chats,
                    latestUpdateTimestamp: response.latestUpdateTimestamp
                }
            } as GetAllChatsSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_ALL_CHATS_FAILED,
                httpError: response.kind === "httpError" ? response : undefined
            } as GetAllChatsFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type GetAllChatsRequestedEvent = {
    type: typeof GET_ALL_CHATS_REQUESTED
}

export type GetAllChatsSucceededEvent = {
    type: typeof GET_ALL_CHATS_SUCCEEDED,
    payload: {
        chats: ConfirmedChat[],
        latestUpdateTimestamp: Option<Timestamp>
    }
}

export type GetAllChatsFailedEvent = {
    type: typeof GET_ALL_CHATS_FAILED,
    httpError?: HttpError
}
