import canister from "ic:canisters/chats";
import { ChatId } from "../../model/chats";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";

export default async function(chatId: ChatId, upToIndex: number) : Promise<MarkReadResponse> {
    let response = await canister.mark_read(chatIdToCandid(chatId), upToIndex);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                readUpToId: success.read_up_to_id,
                latestMessageId: success.latest_message_id
            }
        };
    } else if (response.hasOwnProperty("ChatNotFound")) {
        return {
            kind: "chatNotFound"
        };
    } else {
        throw new Error("Unrecognised 'mark_read' response");
    }
}

export type MarkReadResponse =
    Success |
    ChatNotFound;

export type Success = {
    kind: "success",
    result: MarkReadResult
}

export type ChatNotFound = {
    kind: "chatNotFound"
}

export type MarkReadResult = {
    readUpToId: number;
    latestMessageId: number;
}
