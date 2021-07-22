import type { UpdatesResponse, MessagesResponse, UpdateArgs } from "../../domain/chat/chat";

export interface IUserClient {
    getUpdates(args: UpdateArgs): Promise<UpdatesResponse>;
    chatMessages(userId: string, fromIndex: number, toIndex: number): Promise<MessagesResponse>;
}
