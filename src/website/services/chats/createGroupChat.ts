import { ChatId, ConfirmedGroupChat } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";
import { groupChatFromCandid } from "../candidConverters/chat";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, subject: string, users: UserId[], chatHistoryVisibleToNewJoiners: boolean) : Promise<CreateGroupChatResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const candidUserIds = users.map(userIdToCandid);

    const canisterRequest = {
        chat_id: chatId,
        subject,
        participants: candidUserIds,
        chat_history_visible_to_new_joiners: chatHistoryVisibleToNewJoiners
    };

    const response = await client.create_group_chat(canisterRequest);

    if ("Success" in response) {
        let success = response.Success;
        return {
            kind: "success",
            result: groupChatFromCandid(success)
        };
    } else if ("ChatAlreadyExists" in response) {
        return {
            kind: "chatAlreadyExists"
        };
    } else if ("SubjectTooShort" in response) {
        return {
            kind: "subjectTooShort",
            result: response.SubjectTooShort
        };
    } else if ("SubjectTooLong" in response) {
        return {
            kind: "subjectTooLong",
            result: response.SubjectTooLong
        };
    } else if ("TooManyParticipants" in response) {
        return {
            kind: "tooManyParticipants",
            result: response.TooManyParticipants
        };
    } else {
        throw new Error("Unrecognised 'create_group_chat' response");
    }
}

export type CreateGroupChatResponse =
    Success |
    ChatAlreadyExists |
    SubjectTooShort |
    SubjectTooLong |
    TooManyParticipants;

export type Success = {
    kind: "success",
    result: ConfirmedGroupChat
}

export type ChatAlreadyExists = {
    kind: "chatAlreadyExists"
}

export type SubjectTooShort = {
    kind: "subjectTooShort",
    result: number
}

export type SubjectTooLong = {
    kind: "subjectTooLong",
    result: number
}

export type TooManyParticipants = {
    kind: "tooManyParticipants",
    result: number
}
