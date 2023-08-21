import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    RegisterUserResponse,
    GroupCanisterGroupChatSummary,
    JoinGroupResponse,
    InviteUsersToGroupResponse,
    InviteUsersToChannelResponse,
    GateCheckFailedReason,
    ReportMessageResponse,
    JoinCommunityResponse,
    CommunityCanisterCommunitySummary,
    CommunityMembership,
    JoinChannelResponse,
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    RegisterUserResponse as ApiRegisterUserResponse,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    JoinGroupResponse as ApiJoinGroupResponse,
    GateCheckFailedReason as ApiGateCheckFailedReason,
    ReportMessageResponse as ApiReportMessageResponse,
    InviteUsersToGroupResponse as ApiInviteUsersResponse,
    InviteUsersToChannelResponse as ApiInviteUsersToChannelResponse,
    JoinCommunityResponse as ApiJoinCommunityResponse,
    CommunityCanisterCommunitySummary as ApiCommunityCanisterCommunitySummary,
    CommunityMembership as ApiCommunityMembership,
    JoinChannelResponse as ApiJoinChannelResponse,
};

export const idlFactory: IDL.InterfaceFactory;
