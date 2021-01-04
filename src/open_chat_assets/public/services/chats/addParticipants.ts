import canister from "ic:canisters/chats";
import {UserId} from "../../model/users";
import {ChatId} from "../../model/chats";

export default async function(chatId: ChatId, users: UserId[]) : Promise<AddParticipantsResponse> {
    let response = await canister.add_participants(chatId, users);

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
