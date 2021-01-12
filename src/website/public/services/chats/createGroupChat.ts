import canister from "ic:canisters/chats";
import { UserId } from "../../model/users";
import { ChatId } from "../../model/chats";
import { fromCandid as chatIdFromCandid } from "../candidConverters/chatId";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(subject: string, users: UserId[]) : Promise<CreateGroupChatResponse> {
    const candidUserIds = users.map(userIdToCandid);

    const response = await canister.create_group_chat(subject, candidUserIds);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                chatId: chatIdFromCandid(success.chat_id),
                date: timestampToDate(success.timestamp)
            }
        };
    } else if (response.hasOwnProperty("ChatAlreadyExists")) {
        return {
            kind: "chatAlreadyExists"
        };
    } else {
        throw new Error("Unrecognised 'create_group_chat' response");
    }
}

export type CreateGroupChatResult = {
    chatId: ChatId,
    date: Date
}

export type CreateGroupChatResponse =
    Success |
    ChatAlreadyExists;

export type Success = {
    kind: "success",
    result: CreateGroupChatResult
}

export type ChatAlreadyExists = {
    kind: "chatAlreadyExists"
}
