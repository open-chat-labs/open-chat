import canister from "ic:canisters/chats";
import {ChatId} from "../../model/chats";
import {ConfirmedMessage} from "../../model/messages";

export default async function(chatId: ChatId, fromId: number, pageSize: number) : Promise<GetMessagesResponse> {
    let response = await canister.get_messages(chatId, fromId, pageSize);
    return handleResponse(response);
}

export async function getMessagesById(chatId: ChatId, ids: number[]) : Promise<GetMessagesResponse> {
    let response = await canister.get_messages_by_id(chatId, ids);
    return handleResponse(response);
}

function handleResponse(response: any) : GetMessagesResponse {
    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                messages: success.messages.map(convertToConfirmedMessage),
                latestMessageId: success.latest_message_id
            }
        };
    } else if (response.hasOwnProperty("ChatNotFound")) {
        return {
            kind: "chatNotFound"
        };
    } else {
        throw new Error("Unrecognised 'get_messages' response");
    }
}

export function convertToConfirmedMessage(value: any) : ConfirmedMessage {
    return { kind: "confirmed", ...value };
}

export type GetMessagesResponse =
    Success |
    ChatNotFound;

export type Success = {
    kind: "success",
    result: GetMessagesResult
}

export type ChatNotFound = {
    kind: "chatNotFound"
}

export type GetMessagesResult = {
    messages: ConfirmedMessage[],
    latestMessageId: number
}
