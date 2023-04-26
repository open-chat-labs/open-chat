import type { JoinGroupResponse } from "openchat-shared";

export interface ILocalUserIndexClient {
    joinGroup(chatId: string): Promise<JoinGroupResponse>;
}
