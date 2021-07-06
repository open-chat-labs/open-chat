import type { GetChatsResponse } from "../../domain/chat";

export interface IUserClient {
    getChats(): Promise<GetChatsResponse>;
}
