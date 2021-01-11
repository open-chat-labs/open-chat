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

        case "newGroup":
            return sendMessageToNewGroup(chat.id, message);
    }
}

function sendDirectMessage(userId: UserId, chatId: Option<ChatId>, message: string) {
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

function sendGroupMessage(chatId: ChatId, message: string) {
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

// We can't send messages to a new group until the group has been confirmed at which point we will receive the chatId.
// So we only signal the 'requestEvent', the reducer will then add the message to the 'unconfirmedMessages' array for
// the chat and those messages will be sent once the chat is confirmed.
function sendMessageToNewGroup(id: Symbol, message: string) {
    return (dispatch: Dispatch<any>) => {
        const requestEvent: SendMessageToNewGroupRequest = {
            kind: "newGroup",
            unconfirmedChatId: id,
            message
        };
        dispatch(requestEvent);
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

export type SendMessageRequest = SendDirectMessageRequest | SendGroupMessageRequest | SendMessageToNewGroupRequest;

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

export type SendMessageToNewGroupRequest = {
    kind: "newGroup",
    unconfirmedChatId: Symbol,
    message: string
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
