import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ChatId } from "../../model/chats";

export const MARK_MESSAGES_AS_READ_REQUESTED = "MARK_MESSAGES_AS_READ_REQUESTED";
export const MARK_MESSAGES_AS_READ_SUCCEEDED = "MARK_MESSAGES_AS_READ_SUCCEEDED";
export const MARK_MESSAGES_AS_READ_FAILED = "MARK_MESSAGES_AS_READ_FAILED";

export default function(chatId: ChatId, fromId: number, toId: number) {
    return async (dispatch: Dispatch<any>) => {
        const request: MarkMessagesAsReadRequest = {
            chatId,
            fromId,
            toId
        };

        const requestEvent: MarkMessagesAsReadRequestedEvent = {
            type: MARK_MESSAGES_AS_READ_REQUESTED,
            payload: request
        };

        dispatch(requestEvent);

        const response = await chatsService.markRead(chatId, fromId, toId);

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: MARK_MESSAGES_AS_READ_SUCCEEDED,
                payload: {
                    request: request,
                    unreadMessageIds: response.result.unreadMessageIds
                }
            } as MarkMessagesAsReadSucceededEvent;
        } else {
            outcomeEvent = {
                type: MARK_MESSAGES_AS_READ_FAILED,
                payload: request
            } as MarkMessagesAsReadFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type MarkMessagesAsReadRequestedEvent = {
    type: typeof MARK_MESSAGES_AS_READ_REQUESTED,
    payload: MarkMessagesAsReadRequest
}

export type MarkMessagesAsReadSucceededEvent = {
    type: typeof MARK_MESSAGES_AS_READ_SUCCEEDED,
    payload: {
        request: MarkMessagesAsReadRequest,
        unreadMessageIds: number[]
    }
}

export type MarkMessagesAsReadFailedEvent = {
    type: typeof MARK_MESSAGES_AS_READ_FAILED,
    payload: MarkMessagesAsReadRequest
}

export type MarkMessagesAsReadRequest = {
    chatId: ChatId,
    fromId: number,
    toId: number
}
