import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    RegisterUserResponse,
    GroupAndCommunitySummaryUpdatesResponse,
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
    UserGroup,
    AccessTokenType,
    AccessTokenResponse,
    VideoCallType
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    RegisterUserResponse as ApiRegisterUserResponse,
    GroupAndCommunitySummaryUpdatesResponse as ApiGroupAndCommunitySummaryUpdatesResponse,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    JoinGroupResponse as ApiJoinGroupResponse,
    GateCheckFailedReason as ApiGateCheckFailedReason,
    InviteUsersToGroupResponse as ApiInviteUsersResponse,
    InviteUsersToChannelResponse as ApiInviteUsersToChannelResponse,
    JoinCommunityResponse as ApiJoinCommunityResponse,
    CommunityCanisterCommunitySummary as ApiCommunityCanisterCommunitySummary,
    CommunityMembership as ApiCommunityMembership,
    JoinChannelResponse as ApiJoinChannelResponse,
    UserGroup as ApiUserGroup,
    AccessTokenResponse as ApiAccessTokenResponse,
    AccessTokenType as ApiAccessTokenType,
    VideoCallType as ApiVideoCallType
};

export const idlFactory: IDL.InterfaceFactory;
