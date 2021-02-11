import canister from "ic:canisters/chats";
import { UserId } from "../../domain/model/users";
import { ChatId } from "../../domain/model/chats";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(chatId: ChatId, users: UserId[]) : Promise<AddParticipantsResponse> {
    const candidChatId = chatIdToCandid(chatId);
    const candidUserIds = users.map(userIdToCandid);

    let response = await canister.add_participants(candidChatId, candidUserIds);

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
