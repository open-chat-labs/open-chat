import { ConfirmedDirectChat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { MessageContent, ReplyContext } from "../../domain/model/messages";
import { UserId } from "../../domain/model/users";
import { toCandid as messagePayloadToCandid } from "../candidConverters/messageContent";
import { toCandid as replyContextToCandid } from "../candidConverters/replyContext";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { directChatFromCandid } from "../candidConverters/chat";
import CanisterClientFactory from "../CanisterClientFactory";
import { HttpError, toHttpError } from "../../errors/httpError";

export default async function(userId: UserId, senderName: Option<string>, clientMessageId: string, content: MessageContent, repliesTo: Option<ReplyContext>) : Promise<SendDirectMessageResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const canisterRequest = {
        recipient: userIdToCandid(userId),
        sender_name: optionToCandid(senderName),
        client_message_id: clientMessageId,
        content: messagePayloadToCandid(content),
        replies_to: replyContextToCandid(repliesTo)
    }

    let response;    
    try {
        response = await client.send_direct_message(canisterRequest);
    } catch (e) {
        return toHttpError(e as Error);        
    }

    if ("Success" in response) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chat: directChatFromCandid(success.chat_summary),
                messageId: success.message_id,
                date: timestampToDate(success.timestamp)
            }
        };
    } else if ("UserNotFound" in response) {
        return { kind: "userNotFound" };
    } else if ("RecipientNotFound" in response) {
        return { kind: "recipientNotFound" };
    } else if ("BalanceExceeded" in response) {
        return { kind: "balanceExceeded" };
    } else if ("SenderBlocked" in response) {
        return { kind: "senderBlocked" };
    } else if ("RecipientBlocked" in response) {
        return { kind: "recipientBlocked" };
    } else {
        throw new Error("Unrecognised 'send_direct_message' response");
    }
}

export type SendDirectMessageResponse =
    Success |
    UserNotFound |
    RecipientNotFound |
    BalanceExceeded | 
    SenderBlocked |
    RecipientBlocked|
    HttpError;

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

export type SenderBlocked = {
    kind: "senderBlocked"
}

export type RecipientBlocked = {
    kind: "recipientBlocked"
}
