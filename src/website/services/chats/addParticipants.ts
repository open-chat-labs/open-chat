import { UserId } from "../../domain/model/users";
import { ChatId } from "../../domain/model/chats";
import { toCandid as userIdToCandid, fromCandid as userIdFromCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, users: UserId[]) : Promise<AddParticipantsResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const candidUserIds = users.map(userIdToCandid);
    const response = await client.add_participants(chatId, candidUserIds);

    if ("Success" in response) {
        return {
            kind: "success",
            countAdded: response.Success
        };
    } else if ("PartialSuccess" in response) {
        const result = response.PartialSuccess;
        return {
            kind: "partialSuccess",
            countAdded: result.count_added,
            blocked: result.blocked.map(userIdFromCandid)
        };
    } else if ("Unauthorized" in response) {
        return {
            kind: "unauthorized"
        };
    } else if ("ChatNotFound" in response) {
        return {
            kind: "chatNotFound"
        };
    } else if ("NotGroupChat" in response) {
        return {
            kind: "notGroupChat"
        };
    } else {
        throw new Error("Unrecognised 'add_participants' response");
    }
}

export type AddParticipantsResponse =
    Success |
    PartialSuccess |
    Unauthorized |
    ChatNotFound |
    NotGroupChat;

export type Success = {
    kind: "success",
    countAdded: number
}

export type PartialSuccess = {
    kind: "partialSuccess",
    countAdded: number,
    blocked: UserId[]
}

export type Unauthorized = {
    kind: "unauthorized"
}

export type ChatNotFound = {
    kind: "chatNotFound"
}

export type NotGroupChat = {
    kind: "notGroupChat"
}
