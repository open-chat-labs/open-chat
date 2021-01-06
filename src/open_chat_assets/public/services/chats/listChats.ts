import canister from "ic:canisters/chats";
import { Chat, DirectChat, GroupChat } from "../../model/chats";
import { Option } from "../../model/common";
import { ConfirmedMessage, Message } from "../../model/messages";
import { convertToOption } from "../option";

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
        chatId: value.chat_id,
        updatedDate: latestMessage.timestamp,
        latestMessageId: latestMessage.id,
        readUpTo: latestMessage.id - value.unread,
        confirmedOnServerUpTo: latestMessage.id,
        missingMessages: new Set<number>(),
        missingMessagesRequested: new Set<number>(),
        messages: [{ kind: "confirmed", ...latestMessage }]
    };
}

function convertToGroupChat(value: any) : GroupChat
{
    const messages = [] as Message[];
    const latestMessage: Option<any> = convertToOption(value.latest_message);
    if (latestMessage) {
        messages.push(convertToConfirmedMessage(latestMessage));
    }
    const latestMessageId = latestMessage ? latestMessage.id : 0;

    return {
        kind: "group",
        chatId: value.id,
        subject: value.subject,
        updatedDate: value.updated_date,
        participants: value.participants,
        latestMessageId: latestMessageId,
        readUpTo: latestMessageId - value.unread,
        confirmedOnServerUpTo: latestMessageId,
        missingMessages: new Set<number>(),
        missingMessagesRequested: new Set<number>(),
        messages: messages
    };
}

function convertToConfirmedMessage(value: any) : ConfirmedMessage {
    return { kind: "confirmed", ...value };
}
