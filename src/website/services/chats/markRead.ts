import { ChatId } from "../../domain/model/chats";
import { toArray as rangeSetToArray } from "../candidConverters/rangeSet";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, fromId: number, toId: number) : Promise<MarkReadResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.mark_read(chatId, fromId, toId);

    if ("Success" in response) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                unreadMessageIds: rangeSetToArray(success.unread_message_id_ranges)
            }
        };
    } else if ("ChatNotFound" in response) {
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
