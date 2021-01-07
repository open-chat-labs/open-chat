import canister from "ic:canisters/chats";
import { ConfirmedChat, DirectChat, GroupChat } from "../../model/chats";
import { Option } from "../../model/common";
import { LocalMessage, Message } from "../../model/messages";
import { convertToOption } from "../option";

export default async function(request: GetChatsRequest) : Promise<GetChatsResponse> {
    let response = await canister.get_chats(request);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            chats: success.map(convertToChat)
        };
    } else {
        throw new Error("Unrecognised 'get_chats' response");
    }
}

export type GetChatsRequest = {
    unread_only: boolean,
    message_count_for_top_chat: Option<number>
};

export type GetChatsResponse =
    Success;

export type Success = {
    kind: "success",
    chats: ConfirmedChat[]
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
    let latestMessage = value.latest_messages[0];
    return {
        kind: "direct",
        them: value.them,
        chatId: value.id,
        updatedDate: latestMessage.timestamp,
        readUpTo: latestMessage.id - value.unread,
        confirmedOnServerUpTo: latestMessage.id,
        messagesToDownload: [],
        messagesDownloading: [],
        messages: value.latest_messages.map(convertToLocalMessage)
    };
}

function convertToGroupChat(value: any) : GroupChat
{
    const latestMessageId = value.latest_messages.count > 0 ? value.latest_messages[0].id : 0;

    return {
        kind: "group",
        chatId: value.id,
        subject: value.subject,
        updatedDate: value.updated_date,
        participants: value.participants,
        readUpTo: latestMessageId - value.unread,
        confirmedOnServerUpTo: latestMessageId,
        messagesToDownload: [],
        messagesDownloading: [],
        messages: value.latest_messages.map(convertToLocalMessage)
    };
}

function convertToLocalMessage(value: any) : LocalMessage {
    return { kind: "local", ...value };
}
