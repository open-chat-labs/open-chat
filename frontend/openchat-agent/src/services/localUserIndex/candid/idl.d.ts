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
    JoinCommunityResponse,
    CommunityCanisterCommunitySummary,
    CommunityMembership,
    JoinChannelResponse,
    UserGroup,
    AccessTokenType,
    AccessTokenResponse,
    VerifiedCredentialArgs,
    VideoCallType,
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    RegisterUserResponse as ApiRegisterUserResponse,
    GroupAndCommunitySummaryUpdatesResponse as ApiGroupAndCommunitySummaryUpdatesResponse,
    JoinGroupResponse as ApiJoinGroupResponse,
    GateCheckFailedReason as ApiGateCheckFailedReason,
    InviteUsersToGroupResponse as ApiInviteUsersResponse,
    InviteUsersToChannelResponse as ApiInviteUsersToChannelResponse,
    JoinCommunityResponse as ApiJoinCommunityResponse,
    CommunityCanisterCommunitySummary as ApiCommunityCanisterCommunitySummary,
    JoinChannelResponse as ApiJoinChannelResponse,
    UserGroup as ApiUserGroup,
    AccessTokenResponse as ApiAccessTokenResponse,
    AccessTokenType as ApiAccessTokenType,
    VerifiedCredentialArgs as ApiVerifiedCredentialArgs,
    VideoCallType as ApiVideoCallType,
};

export const idlFactory: IDL.InterfaceFactory;
