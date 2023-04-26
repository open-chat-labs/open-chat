import type { InviteUsersResponse, JoinGroupResponse } from "openchat-shared";

export interface ILocalUserIndexClient {
    inviteUsersToGroup(chatId: string, userIds: string[]): Promise<InviteUsersResponse>;
    joinGroup(chatId: string): Promise<JoinGroupResponse>;
}
