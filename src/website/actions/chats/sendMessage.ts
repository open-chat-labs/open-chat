import { Dispatch } from "react";
import { v1 as uuidv1 } from "uuid";
import chatsService from "../../services/chats/service";
import { Chat, ChatId, ConfirmedChat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { LocalMessage, MessageContent, ReplyContext, DraftMessageContent } from "../../domain/model/messages";
import { RootState } from "../../reducers";
import { HttpError } from "../../errors/httpError";
import dataService, { DataSource } from "../../services/data/CachingDataService";
import {
    CHUNK_SIZE_BYTES,
    CONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_GROUP_CHAT
} from "../../constants";
import Stopwatch from "../../utils/Stopwatch";
import { alertDialog } from "../../components/modals/Alert";
import * as chatFunctions from "../../domain/model/chats";

export const SEND_MESSAGE_REQUESTED = "SEND_MESSAGE_REQUESTED";
export const SEND_MESSAGE_SUCCEEDED = "SEND_MESSAGE_SUCCEEDED";
export const SEND_MESSAGE_FAILED = "SEND_MESSAGE_FAILED";
export const SEND_MESSAGE_CONTENT_UPLOAD_FAILED = "SEND_MESSAGE_CONTENT_UPLOAD_FAILED";

export default function (chat: Chat, sendMessageContent: DraftMessageContent, repliesTo: Option<ReplyContext>) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {

        // Don't send a direct message if you block the recipient
        if (chatFunctions.isDirectChat(chat)) {
            const blockedUsers = getState().chatsState.blockedUsers;
            if (blockedUsers.includes(chat.them)) {
                alertDialog({
                    title: "Message not sent",
                    text: "You have blocked this user - you must unblock them before sending a message"
                });
                return;
            }
        }

        const timer = Stopwatch.startNew();
        const clientMessageId = uuidv1().toString();

        // If the "send message content" is media the message itself will contain
        // meta info about the media and the data will be uploaded separately in parallel
        const content = convertContent(sendMessageContent);

        // Start uploading the media data
        let uploadContentTask: Option<Promise<boolean>> = null;
        if ("id" in content && "data" in sendMessageContent) {
            uploadContentTask = dataService.putData(
                sendMessageContent.kind === "media" ? DataSource.MediaMessage : DataSource.FileMessage,
                content.id,
                sendMessageContent.data);
        }

        // Dispatch the message requested event - this will put the message in the chat
        const request: SendMessageRequest = {
            chat,
            clientMessageId,
            content,
            repliesTo
        };
        const requestEvent: SendMessageRequestedEvent = {
            type: SEND_MESSAGE_REQUESTED,
            payload: request
        };
        dispatch(requestEvent);

        // We can't send messages to a new group until the group has been confirmed at which point we will receive the chatId.
        // So we only signal the 'requestEvent', the reducer will then add the message to the 'unconfirmedMessages' array for
        // the chat and those messages will be sent once the chat is confirmed.
        if (chat.kind === UNCONFIRMED_GROUP_CHAT) {
            return;
        }

        // Wait for the media data to finish uploading
        if (uploadContentTask && !await uploadContentTask) {
            dispatch({ type: SEND_MESSAGE_CONTENT_UPLOAD_FAILED });
            return;
        }

        const me = getState().usersState.me!;
        
        // Send the message to the IC
        const response = chat.kind === UNCONFIRMED_DIRECT_CHAT || (chat.kind === CONFIRMED_DIRECT_CHAT && sendMessageContent.kind === "cycles")
            ? await chatsService.sendDirectMessage(chat.them, me.username, clientMessageId, content, repliesTo)
            : await chatsService.sendMessage(chat.chatId, me.username, clientMessageId, content, repliesTo);

        if (response.kind !== "success") {
            // Dispatch a failed event
            dispatch({
                type: SEND_MESSAGE_FAILED,
                payload: {
                    chatId: chat.chatId,
                    clientMessageId
                },
                httpError: response.kind === "httpError" ? response : undefined
            } as SendMessageFailedEvent);

            if (response.kind !== "httpError") {
                let text;
                switch (response.kind) {
                    case "userNotFound":
                        text = "User not found";
                        break;
                    case "recipientNotFound":
                        text = "Recipient not found";
                        break;
                    case "chatNotFound":
                        text = "Chat not found";
                        break;
                    case "balanceExceeded":
                        text = "Balance exceeded";
                        break;
                    case "senderBlocked":
                        text = "You are blocked from sending messages to this user";
                        break;
                    case "recipientBlocked":
                        text = "You have blocked this user - you must unblock them before sending a message";
                        break;
                }

                alertDialog({
                    title: "Message not sent",
                    text
                });
            }
            return;
        }

        // Dispatch a succeeded event
        {
            const myUserId = me.userId;
            const message: LocalMessage = {
                kind: "local",
                id: response.result.messageId,
                clientMessageId,
                date: response.result.date,
                sender: myUserId,
                content,
                repliesTo
            };
            const chat: ConfirmedChat = response.result.chat;
            chat.messages.push(message);

            dispatch({
                type: SEND_MESSAGE_SUCCEEDED,
                payload: {
                    request,
                    chat,
                    durationMs: timer.getElapsedMs()
                }
            } as SendMessageSucceededEvent);
        }
    }
}

function convertContent(sendMessageContent: DraftMessageContent): MessageContent {
    switch (sendMessageContent.kind) {
        case "media":
            return {
                kind: sendMessageContent.kind,
                caption: sendMessageContent.caption,
                mimeType: sendMessageContent.mimeType,
                width: sendMessageContent.width,
                height: sendMessageContent.height,
                id: uuidv1().toString(),
                size: sendMessageContent.data.length,
                chunkSize: CHUNK_SIZE_BYTES,
                blobUrl: sendMessageContent.blobUrl,
                thumbnailData: sendMessageContent.thumbnailData,
                blobDeleted: false
            };
        case "file":
            return {
                kind: sendMessageContent.kind,
                caption: sendMessageContent.caption,
                name: sendMessageContent.name,
                mimeType: sendMessageContent.mimeType,
                id: uuidv1().toString(),
                size: sendMessageContent.data.length,
                chunkSize: CHUNK_SIZE_BYTES,
                blobDeleted: false
            };
        case "text":
        case "cycles":
            return sendMessageContent;
        default:
            throw Error("Unrecognised content type");
    }
}

export type SendMessageRequestedEvent = {
    type: typeof SEND_MESSAGE_REQUESTED,
    payload: SendMessageRequest
}

export type SendMessageSucceededEvent = {
    type: typeof SEND_MESSAGE_SUCCEEDED,
    payload: {
        request: SendMessageRequest,
        chat: ConfirmedChat,
        durationMs: number
    }
}

export type SendMessageFailedEvent = {
    type: typeof SEND_MESSAGE_FAILED,
    payload: SendMessageFailed,
    httpError?: HttpError
}

export type SendMessageFailedToUploadContentEvent = {
    type: typeof SEND_MESSAGE_FAILED
}

export type SendMessageRequest = {
    chat: Chat,
    clientMessageId: string,
    content: MessageContent,
    repliesTo: Option<ReplyContext>
}

export type SendMessageFailed = {
    chatId: ChatId,
    clientMessageId: string
}
