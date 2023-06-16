import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    RegisterUserResponse,
    GroupCanisterGroupChatSummary,
    JoinGroupResponse,
    InviteUsersToGroupResponse,
    GateCheckFailedReason,
    ReportMessageResponse,
    JoinCommunityResponse,
    CommunityCanisterCommunitySummary,
    CommunityMembership,
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    RegisterUserResponse as ApiRegisterUserResponse,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    JoinGroupResponse as ApiJoinGroupResponse,
    GateCheckFailedReason as ApiGateCheckFailedReason,
    ReportMessageResponse as ApiReportMessageResponse,
    InviteUsersToGroupResponse as ApiInviteUsersResponse,
    JoinCommunityResponse as ApiJoinCommunityResponse,
    CommunityCanisterCommunitySummary as ApiCommunityCanisterCommunitySummary,
    CommunityMembership as ApiCommunityMembership,
};

export const idlFactory: IDL.InterfaceFactory;
