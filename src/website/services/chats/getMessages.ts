import { ChatId } from "../../domain/model/chats";
import { LocalMessage } from "../../domain/model/messages";
import { fromCandid as localMessageFromCandid } from "../candidConverters/localMessage";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(chatId: ChatId, fromId: number, pageSize: number) : Promise<GetMessagesResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.get_messages(chatId, fromId, pageSize);
    return handleResponse(response);
}

export async function getMessagesById(chatId: ChatId, ids: number[]) : Promise<GetMessagesResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.get_messages_by_id(chatId, ids);
    return handleResponse(response);
}

function handleResponse(response: any) : GetMessagesResponse {
    if ("Success" in response) {
        let success = response.Success;
        return {
            kind: "success",
            result: {
                messages: success.messages.map(localMessageFromCandid),
                latestMessageId: success.latest_message_id
            }
        };
    } else if ("ChatNotFound" in response) {
        return {
            kind: "chatNotFound"
        };
    } else {
        throw new Error("Unrecognised 'get_messages' response");
    }
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
