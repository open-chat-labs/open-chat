import type { GetChatsResponse } from "../../domain/chat";

export interface IUserClient {
    getChats(since: bigint): Promise<GetChatsResponse>;
}
