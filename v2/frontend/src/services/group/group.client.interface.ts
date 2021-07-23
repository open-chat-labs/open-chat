import type { MessagesResponse } from "../../domain/chat/chat";

export interface IGroupClient {
    chatMessages(fromIndex: number, toIndex: number): Promise<MessagesResponse>;
}
