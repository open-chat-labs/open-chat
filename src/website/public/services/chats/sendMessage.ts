import canister from "ic:canisters/chats";
import { ChatId } from "../../model/chats";
import { Timestamp } from "../../model/common";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { fromCandid as timestampFromCandid } from "../candidConverters/timestamp";

export default async function(chatId: ChatId, message: string) : Promise<SendMessageResponse> {
    let response = await canister.send_message(chatIdToCandid(chatId), message);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                messageId: success.message_id,
                timestamp: timestampFromCandid(success.timestamp)
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
    messageId: number,
    timestamp: Timestamp
}
