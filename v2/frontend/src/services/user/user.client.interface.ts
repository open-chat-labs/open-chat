import type { GetChatsResponse } from "../../domain/chat/chat";

export interface IUserClient {
    getChats(since: bigint): Promise<GetChatsResponse>;
}
