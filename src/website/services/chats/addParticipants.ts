import { UserId } from "../../domain/model/users";
import { ChatId } from "../../domain/model/chats";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, users: UserId[]) : Promise<AddParticipantsResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const candidChatId = chatIdToCandid(chatId);
    const candidUserIds = users.map(userIdToCandid);
    const response = await client.add_participants(candidChatId, candidUserIds);

    if (response.hasOwnProperty("Success")) {
        return {
            kind: "success",
            countAdded: response.Success
        };
    } else if (response.hasOwnProperty("Unauthorized")) {
        return {
            kind: "unauthorized"
        };
    } else if (response.hasOwnProperty("ChatNotFound")) {
        return {
            kind: "chatNotFound"
        };
    } else if (response.hasOwnProperty("NotGroupChat")) {
        return {
            kind: "notGroupChat"
        };
    } else {
        throw new Error("Unrecognised 'add_participants' response");
    }
}

export type AddParticipantsResponse =
    Success |
    Unauthorized |
    ChatNotFound |
    NotGroupChat;

export type Success = {
    kind: "success",
    countAdded: number
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
