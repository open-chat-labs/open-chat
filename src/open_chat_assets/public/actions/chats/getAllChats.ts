import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { Chat } from "../../model/chats";

export const GET_ALL_CHATS_REQUESTED = "GET_ALL_CHATS_REQUESTED";
export const GET_ALL_CHATS_SUCCEEDED = "GET_ALL_CHATS_SUCCEEDED";
export const GET_ALL_CHATS_FAILED = "GET_ALL_CHATS_FAILED";

export default function() {
    return async (dispatch: Dispatch<any>) => {
        const requestEvent: GetAllChatsRequestedEvent = {
            type: GET_ALL_CHATS_REQUESTED
        };

        dispatch(requestEvent);

        const result = await chatsService.listChats(false);

        let outcomeEvent;
        if (result.kind === "success") {
            outcomeEvent = {
                type: GET_ALL_CHATS_SUCCEEDED,
                payload: result.chats
            } as GetAllChatsSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_ALL_CHATS_FAILED
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
    payload: Chat[]
}

export type GetAllChatsFailedEvent = {
    type: typeof GET_ALL_CHATS_FAILED
}
