import { Dispatch } from "react";
import { v1 as uuidv1 } from 'uuid';
import chatsService from "../../services/chats/service";
import { SendDirectMessageResult } from "../../services/chats/sendDirectMessage";
import { Chat, ChatId } from "../../model/chats";
import { Option } from "../../model/common";
import { LocalMessage, MessageContent, SendMessageContent } from "../../model/messages";
import { UserId } from "../../model/users";
import { RootState } from "../../reducers";
import putData, { PutDataOutcome, PUT_DATA_FAILED } from "../data/putData";
import {
    CHUNK_SIZE_BYTES,
    CONFIRMED_DIRECT_CHAT,
    CONFIRMED_GROUP_CHAT,
    UNCONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_GROUP_CHAT
} from "../../constants";

export const SEND_MESSAGE_REQUESTED = "SEND_MESSAGE_REQUESTED";
export const SEND_MESSAGE_SUCCEEDED = "SEND_MESSAGE_SUCCEEDED";
export const SEND_MESSAGE_FAILED = "SEND_MESSAGE_FAILED";
export const SEND_MESSAGE_CONTENT_UPLOAD_FAILED = "SEND_MESSAGE_CONTENT_UPLOAD_FAILED";

export default function(chat: Chat, sendMessageContent: SendMessageContent) {
    return async (dispatch: Dispatch<any>) => {
        switch (chat.kind) {
            case CONFIRMED_DIRECT_CHAT:
                dispatch(sendDirectMessage(chat.them, chat.chatId, sendMessageContent));
                break;
            case CONFIRMED_GROUP_CHAT:
                dispatch(sendGroupMessage(chat.chatId, sendMessageContent));
                break;
            case UNCONFIRMED_DIRECT_CHAT:
                dispatch(sendDirectMessage(chat.them, null, sendMessageContent));
                break;
            case UNCONFIRMED_GROUP_CHAT:
                dispatch(sendMessageToNewGroup(chat.id, sendMessageContent));
                break;
        }
    }
}

function sendDirectMessage(userId: UserId, chatId: Option<ChatId>, sendMessageContent: SendMessageContent) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const [content, uploadContentTask] = handleMessageContent(sendMessageContent, dispatch);

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

        const contentUploadSuccess = !uploadContentTask || await uploadContentTask;

        let outcomeEvent;
        if (!contentUploadSuccess) {
            outcomeEvent = {
                type: SEND_MESSAGE_CONTENT_UPLOAD_FAILED
            };
        } else {
            const response = chatId
                ? await chatsService.sendMessage(chatId, content)
                : await chatsService.sendDirectMessage(userId, content);

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
        }

        dispatch(outcomeEvent);
    }
}

function sendGroupMessage(chatId: ChatId, sendMessageContent: SendMessageContent) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const [content, uploadContentTask] = handleMessageContent(sendMessageContent, dispatch);

        const requestEvent: SendMessageRequestedEvent = {
            type: SEND_MESSAGE_REQUESTED,
            payload: {
                kind: "group",
                chatId,
                content
            }
        };

        dispatch(requestEvent);

        const contentUploadSuccess = !uploadContentTask || await uploadContentTask;

        let outcomeEvent;
        if (!contentUploadSuccess) {
            outcomeEvent = {
                type: SEND_MESSAGE_CONTENT_UPLOAD_FAILED
            };
        } else {
            const response = await chatsService.sendMessage(chatId, content);

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
        }

        dispatch(outcomeEvent);
    }
}

// We can't send messages to a new group until the group has been confirmed at which point we will receive the chatId.
// So we only signal the 'requestEvent', the reducer will then add the message to the 'unconfirmedMessages' array for
// the chat and those messages will be sent once the chat is confirmed.
function sendMessageToNewGroup(id: Symbol, sendMessageContent: SendMessageContent) {
    return (dispatch: Dispatch<any>) => {
        const [content] = handleMessageContent(sendMessageContent, dispatch);

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

function handleMessageContent(sendMessageContent: SendMessageContent, dispatch: Dispatch<any>) : [MessageContent, Option<Promise<boolean>>] {
    let content: MessageContent;
    if (sendMessageContent.kind === "media") {
        let blobId = uuidv1().toString();

        content = {
            kind: sendMessageContent.kind,
            caption: sendMessageContent.caption,
            mimeType: sendMessageContent.mimeType,
            blobId,
            blobSize: sendMessageContent.blob.length,
            chunkSize: CHUNK_SIZE_BYTES
        };

        const putDataAsync: () => Promise<PutDataOutcome> = () => dispatch(putData(blobId, sendMessageContent.blob)) as any;

        return [content, putDataAsync().then(r => r.type === "PUT_DATA_SUCCEEDED")];
    } else if (sendMessageContent.kind === "text") {
        return [sendMessageContent, null];
    } else {
        throw Error("Unrecognised content type");
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

export type SendMessageFailedToUploadContentEvent = {
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
