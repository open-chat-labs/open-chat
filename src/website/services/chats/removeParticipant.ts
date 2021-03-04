import { UserId } from "../../domain/model/users";
import { ChatId } from "../../domain/model/chats";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, userId: UserId) : Promise<RemoveParticipantResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.remove_participant(chatIdToCandid(chatId), userIdToCandid(userId));

    if (response.hasOwnProperty("Success")) {
        return RemoveParticipantResponse.Success;
    } else if (response.hasOwnProperty("Unauthorized")) {
        return RemoveParticipantResponse.Unauthorized;
    } else if (response.hasOwnProperty("ParticipantNotFound")) {
        return RemoveParticipantResponse.ParticipantNotFound;
    } else if (response.hasOwnProperty("CannotRemoveSelfFromChat")) {
        return RemoveParticipantResponse.CannotRemoveSelfFromChat;
    } else if (response.hasOwnProperty("ChatNotFound")) {
        return RemoveParticipantResponse.ChatNotFound;
    } else if (response.hasOwnProperty("NotGroupChat")) {
        return RemoveParticipantResponse.NotGroupChat;
    } else {
        throw new Error("Unrecognised 'remove_participant' response");
    }
}

export enum RemoveParticipantResponse {
    Success,
    Unauthorized,
    ParticipantNotFound,
    CannotRemoveSelfFromChat,
    ChatNotFound,
    NotGroupChat
}