import canister from "ic:canisters/chats";
import { ChatId } from "../../model/chats";
import { LocalMessage } from "../../model/messages";
import { toCandid as chatIdToCandid } from "../candidConverters/chatId";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(chatId: ChatId, fromId: number, pageSize: number) : Promise<GetMessagesResponse> {
    let response = await canister.get_messages(chatIdToCandid(chatId), fromId, pageSize);
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
                messages: success.messages.map(convertToLocalMessage),
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

export function convertToLocalMessage(value: any) : LocalMessage {
    return { kind: "local", ...value, sender: userIdToCandid(value.sender) };
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
    messages: LocalMessage[],
    latestMessageId: number
}
