import type { AccessControlled, AccessGate, VersionedRules } from "../access";
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
    GroupCanisterThreadDetails,
    Mention,
    UpdatedEvent,
    CanisterNotFound,
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
    Failure,
    NotAuthorised,
    Success,
    SuccessNoUpdates,
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
    usersFailedGateCheck: UserFailedGateCheck[];
    usersAlreadyInChannel: string[];
    usersFailedWithError: UserFailedError[];
};
export interface AddMembersToChannelPartialSuccess {
    kind: "add_to_channel_partial_success";
    usersLimitReached: string[];
    usersFailedGateCheck: UserFailedGateCheck[];
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
    | CommunityFrozen;

export type BlockCommunityUserResponse = Success | Failure;

export type ChangeCommunityRoleResponse = "success" | "failure";

export type DeleteChannelResponse =
    | UserNotInChat
    | ChatNotFound
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen;

export type ChannelMessageMatch = {
    content: MessageContent;
    sender: string;
    score: number;
    messageIndex: number;
};

export type UnblockCommunityUserResponse = Failure | Success;

export type UpdateCommunityResponse = Failure | { kind: "success", rulesVersion: number | undefined };

export type ToggleMuteCommunityNotificationsResponse = Failure | Success;

export type CreateCommunityResponse = Failure | (Success & { id: string }) | { kind: "name_taken" };

export type JoinCommunityResponse =
    | Failure
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
    gate: OptionUpdate<AccessGate>;
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
    gate: OptionUpdate<AccessGate>;
    name: string | undefined;
    description: string | undefined;
    lastUpdated: bigint;
    avatarId: OptionUpdate<bigint>;
    membership: ChannelMembershipUpdates | undefined;
    latestEventIndex: number | undefined;
    memberCount: number | undefined;
    latestMessage: EventWrapper<Message> | undefined;
    updatedEvents: UpdatedEvent[];
};

export type CommunityMembershipUpdates = {
    role: MemberRole | undefined;
    displayName: OptionUpdate<string>;
    rulesAccepted: boolean | undefined;
};

export type ChannelMembershipUpdates = {
    role: MemberRole | undefined;
    notificationsMuted: boolean | undefined;
    latestThreads: GroupCanisterThreadDetails[];
    mentions: Mention[];
    myMetrics: Metrics | undefined;
    rulesAccepted: boolean | undefined;
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
};

export type ChannelSummaryResponse = Failure | ChannelSummary | CanisterNotFound;

export type LeaveCommunityResponse = "success" | "failure";

export type DeleteCommunityResponse = "success" | "failure";

export type LocalCommunitySummaryUpdates = {
    added?: CommunitySummary;
    removedAtTimestamp?: bigint;
    lastUpdated: number;
    index?: number;
    displayName: OptionUpdate<string>;
    rulesAccepted?: boolean;
};

export type ConvertToCommunityResponse = (Success & { id: ChannelIdentifier }) | Failure;

export type ImportGroupResponse = (Success & { channelId: ChannelIdentifier }) | Failure;

export type CreateUserGroupResponse =
    | { kind: "success"; userGroupId: number }
    | { kind: "name_taken" }
    | Failure;
export type UpdateUserGroupResponse = Success | { kind: "name_taken" } | Failure;
export type DeleteUserGroupsResponse = Success | Failure;

export type SetMemberDisplayNameResponse =
    | "success"
    | "user_not_in_community"
    | "user_suspended"
    | "community_frozen"
    | "display_name_too_short"
    | "display_name_too_long"
    | "display_name_invalid";
