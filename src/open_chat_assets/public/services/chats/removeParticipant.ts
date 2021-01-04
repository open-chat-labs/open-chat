import canister from "ic:canisters/chats";
import {UserId} from "../../model/users";
import {ChatId} from "../../model/chats";

export default async function(chatId: ChatId, user: UserId) : Promise<RemoveParticipantResponse> {
    let response = await canister.remove_participant(chatId, user);

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