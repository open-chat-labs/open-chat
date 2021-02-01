import canister from "ic:canisters/chats";
import { UserId } from "../../model/users";
import { ChatId } from "../../model/chats";
import { fromCandid as chatIdFromCandid } from "../candidConverters/chatId";
import { toCandid as messagePayloadToCandid } from "../candidConverters/messageContent";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { MessageContent } from "../../model/messages";

export default async function(userId: UserId, content: MessageContent) : Promise<SendDirectMessageResponse> {
    let response = await canister.send_direct_message(userIdToCandid(userId), messagePayloadToCandid(content));

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chatId: chatIdFromCandid(success.chat_id),
                messageId: success.message_id,
                date: timestampToDate(success.timestamp)
            }
        };
    } else {
        throw new Error("Unrecognised 'send_direct_message' response");
    }
}

export type SendDirectMessageResponse =
    Success;

export type Success = {
    kind: "success",
    result: SendDirectMessageResult
}

export type SendDirectMessageResult = {
    chatId: ChatId,
    messageId: number,
    date: Date
}
