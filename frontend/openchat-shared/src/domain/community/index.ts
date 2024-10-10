import type { AccessControlled, AccessGate, AccessGateConfig, VersionedRules } from "../access";
import type {
    GateCheckFailed,
    GateCheckFailedReason,
    Member,
    Message,
    MessageContent,
    ChannelSummary,
    Metrics,
    ChannelIdentifier,
    GroupSubtype,
    EventWrapper,
    UpdatedEvent,
    CanisterNotFound,
    GroupMembershipUpdates,
} from "../chat";
import type { DataContent } from "../data";
import type { OptionUpdate } from "../optionUpdate";
import type {
    ChatPermissions,
    CommunityPermissions,
    HasMembershipRole,
    MemberRole,
    Permissioned,
} from "../permission";
import type {
    ChatNotFound,
    CommunityFrozen,
    CommunityPublic,
    Failure,
    InternalError,
    NotAuthorised,
    Offline,
    Success,
    SuccessNoUpdates,
    UserLapsed,
    UserLimitReached,
    UserNotInChat,
    UserNotInCommunity,
    UserSuspended,
} from "../response";
import type { HasLevel } from "../structure";
import type { UserGroupDetails, UserGroupSummary } from "../user";

export type CommunityMembership = {
    joined: bigint;
    role: MemberRole;
    archived: boolean;
    pinned: ChannelIdentifier[];
    index: number;
    displayName: string | undefined;
    rulesAccepted: boolean;
    lapsed: boolean;
};

export type CommunityIdentifier = {
    kind: "community";
    communityId: string;
};

export type CommunitySummary = AccessControlled &
    HasLevel &
    HasMembershipRole &
    Permissioned<CommunityPermissions> & {
        kind: "community";
        name: string;
        id: CommunityIdentifier;
        latestEventIndex: number;
        lastUpdated: bigint;
        description: string;
        memberCount: number;
        avatar: DataContent;
        banner: DataContent;
        metrics: Metrics;
        membership?: CommunityMembership;
        channels: ChannelSummary[]; // TODO - this might be better as a ChatMap - but that would have some serialisation complications
        primaryLanguage: string;
        userGroups: Map<number, UserGroupSummary>;
        localUserIndex: string;
        isInvited: boolean;
    };

export type DefaultChannel = {
    name: string;
    createdAt: number;
};

export type CommunitySpecificState = {
    userGroups: Map<number, UserGroupDetails>;
    members: Map<string, Member>;
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    referrals: Set<string>;
    rules?: VersionedRules;
};

export interface UserFailedGateCheck {
    userId: string;
    reason: GateCheckFailedReason;
}

export interface UserFailedError {
    userId: string;
    error: string;
}

export type AddMembersToChannelFailed = {
    kind: "add_to_channel_failed";
    usersLimitReached: string[];
    usersAlreadyInChannel: string[];
    usersFailedWithError: UserFailedError[];
};
export interface AddMembersToChannelPartialSuccess {
    kind: "add_to_channel_partial_success";
    usersLimitReached: string[];
    usersAlreadyInChannel: string[];
    usersFailedWithError: UserFailedError[];
    usersAdded: string[];
}
export type AddMembersToChannelResponse =
    | AddMembersToChannelFailed
    | AddMembersToChannelPartialSuccess
    | UserNotInChat
    | ChatNotFound
    | UserLimitReached
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | UserLapsed
    | CommunityFrozen
    | CommunityPublic
    | InternalError
    | Offline
    | CommunityPublic;

export type BlockCommunityUserResponse = Success | Failure | Offline;

export type ChangeCommunityRoleResponse = "success" | "failure" | "offline";

export type DeleteChannelResponse =
    | UserNotInChat
    | ChatNotFound
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen
    | Offline;

export type ChannelMessageMatch = {
    content: MessageContent;
    sender: string;
    score: number;
    messageIndex: number;
};

export type UnblockCommunityUserResponse = Failure | Success | Offline;

export type UpdateCommunityResponse =
    | Failure
    | Offline
    | { kind: "success"; rulesVersion: number | undefined };

export type ToggleMuteCommunityNotificationsResponse = Failure | Success | Offline;

export type CreateCommunityResponse =
    | Offline
    | Failure
    | (Success & { id: string })
    | { kind: "name_taken" };

export type JoinCommunityResponse =
    | Failure
    | Offline
    | GateCheckFailed
    | (Success & { community: CommunitySummary });

export type CommunitySummaryResponse = Failure | CommunitySummary;

export type CommunitySummaryUpdatesResponse =
    | SuccessNoUpdates
    | Failure
    | CommunityCanisterCommunitySummaryUpdates;

export type CommunityCanisterCommunitySummaryUpdates = {
    id: CommunityIdentifier;
    public: boolean | undefined;
    permissions: CommunityPermissions | undefined;
    channelsUpdated: CommunityCanisterChannelSummaryUpdates[];
    metrics: Metrics | undefined;
    gateConfig: OptionUpdate<AccessGateConfig>;
    name: string | undefined;
    description: string | undefined;
    lastUpdated: bigint;
    channelsRemoved: ChannelIdentifier[];
    avatarId: OptionUpdate<bigint>;
    channelsAdded: ChannelSummary[];
    membership: CommunityMembershipUpdates | undefined;
    frozen: OptionUpdate<boolean>;
    latestEventIndex: number | undefined;
    bannerId: OptionUpdate<bigint>;
    memberCount: number | undefined;
    primaryLanguage: string | undefined;
    userGroups: UserGroupSummary[];
    userGroupsDeleted: Set<number>;
};

export type CommunityCanisterChannelSummaryUpdates = {
    id: ChannelIdentifier;
    public: boolean | undefined;
    permissions: ChatPermissions | undefined;
    metrics: Metrics | undefined;
    subtype: OptionUpdate<GroupSubtype>;
    dateLastPinned: bigint | undefined;
    gateConfig: OptionUpdate<AccessGateConfig>;
    name: string | undefined;
    description: string | undefined;
    lastUpdated: bigint;
    avatarId: OptionUpdate<bigint>;
    membership: GroupMembershipUpdates | undefined;
    latestEventIndex: number | undefined;
    latestMessageIndex: number | undefined;
    memberCount: number | undefined;
    latestMessage: EventWrapper<Message> | undefined;
    updatedEvents: UpdatedEvent[];
    eventsTTL: OptionUpdate<bigint>;
    eventsTtlLastUpdated: bigint | undefined;
    videoCallInProgress: OptionUpdate<number>;
    messageVisibleToNonMembers?: boolean;
    externalUrl: OptionUpdate<string>;
};

export type CommunityMembershipUpdates = {
    role: MemberRole | undefined;
    displayName: OptionUpdate<string>;
    rulesAccepted: boolean | undefined;
    lapsed: boolean | undefined;
};

export type ChannelMatch = {
    id: ChannelIdentifier;
    gate: AccessGate;
    name: string;
    description: string;
    avatar: DataContent;
    memberCount: number;
};

export type CommunityDetailsResponse = "failure" | CommunityDetails;

export type CommunityDetailsUpdatesResponse =
    | ({
          kind: "success";
      } & CommunityDetailsUpdates)
    | {
          kind: "success_no_updates";
          lastUpdated: bigint;
      }
    | Failure;

export type CommunityDetails = {
    members: Member[];
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    rules: VersionedRules;
    lastUpdated: bigint;
    userGroups: Map<number, UserGroupDetails>;
    referrals: Set<string>;
};

export type CommunityDetailsUpdates = {
    membersAddedOrUpdated: Member[];
    membersRemoved: Set<string>;
    blockedUsersAdded: Set<string>;
    blockedUsersRemoved: Set<string>;
    rules?: VersionedRules;
    invitedUsers?: Set<string>;
    lastUpdated: bigint;
    userGroups: UserGroupDetails[];
    userGroupsDeleted: Set<number>;
    referralsRemoved: Set<string>;
    referralsAdded: Set<string>;
};

export type ChannelSummaryResponse = Failure | ChannelSummary | CanisterNotFound;

export type LeaveCommunityResponse = "success" | "failure" | "offline";

export type DeleteCommunityResponse = "success" | "failure" | "offline";

export type LocalCommunitySummaryUpdates = {
    added?: CommunitySummary;
    removedAtTimestamp?: bigint;
    lastUpdated: number;
    index?: number;
    displayName: OptionUpdate<string>;
    rulesAccepted?: boolean;
};

export type ConvertToCommunityResponse = (Success & { id: ChannelIdentifier }) | Failure | Offline;

export type ImportGroupResponse = (Success & { channelId: ChannelIdentifier }) | Failure | Offline;

export type CreateUserGroupResponse =
    | { kind: "success"; userGroupId: number }
    | { kind: "name_taken" }
    | Failure
    | Offline;
export type UpdateUserGroupResponse = Success | { kind: "name_taken" } | Failure | Offline;
export type DeleteUserGroupsResponse = Success | Failure | Offline;

export type SetMemberDisplayNameResponse =
    | "success"
    | "user_not_in_community"
    | "user_suspended"
    | "user_lapsed"
    | "community_frozen"
    | "display_name_too_short"
    | "display_name_too_long"
    | "display_name_invalid"
    | "offline";

export type FollowThreadResponse = "success" | "unchanged" | "failed" | "offline";
