import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    RegisterUserResponse,
    GroupAndCommunitySummaryUpdatesResponse,
    GroupCanisterGroupChatSummary,
    ChatEventsArgsInner,
    EventsContext,
    ChatEventsResponse,
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
    VerifiedCredentialGateArgs,
    VideoCallType,
    JoinCommunityArgs,
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    RegisterUserResponse as ApiRegisterUserResponse,
    GroupAndCommunitySummaryUpdatesResponse as ApiGroupAndCommunitySummaryUpdatesResponse,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    ChatEventsArgsInner as ApiChatEventsArgsInner,
    EventsContext as ApiEventsContext,
    ChatEventsResponse as ApiChatEventsResponse,
    JoinGroupResponse as ApiJoinGroupResponse,
    GateCheckFailedReason as ApiGateCheckFailedReason,
    JoinCommunityResponse as ApiJoinCommunityResponse,
    CommunityCanisterCommunitySummary as ApiCommunityCanisterCommunitySummary,
    JoinChannelResponse as ApiJoinChannelResponse,
    UserGroup as ApiUserGroup,
    AccessTokenResponse as ApiAccessTokenResponse,
    AccessTokenType as ApiAccessTokenType,
    VerifiedCredentialGateArgs as ApiVerifiedCredentialGateArgs,
    VideoCallType as ApiVideoCallType,
    JoinCommunityArgs as ApiJoinCommunityArgs
};

export const idlFactory: IDL.InterfaceFactory;