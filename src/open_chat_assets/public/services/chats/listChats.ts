import canister from "ic:canisters/chats";
import { Chat, ChatId, DirectChat, GroupChat } from "../../model/chats";
import {ConfirmedMessage, Message} from "../../model/messages";
import {Option} from "../../model/common";
import {convertToOption} from "../option";

export default async function(unreadOnly: boolean) : Promise<ListChatsResponse> {
    let response = await canister.list_chats(unreadOnly);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            chats:  success.map(convertToChat)
        };
    } else {
        throw new Error("Unrecognised 'list_chats' response");
    }
}

export type ListChatsResponse =
    Success;

export type Success = {
    kind: "success",
    chats: Chat[]
}

function convertToChat(value: any) : Chat {
    if (value.hasOwnProperty("Direct")) {
        return convertToDirectChat(value.Direct);
    } else if (value.hasOwnProperty("Group")) {
        return convertToGroupChat(value.Group);
    } else {
        throw new Error("Unable to convert value to Chat");
    }
}

function convertToDirectChat(value: any) : DirectChat {
    let latestMessage = value.latest_message;
    return {
        kind: "direct",
        them: value.them,
        updatedDate: latestMessage.timestamp,
        latestMessageId: latestMessage.id,
        readUpTo: latestMessage.id - value.unread,
        messages: [{ kind: "confirmed", ...latestMessage }]
    }
}

function convertToGroupChat(value: any) : GroupChat
{
    let messages = [] as Message[];
    let latestMessage: Option<any> = convertToOption(value.latest_message);
    if (latestMessage) {
        messages.push(convertToConfirmedMessage(latestMessage));
    }

    return {
        kind: "group",
        chatId: value.id,
        subject: value.subject,
        updatedDate: value.updated_date,
        participants: value.participants,
        latestMessageId: value.latest_message.id,
        readUpTo: value.latest_message.id - value.unread,
        messages: messages
    };
}

function convertToConfirmedMessage(value: any) : ConfirmedMessage {
    return { kind: "confirmed", ...value };
}
