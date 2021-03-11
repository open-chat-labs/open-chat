import { ChatId, ConfirmedGroupChat } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";
import { groupChatFromCandid } from "../candidConverters/chat";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, subject: string, users: UserId[]) : Promise<CreateGroupChatResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const candidUserIds = users.map(userIdToCandid);

    const canisterRequest = {
        chat_id: chatIdToCandid(chatId),
        subject,
        participants: candidUserIds
    };

    const response = await client.create_group_chat(canisterRequest);

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
