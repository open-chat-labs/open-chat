import canister from "ic:canisters/chats";
import {UserId} from "../../model/users";
import {ChatId} from "../../model/chats";

export default async function(subject: string, users: UserId[]) : Promise<CreateGroupChatResponse> {
    let response = await canister.create_group_chat(subject, users);

    if (response.hasOwnProperty("Success")) {
        return {
            kind: "success",
            chatId: response.Success
        };
    } else if (response.hasOwnProperty("ChatAlreadyExists")) {
        return {
            kind: "chatAlreadyExists"
        };
    } else {
        throw new Error("Unrecognised 'create_group_chat' response");
    }
}

export type CreateGroupChatResponse =
    Success |
    ChatAlreadyExists;

export type Success = {
    kind: "success",
    chatId: ChatId
}

export type ChatAlreadyExists = {
    kind: "chatAlreadyExists"
}
