import type { GetChatsResponse, GetMessagesResponse } from "../../domain/chat/chat";

export interface IUserClient {
    getChats(since: bigint): Promise<GetChatsResponse>;
    chatMessages(userId: string, fromIndex: number, toIndex: number): Promise<GetMessagesResponse>;
}
