import canister from "ic:canisters/chats";
import { UserId } from "../../model/users";
import { ChatId } from "../../model/chats";
import { fromCandid as chatIdFromCandid } from "../candidConverters/chatId";
import { toCandid as messagePayloadToCandid } from "../candidConverters/messageContent";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { MessageContent } from "../../model/messages";

export default async function(userId: UserId, clientMessageId: string, content: MessageContent) : Promise<SendDirectMessageResponse> {
    let response = await canister.send_direct_message(userIdToCandid(userId), clientMessageId, messagePayloadToCandid(content));

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
    } else if (response.hasOwnProperty("UserNotFound")) {
        return { kind: "userNotFound" };
    } else if (response.hasOwnProperty("RecipientNotFound")) {
        return { kind: "recipientNotFound" };
    } else if (response.hasOwnProperty("BalanceExceeded")) {
        return { kind: "balanceExceeded" };
    } else {
        throw new Error("Unrecognised 'send_direct_message' response");
    }
}

export type SendDirectMessageResponse =
    Success |
    UserNotFound |
    RecipientNotFound |
    BalanceExceeded;

export type Success = {
    kind: "success",
    result: SendDirectMessageResult
}

export type SendDirectMessageResult = {
    chatId: ChatId,
    messageId: number,
    date: Date
}

export type UserNotFound = {
    kind: "userNotFound"
}

export type RecipientNotFound = {
    kind: "recipientNotFound"
}

export type BalanceExceeded = {
    kind: "balanceExceeded"
}
