import { ConfirmedChat } from "../../domain/model/chats";
import { Option, Timestamp } from "../../domain/model/common";
import { chatFromCandid } from "../candidConverters/chat";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { fromCandid as timestampFromCandid, toCandid as timestampToCandid } from "../candidConverters/timestamp";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(request: GetChatsRequest) : Promise<GetChatsResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const canisterRequest = {
        updated_since: optionToCandid(request.updatedSince ? timestampToCandid(request.updatedSince) : null),
        message_count_for_top_chat: optionToCandid(request.messageCountForTopChat)
    };
    const response = await client.get_chats(canisterRequest);

    if (response.hasOwnProperty("Success")) {
        const success = response.Success;
        const chats = success.map(chatFromCandid);
        let latestUpdateTimestamp: Option<Timestamp> = null;
        if (success.length) {
            const latestChat = success[0];
            latestUpdateTimestamp = timestampFromCandid(latestChat.hasOwnProperty("Direct")
                ? latestChat.Direct.last_updated
                : latestChat.Group.last_updated);
        }

        return {
            kind: "success",
            chats,
            latestUpdateTimestamp
        };
    } else {
        throw new Error("Unrecognised 'get_chats' response");
    }
}

export type GetChatsRequest = {
    updatedSince: Option<Timestamp>,
    messageCountForTopChat: Option<number>
};

export type GetChatsResponse =
    Success;

export type Success = {
    kind: "success",
    chats: ConfirmedChat[],
    latestUpdateTimestamp: Option<Timestamp>
}



