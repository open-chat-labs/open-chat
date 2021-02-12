import { Dispatch } from "react";
import { v1 as uuidv1 } from "uuid";
import chatsService from "../../services/chats/service";
import { Chat, ConfirmedChat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { LocalMessage, MessageContent, SendMessageContent } from "../../domain/model/messages";
import { RootState } from "../../reducers";
import putData, { PutDataOutcome, PUT_DATA_FAILED } from "../data/putData";
import {
    CHUNK_SIZE_BYTES,
    CONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_GROUP_CHAT
} from "../../constants";

export const SEND_MESSAGE_REQUESTED = "SEND_MESSAGE_REQUESTED";
export const SEND_MESSAGE_SUCCEEDED = "SEND_MESSAGE_SUCCEEDED";
export const SEND_MESSAGE_FAILED = "SEND_MESSAGE_FAILED";
export const SEND_MESSAGE_CONTENT_UPLOAD_FAILED = "SEND_MESSAGE_CONTENT_UPLOAD_FAILED";

export default function(chat: Chat, sendMessageContent: SendMessageContent) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const clientMessageId = uuidv1().toString();

        // If the "send message content" is media the message itself will contain
        // meta info about the media and the data will be uploaded separately in parallel
        const content = convertContent(sendMessageContent);

        // Start uploading the media data
        let uploadContentTask: Option<Promise<PutDataOutcome>> = null;
        if ("id" in content && "data" in sendMessageContent) {
            const putDataAsync: () => Promise<PutDataOutcome> = () => dispatch(putData(content.id, sendMessageContent.data, sendMessageContent.mimeType)) as any;
            uploadContentTask = putDataAsync();
        }

        // Dispatch the message requested event - this will put the message in the chat
        {
            const requestEvent: SendMessageRequestedEvent = {
                type: SEND_MESSAGE_REQUESTED,
                payload: {
                    chat,
                    clientMessageId,
                    content
                }
            };
            dispatch(requestEvent);
        }

        // We can't send messages to a new group until the group has been confirmed at which point we will receive the chatId.
        // So we only signal the 'requestEvent', the reducer will then add the message to the 'unconfirmedMessages' array for
        // the chat and those messages will be sent once the chat is confirmed.
        if (chat.kind === UNCONFIRMED_GROUP_CHAT) {
            return;
        }

        // Wait for the media data to finish uploading
        if (content.kind === "media" || content.kind === "file") {
            let outcomeEvent = await uploadContentTask;	
            if (outcomeEvent?.type === PUT_DATA_FAILED) {
                dispatch ({ type: SEND_MESSAGE_CONTENT_UPLOAD_FAILED });
                return;
            }
        }

        // Send the message to the IC
        const response = chat.kind === UNCONFIRMED_DIRECT_CHAT || (chat.kind === CONFIRMED_DIRECT_CHAT && sendMessageContent.kind === "cycles")
            ? await chatsService.sendDirectMessage(chat.them, clientMessageId, content)
            : await chatsService.sendMessage(chat.chatId, clientMessageId, content);

        if (response.kind !== "success") {
            // Dispatch a failed event
            dispatch ({ type: SEND_MESSAGE_FAILED,  payload: { content } } as SendMessageFailedEvent);
            return;
        }

        // Dispatch a succeeded event
        {
            const myUserId = getState().usersState.me!.userId;
            const message: LocalMessage = {
                kind: "local",
                id: response.result.messageId,
                clientMessageId,
                date: response.result.date,
                sender: myUserId,
                content
            };
            const chat: ConfirmedChat = response.result.chat;
            chat.messages.push(message);

            dispatch({
                type: SEND_MESSAGE_SUCCEEDED,
                payload: chat
            } as SendMessageSucceededEvent);
        }
    }
}

function convertContent(sendMessageContent: SendMessageContent): MessageContent {
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
                chunkSize: CHUNK_SIZE_BYTES
            };
        case "file":
            return {
                kind: sendMessageContent.kind,
                name: sendMessageContent.name,
                mimeType: sendMessageContent.mimeType,
                id: uuidv1().toString(),
                size: sendMessageContent.data.length,
                chunkSize: CHUNK_SIZE_BYTES
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
    payload: ConfirmedChat
}

export type SendMessageFailedEvent = {
    type: typeof SEND_MESSAGE_FAILED,
    payload: SendMessageFailed
}

export type SendMessageFailedToUploadContentEvent = {
    type: typeof SEND_MESSAGE_FAILED
}

export type SendMessageRequest = {
    chat: Chat,
    clientMessageId: string,
    content: MessageContent
}

export type SendMessageFailed = {
    content: MessageContent
}
