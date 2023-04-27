import type { JoinGroupResponse, ReportMessageResponse } from "openchat-shared";

export interface ILocalUserIndexClient {
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse>;
    reportMessage(
        chatId: string,
        eventIndex: number,
        reasonCode: number,
        notes: string | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<ReportMessageResponse>;
}
