import canister from "ic:canisters/chats";
import { ConfirmedGroupChat } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";
import { groupChatFromCandid } from "../candidConverters/chat";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(subject: string, users: UserId[]) : Promise<CreateGroupChatResponse> {
    const candidUserIds = users.map(userIdToCandid);

    const response = await canister.create_group_chat(candidUserIds, subject);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: groupChatFromCandid(success)
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
    result: ConfirmedGroupChat
}

export type ChatAlreadyExists = {
    kind: "chatAlreadyExists"
}
