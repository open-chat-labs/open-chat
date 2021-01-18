import { Dispatch } from "react";

import chatsService from "../../services/chats/service";
import { SendDirectMessageResult } from "../../services/chats/sendDirectMessage";
import { Chat, ChatId } from "../../model/chats";
import { Option } from "../../model/common";
import { LocalMessage, MessageContent } from "../../model/messages";
import { UserId } from "../../model/users";
import { RootState } from "../../reducers";
import {
    CONFIRMED_DIRECT_CHAT,
    CONFIRMED_GROUP_CHAT,
    UNCONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_GROUP_CHAT
} from "../../constants";

export const SEND_MESSAGE_REQUESTED = "SEND_MESSAGE_REQUESTED";
export const SEND_MESSAGE_SUCCEEDED = "SEND_MESSAGE_SUCCEEDED";
export const SEND_MESSAGE_FAILED = "SEND_MESSAGE_FAILED";

export default function(chat: Chat, content: MessageContent) {
    switch (chat.kind) {
        case CONFIRMED_DIRECT_CHAT: return sendDirectMessage(chat.them, chat.chatId, content);
        case CONFIRMED_GROUP_CHAT: return sendGroupMessage(chat.chatId, content);
        case UNCONFIRMED_DIRECT_CHAT: return sendDirectMessage(chat.them, null, content);
        case UNCONFIRMED_GROUP_CHAT: return sendMessageToNewGroup(chat.id, content);
    }
}

function sendDirectMessage(userId: UserId, chatId: Option<ChatId>, content: MessageContent) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const requestEvent: SendMessageRequestedEvent = {
            type: SEND_MESSAGE_REQUESTED,
            payload: {
                kind: "direct",
                userId,
                chatId,
                content
            }
        };

        dispatch(requestEvent);

        const response = chatId
            ? await chatsService.sendMessage(chatId, content)
            : await chatsService.sendDirectMessage(userId, content);

        let outcomeEvent;
        if (response.kind === "success") {
            const myUserId = getState().usersState.me!.userId;

            outcomeEvent = {
                type: SEND_MESSAGE_SUCCEEDED,
                payload: {
                    kind: "direct",
                    userId,
                    chatId: chatId ?? (response.result as SendDirectMessageResult).chatId,
                    message: {
                        kind: "local",
                        id: response.result.messageId,
                        date: response.result.date,
                        sender: myUserId,
                        content
                    }
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

function sendGroupMessage(chatId: ChatId, content: MessageContent) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const requestEvent: SendMessageRequestedEvent = {
            type: SEND_MESSAGE_REQUESTED,
            payload: {
                kind: "group",
                chatId,
                content
            }
        };

        dispatch(requestEvent);

        const response = await chatsService.sendMessage(chatId, content);

        let outcomeEvent;
        if (response.kind === "success") {
            const myUserId = getState().usersState.me!.userId;

            outcomeEvent = {
                type: SEND_MESSAGE_SUCCEEDED,
                payload: {
                    kind: "group",
                    chatId,
                    message: {
                        kind: "local",
                        id: response.result.messageId,
                        date: response.result.date,
                        sender: myUserId,
                        content
                    }
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
function sendMessageToNewGroup(id: Symbol, content: MessageContent) {
    return (dispatch: Dispatch<any>) => {
        const requestEvent: SendMessageRequestedEvent = {
            type: SEND_MESSAGE_REQUESTED,
            payload: {
                kind: "newGroup",
                unconfirmedChatId: id,
                content
            }
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
    content: MessageContent
}

export type SendGroupMessageRequest = {
    kind: "group",
    chatId: ChatId,
    content: MessageContent
}

export type SendMessageToNewGroupRequest = {
    kind: "newGroup",
    unconfirmedChatId: Symbol,
    content: MessageContent
}

export type SendMessageSuccess = SendDirectMessageSuccess | SendGroupMessageSuccess;

export type SendDirectMessageSuccess = {
    kind: "direct",
    userId: UserId,
    chatId: ChatId,
    message: LocalMessage
}

export type SendGroupMessageSuccess = {
    kind: "group",
    chatId: ChatId,
    message: LocalMessage
}
