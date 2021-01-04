import canister from "ic:canisters/chats";
import {UserId} from "../../model/users";
import {ChatId} from "../../model/chats";
import {Timestamp} from "../../model/common";

export default async function(userId: UserId, message: string) : Promise<SendDirectMessageResponse> {
    let response = await canister.send_direct_message(userId, message);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chatId: success.chat_id,
                messageId: success.message_id,
                timestamp: success.timestamp
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
    timestamp: Timestamp
}
