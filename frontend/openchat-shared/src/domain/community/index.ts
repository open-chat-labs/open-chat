import type { AccessControlled, AccessGate, AccessRules } from "../access";
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
    CommunityNotPublic,
    Failure,
    InteralError,
    Invalid,
    NotAuthorised,
    Success,
    SuccessNoUpdates,
    TargetUserNotInCommunity,
    UserBlocked,
    UserLimitReached,
    UserNotInChat,
    UserNotInCommunity,
    UserSuspended,
} from "../response";
import type { HasLevel } from "../structure";

export type CommunityMembership = {
    joined: bigint;
    role: MemberRole;
    archived: boolean;
    pinned: ChannelIdentifier[];
};

export type CommunityIdentifier = {
    kind: "community";
    communityId: string;
};

export type CommunitySummary = AccessControlled &
    HasLevel &
    HasMembershipRole &
    Permissioned<CommunityPermissions> & {
        name: string;
        id: CommunityIdentifier;
        latestEventIndex: number;
        lastUpdated: bigint;
        description: string;
        memberCount: number;
        avatar: DataContent;
        banner: DataContent;
        membership?: CommunityMembership;
        channels: ChannelSummary[]; // TODO - this might be better as a ChatMap - but that would have some serialisation complications
    };

// TODO - not sure if this really needs to be a thing yet
export type DefaultChannel = {
    name: string;
    createdAt: number;
};

export type CommunitySpecificState = {
    detailsLoaded: boolean;
    members: Member[];
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    rules?: AccessRules;
    lastUpdated: bigint;
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

export type BlockCommunityUserResponse =
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | CommunityNotPublic
    | UserSuspended
    | CommunityFrozen
    | TargetUserNotInCommunity
    | InteralError
    | { kind: "cannot_block_self" }
    | { kind: "cannot_block_user" };

export type ChangeCommunityRoleResponse = "success" | "failure";

export type DeleteChannelResponse =
    | UserNotInChat
    | ChatNotFound
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen;

export type DisableCommunityInviteCodeResponse =
    | NotAuthorised
    | Success
    | UserSuspended
    | CommunityFrozen;

export type EnableCommunityInviteCodeResponse =
    | NotAuthorised
    | (Success & { code: bigint })
    | UserSuspended
    | CommunityFrozen;

export type CommunityInviteCodeResponse =
    | NotAuthorised
    | (Success & { code?: bigint })
    | UserNotInCommunity;

export type JoinChannelResponse =
    | { kind: "not_invited" }
    | { kind: "already_in_channel" }
    | GateCheckFailed
    | ChatNotFound
    | UserLimitReached
    | (Success & { channel: ChannelSummary })
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen
    | InteralError
    | UserBlocked;

export type MakeChannelPrivateResponse =
    | UserNotInChat
    | ChatNotFound
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | { kind: "channel_already_private" }
    | CommunityFrozen;

export type MakeCommunityPrivateResponse =
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | { kind: "community_already_private" }
    | CommunityFrozen
    | InteralError;

export type RemoveCommunityMemberResponse = Success | Failure;

export type RemoveChannelMemberResponse = Success | Failure;

export type ChannelMessageMatch = {
    content: MessageContent;
    sender: string;
    score: number;
    messageIndex: number;
};

export type SearchChannelResponse = Failure | (Success & { matches: ChannelMessageMatch[] });

export type UnblockCommunityUserResponse = Failure | Success;

export type UpdateCommunityResponse = Failure | Success;

export type ToggleMuteChannelNotificationsResponse = Failure | Success;

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
    avatarId: OptionUpdate<bigint>;
    channelsAdded: ChannelSummary[];
    membership: CommunityMembershipUpdates | undefined;
    frozen: OptionUpdate<boolean>;
    latestEventIndex: number | undefined;
    bannerId: OptionUpdate<bigint>;
    memberCount: number | undefined;
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
    channelsRemoved: ChannelIdentifier[];
};

export type ChannelMembershipUpdates = {
    role: MemberRole | undefined;
    notificationsMuted: boolean | undefined;
    latestThreads: GroupCanisterThreadDetails[];
    mentions: Mention[];
    myMetrics: Metrics | undefined;
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
    rules: AccessRules;
    lastUpdated: bigint;
};

export type CommunityDetailsUpdates = {
    membersAddedOrUpdated: Member[];
    membersRemoved: Set<string>;
    blockedUsersAdded: Set<string>;
    blockedUsersRemoved: Set<string>;
    rules?: AccessRules;
    invitedUsers?: Set<string>;
    lastUpdated: bigint;
};
