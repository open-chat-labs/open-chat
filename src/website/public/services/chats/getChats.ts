import canister from "ic:canisters/chats";
import { ConfirmedChat, DirectChat, GroupChat } from "../../model/chats";
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

function convertToDirectChat(value: any) : DirectChat {
    const latestMessage = value.latest_messages[0];
    return {
        kind: "direct",
        them: userIdFromCandid(value.them),
        chatId: chatIdFromCandid(value.id),
        updatedDate: timestampToDate(value.updated_date),
        readUpTo: latestMessage.id - value.unread,
        latestKnownMessageId: latestMessage.id,
        messagesToDownload: [],
        messagesDownloading: [],
        confirmedMessages: value.latest_messages.reverse().map(localMessageFromCandid),
        unconfirmedMessages: []
    };
}

function convertToGroupChat(value: any) : GroupChat
{
    const latestMessageId = value.latest_messages.length > 0 ? value.latest_messages[0].id : 0;
    return {
        kind: "group",
        chatId: chatIdFromCandid(value.id),
        subject: value.subject,
        updatedDate: timestampToDate(value.updated_date),
        participants: value.participants.map(userIdFromCandid),
        readUpTo: latestMessageId - value.unread,
        latestKnownMessageId: latestMessageId,
        messagesToDownload: [],
        messagesDownloading: [],
        confirmedMessages: value.latest_messages.reverse().map(localMessageFromCandid),
        unconfirmedMessages: []
    };
}


