import type { GetMessagesResponse } from "../../domain/chat/chat";

export interface IGroupClient {
    chatMessages(fromIndex: number, toIndex: number): Promise<GetMessagesResponse>;
}
