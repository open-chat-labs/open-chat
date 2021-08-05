import { ConfirmedChat } from "../../domain/model/chats";
import { Option, Timestamp } from "../../domain/model/common";
import { chatFromCandid } from "../candidConverters/chat";
import { fromCandid as userIdFromCandid } from "../candidConverters/userId";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { fromCandid as timestampFromCandid, toCandid as timestampToCandid } from "../candidConverters/timestamp";
import CanisterClientFactory from "../CanisterClientFactory";
import { toHttpError, HttpError } from "../../errors/httpError";
import { UserId } from "../../domain/model/users";

export default async function(request: GetUpdatesRequest) : Promise<GetUpdatesResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const canisterRequest = {
        updated_since: optionToCandid(request.updatedSince ? timestampToCandid(request.updatedSince) : null),
        message_count_for_top_chat: optionToCandid(request.messageCountForTopChat)
    };

    let response;    
    try {
        response = await client.get_updates(canisterRequest);
    } catch (e) {
        return toHttpError(e as Error);        
    }

    if ("Success" in response) {
        const success = response.Success;
        const chats = success.chats.map(chatFromCandid);
        let latestUpdateTimestamp: Option<Timestamp> = null;
        if (success.chats.length) {
            const latestChat = success.chats[0];
            latestUpdateTimestamp = timestampFromCandid("Direct" in latestChat
                ? latestChat.Direct.last_updated
                : latestChat.Group.last_updated);
        }
        const blockedUsers = success.blocked_users.map(userIdFromCandid);

        return {
            kind: "success",
            chats,
            blockedUsers,
            latestUpdateTimestamp,
        };
    } else {
        throw new Error("Unrecognised 'get_chats' response");
    }
}

export type GetUpdatesRequest = {
    updatedSince: Option<Timestamp>,
    messageCountForTopChat: Option<number>
};

export type GetUpdatesResponse =
    Success | HttpError;

export type Success = {
    kind: "success",
    chats: ConfirmedChat[],
    blockedUsers: UserId[]
    latestUpdateTimestamp: Option<Timestamp>,
}
