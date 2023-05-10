import type { InviteUsersResponse, JoinGroupResponse, RegisterUserResponse, ReportMessageResponse } from "openchat-shared";

export interface ILocalUserIndexClient {
    registerUser(
        username: string,
        referralCode: string | undefined
    ): Promise<RegisterUserResponse>;
    inviteUsersToGroup(chatId: string, userIds: string[]): Promise<InviteUsersResponse>;
    joinGroup(chatId: string): Promise<JoinGroupResponse>;
    reportMessage(
        chatId: string,
        eventIndex: number,
        reasonCode: number,
        notes: string | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<ReportMessageResponse>;
}
