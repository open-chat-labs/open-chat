import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    GroupCanisterGroupChatSummary,
    JoinGroupResponse,
    InviteUsersToGroupResponse,
    GateCheckFailedReason,
    ReportMessageResponse,
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    JoinGroupResponse as ApiJoinGroupResponse,
    GateCheckFailedReason as ApiGateCheckFailedReason,
    ReportMessageResponse as ApiReportMessageResponse,
    InviteUsersToGroupResponse as ApiInviteUsersResponse
};

export const idlFactory: IDL.InterfaceFactory;
