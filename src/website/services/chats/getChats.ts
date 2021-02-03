import canister from "ic:canisters/chats";
import * as chatFunctions from "../../model/chats";
import { ConfirmedChat, ConfirmedDirectChat, ConfirmedGroupChat } from "../../model/chats";
import { Option, Timestamp } from "../../model/common";
import { fromCandid as chatIdFromCandid } from "../candidConverters/chatId";
import { fromCandid as localMessageFromCandid } from "../candidConverters/localMessage";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { fromCandid as timestampFromCandid, toCandid as timestampToCandid, toDate as timestampToDate } from "../candidConverters/timestamp";
import { fromCandid as userIdFromCandid } from "../candidConverters/userId";

export default async function(request: GetChatsRequest) : Promise<GetChatsResponse> {
    const canisterRequest = {
        updated_since: optionToCandid(request.updatedSince ? timestampToCandid(request.updatedSince) : null),
        message_count_for_top_chat: optionToCandid(request.messageCountForTopChat)
    };

    let response = await canister.get_chats(canisterRequest);

    if (response.hasOwnProperty("Success")) {
        const success = response.Success;
        const chats = success.map(convertToChat);
        let latestUpdateTimestamp: Option<Timestamp> = null;
        if (success.length) {
            const latestChat = success[0];
            latestUpdateTimestamp = timestampFromCandid(latestChat.hasOwnProperty("Direct")
                ? latestChat.Direct.updated_date
                : latestChat.Group.updated_date);
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

function convertToChat(value: any) : ConfirmedChat {
    if (value.hasOwnProperty("Direct")) {
        return convertToDirectChat(value.Direct);
    } else if (value.hasOwnProperty("Group")) {
        return convertToGroupChat(value.Group);
    } else {
        throw new Error("Unable to convert value to Chat");
    }
}

function convertToDirectChat(value: any) : ConfirmedDirectChat {
    return chatFunctions.newConfirmedDirectChat(
        chatIdFromCandid(value.id),
        userIdFromCandid(value.them),
        timestampToDate(value.updated_date),
        value.latest_messages.reverse().map(localMessageFromCandid),
        convertRangeSetToArray(value.unread_message_id_ranges));
}

function convertToGroupChat(value: any) : ConfirmedGroupChat {
    return chatFunctions.newConfirmedGroupChat(
        chatIdFromCandid(value.id),
        value.subject,
        value.participants.map(userIdFromCandid),
        timestampToDate(value.updated_date),
        value.latest_messages.reverse().map(localMessageFromCandid),
        convertRangeSetToArray(value.unread_message_id_ranges));
}

function convertRangeSetToArray(rangeSet: number[][]) : number[] {
    const array = [];
    for (const range of rangeSet) {
        for (let i = range[0]; i <= range[1]; i++) {
            array.push(i);
        }
    }
    return array;
}


