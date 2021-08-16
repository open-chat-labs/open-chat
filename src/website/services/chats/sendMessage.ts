import { ChatId, ConfirmedChat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { MessageContent, ReplyContext } from "../../domain/model/messages";
import { chatFromCandid } from "../candidConverters/chat";
import { toCandid as messagePayloadToCandid } from "../candidConverters/messageContent";
import { toCandid as replyContextToCandid } from "../candidConverters/replyContext";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import CanisterClientFactory from "../CanisterClientFactory";
import { toHttpError, HttpError } from "../../errors/httpError";

export default async function(chatId: ChatId, senderName: Option<string>, clientMessageId: string, content: MessageContent, repliesTo: Option<ReplyContext>) : Promise<SendMessageResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const candidRequest = {
        chat_id: chatId,
        sender_name: optionToCandid(senderName),
        client_message_id: clientMessageId,
        content: messagePayloadToCandid(content),
        replies_to: replyContextToCandid(repliesTo)
    }

    let response;    
    try {
        response = await client.send_message(candidRequest);
    } catch (e) {
        return toHttpError(e as Error);        
    }

    if ("Success" in response) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chat: chatFromCandid(success.chat_summary),
                messageId: success.message_id,
                date: timestampToDate(success.timestamp),
            }
        };
    } else if ("ChatNotFound" in response) {
        return { kind: "chatNotFound" };
    } else if ("SenderBlocked" in response) {
        return { kind: "senderBlocked" };
    } else if ("RecipientBlocked" in response) {
        return { kind: "recipientBlocked" };
    } else {
        throw new Error("Unrecognised 'send_message' response");
    }
}

export type SendMessageResponse =
    Success |
    ChatNotFound | 
    SenderBlocked |
    RecipientBlocked|
    HttpError;

export type Success = {
    kind: "success",
    result: SendMessageResult
}

export type ChatNotFound = {
    kind: "chatNotFound"
}

export type SendMessageResult = {
    chat: ConfirmedChat,
    messageId: number,
    date: Date,
}

export type SenderBlocked = {
    kind: "senderBlocked"
}

export type RecipientBlocked = {
    kind: "recipientBlocked"
}
