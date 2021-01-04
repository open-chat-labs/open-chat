import canister from "ic:canisters/chats";
import {UserId} from "../../model/users";
import {Timestamp} from "../../model/common";

export default async function(userId: UserId, message: string) : Promise<SendMessageResponse> {
    let response = await canister.send_message(userId, message);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                messageId: success.message_id,
                timestamp: success.timestamp
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
