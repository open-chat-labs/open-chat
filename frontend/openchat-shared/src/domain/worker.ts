import type { OCError } from "./error";
import type { Success } from "./response";
import type { JsonnableDelegationChain } from "@icp-sdk/core/identity";
import type { AccessGateConfig, Rules, UpdatedRules, VerifiedCredentialArgs } from "./access";
import type {
    CkbtcMinterDepositInfo,
    CkbtcMinterWithdrawalInfo,
    WithdrawBtcResponse,
} from "./bitcoin";
import type {
    BotCommandResponse,
    BotDefinition,
    BotDefinitionResponse,
    BotInstallationLocation,
    BotsResponse,
    ExternalBot,
    FullWebhookDetails,
    GrantedBotPermissions,
} from "./bots";
import type {
    AcceptedRules,
    AcceptP2PSwapResponse,
    AddHotGroupExclusionResponse,
    AddRemoveReactionResponse,
    BlockUserResponse,
    CancelP2PSwapResponse,
    CandidateGroupChat,
    ChangeRoleResponse,
    ChannelIdentifier,
    ChatEvent,
    ChatEventsResponse,
    ChatIdentifier,
    ClaimPrizeResponse,
    CreateGroupResponse,
    DeclineInvitationResponse,
    DeletedDirectMessageResponse,
    DeletedGroupMessageResponse,
    DeleteFrozenGroupResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DirectChatIdentifier,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventWrapper,
    FreezeGroupResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatIdentifier,
    GroupChatSummary,
    IndexRange,
    InviteCodeResponse,
    JoinGroupResponse,
    JoinVideoCallResponse,
    LeaveGroupResponse,
    ListNervousSystemFunctionsResponse,
    LookupMembersResponse,
    MarkReadRequest,
    MarkReadResponse,
    Message,
    MessageActivityFeedResponse,
    MessageContext,
    MultiUserChatIdentifier,
    PendingCryptocurrencyTransfer,
    PendingCryptocurrencyWithdrawal,
    PinMessageResponse,
    ProposalVoteDetails,
    PublicGroupSummaryResponse,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RemoveHotGroupExclusionResponse,
    RemoveMemberResponse,
    ResetInviteCodeResponse,
    SendMessageResponse,
    ModerationVerdict,
    NcaPriority,
    NcaReporterContact,
    SetCommunityModerationFlagsResponse,
    SetGroupModerationFlagsResponse,
    SetGroupUpgradeConcurrencyResponse,
    SetPinNumberResponse,
    SetVideoCallPresenceResponse,
    ThreadPreview,
    ThreadRead,
    ThreadSyncDetails,
    TipMessageResponse,
    TokenInfo,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnfreezeGroupResponse,
    UnpinMessageResponse,
    UpdateGroupResponse,
    VideoCallParticipantsResponse,
    VideoCallPresence,
    WithdrawCryptocurrencyResponse,
} from "./chat";
import type { SyncSinceResponse } from "./sync";
import type {
    ChitEventsRequest,
    ChitEventsResponse,
    ChitLeaderboardResponse,
    ClaimDailyChitResponse,
    ExternalAchievement,
    PayForPremiumItemResponse,
    PayForStreakInsuranceResponse,
    PremiumItem,
} from "./chit";
import type {
    DailyPuzzleConfig,
    DailyPuzzleFetchResult,
    DailyPuzzleHintResponse,
    DailyPuzzleResult,
    DailyPuzzleStartResponse,
    DailyPuzzleSubmitResponse,
    PublicDailyPuzzle,
} from "./dailyPuzzle";
import type {
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    ChangeCommunityRoleResponse,
    ChannelMatch,
    ChannelSummaryResponse,
    CommunityDetails,
    CommunityDetailsResponse,
    CommunityIdentifier,
    CommunitySummary,
    CommunitySummaryResponse,
    ConvertToCommunityResponse,
    CreateCommunityResponse,
    CreateUserGroupResponse,
    DeleteCommunityResponse,
    DeleteUserGroupsResponse,
    FollowThreadResponse,
    FreezeCommunityResponse,
    ImportGroupResponse,
    JoinCommunityResponse,
    LeaveCommunityResponse,
    SetMemberDisplayNameResponse,
    UnblockCommunityUserResponse,
    UnfreezeCommunityResponse,
    UpdateCommunityResponse,
    UpdateUserGroupResponse,
} from "./community";
import type { AgentConfig } from "./config";
import type {
    AccountTransactionResult,
    CryptocurrencyDetails,
    EvmChain,
    TokenExchangeRates,
    WalletConfig,
} from "./crypto";
import type { ModerationConfig } from "./user/user";
import type {
    VaultFileChunkResponse,
    VaultFileInfoResponse,
    VaultLogResponse,
    BlobReference,
    StorageStatus,
} from "./data/data";
import type { DexId } from "./dexes";
import type { GenerateMagicLinkResponse } from "./email";
import type {
    ApproveResponse,
    MarkDeployedResponse,
    PendingDeploymentResponse,
    ProposedResponse,
    ProposeResponse,
    RejectReason,
    RejectResponse,
    TranslationCorrections,
} from "./i18n";
import type {
    AccountLinkingCode,
    AuthenticationPrincipalsResponse,
    CreateOpenChatIdentityResponse,
    FinaliseAccountLinkingResponse,
    GetDelegationResponse,
    GetOpenChatIdentityError,
    JsonnableIdentityKeyAndChain,
    LinkIdentitiesResponse,
    PrepareDelegationResponse,
    RemoveIdentityLinkResponse,
    SiwePrepareLoginResponse,
    SiwsPrepareLoginResponse,
    VerifyAccountLinkingCodeResponse,
    WebAuthnKey,
    WebAuthnKeyFull,
} from "./identity";
import type { CommunityInvite, GroupInvite } from "./inviteCodes";
import type { LogLevel } from "./logging";
import type { UpdateMarketMakerConfigArgs, UpdateMarketMakerConfigResponse } from "./marketMaker";
import type { ToggleMuteNotificationResponse } from "./notifications";
import type {
    OneSecForwardingStatus,
    OneSecTransferFees,
    WithdrawViaOneSecResponse,
} from "./oneSec";
import type { MinutesOnline } from "./online";
import type { OptionUpdate } from "./optionUpdate";
import type {
    AccessTokenType,
    CommunityPermissions,
    MemberRole,
    OptionalChatPermissions,
} from "./permission";
import type { CandidateProposal } from "./proposals";
import type {
    StakeNeuronForSubmittingProposalsResponse,
    TopUpNeuronResponse,
} from "./proposalsBot";
import type { RegistryValue } from "./registry";
import type {
    ExploreBotsResponse,
    ExploreChannelsResponse,
    ExploreCommunitiesResponse,
    GroupSearchResponse,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
} from "./search/search";
import type {
    ApproveTransferResponse,
    ArchiveChatResponse,
    CheckUsernameResponse,
    CreatedUser,
    CurrentUserResponse,
    DeleteCryptoAccountResponse,
    DiamondMembershipDuration,
    DiamondMembershipFees,
    ManageFavouritesResponse,
    NamedAccount,
    PayForDiamondMembershipResponse,
    PinChatResponse,
    PublicProfile,
    RegisterUserResponse,
    SaveCryptoAccountResponse,
    SetBioResponse,
    SetDisplayNameResponse,
    SetMessageReminderResponse,
    SetUsernameResponse,
    CreateMultiUserCanisterResponse,
    FundsInPreviousWallet,
    MoveFundsOutcome,
    SubmitProofOfUniquePersonhoodResponse,
    SubmitProposalResponse,
    SuspendUserResponse,
    SwapTokensResponse,
    SwapTokensStep,
    UnpinChatResponse,
    UnsuspendUserResponse,
    User,
    UsersArgs,
    UsersResponse,
    UserSummary,
    ProposedProtectedAction,
} from "./user";
import type { Verification } from "./wallet";

/**
 * Worker request types
 */

export type CorrelatedWorkerRequest = WorkerRequest & {
    correlationId: number;
};

// A request is copied to the worker by postMessage, which can't copy a function: a request with a
// function field fails to compile here instead of throwing DataCloneError when it is sent
type NoFunctionFields<T> = {
    [K in keyof T]: NonNullable<T[K]> extends (...args: never[]) => unknown ? never : T[K];
};
type Cloneable<T extends NoFunctionFields<T>> = T;

export type WorkerRequest = Cloneable<
    | SetAuthIdentity
    | Logout
    | SetMinLogLevel
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
    | SetProfileBackground
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
    | ChatEventsByEventIndex
    | ChatEventsWindow
    | LastOnline
    | MarkAsOnline
    | GetGroupDetails
    | LookupMembers
    | SearchCommunityMembers
    | MarkMessagesRead
    | GetAllCachedUsers
    | GetUsers
    | ChatEvents
    | CreateUserClient
    | Init
    | CreateOpenChatIdentity
    | CurrentUser
    | SetGroupInvite
    | SetCommunityInvite
    | SearchGroupChat
    | SearchDirectChat
    | RefreshAccountBalance
    | GetFundsInPreviousWallets
    | MoveFundsFromPreviousWallets
    | GetAccountTransactions
    | GetThreadPreviews
    | GetUser
    | GetPublicProfile
    | SetUsername
    | SetDisplayName
    | SetHideOnlineStatus
    | SetBio
    | GetBio
    | WithdrawCrypto
    | MessagesByMessageIndex
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
    | SetAirdropConfig
    | SetTokenEnabled
    | SuspendUser
    | UnsuspendUser
    | GetUpdates
    | SyncSince
    | RefreshChat
    | GetBots
    | GetDeletedGroupMessage
    | GetDeletedDirectMessage
    | LoadFailedMessages
    | DeleteFailedMessage
    | ClaimPrize
    | PayForDiamondMembership
    | SetCommunityModerationFlags
    | SetGroupModerationFlags
    | SetGroupUpgradeConcurrency
    | SetCommunityUpgradeConcurrency
    | CreateMultiUserCanister
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
    | RemoveCommunityMember
    | UnblockCommunityUser
    | UpdateCommunity
    | CreateCommunity
    | ExploreCommunities
    | ExploreBots
    | RegisterBot
    | RemoveBot
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
    | ProposeSetOpenAIApiKey
    | ConfirmProtectedAction
    | CancelProtectedAction
    | ProtectedActions
    | SetModerationReferralConfig
    | ProposeSetVaultReviewers
    | ProposeSetMediaScanConfig
    | ProposeSetAuthorityReporter
    | ProposeSetVaultLegalHold
    | SetVaultLegalHold
    | ProposeDestroyVaultEvidence
    | VaultLog
    | VaultBuckets
    | AuthorityReports
    | GetModerationConfig
    | RecordAuthorityReportFiled
    | ClearAuthorityReportAttempt
    | AuthorityReportToken
    | AcceptTerms
    | ProposeSetInternalModerationChannel
    | ResolveModerationReport
    | ContestModerationSanction
    | VaultFileChunk
    | VaultFileInfo
    | ChangeCommunityRole
    | SetCommunityIndexes
    | UpdateRegistry
    | CreateUserGroup
    | UpdateUserGroup
    | DeleteUserGroups
    | SetMemberDisplayName
    | FollowThread
    | LoadSavedCryptoAccounts
    | SaveCryptoAccount
    | DeleteCryptoAccount
    | SubmitProposal
    | TipMessage
    | CanSwap
    | GetTokenSwaps
    | GetTokenSwapQuotes
    | SwapTokens
    | RecoverUnfinishedTokenSwaps
    | ApproveTransfer
    | ApproveAccessGatePayment
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
    | GenerateBtcAddress
    | GenerateOneSecAddress
    | UpdateBtcBalance
    | WithdrawBtc
    | WithdrawViaOneSec
    | GetCkbtcMinterDepositInfo
    | GetCkbtcMinterWithdrawalInfo
    | CurrentUserWebAuthnKey
    | LookupWebAuthnPubKey
    | SetCachedWebAuthnKey
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
    | RemoveIdentityLink
    | GetAuthenticationPrincipals
    | ConfigureWallet
    | ClearCachedData
    | SetCommunityReferral
    | GetExternalAchievements
    | CancelInvites
    | MessageActivityFeed
    | MarkActivityFeedRead
    | DeleteUser
    | InstallBot
    | UninstallBot
    | UpdateInstalledBot
    | UpdateRegisteredBot
    | GetBotDefinition
    | CallBotCommandEndpoint
    | RegisterWebhook
    | UpdateWebhook
    | RegenerateWebhook
    | DeleteWebhook
    | GetWebhook
    | PayForStreakInsurance
    | UpdateDirectChatSettings
    | UpdateProposalTallies
    | FcmTokenExists
    | AddFcmToken
    | RemoveFcmToken
    | CreateAccountLinkingCode
    | ReinstateMissedDailyClaims
    | VerifyAccountLinkingCode
    | FinaliseAccountLinkingWithCode
    | GetSignInProof
    | PayForPremiumItem
    | DailyPuzzleFetch
    | DailyPuzzleStart
    | DailyPuzzleSubmit
    | DailyPuzzleHint
    | DailyPuzzleSaveGrid
    | DailyPuzzleCurrent
    | DailyPuzzleResults
    | DailyPuzzleGetConfig
    | DailyPuzzleSetEnabled
    | DailyPuzzleRegenerateToday
    | CallPushEnabled
    | SetCallPushEnabled
    | SetPremiumItemCost
    | OneSecEnableForwarding
    | OneSecGetTransferFees
    | OneSecForwardEvmToIcp
    | OneSecGetForwardingStatus
    | UpdateBlockedUsernamePatterns
    | MarkNotificationSubscriptionActive
    | AbortInFlightQueries
>;

// Sent when the app resumes after being suspended, see `abortInFlightQueries` in openchat-agent
type AbortInFlightQueries = {
    kind: "abortInFlightQueries";
};

type MarkNotificationSubscriptionActive = {
    kind: "markNotificationSubscriptionActive";
    endpoint: string;
};

type UpdateBlockedUsernamePatterns = {
    kind: "updateBlockedUsernamePatterns";
    pattern: string;
    add: boolean;
};

type OneSecEnableForwarding = {
    kind: "oneSecEnableForwarding";
    userId: string;
    evmAddress: string;
};

type OneSecGetTransferFees = {
    kind: "oneSecGetTransferFees";
};

type OneSecForwardEvmToIcp = {
    kind: "oneSecForwardEvmToIcp";
    tokenSymbol: string;
    chain: EvmChain;
    address: string;
    receiver: string;
};

type OneSecGetForwardingStatus = {
    kind: "oneSecGetForwardingStatus";
    tokenSymbol: string;
    chain: EvmChain;
    address: string;
    receiver: string;
};

type SetPremiumItemCost = {
    kind: "setPremiumItemCost";
    item: PremiumItem;
    chitCost: number;
};

type PayForPremiumItem = {
    kind: "payForPremiumItem";
    item: PremiumItem;
    userId: string;
};

type DailyPuzzleFetch = {
    kind: "dailyPuzzleFetch";
    userId: string;
};

type DailyPuzzleStart = {
    kind: "dailyPuzzleStart";
    userId: string;
    gameId: string;
    number: number;
    expectedEntryFee: number;
};

type DailyPuzzleSubmit = {
    kind: "dailyPuzzleSubmit";
    userId: string;
    gameId: string;
    number: number;
    grid: Uint8Array;
};

type DailyPuzzleHint = {
    kind: "dailyPuzzleHint";
    userId: string;
    gameId: string;
    number: number;
    level: number;
    filled: [number, number][];
    expectedPrice: number;
};

type DailyPuzzleSaveGrid = {
    kind: "dailyPuzzleSaveGrid";
    userId: string;
    gameId: string;
    number: number;
    grid: Uint8Array;
};

type DailyPuzzleCurrent = {
    kind: "dailyPuzzleCurrent";
};

type DailyPuzzleResults = {
    kind: "dailyPuzzleResults";
    gameId: string;
    number: number;
    userIds: string[];
};

type DailyPuzzleGetConfig = {
    kind: "dailyPuzzleConfig";
};

type DailyPuzzleSetEnabled = {
    kind: "dailyPuzzleSetEnabled";
    enabled: boolean;
};
// The native call push kill switch (#9456), platform operators only
type CallPushEnabled = {
    kind: "callPushEnabled";
};
type SetCallPushEnabled = {
    kind: "setCallPushEnabled";
    enabled: boolean;
};
type DailyPuzzleRegenerateToday = {
    kind: "dailyPuzzleRegenerateToday";
    gameId: string | undefined;
};
export type SetAuthIdentity = {
    kind: "setAuthIdentity";
    identity: JsonnableIdentityKeyAndChain | undefined;
    isIIPrincipal: boolean;
};

export type Logout = {
    kind: "logout";
};

export type SetMinLogLevel = {
    kind: "setMinLogLevel";
    minLogLevel: LogLevel;
};

type PayForStreakInsurance = {
    kind: "payForStreakInsurance";
    additionalDays: number;
    expectedPrice: bigint;
    pin: string | undefined;
};

type UpdateDirectChatSettings = {
    kind: "updateDirectChatSettings";
    userId: string;
    eventsTtl: OptionUpdate<bigint>;
};

type UpdateProposalTallies = {
    kind: "updateProposalTallies";
    chatId: MultiUserChatIdentifier;
};

type RegisterWebhook = {
    kind: "registerWebhook";
    chatId: MultiUserChatIdentifier;
    name: string;
    avatar: string | undefined;
};

type UpdateWebhook = {
    kind: "updateWebhook";
    chatId: MultiUserChatIdentifier;
    id: string;
    name: string | undefined;
    avatar: OptionUpdate<string>;
};

type RegenerateWebhook = {
    kind: "regenerateWebhook";
    chatId: MultiUserChatIdentifier;
    id: string;
};

type DeleteWebhook = {
    kind: "deleteWebhook";
    chatId: MultiUserChatIdentifier;
    id: string;
};

type GetWebhook = {
    kind: "getWebhook";
    chatId: MultiUserChatIdentifier;
    id: string;
};

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
    principal?: string;
    ownerId?: string;
    avatarUrl?: string;
    endpoint?: string;
    definition?: BotDefinition;
};

type InstallBot = {
    kind: "installBot";
    id: BotInstallationLocation;
    botId: string;
    grantedPermissions: GrantedBotPermissions;
};

type UpdateInstalledBot = {
    kind: "updateInstalledBot";
    id: BotInstallationLocation;
    botId: string;
    grantedPermissions: GrantedBotPermissions;
};

type UninstallBot = {
    kind: "uninstallBot";
    id: BotInstallationLocation;
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

type DeleteCryptoAccount = {
    kind: "deleteCryptoAccount";
    name: string;
};

type TipMessage = {
    kind: "tipMessage";
    messageContext: MessageContext;
    messageId: bigint;
    transfer: PendingCryptocurrencyTransfer;
    decimals: number;
    pin: string | undefined;
    username: string;
    displayName: string | undefined;
    newAchievement: boolean;
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

type RecoverUnfinishedTokenSwaps = {
    kind: "recoverUnfinishedTokenSwaps";
};

type SetCommunityIndexes = {
    kind: "setCommunityIndexes";
    indexes: Record<string, number>;
};

type SetModerationFlags = {
    kind: "setModerationFlags";
    flags: number;
};

type ProposeSetOpenAIApiKey = {
    kind: "proposeSetOpenAIApiKey";
    apiKey: string | undefined;
};

type ConfirmProtectedAction = {
    kind: "confirmProtectedAction";
    actionId: bigint;
};

type CancelProtectedAction = {
    kind: "cancelProtectedAction";
    actionId: bigint;
};

type ProtectedActions = {
    kind: "protectedActions";
};

type AcceptTerms = {
    kind: "acceptTerms";
    version: number;
};

type VaultBuckets = {
    kind: "vaultBuckets";
};

type VaultLog = {
    kind: "vaultLog";
    bucketCanisterId: string;
    start: bigint;
    max: number;
    fileId: bigint | undefined;
};

type GetModerationConfig = {
    kind: "moderationConfig";
};

type AuthorityReports = {
    kind: "authorityReports";
};

type RecordAuthorityReportFiled = {
    kind: "recordAuthorityReportFiled";
    reportIndex: bigint;
    portalReference: string;
    urgent: boolean;
    unverified: boolean;
};

// A platform operator reconciling an orphaned automated-filing attempt marker (service
// crashed mid-flight) after confirming on the portal that nothing was filed
type ClearAuthorityReportAttempt = {
    kind: "clearAuthorityReportAttempt";
    reportIndex: bigint;
};

export type AuthorityReportTokenResponse =
    | { kind: "success"; vaultToken: string; submitterToken: string }
    | { kind: "error"; message: string };

// Mints the pair of signed tokens which open a filing window for the automated NCA
// reporting service. The reporter's contact details go straight into the submitter token
// and are never persisted.
type AuthorityReportToken = {
    kind: "authorityReportToken";
    reportIndex: bigint;
    priority: NcaPriority;
    reporter: NcaReporterContact;
    oohCallAcknowledged: boolean;
};

type ProposeSetVaultLegalHold = {
    kind: "proposeSetVaultLegalHold";
    reportIndex: bigint;
    legalHold: boolean;
    reference: string;
};

type ProposeSetVaultReviewers = {
    kind: "proposeSetVaultReviewers";
    userIds: string[];
};

type ProposeSetMediaScanConfig = {
    kind: "proposeSetMediaScanConfig";
    enabled: boolean;
    scanners: string[];
};

type ProposeSetAuthorityReporter = {
    kind: "proposeSetAuthorityReporter";
    principal: string | undefined;
};

type SetVaultLegalHold = {
    kind: "setVaultLegalHold";
    reportIndex: bigint;
    legalHold: boolean;
    reference: string;
};

type ProposeDestroyVaultEvidence = {
    kind: "proposeDestroyVaultEvidence";
    reportIndex: bigint;
    leRequestRef: string;
};

type SetModerationReferralConfig = {
    kind: "setModerationReferralConfig";
    config: { categories: { category: number; scoreThreshold: number }[] } | undefined;
};

type ProposeSetInternalModerationChannel = {
    kind: "proposeSetInternalModerationChannel";
    channel: { communityId: string; channelId: number } | undefined;
};

type ResolveModerationReport = {
    kind: "resolveModerationReport";
    reportIndex: bigint;
    verdict: ModerationVerdict;
    urgent: boolean | undefined;
};

type ContestModerationSanction = {
    kind: "contestModerationSanction";
};

type VaultFileChunk = {
    kind: "vaultFileChunk";
    bucketCanisterId: string;
    fileId: bigint;
    chunkIndex: number;
};

type VaultFileInfo = {
    kind: "vaultFileInfo";
    bucketCanisterId: string;
    fileId: bigint;
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
    // When the details last changed, according to the summary. If the canister doesn't yet say,
    // this is when the summary was last updated at all.
    detailsLastUpdated: bigint;
    // If the caller already holds the details, the time up to which they are known to be up to
    // date. That isn't when they last changed: it moves on each time the canister confirms that
    // they haven't. If they still haven't, the response only says so, rather than carrying every
    // member across again.
    detailsSyncedUpTo?: bigint;
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

type MessagesByMessageIndex = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageIndexes: number[];
    latestKnownUpdate: bigint | undefined;
    kind: "getMessagesByMessageIndex";
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

type SetHideOnlineStatus = {
    hideOnlineStatus: boolean;
    kind: "setHideOnlineStatus";
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
    threadsByChat: Map<string, [ThreadSyncDetails[], bigint | undefined]>;
    kind: "threadPreviews";
};

type RefreshAccountBalance = {
    ledger: string;
    principal: string;
    kind: "refreshAccountBalance";
};

type GetFundsInPreviousWallets = {
    previousUserIds: string[];
    kind: "fundsInPreviousWallets";
};

type MoveFundsFromPreviousWallets = {
    funds: FundsInPreviousWallet[];
    kind: "moveFundsFromPreviousWallets";
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

type RemoveBot = {
    kind: "removeBot";
    botId: string;
};

type ExploreBots = {
    searchTerm: string | undefined;
    pageIndex: number;
    pageSize: number;
    location: BotInstallationLocation | undefined;
    excludeInstalled: boolean;
    kind: "exploreBots";
};

type SearchGroups = {
    searchTerm: string;
    flags: number;
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
    governanceCanisterId: string;
    proposalId: bigint;
    isNns: boolean;
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
    endpoint: string;
    kind: "removeSubscription";
};

type PushSub = {
    subscription: PushSubscriptionJSON;
    kind: "pushSubscription";
};

type SubscriptionExists = {
    endpoint: string;
    kind: "subscriptionExists";
};

type FcmTokenExists = {
    kind: "fcmTokenExists";
    fcmToken: string;
};

type AddFcmToken = {
    kind: "addFcmToken";
    fcmToken: string;
};

type RemoveFcmToken = {
    kind: "removeFcmToken";
    fcmToken: string;
};

type RegisterUser = {
    username: string;
    email: string | undefined;
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
    compositeGateIndex?: number;
};

type JoinCommunity = {
    id: CommunityIdentifier;
    credentialArgs: VerifiedCredentialArgs | undefined;
    kind: "joinCommunity";
    referredBy?: string;
    compositeGateIndex?: number;
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

type SetProfileBackground = {
    data: Uint8Array;
    kind: "setProfileBackground";
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
    mute: boolean | undefined;
    muteAtEveryone: boolean | undefined;
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
    // Which page of `maxResults` users to return, starting from 0
    pageIndex?: number;
    kind: "searchUsers";
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

export type CreateOpenChatIdentity = {
    kind: "createOpenChatIdentity";
    webAuthnCredentialId: Uint8Array | undefined;
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
    // Both as for `GetCommunityDetails`
    detailsLastUpdated: bigint;
    detailsSyncedUpTo?: bigint;
    kind: "getGroupDetails";
};

// Finds which of the users are members of a chat or community. Those who are are also added to its
// cached details.
type LookupMembers = {
    kind: "lookupMembers";
    id: MultiUserChatIdentifier | CommunityIdentifier;
    userIds: string[];
    // The time up to which the details held are known to be up to date. A replica which is behind
    // it isn't asked.
    latestKnownUpdate: bigint;
};

// Finds the members of a community whose display names in it match the search term. Those found
// are also added to its cached details.
type SearchCommunityMembers = {
    kind: "searchCommunityMembers";
    id: CommunityIdentifier;
    searchTerm: string;
    maxResults: number;
    // As for `LookupMembers`
    latestKnownUpdate: bigint;
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

type SetAirdropConfig = {
    channelId: number;
    channelName: string;
    communityId?: string;
    communityName?: string;
    kind: "setAirdropConfig";
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

type SetGroupModerationFlags = {
    chatId: string;
    flags: number;
    kind: "setGroupModerationFlags";
};

type SetGroupUpgradeConcurrency = {
    value: number;
    kind: "setGroupUpgradeConcurrency";
};

type SetCommunityUpgradeConcurrency = {
    value: number;
    kind: "setCommunityUpgradeConcurrency";
};

type CreateMultiUserCanister = {
    localUserIndexCanisterId: string;
    kind: "createMultiUserCanister";
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

type SyncSince = {
    kind: "syncSince";
    since: number;
};

type RefreshChat = {
    kind: "refreshChat";
    chatId: GroupChatIdentifier | ChannelIdentifier;
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

type GenerateBtcAddress = {
    kind: "generateBtcAddress";
};

type GenerateOneSecAddress = {
    kind: "generateOneSecAddress";
};

type UpdateBtcBalance = {
    userId: string;
    bitcoinAddress: string;
    kind: "updateBtcBalance";
};

type WithdrawBtc = {
    address: string;
    amount: bigint;
    pin: string | undefined;
    kind: "withdrawBtc";
};

type WithdrawViaOneSec = {
    kind: "withdrawViaOneSec";
    ledger: string;
    tokenSymbol: string;
    chain: EvmChain;
    address: string;
    amount: bigint;
    pin: string | undefined;
};

type GetCkbtcMinterDepositInfo = {
    kind: "ckbtcMinterDepositInfo";
};

type GetCkbtcMinterWithdrawalInfo = {
    amount: bigint;
    kind: "ckbtcMinterWithdrawalInfo";
};

type CurrentUserWebAuthnKey = {
    kind: "currentUserWebAuthnKey";
};

type LookupWebAuthnPubKey = {
    credentialId: Uint8Array;
    kind: "lookupWebAuthnPubKey";
};

type SetCachedWebAuthnKey = {
    key: WebAuthnKeyFull;
    kind: "setCachedWebAuthnKey";
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
    initiatorWebAuthnKey: WebAuthnKey | undefined;
    approverKey: CryptoKeyPair;
    approverDelegation: JsonnableDelegationChain;
};

type RemoveIdentityLink = {
    kind: "removeIdentityLink";
    linked_principal: string;
};

type DeleteUser = {
    kind: "deleteUser";
    identityKey: CryptoKeyPair;
    delegation: JsonnableDelegationChain;
};

type CreateAccountLinkingCode = {
    kind: "createAccountLinkingCode";
};

type ReinstateMissedDailyClaims = {
    kind: "reinstateMissedDailyClaims";
    userId: string;
    days: number[];
};

type VerifyAccountLinkingCode = {
    kind: "verifyAccountLinkingCode";
    code: string;
    tempKey: CryptoKeyPair;
};

type FinaliseAccountLinkingWithCode = {
    kind: "finaliseAccountLinkingWithCode";
    tempKey: CryptoKeyPair;
    principal: string;
    publicKey: Uint8Array;
    webAuthnKey?: WebAuthnKeyFull;
};

type GetSignInProof = {
    kind: "getSignInProof";
    identityKey: CryptoKeyPair;
    delegation: JsonnableDelegationChain;
};

/**
 * Worker error type
 */
export type WorkerError = {
    kind: "worker_error";
    requestKind: string;
    correlationId: number;
    error: string;
};

/**
 * Worker response types
 */
export type WorkerResponseInner =
    | Success
    | OCError
    | ProposedProtectedAction
    | VaultFileChunkResponse
    | VaultFileInfoResponse
    | void
    | bigint
    | boolean
    | number
    | string
    | undefined
    | string[]
    | Uint8Array
    | [number, number]
    | SetAuthIdentityResponse
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
    | EventWrapper<Message>[]
    | ChatEventsResponse[]
    | EventsResponse<ChatEvent>
    | Record<string, number>
    | GroupChatDetailsResponse
    | GroupChatDetails
    | LookupMembersResponse
    | MarkReadResponse
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
    | SyncSinceResponse
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
    | SwapTokensStep
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
    | CkbtcMinterDepositInfo
    | WebAuthnKeyFull
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
    | BotCommandResponse
    | PayForStreakInsuranceResponse
    | FullWebhookDetails
    | AccountLinkingCode
    | VerifyAccountLinkingCodeResponse
    | FinaliseAccountLinkingResponse
    | PayForPremiumItemResponse
    | DailyPuzzleFetchResult
    | DailyPuzzleStartResponse
    | DailyPuzzleSubmitResponse
    | DailyPuzzleHintResponse
    | PublicDailyPuzzle[]
    | DailyPuzzleResult[]
    | DailyPuzzleConfig
    | OneSecTransferFees[]
    | OneSecForwardingStatus;

export type WorkerResponse = Response<WorkerResponseInner>;

type Response<T> = {
    kind: "worker_response";
    requestKind: string;
    correlationId: number;
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
    | RelayedUsersLoaded
    | RelayedSyncHead;

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
export type RelayedSyncHead = WorkerEventCommon<{
    subkind: "sync_head";
    userId: string;
    version: number;
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
    signInProof: string | undefined;
    kind: "claimPrize";
};

type PayForDiamondMembership = {
    userId: string;
    ledger: string;
    duration: DiamondMembershipDuration;
    recurring: boolean;
    expectedPriceE8s: bigint;
    fromAccount: string | undefined;
    pin: string | undefined;
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
    csam: boolean;
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

type ApproveAccessGatePayment = {
    canisterId: string;
    ledger: string;
    amount: bigint;
    expiresIn: bigint;
    pin: string | undefined;
    kind: "approveAccessGatePayment";
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

type RemoveCommunityMember = {
    kind: "removeCommunityMember";
    id: CommunityIdentifier;
    userId: string;
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
    token1: TokenInfo;
    token1Amount: bigint;
    pin: string | undefined;
    newAchievement: boolean;
    fromAccount: string | undefined;
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
    utcOffsetMins: number | undefined;
};

type ChitLeaderboard = {
    kind: "chitLeaderboard";
};

type CancelInvites = {
    kind: "cancelInvites";
    id: MultiUserChatIdentifier | CommunityIdentifier;
    userIds: string[];
};

export type SetAuthIdentityResponse = GetOpenChatIdentitySuccess | GetOpenChatIdentityError;

export type GetOpenChatIdentitySuccess = {
    kind: "success";
    ocIdentityPrincipal: string;
    ocIdentityExpiry: number;
};

// Every kind of request has an entry, and nothing else does: either mistake fails to compile
type ResultsByKind<
    R extends Record<WorkerRequest["kind"], unknown> &
        Record<Exclude<keyof R, WorkerRequest["kind"]>, never>,
> = R;

// What the worker sends back for each kind of request
export type WorkerResults = ResultsByKind<{
    init: void;
    setAuthIdentity: SetAuthIdentityResponse;
    logout: void;
    setMinLogLevel: void;
    createOpenChatIdentity: CreateOpenChatIdentityResponse;
    pinMessage: PinMessageResponse;
    loadSavedCryptoAccounts: NamedAccount[];
    saveCryptoAccount: SaveCryptoAccountResponse;
    deleteCryptoAccount: DeleteCryptoAccountResponse;
    tipMessage: TipMessageResponse;
    unpinMessage: UnpinMessageResponse;
    getUpdates: SyncSinceResponse | undefined;
    syncSince: SyncSinceResponse;
    refreshChat: boolean;
    getBots: BotsResponse;
    getDeletedDirectMessage: DeletedDirectMessageResponse;
    getDeletedGroupMessage: DeletedGroupMessageResponse;
    createUserClient: void;
    chatEvents: EventsResponse<ChatEvent>;
    getUsers: UsersResponse;
    markMessagesRead: MarkReadResponse;
    getGroupDetails: GroupChatDetailsResponse;
    lookupMembers: LookupMembersResponse;
    searchCommunityMembers: LookupMembersResponse;
    getCurrentUser: CurrentUserResponse;
    getAllCachedUsers: UserSummary[];
    lastOnline: Record<string, number>;
    markAsOnline: MinutesOnline;
    chatEventsWindow: EventsResponse<ChatEvent>;
    chatEventsByEventIndex: EventsResponse<ChatEvent>;
    rehydrateMessage: EventWrapper<Message>;
    checkUsername: CheckUsernameResponse;
    searchUsers: UserSummary[];
    getUserStorageLimits: StorageStatus;
    getPublicGroupSummary: PublicGroupSummaryResponse;
    toggleMuteNotifications: ToggleMuteNotificationResponse;
    archiveChat: ArchiveChatResponse;
    unarchiveChat: ArchiveChatResponse;
    pinChat: PinChatResponse;
    unpinChat: UnpinChatResponse;
    blockUserFromDirectChat: BlockUserResponse;
    unblockUserFromDirectChat: UnblockUserResponse;
    setUserAvatar: BlobReference;
    setProfileBackground: BlobReference;
    deleteGroup: DeleteGroupResponse;
    leaveGroup: LeaveGroupResponse;
    joinGroup: JoinGroupResponse;
    updateGroup: UpdateGroupResponse;
    registerPollVote: RegisterPollVoteResponse;
    deleteMessage: DeleteMessageResponse;
    undeleteMessage: UndeleteMessageResponse;
    addReaction: AddRemoveReactionResponse;
    removeReaction: AddRemoveReactionResponse;
    blockUserFromGroupChat: BlockUserResponse;
    unblockUserFromGroupChat: UnblockUserResponse;
    getProposalVoteDetails: ProposalVoteDetails;
    listNervousSystemFunctions: ListNervousSystemFunctionsResponse;
    sendMessage: "accepted" | [SendMessageResponse, Message];
    editMessage: EditMessageResponse;
    registerUser: RegisterUserResponse;
    subscriptionExists: boolean;
    pushSubscription: void;
    removeSubscription: void;
    inviteUsers: boolean;
    removeMember: RemoveMemberResponse;
    changeRole: ChangeRoleResponse;
    registerProposalVote: RegisterProposalVoteResponse;
    getRecommendedGroups: GroupChatSummary[];
    exploreCommunities: ExploreCommunitiesResponse;
    exploreBots: ExploreBotsResponse;
    registerBot: boolean;
    removeBot: boolean;
    updateRegisteredBot: boolean;
    dismissRecommendation: void;
    searchGroupChat: SearchGroupChatResponse;
    searchDirectChat: SearchDirectChatResponse;
    refreshAccountBalance: bigint;
    fundsInPreviousWallets: FundsInPreviousWallet[];
    moveFundsFromPreviousWallets: MoveFundsOutcome[];
    getAccountTransactions: AccountTransactionResult;
    threadPreviews: ThreadPreview[];
    getUser: UserSummary | undefined;
    getPublicProfile: PublicProfile | undefined;
    setUsername: SetUsernameResponse;
    setDisplayName: SetDisplayNameResponse;
    setHideOnlineStatus: void;
    setBio: SetBioResponse;
    getBio: string;
    withdrawCryptocurrency: WithdrawCryptocurrencyResponse;
    getMessagesByMessageIndex: EventsResponse<Message>;
    getInviteCode: InviteCodeResponse;
    enableInviteCode: EnableInviteCodeResponse;
    disableInviteCode: DisableInviteCodeResponse;
    resetInviteCode: ResetInviteCodeResponse;
    createGroupChat: CreateGroupResponse;
    setCachedMessageFromNotification: void;
    freezeGroup: FreezeGroupResponse;
    unfreezeGroup: UnfreezeGroupResponse;
    freezeCommunity: FreezeCommunityResponse;
    unfreezeCommunity: UnfreezeCommunityResponse;
    addHotGroupExclusion: AddHotGroupExclusionResponse;
    removeHotGroupExclusion: RemoveHotGroupExclusionResponse;
    addRemoveSwapProvider: boolean;
    addMessageFilter: boolean;
    removeMessageFilter: boolean;
    setAirdropConfig: boolean;
    setTokenEnabled: boolean;
    deleteFrozenGroup: DeleteFrozenGroupResponse;
    suspendUser: SuspendUserResponse;
    unsuspendUser: UnsuspendUserResponse;
    setCommunityModerationFlags: SetCommunityModerationFlagsResponse;
    setGroupModerationFlags: SetGroupModerationFlagsResponse;
    setGroupUpgradeConcurrency: SetGroupUpgradeConcurrencyResponse;
    setCommunityUpgradeConcurrency: SetGroupUpgradeConcurrencyResponse;
    createMultiUserCanister: CreateMultiUserCanisterResponse;
    markLocalGroupIndexFull: boolean;
    setDiamondMembershipFees: boolean;
    stakeNeuronForSubmittingProposals: StakeNeuronForSubmittingProposalsResponse;
    topUpNeuronForSubmittingProposals: TopUpNeuronResponse;
    loadFailedMessages: Map<string, Record<string, EventWrapper<Message>>>;
    deleteFailedMessage: void;
    claimPrize: ClaimPrizeResponse;
    payForDiamondMembership: PayForDiamondMembershipResponse;
    updateMarketMakerConfig: UpdateMarketMakerConfigResponse;
    setMessageReminder: SetMessageReminderResponse;
    cancelMessageReminder: boolean;
    reportMessage: boolean;
    approveTransfer: ApproveTransferResponse;
    approveAccessGatePayment: ApproveTransferResponse;
    declineInvitation: DeclineInvitationResponse;
    addMembersToChannel: AddMembersToChannelResponse;
    blockCommunityUser: BlockCommunityUserResponse;
    changeChannelRole: ChangeRoleResponse;
    changeCommunityRole: ChangeCommunityRoleResponse;
    declineChannelInvitation: DeclineInvitationResponse;
    removeCommunityMember: RemoveMemberResponse;
    unblockCommunityUser: UnblockCommunityUserResponse;
    updateCommunity: UpdateCommunityResponse;
    createCommunity: CreateCommunityResponse;
    joinCommunity: JoinCommunityResponse;
    searchGroups: GroupSearchResponse;
    getCommunitySummary: CommunitySummaryResponse;
    exploreChannels: ExploreChannelsResponse;
    getCommunityDetails: CommunityDetailsResponse;
    getChannelSummary: ChannelSummaryResponse;
    addToFavourites: ManageFavouritesResponse;
    removeFromFavourites: ManageFavouritesResponse;
    leaveCommunity: LeaveCommunityResponse;
    deleteCommunity: DeleteCommunityResponse;
    convertGroupToCommunity: ConvertToCommunityResponse;
    importGroupToCommunity: ImportGroupResponse;
    updateRegistry: [RegistryValue, boolean];
    setCommunityIndexes: boolean;
    proposeSetOpenAIApiKey: ProposedProtectedAction | undefined;
    confirmProtectedAction: Success | OCError;
    cancelProtectedAction: Success | OCError;
    protectedActions: string | undefined;
    setModerationReferralConfig: boolean;
    proposeSetVaultReviewers: ProposedProtectedAction | undefined;
    proposeSetMediaScanConfig: ProposedProtectedAction | undefined;
    proposeSetAuthorityReporter: ProposedProtectedAction | undefined;
    proposeSetVaultLegalHold: ProposedProtectedAction | undefined;
    setVaultLegalHold: boolean;
    proposeDestroyVaultEvidence: ProposedProtectedAction | undefined;
    vaultLog: VaultLogResponse;
    vaultBuckets: string[];
    authorityReports: string | undefined;
    moderationConfig: ModerationConfig | undefined;
    clearAuthorityReportAttempt: boolean;
    recordAuthorityReportFiled: boolean;
    authorityReportToken: AuthorityReportTokenResponse;
    acceptTerms: boolean;
    proposeSetInternalModerationChannel: ProposedProtectedAction | undefined;
    resolveModerationReport: Success | OCError;
    contestModerationSanction: boolean;
    vaultFileChunk: VaultFileChunkResponse;
    vaultFileInfo: VaultFileInfoResponse;
    createUserGroup: CreateUserGroupResponse;
    updateUserGroup: UpdateUserGroupResponse;
    deleteUserGroups: DeleteUserGroupsResponse;
    setMemberDisplayName: SetMemberDisplayNameResponse;
    submitProposal: SubmitProposalResponse;
    followThread: FollowThreadResponse;
    getTokenSwaps: Record<string, DexId[]>;
    canSwap: Set<string>;
    getTokenSwapQuotes: [DexId, bigint][];
    swapTokens: SwapTokensResponse | SwapTokensStep;
    recoverUnfinishedTokenSwaps: void;
    deleteDirectChat: boolean;
    diamondMembershipFees: DiamondMembershipFees[];
    reportedMessages: string;
    exchangeRates: Record<string, TokenExchangeRates>;
    proposeTranslation: ProposeResponse;
    approveTranslation: ApproveResponse;
    rejectTranslation: RejectResponse;
    getProposedTranslations: ProposedResponse;
    markTranslationsDeployed: MarkDeployedResponse;
    getTranslationsPendingDeployment: PendingDeploymentResponse;
    acceptP2PSwap: AcceptP2PSwapResponse;
    cancelP2PSwap: CancelP2PSwapResponse;
    joinVideoCall: JoinVideoCallResponse;
    setVideoCallPresence: SetVideoCallPresenceResponse;
    videoCallParticipants: VideoCallParticipantsResponse;
    getAccessToken: string | undefined;
    getLocalUserIndexForUser: string;
    generateBtcAddress: string;
    generateOneSecAddress: string;
    updateBtcBalance: boolean;
    withdrawBtc: WithdrawBtcResponse;
    withdrawViaOneSec: WithdrawViaOneSecResponse;
    ckbtcMinterDepositInfo: CkbtcMinterDepositInfo;
    ckbtcMinterWithdrawalInfo: CkbtcMinterWithdrawalInfo;
    currentUserWebAuthnKey: WebAuthnKeyFull | undefined;
    lookupWebAuthnPubKey: Uint8Array | undefined;
    setCachedWebAuthnKey: void;
    generateMagicLink: GenerateMagicLinkResponse;
    getSignInWithEmailDelegation: GetDelegationResponse;
    siwePrepareLogin: SiwePrepareLoginResponse;
    siwsPrepareLogin: SiwsPrepareLoginResponse;
    loginWithWallet: PrepareDelegationResponse;
    getDelegationWithWallet: GetDelegationResponse;
    setPinNumber: SetPinNumberResponse;
    claimDailyChit: ClaimDailyChitResponse;
    chitLeaderboard: ChitLeaderboardResponse;
    getChitEvents: ChitEventsResponse;
    markAchievementsSeen: void;
    submitProofOfUniquePersonhood: SubmitProofOfUniquePersonhoodResponse;
    linkIdentities: LinkIdentitiesResponse;
    removeIdentityLink: RemoveIdentityLinkResponse;
    getAuthenticationPrincipals: AuthenticationPrincipalsResponse;
    configureWallet: void;
    clearCachedData: void;
    setCommunityReferral: void;
    getExternalAchievements: ExternalAchievement[];
    cancelInvites: boolean;
    messageActivityFeed: MessageActivityFeedResponse;
    markActivityFeedRead: void;
    deleteUser: boolean;
    installBot: boolean;
    getBotDefinition: BotDefinitionResponse;
    callBotCommandEndpoint: BotCommandResponse;
    uninstallBot: boolean;
    updateInstalledBot: boolean;
    registerWebhook: FullWebhookDetails | undefined;
    updateWebhook: boolean;
    regenerateWebhook: string | undefined;
    deleteWebhook: boolean;
    getWebhook: string | undefined;
    payForStreakInsurance: PayForStreakInsuranceResponse;
    updateDirectChatSettings: boolean;
    updateProposalTallies: EventWrapper<Message>[];
    payForPremiumItem: PayForPremiumItemResponse;
    dailyPuzzleFetch: DailyPuzzleFetchResult | OCError;
    dailyPuzzleStart: DailyPuzzleStartResponse;
    dailyPuzzleSubmit: DailyPuzzleSubmitResponse;
    dailyPuzzleHint: DailyPuzzleHintResponse;
    dailyPuzzleSaveGrid: Success | OCError;
    dailyPuzzleCurrent: PublicDailyPuzzle[];
    dailyPuzzleResults: DailyPuzzleResult[];
    dailyPuzzleConfig: DailyPuzzleConfig | OCError;
    dailyPuzzleSetEnabled: Success | OCError;
    dailyPuzzleRegenerateToday: Success | OCError;
    callPushEnabled: boolean;
    setCallPushEnabled: Success | OCError;
    setPremiumItemCost: void;
    createAccountLinkingCode: AccountLinkingCode | undefined;
    getSignInProof: string | undefined;
    reinstateMissedDailyClaims: boolean;
    oneSecEnableForwarding: void;
    oneSecGetTransferFees: OneSecTransferFees[];
    oneSecForwardEvmToIcp: OneSecForwardingStatus;
    oneSecGetForwardingStatus: OneSecForwardingStatus;
    updateBlockedUsernamePatterns: void;
    markNotificationSubscriptionActive: void;
    abortInFlightQueries: void;
    addFcmToken: void;
    fcmTokenExists: boolean;
    removeFcmToken: void;
    groupInvite: void;
    communityInvite: void;
    setModerationFlags: boolean;
    verifyAccountLinkingCode: VerifyAccountLinkingCodeResponse;
    finaliseAccountLinkingWithCode: FinaliseAccountLinkingResponse;
}>;

export type WorkerResult<T extends WorkerRequest> = WorkerResults[T["kind"]];
