import { ChatId } from "../../domain/model/chats";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId) : Promise<LeaveGroupResult> {
    const client = CanisterClientFactory.current!.chatsClient;
    
    const response = await client.leave_group(chatId);

    if ("Success" in response) {
        return LeaveGroupResult.Success;
    } else if ("ParticipantNotFound" in response) {
        return LeaveGroupResult.ParticipantNotFound;
    } else if ("LastAdminCannotLeave" in response) {
        return LeaveGroupResult.LastAdminCannotLeave;
    } else if ("ChatNotFound" in response) {
        return LeaveGroupResult.ChatNotFound;
    } else if ("NotGroupChat" in response) {
        return LeaveGroupResult.NotGroupChat;
    } else {
        throw new Error("Unrecognised 'leave_group' response");
    }
}

export enum LeaveGroupResult {
    Success,
    ParticipantNotFound,
    LastAdminCannotLeave,
    ChatNotFound,
    NotGroupChat
}