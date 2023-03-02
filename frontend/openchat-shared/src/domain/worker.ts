import type { AgentConfig } from "./config";
import type {
    AddMembersResponse,
    AddRemoveReactionResponse,
    BlockUserResponse,
    CandidateGroupChat,
    ChangeRoleResponse,
    ChatEvent,
    ChatStateFull,
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
    GroupPermissions,
    GroupRules,
    IndexRange,
    InviteCodeResponse,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListNervousSystemFunctionsResponse,
    MakeGroupPrivateResponse,
    MarkReadRequest,
    MarkReadResponse,
    MemberRole,
    MergedUpdatesResponse,
    Message,
    PendingCryptocurrencyWithdrawal,
    PinMessageResponse,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RemoveMemberResponse,
    SendMessageResponse,
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
} from "./chat";
import type { BlobReference, StorageStatus } from "./data/data";
import type { ToggleMuteNotificationResponse } from "./notifications";
import type {
    ArchiveChatResponse,
    ChallengeAttempt,
    CheckUsernameResponse,
    CreateChallengeResponse,
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
} from "./user";
import type {
    GroupSearchResponse,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
} from "./search/search";
import type { Cryptocurrency, Tokens } from "./crypto";
import type { GroupInvite } from "./inviteCodes";

/**
 * Worker request types
 */

type Request<T = unknown> = {
    correlationId: string;
    payload: T;
};

export type WorkerRequest =
    | DismissRecommendations
    | SearchGroups
    | GetGroupRules
    | GetRecommendedGroups
    | RegisterProposalVote
    | ChangeRole
    | RemoveMember
    | AddMembers
    | PushSub
    | RemoveSub
    | SubscriptionExists
    | CreateChallenge
    | RegisterUser
    | EditMessage
    | SendMessage
    | UnpinMessage
    | PinMessage
    | ListNervousSystemFunctions
    | BlockUserFromGroup
    | AddGroupChatReaction
    | RemoveGroupChatReaction
    | RemoveDirectChatReaction
    | AddDirectChatReaction
    | DeleteMessage
    | UndeleteMessage
    | RegisterPollVote
    | UpdateGroup
    | JoinGroup
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
    | GetInitialStateV2
    | GetUpdatesV2
    | GetDeletedGroupMessage
    | GetDeletedDirectMessage
    | LoadFailedMessages
    | DeleteFailedMessage
    | ClaimPrize
    | PayForDiamondMembership;

type SetCachedMessageFromNotification = Request<{
    chatId: string;
    threadRootMessageIndex: number | undefined;
    message: EventWrapper<Message>;
}> & {
    kind: "setCachedMessageFromNotification";
};

type CreateGroupChat = Request<{
    candidate: CandidateGroupChat;
}> & {
    kind: "createGroupChat";
};

type DisableInviteCode = Request<{
    chatId: string;
}> & {
    kind: "disableInviteCode";
};

type EnableInviteCode = Request<{
    chatId: string;
}> & {
    kind: "enableInviteCode";
};

type GetInviteCode = Request<{
    chatId: string;
}> & {
    kind: "getInviteCode";
};

type GroupMessagesByMessageIndex = Request<{
    chatId: string;
    messageIndexes: Set<number>;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "getGroupMessagesByMessageIndex";
};

type WithdrawCrypto = Request<{
    domain: PendingCryptocurrencyWithdrawal;
}> & {
    kind: "withdrawCryptocurrency";
};

type GetBio = Request<{
    userId?: string;
}> & {
    kind: "getBio";
};

type SetBio = Request<{
    bio: string;
}> & {
    kind: "setBio";
};

type SetUsername = Request<{
    userId: string;
    username: string;
}> & {
    kind: "setUsername";
};

type GetPublicProfile = Request<{
    userId?: string;
}> & {
    kind: "getPublicProfile";
};

type GetUser = Request<{
    userId: string;
    allowStale: boolean;
}> & {
    kind: "getUser";
};

type GetThreadPreviews = Request<{
    threadsByChat: Record<string, [ThreadSyncDetails[], number | undefined]>;
}> & {
    kind: "threadPreviews";
};

type RefreshAccountBalance = Request<{
    crypto: Cryptocurrency;
    principal: string;
}> & {
    kind: "refreshAccountBalance";
};

type SearchDirectChat = Request<{
    userId: string;
    searchTerm: string;
    maxResults: number;
}> & {
    kind: "searchDirectChat";
};

type SearchGroupChat = Request<{
    chatId: string;
    searchTerm: string;
    userIds: string[];
    maxResults: number;
}> & {
    kind: "searchGroupChat";
};

type SetGroupInvite = Request<{
    value: GroupInvite;
}> & {
    kind: "groupInvite";
};

type DismissRecommendations = Request<{
    chatId: string;
}> & {
    kind: "dismissRecommendation";
};

type SearchGroups = Request<{
    searchTerm: string;
    maxResults: number;
}> & {
    kind: "searchGroups";
};

type GetGroupRules = Request<{
    chatId: string;
}> & {
    kind: "getGroupRules";
};

type GetRecommendedGroups = Request<{
    exclusions: string[];
}> & {
    kind: "getRecommendedGroups";
};

type RegisterProposalVote = Request<{
    chatId: string;
    messageIndex: number;
    adopt: boolean;
}> & {
    kind: "registerProposalVote";
};

type ChangeRole = Request<{
    chatId: string;
    userId: string;
    newRole: MemberRole;
}> & {
    kind: "changeRole";
};

type RemoveMember = Request<{
    chatId: string;
    userId: string;
}> & {
    kind: "removeMember";
};

type AddMembers = Request<{
    chatId: string;
    userIds: string[];
    myUsername: string;
    allowBlocked: boolean;
}> & {
    kind: "addMembers";
};

type RemoveSub = Request<{
    subscription: PushSubscriptionJSON;
}> & {
    kind: "removeSubscription";
};

type PushSub = Request<{
    subscription: PushSubscriptionJSON;
}> & {
    kind: "pushSubscription";
};

type SubscriptionExists = Request<{
    p256dh_key: string;
}> & {
    kind: "subscriptionExists";
};

type CreateChallenge = Request & {
    kind: "createChallenge";
};

type RegisterUser = Request<{
    username: string;
    challengeAttempt: ChallengeAttempt;
    referredBy: string | undefined;
}> & {
    kind: "registerUser";
};

type EditMessage = Request<{
    chatType: "direct_chat" | "group_chat";
    chatId: string;
    msg: Message;
    threadRootMessageIndex?: number;
}> & {
    kind: "editMessage";
};

type SendMessage = Request<{
    chatType: "direct_chat" | "group_chat";
    chatId: string;
    user: CreatedUser;
    mentioned: User[];
    event: EventWrapper<Message>;
    threadRootMessageIndex?: number;
}> & {
    kind: "sendMessage";
};

type PinMessage = Request<{
    chatId: string;
    messageIndex: number;
}> & {
    kind: "pinMessage";
};

type UnpinMessage = Request<{
    chatId: string;
    messageIndex: number;
}> & {
    kind: "unpinMessage";
};

type ListNervousSystemFunctions = Request<{
    snsGovernanceCanisterId: string;
}> & {
    kind: "listNervousSystemFunctions";
};

type BlockUserFromGroup = Request<{
    chatId: string;
    userId: string;
}> & {
    kind: "blockUserFromGroupChat";
};

type AddGroupChatReaction = Request<{
    chatId: string;
    messageId: bigint;
    reaction: string;
    username: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "addGroupChatReaction";
};

type RemoveGroupChatReaction = Request<{
    chatId: string;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "removeGroupChatReaction";
};

type RemoveDirectChatReaction = Request<{
    otherUserId: string;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "removeDirectChatReaction";
};

type AddDirectChatReaction = Request<{
    otherUserId: string;
    messageId: bigint;
    reaction: string;
    username: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "addDirectChatReaction";
};

type DeleteMessage = Request<{
    chatType: "direct_chat" | "group_chat";
    chatId: string;
    messageId: bigint;
    threadRootMessageIndex?: number;
}> & {
    kind: "deleteMessage";
};

type UndeleteMessage = Request<{
    chatType: "direct_chat" | "group_chat";
    chatId: string;
    messageId: bigint;
    threadRootMessageIndex?: number;
}> & {
    kind: "undeleteMessage";
};

type RegisterPollVote = Request<{
    chatId: string;
    messageIdx: number;
    answerIdx: number;
    voteType: "register" | "delete";
    threadRootMessageIndex?: number;
}> & {
    kind: "registerPollVote";
};

type UpdateGroup = Request<{
    chatId: string;
    name?: string;
    desc?: string;
    rules?: GroupRules;
    permissions?: Partial<GroupPermissions>;
    avatar?: Uint8Array;
}> & {
    kind: "updateGroup";
};

type JoinGroup = Request<{
    chatId: string;
}> & {
    kind: "joinGroup";
};

type LeaveGroup = Request<{
    chatId: string;
}> & {
    kind: "leaveGroup";
};

type DeleteGroup = Request<{
    chatId: string;
}> & {
    kind: "deleteGroup";
};

type MakeGroupPrivate = Request<{
    chatId: string;
}> & {
    kind: "makeGroupPrivate";
};

type SetUserAvatar = Request<{
    data: Uint8Array;
}> & {
    kind: "setUserAvatar";
};

type UnblockUserFromDirectChat = Request<{
    userId: string;
}> & {
    kind: "unblockUserFromDirectChat";
};

type BlockUserFromDirectChat = Request<{
    userId: string;
}> & {
    kind: "blockUserFromDirectChat";
};

type UnpinChat = Request<{
    chatId: string;
}> & {
    kind: "unpinChat";
};

type PinChat = Request<{
    chatId: string;
}> & {
    kind: "pinChat";
};

type UnArchiveChat = Request<{
    chatId: string;
}> & {
    kind: "unarchiveChat";
};

type ArchiveChat = Request<{
    chatId: string;
}> & {
    kind: "archiveChat";
};

type ToggleMuteNotifications = Request<{
    chatId: string;
    muted: boolean;
}> & {
    kind: "toggleMuteNotifications";
};

type GetPublicGroupSummary = Request<{
    chatId: string;
}> & {
    kind: "getPublicGroupSummary";
};

type GetUserStorageLimits = Request & {
    kind: "getUserStorageLimits";
};

type InitUserPrincipalMigration = Request<{
    newPrincipal: string;
}> & {
    kind: "initUserPrincipalMigration";
};

type MigrateUserPrincipal = Request<{
    userId: string;
}> & {
    kind: "migrateUserPrincipal";
};

type CheckUsername = Request<{
    username: string;
}> & {
    kind: "checkUsername";
};

type SearchUsers = Request<{
    searchTerm: string;
    maxResults: number;
}> & {
    kind: "searchUsers";
};

type DirectChatEventsWindow = Request<{
    eventIndexRange: IndexRange;
    theirUserId: string;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
}> & {
    kind: "directChatEventsWindow";
};

type GroupChatEventsWindow = Request<{
    eventIndexRange: IndexRange;
    chatId: string;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
}> & {
    kind: "groupChatEventsWindow";
};

type DirectChatEventsByEventIndex = Request<{
    theirUserId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "directChatEventsByEventIndex";
};

type GroupChatEventsByEventIndex = Request<{
    chatId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "groupChatEventsByEventIndex";
};

type RehydrateMessage = Request<{
    chatType: "direct_chat" | "group_chat";
    chatId: string;
    message: EventWrapper<Message>;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "rehydrateMessage";
};

type Init = Request<Omit<AgentConfig, "logger">> & {
    kind: "init";
};

type CurrentUser = Request & {
    kind: "getCurrentUser";
};

type MarkMessagesRead = Request<MarkReadRequest> & {
    kind: "markMessagesRead";
};

type GetGroupDetails = Request<{
    chatId: string;
    latestEventIndex: number;
}> & {
    kind: "getGroupDetails";
};

type GetGroupDetailUpdates = Request<{
    chatId: string;
    previous: GroupChatDetails;
}> & {
    kind: "getGroupDetailsUpdates";
};

type GetAllCachedUsers = Request & {
    kind: "getAllCachedUsers";
};

type LastOnline = Request<{
    userIds: string[];
}> & {
    kind: "lastOnline";
};

type MarkAsOnline = Request & {
    kind: "markAsOnline";
};

type FreezeGroup = Request<{
    chatId: string;
    reason: string | undefined;
}> & {
    kind: "freezeGroup";
};

type UnfreezeGroup = Request<{
    chatId: string;
}> & {
    kind: "unfreezeGroup";
};

type DeleteFrozenGroup = Request<{
    chatId: string;
}> & {
    kind: "deleteFrozenGroup";
};

type AddHotGroupExclusion = Request<{
    chatId: string;
}> & {
    kind: "addHotGroupExclusion";
};

type RemoveHotGroupExclusion = Request<{
    chatId: string;
}> & {
    kind: "removeHotGroupExclusion";
};

type SuspendUser = Request<{
    userId: string;
    reason: string;
}> & {
    kind: "suspendUser";
};

type UnsuspendUser = Request<{
    userId: string;
}> & {
    kind: "unsuspendUser";
};

type MarkSuspectedBot = Request<void> & {
    kind: "markSuspectedBot";
};

type GetUsers = Request<{ users: UsersArgs; allowStale: boolean }> & {
    kind: "getUsers";
};

type ChatEvents = Request<{
    chatType: "direct_chat" | "group_chat";
    chatId: string;
    eventIndexRange: IndexRange;
    startIndex: number;
    ascending: boolean;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "chatEvents";
};

type CreateUserClient = Request<{ userId: string }> & {
    kind: "createUserClient";
};

type GetUpdatesV2 = Request<{
    currentState: ChatStateFull;
}> & {
    kind: "getUpdatesV2";
};

type GetInitialStateV2 = Request<Record<string, never>> & {
    kind: "getInitialStateV2";
};

type GetDeletedGroupMessage = Request<{
    chatId: string;
    messageId: bigint;
    threadRootMessageIndex: number | undefined;
}> & {
    kind: "getDeletedGroupMessage";
};

type GetDeletedDirectMessage = Request<{
    userId: string;
    messageId: bigint;
}> & {
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
    | Response<GroupSearchResponse>
    | Response<GroupRules | undefined>
    | Response<GroupChatSummary[]>
    | Response<RegisterProposalVoteResponse>
    | Response<ChangeRoleResponse>
    | Response<AddMembersResponse>
    | Response<RemoveMemberResponse>
    | Response<boolean>
    | Response<RegisterUserResponse>
    | Response<CreateChallengeResponse>
    | Response<EditMessageResponse>
    | Response<[SendMessageResponse, Message]>
    | Response<UnpinMessageResponse>
    | Response<PinMessageResponse>
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
    | Response<MergedUpdatesResponse>
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
    | Response<ClaimPrizeResponse>;

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
    chatId: string;
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

type LoadFailedMessages = Request & {
    kind: "loadFailedMessages";
};

type DeleteFailedMessage = Request<{
    chatId: string;
    messageId: bigint;
    threadRootMessageIndex: number | undefined;
}> & {
    kind: "deleteFailedMessage";
};

type ClaimPrize = Request<{
    chatId: string;
    messageId: bigint;
}> & {
    kind: "claimPrize";
};

type PayForDiamondMembership = Request<{
    userId: string;
    token: Cryptocurrency;
    duration: DiamondMembershipDuration;
    recurring: boolean;
    expectedPriceE8s: bigint;
}> & {
    kind: "payForDiamondMembership";
};
