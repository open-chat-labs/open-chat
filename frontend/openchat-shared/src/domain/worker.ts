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
    SetCommunityModerationFlagsResponse,
    SetGroupUpgradeConcurrencyResponse,
    DeclineInvitationResponse,
    ChatIdentifier,
    GroupChatIdentifier,
    DirectChatIdentifier,
    ChannelIdentifier,
    MultiUserChatIdentifier,
    PublicGroupSummaryResponse,
    MessageContext,
    PendingCryptocurrencyTransfer,
    TipMessageResponse,
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
    SetDisplayNameResponse,
    NamedAccount,
    SaveCryptoAccountResponse,
    SubmitProposalResponse,
} from "./user";
import type {
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    GroupSearchResponse,
    ExploreCommunitiesResponse,
    ExploreChannelsResponse,
} from "./search/search";
import type { GroupInvite, CommunityInvite } from "./inviteCodes";
import type { CommunityPermissions, MemberRole } from "./permission";
import type { AccessGate, Rules, UpdatedRules } from "./access";
import type {
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    ChangeCommunityRoleResponse,
    CommunitySummary,
    CreateCommunityResponse,
    JoinCommunityResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UpdateCommunityResponse,
    CommunityIdentifier,
    CommunitySummaryResponse,
    ChannelMatch,
    CommunityDetailsResponse,
    CommunityDetails,
    ChannelSummaryResponse,
    LeaveCommunityResponse,
    DeleteCommunityResponse,
    ConvertToCommunityResponse,
    ImportGroupResponse,
    CreateUserGroupResponse,
    UpdateUserGroupResponse,
    DeleteUserGroupsResponse,
    SetMemberDisplayNameResponse,
    FollowThreadResponse,
} from "./community";
import type { ChatPermissions } from "./permission";
import type { RegistryValue } from "./registry";
import type { StakeNeuronForSubmittingProposalsResponse } from "./proposalsBot";
import type { CandidateProposal } from "./proposals";
import type { OptionUpdate } from "./optionUpdate";
import type { AccountTransactionResult } from "./crypto";
/**
 * Worker request types
 */

export type CorrelatedWorkerRequest = WorkerRequest & {
    correlationId: string;
};

export type WorkerRequest =
    | DismissRecommendations
    | SearchGroups
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
    | MarkMessagesRead
    | GetAllCachedUsers
    | GetUsers
    | ChatEvents
    | CreateUserClient
    | Init
    | CurrentUser
    | SetGroupInvite
    | SetCommunityInvite
    | SearchGroupChat
    | SearchDirectChat
    | RefreshAccountBalance
    | GetAccountTransactions
    | GetThreadPreviews
    | GetUser
    | GetPublicProfile
    | SetUsername
    | SetDisplayName
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
    | SetCommunityModerationFlags
    | SetGroupUpgradeConcurrency
    | SetCommunityUpgradeConcurrency
    | SetUserUpgradeConcurrency
    | StakeNeuronForSubmittingProposals
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
    | ChannelEvents
    | ChannelEventsByIndex
    | ChannelEventsWindow
    | ChannelMessagesByMessageIndex
    | RemoveCommunityMember
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
    | GetChannelSummary
    | AddToFavourites
    | RemoveFromFavourites
    | LeaveCommunity
    | DeleteCommunity
    | ConvertGroupToCommunity
    | ImportGroupToCommunity
    | SetModerationFlags
    | ChangeCommunityRole
    | SetCommunityIndexes
    | UpdateRegistry
    | CreateUserGroup
    | UpdateUserGroup
    | DeleteUserGroups
    | SetMemberDisplayName
    | GetCachePrimerTimestamps
    | SetCachePrimerTimestamp
    | FollowThread
    | LoadSavedCryptoAccounts
    | SaveCryptoAccount
    | SubmitProposal
    | TipMessage;

type LoadSavedCryptoAccounts = {
    kind: "loadSavedCryptoAccounts";
};

type SaveCryptoAccount = {
    kind: "saveCryptoAccount";
    namedAccount: NamedAccount;
};

type TipMessage = {
    kind: "tipMessage";
    messageContext: MessageContext;
    messageId: bigint;
    transfer: PendingCryptocurrencyTransfer;
};

type SetCommunityIndexes = {
    kind: "setCommunityIndexes";
    indexes: Record<string, number>;
};

type SetModerationFlags = {
    kind: "setModerationFlags";
    flags: number;
};

type ImportGroupToCommunity = {
    kind: "importGroupToCommunity";
    groupId: GroupChatIdentifier;
    communityId: CommunityIdentifier;
};

type ConvertGroupToCommunity = {
    kind: "convertGroupToCommunity";
    chatId: GroupChatIdentifier;
    historyVisible: boolean;
    rules: Rules;
};

type DeleteCommunity = {
    kind: "deleteCommunity";
    id: CommunityIdentifier;
};

type LeaveCommunity = {
    kind: "leaveCommunity";
    id: CommunityIdentifier;
};

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
    communityLastUpdated: bigint;
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
    id: GroupChatIdentifier | CommunityIdentifier;
    kind: "disableInviteCode";
};

type EnableInviteCode = {
    id: GroupChatIdentifier | CommunityIdentifier;
    kind: "enableInviteCode";
};

type ResetInviteCode = {
    id: GroupChatIdentifier | CommunityIdentifier;
    kind: "resetInviteCode";
};

type GetInviteCode = {
    id: GroupChatIdentifier | CommunityIdentifier;
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

type SetDisplayName = {
    userId: string;
    displayName: string | undefined;
    kind: "setDisplayName";
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
    ledger: string;
    principal: string;
    kind: "refreshAccountBalance";
};

type GetAccountTransactions = {
    ledgerIndex: string;
    principal: string;
    kind: "getAccountTransactions";
};

type SearchDirectChat = {
    chatId: DirectChatIdentifier;
    searchTerm: string;
    maxResults: number;
    kind: "searchDirectChat";
};

type SearchGroupChat = {
    chatId: MultiUserChatIdentifier;
    searchTerm: string;
    userIds: string[];
    maxResults: number;
    kind: "searchGroupChat";
};

type SetGroupInvite = {
    value: GroupInvite;
    kind: "groupInvite";
};

type SetCommunityInvite = {
    value: CommunityInvite;
    kind: "communityInvite";
};

type DismissRecommendations = {
    chatId: GroupChatIdentifier;
    kind: "dismissRecommendation";
};

type ExploreCommunities = {
    searchTerm: string | undefined;
    pageIndex: number;
    pageSize: number;
    flags: number;
    languages: string[];
    kind: "exploreCommunities";
};

type SearchGroups = {
    searchTerm: string;
    maxResults: number;
    kind: "searchGroups";
};

type GetRecommendedGroups = {
    exclusions: string[];
    kind: "getRecommendedGroups";
};

type RegisterProposalVote = {
    chatId: MultiUserChatIdentifier;
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
    chatId: MultiUserChatIdentifier;
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
    displayName: string | undefined;
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
    messageContext: MessageContext;
    user: CreatedUser;
    mentioned: User[];
    event: EventWrapper<Message>;
    rulesAccepted: number | undefined;
    communityRulesAccepted: number | undefined;
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
    chatId: MultiUserChatIdentifier;
    userId: string;
    kind: "blockUserFromGroupChat";
};

type UnblockUserFromGroup = {
    chatId: MultiUserChatIdentifier;
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
    displayName: string | undefined;
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
    rules?: UpdatedRules;
    permissions?: Partial<ChatPermissions>;
    avatar?: Uint8Array;
    eventsTimeToLive?: OptionUpdate<bigint>;
    gate?: AccessGate;
    isPublic?: boolean;
    kind: "updateGroup";
};

type JoinGroup = {
    chatId: MultiUserChatIdentifier;
    kind: "joinGroup";
    credential?: string;
};

type JoinCommunity = {
    id: CommunityIdentifier;
    kind: "joinCommunity";
    credential?: string;
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
    favourite: boolean;
    kind: "unpinChat";
};

type PinChat = {
    chatId: ChatIdentifier;
    favourite: boolean;
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
    chatLastUpdated: bigint;
    kind: "getGroupDetails";
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

type SetCommunityModerationFlags = {
    communityId: string;
    flags: number;
    kind: "setCommunityModerationFlags";
};

type SetGroupUpgradeConcurrency = {
    value: number;
    kind: "setGroupUpgradeConcurrency";
};

type SetCommunityUpgradeConcurrency = {
    value: number;
    kind: "setCommunityUpgradeConcurrency";
};

type SetUserUpgradeConcurrency = {
    value: number;
    kind: "setUserUpgradeConcurrency";
};

type StakeNeuronForSubmittingProposals = {
    governanceCanisterId: string;
    stake: bigint;
    kind: "stakeNeuronForSubmittingProposals";
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

type CreateUserGroup = {
    communityId: string;
    name: string;
    userIds: string[];
    kind: "createUserGroup";
};

type UpdateUserGroup = {
    communityId: string;
    userGroupId: number;
    name: string | undefined;
    usersToAdd: string[];
    usersToRemove: string[];
    kind: "updateUserGroup";
};

type DeleteUserGroups = {
    communityId: string;
    userGroupIds: number[];
    kind: "deleteUserGroups";
};

type GetCachePrimerTimestamps = {
    kind: "getCachePrimerTimestamps";
};

type SetCachePrimerTimestamp = {
    chatIdentifierString: string;
    timestamp: bigint;
    kind: "setCachePrimerTimestamp";
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
export type WorkerResponseInner =
    | bigint
    | boolean
    | string
    | undefined
    | CreateGroupResponse
    | DisableInviteCodeResponse
    | EnableInviteCodeResponse
    | ResetInviteCodeResponse
    | InviteCodeResponse
    | EventsResponse<Message>
    | WithdrawCryptocurrencyResponse
    | SetBioResponse
    | SetUsernameResponse
    | PublicProfile
    | UserSummary
    | ThreadPreview[]
    | SearchDirectChatResponse
    | SearchGroupChatResponse
    | Rules
    | GroupChatSummary[]
    | RegisterProposalVoteResponse
    | ChangeRoleResponse
    | InviteUsersResponse
    | RemoveMemberResponse
    | RegisterUserResponse
    | EditMessageResponse
    | [SendMessageResponse, Message]
    | UnpinMessageResponse
    | PinMessageResponse
    | ProposalVoteDetails
    | ListNervousSystemFunctionsResponse
    | AddRemoveReactionResponse
    | DeleteMessageResponse
    | UndeleteMessageResponse
    | RegisterPollVoteResponse
    | UpdateGroupResponse
    | JoinGroupResponse
    | DeleteGroupResponse
    | LeaveGroupResponse
    | BlobReference
    | UnblockUserResponse
    | BlockUserResponse
    | UnpinChatResponse
    | PinChatResponse
    | ArchiveChatResponse
    | ArchiveChatResponse
    | ToggleMuteNotificationResponse
    | GroupChatSummary
    | StorageStatus
    | MigrateUserPrincipalResponse
    | UserSummary[]
    | CheckUsernameResponse
    | EventWrapper<Message>
    | EventsResponse<DirectChatEvent>
    | EventsResponse<GroupChatEvent>
    | EventsResponse<DirectChatEvent>
    | EventsResponse<GroupChatEvent>
    | Record<string, number>
    | GroupChatDetailsResponse
    | GroupChatDetails
    | MarkReadResponse
    | UserLookup
    | UsersResponse
    | CurrentUserResponse
    | EventsResponse<ChatEvent>
    | FreezeGroupResponse
    | UnfreezeGroupResponse
    | DeleteFrozenGroupResponse
    | AddHotGroupExclusion
    | RemoveHotGroupExclusion
    | SuspendUserResponse
    | UnsuspendUserResponse
    | UpdatesResult
    | DeletedDirectMessageResponse
    | DeletedGroupMessageResponse
    | StakeNeuronForSubmittingProposalsResponse
    | Map<string, Record<number, EventWrapper<Message>>>
    | PayForDiamondMembershipResponse
    | ClaimPrizeResponse
    | UpdateMarketMakerConfigResponse
    | SetMessageReminderResponse
    | ReferralLeaderboardResponse
    | ReportMessageResponse
    | BlockCommunityUserResponse
    | ChangeCommunityRoleResponse
    | ToggleMuteCommunityNotificationsResponse
    | UnblockCommunityUserResponse
    | UpdateCommunityResponse
    | CreateCommunityResponse
    | JoinCommunityResponse
    | CommunitySummaryResponse
    | ChannelMatch[]
    | CommunityDetailsResponse
    | CommunityDetails
    | ChannelSummaryResponse
    | ManageFavouritesResponse
    | LeaveCommunityResponse
    | DeleteCommunityResponse
    | ConvertToCommunityResponse
    | ExploreChannelsResponse
    | ImportGroupResponse
    | PublicGroupSummaryResponse
    | AddMembersToChannelResponse
    | RegistryValue
    | CreateUserGroupResponse
    | UpdateUserGroupResponse
    | DeleteUserGroupsResponse
    | TipMessageResponse
    | NamedAccount[]
    | SaveCryptoAccountResponse
    | SubmitProposalResponse
    | AccountTransactionResult
    | Record<string, bigint>;

export type WorkerResponse = Response<WorkerResponseInner>;

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
    users: UserSummary[];
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
    chatId: MultiUserChatIdentifier;
    messageId: bigint;
    kind: "claimPrize";
};

type PayForDiamondMembership = {
    userId: string;
    token: string;
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
    chatId: MultiUserChatIdentifier;
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
    displayName: string | undefined;
};

type BlockCommunityUser = {
    kind: "blockCommunityUser";
    id: CommunityIdentifier;
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

type ChannelMessagesByMessageIndex = {
    kind: "channelMessagesByMessageIndex";
    chatId: ChannelIdentifier;
    messageIndexes: number[];
    latestClientEventIndex: number | undefined;
    threadRootMessageIndex: number | undefined;
};

type RemoveCommunityMember = {
    kind: "removeCommunityMember";
    id: CommunityIdentifier;
    userId: string;
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
    id: CommunityIdentifier;
    userId: string;
};

type UpdateCommunity = {
    kind: "updateCommunity";
    communityId: string;
    name?: string;
    description?: string;
    rules?: UpdatedRules;
    permissions?: Partial<CommunityPermissions>;
    avatar?: Uint8Array;
    banner?: Uint8Array;
    gate?: AccessGate;
    isPublic?: boolean;
    primaryLanguage?: string;
};

type CreateCommunity = {
    kind: "createCommunity";
    community: CommunitySummary;
    rules: Rules;
    defaultChannels: string[];
    defaultChannelRules: Rules;
};

type ChangeCommunityRole = {
    kind: "changeCommunityRole";
    id: CommunityIdentifier;
    userId: string;
    newRole: MemberRole;
};

type UpdateRegistry = {
    kind: "updateRegistry";
};

type SetMemberDisplayName = {
    communityId: string;
    displayName: string | undefined;
    kind: "setMemberDisplayName";
};

type FollowThread = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number;
    follow: boolean;
    kind: "followThread";
};

type SubmitProposal = {
    governanceCanisterId: string;
    proposal: CandidateProposal;
    ledger: string;
    token: string;
    proposalRejectionFee: bigint;
    transactionFee: bigint;
    kind: "submitProposal";
};

export type WorkerResult<T> = T extends PinMessage
    ? PinMessageResponse
    : T extends LoadSavedCryptoAccounts
    ? NamedAccount[]
    : T extends SaveCryptoAccount
    ? SaveCryptoAccountResponse
    : T extends TipMessage
    ? TipMessageResponse
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
    ? PublicGroupSummaryResponse
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
    : T extends ExploreCommunities
    ? ExploreCommunitiesResponse
    : T extends DismissRecommendations
    ? void
    : T extends GroupInvite
    ? void
    : T extends CommunityInvite
    ? void
    : T extends SearchGroupChat
    ? SearchGroupChatResponse
    : T extends SearchDirectChat
    ? SearchDirectChatResponse
    : T extends RefreshAccountBalance
    ? bigint
    : T extends GetAccountTransactions
    ? AccountTransactionResult
    : T extends GetThreadPreviews
    ? ThreadPreview[]
    : T extends GetUser
    ? UserSummary | undefined
    : T extends GetPublicProfile
    ? PublicProfile
    : T extends SetUsername
    ? SetUsernameResponse
    : T extends SetDisplayName
    ? SetDisplayNameResponse
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
    : T extends SetCommunityModerationFlags
    ? SetCommunityModerationFlagsResponse
    : T extends SetGroupUpgradeConcurrency
    ? SetGroupUpgradeConcurrencyResponse
    : T extends SetCommunityUpgradeConcurrency
    ? SetGroupUpgradeConcurrencyResponse
    : T extends SetUserUpgradeConcurrency
    ? SetUserUpgradeConcurrencyResponse
    : T extends StakeNeuronForSubmittingProposals
    ? StakeNeuronForSubmittingProposalsResponse
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
    : T extends ChannelEvents
    ? EventsResponse<GroupChatEvent>
    : T extends ChannelEventsByIndex
    ? EventsResponse<GroupChatEvent>
    : T extends ChannelEventsWindow
    ? EventsResponse<GroupChatEvent>
    : T extends ChannelMessagesByMessageIndex
    ? EventsResponse<Message>
    : T extends RemoveCommunityMember
    ? RemoveMemberResponse
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
    ? ExploreChannelsResponse
    : T extends GetCommunityDetails
    ? CommunityDetailsResponse
    : T extends GetChannelSummary
    ? ChannelSummaryResponse
    : T extends AddToFavourites
    ? ManageFavouritesResponse
    : T extends RemoveFromFavourites
    ? ManageFavouritesResponse
    : T extends LeaveCommunity
    ? LeaveCommunityResponse
    : T extends DeleteCommunity
    ? DeleteCommunityResponse
    : T extends ConvertGroupToCommunity
    ? ConvertToCommunityResponse
    : T extends ImportGroupToCommunity
    ? ImportGroupResponse
    : T extends UpdateRegistry
    ? RegistryValue
    : T extends SetCommunityIndexes
    ? boolean
    : T extends CreateUserGroup
    ? CreateUserGroupResponse
    : T extends UpdateUserGroup
    ? UpdateUserGroupResponse
    : T extends DeleteUserGroups
    ? DeleteUserGroupsResponse
    : T extends SetMemberDisplayName
    ? SetMemberDisplayNameResponse
    : T extends SubmitProposal
    ? SubmitProposalResponse
    : T extends FollowThread
    ? FollowThreadResponse
    : T extends GetCachePrimerTimestamps
    ? Record<string, bigint>
    : T extends SetCachePrimerTimestamp
    ? void
    : never;
