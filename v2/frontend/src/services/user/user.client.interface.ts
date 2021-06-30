import type { ChatSummary } from "../../domain/chat";

export interface IUserClient {
    getChats(): Promise<ChatSummary[]>;
}
