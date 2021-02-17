import canister from "ic:canisters/chats";
import { ConfirmedDirectChat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { MessageContent, ReplyContext } from "../../domain/model/messages";
import { UserId } from "../../domain/model/users";
import { toCandid as messagePayloadToCandid } from "../candidConverters/messageContent";
import { toCandid as replyContextToCandid } from "../candidConverters/replyContext";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { directChatFromCandid } from "../candidConverters/chat";

export default async function(userId: UserId, clientMessageId: string, content: MessageContent, repliesTo: Option<ReplyContext>) : Promise<SendDirectMessageResponse> {
    const canisterRequest = {
        user_id: userIdToCandid(userId),
        client_message_id: clientMessageId,
        content: messagePayloadToCandid(content),
        replies_to: replyContextToCandid(repliesTo)
    }
    const response = await canister.send_direct_message(canisterRequest);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chat: directChatFromCandid(success.chat_summary),
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
    chat: ConfirmedDirectChat,
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
