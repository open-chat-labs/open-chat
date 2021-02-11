import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { ChatId } from "../../domain/model/chats";

export const MARK_MESSAGES_AS_READ_SERVER_SYNC_REQUESTED = "MARK_MESSAGES_AS_READ_SERVER_SYNC_REQUESTED";
export const MARK_MESSAGES_AS_READ_SERVER_SYNC_SUCCEEDED = "MARK_MESSAGES_AS_READ_SERVER_SYNC_SUCCEEDED";
export const MARK_MESSAGES_AS_READ_SERVER_SYNC_FAILED = "MARK_MESSAGES_AS_READ_SERVER_SYNC_FAILED";

export default function(chatId: ChatId, fromId: number, toId: number) {
    return async (dispatch: Dispatch<any>) => {
        const request: MarkMessagesAsReadServerSyncRequest = {
            chatId,
            fromId,
            toId
        };

        const requestEvent: MarkMessagesAsReadServerSyncRequestedEvent = {
            type: MARK_MESSAGES_AS_READ_SERVER_SYNC_REQUESTED,
            payload: request
        };

        dispatch(requestEvent);

        const response = await chatsService.markRead(chatId, fromId, toId);

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: MARK_MESSAGES_AS_READ_SERVER_SYNC_SUCCEEDED,
                payload: {
                    request: request,
                    unreadMessageIds: response.result.unreadMessageIds
                }
            } as MarkMessagesAsReadServerSyncSucceededEvent;
        } else {
            outcomeEvent = {
                type: MARK_MESSAGES_AS_READ_SERVER_SYNC_FAILED,
                payload: request
            } as MarkMessagesAsReadServerSyncFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type MarkMessagesAsReadServerSyncRequestedEvent = {
    type: typeof MARK_MESSAGES_AS_READ_SERVER_SYNC_REQUESTED,
    payload: MarkMessagesAsReadServerSyncRequest
}

export type MarkMessagesAsReadServerSyncSucceededEvent = {
    type: typeof MARK_MESSAGES_AS_READ_SERVER_SYNC_SUCCEEDED,
    payload: {
        request: MarkMessagesAsReadServerSyncRequest,
        unreadMessageIds: number[]
    }
}

export type MarkMessagesAsReadServerSyncFailedEvent = {
    type: typeof MARK_MESSAGES_AS_READ_SERVER_SYNC_FAILED,
    payload: MarkMessagesAsReadServerSyncRequest
}

export type MarkMessagesAsReadServerSyncRequest = {
    chatId: ChatId,
    fromId: number,
    toId: number
}
