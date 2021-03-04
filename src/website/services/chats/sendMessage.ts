import { ChatId, ConfirmedChat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { MessageContent, ReplyContext } from "../../domain/model/messages";
import { chatFromCandid } from "../candidConverters/chat";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toCandid as messagePayloadToCandid } from "../candidConverters/messageContent";
import { toCandid as replyContextToCandid } from "../candidConverters/replyContext";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, clientMessageId: string, content: MessageContent, repliesTo: Option<ReplyContext>) : Promise<SendMessageResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const candidRequest = {
        chat_id: chatIdToCandid(chatId),
        client_message_id: clientMessageId,
        content: messagePayloadToCandid(content),
        replies_to: replyContextToCandid(repliesTo)
    }
    const response = await client.send_message(candidRequest);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chat: chatFromCandid(success.chat_summary),
                messageId: success.message_id,
                date: timestampToDate(success.timestamp)
            }
        };
    } else if (response.hasOwnProperty("ChatNotFound")) {
        return {
            kind: "chatNotFound"
        };
    } else {
        throw new Error("Unrecognised 'send_message' response");
    }
}

export type SendMessageResponse =
    Success |
    ChatNotFound;

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
    date: Date
}
