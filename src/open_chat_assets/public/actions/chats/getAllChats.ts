import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ConfirmedChat } from "../../model/chats";

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
            unread_only: false,
            message_count_for_top_chat: null
        });

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: GET_ALL_CHATS_SUCCEEDED,
                payload: response.chats
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
    payload: ConfirmedChat[]
}

export type GetAllChatsFailedEvent = {
    type: typeof GET_ALL_CHATS_FAILED
}
