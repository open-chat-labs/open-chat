import type { ChatSummary, UpdatesResponse, MessagesResponse } from "../../domain/chat/chat";

export interface IUserClient {
    getChats(since: bigint): Promise<UpdatesResponse>;
    chatMessages(userId: string, fromIndex: number, toIndex: number): Promise<MessagesResponse>;
    updateChats(chats: ChatSummary[]): Promise<UpdatesResponse>;
}
