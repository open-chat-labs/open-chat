import { UserId } from "../../domain/model/users";
import { ChatId } from "../../domain/model/chats";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, userId: UserId) : Promise<RemoveParticipantResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.remove_participant(chatId, userIdToCandid(userId));

    if ("Success" in response) {
        return RemoveParticipantResponse.Success;
    } else if ("Unauthorized" in response) {
        return RemoveParticipantResponse.Unauthorized;
    } else if ("ParticipantNotFound" in response) {
        return RemoveParticipantResponse.ParticipantNotFound;
    } else if ("CannotRemoveSelfFromChat" in response) {
        return RemoveParticipantResponse.CannotRemoveSelfFromChat;
    } else if ("ChatNotFound" in response) {
        return RemoveParticipantResponse.ChatNotFound;
    } else if ("NotGroupChat" in response) {
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