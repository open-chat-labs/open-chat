import canister from "ic:canisters/chats";
import { ChatId, ConfirmedChat } from "../../model/chats";
import { MessageContent } from "../../model/messages";
import { chatFromCandid } from "../candidConverters/chat";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toCandid as messagePayloadToCandid } from "../candidConverters/messageContent";
import { toDate as timestampToDate } from "../candidConverters/timestamp";

export default async function(chatId: ChatId, clientMessageId: string, content: MessageContent) : Promise<SendMessageResponse> {
    let response = await canister.send_message(chatIdToCandid(chatId), clientMessageId, messagePayloadToCandid(content));

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
