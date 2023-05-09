import type { InviteUsersResponse, JoinGroupResponse, ReportMessageResponse } from "openchat-shared";

export interface ILocalUserIndexClient {
    inviteUsersToGroup(chatId: string, userIds: string[]): Promise<InviteUsersResponse>;
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse>;
    reportMessage(
        chatId: string,
        eventIndex: number,
        reasonCode: number,
        notes: string | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<ReportMessageResponse>;
}
