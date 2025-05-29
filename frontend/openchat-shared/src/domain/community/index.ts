import type { AccessControlled, AccessGateConfig, VersionedRules } from "../access";
import type { GrantedBotPermissions, InstalledBotDetails } from "../bots";
import type {
    CanisterNotFound,
    ChannelIdentifier,
    ChannelSummary,
    EventWrapper,
    GateCheckFailed,
    GateCheckFailedReason,
    GroupMembershipUpdates,
    GroupSubtype,
    Member,
    Message,
    MessageContent,
    Metrics,
    UpdatedEvent,
    VideoCallInProgress,
} from "../chat";
import type { DataContent } from "../data";
import type { OCError } from "../error";
import type { OptionUpdate } from "../optionUpdate";
import type {
    ChatPermissions,
    CommunityPermissions,
    HasMembershipRole,
    MemberRole,
    Permissioned,
} from "../permission";
import type { Failure, InternalError, Offline, Success, SuccessNoUpdates } from "../response";
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
        verified: boolean;
    };

export type DefaultChannel = {
    name: string;
    createdAt: number;
};

export type CommunitySpecificState = {
    userGroups: Map<number, UserGroupDetails>;
    members: Map<string, Member>;
    blockedUsers: Set<string>;
    lapsedMembers: Set<string>;
    invitedUsers: Set<string>;
    referrals: Set<string>;
    rules?: VersionedRules;
    bots: Map<string, GrantedBotPermissions>;
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
    | Success
    | AddMembersToChannelFailed
    | AddMembersToChannelPartialSuccess
    | InternalError
    | OCError;

export type BlockCommunityUserResponse = Success | OCError | Offline;
export type ChangeCommunityRoleResponse = Success | OCError | Offline;
export type DeleteChannelResponse = Success | OCError | Offline;

export type ChannelMessageMatch = {
    content: MessageContent;
    sender: string;
    score: number;
    messageIndex: number;
};

export type UnblockCommunityUserResponse = Success | OCError | Offline;

export type UpdateCommunityResponse =
    | { kind: "success"; rulesVersion: number | undefined }
    | OCError
    | Offline;

export type ToggleMuteCommunityNotificationsResponse = Success | OCError | Offline;

export type CreateCommunityResponse = Offline | Failure | OCError | (Success & { id: string });

export type JoinCommunityResponse =
    | Failure
    | Offline
    | GateCheckFailed
    | (Success & { community: CommunitySummary });

export type CommunitySummaryResponse = Failure | CommunitySummary;

export type CommunitySummaryUpdatesResponse =
    | SuccessNoUpdates
    | Failure
    | CommunityCanisterCommunitySummaryUpdates
    | OCError;

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
    verified?: boolean;
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
    videoCallInProgress: OptionUpdate<VideoCallInProgress>;
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
    gateConfig: AccessGateConfig;
    name: string;
    description: string;
    avatar: DataContent;
    memberCount: number;
    public: boolean;
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
    bots: InstalledBotDetails[];
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
    botsAddedOrUpdated: InstalledBotDetails[];
    botsRemoved: Set<string>;
};

export type ChannelSummaryResponse = Failure | ChannelSummary | CanisterNotFound;
export type LeaveCommunityResponse = Success | OCError | Offline;
export type DeleteCommunityResponse = Success | OCError | Offline;

export type LocalCommunitySummaryUpdates = {
    added?: CommunitySummary;
    removedAtTimestamp?: bigint;
    lastUpdated: number;
    index?: number;
    displayName: OptionUpdate<string>;
    rulesAccepted?: boolean;
};

export type ConvertToCommunityResponse = (Success & { id: ChannelIdentifier }) | OCError | Offline;
export type ImportGroupResponse = (Success & { channelId: ChannelIdentifier }) | OCError | Offline;

export type CreateUserGroupResponse =
    | { kind: "success"; userGroupId: number }
    | OCError
    | Failure
    | Offline;

export type UpdateUserGroupResponse = Success | OCError | Offline | Failure;
export type DeleteUserGroupsResponse = Success | OCError | Offline;
export type SetMemberDisplayNameResponse = Success | OCError | Offline;
export type FollowThreadResponse = Success | OCError | Offline;

export type FreezeCommunityResponse =
    | "success"
    | "community_already_frozen"
    | "community_not_found"
    | "not_authorized"
    | "internal_error"
    | "offline";

export type UnfreezeCommunityResponse =
    | "success"
    | "community_not_frozen"
    | "community_not_found"
    | "not_authorized"
    | "internal_error"
    | "offline";

export function communityIdentifiersEqual(
    a?: CommunityIdentifier,
    b?: CommunityIdentifier,
): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    return a.communityId === b.communityId;
}

export type CommunityFilter = Set<string>;

export type CommunityEventType =
    | "Created"
    | "NameChanged"
    | "DescriptionChanged"
    | "RulesChanged"
    | "AvatarChanged"
    | "BannerChanged"
    | "PermissionsChanged"
    | "VisibilityChanged"
    | "InviteCodeChanged"
    | "Frozen"
    | "Unfrozen"
    | "EventsTTLUpdated"
    | "GateUpdated"
    | "MessagePinned"
    | "MessageUnpinned"
    | "PrimaryLanguageChanged"
    | "GroupImported"
    | "ChannelCreated"
    | "ChannelDeleted"
    | "MembersJoined"
    | "MembersLeft"
    | "RoleChanged"
    | "UsersInvited"
    | "BotAdded"
    | "BotRemoved"
    | "BotUpdated"
    | "UsersBlocked"
    | "UsersUnblocked";
