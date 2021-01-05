import chatService from "../../services/chats/service";
import { ChatId } from "../../model/chats";
import { Option, Timestamp } from "../../model/common";
import { UserId } from "../../model/users";

export const SEND_MESSAGE_REQUESTED = "SEND_MESSAGE_REQUESTED";
export const SEND_MESSAGE_SUCCEEDED = "SEND_MESSAGE_SUCCEEDED";
export const SEND_MESSAGE_FAILED = "SEND_MESSAGE_FAILED";

export default function(userId: UserId, chatId: Option<ChatId>, message: string) {
    return async (dispatch: any) => {
        const id = Symbol("id");

        const requestEvent: SendMessageRequestedEvent = {
            type: SEND_MESSAGE_REQUESTED,
            payload: {
                kind: "direct",
                userId: userId,
                chatId: chatId,
                message: message,
                unconfirmedMessageId: id
            }
        };

        dispatch(requestEvent);

        const response = chatId
            ? await chatService.sendMessage(chatId, message)
            : await chatService.sendDirectMessage(userId, message);

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: SEND_MESSAGE_SUCCEEDED,
                payload: {
                    kind: "direct",
                    userId: userId,
                    chatId: chatId,
                    message: message,
                    unconfirmedMessageId: id,
                    confirmedMessageId: response.result.messageId,
                    confirmedMessageTimestamp: response.result.timestamp
                }
            } as SendMessageSucceededEvent;
        } else {
            outcomeEvent = {
                type: SEND_MESSAGE_FAILED
            } as SendMessageFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export const sendGroupMessage = (chatId: ChatId, message: string) => async (dispatch: any) => {
    const id = Symbol("id");

    const requestEvent: SendMessageRequestedEvent = {
        type: SEND_MESSAGE_REQUESTED,
        payload: {
            kind: "group",
            chatId: chatId,
            message: message,
            unconfirmedMessageId: id
        }
    };

    dispatch(requestEvent);

    const response = await chatService.sendMessage(chatId, message);

    let outcomeEvent;
    if (response.kind === "success") {
        outcomeEvent = {
            type: SEND_MESSAGE_SUCCEEDED,
            payload: {
                kind: "group",
                chatId: chatId,
                message: message,
                unconfirmedMessageId: id,
                confirmedMessageId: response.result.messageId,
                confirmedMessageTimestamp: response.result.timestamp
            }
        } as SendMessageSucceededEvent;
    } else {
        outcomeEvent = {
            type: SEND_MESSAGE_FAILED
        } as SendMessageFailedEvent;
    }

    dispatch(outcomeEvent);
}

export type SendMessageRequestedEvent = {
    type: typeof SEND_MESSAGE_REQUESTED,
    payload: SendMessageRequest
}

export type SendMessageSucceededEvent = {
    type: typeof SEND_MESSAGE_SUCCEEDED,
    payload: SendMessageSuccess
}

export type SendMessageFailedEvent = {
    type: typeof SEND_MESSAGE_FAILED
}

export type SendMessageRequest = SendDirectMessageRequest | SendGroupMessageRequest;

export type SendDirectMessageRequest = {
    kind: "direct",
    userId: UserId,
    chatId: Option<ChatId>,
    message: string,
    unconfirmedMessageId: Symbol
}

export type SendGroupMessageRequest = {
    kind: "group",
    chatId: ChatId,
    message: string,
    unconfirmedMessageId: Symbol
}

export type SendMessageSuccess = SendDirectMessageSuccess | SendGroupMessageSuccess;

export type SendDirectMessageSuccess = {
    kind: "direct",
    userId: UserId,
    chatId: Option<ChatId>,
    message: string,
    unconfirmedMessageId: Symbol,
    confirmedMessageId: number,
    confirmedMessageTimestamp: Timestamp
}

export type SendGroupMessageSuccess = {
    kind: "group",
    chatId: ChatId,
    message: string,
    unconfirmedMessageId: Symbol,
    confirmedMessageId: number,
    confirmedMessageTimestamp: Timestamp
}
