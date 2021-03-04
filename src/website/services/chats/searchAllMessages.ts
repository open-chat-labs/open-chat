import { ChatId } from "../../domain/model/chats";
import { LocalMessage } from "../../domain/model/messages";
import { fromCandid as chatIdFromCandid } from "../candidConverters/chatId";
import { fromCandid as messageFromCandid } from "../candidConverters/localMessage";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(searchTerm: string, maxResults: number) : Promise<SearchAllMessagesResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.search_all_messages(searchTerm, maxResults);

    if (response.hasOwnProperty("Success")) {
        const success = response.Success;
        return {
            kind: "success",
            result: {
                matches: success.matches.map((m: any) => ({
                    chatId: chatIdFromCandid(m.chat_id),
                    message: messageFromCandid(m.message)
                }))
            }
        };
    } else {
        throw new Error("Unrecognised 'search_all_messages' response");
    }
}

export type SearchAllMessagesResponse =
    Success;

export type Success = {
    kind: "success",
    result: SearchAllMessagesResult
}

export type SearchAllMessagesResult = {
    matches: Match[]
}

export type Match = {
    chatId: ChatId,
    message: LocalMessage
}
