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
    MakeGroupPrivateResponse,
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
    CandidateChannel,
    ChatSummary,
    ChatIdentifier,
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
} from "./user";
import type {
    SearchResponse,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    SearchScope,
    GroupSearchResponse,
} from "./search/search";
import type { Cryptocurrency, Tokens } from "./crypto";
import type { GroupInvite } from "./inviteCodes";
import type { CommunityPermissions, MemberRole } from "./permission";
import type { AccessGate, AccessRules } from "./access";
import type {
    AddMembersToChannelResponse,
    AddReactionResponse,
    BlockCommunityUserResponse,
    ChangeChannelRoleResponse,
    ChangeCommunityRoleResponse,
    Community,
    CommunityInviteCodeResponse,
    CommunityRulesResponse,
    CreateChannelResponse,
    CreateCommunityResponse,
    DeclineChannelInvitationResponse,
    DeleteChannelMessageResponse,
    DeleteChannelMessagesResponse,
    DeleteChannelResponse,
    DisableCommunityInviteCodeResponse,
    EditChannelMessageResponse,
    EnableCommunityInviteCodeResponse,
    JoinChannelResponse,
    JoinCommunityResponse,
    LeaveChannelResponse,
    MakeChannelPrivateResponse,
    MakeCommunityPrivateResponse,
    PinChannelMessageResponse,
    RemoveChannelMemberResponse,
    RemoveChannelReactionResponse,
    RemoveCommunityMemberResponse,
    SearchChannelResponse,
    SelectedChannelInitialResponse,
    SelectedChannelUpdatesResponse,
    SendChannelMessageResponse,
    ToggleMuteChannelNotificationsResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UndeleteChannelMessagesResponse,
    UpdateChannelResponse,
    UpdateCommunityResponse,
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
    | Search
    | SearchGroups
    | GetGroupRules
    | GetRecommendedGroups
    | RegisterProposalVote
    | ChangeRole
    | RemoveMember
    | InviteUsers
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
    | AddGroupChatReaction
    | RemoveGroupChatReaction
    | RemoveDirectChatReaction
    | AddDirectChatReaction
    | DeleteMessage
    | UndeleteMessage
    | RegisterPollVote
    | UpdateGroup
    | JoinGroup
    | JoinCommunity
    | LeaveGroup
    | DeleteGroup
    | MakeGroupPrivate
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
    | DirectChatEventsByEventIndex
    | GroupChatEventsByEventIndex
    | DirectChatEventsWindow
    | GroupChatEventsWindow
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
    | CreateChannel
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
    | AddCommunityReaction
    | BlockCommunityUser
    | ChangeChannelRole
    | DeclineChannelInvitation
    | DeleteChannel
    | DeleteChannelMessages
    | DeleteChannelMessage
    | DisableCommunityInviteCode
    | EditChannelMessage
    | EnableCommunityInviteCode
    | ChannelEvents
    | ChannelEventsByIndex
    | ChannelEventsWindow
    | CommunityInviteCode
    | JoinChannel
    | LeaveChannel
    | MakeChannelPrivate
    | MakeCommunityPrivate
    | ChannelMessagesByMessageIndex
    | PinChannelMessage
    | RemoveCommunityMember
    | RemoveChannelMember
    | RemoveChannelReaction
    | ResetCommunityInviteCode
    | CommunityRules
    | SearchChannel
    | SelectedChannelInitial
    | SelectedChannelUpdates
    | SendChannelMessage
    | ToggleMuteChannelNotifications
    | ToggleMuteCommunityNotifications
    | UnblockCommunityUser
    | UndeleteChannelMessages
    | UpdateChannel
    | UpdateCommunity
    | CreateCommunity
    | ChangeCommunityRole;

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

type CreateChannel = {
    candidate: CandidateChannel;
    communityId: string;
    kind: "createChannel";
};

type DisableInviteCode = {
    chatId: ChatIdentifier;
    kind: "disableInviteCode";
};

type EnableInviteCode = {
    chatId: ChatIdentifier;
    kind: "enableInviteCode";
};

type ResetInviteCode = {
    chatId: ChatIdentifier;
    kind: "resetInviteCode";
};

type GetInviteCode = {
    chatId: ChatIdentifier;
    kind: "getInviteCode";
};

type GroupMessagesByMessageIndex = {
    chatId: ChatIdentifier;
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
    threadsByChat: Record<string, [ThreadSyncDetails[], number | undefined]>;
    kind: "threadPreviews";
};

type RefreshAccountBalance = {
    crypto: Cryptocurrency;
    principal: string;
    kind: "refreshAccountBalance";
};

type SearchDirectChat = {
    userId: string;
    searchTerm: string;
    maxResults: number;
    kind: "searchDirectChat";
};

type SearchGroupChat = {
    chatId: ChatIdentifier;
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
    chatId: ChatIdentifier;
    kind: "dismissRecommendation";
};

type Search = {
    searchTerm: string;
    maxResults: number;
    scope: SearchScope;
    kind: "search";
};

type SearchGroups = {
    searchTerm: string;
    maxResults: number;
    kind: "searchGroups";
};

type GetGroupRules = {
    chatId: ChatIdentifier;
    kind: "getGroupRules";
};

type GetRecommendedGroups = {
    exclusions: string[];
    kind: "getRecommendedGroups";
};

type RegisterProposalVote = {
    chatId: ChatIdentifier;
    messageIndex: number;
    adopt: boolean;
    kind: "registerProposalVote";
};

type ChangeRole = {
    chatId: ChatIdentifier;
    userId: string;
    newRole: MemberRole;
    kind: "changeRole";
};

type RemoveMember = {
    chatId: ChatIdentifier;
    userId: string;
    kind: "removeMember";
};

type InviteUsers = {
    chatId: ChatIdentifier;
    userIds: string[];
    kind: "inviteUsers";
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
    chatType: ChatSummary["kind"];
    chatId: ChatIdentifier;
    user: CreatedUser;
    mentioned: User[];
    event: EventWrapper<Message>;
    threadRootMessageIndex?: number;
    kind: "sendMessage";
};

export type PinMessage = {
    chatId: ChatIdentifier;
    messageIndex: number;
    kind: "pinMessage";
};

export type UnpinMessage = {
    chatId: ChatIdentifier;
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
    chatId: ChatIdentifier;
    userId: string;
    kind: "blockUserFromGroupChat";
};

type UnblockUserFromGroup = {
    chatId: ChatIdentifier;
    userId: string;
    kind: "unblockUserFromGroupChat";
};

type AddGroupChatReaction = {
    chatId: ChatIdentifier;
    messageId: bigint;
    reaction: string;
    username: string;
    threadRootMessageIndex?: number;
    kind: "addGroupChatReaction";
};

type RemoveGroupChatReaction = {
    chatId: ChatIdentifier;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex?: number;
    kind: "removeGroupChatReaction";
};

type RemoveDirectChatReaction = {
    otherUserId: string;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex?: number;
    kind: "removeDirectChatReaction";
};

type AddDirectChatReaction = {
    otherUserId: string;
    messageId: bigint;
    reaction: string;
    username: string;
    threadRootMessageIndex?: number;
    kind: "addDirectChatReaction";
};

type DeleteMessage = {
    chatType: ChatSummary["kind"];
    chatId: ChatIdentifier;
    messageId: bigint;
    threadRootMessageIndex?: number;
    asPlatformModerator?: boolean;
    kind: "deleteMessage";
};

type UndeleteMessage = {
    chatType: ChatSummary["kind"];
    chatId: ChatIdentifier;
    messageId: bigint;
    threadRootMessageIndex?: number;
    kind: "undeleteMessage";
};

type RegisterPollVote = {
    chatId: ChatIdentifier;
    messageIdx: number;
    answerIdx: number;
    voteType: "register" | "delete";
    threadRootMessageIndex?: number;
    kind: "registerPollVote";
};

type UpdateGroup = {
    chatId: ChatIdentifier;
    name?: string;
    desc?: string;
    rules?: AccessRules;
    permissions?: Partial<ChatPermissions>;
    avatar?: Uint8Array;
    gate?: AccessGate;
    kind: "updateGroup";
};

type JoinGroup = {
    chatId: ChatIdentifier;
    kind: "joinGroup";
};

type JoinCommunity = {
    communityId: string;
    kind: "joinCommunity";
};

type LeaveGroup = {
    chatId: ChatIdentifier;
    kind: "leaveGroup";
};

type DeleteGroup = {
    chatId: ChatIdentifier;
    kind: "deleteGroup";
};

type MakeGroupPrivate = {
    chatId: ChatIdentifier;
    kind: "makeGroupPrivate";
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
    kind: "unpinChat";
};

type PinChat = {
    chatId: ChatIdentifier;
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
    chatId: ChatIdentifier;
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

type DirectChatEventsWindow = {
    eventIndexRange: IndexRange;
    theirUserId: string;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
    kind: "directChatEventsWindow";
};

type GroupChatEventsWindow = {
    eventIndexRange: IndexRange;
    chatId: ChatIdentifier;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
    threadRootMessageIndex: number | undefined;
    kind: "groupChatEventsWindow";
};

type DirectChatEventsByEventIndex = {
    theirUserId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
    kind: "directChatEventsByEventIndex";
};

type GroupChatEventsByEventIndex = {
    chatId: ChatIdentifier;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
    kind: "groupChatEventsByEventIndex";
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
    chatId: ChatIdentifier;
    latestEventIndex: number;
    kind: "getGroupDetails";
};

type GetGroupDetailUpdates = {
    chatId: ChatIdentifier;
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
    chatId: ChatIdentifier;
    reason: string | undefined;
    kind: "freezeGroup";
};

type UnfreezeGroup = {
    chatId: ChatIdentifier;
    kind: "unfreezeGroup";
};

type DeleteFrozenGroup = {
    chatId: ChatIdentifier;
    kind: "deleteFrozenGroup";
};

type AddHotGroupExclusion = {
    chatId: ChatIdentifier;
    kind: "addHotGroupExclusion";
};

type RemoveHotGroupExclusion = {
    chatId: ChatIdentifier;
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
    chatType: ChatSummary["kind"];
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
    chatId: ChatIdentifier;
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
    | Response<SearchResponse>
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
    | Response<MakeGroupPrivateResponse>
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
    | Response<Record<string, Record<number, EventWrapper<Message>>>>
    | Response<PayForDiamondMembershipResponse>
    | Response<ClaimPrizeResponse>
    | Response<UpdateMarketMakerConfigResponse>
    | Response<SetMessageReminderResponse>
    | Response<ReferralLeaderboardResponse>
    | Response<ReportMessageResponse>
    | Response<AddReactionResponse>
    | Response<BlockCommunityUserResponse>
    | Response<ChangeChannelRoleResponse>
    | Response<ChangeCommunityRoleResponse>
    | Response<CreateChannelResponse>
    | Response<DeclineChannelInvitationResponse>
    | Response<DeleteChannelResponse>
    | Response<DeleteChannelMessagesResponse>
    | Response<DeleteChannelMessageResponse>
    | Response<DisableCommunityInviteCode>
    | Response<EditChannelMessageResponse>
    | Response<CommunityInviteCodeResponse>
    | Response<JoinChannelResponse>
    | Response<LeaveChannelResponse>
    | Response<MakeChannelPrivateResponse>
    | Response<MakeCommunityPrivateResponse>
    | Response<PinChannelMessageResponse>
    | Response<RemoveCommunityMemberResponse>
    | Response<RemoveChannelMemberResponse>
    | Response<RemoveChannelReactionResponse>
    | Response<EnableCommunityInviteCodeResponse>
    | Response<CommunityRulesResponse>
    | Response<SearchChannelResponse>
    | Response<SelectedChannelInitialResponse>
    | Response<SelectedChannelUpdatesResponse>
    | Response<SendChannelMessageResponse>
    | Response<ToggleMuteChannelNotificationsResponse>
    | Response<ToggleMuteCommunityNotificationsResponse>
    | Response<UnblockCommunityUserResponse>
    | Response<UndeleteChannelMessagesResponse>
    | Response<UpdateChannelResponse>
    | Response<UpdateCommunityResponse>
    | Response<CreateCommunityResponse>
    | Response<JoinCommunityResponse>
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
    chatId: ChatIdentifier;
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
    chatId: ChatIdentifier;
    kind: "declineInvitation";
};

type AddMembersToChannel = {
    kind: "addMembersToChannel";
    communityId: string;
    channelId: string;
    userIds: string[];
    username: string;
};

type AddCommunityReaction = {
    kind: "addCommunityReaction";
    communityId: string;
    channelId: string;
    username: string;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex: number | undefined;
};

type BlockCommunityUser = {
    kind: "blockCommunityUser";
    communityId: string;
    userId: string;
};

type ChangeChannelRole = {
    kind: "changeChannelRole";
    communityId: string;
    channelId: string;
    userId: string;
    newRole: MemberRole;
};

type DeclineChannelInvitation = {
    kind: "declineChannelInvitation";
    communityId: string;
    channelId: string;
};

type DeleteChannel = {
    kind: "deleteChannel";
    communityId: string;
    channelId: string;
};

type DeleteChannelMessages = {
    kind: "deleteChannelMessages";
    communityId: string;
    channelId: string;
    messageIds: bigint[];
    threadRootMessageIndex: number | undefined;
    asPlatformModerator: boolean | undefined;
};

type DeleteChannelMessage = {
    kind: "deleteChannelMessage";
    communityId: string;
    channelId: string;
    messageId: bigint;
    sender: string;
    threadRootMessageIndex: number | undefined;
};

type DisableCommunityInviteCode = {
    kind: "disableCommunityInviteCode";
    communityId: string;
};

type EditChannelMessage = {
    kind: "editChannelMessage";
    communityId: string;
    channelId: string;
    message: Message;
    threadRootMessageIndex: number | undefined;
};

type EnableCommunityInviteCode = {
    kind: "enableCommunityInviteCode";
    communityId: string;
};

type ChannelEvents = {
    kind: "channelEvents";
    communityId: string;
    channelId: string;
    startIndex: number;
    ascending: boolean;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
};

type ChannelEventsByIndex = {
    kind: "channelEventsByIndex";
    communityId: string;
    channelId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
};

type ChannelEventsWindow = {
    kind: "channelEventsWindow";
    communityId: string;
    channelId: string;
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
    communityId: string;
    channelId: string;
};

type LeaveChannel = {
    kind: "leaveChannel";
    communityId: string;
    channelId: string;
};

type MakeChannelPrivate = {
    kind: "makeChannelPrivate";
    communityId: string;
    channelId: string;
};

type MakeCommunityPrivate = {
    kind: "makeCommunityPrivate";
    communityId: string;
};

type ChannelMessagesByMessageIndex = {
    kind: "channelMessagesByMessageIndex";
    communityId: string;
    channelId: string;
    messageIndexes: number[];
    latestClientEventIndex: number | undefined;
    threadRootMessageIndex: number | undefined;
};

type PinChannelMessage = {
    kind: "pinChannelMessage";
    communityId: string;
    channelId: string;
    messageIndex: number;
};

type RemoveCommunityMember = {
    kind: "removeCommunityMember";
    communityId: string;
    userId: string;
};

type RemoveChannelMember = {
    kind: "removeChannelMember";
    communityId: string;
    channelId: string;
    userId: string;
};

type RemoveChannelReaction = {
    kind: "removeChannelReaction";
    communityId: string;
    channelId: string;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex: number | undefined;
};

type ResetCommunityInviteCode = {
    kind: "resetCommunityInviteCode";
    communityId: string;
};

type CommunityRules = {
    kind: "communityRules";
    communityId: string;
    inviteCode: string | undefined;
};

type SearchChannel = {
    kind: "searchChannel";
    communityId: string;
    channelId: string;
    maxResults: number;
    users: string[];
    searchTerm: string;
};

type SelectedChannelInitial = {
    kind: "selectedChannelInitial";
    communityId: string;
    channelId: string;
};

type SelectedChannelUpdates = {
    kind: "selectedChannelUpdates";
    communityId: string;
    channelId: string;
    updatesSince: bigint;
};

type SendChannelMessage = {
    kind: "sendChannelMessage";
    communityId: string;
    channelId: string;
    senderName: string;
    mentioned: User[];
    event: EventWrapper<Message>;
    threadRootMessageIndex?: number;
};

type ToggleMuteChannelNotifications = {
    kind: "toggleMuteChannelNotifications";
    communityId: string;
    channelId: string;
    mute: boolean;
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

type UndeleteChannelMessages = {
    kind: "undeleteChannelMessages";
    communityId: string;
    channelId: string;
    messageIds: bigint[];
    threadRootMessageIndex: number | undefined;
};

type UpdateChannel = {
    kind: "updateChannel";
    communityId: string;
    channelId: string;
    name?: string;
    description?: string;
    rules?: AccessRules;
    permissions?: Partial<ChatPermissions>;
    avatar?: Uint8Array;
    banner?: Uint8Array;
    gate?: AccessGate;
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
};

type CreateCommunity = {
    kind: "createCommunity";
    community: Community;
    rules: AccessRules;
    defaultChannels: string[];
};

type ChangeCommunityRole = {
    kind: "changeCommunityRole";
    communityId: string;
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
    : T extends DirectChatEventsWindow
    ? EventsResponse<DirectChatEvent>
    : T extends GroupChatEventsWindow
    ? EventsResponse<GroupChatEvent>
    : T extends DirectChatEventsByEventIndex
    ? EventsResponse<DirectChatEvent>
    : T extends GroupChatEventsByEventIndex
    ? EventsResponse<GroupChatEvent>
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
    : T extends MakeGroupPrivate
    ? MakeGroupPrivateResponse
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
    : T extends AddDirectChatReaction
    ? AddRemoveReactionResponse
    : T extends RemoveDirectChatReaction
    ? AddRemoveReactionResponse
    : T extends AddGroupChatReaction
    ? AddRemoveReactionResponse
    : T extends RemoveGroupChatReaction
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
    : T extends Search
    ? SearchResponse
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
    ? Record<string, Record<number, EventWrapper<Message>>>
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
    : T extends AddCommunityReaction
    ? AddReactionResponse
    : T extends BlockCommunityUser
    ? BlockCommunityUserResponse
    : T extends ChangeChannelRole
    ? ChangeChannelRoleResponse
    : T extends ChangeCommunityRole
    ? ChangeCommunityRoleResponse
    : T extends CreateChannel
    ? CreateChannelResponse
    : T extends DeclineChannelInvitation
    ? DeclineChannelInvitationResponse
    : T extends DeleteChannel
    ? DeleteChannelResponse
    : T extends DeleteChannelMessages
    ? DeleteChannelMessagesResponse
    : T extends DeleteChannelMessage
    ? DeleteChannelMessageResponse
    : T extends DisableCommunityInviteCode
    ? DisableCommunityInviteCodeResponse
    : T extends EditChannelMessage
    ? EditChannelMessageResponse
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
    : T extends LeaveChannel
    ? LeaveChannelResponse
    : T extends MakeChannelPrivate
    ? MakeChannelPrivateResponse
    : T extends MakeCommunityPrivate
    ? MakeCommunityPrivateResponse
    : T extends ChannelMessagesByMessageIndex
    ? EventsResponse<Message>
    : T extends PinChannelMessage
    ? PinChannelMessageResponse
    : T extends RemoveCommunityMember
    ? RemoveCommunityMemberResponse
    : T extends RemoveChannelMember
    ? RemoveChannelMemberResponse
    : T extends RemoveChannelReaction
    ? RemoveChannelReactionResponse
    : T extends ResetCommunityInviteCode
    ? EnableCommunityInviteCodeResponse
    : T extends CommunityRules
    ? CommunityRulesResponse
    : T extends SearchChannel
    ? SearchChannelResponse
    : T extends SelectedChannelInitial
    ? SelectedChannelInitialResponse
    : T extends SelectedChannelUpdates
    ? SelectedChannelUpdatesResponse
    : T extends SendChannelMessage
    ? SendChannelMessageResponse
    : T extends ToggleMuteChannelNotifications
    ? ToggleMuteChannelNotificationsResponse
    : T extends ToggleMuteCommunityNotifications
    ? ToggleMuteCommunityNotificationsResponse
    : T extends UnblockCommunityUser
    ? UnblockCommunityUserResponse
    : T extends UndeleteChannelMessages
    ? UndeleteChannelMessagesResponse
    : T extends UpdateChannel
    ? UpdateChannelResponse
    : T extends UpdateCommunity
    ? UpdateCommunityResponse
    : T extends CreateCommunity
    ? CreateCommunityResponse
    : T extends JoinCommunity
    ? JoinCommunityResponse
    : T extends SearchGroups
    ? GroupSearchResponse
    : never;
