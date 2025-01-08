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
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventWrapper,
    FreezeGroupResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
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
    AcceptP2PSwapResponse,
    CancelP2PSwapResponse,
    ChatEventsArgs,
    ChatEventsResponse,
    JoinVideoCallResponse,
    VideoCallPresence,
    SetVideoCallPresenceResponse,
    VideoCallParticipantsResponse,
    SetPinNumberResponse,
    AcceptedRules,
    ChitState,
    MessageActivityFeedResponse,
} from "./chat";
import type { BlobReference, StorageStatus } from "./data/data";
import type { UpdateMarketMakerConfigArgs, UpdateMarketMakerConfigResponse } from "./marketMaker";
import type { ToggleMuteNotificationResponse } from "./notifications";
import type {
    ArchiveChatResponse,
    CheckUsernameResponse,
    CreatedUser,
    CurrentUserResponse,
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
    DiamondMembershipFees,
    PayForDiamondMembershipResponse,
    SetMessageReminderResponse,
    SetUserUpgradeConcurrencyResponse,
    ManageFavouritesResponse,
    SetDisplayNameResponse,
    NamedAccount,
    SaveCryptoAccountResponse,
    SubmitProposalResponse,
    SwapTokensResponse,
    TokenSwapStatusResponse,
    ApproveTransferResponse,
    SubmitProofOfUniquePersonhoodResponse,
} from "./user";
import type {
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    GroupSearchResponse,
    ExploreCommunitiesResponse,
    ExploreChannelsResponse,
    ExploreBotsResponse,
} from "./search/search";
import type { GroupInvite, CommunityInvite } from "./inviteCodes";
import type {
    AccessTokenType,
    CommunityPermissions,
    MemberRole,
    OptionalChatPermissions,
} from "./permission";
import type { AccessGateConfig, Rules, UpdatedRules, VerifiedCredentialArgs } from "./access";
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
    FreezeCommunityResponse,
    UnfreezeCommunityResponse,
} from "./community";
import type { UpdateBtcBalanceResponse } from "./bitcoin";
import type { RegistryValue } from "./registry";
import type {
    StakeNeuronForSubmittingProposalsResponse,
    TopUpNeuronResponse,
} from "./proposalsBot";
import type { CandidateProposal } from "./proposals";
import type { OptionUpdate } from "./optionUpdate";
import type {
    AccountTransactionResult,
    CryptocurrencyDetails,
    TokenExchangeRates,
    WalletConfig,
} from "./crypto";
import type { DexId } from "./dexes";
import type {
    AuthenticationPrincipalsResponse,
    ChallengeAttempt,
    CreateOpenChatIdentityResponse,
    GenerateChallengeResponse,
    GetDelegationResponse,
    GetOpenChatIdentityResponse,
    LinkIdentitiesResponse,
    PrepareDelegationResponse,
    SiwePrepareLoginResponse,
    SiwsPrepareLoginResponse,
} from "./identity";
import type { GenerateMagicLinkResponse } from "./email";
import type {
    ApproveResponse,
    MarkDeployedResponse,
    PendingDeploymentResponse,
    ProposeResponse,
    ProposedResponse,
    RejectReason,
    RejectResponse,
    TranslationCorrections,
} from "./i18n";
import type {
    ChitEventsRequest,
    ChitEventsResponse,
    ChitLeaderboardResponse,
    ClaimDailyChitResponse,
    ExternalAchievement,
} from "./chit";
import type { JsonnableDelegationChain } from "@dfinity/identity";
import type { Verification } from "./wallet";
import type {
    BotCommandResponse,
    BotDefinition,
    BotDefinitionResponse,
    BotsResponse,
    ExternalBot,
    SlashCommandPermissions,
} from "./bots";

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
    | SearchUsers
    | CheckUsername
    | RehydrateMessage
    | ChatEventsBatch
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
    | GenerateIdentityChallenge
    | CreateOpenChatIdentity
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
    | FreezeCommunity
    | UnfreezeCommunity
    | DeleteFrozenGroup
    | AddHotGroupExclusion
    | RemoveHotGroupExclusion
    | AddRemoveSwapProvider
    | AddMessageFilter
    | RemoveMessageFilter
    | SetTokenEnabled
    | SuspendUser
    | UnsuspendUser
    | GetUpdates
    | GetBots
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
    | MarkLocalGroupIndexFull
    | SetDiamondMembershipFees
    | StakeNeuronForSubmittingProposals
    | TopUpNeuronForSubmittingProposals
    | UpdateMarketMakerConfig
    | SetMessageReminder
    | CancelMessageReminder
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
    | ExploreBots
    | RegisterBot
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
    | FollowThread
    | LoadSavedCryptoAccounts
    | SaveCryptoAccount
    | SubmitProposal
    | TipMessage
    | CanSwap
    | GetTokenSwaps
    | GetTokenSwapQuotes
    | SwapTokens
    | TokenSwapStatus
    | ApproveTransfer
    | DeleteDirectChat
    | GetDiamondMembershipFees
    | GetReportedMessages
    | GetExchangeRates
    | AcceptP2PSwap
    | CancelP2PSwap
    | ProposeTranslation
    | ApproveTranslation
    | RejectTranslation
    | MarkTranslationsDeployed
    | GetProposedTranslations
    | GetTranslationsPendingDeployment
    | JoinVideoCall
    | GetAccessToken
    | GetLocalUserIndexForUser
    | UpdateBtcBalance
    | GenerateMagicLink
    | GetSignInWithEmailDelegation
    | SiwePrepareLogin
    | SiwsPrepareLogin
    | LoginWithWallet
    | GetDelegationWithWallet
    | SetVideoCallPresence
    | VideoCallParticipants
    | SetPinNumber
    | ClaimDailyChit
    | ChitLeaderboard
    | ChitEventsRequest
    | MarkAchievementsSeen
    | SubmitProofOfUniquePersonhood
    | LinkIdentities
    | GetAuthenticationPrincipals
    | ConfigureWallet
    | ClearCachedData
    | SetCommunityReferral
    | GetExternalAchievements
    | CancelInvites
    | MessageActivityFeed
    | MarkActivityFeedRead
    | DeleteUser
    | AddBot
    | RemoveInstalledBot
    | UpdateInstalledBot
    | UpdateRegisteredBot
    | GetBotDefinition
    | CallBotCommandEndpoint;

type CallBotCommandEndpoint = {
    kind: "callBotCommandEndpoint";
    endpoint: string;
    token: string;
};

type GetBotDefinition = {
    kind: "getBotDefinition";
    endpoint: string;
};

type UpdateRegisteredBot = {
    kind: "updateRegisteredBot";
    id: string;
    ownerId?: string;
    name?: string;
    avatarUrl?: string;
    endpoint?: string;
    definition?: BotDefinition;
};

type AddBot = {
    kind: "addBot";
    id: CommunityIdentifier | GroupChatIdentifier;
    botId: string;
    grantedPermissions: SlashCommandPermissions;
};

type UpdateInstalledBot = {
    kind: "updateInstalledBot";
    id: CommunityIdentifier | GroupChatIdentifier;
    botId: string;
    grantedPermissions: SlashCommandPermissions;
};

type RemoveInstalledBot = {
    kind: "removeInstalledBot";
    id: CommunityIdentifier | GroupChatIdentifier;
    botId: string;
};

type MarkActivityFeedRead = {
    kind: "markActivityFeedRead";
    readUpTo: bigint;
};

type MessageActivityFeed = {
    kind: "messageActivityFeed";
};

type GetExternalAchievements = {
    kind: "getExternalAchievements";
};

type SetCommunityReferral = {
    kind: "setCommunityReferral";
    communityId: CommunityIdentifier;
    referredBy: string;
};

type ClearCachedData = {
    kind: "clearCachedData";
};

type ConfigureWallet = {
    kind: "configureWallet";
    config: WalletConfig;
};

type GetAuthenticationPrincipals = {
    kind: "getAuthenticationPrincipals";
};

type SubmitProofOfUniquePersonhood = {
    kind: "submitProofOfUniquePersonhood";
    iiPrincipal: string;
    credential: string;
};

type MarkAchievementsSeen = {
    kind: "markAchievementsSeen";
};

type VideoCallParticipants = {
    kind: "videoCallParticipants";
    chatId: MultiUserChatIdentifier;
    messageId: bigint;
    updatesSince?: bigint;
};

type SetVideoCallPresence = {
    kind: "setVideoCallPresence";
    chatId: MultiUserChatIdentifier;
    messageId: bigint;
    presence: VideoCallPresence;
    newAchievement: boolean;
};

type GetLocalUserIndexForUser = {
    kind: "getLocalUserIndexForUser";
    userId: string;
};

type GetAccessToken = {
    kind: "getAccessToken";
    chatId: ChatIdentifier;
    accessTokenType: AccessTokenType;
    localUserIndex: string;
};

type JoinVideoCall = {
    kind: "joinVideoCall";
    chatId: ChatIdentifier;
    messageId: bigint;
    newAchievement: boolean;
};

type ProposeTranslation = {
    kind: "proposeTranslation";
    locale: string;
    key: string;
    value: string;
};

type ApproveTranslation = {
    kind: "approveTranslation";
    id: bigint;
};

type RejectTranslation = {
    kind: "rejectTranslation";
    id: bigint;
    reason: RejectReason;
};

type MarkTranslationsDeployed = {
    kind: "markTranslationsDeployed";
};

type GetProposedTranslations = {
    kind: "getProposedTranslations";
};

type GetTranslationsPendingDeployment = {
    kind: "getTranslationsPendingDeployment";
};

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
    decimals: number;
    pin: string | undefined;
};

type CanSwap = {
    kind: "canSwap";
    tokenLedgers: Set<string>;
};

type GetTokenSwaps = {
    kind: "getTokenSwaps";
    inputTokenLedger: string;
    outputTokenLedgers: string[];
};

type GetTokenSwapQuotes = {
    kind: "getTokenSwapQuotes";
    inputTokenLedger: string;
    outputTokenLedger: string;
    amountIn: bigint;
};

type SwapTokens = {
    kind: "swapTokens";
    swapId: bigint;
    inputTokenDetails: CryptocurrencyDetails;
    outputTokenDetails: CryptocurrencyDetails;
    amountIn: bigint;
    minAmountOut: bigint;
    dex: DexId;
    pin: string | undefined;
};

type TokenSwapStatus = {
    kind: "tokenSwapStatus";
    swapId: bigint;
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
    latestKnownUpdate: bigint | undefined;
    kind: "getGroupMessagesByMessageIndex";
};

type WithdrawCrypto = {
    domain: PendingCryptocurrencyWithdrawal;
    pin: string | undefined;
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
    chitState: ChitState;
    userId: string;
    allowStale: boolean;
    kind: "getUser";
};

type GetThreadPreviews = {
    threadsByChat: Map<string, [ThreadSyncDetails[], bigint | undefined]>;
    kind: "threadPreviews";
};

type RefreshAccountBalance = {
    ledger: string;
    principal: string;
    kind: "refreshAccountBalance";
};

type GetAccountTransactions = {
    ledgerIndex: string;
    fromId?: bigint;
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

type RegisterBot = {
    kind: "registerBot";
    principal: string;
    bot: ExternalBot;
};

type ExploreBots = {
    searchTerm: string | undefined;
    pageIndex: number;
    pageSize: number;
    kind: "exploreBots";
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
    id: MultiUserChatIdentifier | CommunityIdentifier;
    userIds: string[];
    callerUsername: string;
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
    blockLevelMarkdown?: boolean;
    newAchievement: boolean;
    kind: "editMessage";
};

type SendMessage = {
    messageContext: MessageContext;
    user: CreatedUser;
    mentioned: User[];
    event: EventWrapper<Message>;
    acceptedRules: AcceptedRules | undefined;
    messageFilterFailed: bigint | undefined;
    pin: string | undefined;
    newAchievement: boolean;
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
    newAchievement: boolean;
    kind: "addReaction";
};

type DeleteMessage = {
    chatId: ChatIdentifier;
    messageId: bigint;
    threadRootMessageIndex?: number;
    asPlatformModerator?: boolean;
    newAchievement: boolean;
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
    threadRootMessageIndex: number | undefined;
    newAchievement: boolean;
    kind: "registerPollVote";
};

type UpdateGroup = {
    chatId: MultiUserChatIdentifier;
    name?: string;
    desc?: string;
    rules?: UpdatedRules;
    permissions?: OptionalChatPermissions;
    avatar?: Uint8Array;
    eventsTimeToLive?: OptionUpdate<bigint>;
    gateConfig?: AccessGateConfig;
    isPublic?: boolean;
    kind: "updateGroup";
    messagesVisibleToNonMembers?: boolean;
    externalUrl?: string;
};

type JoinGroup = {
    chatId: MultiUserChatIdentifier;
    credentialArgs: VerifiedCredentialArgs | undefined;
    kind: "joinGroup";
    referredBy?: string;
};

type JoinCommunity = {
    id: CommunityIdentifier;
    credentialArgs: VerifiedCredentialArgs | undefined;
    kind: "joinCommunity";
    referredBy?: string;
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
    id: ChatIdentifier | CommunityIdentifier;
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

type CheckUsername = {
    username: string;
    kind: "checkUsername";
    isBot: boolean;
};

type SearchUsers = {
    searchTerm: string;
    maxResults: number;
    kind: "searchUsers";
};

type ChatEventsBatch = {
    localUserIndex: string;
    requests: ChatEventsArgs[];
    cachePrimer: boolean;
    kind: "chatEventsBatch";
};

type ChatEventsWindow = {
    eventIndexRange: IndexRange;
    chatId: ChatIdentifier;
    messageIndex: number;
    latestKnownUpdate: bigint | undefined;
    threadRootMessageIndex: number | undefined;
    kind: "chatEventsWindow";
};

type ChatEventsByEventIndex = {
    chatId: ChatIdentifier;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestKnownUpdate: bigint | undefined;
    kind: "chatEventsByEventIndex";
};

export type RehydrateMessage = {
    chatId: ChatIdentifier;
    message: EventWrapper<Message>;
    threadRootMessageIndex: number | undefined;
    latestKnownUpdate: bigint | undefined;
    kind: "rehydrateMessage";
};

export type Init = Omit<AgentConfig, "logger"> & {
    kind: "init";
};

type GenerateIdentityChallenge = {
    kind: "generateIdentityChallenge";
};

type CreateOpenChatIdentity = {
    kind: "createOpenChatIdentity";
    challengeAttempt: ChallengeAttempt | undefined;
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

type FreezeCommunity = {
    id: CommunityIdentifier;
    reason: string | undefined;
    kind: "freezeCommunity";
};

type UnfreezeCommunity = {
    id: CommunityIdentifier;
    kind: "unfreezeCommunity";
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

type AddRemoveSwapProvider = {
    swapProvider: DexId;
    add: boolean;
    kind: "addRemoveSwapProvider";
};

type AddMessageFilter = {
    regex: string;
    kind: "addMessageFilter";
};

type RemoveMessageFilter = {
    id: bigint;
    kind: "removeMessageFilter";
};

type SetTokenEnabled = {
    ledger: string;
    enabled: boolean;
    kind: "setTokenEnabled";
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

type MarkLocalGroupIndexFull = {
    canisterId: string;
    full: boolean;
    kind: "markLocalGroupIndexFull";
};

type SetDiamondMembershipFees = {
    fees: DiamondMembershipFees[];
    kind: "setDiamondMembershipFees";
};

type StakeNeuronForSubmittingProposals = {
    governanceCanisterId: string;
    stake: bigint;
    kind: "stakeNeuronForSubmittingProposals";
};

type TopUpNeuronForSubmittingProposals = {
    governanceCanisterId: string;
    amount: bigint;
    kind: "topUpNeuronForSubmittingProposals";
};

type GetUsers = {
    chitState: ChitState;
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
    latestKnownUpdate: bigint | undefined;
    kind: "chatEvents";
};

type CreateUserClient = {
    userId: string;
    kind: "createUserClient";
};

type GetUpdates = {
    kind: "getUpdates";
    initialLoad: boolean;
};

type GetBots = {
    kind: "getBots";
    initialLoad: boolean;
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

type UpdateBtcBalance = {
    userId: string;
    kind: "updateBtcBalance";
};

type GenerateMagicLink = {
    email: string;
    sessionKey: Uint8Array;
    kind: "generateMagicLink";
};

type GetSignInWithEmailDelegation = {
    email: string;
    sessionKey: Uint8Array;
    expiration: bigint;
    kind: "getSignInWithEmailDelegation";
};

type SiwePrepareLogin = {
    address: string;
    kind: "siwePrepareLogin";
};

type SiwsPrepareLogin = {
    address: string;
    kind: "siwsPrepareLogin";
};

type LoginWithWallet = {
    token: "eth" | "sol";
    address: string;
    signature: string;
    sessionKey: Uint8Array;
    kind: "loginWithWallet";
};

type GetDelegationWithWallet = {
    token: "eth" | "sol";
    address: string;
    sessionKey: Uint8Array;
    expiration: bigint;
    kind: "getDelegationWithWallet";
};

type LinkIdentities = {
    kind: "linkIdentities";
    initiatorKey: CryptoKeyPair;
    initiatorDelegation: JsonnableDelegationChain;
    initiatorIsIIPrincipal: boolean;
    approverKey: CryptoKeyPair;
    approverDelegation: JsonnableDelegationChain;
};

type DeleteUser = {
    kind: "deleteUser";
    userId: string;
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
    | void
    | bigint
    | boolean
    | string
    | string[]
    | undefined
    | [number, number]
    | GenerateChallengeResponse
    | CreateOpenChatIdentityResponse
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
    | ToggleMuteNotificationResponse
    | GroupChatSummary
    | StorageStatus
    | UserSummary[]
    | CheckUsernameResponse
    | EventWrapper<Message>
    | ChatEventsResponse[]
    | EventsResponse<ChatEvent>
    | Record<string, number>
    | GroupChatDetailsResponse
    | GroupChatDetails
    | MarkReadResponse
    | UserLookup
    | UsersResponse
    | CurrentUserResponse
    | FreezeGroupResponse
    | UnfreezeGroupResponse
    | FreezeCommunityResponse
    | UnfreezeCommunityResponse
    | DeleteFrozenGroupResponse
    | AddHotGroupExclusion
    | RemoveHotGroupExclusion
    | AddMessageFilter
    | RemoveMessageFilter
    | SuspendUserResponse
    | UnsuspendUserResponse
    | UpdatesResult
    | BotsResponse
    | DeletedDirectMessageResponse
    | DeletedGroupMessageResponse
    | StakeNeuronForSubmittingProposalsResponse
    | TopUpNeuronResponse
    | Map<string, Record<number, EventWrapper<Message>>>
    | PayForDiamondMembershipResponse
    | ClaimPrizeResponse
    | UpdateMarketMakerConfigResponse
    | SetMessageReminderResponse
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
    | [RegistryValue, boolean]
    | CreateUserGroupResponse
    | UpdateUserGroupResponse
    | DeleteUserGroupsResponse
    | TipMessageResponse
    | NamedAccount[]
    | SaveCryptoAccountResponse
    | SubmitProposalResponse
    | ApproveTransferResponse
    | AccountTransactionResult
    | Record<string, bigint>
    | Record<string, DexId[]>
    | Set<string>
    | [DexId, bigint][]
    | SwapTokensResponse
    | TokenSwapStatusResponse
    | DiamondMembershipFees[]
    | TranslationCorrections
    | AcceptP2PSwapResponse
    | CancelP2PSwapResponse
    | Record<string, TokenExchangeRates>
    | ProposeResponse
    | ApproveResponse
    | RejectResponse
    | MarkDeployedResponse
    | ProposedResponse
    | PendingDeploymentResponse
    | JoinVideoCallResponse
    | UpdateBtcBalanceResponse
    | GenerateMagicLinkResponse
    | SiwePrepareLoginResponse
    | SiwsPrepareLoginResponse
    | SetVideoCallPresenceResponse
    | VideoCallParticipantsResponse
    | SetPinNumberResponse
    | ClaimDailyChitResponse
    | ChitLeaderboardResponse
    | ChitEventsResponse
    | SubmitProofOfUniquePersonhoodResponse
    | AuthenticationPrincipalsResponse
    | ExternalAchievement[]
    | MessageActivityFeedResponse
    | ExploreBotsResponse
    | BotDefinitionResponse
    | BotCommandResponse;

export type WorkerResponse = Response<WorkerResponseInner>;

type Response<T> = {
    kind: "worker_response";
    correlationId: string;
    response: T;
    final: boolean;
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
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageId: bigint;
    deleteMessage: boolean;
    kind: "reportMessage";
};

type ApproveTransfer = {
    spender: string;
    ledger: string;
    amount: bigint;
    expiresIn: bigint | undefined;
    pin: string | undefined;
    kind: "approveTransfer";
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
    latestKnownUpdate: bigint | undefined;
};

type ChannelEventsByIndex = {
    kind: "channelEventsByIndex";
    chatId: ChannelIdentifier;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestKnownUpdate: bigint | undefined;
};

type ChannelEventsWindow = {
    kind: "channelEventsWindow";
    chatId: ChannelIdentifier;
    messageIndex: number;
    threadRootMessageIndex: number | undefined;
    latestKnownUpdate: bigint | undefined;
};

type ChannelMessagesByMessageIndex = {
    kind: "channelMessagesByMessageIndex";
    chatId: ChannelIdentifier;
    messageIndexes: number[];
    latestKnownUpdate: bigint | undefined;
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
    gateConfig?: AccessGateConfig;
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
    newAchievement: boolean;
    kind: "setMemberDisplayName";
};

type FollowThread = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number;
    follow: boolean;
    newAchievement: boolean;
    kind: "followThread";
};

type SubmitProposal = {
    currentUserId: string;
    governanceCanisterId: string;
    proposal: CandidateProposal;
    ledger: string;
    token: string;
    proposalRejectionFee: bigint;
    transactionFee: bigint;
    kind: "submitProposal";
};

type DeleteDirectChat = {
    kind: "deleteDirectChat";
    userId: string;
    blockUser: boolean;
};

type GetDiamondMembershipFees = {
    kind: "diamondMembershipFees";
};

type GetExchangeRates = {
    kind: "exchangeRates";
};

type GetReportedMessages = {
    kind: "reportedMessages";
    userId: string | undefined;
};

type AcceptP2PSwap = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageId: bigint;
    pin: string | undefined;
    newAchievement: boolean;
    kind: "acceptP2PSwap";
};

type CancelP2PSwap = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageId: bigint;
    kind: "cancelP2PSwap";
};

type SetPinNumber = {
    verification: Verification;
    newPin: string | undefined;
    kind: "setPinNumber";
};

type ClaimDailyChit = {
    kind: "claimDailyChit";
};

type ChitLeaderboard = {
    kind: "chitLeaderboard";
};

type CancelInvites = {
    kind: "cancelInvites";
    id: MultiUserChatIdentifier | CommunityIdentifier;
    userIds: string[];
};

export type ConnectToWorkerResponse = GetOpenChatIdentityResponse["kind"];

// prettier-ignore
export type WorkerResult<T> = T extends Init
    ? ConnectToWorkerResponse
    : T extends GenerateIdentityChallenge
    ? GenerateChallengeResponse
    : T extends CreateOpenChatIdentity
    ? CreateOpenChatIdentityResponse
    : T extends PinMessage
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
    : T extends GetBots
    ? BotsResponse
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
    : T extends ChatEventsBatch
    ? ChatEventsResponse[]
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
    ? "accepted" | [ SendMessageResponse, Message ]
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
    ? boolean
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
    : T extends ExploreBots
    ? ExploreBotsResponse
    : T extends RegisterBot
    ? boolean
    : T extends UpdateRegisteredBot
    ? boolean
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
    : T extends FreezeCommunity
    ? FreezeCommunityResponse
    : T extends UnfreezeCommunity
    ? UnfreezeCommunityResponse
    : T extends AddHotGroupExclusion
    ? AddHotGroupExclusionResponse
    : T extends RemoveHotGroupExclusion
    ? RemoveHotGroupExclusionResponse
    : T extends AddRemoveSwapProvider
    ? boolean
    : T extends AddMessageFilter
    ? boolean
    : T extends RemoveMessageFilter
    ? boolean
    : T extends SetTokenEnabled
    ? boolean
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
    : T extends MarkLocalGroupIndexFull
    ? boolean
    : T extends SetDiamondMembershipFees
    ? boolean
    : T extends StakeNeuronForSubmittingProposals
    ? StakeNeuronForSubmittingProposalsResponse
    : T extends TopUpNeuronForSubmittingProposals
    ? TopUpNeuronResponse
    : T extends LoadFailedMessages
    ? Map< string, Record< string, EventWrapper<Message>>>
    : T extends DeleteFailedMessage
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
    : T extends ReportMessage
    ? boolean
    : T extends ApproveTransfer
    ? ApproveTransferResponse
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
    ? EventsResponse<ChatEvent>
    : T extends ChannelEventsByIndex
    ? EventsResponse<ChatEvent>
    : T extends ChannelEventsWindow
    ? EventsResponse<ChatEvent>
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
    ? [RegistryValue, boolean]
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
    ? Record< string, bigint >
    : T extends GetTokenSwaps
    ? Record<string, DexId[]>
    : T extends CanSwap
    ? Set<string>
    : T extends GetTokenSwapQuotes
    ? [DexId, bigint][]
    : T extends SwapTokens
    ? SwapTokensResponse
    : T extends TokenSwapStatus
    ? TokenSwapStatusResponse
    : T extends DeleteDirectChat
    ? boolean
    : T extends GetDiamondMembershipFees
    ? DiamondMembershipFees[]
    : T extends GetReportedMessages
    ? string
    : T extends GetExchangeRates
    ? Record<string, TokenExchangeRates>
    : T extends ProposeTranslation
    ? ProposeResponse
    : T extends ApproveTranslation
    ? ApproveResponse
    : T extends RejectTranslation
    ? RejectResponse
    : T extends GetProposedTranslations
    ? ProposedResponse
    : T extends MarkTranslationsDeployed
    ? MarkDeployedResponse
    : T extends GetTranslationsPendingDeployment
    ? PendingDeploymentResponse
    : T extends AcceptP2PSwap
    ? AcceptP2PSwapResponse
    : T extends CancelP2PSwap
    ? CancelP2PSwapResponse
    : T extends JoinVideoCall
    ? JoinVideoCallResponse
    : T extends SetVideoCallPresence
    ? SetVideoCallPresenceResponse
    : T extends VideoCallParticipants
    ? VideoCallParticipantsResponse
    : T extends GetAccessToken
    ? string | undefined
    : T extends GetLocalUserIndexForUser
    ? string
    : T extends UpdateBtcBalance
    ? UpdateBtcBalanceResponse
    : T extends GenerateMagicLink
    ? GenerateMagicLinkResponse
    : T extends GetSignInWithEmailDelegation
    ? GetDelegationResponse
    : T extends SiwePrepareLogin
    ? SiwePrepareLoginResponse
    : T extends SiwsPrepareLogin
    ? SiwsPrepareLoginResponse
    : T extends LoginWithWallet
    ? PrepareDelegationResponse
    : T extends GetDelegationWithWallet
    ? GetDelegationResponse
    : T extends SetPinNumber
    ? SetPinNumberResponse
    : T extends ClaimDailyChit
    ? ClaimDailyChitResponse
    : T extends ChitLeaderboard
    ? ChitLeaderboardResponse
    : T extends ChitEventsRequest
    ? ChitEventsResponse
    : T extends MarkAchievementsSeen
    ? void
    : T extends SubmitProofOfUniquePersonhood
    ? SubmitProofOfUniquePersonhoodResponse
    : T extends LinkIdentities
    ? LinkIdentitiesResponse
    : T extends GetAuthenticationPrincipals
    ? AuthenticationPrincipalsResponse
    : T extends ConfigureWallet
    ? void
    : T extends ClearCachedData
    ? void
    : T extends SetCommunityReferral
    ? void
    : T extends GetExternalAchievements
    ? ExternalAchievement[]
    : T extends CancelInvites
    ? boolean
    : T extends MessageActivityFeed
    ? MessageActivityFeedResponse
    : T extends MarkActivityFeedRead
    ? void
    : T extends DeleteUser
    ? boolean
    : T extends AddBot
    ? boolean
    : T extends GetBotDefinition
    ? BotDefinitionResponse
    : T extends CallBotCommandEndpoint
    ? BotCommandResponse
    : T extends RemoveInstalledBot
    ? boolean
    : T extends UpdateInstalledBot
    ? boolean
    : never;
