import canister from "ic:canisters/chats";
import { UserId } from "../../model/users";
import { ChatId } from "../../model/chats";
import { fromCandid as chatIdFromCandid } from "../candidConverters/chatId";
import { fromCandid as dateFromCandid } from "../candidConverters/date";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(userId: UserId, message: string) : Promise<SendDirectMessageResponse> {
    let response = await canister.send_direct_message(userIdToCandid(userId), message);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chatId: chatIdFromCandid(success.chat_id),
                messageId: success.message_id,
                date: dateFromCandid(success.timestamp)
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
