import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { SendDirectMessageResult } from "../../services/chats/sendDirectMessage";
import { Chat, ChatId } from "../../model/chats";
import { Option } from "../../model/common";
import { UserId } from "../../model/users";
import { RootState } from "../../reducers";

export const SEND_MESSAGE_REQUESTED = "SEND_MESSAGE_REQUESTED";
export const SEND_MESSAGE_SUCCEEDED = "SEND_MESSAGE_SUCCEEDED";
export const SEND_MESSAGE_FAILED = "SEND_MESSAGE_FAILED";

export default function(chat: Chat, message: string) {
    switch (chat.kind) {
        case "direct":
            return sendDirectMessage(chat.them, chat.chatId, message);

        case "group":
            return sendGroupMessage(chat.chatId, message);

        case "newDirect":
            return sendDirectMessage(chat.them, null, message);
    }
}

export function sendDirectMessage(userId: UserId, chatId: Option<ChatId>, message: string) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
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
            ? await chatsService.sendMessage(chatId, message)
            : await chatsService.sendDirectMessage(userId, message);

        let outcomeEvent;
        if (response.kind === "success") {
            const myUserId = getState().usersState.me!.userId;

            outcomeEvent = {
                type: SEND_MESSAGE_SUCCEEDED,
                payload: {
                    kind: "direct",
                    userId: userId,
                    chatId: chatId ?? (response.result as SendDirectMessageResult).chatId,
                    sender: myUserId,
                    message: message,
                    unconfirmedMessageId: id,
                    confirmedMessageId: response.result.messageId,
                    confirmedMessageDate: response.result.date
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

export function sendGroupMessage(chatId: ChatId, message: string) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
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

        const response = await chatsService.sendMessage(chatId, message);

        let outcomeEvent;
        if (response.kind === "success") {
            const myUserId = getState().usersState.me!.userId;

            outcomeEvent = {
                type: SEND_MESSAGE_SUCCEEDED,
                payload: {
                    kind: "group",
                    chatId: chatId,
                    sender: myUserId,
                    message: message,
                    unconfirmedMessageId: id,
                    confirmedMessageId: response.result.messageId,
                    confirmedMessageDate: response.result.date
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

export type SendDirectMessageSuccess = SendMessageSuccessCommon & {
    kind: "direct",
    userId: UserId
}

export type SendGroupMessageSuccess = SendMessageSuccessCommon & {
    kind: "group"
}

type SendMessageSuccessCommon = {
    chatId: ChatId,
    sender: UserId,
    message: string,
    unconfirmedMessageId: Symbol,
    confirmedMessageId: number,
    confirmedMessageDate: Date
}
