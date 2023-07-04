import type { AgentConfig } from "./config";
import type {
    AddRemoveReactionResponse,
    BlockUserResponse,
    CandidateGroupChat,
    ChangeRoleResponse,
    ChatEvent,
    ClaimPrizeResponse,
    CreateGroupResponse,
    DeletedDirectMessageResponse,
    DeletedGroupMessageResponse,
    DeleteFrozenGroupResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DirectChatEvent,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventWrapper,
    FreezeGroupResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatEvent,
    GroupChatSummary,
    IndexRange,
    InviteCodeResponse,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListNervousSystemFunctionsResponse,
    MarkReadRequest,
    MarkReadResponse,
    Message,
    PendingCryptocurrencyWithdrawal,
    PinMessageResponse,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RemoveMemberResponse,
    SendMessageResponse,
    ProposalVoteDetails,
    ThreadPreview,
    ThreadRead,
    ThreadSyncDetails,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnfreezeGroupResponse,
    UnpinMessageResponse,
    UpdateGroupResponse,
    UpdatesResult,
    WithdrawCryptocurrencyResponse,
    ReportMessageResponse,
    InviteUsersResponse,
    ResetInviteCodeResponse,
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    SetGroupUpgradeConcurrencyResponse,
    DeclineInvitationResponse,
    ChatIdentifier,
    GroupChatIdentifier,
    DirectChatIdentifier,
    ChannelIdentifier,
    MultiUserChatIdentifier,
} from "./chat";
import type { BlobReference, StorageStatus } from "./data/data";
import type { UpdateMarketMakerConfigArgs, UpdateMarketMakerConfigResponse } from "./marketMaker";
import type { ToggleMuteNotificationResponse } from "./notifications";
import type {
    ArchiveChatResponse,
    CheckUsernameResponse,
    CreatedUser,
    CurrentUserResponse,
    MigrateUserPrincipalResponse,
    PartialUserSummary,
    PinChatResponse,
    PublicProfile,
    RegisterUserResponse,
    SetBioResponse,
    SetUsernameResponse,
    SuspendUserResponse,
    UnpinChatResponse,
    User,
    UserLookup,
    UsersArgs,
    UsersResponse,
    UserSummary,
    UnsuspendUserResponse,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    SetMessageReminderResponse,
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
    SetUserUpgradeConcurrencyResponse,
    ManageFavouritesResponse,
} from "./user";
import type {
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    GroupSearchResponse,
    ExploreCommunitiesResponse,
} from "./search/search";
import type { Cryptocurrency, Tokens } from "./crypto";
import type { GroupInvite } from "./inviteCodes";
import type { CommunityPermissions, MemberRole } from "./permission";
import type { AccessGate, AccessRules } from "./access";
import type {
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    ChangeCommunityRoleResponse,
    CommunitySummary,
    CommunityInviteCodeResponse,
    CreateCommunityResponse,
    DisableCommunityInviteCodeResponse,
    EnableCommunityInviteCodeResponse,
    JoinChannelResponse,
    JoinCommunityResponse,
    RemoveChannelMemberResponse,
    RemoveCommunityMemberResponse,
    SearchChannelResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UpdateCommunityResponse,
    CommunityIdentifier,
    CommunitySummaryResponse,
    ChannelMatch,
    CommunityDetailsResponse,
    CommunityDetails,
    ChannelSummaryResponse,
} from "./community";
import type { ChatPermissions } from "./permission";
/**
 * Worker request types
 */

export type CorrelatedWorkerRequest = WorkerRequest & {
    correlationId: string;
};

export type WorkerRequest =
    | DismissRecommendations
    | SearchGroups
    | GetGroupRules
    | GetRecommendedGroups
    | RegisterProposalVote
    | ChangeRole
    | RemoveMember
    | InviteUsers
    | InviteUsersToCommunity
    | PushSub
    | RemoveSub
    | SubscriptionExists
    | RegisterUser
    | EditMessage
    | SendMessage
    | UnpinMessage
    | PinMessage
    | GetProposalVoteDetailsRequest
    | ListNervousSystemFunctions
    | BlockUserFromGroup
    | UnblockUserFromGroup
    | RemoveReaction
    | AddReaction
    | DeleteMessage
    | UndeleteMessage
    | RegisterPollVote
    | UpdateGroup
    | JoinGroup
    | JoinCommunity
    | LeaveGroup
    | DeleteGroup
    | SetUserAvatar
    | UnblockUserFromDirectChat
    | BlockUserFromDirectChat
    | UnpinChat
    | PinChat
    | UnArchiveChat
    | ArchiveChat
    | ToggleMuteNotifications
    | GetPublicGroupSummary
    | GetUserStorageLimits
    | InitUserPrincipalMigration
    | MigrateUserPrincipal
    | SearchUsers
    | CheckUsername
    | RehydrateMessage
    | ChatEventsByEventIndex
    | ChatEventsWindow
    | LastOnline
    | MarkAsOnline
    | GetGroupDetails
    | GetGroupDetailUpdates
    | MarkMessagesRead
    | GetAllCachedUsers
    | GetUsers
    | ChatEvents
    | CreateUserClient
    | Init
    | CurrentUser
    | SetGroupInvite
    | SearchGroupChat
    | SearchDirectChat
    | RefreshAccountBalance
    | GetThreadPreviews
    | GetUser
    | GetPublicProfile
    | SetUsername
    | SetBio
    | GetBio
    | WithdrawCrypto
    | GroupMessagesByMessageIndex
    | GetInviteCode
    | EnableInviteCode
    | ResetInviteCode
    | DisableInviteCode
    | CreateGroupChat
    | SetCachedMessageFromNotification
    | FreezeGroup
    | UnfreezeGroup
    | DeleteFrozenGroup
    | AddHotGroupExclusion
    | RemoveHotGroupExclusion
    | SuspendUser
    | UnsuspendUser
    | MarkSuspectedBot
    | GetUpdates
    | GetDeletedGroupMessage
    | GetDeletedDirectMessage
    | LoadFailedMessages
    | DeleteFailedMessage
    | ClaimPrize
    | PayForDiamondMembership
    | SetGroupUpgradeConcurrency
    | SetUserUpgradeConcurrency
    | UpdateMarketMakerConfig
    | SetMessageReminder
    | CancelMessageReminder
    | ReferralLeaderboard
    | ReportMessage
    | DeclineInvitation
    | AddMembersToChannel
    | BlockCommunityUser
    | ChangeChannelRole
    | DeclineChannelInvitation
    | DeleteChannelMessages
    | DeleteChannelMessage
    | DisableCommunityInviteCode
    | EnableCommunityInviteCode
    | ChannelEvents
    | ChannelEventsByIndex
    | ChannelEventsWindow
    | CommunityInviteCode
    | JoinChannel
    | ChannelMessagesByMessageIndex
    | RemoveCommunityMember
    | RemoveChannelMember
    | ResetCommunityInviteCode
    | SearchChannel
    | SelectedChannelInitial
    | SelectedChannelUpdates
    | ToggleMuteCommunityNotifications
    | UnblockCommunityUser
    | UpdateCommunity
    | CreateCommunity
    | ExploreCommunities
    | GetCommunitySummary
    | ExploreChannels
    | GetCommunityDetails
    | GetCommunityDetailsUpdates
    | GetChannelSummary
    | AddToFavourites
    | RemoveFromFavourites
    | ChangeCommunityRole;

type AddToFavourites = {
    kind: "addToFavourites";
    chatId: ChatIdentifier;
};

type RemoveFromFavourites = {
    kind: "removeFromFavourites";
    chatId: ChatIdentifier;
};

type GetChannelSummary = {
    kind: "getChannelSummary";
    chatId: ChannelIdentifier;
};

type GetCommunityDetails = {
    kind: "getCommunityDetails";
    id: CommunityIdentifier;
    lastUpdated: bigint;
};

type GetCommunityDetailsUpdates = {
    kind: "getCommunityDetailsUpdates";
    id: CommunityIdentifier;
    previous: CommunityDetails;
};

type ExploreChannels = {
    kind: "exploreChannels";
    id: CommunityIdentifier;
    searchTerm: string | undefined;
    pageSize: number;
    pageIndex: number;
};

type GetCommunitySummary = {
    communityId: string;
    kind: "getCommunitySummary";
};

type ReferralLeaderboard = {
    args?: ReferralLeaderboardRange;
    kind: "getReferralLeaderboard";
};

type SetCachedMessageFromNotification = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    message: EventWrapper<Message>;
    kind: "setCachedMessageFromNotification";
};

type CreateGroupChat = {
    candidate: CandidateGroupChat;
    kind: "createGroupChat";
};

type DisableInviteCode = {
    chatId: GroupChatIdentifier;
    kind: "disableInviteCode";
};

type EnableInviteCode = {
    chatId: GroupChatIdentifier;
    kind: "enableInviteCode";
};

type ResetInviteCode = {
    chatId: GroupChatIdentifier;
    kind: "resetInviteCode";
};

type GetInviteCode = {
    chatId: GroupChatIdentifier;
    kind: "getInviteCode";
};

type GroupMessagesByMessageIndex = {
    chatId: MultiUserChatIdentifier;
    messageIndexes: Set<number>;
    latestClientEventIndex: number | undefined;
    kind: "getGroupMessagesByMessageIndex";
};

type WithdrawCrypto = {
    domain: PendingCryptocurrencyWithdrawal;
    kind: "withdrawCryptocurrency";
};

type GetBio = {
    userId?: string;
    kind: "getBio";
};

type SetBio = {
    bio: string;
    kind: "setBio";
};

type SetUsername = {
    userId: string;
    username: string;
    kind: "setUsername";
};

type GetPublicProfile = {
    userId?: string;
    kind: "getPublicProfile";
};

type GetUser = {
    userId: string;
    allowStale: boolean;
    kind: "getUser";
};

type GetThreadPreviews = {
    threadsByChat: Map<string, [ThreadSyncDetails[], number | undefined]>;
    kind: "threadPreviews";
};

type RefreshAccountBalance = {
    crypto: Cryptocurrency;
    principal: string;
    kind: "refreshAccountBalance";
};

type SearchDirectChat = {
    chatId: DirectChatIdentifier;
    searchTerm: string;
    maxResults: number;
    kind: "searchDirectChat";
};

type SearchGroupChat = {
    chatId: GroupChatIdentifier;
    searchTerm: string;
    userIds: string[];
    maxResults: number;
    kind: "searchGroupChat";
};

type SetGroupInvite = {
    value: GroupInvite;
    kind: "groupInvite";
};

type DismissRecommendations = {
    chatId: GroupChatIdentifier;
    kind: "dismissRecommendation";
};

type ExploreCommunities = {
    searchTerm: string | undefined;
    pageIndex: number;
    pageSize: number;
    kind: "exploreCommunities";
};

type SearchGroups = {
    searchTerm: string;
    maxResults: number;
    kind: "searchGroups";
};

type GetGroupRules = {
    chatId: GroupChatIdentifier;
    kind: "getGroupRules";
};

type GetRecommendedGroups = {
    exclusions: string[];
    kind: "getRecommendedGroups";
};

type RegisterProposalVote = {
    chatId: GroupChatIdentifier;
    messageIndex: number;
    adopt: boolean;
    kind: "registerProposalVote";
};

type ChangeRole = {
    chatId: MultiUserChatIdentifier;
    userId: string;
    newRole: MemberRole;
    kind: "changeRole";
};

type RemoveMember = {
    chatId: GroupChatIdentifier;
    userId: string;
    kind: "removeMember";
};

type InviteUsers = {
    chatId: MultiUserChatIdentifier;
    userIds: string[];
    kind: "inviteUsers";
};

type InviteUsersToCommunity = {
    id: CommunityIdentifier;
    userIds: string[];
    kind: "inviteUsersToCommunity";
};

type RemoveSub = {
    subscription: PushSubscriptionJSON;
    kind: "removeSubscription";
};

type PushSub = {
    subscription: PushSubscriptionJSON;
    kind: "pushSubscription";
};

type SubscriptionExists = {
    p256dh_key: string;
    kind: "subscriptionExists";
};

type RegisterUser = {
    username: string;
    referralCode: string | undefined;
    kind: "registerUser";
};

type EditMessage = {
    chatId: ChatIdentifier;
    msg: Message;
    threadRootMessageIndex?: number;
    kind: "editMessage";
};

type SendMessage = {
    chatId: ChatIdentifier;
    user: CreatedUser;
    mentioned: User[];
    event: EventWrapper<Message>;
    threadRootMessageIndex?: number;
    kind: "sendMessage";
};

export type PinMessage = {
    chatId: MultiUserChatIdentifier;
    messageIndex: number;
    kind: "pinMessage";
};

export type UnpinMessage = {
    chatId: MultiUserChatIdentifier;
    messageIndex: number;
    kind: "unpinMessage";
};

type GetProposalVoteDetailsRequest = {
    governanceCanisterId: string;
    proposalId: bigint;
    isNns: boolean;
    kind: "getProposalVoteDetails";
};

type ListNervousSystemFunctions = {
    snsGovernanceCanisterId: string;
    kind: "listNervousSystemFunctions";
};

type BlockUserFromGroup = {
    chatId: GroupChatIdentifier;
    userId: string;
    kind: "blockUserFromGroupChat";
};

type UnblockUserFromGroup = {
    chatId: GroupChatIdentifier;
    userId: string;
    kind: "unblockUserFromGroupChat";
};

type RemoveReaction = {
    chatId: ChatIdentifier;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex?: number;
    kind: "removeReaction";
};

type AddReaction = {
    chatId: ChatIdentifier;
    messageId: bigint;
    reaction: string;
    username: string;
    threadRootMessageIndex?: number;
    kind: "addReaction";
};

type DeleteMessage = {
    chatId: ChatIdentifier;
    messageId: bigint;
    threadRootMessageIndex?: number;
    asPlatformModerator?: boolean;
    kind: "deleteMessage";
};

type UndeleteMessage = {
    chatId: ChatIdentifier;
    messageId: bigint;
    threadRootMessageIndex?: number;
    kind: "undeleteMessage";
};

type RegisterPollVote = {
    chatId: MultiUserChatIdentifier;
    messageIdx: number;
    answerIdx: number;
    voteType: "register" | "delete";
    threadRootMessageIndex?: number;
    kind: "registerPollVote";
};

type UpdateGroup = {
    chatId: MultiUserChatIdentifier;
    name?: string;
    desc?: string;
    rules?: AccessRules;
    permissions?: Partial<ChatPermissions>;
    avatar?: Uint8Array;
    gate?: AccessGate;
    isPublic?: boolean;
    kind: "updateGroup";
};

type JoinGroup = {
    chatId: GroupChatIdentifier;
    kind: "joinGroup";
};

type JoinCommunity = {
    id: CommunityIdentifier;
    kind: "joinCommunity";
};

type LeaveGroup = {
    chatId: MultiUserChatIdentifier;
    kind: "leaveGroup";
};

type DeleteGroup = {
    chatId: MultiUserChatIdentifier;
    kind: "deleteGroup";
};

type SetUserAvatar = {
    data: Uint8Array;
    kind: "setUserAvatar";
};

type UnblockUserFromDirectChat = {
    userId: string;
    kind: "unblockUserFromDirectChat";
};

type BlockUserFromDirectChat = {
    userId: string;
    kind: "blockUserFromDirectChat";
};

type UnpinChat = {
    chatId: ChatIdentifier;
    communitiesEnabled: boolean;
    kind: "unpinChat";
};

type PinChat = {
    chatId: ChatIdentifier;
    communitiesEnabled: boolean;
    kind: "pinChat";
};

type UnArchiveChat = {
    chatId: ChatIdentifier;
    kind: "unarchiveChat";
};

type ArchiveChat = {
    chatId: ChatIdentifier;
    kind: "archiveChat";
};

type ToggleMuteNotifications = {
    chatId: ChatIdentifier;
    muted: boolean;
    kind: "toggleMuteNotifications";
};

type GetPublicGroupSummary = {
    chatId: GroupChatIdentifier;
    kind: "getPublicGroupSummary";
};

type GetUserStorageLimits = {
    kind: "getUserStorageLimits";
};

type InitUserPrincipalMigration = {
    newPrincipal: string;
    kind: "initUserPrincipalMigration";
};

type MigrateUserPrincipal = {
    userId: string;
    kind: "migrateUserPrincipal";
};

type CheckUsername = {
    username: string;
    kind: "checkUsername";
};

type SearchUsers = {
    searchTerm: string;
    maxResults: number;
    kind: "searchUsers";
};

type ChatEventsWindow = {
    eventIndexRange: IndexRange;
    chatId: ChatIdentifier;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
    threadRootMessageIndex: number | undefined;
    kind: "chatEventsWindow";
};

type ChatEventsByEventIndex = {
    chatId: ChatIdentifier;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
    kind: "chatEventsByEventIndex";
};

export type RehydrateMessage = {
    chatId: ChatIdentifier;
    message: EventWrapper<Message>;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
    kind: "rehydrateMessage";
};

type Init = Omit<AgentConfig, "logger"> & {
    kind: "init";
};

type CurrentUser = {
    kind: "getCurrentUser";
};

type MarkMessagesRead = {
    kind: "markMessagesRead";
    payload: MarkReadRequest;
};

type GetGroupDetails = {
    chatId: MultiUserChatIdentifier;
    timestamp: bigint;
    kind: "getGroupDetails";
};

type GetGroupDetailUpdates = {
    chatId: MultiUserChatIdentifier;
    previous: GroupChatDetails;
    kind: "getGroupDetailsUpdates";
};

type GetAllCachedUsers = {
    kind: "getAllCachedUsers";
};

type LastOnline = {
    userIds: string[];
    kind: "lastOnline";
};

type MarkAsOnline = {
    kind: "markAsOnline";
};

type FreezeGroup = {
    chatId: GroupChatIdentifier;
    reason: string | undefined;
    kind: "freezeGroup";
};

type UnfreezeGroup = {
    chatId: GroupChatIdentifier;
    kind: "unfreezeGroup";
};

type DeleteFrozenGroup = {
    chatId: GroupChatIdentifier;
    kind: "deleteFrozenGroup";
};

type AddHotGroupExclusion = {
    chatId: GroupChatIdentifier;
    kind: "addHotGroupExclusion";
};

type RemoveHotGroupExclusion = {
    chatId: GroupChatIdentifier;
    kind: "removeHotGroupExclusion";
};

type SuspendUser = {
    userId: string;
    reason: string;
    kind: "suspendUser";
};

type UnsuspendUser = {
    userId: string;
    kind: "unsuspendUser";
};

type SetGroupUpgradeConcurrency = {
    value: number;
    kind: "setGroupUpgradeConcurrency";
};

type SetUserUpgradeConcurrency = {
    value: number;
    kind: "setUserUpgradeConcurrency";
};

type MarkSuspectedBot = {
    kind: "markSuspectedBot";
};

type GetUsers = {
    users: UsersArgs;
    allowStale: boolean;
    kind: "getUsers";
};

type ChatEvents = {
    chatId: ChatIdentifier;
    eventIndexRange: IndexRange;
    startIndex: number;
    ascending: boolean;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
    kind: "chatEvents";
};

type CreateUserClient = {
    userId: string;
    kind: "createUserClient";
};

type GetUpdates = {
    kind: "getUpdates";
};

type GetDeletedGroupMessage = {
    chatId: MultiUserChatIdentifier;
    messageId: bigint;
    threadRootMessageIndex: number | undefined;
    kind: "getDeletedGroupMessage";
};

type GetDeletedDirectMessage = {
    userId: string;
    messageId: bigint;
    kind: "getDeletedDirectMessage";
};

/**
 * Worker error type
 */
export type WorkerError = {
    kind: "worker_error";
    correlationId: string;
    error: string;
};

/**
 * Worker response types
 */
export type WorkerResponse =
    | Response<CreateGroupResponse>
    | Response<DisableInviteCodeResponse>
    | Response<EnableInviteCodeResponse>
    | Response<ResetInviteCodeResponse>
    | Response<InviteCodeResponse>
    | Response<EventsResponse<Message>>
    | Response<WithdrawCryptocurrencyResponse>
    | Response<string>
    | Response<SetBioResponse>
    | Response<SetUsernameResponse>
    | Response<PublicProfile>
    | Response<PartialUserSummary | undefined>
    | Response<ThreadPreview[]>
    | Response<Tokens>
    | Response<SearchDirectChatResponse>
    | Response<SearchGroupChatResponse>
    | Response<AccessRules | undefined>
    | Response<GroupChatSummary[]>
    | Response<RegisterProposalVoteResponse>
    | Response<ChangeRoleResponse>
    | Response<InviteUsersResponse>
    | Response<RemoveMemberResponse>
    | Response<boolean>
    | Response<RegisterUserResponse>
    | Response<EditMessageResponse>
    | Response<[SendMessageResponse, Message]>
    | Response<UnpinMessageResponse>
    | Response<PinMessageResponse>
    | Response<ProposalVoteDetails>
    | Response<ListNervousSystemFunctionsResponse>
    | Response<AddRemoveReactionResponse>
    | Response<DeleteMessageResponse>
    | Response<UndeleteMessageResponse>
    | Response<RegisterPollVoteResponse>
    | Response<UpdateGroupResponse>
    | Response<JoinGroupResponse>
    | Response<DeleteGroupResponse>
    | Response<LeaveGroupResponse>
    | Response<BlobReference>
    | Response<UnblockUserResponse>
    | Response<BlockUserResponse>
    | Response<UnpinChatResponse>
    | Response<PinChatResponse>
    | Response<ArchiveChatResponse>
    | Response<ArchiveChatResponse>
    | Response<ToggleMuteNotificationResponse>
    | Response<GroupChatSummary | undefined>
    | Response<StorageStatus>
    | Response<undefined>
    | Response<MigrateUserPrincipalResponse>
    | Response<UserSummary[]>
    | Response<CheckUsernameResponse>
    | Response<EventWrapper<Message>>
    | Response<EventsResponse<DirectChatEvent>>
    | Response<EventsResponse<GroupChatEvent>>
    | Response<EventsResponse<DirectChatEvent>>
    | Response<EventsResponse<GroupChatEvent>>
    | Response<Record<string, number>>
    | Response<undefined>
    | Response<GroupChatDetailsResponse>
    | Response<GroupChatDetails>
    | Response<MarkReadResponse>
    | Response<UserLookup>
    | Response<UsersResponse>
    | Response<undefined>
    | Response<CurrentUserResponse>
    | Response<EventsResponse<ChatEvent>>
    | Response<FreezeGroupResponse>
    | Response<UnfreezeGroupResponse>
    | Response<DeleteFrozenGroupResponse>
    | Response<AddHotGroupExclusion>
    | Response<RemoveHotGroupExclusion>
    | Response<SuspendUserResponse>
    | Response<UnsuspendUserResponse>
    | Response<UpdatesResult>
    | Response<DeletedDirectMessageResponse>
    | Response<DeletedGroupMessageResponse>
    | Response<undefined>
    | Response<Map<string, Record<number, EventWrapper<Message>>>>
    | Response<PayForDiamondMembershipResponse>
    | Response<ClaimPrizeResponse>
    | Response<UpdateMarketMakerConfigResponse>
    | Response<SetMessageReminderResponse>
    | Response<ReferralLeaderboardResponse>
    | Response<ReportMessageResponse>
    | Response<BlockCommunityUserResponse>
    | Response<ChangeCommunityRoleResponse>
    | Response<DisableCommunityInviteCode>
    | Response<CommunityInviteCodeResponse>
    | Response<JoinChannelResponse>
    | Response<RemoveCommunityMemberResponse>
    | Response<RemoveChannelMemberResponse>
    | Response<EnableCommunityInviteCodeResponse>
    | Response<SearchChannelResponse>
    | Response<ToggleMuteCommunityNotificationsResponse>
    | Response<UnblockCommunityUserResponse>
    | Response<UpdateCommunityResponse>
    | Response<CreateCommunityResponse>
    | Response<JoinCommunityResponse>
    | Response<CommunitySummaryResponse>
    | Response<ChannelMatch[]>
    | Response<CommunityDetailsResponse>
    | Response<CommunityDetails>
    | Response<ChannelSummaryResponse>
    | Response<ManageFavouritesResponse>
    | Response<AddMembersToChannelResponse>;

type Response<T> = {
    kind: "worker_response";
    correlationId: string;
    response: T;
};

export type FromWorker = WorkerResponse | WorkerEvent | WorkerError;

/** Worker event types */
type WorkerEventCommon<T> = {
    kind: "worker_event";
    event: T;
};

export type WorkerEvent =
    | RelayedMessagesReadFromServer
    | RelayedStorageUpdated
    | RelayedUsersLoaded;

export type RelayedMessagesReadFromServer = WorkerEventCommon<{
    subkind: "messages_read_from_server";
    chatId: ChatIdentifier;
    readByMeUpTo: number | undefined;
    threadsRead: ThreadRead[];
    dateReadPinned: bigint | undefined;
}>;
export type RelayedStorageUpdated = WorkerEventCommon<{
    subkind: "storage_updated";
    status: StorageStatus;
}>;
export type RelayedUsersLoaded = WorkerEventCommon<{
    subkind: "users_loaded";
    users: PartialUserSummary[];
}>;

type LoadFailedMessages = {
    kind: "loadFailedMessages";
};

type DeleteFailedMessage = {
    chatId: ChatIdentifier;
    messageId: bigint;
    threadRootMessageIndex: number | undefined;
    kind: "deleteFailedMessage";
};

type ClaimPrize = {
    chatId: GroupChatIdentifier;
    messageId: bigint;
    kind: "claimPrize";
};

type PayForDiamondMembership = {
    userId: string;
    token: Cryptocurrency;
    duration: DiamondMembershipDuration;
    recurring: boolean;
    expectedPriceE8s: bigint;
    kind: "payForDiamondMembership";
};

type UpdateMarketMakerConfig = UpdateMarketMakerConfigArgs & {
    kind: "updateMarketMakerConfig";
};

type SetMessageReminder = {
    chatId: ChatIdentifier;
    eventIndex: number;
    remindAt: number;
    notes?: string;
    threadRootMessageIndex?: number;
    kind: "setMessageReminder";
};

type CancelMessageReminder = {
    reminderId: bigint;
    kind: "cancelMessageReminder";
};

type ReportMessage = {
    chatId: ChatIdentifier;
    eventIndex: number;
    reasonCode: number;
    notes: string | undefined;
    threadRootMessageIndex: number | undefined;
    kind: "reportMessage";
};

type DeclineInvitation = {
    chatId: MultiUserChatIdentifier;
    kind: "declineInvitation";
};

type AddMembersToChannel = {
    kind: "addMembersToChannel";
    chatId: ChannelIdentifier;
    userIds: string[];
    username: string;
};

type BlockCommunityUser = {
    kind: "blockCommunityUser";
    communityId: string;
    userId: string;
};

type ChangeChannelRole = {
    kind: "changeChannelRole";
    chatId: ChannelIdentifier;
    userId: string;
    newRole: MemberRole;
};

type DeclineChannelInvitation = {
    kind: "declineChannelInvitation";
    chatId: ChannelIdentifier;
};

type DeleteChannelMessages = {
    kind: "deleteChannelMessages";
    chatId: ChannelIdentifier;
    messageIds: bigint[];
    threadRootMessageIndex: number | undefined;
    asPlatformModerator: boolean | undefined;
};

type DeleteChannelMessage = {
    kind: "deleteChannelMessage";
    chatId: ChannelIdentifier;
    messageId: bigint;
    sender: string;
    threadRootMessageIndex: number | undefined;
};

type DisableCommunityInviteCode = {
    kind: "disableCommunityInviteCode";
    communityId: string;
};

type EnableCommunityInviteCode = {
    kind: "enableCommunityInviteCode";
    communityId: string;
};

type ChannelEvents = {
    kind: "channelEvents";
    chatId: ChannelIdentifier;
    startIndex: number;
    ascending: boolean;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
};

type ChannelEventsByIndex = {
    kind: "channelEventsByIndex";
    chatId: ChannelIdentifier;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
};

type ChannelEventsWindow = {
    kind: "channelEventsWindow";
    chatId: ChannelIdentifier;
    messageIndex: number;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
};

type CommunityInviteCode = {
    kind: "communityInviteCode";
    communityId: string;
};

type JoinChannel = {
    kind: "joinChannel";
    chatId: ChannelIdentifier;
};

type ChannelMessagesByMessageIndex = {
    kind: "channelMessagesByMessageIndex";
    chatId: ChannelIdentifier;
    messageIndexes: number[];
    latestClientEventIndex: number | undefined;
    threadRootMessageIndex: number | undefined;
};

type RemoveCommunityMember = {
    kind: "removeCommunityMember";
    communityId: string;
    userId: string;
};

type RemoveChannelMember = {
    kind: "removeChannelMember";
    chatId: ChannelIdentifier;
    userId: string;
};

type ResetCommunityInviteCode = {
    kind: "resetCommunityInviteCode";
    communityId: string;
};

type SearchChannel = {
    kind: "searchChannel";
    chatId: ChannelIdentifier;
    maxResults: number;
    users: string[];
    searchTerm: string;
};

type SelectedChannelInitial = {
    kind: "selectedChannelInitial";
    chatId: ChannelIdentifier;
};

type SelectedChannelUpdates = {
    kind: "selectedChannelUpdates";
    chatId: ChannelIdentifier;
    updatesSince: bigint;
};

type ToggleMuteCommunityNotifications = {
    kind: "toggleMuteCommunityNotifications";
    communityId: string;
    mute: boolean;
};

type UnblockCommunityUser = {
    kind: "unblockCommunityUser";
    communityId: string;
    userId: string;
};

type UpdateCommunity = {
    kind: "updateCommunity";
    communityId: string;
    name?: string;
    description?: string;
    rules?: AccessRules;
    permissions?: Partial<CommunityPermissions>;
    avatar?: Uint8Array;
    banner?: Uint8Array;
    gate?: AccessGate;
    isPublic?: boolean;
};

type CreateCommunity = {
    kind: "createCommunity";
    community: CommunitySummary;
    rules: AccessRules;
    defaultChannels: string[];
};

type ChangeCommunityRole = {
    kind: "changeCommunityRole";
    id: CommunityIdentifier;
    userId: string;
    newRole: MemberRole;
};

export type WorkerResult<T> = T extends PinMessage
    ? PinMessageResponse
    : T extends UnpinMessage
    ? UnpinMessageResponse
    : T extends GetUpdates
    ? UpdatesResult
    : T extends GetDeletedDirectMessage
    ? DeletedDirectMessageResponse
    : T extends GetDeletedGroupMessage
    ? DeletedGroupMessageResponse
    : T extends CreateUserClient
    ? void
    : T extends ChatEvents
    ? EventsResponse<ChatEvent>
    : T extends GetUsers
    ? UsersResponse
    : T extends MarkMessagesRead
    ? MarkReadResponse
    : T extends GetGroupDetails
    ? GroupChatDetailsResponse
    : T extends GetGroupDetailUpdates
    ? GroupChatDetails
    : T extends CurrentUser
    ? CurrentUserResponse
    : T extends CreateUserClient
    ? void
    : T extends GetAllCachedUsers
    ? UserLookup
    : T extends LastOnline
    ? Record<string, number>
    : T extends MarkAsOnline
    ? void
    : T extends ChatEventsWindow
    ? EventsResponse<ChatEvent>
    : T extends ChatEventsByEventIndex
    ? EventsResponse<ChatEvent>
    : T extends RehydrateMessage
    ? EventWrapper<Message>
    : T extends CheckUsername
    ? CheckUsernameResponse
    : T extends SearchUsers
    ? UserSummary[]
    : T extends MigrateUserPrincipal
    ? MigrateUserPrincipalResponse
    : T extends InitUserPrincipalMigration
    ? void
    : T extends GetUserStorageLimits
    ? StorageStatus
    : T extends GetPublicGroupSummary
    ? GroupChatSummary | undefined
    : T extends ToggleMuteNotifications
    ? ToggleMuteNotificationResponse
    : T extends ArchiveChat
    ? ArchiveChatResponse
    : T extends UnArchiveChat
    ? ArchiveChatResponse
    : T extends PinChat
    ? PinChatResponse
    : T extends UnpinChat
    ? UnpinChatResponse
    : T extends BlockUserFromDirectChat
    ? BlockUserResponse
    : T extends UnblockUserFromDirectChat
    ? UnblockUserResponse
    : T extends SetUserAvatar
    ? BlobReference
    : T extends DeleteGroup
    ? DeleteGroupResponse
    : T extends LeaveGroup
    ? LeaveGroupResponse
    : T extends JoinGroup
    ? JoinGroupResponse
    : T extends UpdateGroup
    ? UpdateGroupResponse
    : T extends RegisterPollVote
    ? RegisterPollVoteResponse
    : T extends DeleteMessage
    ? DeleteMessageResponse
    : T extends UndeleteMessage
    ? UndeleteMessageResponse
    : T extends AddReaction
    ? AddRemoveReactionResponse
    : T extends RemoveReaction
    ? AddRemoveReactionResponse
    : T extends BlockUserFromGroup
    ? BlockUserResponse
    : T extends UnblockUserFromGroup
    ? UnblockUserResponse
    : T extends GetProposalVoteDetailsRequest
    ? ProposalVoteDetails
    : T extends ListNervousSystemFunctions
    ? ListNervousSystemFunctionsResponse
    : T extends SendMessage
    ? [SendMessageResponse, Message]
    : T extends EditMessage
    ? EditMessageResponse
    : T extends RegisterUser
    ? RegisterUserResponse
    : T extends SubscriptionExists
    ? boolean
    : T extends PushSub
    ? void
    : T extends RemoveSub
    ? void
    : T extends InviteUsers
    ? InviteUsersResponse
    : T extends InviteUsersToCommunity
    ? InviteUsersResponse
    : T extends RemoveMember
    ? RemoveMemberResponse
    : T extends ChangeRole
    ? ChangeRoleResponse
    : T extends RegisterProposalVote
    ? RegisterProposalVoteResponse
    : T extends GetRecommendedGroups
    ? GroupChatSummary[]
    : T extends GetGroupRules
    ? AccessRules | undefined
    : T extends ExploreCommunities
    ? ExploreCommunitiesResponse
    : T extends DismissRecommendations
    ? void
    : T extends GroupInvite
    ? void
    : T extends SearchGroupChat
    ? SearchGroupChatResponse
    : T extends SearchDirectChat
    ? SearchDirectChatResponse
    : T extends RefreshAccountBalance
    ? Tokens
    : T extends GetThreadPreviews
    ? ThreadPreview[]
    : T extends GetUser
    ? PartialUserSummary | undefined
    : T extends GetPublicProfile
    ? PublicProfile
    : T extends SetUsername
    ? SetUsernameResponse
    : T extends SetBio
    ? SetBioResponse
    : T extends GetBio
    ? string
    : T extends WithdrawCrypto
    ? WithdrawCryptocurrencyResponse
    : T extends GroupMessagesByMessageIndex
    ? EventsResponse<Message>
    : T extends GetInviteCode
    ? InviteCodeResponse
    : T extends EnableInviteCode
    ? EnableInviteCodeResponse
    : T extends DisableInviteCode
    ? DisableInviteCodeResponse
    : T extends ResetInviteCode
    ? ResetInviteCodeResponse
    : T extends CreateGroupChat
    ? CreateGroupResponse
    : T extends SetCachedMessageFromNotification
    ? void
    : T extends FreezeGroup
    ? FreezeGroupResponse
    : T extends UnfreezeGroup
    ? UnfreezeGroupResponse
    : T extends AddHotGroupExclusion
    ? AddHotGroupExclusionResponse
    : T extends RemoveHotGroupExclusion
    ? RemoveHotGroupExclusionResponse
    : T extends DeleteFrozenGroup
    ? DeleteFrozenGroupResponse
    : T extends SuspendUser
    ? SuspendUserResponse
    : T extends UnsuspendUser
    ? UnsuspendUserResponse
    : T extends SetGroupUpgradeConcurrency
    ? SetGroupUpgradeConcurrencyResponse
    : T extends SetUserUpgradeConcurrency
    ? SetUserUpgradeConcurrencyResponse
    : T extends LoadFailedMessages
    ? Map<string, Record<number, EventWrapper<Message>>>
    : T extends DeleteFailedMessage
    ? void
    : T extends MarkSuspectedBot
    ? void
    : T extends ClaimPrize
    ? ClaimPrizeResponse
    : T extends PayForDiamondMembership
    ? PayForDiamondMembershipResponse
    : T extends UpdateMarketMakerConfig
    ? UpdateMarketMakerConfigResponse
    : T extends SetMessageReminder
    ? SetMessageReminderResponse
    : T extends CancelMessageReminder
    ? boolean
    : T extends ReferralLeaderboard
    ? ReferralLeaderboardResponse
    : T extends ReportMessage
    ? ReportMessageResponse
    : T extends DeclineInvitation
    ? DeclineInvitationResponse
    : T extends AddMembersToChannel
    ? AddMembersToChannelResponse
    : T extends BlockCommunityUser
    ? BlockCommunityUserResponse
    : T extends ChangeChannelRole
    ? ChangeRoleResponse
    : T extends ChangeCommunityRole
    ? ChangeCommunityRoleResponse
    : T extends DeclineChannelInvitation
    ? DeclineInvitationResponse
    : T extends DeleteChannelMessages
    ? DisableCommunityInviteCodeResponse
    : T extends ChannelEvents
    ? EventsResponse<GroupChatEvent>
    : T extends ChannelEventsByIndex
    ? EventsResponse<GroupChatEvent>
    : T extends ChannelEventsWindow
    ? EventsResponse<GroupChatEvent>
    : T extends CommunityInviteCode
    ? CommunityInviteCodeResponse
    : T extends JoinChannel
    ? JoinChannelResponse
    : T extends ChannelMessagesByMessageIndex
    ? EventsResponse<Message>
    : T extends RemoveCommunityMember
    ? RemoveCommunityMemberResponse
    : T extends RemoveChannelMember
    ? RemoveChannelMemberResponse
    : T extends ResetCommunityInviteCode
    ? EnableCommunityInviteCodeResponse
    : T extends SearchChannel
    ? SearchChannelResponse
    : T extends ToggleMuteCommunityNotifications
    ? ToggleMuteCommunityNotificationsResponse
    : T extends UnblockCommunityUser
    ? UnblockCommunityUserResponse
    : T extends UpdateCommunity
    ? UpdateCommunityResponse
    : T extends CreateCommunity
    ? CreateCommunityResponse
    : T extends JoinCommunity
    ? JoinCommunityResponse
    : T extends SearchGroups
    ? GroupSearchResponse
    : T extends GetCommunitySummary
    ? CommunitySummaryResponse
    : T extends ExploreChannels
    ? ChannelMatch[]
    : T extends GetCommunityDetails
    ? CommunityDetailsResponse
    : T extends GetCommunityDetailsUpdates
    ? CommunityDetails
    : T extends GetChannelSummary
    ? ChannelSummaryResponse
    : T extends AddToFavourites
    ? ManageFavouritesResponse
    : T extends RemoveFromFavourites
    ? ManageFavouritesResponse
    : never;
