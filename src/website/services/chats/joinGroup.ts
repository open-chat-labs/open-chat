import { ChatId } from "../../domain/model/chats";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId) : Promise<JoinGroupResult> {
    const client = CanisterClientFactory.current!.chatsClient;

    const response = await client.join_group(chatId);
    
    if ("Success" in response) {
        return JoinGroupResult.Success;
    } else if ("AlreadyInGroup" in response) {
        return JoinGroupResult.AlreadyInGroup;
    } else if ("UserLimitReached" in response) {
        return JoinGroupResult.UserLimitReached;
    } else if ("ChatNotFound" in response) {
        return JoinGroupResult.ChatNotFound;
    } else if ("NotGroupChat" in response) {
        return JoinGroupResult.NotGroupChat;
    } else {
        throw new Error("Unrecognised 'join_group' response");
    }
}

export enum JoinGroupResult {
    Success,
    AlreadyInGroup,
    UserLimitReached,
    ChatNotFound,
    NotGroupChat
}