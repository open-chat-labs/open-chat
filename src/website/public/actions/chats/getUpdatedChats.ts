import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ConfirmedChat } from "../../model/chats";
import { Option, Timestamp } from "../../model/common";

export const GET_UPDATED_CHATS_REQUESTED = "GET_UPDATED_CHATS_REQUESTED";
export const GET_UPDATED_CHATS_SUCCEEDED = "GET_UPDATED_CHATS_SUCCEEDED";
export const GET_UPDATED_CHATS_FAILED = "GET_UPDATED_CHATS_FAILED";

export default function(updatedSince: Option<Timestamp>, callback: () => void) {
    return async (dispatch: Dispatch<any>) => {
        // This function is called every second and we do not currently listen for GET_UPDATED_CHATS_REQUESTED event so
        // in order to remove noise and aid debugging these events are not being dispatched for now.
        //
        // const requestEvent: GetUpdatedChatsRequestedEvent = {
        //     type: GET_UPDATED_CHATS_REQUESTED
        // };
        //
        // dispatch(requestEvent);

        const response = await chatsService.getChats({
            updatedSince: updatedSince,
            messageCountForTopChat: null
        });

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: GET_UPDATED_CHATS_SUCCEEDED,
                payload: {
                    chats: response.chats,
                    latestUpdateTimestamp: response.latestUpdateTimestamp
                }
            } as GetUpdatedChatsSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_UPDATED_CHATS_FAILED
            } as GetUpdatedChatsFailedEvent;
        }

        // This function is called every second and the only events that make any state changes are the
        // GET_UPDATED_CHATS_SUCCEEDED which have non-empty chats. So we can ignore the events with empty chats.
        if (outcomeEvent.type !== GET_UPDATED_CHATS_SUCCEEDED || outcomeEvent.payload.chats.length) {
            dispatch(outcomeEvent);
        }

        callback();
    }
}

export type GetUpdatedChatsRequestedEvent = {
    type: typeof GET_UPDATED_CHATS_REQUESTED
}

export type GetUpdatedChatsSucceededEvent = {
    type: typeof GET_UPDATED_CHATS_SUCCEEDED,
    payload: {
        chats: ConfirmedChat[],
        latestUpdateTimestamp: Option<Timestamp>
    }
}

export type GetUpdatedChatsFailedEvent = {
    type: typeof GET_UPDATED_CHATS_FAILED
}
