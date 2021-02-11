import canister from "ic:canisters/chats";
import { ChatId } from "../../domain/model/chats";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toArray as rangeSetToArray } from "../candidConverters/rangeSet";

export default async function(chatId: ChatId, fromId: number, toId: number) : Promise<MarkReadResponse> {
    let response = await canister.mark_read(chatIdToCandid(chatId), fromId, toId);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                unreadMessageIds: rangeSetToArray(success.unread_message_id_ranges)
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
    unreadMessageIds: number[]
}
