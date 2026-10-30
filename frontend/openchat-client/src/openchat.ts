/* eslint-disable no-case-declarations */
import { AuthClient, type AuthClientLoginOptions } from "@icp-sdk/auth/client";
import { AnonymousIdentity, DER_COSE_OID, unwrapDER, type SignIdentity } from "@icp-sdk/core/agent";
import {
    DelegationChain,
    DelegationIdentity,
    ECDSAKeyIdentity,
    WebAuthnIdentity,
    type JsonnableDelegationChain,
} from "@icp-sdk/core/identity";
import DRange from "drange";
import {
    configKeys,
    type ModerationConfig,
    type VaultLogResponse,
    type BlobReference,
    CURRENT_TERMS_VERSION,
    ARBITRUM_NETWORK,
    AuthProvider,
    BASE_NETWORK,
    ChatMap,
    ChatSet,
    CommonResponses,
    E8S_PER_TOKEN,
    ETHEREUM_NETWORK,
    ErrorCode,
    ICP_SYMBOL,
    IdentityStorage,
    MEMBERS_PAGE_SIZE,
    LEDGER_CANISTER_CHAT,
    LazyFile,
    MessageContextMap,
    ModerationFlags,
    NoMeetingToJoin,
    ONE_DAY,
    ONE_HOUR,
    ONE_MINUTE_MILLIS,
    OPENCHAT_BOT_USER_ID,
    OPENCHAT_VIDEO_CALL_USER_ID,
    PremiumItem,
    ROLE_MEMBER,
    ROLE_NONE,
    ROLE_OWNER,
    Stream,
    WEBAUTHN_ORIGINATING_CANISTER,
    ANON_USER_ID,
    anonymousUser,
    buildDelegationChain,
    canRetryMessage,
    chatIdentifierToString,
    latestMessageExpired,
    chatIdentifiersEqual,
    communityIdentifiersEqual,
    communityRoles,
    compareRoles,
    contentTypeToPermission,
    defaultChatPermissions,
    defaultChatRules,
    deletedUser,
    directMessageCommandInstance,
    emptyEventsResponse,
    expandTypedMentions,
    extractEnabledLinks,
    extractMessagePreviews,
    extractUserIdsFromMentions,
    featureRestricted,
    fetchOgPreviews,
    getContentAsFormattedText,
    getDisplayDate,
    getEmailSignInSession,
    i18nKey,
    indexRangeForChat,
    isAccountOfMultiUserCanisterUserId,
    isCaptionedContent,
    isCompositeGate,
    isDeletedUser,
    isEditableContent,
    isNeuronGate,
    isPaymentGate,
    isProposalsChat,
    isSuccessfulEventsResponse,
    isTransfer,
    mergeCombinedUnreadCounts,
    mergeEventStreamResponses,
    nullMembership,
    parseBigInt,
    pinNumberFailureFromError,
    publish,
    random128,
    random64,
    removeEmailSignInSession,
    removeOpenGraphPreviews,
    routeForChatIdentifier,
    routeForMessage,
    setMinLogLevel,
    shouldPreprocessGate,
    rolloverDelay,
    stateFor,
    storeEmailSignInSession,
    stripLinkDisabledMarker,
    todaysPuzzle,
    APPROVAL_VALIDITY_MS,
    toDer,
    toTitleCase,
    updateCreatedUser,
    userIdsFromEvents,
    userIdsFromTransactions,
    userOrUserGroupId,
    userOrUserGroupName,
    userStatus,
    withUserState,
    type AcceptP2PSwapResponse,
    type AcceptedRules,
    type AccessGate,
    type AccessTokenType,
    type AccountLinkingCode,
    type AccountTransactionResult,
    type Achievement,
    type AddMembersToChannelResponse,
    type AirdropChannelDetails,
    type ApproveAccessGatePaymentResponse,
    type ApproveTransferResponse,
    type ArchitectureRoute,
    type AttachmentContent,
    type AuthenticationPrincipal,
    type BlogRoute,
    type BotActionScope,
    type BotClientConfigData,
    type BotCommandInstance,
    type BotCommandResponse,
    type BotDefinition,
    type BotDefinitionResponse,
    type BotInstallationLocation,
    type BotMessageContext,
    type CancelP2PSwapResponse,
    type CandidateGroupChat,
    type CandidateProposal,
    type CandidateTranslations,
    type CaptionedContent,
    type ChannelIdentifier,
    type ChannelSummary,
    type ChatEvent,
    type ChatFrozenEvent,
    type ChatIdentifier,
    type ChatListRoute,
    type ChatListScope,
    type ChatSummary,
    type ChatUnfrozenEvent,
    type CheckUsernameResponse,
    type ChitEvent,
    type ChitEventsRequest,
    type ChitEventsResponse,
    type ChitLeaderboardResponse,
    type ChitState,
    type CkbtcMinterDepositInfo,
    type CkbtcMinterWithdrawalInfo,
    type CksolMinterDepositInfo,
    type CksolMinterWithdrawalInfo,
    type ClaimDailyChitResponse,
    type DailyPuzzleConfig,
    type DailyPuzzleHintResponse,
    type DailyPuzzleResult,
    type DailyPuzzleStartResponse,
    type DailyPuzzleState,
    type DailyPuzzleSubmitResponse,
    type ClientJoinCommunityResponse,
    type ClientJoinGroupResponse,
    type GateCheckSucceeded,
    type JoinOutcome,
    type CommunitiesRoute,
    type CommunityDetailsResponse,
    type CommunityIdentifier,
    type CommunityInvite,
    type CommunitySummary,
    type CompletedCryptocurrencyTransfer,
    type CommunityAndRules,
    type CreateCommunityOutcome,
    type CreateCommunityResponse,
    type CreateGroupOutcome,
    type GroupMoveOutcome,
    type CreateGroupResponse,
    type CreateMultiUserCanisterResponse,
    type FinaliseAccountLinkingResponse,
    type FundsInPreviousWallet,
    type MoveFundsOutcome,
    type CreateUserGroupResponse,
    type CreatedUser,
    type CryptocurrencyContent,
    type CryptoTransferOutcome,
    type CryptocurrencyDetails,
    type CryptocurrencyTransfer,
    type CurrentUserResponse,
    type DataContent,
    type DeleteCryptoAccountResponse,
    type DexId,
    type DexQuote,
    type DiamondMembershipDuration,
    type DiamondMembershipFees,
    type DiamondMembershipStatus,
    type DiamondRoute,
    type Dimensions,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type EnhancedAccessGate,
    type EventWrapper,
    type EventsResponse,
    type EventsSuccessResult,
    type EvmChain,
    type EvmContractAddress,
    type ExpiredEventsRange,
    type ExploreBotsResponse,
    type ExploreChannelsResponse,
    type ExploreCommunitiesResponse,
    type ExternalBot,
    type ExternalBotCommandInstance,
    type Failure,
    type FaqRoute,
    type FullWebhookDetails,
    type GenerateMagicLinkResponse,
    type GlobalSelectedChatRoute,
    type GrantedBotPermissions,
    type GroupChatDetailsResponse,
    type GroupChatIdentifier,
    type GroupChatSummary,
    type GroupInvite,
    type GroupMoved,
    type GroupSearchResponse,
    type GroupSubtype,
    type GuidelinesRoute,
    type HandleMagicLinkResponse,
    type HomeRoute,
    type IdentityKeyAndChain,
    type IdentityState,
    type InternalBotCommandInstance,
    type InviteLink,
    type InviteLinkOutcome,
    type JoinVideoCallResponse,
    type Level,
    type LinkIdentitiesResponse,
    type LinkedAuthenticationPrincipal,
    type LogLevel,
    type Logger,
    type MakeProposalOutcome,
    type MarkReadRequest,
    type Member,
    type MemberRole,
    type Mention,
    type Message,
    type MessageActivityFeedResponse,
    type MessageActivitySummary,
    type MessageContent,
    type MessageContext,
    type ModerationVerdict,
    type NcaPriority,
    type NcaReporterContact,
    type AuthorityReportTokenResponse,
    type VaultFileChunkResponse,
    type VaultFileInfoResponse,
    type MessageFilter,
    type MessageFormatter,
    type MessagePermission,
    type MessageReminderCreatedContent,
    type ModerationFlag,
    type MultiUserChat,
    type MultiUserChatIdentifier,
    type NamedAccount,
    type NervousSystemDetails,
    type NewUnconfirmedMessage,
    type Notification,
    type OgPreview,
    type OneSecForwardingStatus,
    type OneSecTransferFees,
    type OptionUpdate,
    type PartitionedUserIds,
    type PayForDiamondMembershipResponse,
    type PayForPremiumItemResponse,
    type PayForStreakInsuranceResponse,
    type PaymentGateApproval,
    type PaymentGateApprovals,
    type PendingCryptocurrencyTransfer,
    type PendingCryptocurrencyWithdrawal,
    type PreprocessedGate,
    type ProposalContent,
    type ProposalExecutionPayment,
    type ProposalVoteDetails,
    type SubmitProposalResponse,
    type ProposalVoteOutcome,
    type Withdrawal,
    type WithdrawOutcome,
    type ProposeResponse,
    type PubSubEvents,
    type PublicProfile,
    type SaveProfileOutcome,
    type ReadonlyMap,
    type Referral,
    type RegisterProposalVoteResponse,
    type RegisterUserResponse,
    type RehydratedMessagePreview,
    type RejectReason,
    type RemoteUserSentMessage,
    type RemoteUserToggledReaction,
    type RemoveIdentityLinkResponse,
    type RemoveMemberResponse,
    type RightPanelContent,
    type RoadmapRoute,
    type RouteParams,
    type Rules,
    type SaveCryptoAccountResponse,
    type SearchDirectChatResponse,
    type SearchGroupChatResponse,
    type SelectedChannelRoute,
    type SelectedCommunityRoute,
    type DirectBotMessageOutcome,
    type SendMessageOutcome,
    type SignInMethod,
    type SignUpOutcome,
    type EmailSignInRequest,
    type SignInOutcome,
    type ReAuthMethod,
    type ReAuthOutcome,
    type EmailReAuthRequest,
    type ResourceKey,
    InMemoryAuthClientStorage,
    type SendMessageResponse,
    type SendMessageSuccess,
    type SetDisplayNameResponse,
    type SetMemberDisplayNameResponse,
    type SetPinNumberResponse,
    type SetUsernameResponse,
    type ShareRoute,
    type SiwePrepareLoginResponse,
    type SiwsPrepareLoginResponse,
    type StreakInsurance,
    type SubmitProofOfUniquePersonhoodResponse,
    type Success,
    type SwapFromWalletStep,
    type SwapOutcome,
    type SwapQuote,
    type SwapQuoteOutcome,
    type SwapTokensResponse,
    type TermsRoute,
    type PrivacyRoute,
    type ThreadPreview,
    type ThreadRead,
    type ThreadSummary,
    type ThreadSyncDetails,
    type TipMessageResponse,
    type TipOutcome,
    type TokenInfo,
    type TransferSuccess,
    type GroupChangeConfirmation,
    type UpdateCommunityOutcome,
    type UpdateCommunityResponse,
    type UpdateGroupOutcome,
    type UpdateGroupResponse,
    type UpdateUserGroupResponse,
    type UpdatedEvent,
    type UpdatesResult,
    type User,
    type UserGroupDetails,
    type UserOrUserGroup,
    type UserStatus,
    type UserSummary,
    type UsersArgs,
    type UsersResponse,
    type Verification,
    type VerifiedCredentialArgs,
    type VerifyAccountLinkingCodeResponse,
    type VersionedRules,
    type VideoCallParticipant,
    type VideoCallOutcome,
    type VideoCallPresence,
    type VideoCallRoom,
    type VideoCallType,
    type WalletConfig,
    type WebAuthnKey,
    type WebAuthnKeyFull,
    type WebRtcMessage,
    type WebhookDetails,
    type WhitepaperRoute,
    type WithdrawBtcResponse,
    type WithdrawSolResponse,
    type WithdrawCryptocurrencyResponse,
    type OCError,
    type ProposedProtectedAction,
    type BridgedUserId,
    type BridgedUserLinkCode,
    type BridgedUserSummary,
    type BridgePlatform,
    type PriceHistory,
    type MiniAppGame,
    type MiniAppOpenOutcome,
    type MiniAppOutcome,
    type MiniAppStartOutcome,
    type PriceSubject,
    bridgedUserId,
    bridgedUserIdsFromEvents,
    bridgedUserIdsFromLatestMessages,
    bridgedUserIdsFromMessages,
    bridgedUserKey,
    buildBlobUrl,
    isOwnMessage,
    isAndroidTauriApp,
    isIosTauriApp,
    isPrincipalValid,
    messageContextToString,
    typedMentions,
    paymentSpenderAccount,
} from "@shared";
import { tick } from "svelte";
import { locale } from "svelte-i18n";
import { get, type Unsubscriber } from "svelte/store";
import { AndroidWebAuthnErrorCode } from "tauri-plugin-oc-api";
import type { OpenChatConfig } from "./config";
import { approveFromExternalWallet, type SignerWallet, type WalletAccount } from "./utils/signer";
import { unarchiveChatsReportingFailure, unarchiveChatsWithUnread } from "./utils/autoUnarchive";
import { blockOutcome, type BlockContext, type BlockOutcome } from "./utils/profileBlock";
import { isTrustedClick } from "./utils/prizes";
import {
    FilteredProposals,
    achievementsStore,
    allChatsStore,
    allServerChatsStore,
    anonUserStore,
    askForNotificationPermission,
    bitcoinAddress,
    bridgedUsersStore,
    chatListScopeStore,
    chatSummariesListStore,
    chatSummariesStore,
    chatsInitialisedStore,
    chitStateStore,
    dailyPuzzleStore,
    communitiesStore,
    communityFiltersStore,
    confirmedThreadEventIndexesLoadedStore,
    cryptoBalanceStore,
    cryptoLookup,
    currentUserIdStore,
    currentUserProfileStore,
    currentUserStore,
    diamondStatusStore,
    directChatBotsStore,
    eventListScrollTop,
    eventsStore,
    exchangeRatesLookupStore,
    cashtagCoinsStore,
    priceSourcesStore,
    miniAppCardsStore,
    expiredServerEventRanges,
    favouritesStore,
    hasFlag,
    identityStateStore,
    initNotificationStores,
    isDiamondStore,
    isLifetimeDiamondStore,
    lastCryptoSent,
    lastSelectedChatByScopeStore,
    lastSelectedCommunityIdStore,
    latestSuccessfulUpdatesLoop,
    localUpdates,
    messageActivitySummaryStore,
    messageFiltersStore,
    mobileWidth,
    moderationFlagsEnabledStore,
    namedAccountsStore,
    navOpen,
    nervousSystemLookup,
    nextCommunityIndexStore,
    notFoundStore,
    notificationStatus,
    notificationsSupported,
    videoProcessingProgress,
    oneSecAddress,
    solanaAddress,
    pathContextStore,
    pinNumberFailureStore,
    pinNumberRequiredStore,
    pinNumberResolverStore,
    pinnedChatsStore,
    platformOperatorStore,
    premiumItemsStore,
    querystringCodeStore,
    querystringReferralCodeStore,
    querystringStore,
    referralsStore,
    rightPanelHistory,
    routeStore,
    selectedAuthProviderStore,
    selectedChatBlockedUsersStore,
    selectedChatIdStore,
    selectedChatInvitedUsersStore,
    selectedChatMembersStore,
    selectedChatRulesStore,
    selectedChatSummaryStore,
    selectedChatUserIdsStore,
    selectedChatWebhooksStore,
    selectedCommunityBlockedUsersStore,
    selectedCommunityIdStore,
    selectedCommunityInvitedUsersStore,
    selectedCommunityMembersStore,
    selectedCommunityReferralsStore,
    selectedCommunityRulesStore,
    selectedCommunitySummaryStore,
    selectedCommunityUserGroupsStore,
    selectedServerChatStore,
    selectedServerChatSummaryStore,
    selectedServerCommunityStore,
    selectedThreadIdStore,
    serverCommunitiesStore,
    serverDirectChatBotsStore,
    serverDirectChatsStore,
    serverEventsStore,
    serverFavouritesStore,
    serverThreadEventsStore,
    serverGroupChatsStore,
    serverMessageActivitySummaryStore,
    serverPinnedChatsStore,
    serverStreakInsuranceStore,
    serverWalletConfigStore,
    setSoftDisabled,
    snsFunctionsStore,
    sortedCommunitiesStore,
    storageStore,
    suspendedUserStore,
    swappableTokensStore,
    swapProvidersStore,
    threadEventIndexesLoadedStore,
    threadEventsStore,
    translationsStore,
    userCreatedStore,
    walletConfigStore,
    walletTokenBySymbol,
    webhookUserIdsStore,
} from "./state";
import {
    currentChatVisit,
    currentThreadVisit,
    eventsVisitFor,
    expandDeletedMessages,
    SelectedChat,
    selectedChatFor,
    SelectedThread,
    selectedThreadFor,
    startThreadVisit,
    type EventsVisit,
} from "./state/selectedChat";
import { botState } from "./state/bots.svelte";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { CommunityDetailsState } from "./state/community/server";
import type { HeldMembers } from "./state/members";
import type { UndoLocalUpdate } from "./state/undo";
import { messagesRead, startMessagesReadTracker } from "./state/unread/markRead";
import { userStore } from "./state/users/state";
import { addToWritableMap, removeFromWritableMap } from "./state/utils";
import { offlineStore } from "./stores";
import { diamondDurationToMs } from "./stores/diamond";
import { applyTranslationCorrection } from "./stores/i18n";
import { lastOnlineDates } from "./stores/lastOnlineDates";
import { dailyPuzzleResultsCache } from "./stores/dailyPuzzleResults";
import { minutesOnlineStore } from "./stores/minutesOnline";
import { recommendedGroupExclusions } from "./stores/recommendedGroupExclusions";
import { captureRulesAcceptanceStore } from "./stores/rules";
import { initialiseMostRecentSentMessageTimes, shouldThrottle } from "./stores/throttling";
import { isTyping, typing } from "./stores/typing";
import { unconfirmedReadByThem } from "./stores/unconfirmed";
import { proposalVotesStore } from "./stores/proposalVotes";
import { undeletingMessagesStore } from "./stores/undeletingMessages";
import {
    airdropBotUser,
    anonymousUserSummary,
    openChatBotUser,
    proposalsBotUser,
    videoCallBotUser,
} from "./stores/user";
import {
    AndroidWebAuthnPasskeyIdentity,
    createAndroidWebAuthnPasskeyIdentity,
} from "./utils/androidWebAuthn";
import { dataToBlobUrl } from "./utils/blob";
import { allChitEvents, newestFirstChitEvents } from "./utils/chit";
import {
    appStoreBuild,
    chatRestricted,
    communityRestricted,
    moderationFlagsRestricted,
} from "./utils/restrictedContent";
import { walletConfigWithoutToken } from "./utils/walletConfig";
import {
    leaveOrDeleteNavigation,
    leaveOrDeleteOutcome,
    type LeaveOrDelete,
    type LeaveOrDeleteOutcome,
    type LeaveOrDeleteResult,
} from "./utils/leaveOrDelete";
import {
    userGroupMemberChanges,
    userGroupSaveOutcome,
    type UserGroupSaveOutcome,
} from "./utils/userGroups";
import { webhookChanges, webhookFailure, type WebhookSaveOutcome } from "./utils/webhook";
import {
    defaultChat,
    navigationAfterArchivingOpenChat,
    activeUserIdFromEvent,
    applyTranslation,
    buildCryptoTransferText,
    buildBridgedUserAvatarUrl,
    buildIdenticonUrl,
    buildTransactionLink,
    buildTransactionUrlByIndex,
    buildUserAvatarUrl,
    buildUserBackgroundUrl,
    canAddMembers,
    canBlockUsers,
    canChangePermissions,
    canChangeRoles,
    canChangeVisibility,
    canConvertToCommunity,
    canDeleteGroup,
    canDeleteOtherUsersMessages,
    canEditGroupDetails,
    canForward,
    canImportToCommunity,
    canInviteUsers,
    canLeaveGroup,
    canMentionAllMembers,
    canPinMessages,
    canReactToMessages,
    canRemoveMembers,
    canSendDirectMessage,
    canSendGroupMessage,
    canStartVideoCalls,
    canTipMessages,
    canUnblockUsers,
    confirmedEventIndexesLoaded,
    containsReaction,
    createMessage,
    detailsLastUpdated,
    doesMessageFailFilter,
    eventIndexesLoaded,
    findMessageById,
    getMessageText,
    getTypingString,
    groupBySender,
    groupChatFromCandidate,
    groupEvents,
    groupMessagesByDate,
    isContiguous,
    isContiguousInThread,
    isEventKindHidden,
    isFrozen,
    isLapsed,
    isPreviewing,
    makeRtcConnections,
    mergeSendMessageResponse,
    mergeServerEvents,
    messageIsReadByThem,
    metricsEqual,
    newDefaultChannel,
    permittedMessagesInDirectChat,
    permittedMessagesInGroup,
    rtcMessageRecipients,
    sameUser,
    serialiseMessageForRtc,
    startTyping,
    stopTyping,
    updateExistingMessages,
} from "./utils/chat";
import { disableInviteCodeResult, inviteCodeResult } from "./utils/inviteLink";
import { proposalVoteResult } from "./utils/proposalVote";
import { withdrawFailed, withdrawResult } from "./utils/withdraw";
import {
    groupChangeConfirmationNeeded,
    groupChanges,
    groupCreationFailure,
    groupUpdateResult,
} from "./utils/group.svelte";
import {
    swapError,
    swapInsufficientFunds,
    swapQuoteResult,
    swapResult,
    swapUnconfirmed,
} from "./utils/swap";
import { joinGroupFailureMessage } from "./utils/join";
import { currentTip, tipResult } from "./utils/tip";
import { cryptoTransferResult } from "./utils/cryptoTransfer";
import {
    emailLinkFailure,
    isOwnPrincipal,
    markCurrentSignIn,
    signInOutcome,
    signInProvider,
} from "./utils/signIn";
import {
    createdUser as createdUserFrom,
    referralCodeRefused,
    registerFailureKey,
} from "./utils/signUp";
import {
    executionPaymentAmount,
    PROPOSAL_EXECUTION_WINDOW,
    proposalFailed,
    proposalFee,
    submitProposalResult,
} from "./utils/proposal";
import {
    bioResult,
    displayNameResult,
    profileChanges,
    usernameResult,
    type ProfileFieldResult,
} from "./utils/profile";
import {
    canBlockUsers as canBlockCommunityUsers,
    canChangeCommunityPermissions,
    canChangeRoles as canChangeCommunityRoles,
    canCreatePrivateChannel,
    canCreatePublicChannel,
    canDeleteCommunity,
    canEditCommunity,
    canInviteUsers as canInviteCommunityUsers,
    canManageUserGroups,
    canRemoveMembers as canRemoveCommunityMembers,
    canUnblockUsers as canUnblockCommunityUsers,
    communityChangeConfirmationNeeded,
    communityChanges,
    communityCreationFailure,
    communityUpdateResult,
    isCommunityLapsed,
} from "./utils/community";
import { verifyCredential } from "./utils/credentials";
import { formatTokens, validateTokenInput } from "./utils/cryptoFormatter";
import {
    formatDateLong,
    formatMessageDate,
    getSmartDateHeader,
    toDateString,
    toDatetimeString,
    toLongDateString,
    toMonthString,
    toMonthYearString,
    toRelativeTime,
    toShortTimeString,
} from "./utils/date";
import { getErc20TokenBalances, type Erc20TokenBalance } from "./utils/evm";
import { getSolBalance } from "./utils/solana";
import formatFileSize from "./utils/fileSize";
import { gaTrack } from "./utils/ga";
import { calculateMediaDimensions } from "./utils/layout";
import { chunk, groupBy, groupWhile, keepMax, partition, toRecord, toRecord2 } from "./utils/list";
import { getUserCountryCode } from "./utils/location";
import {
    DIAMOND_MAX_SIZES,
    FREE_MAX_SIZES,
    audioRecordingMimeType,
    communityMessageRegex,
    fillMessage,
    groupMessageRegex,
    messageContentFromFile,
    type MaxMediaSizes,
} from "./utils/media";
import { hasOwnerRights } from "./utils/permissions";
import { Poller } from "./utils/poller";
import { watchForResume, type ResumeReason } from "./utils/resumeDetector";
import { answerTouchesChat } from "./utils/answerTouchesChat";
import { routeForMovedDirectChat } from "./utils/movedDirectChatRoute";
import {
    movePreviousWalletFunds,
    PREVIOUS_WALLETS_RETRY_INTERVAL,
} from "./utils/previousWalletFunds";
import { openChatIdentityOrSignOut } from "./utils/openChatIdentity";
import { jwtExpiryMs } from "./utils/jwt";
import { MiniAppService, type MiniAppGameListener } from "./utils/miniAppService";
import { SyncPuller } from "./utils/syncPuller";
import { passkeyProviderName } from "./utils/passkeyProvider";
import { showTrace } from "./utils/profiling";
import { indexIsInRanges } from "./utils/range";
import { RecentlyActiveUsersTracker } from "./utils/recentlyActiveUsersTracker";
import { routeForScope } from "./utils/routes";
import {
    createRemoteVideoStartedEvent,
    filterWebRtcMessage,
    parseWebRtcMessage,
} from "./utils/rtc";
import { rtcConnectionsManager } from "./utils/rtcConnectionsManager";
import { Semaphore } from "./utils/semaphore";
import { withPausedStores } from "./utils/stores";
import {
    durationFromMilliseconds,
    formatDisappearingMessageTime,
    formatDuration,
    formatRelativeTime,
    formatTimeRemaining,
} from "./utils/time";
import { initialiseTracking, startTrackingSession, trackEvent } from "./utils/tracking";
import { startSwCheckPoller } from "./utils/updateSw";
import { addQueryStringParam } from "./utils/url";
import {
    buildReducedProfileDataList,
    buildUsernameList,
    formatLastOnlineDate,
    isDeletedWebhook,
    missingUserIds,
    shouldRestartForNewUserId,
    nullUser,
    userAvatarUrl,
} from "./utils/user";
import { MultiWebAuthnIdentity, createWebAuthnIdentity } from "./utils/webAuthn";
import { WorkerAgent } from "./workerAgent";

export const DEFAULT_WORKER_TIMEOUT = 1000 * 90;
const MARK_ONLINE_INTERVAL = 61 * 1000;
const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE_MILLIS;
const BOT_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
// A bridged account's profile is fetched again once it's this old, as messages are loaded
const BRIDGED_USER_MAX_AGE = 10 * ONE_MINUTE_MILLIS;
const BRIDGED_USER_RETRY_DELAY = 5_000;
const BOT_UPDATE_IDLE_INTERVAL = 5 * ONE_MINUTE_MILLIS;
const USER_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
// The daily puzzle changes at rollover and when an operator regenerates or enables it; an
// installed app never reloads, so this is how it learns (#9334 invariants 56 and 57)
const DAILY_PUZZLE_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
const DAILY_PUZZLE_UPDATE_IDLE_INTERVAL = 5 * ONE_MINUTE_MILLIS;
const REGISTRY_UPDATE_INTERVAL = 2 * ONE_MINUTE_MILLIS;
const EXCHANGE_RATE_UPDATE_INTERVAL = 5 * ONE_MINUTE_MILLIS;
const MAX_USERS_TO_UPDATE_PER_BATCH = 500;
const MAX_INT32 = Math.pow(2, 31) - 1;

// Diagnostic reports carried "[object Object]" wherever the thrown value was a plain object
// rather than an Error, which is most of them once an error has crossed the worker boundary.
function describeError(err: unknown): string {
    if (typeof err === "string") return err;
    const message = (err as { message?: unknown })?.message;
    if (typeof message === "string" && message.length > 0) return message;
    try {
        return JSON.stringify(err) ?? String(err);
    } catch {
        return String(err);
    }
}

// What #sendMessageCommon tells a caller that waits only until its message shows in the chat
type SendHooks = {
    posted(): void;
    rulesDeclined(): void;
};

// The links in a message to other OpenChat messages, whose previews are shown on it
function linkedMessageUrls(content: MessageContent): string[] {
    return content.kind === "text_content"
        ? extractMessagePreviews(content.text).map((p) => p.url)
        : [];
}

function sameUrls(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((url) => b.includes(url));
}

// The users who are known not to be members of the chat or community with this key, and the lookups
// in flight of those who may be, so that nobody is looked up twice
type MemberLookups = {
    key: string | undefined;
    notMembers: Set<string>;
    // Each resolves to those in the same lookup who are members and haven't lapsed
    pending: Map<string, Promise<ReadonlySet<string>>>;
};

function noMemberLookups(): MemberLookups {
    return { key: undefined, notMembers: new Set(), pending: new Map() };
}

// How many users to search for at a time when finding members of a chat or community. The users
// found are those who best match out of every user, so it takes many to find a few who are members.
const USERS_SEARCHED_TO_FIND_MEMBERS = 255;
// The most pages of users searched through when finding members, for a term which many users match
const MAX_PAGES_SEARCHED_FOR_MEMBERS = 4;
// How many members to find to offer as mentions for what has been typed
const MEMBERS_FOUND_TO_MENTION = 50;
// The most usernames mentioned in a message which are looked up among the members of a chat which
// holds only some of them
const MAX_USERNAMES_MENTIONED_LOOKED_UP = 10;
// How often, and how many times, to check for the output of a swap reaching the wallet
const SWAP_OUTPUT_CHECK_INTERVAL_MS = 2000;
const SWAP_OUTPUT_CHECKS = 10;

// What an emailed link is for: whether this browser takes the identity it signs in
type EmailLink = {
    identity: "take" | "leave";
    category: "registration" | "account_linking";
};
const SIGN_IN_BY_EMAIL: EmailLink = { identity: "take", category: "registration" };
// signing in again never takes the identity it signs in
const REAUTH_BY_EMAIL: EmailLink = { identity: "leave", category: "account_linking" };
// the identity a followed link signs in, or undefined once it's given up
type EmailLinkFollowed = { key: ECDSAKeyIdentity; delegation: DelegationChain } | undefined;

// An identity the user signed in again with (reAuthenticate)
type ReAuthIdentity = {
    provider: AuthProvider;
    key: ECDSAKeyIdentity;
    delegation: DelegationChain;
};

export class OpenChat {
    // When each bridged account's profile was last fetched, keyed by `bridgedUserKey`
    #bridgedUsersFetchedAt = new Map<string, number>();
    #bridgedUsersInFlight = new Set<string>();
    #mobileLayout: "v1" | "v2";
    #worker: WorkerAgent;
    #authIdentityStorage: IdentityStorage;
    #authPrincipal: string | undefined;
    #ocIdentityPrincipal: string | undefined;
    #authClient: Promise<AuthClient>;
    #webAuthnKey: WebAuthnKey | undefined = undefined;
    #userLocation: string | undefined;
    #logger: Logger;
    // Diagnostics for the "selected chat renders empty" report. Every path that can leave a
    // chat empty does so without an error, so record which one fired. One chat selection is
    // one incident, and at most three incidents are reported per session so a widespread
    // cause cannot flood Rollbar.
    #chatSelectionSeq = 0;
    #emptyChatIncidents = new Set<number>();
    // The loads of the selected chat's and community's details, which hold their rules. A message
    // forwarded before these finish waits for them (see #sendMessageCommon).
    #chatDetailsLoad: { chatId: ChatIdentifier; loaded: Promise<void> } | undefined;
    #communityDetailsLoad: { communityId: CommunityIdentifier; loaded: Promise<void> } | undefined;
    #lastOnlineDatesPending = new Set<string>();
    #lastOnlineDatesPromise: Promise<Record<string, number>> | undefined;
    #dailyResultsPending = new Map<
        string,
        { userIds: Set<string>; promise: Promise<Record<string, DailyPuzzleResult>> }
    >();
    #membershipCheck: number | undefined;
    #currentUserIdChangedPublished = false;
    // counts the changes made here to the current user's profile, which a refresh mustn't undo
    #currentUserProfileWrites = 0;
    #referralCode: string | undefined = undefined;
    #userLookupForMentions:
        | {
              lookup: Record<string, UserOrUserGroup>;
              // What it was built from, so that it is rebuilt when either changes, eg. when
              // members who weren't held are found
              members: ReadonlyMap<string, Member>;
              communityMembers: ReadonlyMap<string, Member>;
              // If some of the members' users weren't known when it was built, the version of
              // the users then, so that it is rebuilt once more are known
              usersVersion: number | undefined;
          }
        | undefined = undefined;
    #communityMemberLookups = noMemberLookups();
    #chatMemberLookups = noMemberLookups();
    // The users who have appeared in the events loaded of the chat with this key, and the accounts
    // (by key) its relayed messages came from, whose linked users are shown as their authors
    #usersSeenInChat: { key: string | undefined; userIds: Set<string>; bridgedUsers: Set<string> } =
        {
            key: undefined,
            userIds: new Set(),
            bridgedUsers: new Set(),
        };
    #chatsPoller: Poller | undefined = undefined;
    #stopWatchingForResume: (() => void) | undefined = undefined;
    readonly #syncPuller: SyncPuller;
    #botsPoller: Poller | undefined = undefined;
    #dailyPuzzlePoller: Poller | undefined = undefined;
    #dailyPuzzleRolloverTimer: number | undefined = undefined;
    #dailyPuzzleVisibilityListener: (() => void) | undefined = undefined;
    #registryPoller: Poller | undefined = undefined;
    #onlinePoller: Poller | undefined = undefined;
    #btcBalancePoller: Poller | undefined = undefined;
    #btcAddressUnsub: Unsubscriber | undefined = undefined;
    #oneSecAddressUnsub: Unsubscriber | undefined = undefined;
    #solBalancePoller: Poller | undefined = undefined;
    #solAddressUnsub: Unsubscriber | undefined = undefined;
    // Until when the user's SOL deposit address is checked every minute (see `#startSolBalanceUpdateJob`)
    #solDepositWatchedUntil = 0;
    #userUpdatePoller: Poller | undefined = undefined;
    #exchangeRatePoller: Poller | undefined = undefined;
    // undefined where there's no MiniApp service
    readonly #miniApps: MiniAppService | undefined;
    #proposalTalliesPoller: Poller | undefined = undefined;
    #notificationSubscriptionPoller: Poller | undefined = undefined;
    #recentlyActiveUsersTracker: RecentlyActiveUsersTracker = new RecentlyActiveUsersTracker();
    #inflightMessagePromises: Map<
        bigint,
        (response: SendMessageSuccess | TransferSuccess) => void
    > = new Map();
    #refreshBalanceSemaphore: Semaphore = new Semaphore(10);
    #movePreviousWalletFundsTimer: number | undefined;
    #inflightBalanceRefreshPromises: Map<string, Promise<bigint | undefined>> = new Map();
    #videoCallsInProgress: Set<bigint> = new Set();
    #serverVideoCallsInProgress: ChatMap<bigint> = new ChatMap();
    // Archived chats this client is bringing out of the archive, until each request settles
    #unarchiving = new ChatSet();
    #locale!: string;
    #vapidPublicKey: string;
    #getBtcAddressPromise: Promise<string> | undefined = undefined;
    #getOneSecAddressPromise: Promise<string> | undefined = undefined;
    #getSolAddressPromise: Promise<string> | undefined = undefined;
    #evmContractAddresses: EvmContractAddress[] = [];

    currentAirdropChannel: AirdropChannelDetails | undefined = undefined;

    constructor(private config: OpenChatConfig) {
        this.#logger = config.logger;
        this.#syncPuller = new SyncPuller({
            pull: (since) => this.#worker.send({ kind: "syncSince", since }),
            fold: (updates) => this.#handleChatsResponse(undefined, false, updates),
            log: (message, err) => this.#logger.error(message, err as Error),
        });
        this.#worker = new WorkerAgent(config, (head) => this.#syncPuller.onHead(head));

        this.#mobileLayout = config.mobileLayout;
        this.#vapidPublicKey = config.vapidPublicKey;
        locale.subscribe((v) => (this.#locale = v ?? "en"));

        if (config.miniAppServiceUrl !== "") {
            const miniApps = new MiniAppService({
                url: config.miniAppServiceUrl,
                chatToken: (chatId) => this.#miniAppChatToken(chatId),
                cards: miniAppCardsStore,
            });
            this.#miniApps = miniApps;
            selectedChatIdStore.subscribe((chatId) => miniApps.viewChat(chatId));
        }

        userStore.setSpecialUsers([
            openChatBotUser,
            videoCallBotUser,
            airdropBotUser,
            anonymousUserSummary,
            proposalsBotUser(config.proposalBotCanister),
        ]);

        initialiseTracking(config);

        this.#authIdentityStorage = IdentityStorage.createForAuthIdentity();
        this.#authClient = AuthClient.create({
            idleOptions: {
                disableIdle: true,
                disableDefaultIdleCallback: true,
            },
            storage: this.#authIdentityStorage.storage,
        });

        this.#authClient
            .then((_) => this.#authIdentityStorage.getKeyAndChain())
            .then((authIdentity) => this.#loadedAuthenticationIdentity(authIdentity, undefined));

        this.#setMinLogLevel((localStorage.getItem(configKeys.minLogLevel) ?? "warn") as LogLevel);
    }

    public get AuthPrincipal(): string {
        if (this.#authPrincipal === undefined) {
            throw new Error("Trying to access the _authPrincipal before it has been set up");
        }
        return this.#authPrincipal;
    }

    // The principal of the OpenChat identity, which is the caller of every canister call the
    // worker makes (and so the principal to hot-key neurons to). Distinct from the auth principal.
    public get OcIdentityPrincipal(): string {
        if (this.#ocIdentityPrincipal === undefined) {
            throw new Error("Trying to access the OC identity principal before it has been set up");
        }
        return this.#ocIdentityPrincipal;
    }

    isNativeAndroid() {
        return isAndroidTauriApp();
    }

    isNativeIos() {
        return isIosTauriApp();
    }

    canonicalOrigin() {
        if (this.isNativeApp()) {
            return this.config.baseOrigin;
        } else {
            return window.location.origin;
        }
    }

    isNativeApp() {
        return this.isNativeAndroid() || this.isNativeIos();
    }

    get mobileLayout() {
        return this.#mobileLayout;
    }

    clearCachedData() {
        return this.#worker.send({
            kind: "clearCachedData",
        });
    }

    accountLinkingCodeEnabled() {
        return this.config.accountLinkingCodesEnabled;
    }

    deleteCurrentUser(
        identityKey: CryptoKeyPair,
        delegation: JsonnableDelegationChain,
    ): Promise<boolean> {
        if (!anonUserStore.value) {
            return this.#worker
                .send({
                    kind: "deleteUser",
                    identityKey,
                    delegation,
                })
                .then((success) => {
                    if (success) {
                        this.clearCachedData().finally(() => this.logout());
                    }
                    return success;
                });
        } else {
            return Promise.resolve(false);
        }
    }

    // Whether the details held for this group or channel are missing or older than its summary
    #chatDetailsBehind(serverChat: ChatSummary): boolean {
        if (serverChat.kind === "direct_chat") return false;
        const details = selectedServerChatStore.value;
        return (
            details === undefined ||
            !chatIdentifiersEqual(details.chatId, serverChat.id) ||
            details.timestamp < detailsLastUpdated(serverChat)
        );
    }

    #chatUpdated(chatId: ChatIdentifier, updatedEvents: UpdatedEvent[]): void {
        if (
            selectedChatIdStore.value === undefined ||
            !chatIdentifiersEqual(chatId, selectedChatIdStore.value)
        ) {
            return;
        }

        const serverChat = selectedServerChatSummaryStore.value;
        if (serverChat === undefined) return;
        // The chat summary has been updated which means the latest message may be new
        const latestMessage = serverChat.latestMessage;
        if (
            latestMessage !== undefined &&
            latestMessage.event.sender !== currentUserIdStore.value
        ) {
            this.#handleConfirmedMessageSentByOther(serverChat, latestMessage, undefined);
        }

        this.#refreshUpdatedEvents(serverChat, updatedEvents);
        this.#loadChatDetails(selectedChatFor(serverChat.id), serverChat);
        publish("chatUpdated", { chatId, threadRootMessageIndex: undefined });
    }

    clearPostLoginState() {
        identityStateStore.update((state) => ({ ...state, postLogin: undefined }));
    }

    updateIdentityState(newState: IdentityState) {
        identityStateStore.update((previous) => {
            return {
                ...newState,
                postLogin: newState.postLogin ?? previous.postLogin,
            };
        });
    }

    async #loadedAuthenticationIdentity(
        identityKeyAndChain: IdentityKeyAndChain | undefined,
        authProvider: AuthProvider | undefined,
        registering: boolean = false,
    ) {
        const anon = identityKeyAndChain === undefined;
        const identity = anon
            ? new AnonymousIdentity()
            : DelegationIdentity.fromDelegation(
                  identityKeyAndChain.key,
                  identityKeyAndChain.delegation,
              );
        // Stop the chats poller until we have finished loading the new identity
        this.#chatsPoller?.stop();
        this.#stopWatchingForResume?.();
        this.#stopWatchingForResume = undefined;
        this.#dailyPuzzlePoller?.stop();
        if (typeof window !== "undefined") window.clearTimeout(this.#dailyPuzzleRolloverTimer);
        currentUserStore.set(anonymousUser());
        chatsInitialisedStore.set(false);
        this.#syncPuller.clear();
        const authPrincipal = identity.getPrincipal().toString();
        this.#authPrincipal = anon ? undefined : authPrincipal;
        this.#ocIdentityPrincipal = undefined;
        this.updateIdentityState(anon ? { kind: "anon" } : { kind: "loading_user", registering });

        const setAuthIdentityResponse = await this.#worker.send({
            kind: "setAuthIdentity",
            identity: identityKeyAndChain
                ? {
                      key: identityKeyAndChain.key.getKeyPair(),
                      delegation: identityKeyAndChain.delegation.toJSON(),
                  }
                : undefined,
            isIIPrincipal: authProvider == AuthProvider.II,
        });

        this.#startRegistryPoller();

        let createdUser: CreatedUser | undefined;
        if (!anon) {
            const ocIdentity = await openChatIdentityOrSignOut(
                setAuthIdentityResponse,
                () =>
                    this.#worker.send({
                        kind: "createOpenChatIdentity",
                        webAuthnCredentialId: this.#webAuthnKey?.credentialId,
                    }),
                (reason) => {
                    this.#logger.error(
                        "No OpenChat identity for the signed-in principal, signing out",
                        new Error(reason),
                    );
                    this.logout();
                },
            );
            if (ocIdentity === undefined) return;

            this.#ocIdentityPrincipal = ocIdentity.ocIdentityPrincipal;
            this.#startSession(ocIdentity.ocIdentityPrincipal, ocIdentity.ocIdentityExpiry);

            createdUser = await this.getCurrentUser()
                .then((user) => {
                    switch (user.kind) {
                        case "created_user":
                            return user;
                        case "unknown_user":
                            this.updateIdentityState({ kind: "registering" });
                            return undefined;
                    }
                })
                .catch((e) => {
                    if (e.code === 403) {
                        // This happens locally if you run a new instance of the IC and have an identity based on the
                        // previous version's root key in the cache
                        this.logout();
                    }
                    return undefined;
                });
        }

        this.onCreatedUser(createdUser ?? anonymousUser());
    }

    #reportEmptyChat(reason: string, context: Record<string, unknown>): void {
        // The logger only sends when online, so an offline report would spend the budget
        // for nothing
        if (get(offlineStore)) return;
        const incident = this.#chatSelectionSeq;
        if (this.#emptyChatIncidents.size >= 3 && !this.#emptyChatIncidents.has(incident)) {
            return;
        }
        this.#emptyChatIncidents.add(incident);
        const message = `EmptyChatDiagnostic: ${reason}`;
        this.#logger.error(message, new Error(message), context);
    }

    // Runs once the initial load of a selected chat has settled: if it is still the selected
    // chat and nothing reached the event store, recover it and report what happened.
    //
    // Four paths through loadPreviousMessages arrive here having loaded nothing AND thrown
    // nothing, and the original report could not tell them apart:
    //
    //   - the chat is absent from allServerChatsStore (the summary read here comes from
    //     chatSummariesStore, and those two diverge for previews and uninitialised direct chats)
    //   - it is a private preview
    //   - #previousMessagesCriteria concludes there is nothing left to fetch
    //   - the events stream completes without emitting, so .aggregate falls back to
    //     emptyEventsResponse(), which is a SUCCESS carrying zero events - indistinguishable
    //     from a genuinely empty chat
    //
    // Whichever it was, a chat with history rendering nothing is wrong, and nothing retries
    // until the user reselects it. So load the latest events directly instead of only filing a
    // report. The extra fields identify which path it was, for when we come to remove this.
    async #checkForEmptyChat(chatId: ChatIdentifier, path: string): Promise<void> {
        const chat = chatSummariesStore.value.get(chatId);
        if (
            chat === undefined ||
            chat.latestEventIndex <= 0 ||
            !chatIdentifiersEqual(chatId, selectedChatIdStore.value) ||
            this.maskChatMessages(chat) ||
            serverEventsStore.value.length > 0 ||
            expiredServerEventRanges.value.length > 0
        ) {
            return;
        }

        const serverChat = allServerChatsStore.value.get(chatId);
        const context = {
            chatId: chatIdentifierToString(chatId),
            chatKind: chat.kind,
            path,
            latestEventIndex: chat.latestEventIndex,
            minVisibleEventIndex: this.earliestAvailableEventIndex(chat),
            hasServerChat: serverChat !== undefined,
            privatePreview: serverChat !== undefined && this.#isPrivatePreview(serverChat),
            earliestLoadedIndex: this.#earliestLoadedIndex(chatId),
        };

        const recovered = await this.#recoverEmptyChat(chatId, serverChat);
        this.#reportEmptyChat("still_empty_after_load", { ...context, recovered });
    }

    // Load the latest events straight from the server chat, bypassing
    // #previousMessagesCriteria, which is one of the things that may have decided there was
    // nothing to fetch. Deliberately does NOT go through loadPreviousMessages, so it cannot
    // re-enter #checkForEmptyChat however it turns out.
    async #recoverEmptyChat(
        chatId: ChatIdentifier,
        serverChat: ChatSummary | undefined,
    ): Promise<boolean> {
        if (serverChat === undefined) return false;

        const visit = selectedChatFor(chatId);
        const startIndex = serverChat.latestEventIndex;
        const resp = await this.#loadEvents(visit, serverChat, startIndex, false);

        // The user may have moved on while that was in flight.
        if (visit === undefined || !visit.current || !isSuccessfulEventsResponse(resp)) {
            return false;
        }

        this.#fillLoadedEventGaps(visit, serverChat, resp, startIndex, false);
        publish("loadedPreviousMessages", {
            context: { chatId, threadRootMessageIndex: undefined },
            initialLoad: true,
        });
        return serverEventsStore.value.length > 0;
    }

    // The initial load is the only thing that loads a freshly selected chat or thread: if it
    // fails nothing publishes loadedMessageWindow, the event list never initialises, and
    // scroll-driven loading stays gated off. Load the latest history instead, from a clean
    // store, since a partially cached window may already have been applied to it.
    async #fallBackToPreviousMessages(
        visit: EventsVisit | undefined,
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): Promise<void> {
        if (visit === undefined || !visit.current) return;
        visit.clearEvents();
        await this.loadPreviousMessages(chatId, threadRootEvent, true);
    }

    logError(message: unknown, error: unknown, ...optionalParams: unknown[]): void {
        this.#logger.error(message, error, ...optionalParams);
    }

    logMessage(message?: unknown, ...optionalParams: unknown[]): void {
        this.#logger.log(message, ...optionalParams);
    }

    logDebug(message?: unknown, ...optionalParams: unknown[]): void {
        this.#logger.debug(message, ...optionalParams);
    }

    getAuthClientOptions(provider: AuthProvider): AuthClientLoginOptions {
        return {
            identityProvider: this.buildAuthProviderUrl(provider),
            maxTimeToLive: SESSION_TIMEOUT_NANOS,
            derivationOrigin: this.config.iiDerivationOrigin,
        };
    }

    login(): void {
        void this.#loginWithAuthClient();
    }

    // Signs in through the auth client's window (Internet Identity, NFID): "loaded" once the
    // identity has loaded, "closed" if the window gave up (closed, or its own error), "load_failed"
    // if the identity it gave couldn't be loaded
    #loginWithAuthClient(): Promise<"loaded" | "closed" | "load_failed"> {
        this.updateIdentityState({ kind: "logging_in" });
        const authProvider = selectedAuthProviderStore.value!;
        return new Promise((resolve) => {
            this.#authClient.then((c) => {
                c.login({
                    ...this.getAuthClientOptions(authProvider),
                    onSuccess: () =>
                        this.#authIdentityStorage
                            .getKeyAndChain()
                            .then((identity) =>
                                this.#loadedAuthenticationIdentity(identity, authProvider),
                            )
                            .then(
                                () => resolve("loaded"),
                                (err) => {
                                    this.logError("Unable to load the signed-in identity", err);
                                    resolve("load_failed");
                                },
                            ),
                    onError: (err) => {
                        this.updateIdentityState({ kind: "anon" });
                        console.warn("Login error from auth client: ", err);
                        resolve("closed");
                    },
                });
            });
        });
    }

    /**
     * Signs in and settles once the identity has loaded, with how it went. The passkey is the
     * native app's or the browser's, whichever this is. `signal` gives the sign-in up: it settles
     * `cancelled` then, even if the identity goes on to load.
     */
    async signIn(method: SignInMethod, signal?: AbortSignal): Promise<SignInOutcome> {
        if (signal?.aborted) return { kind: "cancelled" };
        const abandoned = new Promise<SignInOutcome>((resolve) =>
            signal?.addEventListener("abort", () => resolve({ kind: "cancelled" }), {
                once: true,
            }),
        );
        const outcome = await Promise.race([this.#signIn(method), abandoned]);
        return signal?.aborted ? { kind: "cancelled" } : outcome;
    }

    async #signIn(method: SignInMethod): Promise<SignInOutcome> {
        selectedAuthProviderStore.set(signInProvider(method));
        try {
            switch (method.kind) {
                case "passkey":
                    await (this.isNativeApp()
                        ? this.signInWithAndroidWebAuthn()
                        : this.signInWithWebAuthn());
                    break;
                case "auth_client": {
                    const login = await this.#loginWithAuthClient();
                    if (login === "closed") return { kind: "cancelled" };
                    if (login === "load_failed") return signInOutcome(identityStateStore.value);
                    break;
                }
                case "wallet": {
                    const resp = await this.signInWithWallet(
                        method.token,
                        method.address,
                        method.signature,
                        true,
                    );
                    if (resp.kind !== "success") {
                        return { kind: "failed", reason: i18nKey("loginDialog.unexpectedError") };
                    }
                    break;
                }
            }
        } catch (err) {
            // the native credential manager couldn't authenticate at all
            if (err === "AUTH_FAILED") {
                return { kind: "failed", reason: i18nKey("native.auth.errors.default") };
            }
            // the identity was being loaded, so it wasn't the prompt: that load failed
            if (identityStateStore.value.kind === "loading_user") {
                this.logError("Unable to load the signed-in identity", err);
                return signInOutcome(identityStateStore.value);
            }
            // the passkey prompt dismissed, or a passkey OpenChat doesn't know
            return { kind: "cancelled" };
        }
        return signInOutcome(identityStateStore.value);
    }

    buildAuthProviderUrl(authProvider: AuthProvider): string | undefined {
        switch (authProvider) {
            case AuthProvider.II:
                return this.config.internetIdentityUrl;
            case AuthProvider.NFID:
                return (
                    this.config.nfidUrl +
                    "&applicationLogo=" +
                    encodeURIComponent("https://oc.app/apple-touch-icon.png") +
                    "#authorize"
                );
        }
    }

    // function buildWindowOpenerFeatures(authProvider: AuthProvider): string {
    //     const isII = authProvider === AuthProvider.II;
    //     const screenWidth = window.innerWidth;
    //     const screenHeight = window.innerHeight;
    //     const width = Math.min(screenWidth, isII ? 525 : 465);
    //     const height = Math.min(screenHeight, isII ? 800 : 705);
    //     const left = (screenWidth - width) / 2;
    //     const top = (screenHeight - height) / 2;

    //     return `popup=1,toolbar=0,location=0,menubar=0,width=${width},height=${height},left=${left},top=${top}`;
    // }

    #startSession(ocIdentityPrincipal: string, ocIdentityExpiry: number): Promise<void> {
        startTrackingSession(ocIdentityPrincipal);

        return new Promise((resolve) => {
            const durationUntilSessionExpireMS = ocIdentityExpiry - Date.now();
            const durationUntilLogoutMs = durationUntilSessionExpireMS - ONE_MINUTE_MILLIS;
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const self = this;

            function timeout() {
                console.debug(
                    "SESSION: session has timed out after ",
                    durationUntilLogoutMs,
                    " based on expiry after ",
                    durationUntilSessionExpireMS,
                );
                self.logout().then(resolve);
            }

            if (durationUntilLogoutMs <= 5 * ONE_MINUTE_MILLIS) {
                timeout();
            } else {
                console.debug(
                    "SESSION: session started and set to expire in ",
                    durationUntilLogoutMs,
                    " based on expiry in ",
                    durationUntilSessionExpireMS,
                );
                window.setTimeout(timeout, Math.min(MAX_TIMEOUT_MS, durationUntilLogoutMs));
            }
        });
    }

    userIsDiamond(userId: string): boolean {
        const user = userStore.get(userId);
        if (user === undefined || user.kind === "bot") return false;

        if (userId === currentUserIdStore.value) return isDiamondStore.value;

        return user.diamondStatus !== "inactive";
    }

    userIsLifetimeDiamond(userId: string): boolean {
        const user = userStore.get(userId);
        if (user === undefined || user.kind === "bot") return false;

        if (userId === currentUserIdStore.value) return isLifetimeDiamondStore.value;

        return user.diamondStatus === "lifetime";
    }

    diamondExpiresIn(now: number, locale: string | null | undefined): string | undefined {
        if (diamondStatusStore.value.kind === "active") {
            return formatRelativeTime(now, locale, diamondStatusStore.value.expiresAt);
        }
    }

    #updateNervousSystemFunctions(governanceCanisterId: string) {
        if (get(offlineStore)) return;

        this.#worker
            .send({
                kind: "listNervousSystemFunctions",
                snsGovernanceCanisterId: governanceCanisterId,
            })
            .then((val) => {
                snsFunctionsStore.update((s) => {
                    s.set(governanceCanisterId, val.functions);
                    return s;
                });
            });
    }

    sendMarkReadRequest(req: MarkReadRequest) {
        return this.#worker.send({ kind: "markMessagesRead", payload: req });
    }

    maxMediaSizes(): MaxMediaSizes {
        return isDiamondStore.value ? DIAMOND_MAX_SIZES : FREE_MAX_SIZES;
    }

    onRegisteredUser(user: CreatedUser) {
        // Registering constitutes acceptance of the current terms, recorded SERVER-SIDE at
        // user creation (an RPC from here could fail and wrongly show the new user the
        // terms-updated notice); this local patch just keeps the store consistent until the
        // next current_user response confirms it
        user = { ...user, acceptedTermsVersion: CURRENT_TERMS_VERSION };
        user.blobUrl = buildUserAvatarUrl(
            this.config.blobUrlPattern,
            user.userId,
            user.blobReference?.blobId,
        );
        this.onCreatedUser(user);
        userStore.addUser({
            kind: user.isBot ? "bot" : "user",
            userId: user.userId,
            username: user.username,
            displayName: user.displayName,
            updated: user.updated,
            suspended: user.suspensionDetails !== undefined,
            diamondStatus: user.diamondStatus.kind,
            chitBalance: 0,
            totalChitEarned: 0,
            streak: 0,
            maxStreak: 0,
            blobReference: user.blobReference,
            blobData: user.blobData,
            blobUrl: user.blobUrl,
            isUniquePerson: user.isUniquePerson,
            hideOnlineStatus: user.hideOnlineStatus,
        });
        this.#loadCurrentUserProfile(user.userId);
    }

    onCreatedUser(user: CreatedUser): void {
        currentUserStore.set(user);
        this.#setDiamondStatus(user.diamondStatus);
        initialiseMostRecentSentMessageTimes(isDiamondStore.value);

        this.#worker.send({ kind: "createUserClient", userId: user.userId });
        startSwCheckPoller();

        this.#startChatsPoller();
        this.#startBotsPoller();
        this.#startUserUpdatePoller();
        this.#stopWatchingForResume ??= watchForResume((reason, suspendedMs) =>
            this.#onResume(reason, suspendedMs),
        );
        this.#worker.send({ kind: "getAllCachedUsers" }).then((u) => userStore.addMany(u));

        initNotificationStores();
        if (!anonUserStore.value) {
            this.#startOnlinePoller();
            this.#startBtcBalanceUpdateJob();
            this.#startOneSecBalanceUpdateJob();
            this.#startSolBalanceUpdateJob();
            this.#startDailyPuzzlePoller();
            this.#worker
                .send({ kind: "getUserStorageLimits" })
                .then((storage) => {
                    storageStore.set(storage);
                })
                .catch((err) => {
                    console.warn("Unable to retrieve user storage limits", err);
                });
            this.#worker.send({ kind: "loadFailedMessages" }).then((res) =>
                localUpdates.initialiseFailedMessages(
                    MessageContextMap.fromMap(res).map((_, rec) => {
                        const m = new Map<bigint, EventWrapper<Message>>();
                        for (const [k, v] of Object.entries(rec)) {
                            m.set(BigInt(k), v);
                        }
                        return m;
                    }),
                ),
            );
            this.updateIdentityState({ kind: "logged_in" });
            publish("userLoggedIn", user.userId);
        }
    }

    #startUserUpdatePoller() {
        this.#userUpdatePoller?.stop();
        this.#userUpdatePoller = new Poller(
            () => this.#updateUsers(),
            USER_UPDATE_INTERVAL,
            USER_UPDATE_INTERVAL,
        );
    }

    pauseEventLoop() {
        this.#chatsPoller?.stop();
    }

    resumeEventLoop() {
        this.#startChatsPoller();
    }

    #startDailyPuzzlePoller() {
        this.#dailyPuzzlePoller?.stop();
        if (anonUserStore.value) return;
        this.#dailyPuzzlePoller = new Poller(
            () => this.dailyPuzzleFetch(),
            DAILY_PUZZLE_UPDATE_INTERVAL,
            DAILY_PUZZLE_UPDATE_IDLE_INTERVAL,
            true,
        );
        // Coming back to a backgrounded app is the moment a stale puzzle would show
        if (typeof document !== "undefined" && this.#dailyPuzzleVisibilityListener === undefined) {
            this.#dailyPuzzleVisibilityListener = () => {
                if (document.visibilityState === "visible") this.dailyPuzzleFetch();
            };
            document.addEventListener("visibilitychange", this.#dailyPuzzleVisibilityListener);
        }
    }

    #scheduleDailyPuzzleRollover(state: DailyPuzzleState) {
        if (typeof window === "undefined") return;
        window.clearTimeout(this.#dailyPuzzleRolloverTimer);
        const delay = rolloverDelay(state, Date.now());
        if (delay === undefined) return;
        this.#dailyPuzzleRolloverTimer = window.setTimeout(() => this.dailyPuzzleFetch(), delay);
    }

    #startBotsPoller() {
        this.#botsPoller?.stop();
        this.#botsPoller = new Poller(
            () => this.#loadBots(),
            BOT_UPDATE_INTERVAL,
            BOT_UPDATE_IDLE_INTERVAL,
            true,
        );
    }

    // Coming back after the device slept or the tab sat in the background, queries sent before
    // the suspension are often stuck on a connection that died meanwhile. The chats poller runs
    // one pass at a time, so a pass holding such a query kept the next from starting until the
    // browser gave up on the connection, which could take many seconds. Aborting the stuck
    // queries makes the agent resend them, and the triggered run fetches anything that changed
    // after the pass in flight had already read it.
    #onResume(reason: ResumeReason, suspendedMs: number) {
        console.debug(`Resumed (${reason}) after ${Math.round(suspendedMs / 1000)}s`);
        this.#worker
            .send({ kind: "abortInFlightQueries" })
            .catch((err) => console.warn("Unable to abort in-flight queries", err));
        // Deferred so that the poller has seen the visibility change first. A hidden app
        // ignores triggers.
        window.setTimeout(() => this.#chatsPoller?.triggerNow(), 0);
        this.#miniApps?.resume();
    }

    #startChatsPoller() {
        this.#chatsPoller?.stop();
        this.#chatsPoller = new Poller(
            () => this.#loadChats(),
            CHAT_UPDATE_INTERVAL,
            CHAT_UPDATE_IDLE_INTERVAL,
            true,
        );

        // we need to load chats at least once if we are completely offline
        if (get(offlineStore)) {
            this.#loadChats();
        }
    }

    #startOnlinePoller() {
        if (!anonUserStore.value) {
            this.#onlinePoller?.stop();
            this.#onlinePoller = new Poller(
                () =>
                    (this.#worker.send({ kind: "markAsOnline" }) ?? Promise.resolve()).then(
                        (minutesOnline) => minutesOnlineStore.set(minutesOnline),
                    ),
                MARK_ONLINE_INTERVAL,
                undefined,
                true,
            );
        }
    }

    #startRegistryPoller() {
        this.#registryPoller?.stop();
        this.#registryPoller = new Poller(
            () => this.#updateRegistry(),
            REGISTRY_UPDATE_INTERVAL,
            REGISTRY_UPDATE_INTERVAL,
            false,
        );
    }

    #startExchangeRatePoller() {
        this.#exchangeRatePoller?.stop();
        this.#exchangeRatePoller = new Poller(
            () => this.#updateExchangeRates(),
            EXCHANGE_RATE_UPDATE_INTERVAL,
            EXCHANGE_RATE_UPDATE_INTERVAL,
            true,
        );
    }

    #preLogoutTasks: (() => Promise<unknown>)[] = [];

    /**
     * Registers a task to run at the start of logout, while the caller's
     * identity is still valid — e.g. removing this device's push token from
     * the notifications canister. Tasks are best-effort: failures are
     * swallowed and a timeout stops them from blocking sign-out.
     */
    onLogout(task: () => Promise<unknown>): void {
        this.#preLogoutTasks.push(task);
    }

    // Resolves when `promise` settles or after `ms`, whichever comes first,
    // always clearing the timer afterwards so it never dangles.
    #withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
        let timer: number | undefined;
        const timeout = new Promise<void>((resolve) => {
            timer = window.setTimeout(resolve, ms);
        });
        return Promise.race([promise.then(() => undefined), timeout]).finally(() =>
            window.clearTimeout(timer),
        );
    }

    #logoutPromise: Promise<void> | undefined;

    // Idempotent. An expired session now reaches this twice, deterministically: the worker agent
    // publishes sessionExpired and then rejects the request, and if nothing catches that the
    // window's unhandledrejection handler calls logout again. A second run sent a second worker
    // logout, cleared the agent and navigated within milliseconds - while the first was still in
    // its pre-logout window removing the push token, which then failed with "Worker has no agent"
    // and left the Android token registered to a signed-out user.
    logout(): Promise<void> {
        this.#logoutPromise ??= this.#doLogout();
        return this.#logoutPromise;
    }

    async #doLogout(): Promise<void> {
        // Run any registered pre-logout tasks (e.g. push-token cleanup) while
        // the identity is still valid. Best-effort: Promise.resolve().then wraps
        // each task so a synchronous throw becomes a rejection that allSettled
        // can absorb, and a 5s cap stops a slow task from blocking sign-out.
        // Take + clear the list so tasks don't accumulate across
        // login → logout → login within a single page session.
        const tasks = this.#preLogoutTasks;
        this.#preLogoutTasks = [];
        await this.#withTimeout(
            Promise.allSettled(tasks.map((task) => Promise.resolve().then(task))),
            5000,
        );

        // The navigation is what actually ends the session for the user, so it must happen
        // whatever the teardown does. `finally` alone is not enough: the worker's logout awaits
        // three sequential IndexedDB deletes with no timeout, so a wedged IndexedDB - the very
        // case this path exists for - leaves the Promise pending and `finally` never runs. Cap
        // it the same way the pre-logout tasks are capped.
        // Known edge: if IndexedDB is blocked for longer than the cap, navigating can cut the
        // auth client's delegation delete short, and startup may sign the user back in from the
        // surviving delegation. Narrow, and no worse than the manual reload it replaces, but
        // it is a consequence of choosing "always navigate" over "sometimes never".
        // allSettled so one step failing cannot stop the other, but never silently: a failed
        // delegation delete means the user navigates away with the delegation still on disk, and
        // that used to reach the error tracker as an unhandled rejection.
        const teardown = Promise.allSettled([
            this.#worker.send({ kind: "logout" }),
            this.#authClient.then((c) => c.logout()),
        ]).then((results) => {
            const names = ["worker logout", "auth client logout"];
            results.forEach((r, i) => {
                if (r.status === "rejected") {
                    this.#logger.error(`Logout: ${names[i]} failed`, r.reason);
                }
            });
        });
        try {
            let settled = false;
            teardown.finally(() => (settled = true));
            await this.#withTimeout(teardown, 5000);
            if (!settled) {
                this.#logger.error(
                    "Logout: teardown did not settle within 5s, navigating anyway",
                    new Error("logout teardown timed out"),
                );
            }
        } finally {
            window.location.replace("/");
        }
    }

    unreadThreadMessageCount(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        latestMessageIndex: number,
    ): number {
        return messagesRead.unreadThreadMessageCount(
            chatId,
            threadRootMessageIndex,
            latestMessageIndex,
        );
    }

    unreadMessageCount(chatId: ChatIdentifier, latestMessageIndex: number | undefined): number {
        return messagesRead.unreadMessageCount(chatId, latestMessageIndex);
    }

    unreadPinned(chatId: MultiUserChatIdentifier, dateLastPinned: bigint | undefined): boolean {
        return messagesRead.unreadPinned(chatId, dateLastPinned);
    }

    markThreadRead(chatId: ChatIdentifier, threadRootMessageIndex: number, readUpTo: number): void {
        messagesRead.markReadUpTo({ chatId, threadRootMessageIndex }, readUpTo);
    }

    markMessageRead(
        context: MessageContext,
        messageIndex: number,
        messageId: bigint | undefined,
    ): void {
        if (messagesRead.isRead(context, messageIndex, messageId)) {
            return;
        }

        messagesRead.markMessageRead(context, messageIndex, messageId);

        const selectedChat = selectedChatSummaryStore.value;
        if (
            selectedChat?.id === context.chatId &&
            messageId !== undefined &&
            selectedChat.kind === "direct_chat"
        ) {
            const rtc: WebRtcMessage = {
                kind: "remote_user_read_message",
                messageId: messageId,
                id: selectedChat.id,
                userId: currentUserIdStore.value,
            };
            this.#sendRtcMessage([selectedChat.id.userId], rtc);
        }
    }

    // Marks several messages read with a single publish of the messagesRead store
    markMessagesRead(
        context: MessageContext,
        messages: { messageIndex: number; messageId: bigint | undefined }[],
    ): void {
        withPausedStores(() => {
            for (const { messageIndex, messageId } of messages) {
                this.markMessageRead(context, messageIndex, messageId);
            }
        });
    }

    markPinnedMessagesRead(chatId: ChatIdentifier, dateLastPinned: bigint): void {
        messagesRead.markPinnedMessagesRead(chatId, dateLastPinned);
    }

    isMessageRead(
        context: MessageContext,
        messageIndex: number,
        messageId: bigint | undefined,
    ): boolean {
        return messagesRead.isRead(context, messageIndex, messageId);
    }

    #sendRtcMessage(userIds: string[], message: WebRtcMessage): void {
        rtcConnectionsManager.sendMessage(userIds, message);
    }

    #initWebRtc(): void {
        rtcConnectionsManager
            .init(currentUserIdStore.value, this.config.meteredApiKey)
            .then((_) => {
                rtcConnectionsManager.subscribe((msg) =>
                    this.#handleWebRtcMessage(msg as WebRtcMessage),
                );
            });
    }

    previewChat(chatId: MultiUserChatIdentifier): Promise<Success | Failure | GroupMoved> {
        switch (chatId.kind) {
            case "group_chat":
                return this.#worker
                    .send({ kind: "getPublicGroupSummary", chatId })
                    .then((resp) => {
                        if (resp.kind === "success" && chatRestricted(resp.group)) {
                            publish("restrictedContent");
                            return CommonResponses.failure();
                        }
                        if (resp.kind === "success" && !resp.group.frozen) {
                            localUpdates.addGroupPreview(resp.group);
                            this.#getLatestMessagesBridgedUsers([resp.group]);
                            return CommonResponses.success();
                        } else if (resp.kind === "group_moved") {
                            return resp;
                        }
                        return CommonResponses.failure();
                    })
                    .catch(() => {
                        return CommonResponses.failure();
                    });
            case "channel":
                return this.#worker
                    .send({ kind: "getChannelSummary", chatId })
                    .then(async (resp) => {
                        if (resp.kind === "channel") {
                            // Channels inherit their parent community's restriction, and for a
                            // non-member the community may not be in the store yet
                            if (appStoreBuild) {
                                const community = await this.getCommunitySummary({
                                    kind: "community",
                                    communityId: chatId.communityId,
                                });
                                if (community !== undefined && communityRestricted(community)) {
                                    publish("restrictedContent");
                                    return CommonResponses.failure();
                                }
                            }
                            localUpdates.addGroupPreview(resp);
                            this.#getLatestMessagesBridgedUsers([resp]);
                            return CommonResponses.success();
                        }
                        return CommonResponses.failure();
                    })
                    .catch(CommonResponses.failure);
        }
    }

    toggleMuteNotifications(
        chatId: ChatIdentifier,
        mute: boolean | undefined,
        muteAtEveryone: boolean | undefined,
    ): Promise<boolean> {
        const undo = localUpdates.updateNotificationsMuted(chatId, mute, muteAtEveryone);
        return this.#worker
            .send({
                kind: "toggleMuteNotifications",
                id: chatId,
                mute,
                muteAtEveryone,
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    muteAllChannels(communityId: CommunityIdentifier, atEveryOne: boolean): Promise<boolean> {
        const community = communitiesStore.value.get(communityId);
        if (community === undefined) {
            return Promise.resolve(false);
        }

        const mute = atEveryOne ? undefined : true;
        const muteAtEveryone = atEveryOne ? true : undefined;

        const undos = community.channels.map((c) =>
            localUpdates.updateNotificationsMuted(c.id, mute, muteAtEveryone),
        );

        return this.#worker
            .send({
                kind: "toggleMuteNotifications",
                id: communityId,
                mute,
                muteAtEveryone,
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undos.forEach((undo) => undo());
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undos.forEach((undo) => undo());
                return false;
            });
    }

    archiveChat(chatId: ChatIdentifier): Promise<boolean> {
        // Read first: archiving a chat with unread messages un-archives it again
        const chat = chatSummariesStore.value.get(chatId);
        if (chat !== undefined) {
            this.markAllRead(chat);
        }
        const undo = localUpdates.updateArchived(chatId, true);
        if (chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
            // Leave it. It's the chat last opened in this scope, so forget that or the list
            // would open it again, which un-archives it.
            const scope = chatListScopeStore.value;
            lastSelectedChatByScopeStore.update((map) => {
                map.delete(scope);
                return map;
            });
            publish(
                "navigateTo",
                navigationAfterArchivingOpenChat(
                    chatId,
                    scope,
                    chatSummariesListStore.value,
                    get(mobileWidth),
                ),
            );
        }
        return this.#worker
            .send({ kind: "archiveChat", chatId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    // One request for all of them, shown unarchived at once and put back together if it fails
    unarchiveChats(chatIds: ChatIdentifier[]): Promise<boolean> {
        const undos = withPausedStores(() =>
            chatIds.map((chatId) => localUpdates.updateArchived(chatId, false)),
        );
        const undo = () => withPausedStores(() => undos.forEach((undo) => undo()));
        return this.#worker
            .send({ kind: "unarchiveChats", chatIds })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    pinned(scope: ChatListScope["kind"], chatId: ChatIdentifier): boolean {
        return (
            pinnedChatsStore.value.get(scope)?.find((id) => chatIdentifiersEqual(id, chatId)) !==
            undefined
        );
    }

    pinChat(chatId: ChatIdentifier): Promise<boolean> {
        const scope = chatListScopeStore.value.kind;
        const undo = localUpdates.pinToScope(chatId, scope);
        return this.#worker
            .send({
                kind: "pinChat",
                chatId,
                favourite: scope === "favourite",
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    unpinChat(chatId: ChatIdentifier): Promise<boolean> {
        const scope = chatListScopeStore.value.kind;
        const undo = localUpdates.unpinFromScope(chatId, scope);
        return this.#worker
            .send({
                kind: "unpinChat",
                chatId,
                favourite: scope === "favourite",
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    blockUserFromDirectChat(userId: string): Promise<boolean> {
        const undo = localUpdates.blockDirectUser(userId);
        rtcConnectionsManager.disconnectFromUser(userId);
        return this.#worker
            .send({ kind: "blockUserFromDirectChat", userId })
            .then((resp) => {
                if (resp.kind === "success") {
                    userStore.blockUser(userId);
                } else {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    /** Blocks or unblocks the other person in a DM, with the message to show either way. */
    async setBlockedInDirectChat(userId: string, blocked: boolean): Promise<BlockOutcome> {
        const success = await (blocked
            ? this.blockUserFromDirectChat(userId)
            : this.unblockUserFromDirectChat(userId));
        return blockOutcome(blocked, success);
    }

    unblockUserFromDirectChat(userId: string): Promise<boolean> {
        const undo = localUpdates.unblockDirectUser(userId);
        return this.#worker
            .send({ kind: "unblockUserFromDirectChat", userId })
            .then((resp) => {
                if (resp.kind === "success") {
                    userStore.unblockUser(userId);
                } else {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    /**
     * Shows the new avatar everywhere at once (`url`), and puts the previous one back if the upload
     * fails, unless another has been set meanwhile.
     */
    setUserAvatar(data: Uint8Array, url: string): Promise<bigint | undefined> {
        const userId = currentUserIdStore.value;
        const partialUser = userStore.get(userId);
        if (partialUser) {
            userStore.addUser({
                ...partialUser,
                blobData: data,
                blobUrl: url,
            });
        }

        return this.#worker
            .send({ kind: "setUserAvatar", data })
            .then((resp) => {
                this.#updateCurrentUserProfile((profile) => ({
                    ...profile,
                    avatarId: resp.blobId,
                }));
                return resp.blobId;
            })
            .catch(() => {
                const shown = userStore.get(userId);
                if (partialUser !== undefined && shown?.blobUrl === url) {
                    userStore.addUser({
                        ...shown,
                        blobData: partialUser.blobData,
                        blobUrl: partialUser.blobUrl,
                    });
                }
                return undefined;
            });
    }

    setUserProfileBackground(data: Uint8Array): Promise<bigint | undefined> {
        return this.#worker
            .send({ kind: "setProfileBackground", data })
            .then((resp) => {
                this.#updateCurrentUserProfile((profile) => ({
                    ...profile,
                    backgroundId: resp.blobId,
                }));
                return resp.blobId;
            })
            .catch(() => undefined);
    }

    deleteGroup(chatId: MultiUserChatIdentifier): Promise<boolean> {
        // TODO we don't use the local updates mechanism here at the moment for some reason. Probably should.
        return this.#worker
            .send({ kind: "deleteGroup", chatId })
            .then((resp) => {
                if (resp.kind === "success") {
                    this.removeChat(chatId);
                    if (chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
                        this.selectDefaultChat();
                    }
                    return true;
                } else {
                    return false;
                }
            })
            .catch(() => false);
    }

    deleteDirectChat(chatId: DirectChatIdentifier, blockUser: boolean): Promise<boolean> {
        const undo = localUpdates.removeChat(chatId);
        return this.#worker
            .send({ kind: "deleteDirectChat", userId: chatId.userId, blockUser })
            .then((success) => {
                if (!success) {
                    undo();
                }
                return success;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    /**
     * Leaves or deletes a group, channel, DM or community the user has confirmed. When it's the one
     * being viewed, goes off it first and back if the call fails, and once it's gone clears its
     * details from the right panel; otherwise the route and the panel stay.
     */
    async leaveOrDelete(action: LeaveOrDelete): Promise<LeaveOrDeleteOutcome> {
        const navigation = leaveOrDeleteNavigation(
            action,
            selectedChatIdStore.value,
            chatListScopeStore.value,
            this.getDefaultScope(),
        );
        if (navigation !== undefined) {
            publish("navigateTo", { url: navigation.away });
        }
        const result = await this.#leaveOrDelete(action);
        if (navigation !== undefined) {
            if (result === "success") {
                rightPanelHistory.set([]);
            } else {
                publish("navigateTo", { url: navigation.back });
            }
        }
        return leaveOrDeleteOutcome(action, result);
    }

    async #leaveOrDelete(action: LeaveOrDelete): Promise<LeaveOrDeleteResult> {
        const ok = (success: boolean) => (success ? "success" : "failure");
        switch (action.kind) {
            case "leave":
                return this.leaveGroup(action.chatId);
            case "delete":
                return ok(await this.deleteGroup(action.chatId));
            case "delete_direct_chat":
                return ok(await this.deleteDirectChat(action.chatId, action.blockUser));
            case "leave_community":
                return ok(await this.leaveCommunity(action.id));
            case "delete_community":
                return ok(await this.deleteCommunity(action.id));
            default:
                return action satisfies never;
        }
    }

    leaveGroup(
        chatId: MultiUserChatIdentifier,
    ): Promise<"success" | "failure" | "owner_cannot_leave"> {
        const undo = localUpdates.removeChat(chatId);
        return this.#worker
            .send({ kind: "leaveGroup", chatId })
            .then((resp) => {
                if (resp.kind === "success") {
                    return "success";
                } else {
                    undo();
                    if (resp.kind === "error" && resp.code === ErrorCode.LastOwnerCannotLeave) {
                        return "owner_cannot_leave";
                    } else {
                        return "failure";
                    }
                }
            })
            .catch(() => {
                undo();
                return "failure";
            });
    }

    verifyAccessGate(gate: AccessGate, iiPrincipal: string): Promise<string | undefined> {
        if (gate.kind !== "credential_gate" || this.#authPrincipal === undefined) {
            return Promise.resolve(undefined);
        }

        return verifyCredential(
            this.config.internetIdentityUrl,
            iiPrincipal,
            gate.credential.issuerOrigin,
            gate.credential.issuerCanisterId,
            gate.credential.credentialType,
            gate.credential.credentialArguments,
            this.config.iiDerivationOrigin,
        );
    }

    async approveAccessGatePayments(
        entity: MultiUserChat | CommunitySummary,
        approvals: PaymentGateApprovals,
    ): Promise<ApproveAccessGatePaymentResponse> {
        if (approvals.size === 0) return CommonResponses.success();

        let pin: string | undefined = undefined;
        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const canisterId = entity.kind === "group_chat" ? entity.id.groupId : entity.id.communityId;

        const results = await Promise.all(
            [...approvals.entries()].map(([ledger, approval]) =>
                this.approveAccessGatePayment(canisterId, ledger, approval, pin),
            ),
        );

        if (results.every((r) => r.kind === "success")) {
            return CommonResponses.success();
        }

        // TODO - this might be a bit shit
        return results[0];
    }

    markActivityFeedRead(readUpTo: bigint) {
        const undo = localUpdates.setMessageActivityFeedReadUpTo(readUpTo);
        return this.#worker
            .send({
                kind: "markActivityFeedRead",
                readUpTo,
            })
            .catch(undo);
    }

    subscribeToMessageActivityFeed(
        subscribeFn: (value: MessageActivityFeedResponse, final: boolean) => void,
        onError?: (err: unknown) => void,
    ) {
        this.#worker
            .stream({
                kind: "messageActivityFeed",
                since: messageActivitySummaryStore.value.readUpToTimestamp,
            })
            .subscribe({
                onResult: (response, final) => {
                    const userIds = new Set<string>();
                    for (const event of response.events) {
                        if (event.userId !== undefined) {
                            userIds.add(event.userId);
                        }
                    }
                    this.getMissingUsers(userIds);
                    // So the feed can show who the relayed messages are from
                    void this.getBridgedUsers(
                        bridgedUserIdsFromMessages(response.events.flatMap((e) => e.message ?? [])),
                    );
                    subscribeFn(response, final);
                },
                onError,
            });
    }

    async #approveTransfer(
        spender: string,
        ledger: string,
        amount: bigint,
        expiresIn: bigint,
        pin: string | undefined,
    ): Promise<ApproveTransferResponse> {
        if (pinNumberRequiredStore.value && pin === undefined) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        return this.#worker
            .send({
                kind: "approveTransfer",
                spender,
                ledger,
                amount,
                expiresIn,
                pin,
            })
            .then((response) => {
                if (response.kind === "error") {
                    const pinNumberFailure = pinNumberFailureFromError(response);
                    if (pinNumberFailure !== undefined) {
                        pinNumberFailureStore.set(pinNumberFailure);
                    } else {
                        this.#logger.error("Unable to approve transfer", response);
                    }
                }

                return response;
            })
            .catch((error) => {
                this.#logger.error("Error calling approveTransfer", error);
                return CommonResponses.internalError(error.toString());
            });
    }

    // Approves the group or community (`canisterId`) to pull the gate's payment when the user joins
    async approveAccessGatePayment(
        canisterId: string,
        ledger: string,
        { amount, approvalFee }: PaymentGateApproval,
        pin: string | undefined,
    ): Promise<ApproveAccessGatePaymentResponse> {
        return this.#worker
            .send({
                kind: "approveAccessGatePayment",
                canisterId,
                ledger,
                amount: amount - approvalFee, // The user should pay only the amount not amount+fee so it is a round number
                expiresIn: BigInt(5 * ONE_MINUTE_MILLIS), // Allow 5 mins for the join_group call before the approval expires
                pin,
            })
            .then((response) => {
                if (response.kind === "error") {
                    const pinNumberFailure = pinNumberFailureFromError(response);
                    if (pinNumberFailure !== undefined) {
                        pinNumberFailureStore.set(pinNumberFailure);
                    } else {
                        this.#logger.error("Unable to approve transfer", response);
                    }
                }

                return response;
            })
            .catch(CommonResponses.failure);
    }

    /**
     * Join a group or channel. Gates that can't be checked from the user's own data have to be
     * evaluated by the user first; the caller does that when told `needs_gate_evaluation` and
     * calls again with the result. Rejects if the user cancels the PIN prompt for a payment.
     */
    async joinGroup(chat: MultiUserChat, gateCheck?: GateCheckSucceeded): Promise<JoinOutcome> {
        if (anonUserStore.value) {
            this.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "join_group", group: chat },
            });
            return { kind: "skipped" };
        }

        // We may have got here by replaying a join captured before login, in which case we may
        // already be a member. This reads every chat, not just those in the current chat list
        const existing = allChatsStore.value.get(chat.id);
        const communityLapsed =
            chat.kind === "channel" &&
            communitiesStore.value.get({ kind: "community", communityId: chat.id.communityId })
                ?.membership.lapsed === true;
        if (
            existing !== undefined &&
            existing.membership.role !== ROLE_NONE &&
            !existing.membership.lapsed &&
            !communityLapsed
        ) {
            return { kind: "skipped" };
        }

        if (gateCheck === undefined) {
            const gates = this.accessGatesForChat(chat, true);
            if (!this.#doesUserMeetAccessGates(gates) && this.#gatePreprocessingRequired(gates)) {
                return { kind: "needs_gate_evaluation", gates };
            }
        }

        const resp = await this.#sendJoinGroup(
            chat,
            gateCheck?.credentials ?? [],
            gateCheck?.paymentApprovals ?? new Map(),
            gateCheck?.compositeGateIndex,
        );
        switch (resp.kind) {
            case "success":
                this.#miniApps?.joinedChat(chat.id);
                return resp;
            case "gate_check_failed": {
                // With no gates to show the user would see nothing, so report a plain failure
                const gates = this.accessGatesForChat(chat);
                return gates.length > 0
                    ? { kind: "gate_check_failed", gates }
                    : {
                          kind: "failed",
                          message: joinGroupFailureMessage(CommonResponses.failure(), chat.level),
                      };
            }
            default:
                return { kind: "failed", message: joinGroupFailureMessage(resp, chat.level) };
        }
    }

    async #sendJoinGroup(
        chat: MultiUserChat,
        credentials: string[],
        paymentApprovals: PaymentGateApprovals,
        compositeGateIndex?: number,
    ): Promise<ClientJoinGroupResponse> {
        const approveResponse = await this.approveAccessGatePayments(chat, paymentApprovals);
        if (approveResponse.kind !== "success") {
            return approveResponse;
        }

        return this.#worker
            .send({
                kind: "joinGroup",
                chatId: chat.id,
                credentialArgs: this.#buildVerifiedCredentialArgs(credentials),
                compositeGateIndex,
            })
            .then((resp) => {
                return withPausedStores(() => {
                    if (resp.kind === "success") {
                        const serverChat = resp.group;
                        if (serverChat.kind === "group_chat") {
                            serverGroupChatsStore.update((map) =>
                                map.set(serverChat.id, serverChat),
                            );
                        } else {
                            serverCommunitiesStore.update((map) => {
                                const community = map.get({
                                    kind: "community",
                                    communityId: serverChat.id.communityId,
                                });
                                if (
                                    community !== undefined &&
                                    !community.channels.find(
                                        (c) => c.id.channelId === serverChat.id.channelId,
                                    )
                                ) {
                                    community.channels.push(serverChat);
                                }
                                return map;
                            });
                        }
                        localUpdates.removeGroupPreview(chat.id);
                        this.#loadChatDetails(selectedChatFor(resp.group.id), resp.group);
                        messagesRead.syncWithServer(
                            resp.group.id,
                            resp.group.membership?.readByMeUpTo,
                            [],
                            undefined,
                        );
                    } else if (resp.kind === "success_joined_community") {
                        serverCommunitiesStore.update((map) =>
                            map.set(resp.community.id, resp.community),
                        );
                        localUpdates.removeCommunityPreview(resp.community.id);
                        resp.community.membership.index = nextCommunityIndexStore.value;
                        resp.community.channels.forEach((c) => {
                            localUpdates.removeGroupPreview(c.id);
                            if (chatIdentifiersEqual(c.id, chat.id)) {
                                this.#loadChatDetails(selectedChatFor(c.id), c);
                            }
                            if (c.latestMessage) {
                                messagesRead.markReadUpTo(
                                    { chatId: c.id },
                                    c.latestMessage.event.messageIndex,
                                );
                            }
                        });
                    } else {
                        if (resp.kind === "error" && resp.code === ErrorCode.InitiatorBlocked) {
                            return CommonResponses.blocked();
                        } else if (resp.kind === "gate_check_failed") {
                            return resp;
                        }
                        return CommonResponses.failure();
                    }
                    return CommonResponses.success();
                });
            })
            .then((resp) => {
                if (resp.kind === "success" && eventIndexesLoaded(chat.id).length === 0) {
                    this.loadPreviousMessages(chat.id, undefined, true);
                }
                return resp;
            })
            .catch(CommonResponses.failure);
    }

    #buildVerifiedCredentialArgs(credentials: string[]): VerifiedCredentialArgs | undefined {
        if (credentials.length === 0) return undefined;

        if (this.#authPrincipal === undefined)
            throw new Error(
                "Cannot construct a VerifiedCredentialArg because the _authPrincipal is undefined",
            );

        return {
            userIIPrincipal: this.#authPrincipal,
            iiOrigin: new URL(this.config.internetIdentityUrl).origin,
            credentialJwts: credentials,
        };
    }

    setMemberDisplayName(
        id: CommunityIdentifier,
        displayName: string | undefined,
    ): Promise<SetMemberDisplayNameResponse> {
        const newAchievement = !achievementsStore.value.has("set_community_display_name");

        const undo = localUpdates.updateCommunityDisplayName(id, displayName);

        return this.#worker
            .send({
                kind: "setMemberDisplayName",
                communityId: id.communityId,
                displayName,
                newAchievement,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    const userId = currentUserIdStore.value;
                    if (userId !== undefined) {
                        const m = selectedCommunityMembersStore.value.get(userId);
                        if (m !== undefined) {
                            localUpdates.updateCommunityMember(id, userId, { ...m, displayName });
                        }
                    }
                } else {
                    undo();
                }
                return resp;
            })
            .catch((err) => {
                // the name wasn't set: don't keep showing it
                undo();
                throw err;
            });
    }

    followThread(chatId: ChatIdentifier, message: Message, follow: boolean): Promise<boolean> {
        const threadRootMessageIndex = message.messageIndex;

        // Assume it will succeed
        const undo = localUpdates.markThreadSummaryUpdated(message.messageId, {
            followedByMe: follow,
        });

        const newAchievement = !achievementsStore.value.has("followed_thread");

        return this.#worker
            .send({
                kind: "followThread",
                chatId,
                threadRootMessageIndex,
                follow,
                newAchievement,
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                if (message.thread !== undefined && message.thread.numberOfReplies > 0) {
                    const readUpTo = message.thread.numberOfReplies - 1;
                    this.markThreadRead(chatId, threadRootMessageIndex, readUpTo);
                }
                return true;
            })
            .catch(() => false);
    }

    applyTranslation = applyTranslation;

    getContentAsText(formatter: MessageFormatter, content: MessageContent): string {
        return getContentAsFormattedText(formatter, content, cryptoLookup.value);
    }

    groupAvatarUrl(
        chat?: {
            id: MultiUserChatIdentifier;
            blobUrl?: string;
            subtype?: GroupSubtype;
        },
        community?: CommunitySummary,
    ): string {
        if (chat?.blobUrl !== undefined) {
            return chat.blobUrl;
        } else if (chat?.subtype?.kind === "governance_proposals") {
            // If this is a governance proposals chat and no avatar has been set, use the default one for the SNS
            const snsLogo = this.#getSnsLogo(chat.subtype.governanceCanisterId);
            if (snsLogo !== undefined) {
                return snsLogo;
            }
        } else if (chat?.id?.kind === "channel") {
            community = this.getCommunityForChannel(chat?.id) ?? community;
            if (community !== undefined) {
                return this.communityAvatarUrl(community.id.communityId, community.avatar);
            }
        }
        return this.mobileLayout === "v2" ? "unknown" : "/assets/group.svg";
    }

    toShortTimeString(date: Date): string {
        return toShortTimeString(date, this.#locale);
    }

    toMonthString(date: Date): string {
        return toMonthString(date, this.#locale);
    }

    toMonthYearString(date: Date): string {
        return toMonthYearString(date, this.#locale);
    }

    formatMessageDate(
        timestamp: bigint,
        today: string,
        yesterday: string,
        timeIfToday = false,
        short = false,
    ): string {
        return formatMessageDate(timestamp, today, yesterday, this.#locale, timeIfToday, short);
    }

    toDatetimeString(date: Date): string {
        return toDatetimeString(date, this.#locale);
    }

    toDateString(date: Date): string {
        return toDateString(date, this.#locale);
    }

    toLongDateString(date: Date): string {
        return toLongDateString(date, this.#locale);
    }

    toRelativeTime(timestamp: bigint): string {
        // TODO i18n
        return toRelativeTime(timestamp);
    }

    formatDateLong(timestamp: bigint): string {
        return formatDateLong(timestamp, this.#locale);
    }

    getSmartDateHeader(timestamp: bigint, today: string, yesterday: string): string {
        return getSmartDateHeader(timestamp, this.#locale, { today, yesterday });
    }

    /**
     * Wrap a bunch of pure utility functions
     */
    showTrace = showTrace;
    userAvatarUrl = userAvatarUrl;

    // The avatar of the author of a message a bridge bot relayed from another platform
    bridgedAvatarUrl(id: BridgedUserId, summary: BridgedUserSummary | undefined): string {
        return buildBridgedUserAvatarUrl(id, summary, this.config.bridgeAvatarsUrl);
    }
    formatTokens = formatTokens;
    validateTokenInput = validateTokenInput;
    isAccountOfMultiUserCanisterUserId = isAccountOfMultiUserCanisterUserId;
    parseBigInt = parseBigInt;
    userIdsFromEvents = userIdsFromEvents;
    userOrUserGroupName = userOrUserGroupName;
    userOrUserGroupId = userOrUserGroupId;
    extractUserIdsFromMentions = extractUserIdsFromMentions;
    toRecord2 = toRecord2;
    toRecord = toRecord;
    partition = partition;
    groupBySender = groupBySender;
    groupBy = groupBy;
    getTypingString = getTypingString;
    getMessageText = getMessageText;
    contentTypeToPermission = contentTypeToPermission;
    stripLinkDisabledMarker = stripLinkDisabledMarker;
    extractEnabledLinks = extractEnabledLinks;

    communityAvatarUrl(id: string, avatar: DataContent): string {
        return avatar?.blobUrl ?? buildIdenticonUrl(id);
    }

    communityBannerUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
        return dataContent?.blobUrl ?? "/assets/landscape.png";
    }

    canBlockUsers(chatId: ChatIdentifier | CommunityIdentifier): boolean {
        switch (chatId.kind) {
            case "community":
                return this.#communityPredicate(chatId, canBlockCommunityUsers);
            case "channel":
                return false;
            default:
                return this.#chatPredicate(chatId, canBlockUsers);
        }
    }

    canSendMessage(
        chatId: ChatIdentifier,
        mode: "message" | "thread" | "any",
        permission?: MessagePermission,
    ): boolean {
        return this.#chatPredicate(chatId, (chat) => {
            if (chat.kind === "direct_chat") {
                const recipient = userStore.get(chat.them.userId);
                if (recipient !== undefined) {
                    return canSendDirectMessage(
                        recipient,
                        mode,
                        this.config.proposalBotCanister,
                        permission,
                    );
                } else {
                    return false;
                }
            } else {
                return canSendGroupMessage(currentUserStore.value, chat, mode, permission);
            }
        });
    }

    // TODO this is now available as a store so we *probably* don't need this now
    permittedMessages(
        chatId: ChatIdentifier,
        mode: "message" | "thread",
    ): Map<MessagePermission, boolean> {
        const chat = allChatsStore.value.get(chatId);
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") {
                const recipient = userStore.get(chat.them.userId);
                if (recipient !== undefined) {
                    return permittedMessagesInDirectChat(
                        recipient,
                        mode,
                        this.config.proposalBotCanister,
                    );
                }
            } else {
                return permittedMessagesInGroup(currentUserStore.value, chat, mode);
            }
        }

        return new Map();
    }

    canDeleteOtherUsersMessages(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canDeleteOtherUsersMessages);
    }

    canStartVideoCalls(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, (chat) => canStartVideoCalls(chat, userStore.allUsers));
    }

    isChatPrivate(chat: ChatSummary): boolean {
        switch (chat.kind) {
            case "channel": {
                const community = this.getCommunityForChannel(chat.id);
                return !chat.public || community?.public !== true;
            }
            case "group_chat":
                return !chat.public;
            default:
                return true;
        }
    }

    isChatOrCommunityFrozen(chat: ChatSummary, community: CommunitySummary | undefined): boolean {
        if (chat.kind === "direct_chat") return false;
        return chat.frozen || (community?.frozen ?? false);
    }

    canPinMessages(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canPinMessages);
    }

    canReactToMessages(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canReactToMessages);
    }

    canTipMessages(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canTipMessages);
    }

    canMentionAllMembers(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canMentionAllMembers);
    }

    canChangeRoles(
        id: ChatIdentifier | CommunityIdentifier,
        currentRole: MemberRole,
        newRole: MemberRole,
    ): boolean {
        switch (id.kind) {
            case "community":
                const found = communityRoles.find((r) => r === newRole);
                if (!found) return false;
                return this.#communityPredicate(id, (community) =>
                    canChangeCommunityRoles(community, currentRole, newRole),
                );
            default:
                return this.#chatPredicate(id, (chat) =>
                    canChangeRoles(chat, currentRole, newRole),
                );
        }
    }

    canPromote(
        chatId: ChatIdentifier | CommunityIdentifier,
        currentRole: MemberRole,
        newRole: MemberRole,
    ): boolean {
        return (
            compareRoles(newRole, currentRole) > 0 &&
            this.canChangeRoles(chatId, currentRole, newRole)
        );
    }

    canDemote(
        chatId: ChatIdentifier | CommunityIdentifier,
        currentRole: MemberRole,
        newRole: MemberRole,
    ): boolean {
        return (
            compareRoles(newRole, currentRole) < 0 &&
            this.canChangeRoles(chatId, currentRole, newRole)
        );
    }

    canUnblockUsers(identifier: ChatIdentifier | CommunityIdentifier): boolean {
        switch (identifier.kind) {
            case "community":
                return this.#communityPredicate(identifier, canUnblockCommunityUsers);
            default:
                return this.#chatPredicate(identifier, canUnblockUsers);
        }
    }

    canRemoveMembers(id: ChatIdentifier | CommunityIdentifier): boolean {
        switch (id.kind) {
            case "community":
                return this.#communityPredicate(id, canRemoveCommunityMembers);
            default:
                return this.#chatPredicate(id, canRemoveMembers);
        }
    }

    canEditGroupDetails(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canEditGroupDetails);
    }

    canImportToCommunity(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canImportToCommunity);
    }

    canChangePermissions(chatId: ChatIdentifier): boolean {
        return this.#chatPredicate(chatId, canChangePermissions);
    }

    canInviteUsers(id: ChatIdentifier | CommunityIdentifier): boolean {
        switch (id.kind) {
            case "community":
                return this.#communityPredicate(id, canInviteCommunityUsers);
            default:
                return this.#chatPredicate(id, canInviteUsers);
        }
    }

    canRegisterWebhook(id: ChatIdentifier): boolean {
        return this.#chatPredicate(id, ({ membership: { role } }) => hasOwnerRights(role));
    }

    canManageBots(id: ChatIdentifier | CommunityIdentifier): boolean {
        switch (id.kind) {
            case "community":
                return this.#communityPredicate(id, ({ membership: { role } }) =>
                    hasOwnerRights(role),
                );
            default:
                return this.#chatPredicate(id, ({ membership: { role } }) => hasOwnerRights(role));
        }
    }

    canAddMembers(id: ChatIdentifier): boolean {
        return this.#chatPredicate(id, canAddMembers);
    }

    canCreateChannel(id: CommunityIdentifier): boolean {
        return this.canCreatePrivateChannel(id) || this.canCreatePublicChannel(id);
    }

    canCreatePublicChannel(id: CommunityIdentifier): boolean {
        return this.#communityPredicate(id, canCreatePublicChannel);
    }

    canCreatePrivateChannel(id: CommunityIdentifier): boolean {
        return this.#communityPredicate(id, canCreatePrivateChannel);
    }

    canManageUserGroups(id: CommunityIdentifier): boolean {
        return this.#communityPredicate(id, canManageUserGroups);
    }

    canChangeCommunityPermissions(id: CommunityIdentifier): boolean {
        return this.#communityPredicate(id, canChangeCommunityPermissions);
    }

    canEditCommunity(id: CommunityIdentifier): boolean {
        return this.#communityPredicate(id, canEditCommunity);
    }

    canDeleteCommunity(id: CommunityIdentifier): boolean {
        return this.#communityPredicate(id, canDeleteCommunity);
    }

    canDeleteChannel(id: ChannelIdentifier): boolean {
        return (
            this.#communityPredicate(
                { kind: "community", communityId: id.communityId },
                canDeleteGroup,
            ) || this.#multiUserChatPredicate(id, canDeleteGroup)
        );
    }

    canDeleteGroup(chatId: MultiUserChatIdentifier): boolean {
        if (chatId.kind === "channel") {
            return this.canDeleteChannel(chatId);
        } else {
            return this.#multiUserChatPredicate(chatId, canDeleteGroup);
        }
    }

    canChangeVisibility = canChangeVisibility;
    hasOwnerRights = hasOwnerRights;

    canConvertGroupToCommunity(chatId: GroupChatIdentifier): boolean {
        return this.#multiUserChatPredicate(chatId, canConvertToCommunity);
    }

    canLeaveGroup(chatId: MultiUserChatIdentifier): boolean {
        return this.#multiUserChatPredicate(chatId, canLeaveGroup);
    }

    isPreviewing(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.#multiUserChatPredicate(chatId, isPreviewing);
    }

    isLapsed(id: ChatIdentifier | CommunityIdentifier): boolean {
        if (id.kind === "direct_chat") {
            return false;
        } else if (id.kind === "channel") {
            return (
                this.#communityPredicate(
                    { kind: "community", communityId: id.communityId },
                    isCommunityLapsed,
                ) || this.#multiUserChatPredicate(id, isLapsed)
            );
        } else if (id.kind === "community") {
            return this.#communityPredicate(id, isCommunityLapsed);
        } else {
            return this.#multiUserChatPredicate(id, isLapsed);
        }
    }

    isChatFrozen(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.#multiUserChatPredicate(chatId, isFrozen);
    }

    isCommunityFrozen(id: CommunityIdentifier | undefined): boolean {
        if (id === undefined) return false;
        return this.#communityPredicate(id, isFrozen);
    }

    isOpenChatBot(userId: string): boolean {
        return userId === OPENCHAT_BOT_USER_ID;
    }

    isVideoCallBot(userId: string): boolean {
        return userId === OPENCHAT_VIDEO_CALL_USER_ID;
    }

    isChatReadOnly(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return suspendedUserStore.value || this.isPreviewing(chatId);
    }

    #chatPredicate(chatId: ChatIdentifier, predicate: (chat: ChatSummary) => boolean): boolean {
        const chat = allChatsStore.value.get(chatId);
        return chat !== undefined && predicate(chat);
    }

    #communityPredicate(
        communityId: CommunityIdentifier,
        predicate: (community: CommunitySummary) => boolean,
    ): boolean {
        const community = communitiesStore.value.get(communityId);
        return community !== undefined && predicate(community);
    }

    #multiUserChatPredicate(
        chatId: MultiUserChatIdentifier,
        predicate: (chat: MultiUserChat) => boolean,
    ): boolean {
        const chat = chatSummariesStore.value.get(chatId);
        return (
            chat !== undefined &&
            (chat.kind === "group_chat" || chat.kind === "channel") &&
            predicate(chat)
        );
    }

    #findMessageById = findMessageById;
    canForward = canForward;
    containsReaction = containsReaction;
    groupEvents = groupEvents;
    startTyping = startTyping;
    stopTyping = stopTyping;

    registerPollVote(
        chatId: MultiUserChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        messageIdx: number,
        answerIdx: number,
        type: "register" | "delete",
    ): Promise<boolean> {
        localUpdates.markPollVote(messageId, {
            answerIndex: answerIdx,
            type,
            userId: currentUserIdStore.value,
        });

        const newAchievement = !achievementsStore.value.has("voted_on_poll");

        return this.#worker
            .send({
                kind: "registerPollVote",
                chatId,
                messageIdx,
                answerIdx,
                voteType: type,
                threadRootMessageIndex,
                newAchievement,
            })
            .then((resp) => resp.kind === "success")
            .catch(() => false);
    }

    deleteMessage(
        id: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        asPlatformModerator?: boolean,
    ): Promise<boolean> {
        const chat = chatSummariesStore.value.get(id);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        const userId = currentUserIdStore.value;
        localUpdates.markMessageDeleted(messageId, userId);
        undeletingMessagesStore.delete(messageId);

        const recipients = [...selectedChatUserIdsStore.value];

        rtcConnectionsManager.sendMessage(recipients, {
            kind: "remote_user_deleted_message",
            id,
            messageId,
            userId,
            threadRootMessageIndex,
        });

        function _undelete() {
            rtcConnectionsManager.sendMessage(recipients, {
                kind: "remote_user_undeleted_message",
                id,
                messageId,
                userId,
                threadRootMessageIndex,
            });
            localUpdates.markMessageUndeleted(messageId);
        }

        const newAchievement = !achievementsStore.value.has("deleted_message");

        return this.#worker
            .send({
                kind: "deleteMessage",
                chatId: id,
                messageId,
                threadRootMessageIndex,
                asPlatformModerator,
                newAchievement,
            })
            .then((resp) => {
                const success = resp.kind === "success";
                if (!success) {
                    _undelete();
                }
                return success;
            })
            .catch(() => {
                _undelete();
                return false;
            });
    }

    directChatWithBot(chat: ChatSummary): string | undefined {
        if (chat.kind !== "direct_chat") return undefined;
        const them = userStore.get(chat.them.userId);
        return them?.kind === "bot" ? them.userId : undefined;
    }

    undeleteMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        msg: Message,
    ): Promise<boolean> {
        const chat = chatSummariesStore.value.get(chatId);

        if (chat === undefined || !msg.deleted) {
            return Promise.resolve(false);
        }

        undeletingMessagesStore.add(msg.messageId);

        return this.#worker
            .send({
                kind: "undeleteMessage",
                chatType: chat.kind,
                chatId,
                messageId: msg.messageId,
                threadRootMessageIndex,
            })
            .then((resp) => {
                const success = resp.kind === "success";
                if (success) {
                    localUpdates.markMessageUndeleted(msg.messageId, resp.message.content);
                }
                return success;
            })
            .catch(() => false)
            .finally(() => {
                undeletingMessagesStore.delete(msg.messageId);
            });
    }

    revealDeletedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
    ): Promise<boolean> {
        const chat = chatSummariesStore.value.get(chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        const result =
            chatId.kind === "group_chat" || chatId.kind === "channel"
                ? this.#worker.send({
                      kind: "getDeletedGroupMessage",
                      chatId,
                      messageId,
                      threadRootMessageIndex,
                  })
                : this.#worker.send({
                      kind: "getDeletedDirectMessage",
                      userId: chatId.userId,
                      messageId,
                  });

        return result
            .then((resp) => {
                const success = resp.kind === "success";
                if (success) {
                    localUpdates.markMessageContentRevealed(messageId, resp.content);
                }
                return success;
            })
            .catch(() => false);
    }

    revealBlockedMessage(messageId: bigint) {
        localUpdates.markBlockedMessageRevealed(messageId);
    }

    selectReaction(
        chatId: ChatIdentifier,
        userId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        reaction: string,
        username: string,
        displayName: string | undefined,
        kind: "add" | "remove",
    ): Promise<boolean> {
        const chat = chatSummariesStore.value.get(chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        const undo = localUpdates.markReaction(messageId, {
            reaction,
            kind,
            userId,
        });

        publish("reactionSelected", { messageId, kind });

        const newAchievement = !achievementsStore.value.has("reacted_to_message");

        const result = (
            kind == "add"
                ? this.#worker.send({
                      kind: "addReaction",
                      chatId,
                      messageId,
                      reaction,
                      username,
                      displayName,
                      threadRootMessageIndex,
                      newAchievement,
                  })
                : this.#worker.send({
                      kind: "removeReaction",
                      chatId,
                      messageId,
                      reaction,
                      threadRootMessageIndex,
                  })
        )
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                return true;
            })
            .catch((_) => {
                undo();
                return false;
            });

        const messageRecipients = rtcMessageRecipients(chatId);
        this.#sendRtcMessage(messageRecipients, {
            kind: "remote_user_toggled_reaction",
            id: chatId,
            messageId: messageId,
            reaction,
            userId,
            added: kind === "add",
            threadRootMessageIndex,
        });
        return result;
    }

    async #loadThreadEventWindow(
        chat: ChatSummary,
        messageIndex: number,
        threadRootEvent: EventWrapper<Message>,
        initialLoad = false,
    ): Promise<number | undefined> {
        if (threadRootEvent.event.thread === undefined) return undefined;

        const chatId = chat.id;
        const threadRootMessageIndex = threadRootEvent.event.messageIndex;
        const context = { chatId, threadRootMessageIndex };
        const visit = selectedThreadFor(context);

        publish("loadingMessageWindow", { context, messageIndex });
        const eventsResponse: EventsResponse<ChatEvent> = await this.#worker
            .stream({
                kind: "chatEventsWindow",
                eventIndexRange: [0, threadRootEvent.event.thread.latestEventIndex],
                chatId,
                messageIndex,
                threadRootMessageIndex: threadRootEvent.event.messageIndex,
                latestKnownUpdate: chat.lastUpdated,
            })
            .aggregate(mergeEventStreamResponses, emptyEventsResponse())
            .mapAsync((resp) =>
                this.#handleEventsResponse(visit, chat, threadRootMessageIndex, resp),
            )
            .toPromise()
            .catch(CommonResponses.failure);

        if (!isSuccessfulEventsResponse(eventsResponse)) {
            publish("loadedMessageWindow", { context, messageIndex: undefined, initialLoad });
            if (initialLoad) {
                await this.#fallBackToPreviousMessages(visit, chatId, threadRootEvent);
            }
            return undefined;
        }

        publish("loadedMessageWindow", { context, messageIndex, initialLoad });

        return messageIndex;
    }

    async loadEventWindow(
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootEvent?: EventWrapper<Message>,
        initialLoad = false,
    ): Promise<number | undefined> {
        const clientChat = chatSummariesStore.value.get(chatId);
        const serverChat = allServerChatsStore.value.get(chatId);

        if (clientChat === undefined || this.#isPrivatePreview(clientChat)) {
            return Promise.resolve(undefined);
        }

        if (messageIndex >= 0) {
            if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
                return this.#loadThreadEventWindow(
                    serverChat ?? clientChat,
                    messageIndex,
                    threadRootEvent,
                    initialLoad,
                );
            }

            const latestMessageIndex = clientChat.latestMessage?.event.messageIndex ?? 0;
            if (messageIndex > latestMessageIndex) {
                messageIndex = latestMessageIndex;
            }

            const range = indexRangeForChat(clientChat);
            const context = { chatId: clientChat.id, threadRootMessageIndex: undefined };
            const visit = selectedChatFor(chatId);
            publish("loadingMessageWindow", { context, messageIndex });
            const eventsResponse: EventsResponse<ChatEvent> = await this.#worker
                .stream({
                    kind: "chatEventsWindow",
                    eventIndexRange: range,
                    chatId,
                    messageIndex,
                    threadRootMessageIndex: undefined,
                    latestKnownUpdate: serverChat?.lastUpdated,
                })
                .aggregate(mergeEventStreamResponses, emptyEventsResponse())
                .mapAsync((resp, index) =>
                    this.#handleEventsResponse(visit, clientChat, undefined, resp, index > 0),
                )
                .toPromise()
                .catch((err) => {
                    if (initialLoad && !this.maskChatMessages(clientChat)) {
                        this.#reportEmptyChat("window_load_failed", {
                            chatId: chatIdentifierToString(chatId),
                            messageIndex,
                            error: describeError(err),
                        });
                    }
                    return CommonResponses.failure();
                });

            if (!isSuccessfulEventsResponse(eventsResponse)) {
                publish("loadedMessageWindow", { context, messageIndex: undefined, initialLoad });
                if (initialLoad) {
                    await this.#fallBackToPreviousMessages(visit, chatId);
                }
                return undefined;
            }

            publish("loadedMessageWindow", { context, messageIndex, initialLoad });

            return messageIndex;
        }
    }

    // `visit` is the selection the events were loaded for: they go nowhere once it has gone
    async #handleEventsResponse(
        visit: EventsVisit | undefined,
        chat: ChatSummary,
        threadRootMessageIndex: number | undefined,
        resp: EventsResponse<ChatEvent>,
        keepCurrentEvents = true,
    ): Promise<EventsResponse<ChatEvent>> {
        if (!isSuccessfulEventsResponse(resp)) return resp;

        // NB. the clear and the add must not be separated by an await, otherwise the UI
        // renders against an empty event store for the duration of the gap, and anything
        // derived from it (e.g. the thread panel's root event) transiently disappears.
        // Equally the clear must not be deferred until after an await, or events written
        // by anything else during that await (later chunks of this same stream, rtc /
        // confirmed messages) get wiped by it. Nor can the two be one publish under
        // withPausedStores: the add checks contiguity against the stores derived from these, which
        // would still hold the old window.
        if (!keepCurrentEvents) {
            // The expired ranges go too: they are part of the contiguity baseline
            // (eventIndexesLoadedStore); if they survive a window replacement the freshly loaded
            // window can be judged non-contiguous against the OLD region's ranges and silently
            // dropped, leaving the event store empty.
            visit?.chat?.clearEvents();
        }

        this.#addServerEventsToStores(
            visit,
            chat.id,
            resp.events,
            threadRootMessageIndex,
            resp.expiredEventRanges,
        );

        await this.#updateUserStoreFromEvents(visit, chat.id, resp.events);

        if (!get(offlineStore)) {
            makeRtcConnections(
                currentUserIdStore.value,
                chat,
                resp.events,
                userStore.allUsers,
                userStore.blockedUsers,
                this.config.meteredApiKey,
            );
        }

        return resp;
    }

    async #updateUserStoreFromCommunityState(): Promise<void> {
        const allUserIds = new Set<string>();
        this.#getTruncatedUserIdsFromMembers([
            ...selectedCommunityMembersStore.value.values(),
        ]).forEach((m) => allUserIds.add(m.userId));
        selectedCommunityBlockedUsersStore.value.forEach((u) => allUserIds.add(u));
        selectedCommunityInvitedUsersStore.value.forEach((u) => allUserIds.add(u));
        selectedCommunityReferralsStore.value.forEach((u) => allUserIds.add(u));
        this.#lookupMembersSeen();
        await this.getMissingUsers(allUserIds);
    }

    // A chat or community with more members than are loaded at once has only some of them held. So
    // the current user, and the users who have appeared in the events loaded of the selected chat,
    // are looked up among the members of the chat and of its community if they aren't held, so that
    // what is shown of them (a community display name, say) is right. Those who linked the accounts
    // of its relayed messages are looked up too, since a relayed message's tips go to them, and only
    // if they're members.
    #lookupMembersSeen(): void {
        const chatId = selectedChatIdStore.value;
        // The current user comes first, since what is shown of them matters most to them
        const me = anonUserStore.value ? [] : [currentUserIdStore.value];
        const seen =
            chatId !== undefined && this.#usersSeenInChat.key === chatIdentifierToString(chatId)
                ? [...this.#usersSeenInChat.userIds, ...this.#linkedUsersSeenInChat()]
                : [];
        const community = selectedServerCommunityStore.value;
        if (
            community?.moreMembersAfter !== undefined &&
            communityIdentifiersEqual(community.communityId, selectedCommunityIdStore.value)
        ) {
            const inCommunity =
                chatId?.kind === "channel" &&
                chatId.communityId === community.communityId.communityId;
            void this.#lookupMembers(
                community.communityId,
                community,
                this.#communityMemberLookups,
                inCommunity ? [...me, ...seen] : me,
            );
        }
        const chat = selectedServerChatStore.value;
        if (
            chat?.moreMembersAfter !== undefined &&
            chat.chatId.kind !== "direct_chat" &&
            chatIdentifiersEqual(chat.chatId, chatId)
        ) {
            void this.#lookupMembers(chat.chatId, chat, this.#chatMemberLookups, [...me, ...seen]);
        }
    }

    #noteUsersSeenInChat(
        chatId: ChatIdentifier,
        userIds: Iterable<string>,
        bridgedUserIds: BridgedUserId[] = [],
    ): void {
        // Events which arrive once another chat has been selected are left out
        if (!chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
            return;
        }
        const key = chatIdentifierToString(chatId);
        if (this.#usersSeenInChat.key !== key) {
            this.#usersSeenInChat = { key, userIds: new Set(), bridgedUsers: new Set() };
        }
        for (const userId of userIds) {
            this.#usersSeenInChat.userIds.add(userId);
        }
        for (const id of bridgedUserIds) {
            this.#usersSeenInChat.bridgedUsers.add(bridgedUserKey(id)!);
        }
    }

    // Those who linked the accounts the relayed messages seen in the chat came from, of the accounts
    // whose profiles have been fetched
    #linkedUsersSeenInChat(): string[] {
        return [...this.#usersSeenInChat.bridgedUsers].flatMap(
            (key) => bridgedUsersStore.value.get(key)?.linkedUserId ?? [],
        );
    }

    // Looks up those of the users who aren't held, and aren't known not to be members, among the
    // members of the chat or community with this id, adding those who are to its details. Returns
    // those of the users who were found to be members, and haven't lapsed, including any found by
    // lookups which were already in flight.
    async #lookupMembers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        held: HeldMembers,
        lookups: MemberLookups,
        userIds: Iterable<string>,
    ): Promise<Set<string>> {
        const key = id.kind === "community" ? id.communityId : chatIdentifierToString(id);
        if (lookups.key !== key) {
            lookups.key = key;
            lookups.notMembers = new Set();
            lookups.pending = new Map();
        }
        const { notMembers, pending } = lookups;
        const asked = new Set<string>();
        const inFlight = new Set<Promise<ReadonlySet<string>>>();
        const toLookUp: string[] = [];
        for (const userId of userIds) {
            if (
                asked.has(userId) ||
                held.members.has(userId) ||
                held.lapsedMembers.has(userId) ||
                notMembers.has(userId)
            ) {
                continue;
            }
            asked.add(userId);
            const lookup = pending.get(userId);
            if (lookup !== undefined) {
                inFlight.add(lookup);
            } else if (isPrincipalValid(userId)) {
                toLookUp.push(userId);
            } else {
                // A user id which isn't valid (from a mention which someone typed, say) would fail
                // the whole lookup
                notMembers.add(userId);
            }
        }

        // The lookups only go to a replica which has reached the details held
        const asOf = held.timestamp;
        for (const batch of chunk(toLookUp, MEMBERS_PAGE_SIZE)) {
            const lookup = this.#lookupBatchOfMembers(id, batch, asOf, notMembers);
            for (const userId of batch) {
                pending.set(userId, lookup);
            }
            void lookup.then(() => {
                for (const userId of batch) {
                    if (pending.get(userId) === lookup) {
                        pending.delete(userId);
                    }
                }
            });
            inFlight.add(lookup);
        }

        const found = new Set<string>();
        for (const members of await Promise.all(inFlight)) {
            for (const userId of members) {
                if (asked.has(userId)) {
                    found.add(userId);
                }
            }
        }
        return found;
    }

    // Looks up the users among the members, noting those who aren't members and adding those who
    // are to the details. Resolves to those who are members and haven't lapsed. If the lookup fails
    // it resolves to nobody, and nothing is noted, so the users are looked up again when next asked
    // about.
    async #lookupBatchOfMembers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
        asOf: bigint,
        notMembers: Set<string>,
    ): Promise<ReadonlySet<string>> {
        const resp = await this.#worker
            .send({ kind: "lookupMembers", id, userIds, latestKnownUpdate: asOf })
            .catch(CommonResponses.failure);
        if (resp.kind !== "success") {
            return new Set<string>();
        }
        // Those who are members are held from now on, so only those who aren't are noted. Then a
        // member is looked up again if the details are replaced by some which don't hold them, as
        // they are if the details have been updated since the lookup.
        const members = new Set(resp.members.map((m) => m.userId));
        for (const userId of userIds) {
            if (!members.has(userId)) {
                notMembers.add(userId);
            }
        }
        this.#addLookedUpMembers(id, resp.members, asOf);
        return new Set(resp.members.filter((m) => !m.lapsed).map((m) => m.userId));
    }

    // Called as the details held for the chat or community with this key are replaced by newer ones.
    // Those found not to be members may have joined since, and the newer details only hold them if
    // they were brought up to date by the updates since. Details loaded in full instead (when the
    // updates since have been pruned, or there are too many) hold only the first page of members.
    // So everyone is looked up again when next seen. Lookups in flight note those they find not to
    // be members in the set they started with, which is dropped, since they were asked as of the
    // details being replaced.
    #forgetNotMembers(lookups: MemberLookups, key: string): void {
        if (lookups.key === key) {
            lookups.notMembers = new Set();
        }
    }

    // The members held for the selected chat or community with this id, and the lookups made of
    // those which aren't, or undefined if it isn't the one selected
    #selectedMembers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
    ): { held: HeldMembers; lookups: MemberLookups } | undefined {
        if (id.kind === "community") {
            const details = selectedServerCommunityStore.value;
            return details !== undefined &&
                communityIdentifiersEqual(details.communityId, id) &&
                communityIdentifiersEqual(id, selectedCommunityIdStore.value)
                ? { held: details, lookups: this.#communityMemberLookups }
                : undefined;
        }
        const details = selectedServerChatStore.value;
        return details !== undefined &&
            chatIdentifiersEqual(details.chatId, id) &&
            chatIdentifiersEqual(id, selectedChatIdStore.value)
            ? { held: details, lookups: this.#chatMemberLookups }
            : undefined;
    }

    // Whether the selected chat or community with this id holds only some of its members, because
    // it has more than are loaded at once
    membersIncomplete(id: MultiUserChatIdentifier | CommunityIdentifier): boolean {
        return this.#selectedMembers(id)?.held.moreMembersAfter !== undefined;
    }

    // Of the users, those who are members of the selected chat or community with this id, other than
    // lapsed members. If it holds only some of its members, those it doesn't hold are looked up.
    async #membersAmong(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<Set<string>> {
        const selected = this.#selectedMembers(id);
        if (selected === undefined) {
            return new Set();
        }
        // Held with any local updates applied, eg. a member just removed
        const members =
            id.kind === "community"
                ? selectedCommunityMembersStore.value
                : selectedChatMembersStore.value;
        const found = new Set(userIds.filter((u) => members.has(u)));
        if (selected.held.moreMembersAfter !== undefined) {
            const lookedUp = await this.#lookupMembers(
                id,
                selected.held,
                selected.lookups,
                userIds,
            );
            lookedUp.forEach((u) => found.add(u));
        }
        return found;
    }

    // Searches for users by name, returning up to `maxResults` of those who are members of the
    // selected chat or community with this id (see `#searchForMembers`). If it holds only some of
    // its members, those found who are members but aren't held are looked up, so are then held.
    async findMembers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        searchTerm: string,
        maxResults: number,
    ): Promise<UserSummary[]> {
        const { members } = await this.#searchForMembers(id, searchTerm, maxResults);
        if (id.kind === "channel") {
            // So that their display names in the community are known
            const communityId: CommunityIdentifier = {
                kind: "community",
                communityId: id.communityId,
            };
            const community = this.#selectedMembers(communityId);
            if (community?.held.moreMembersAfter !== undefined) {
                void this.#lookupMembers(
                    communityId,
                    community.held,
                    community.lookups,
                    members.map((u) => u.userId),
                );
            }
        }
        return members.slice(0, maxResults);
    }

    // Whether searching for members of the selected chat or community with this id should look for
    // more than it holds: because it holds only some of its members, or because it is a channel
    // whose community does, in which case its members' display names in the community aren't all
    // held
    shouldSearchForMembers(id: MultiUserChatIdentifier | CommunityIdentifier): boolean {
        return (
            this.membersIncomplete(id) ||
            (id.kind === "channel" &&
                this.membersIncomplete({ kind: "community", communityId: id.communityId }))
        );
    }

    // Searches for users by name who are members of the selected chat or community with this id.
    // The users found are those who best match out of every user, so if it holds only some of its
    // members, further pages of users are searched until `maxResults` usable members are found
    // (all of them unless the caller says otherwise). The members' display names in a community
    // (for a channel, its community) are searched too, since the user search doesn't know them.
    // Returns every usable member found, and the other users found who aren't members.
    async #searchForMembers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        searchTerm: string,
        maxResults: number,
        usable: (members: UserSummary[]) => Promise<UserSummary[]> = (members) =>
            Promise.resolve(members),
    ): Promise<{ members: UserSummary[]; others: UserSummary[] }> {
        const byDisplayName = this.#searchCommunityDisplayNames(id, searchTerm);
        const members: UserSummary[] = [];
        const others: UserSummary[] = [];
        const seen = new Set<string>();
        const pages = this.membersIncomplete(id) ? MAX_PAGES_SEARCHED_FOR_MEMBERS : 1;
        for (let pageIndex = 0; pageIndex < pages && members.length < maxResults; pageIndex++) {
            if (pageIndex > 0 && this.#selectedMembers(id) === undefined) {
                // Another chat or community has been selected since
                break;
            }
            const page = await this.searchUsers(
                searchTerm,
                USERS_SEARCHED_TO_FIND_MEMBERS,
                pageIndex,
            );
            // A UserIndex which doesn't page its results returns the first page again
            const users = page.filter((u) => !seen.has(u.userId));
            if (users.length === 0) {
                break;
            }
            users.forEach((u) => seen.add(u.userId));
            const found = await this.#membersAmong(
                id,
                users.map((u) => u.userId),
            );
            others.push(...users.filter((u) => !found.has(u.userId)));
            members.push(...(await usable(users.filter((u) => found.has(u.userId)))));
            if (page.length < USERS_SEARCHED_TO_FIND_MEMBERS) {
                break;
            }
        }

        const memberIds = new Set(members.map((u) => u.userId));
        const named = (await byDisplayName).filter((u) => !memberIds.has(u.userId));
        for (const user of await usable(named)) {
            memberIds.add(user.userId);
            members.push(user);
        }
        // Those found by their display names aren't others, whether or not the caller can use them
        const namedIds = new Set(named.map((u) => u.userId));
        return {
            members,
            others: others.filter((u) => !memberIds.has(u.userId) && !namedIds.has(u.userId)),
        };
    }

    // The members of the selected community with this id, or of the selected channel of it, whose
    // display names in the community match the search term, if the community holds only some of
    // its members. (Otherwise the display names of all of them are held.) Those found are held from
    // then on.
    async #searchCommunityDisplayNames(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        searchTerm: string,
    ): Promise<UserSummary[]> {
        if (id.kind === "group_chat") {
            return [];
        }
        const communityId: CommunityIdentifier =
            id.kind === "community" ? id : { kind: "community", communityId: id.communityId };
        const community = this.#selectedMembers(communityId);
        if (community?.held.moreMembersAfter === undefined) {
            return [];
        }
        const asOf = community.held.timestamp;
        const resp = await this.#worker
            .send({
                kind: "searchCommunityMembers",
                id: communityId,
                searchTerm,
                maxResults: USERS_SEARCHED_TO_FIND_MEMBERS,
                latestKnownUpdate: asOf,
            })
            .catch(CommonResponses.failure);
        if (resp.kind !== "success") {
            return [];
        }
        if (community.lookups.key === communityId.communityId) {
            resp.members.forEach((m) => community.lookups.notMembers.delete(m.userId));
        }
        this.#addLookedUpMembers(communityId, resp.members, asOf);

        const found = resp.members.filter((m) => !m.lapsed);
        const userIds = found.map((m) => m.userId);
        const [inChannel] = await Promise.all([
            id.kind === "channel" ? this.#membersAmong(id, userIds) : undefined,
            this.getMissingUsers(userIds),
        ]);
        const users: UserSummary[] = [];
        for (const member of found) {
            const user = userStore.get(member.userId);
            if (user !== undefined && (inChannel === undefined || inChannel.has(member.userId))) {
                users.push({ ...user, displayName: member.displayName ?? user.displayName });
            }
        }
        return users;
    }

    // Makes sure the members of the selected community's user groups (or of just the one with this
    // id) are held, and their users are known, so that the groups can be shown in full. A community
    // which holds only some of its members may not hold them.
    async loadUserGroupMembers(
        communityId: CommunityIdentifier,
        userGroupId?: number,
    ): Promise<void> {
        if (!communityIdentifiersEqual(communityId, selectedCommunityIdStore.value)) {
            return;
        }
        const userIds = new Set<string>();
        for (const userGroup of selectedCommunityUserGroupsStore.value.values()) {
            if (userGroupId === undefined || userGroup.id === userGroupId) {
                userGroup.members.forEach((u) => userIds.add(u));
            }
        }
        if (userIds.size > 0) {
            await Promise.all([
                this.#membersAmong(communityId, [...userIds]),
                this.getMissingUsers(userIds),
            ]);
        }
    }

    // Looks up the users you have direct chats with among the members of the selected community and
    // channel, where either holds only some of its members, so that the members held say which of
    // them are members of each. Those who are members of the community, but not the channel, are
    // offered to add to the channel.
    async lookupDirectChatUsersAmongChannelMembers(): Promise<void> {
        const communityId = selectedCommunityIdStore.value;
        const channelId = selectedChatIdStore.value;
        if (communityId === undefined || channelId?.kind !== "channel") {
            return;
        }
        const userIds = [...serverDirectChatsStore.value.values()]
            .map((c) => c.them.userId)
            .filter((u) => userStore.get(u)?.kind !== "bot");
        // Only members of the community can be members of the channel
        const inCommunity = await this.#membersAmong(communityId, userIds);
        await this.#membersAmong(channelId, [...inCommunity]);
    }

    // Finds members of the selected chat to offer as mentions for what has been typed, if it may not
    // hold them all (see `shouldSearchForMembers`). Those found are then held, so are offered too.
    async findMembersToMention(prefix: string): Promise<void> {
        const chatId = selectedChatIdStore.value;
        if (
            chatId !== undefined &&
            chatId.kind !== "direct_chat" &&
            this.shouldSearchForMembers(chatId)
        ) {
            await this.findMembers(chatId, prefix, MEMBERS_FOUND_TO_MENTION);
        }
    }

    // A message's text with each @username typed in it which can be mentioned in the chat replaced
    // by the mention, and the users mentioned, both those typed and those picked from the mention
    // picker. Only a message to the selected chat (or a thread of it) is expanded, since what can be
    // mentioned is only known for that. A chat which holds only some of its members may not hold
    // those typed, so the users with those of the usernames it doesn't know are looked up, and
    // mentioned if they're members of the chat who haven't lapsed. Never rejects: if the lookups
    // fail, those usernames are left as typed.
    async #expandTypedMentions(
        messageContext: MessageContext,
        text: string | undefined,
        picked: User[],
    ): Promise<{ text: string | undefined; mentioned: User[] }> {
        const chatId = messageContext.chatId;
        if (text === undefined || !chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
            return { text, mentioned: picked };
        }
        // What the chat knows is taken now, so that it's this chat's, whatever is selected by the
        // time any lookups return
        const known = new Map<string, UserOrUserGroup>();
        const unknown = new Set<string>();
        const myUsername = currentUserStore.value.username.toLowerCase();
        for (const typed of typedMentions(text)) {
            const username = typed.toLowerCase();
            const found = this.lookupUserForMention(username, false);
            if (found !== undefined) {
                known.set(username, found);
            } else if (username !== myUsername) {
                unknown.add(username);
            }
        }
        if (unknown.size > 0 && chatId.kind !== "direct_chat" && this.membersIncomplete(chatId)) {
            try {
                const members = await this.#findMembersByUsername(
                    chatId,
                    [...unknown].slice(0, MAX_USERNAMES_MENTIONED_LOOKED_UP),
                );
                members.forEach((user, username) => known.set(username, user));
            } catch (err) {
                console.warn("Unable to look up the members mentioned in a message", err);
            }
        }

        const expanded = expandTypedMentions(text, (username) => known.get(username.toLowerCase()));
        const mentioned = new Set(expanded.mentioned.map((u) => u.userId));
        return {
            text: expanded.text,
            mentioned: [...expanded.mentioned, ...picked.filter((u) => !mentioned.has(u.userId))],
        };
    }

    // The members of the selected chat with this id who haven't lapsed, out of the users with these
    // usernames (in lower case), by username. Those found are held from then on.
    async #findMembersByUsername(
        chatId: MultiUserChatIdentifier,
        usernames: string[],
    ): Promise<Map<string, UserSummary>> {
        const lookedUp = await Promise.all(
            usernames.map(async (username) => {
                const userId = await this.#worker
                    .send({ kind: "getUserIdByUsername", username })
                    .catch(() => undefined);
                return [username, userId] as const;
            }),
        );
        const me = currentUserIdStore.value;
        const userIds = new Map<string, string>();
        for (const [username, userId] of lookedUp) {
            if (userId !== undefined && userId !== me) {
                userIds.set(userId, username);
            }
        }
        const [members] = await Promise.all([
            this.#membersAmong(chatId, [...userIds.keys()]),
            this.getMissingUsers(userIds.keys()),
        ]);
        // By the username typed, which a user held from before they changed it doesn't have
        const found = new Map<string, UserSummary>();
        for (const userId of members) {
            const user = userStore.get(userId);
            const username = userIds.get(userId);
            if (user !== undefined && username !== undefined) {
                found.set(username, user);
            }
        }
        return found;
    }

    // Adds members who have been looked up to the details of the selected chat or community, if that
    // is still the one selected
    #addLookedUpMembers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        members: Member[],
        asOf: bigint,
    ): void {
        if (id.kind === "community") {
            const details = selectedServerCommunityStore.value;
            if (details !== undefined && communityIdentifiersEqual(details.communityId, id)) {
                const updated = details.withLookedUpMembers(members, asOf);
                if (updated !== undefined) {
                    selectedServerCommunityStore.set(updated);
                }
            }
        } else {
            const details = selectedServerChatStore.value;
            if (details !== undefined && chatIdentifiersEqual(details.chatId, id)) {
                const updated = details.withLookedUpMembers(members, asOf);
                if (updated !== undefined) {
                    selectedChatFor(id)?.setDetails(updated);
                }
            }
        }
    }

    // We create add a limited subset of the members to the userstore for performance reasons.
    // We will already be adding users from events so it's not critical that we get all members
    // at this point
    #getTruncatedUserIdsFromMembers(members: Member[]): Member[] {
        const elevated = members.filter((m) => m.role > ROLE_MEMBER);
        // Then up to as many others as there are in the first page of a chat or community which
        // holds only some of its members
        const rest = members.filter((m) => m.role <= ROLE_MEMBER).slice(0, MEMBERS_PAGE_SIZE);
        return [...elevated, ...rest];
    }

    // `visit` is the selection the events were loaded for: the users in them are only taken to be
    // in the selected chat if it is still that selection
    async #updateUserStoreFromEvents(
        visit: EventsVisit | undefined,
        chatId: ChatIdentifier,
        events: EventWrapper<ChatEvent>[],
    ): Promise<void> {
        const userId = currentUserIdStore.value;
        const allUserIds = new Set<string>();
        this.#getTruncatedUserIdsFromMembers([...selectedChatMembersStore.value.values()]).forEach(
            (m) => allUserIds.add(m.userId),
        );
        selectedChatBlockedUsersStore.value.forEach((u) => allUserIds.add(u));
        selectedChatInvitedUsersStore.value.forEach((u) => allUserIds.add(u));
        const { userIds, webhooks } = userIdsFromEvents(events);
        for (const u of userIds) {
            allUserIds.add(u);
        }
        const bridgedUserIds = bridgedUserIdsFromEvents(events);
        this.#noteUsersSeenInChat(chatId, userIds, bridgedUserIds);
        userStore.addWebhookIds([...webhooks]);
        void this.getBridgedUsers(bridgedUserIds);
        const newChatUserIds = [...allUserIds].filter(
            (u) => u !== userId && !selectedChatUserIdsStore.value.has(u),
        );
        visit?.addUserIds(newChatUserIds);
        this.#lookupMembersSeen();
        await this.getMissingUsers(allUserIds);
    }

    isTyping = isTyping;
    trackEvent = trackEvent;
    communityMessageRegex = communityMessageRegex;
    groupMessageRegex = groupMessageRegex;
    metricsEqual = metricsEqual;

    #blockUserLocally(chatId: ChatIdentifier, userId: string): UndoLocalUpdate {
        const undos = [
            localUpdates.blockChatUser(chatId, userId),
            localUpdates.removeChatMember(chatId, userId),
        ];
        return () => {
            undos.forEach((u) => u());
        };
    }

    #unblockUserLocally(
        chatId: ChatIdentifier,
        userId: string,
        addToMembers: boolean,
    ): UndoLocalUpdate {
        const undos = [localUpdates.unblockChatUser(chatId, userId)];
        if (addToMembers) {
            undos.push(
                localUpdates.addChatMember(chatId, {
                    role: ROLE_MEMBER,
                    userId,
                    displayName: undefined,
                    lapsed: false,
                }),
            );
        }
        return () => {
            undos.forEach((u) => u());
        };
    }

    blockCommunityUser(id: CommunityIdentifier, userId: string): Promise<boolean> {
        const blockUndo = localUpdates.blockCommunityUser(id, userId);
        const membersUndo = localUpdates.removeCommunityMember(id, userId);
        return this.#worker
            .send({ kind: "blockCommunityUser", id, userId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    blockUndo();
                    membersUndo();
                    return false;
                }
                return true;
            })
            .catch(() => {
                blockUndo();
                membersUndo();
                return false;
            });
    }

    unblockCommunityUser(id: CommunityIdentifier, userId: string): Promise<boolean> {
        const undo = localUpdates.unblockCommunityUser(id, userId);
        return this.#worker
            .send({ kind: "unblockCommunityUser", id, userId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                return true;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    blockUser(chatId: MultiUserChatIdentifier, userId: string): Promise<boolean> {
        const undo = this.#blockUserLocally(chatId, userId);
        return this.#worker
            .send({ kind: "blockUserFromGroupChat", chatId, userId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                return true;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    unblockUser(chatId: MultiUserChatIdentifier, userId: string): Promise<boolean> {
        const undo = this.#unblockUserLocally(chatId, userId, false);
        return this.#worker
            .send({ kind: "unblockUserFromGroupChat", chatId, userId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                return true;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    /** Blocks `userId` where their profile card was opened (`profileBlock`). */
    blockUserInContext(context: BlockContext, userId: string): Promise<boolean> {
        switch (context.kind) {
            case "direct_chat":
                return this.blockUserFromDirectChat(userId);
            case "group_chat":
                return this.blockUser(context.id, userId);
            case "community":
                return this.blockCommunityUser(context.id, userId);
        }
    }

    /** Unblocks `userId` where their profile card was opened (`profileBlock`). */
    unblockUserInContext(context: BlockContext, userId: string): Promise<boolean> {
        switch (context.kind) {
            case "direct_chat":
                return this.unblockUserFromDirectChat(userId);
            case "group_chat":
                return this.unblockUser(context.id, userId);
            case "community":
                return this.unblockCommunityUser(context.id, userId);
        }
    }

    formatDisappearingMessageTime(
        milliseconds: number,
        formatter: MessageFormatter = this.config.i18nFormatter,
    ): string {
        return formatDisappearingMessageTime(milliseconds, formatter);
    }

    formatDuration = formatDuration;
    durationFromMilliseconds = durationFromMilliseconds;
    nullUser = nullUser;
    toTitleCase = toTitleCase;
    formatTimeRemaining = formatTimeRemaining;
    formatLastOnlineDate = formatLastOnlineDate;
    buildUserAvatarUrl = buildUserAvatarUrl;
    buildUserBackgroundUrl = buildUserBackgroundUrl;
    buildUsernameList = buildUsernameList;
    buildReducedProfileDataList = buildReducedProfileDataList;
    groupMessagesByDate = groupMessagesByDate;
    fillMessage = fillMessage;
    audioRecordingMimeType = audioRecordingMimeType;

    // Returns the chat to go to, or undefined if there's no such user. That's the chat under the
    // user's latest id if `chatId` is under one they had before being migrated to a MultiUser
    // canister, eg. from an old link or notification, since their chat was moved onto that id.
    async createDirectChat(
        chatId: DirectChatIdentifier,
    ): Promise<DirectChatIdentifier | undefined> {
        let directChatId = chatId;
        if (!userStore.has(chatId.userId)) {
            const user = await this.getUser(chatId.userId);
            if (user === undefined) {
                return undefined;
            }
            directChatId = { kind: "direct_chat", userId: user.userId };
        }
        // The placeholder would shadow the real chat in allServerChatsStore, making it appear empty.
        // This must be checked after the await above, since the chat may have arrived in the meantime.
        if (!serverDirectChatsStore.value.has(directChatId)) {
            localUpdates.addUninitialisedDirectChat(directChatId);
        }
        return directChatId;
    }

    #isPrivatePreview(chat: ChatSummary): boolean {
        return chat.kind === "group_chat" && chat.membership === undefined && !chat.public;
    }

    #uninstalledBotChat(chat: ChatSummary): boolean {
        if (chat.kind !== "direct_chat") return false;
        const botId = chat.them.userId;
        const bot = botState.externalBots.get(botId);
        return bot !== undefined && directChatBotsStore.value.get(botId) === undefined;
    }

    async setSelectedChat(
        chatId: ChatIdentifier,
        messageIndex?: number,
        threadMessageIndex?: number,
    ): Promise<void> {
        let chat = chatSummariesStore.value.get(chatId);
        const scope = chatListScopeStore.value;
        let autojoin = false;

        if (chat !== undefined && chatRestricted(chat)) {
            publish("restrictedContent");
            return;
        }
        this.#proposalTalliesPoller?.stop();
        this.#proposalTalliesPoller = undefined;

        // if this is an unknown chat let's preview it
        if (chat === undefined) {
            // if the scope is favourite let's redirect to the non-favourite counterpart and try again
            // this is necessary if the link is no longer in our favourites or came from another user and was *never* in our favourites.
            if (scope.kind === "favourite") {
                publish("navigateTo", {
                    url: routeForChatIdentifier(
                        selectedCommunityIdStore.value === undefined ? "chats" : "community",
                        chatId,
                    ),
                });
                return;
            }
            if (chatId.kind === "direct_chat") {
                // The route may have come from outside the app, eg. an old link or notification
                const directChatId = await this.createDirectChat(chatId);
                // The user may have moved on while the user was being looked up
                if (!chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
                    return;
                }
                if (directChatId === undefined) {
                    publish("notFound");
                } else if (directChatId.userId !== chatId.userId) {
                    // The user has been migrated to a MultiUser canister since having the id in the
                    // route, so go to the chat under their latest id instead, in place of the old
                    // id in the history
                    publish("navigateTo", {
                        url: routeForMovedDirectChat("chats", directChatId, messageIndex),
                        intent: "auto",
                    });
                    return;
                } else {
                    publish("navigateTo", { url: routeForChatIdentifier("chats", chatId) });
                }
            } else if (chatId.kind === "group_chat" || chatId.kind === "channel") {
                autojoin = querystringStore.value.has("autojoin");

                if (chatId.kind === "group_chat") {
                    const code = querystringStore.value.get("code");
                    if (code) {
                        this.groupInvite = {
                            chatId,
                            code,
                        };
                    }
                }
                const preview = await this.previewChat(chatId);
                if (preview.kind === "group_moved") {
                    if (messageIndex !== undefined) {
                        if (threadMessageIndex !== undefined) {
                            publish("navigateTo", {
                                url: routeForMessage(
                                    "community",
                                    {
                                        chatId: preview.location,
                                        threadRootMessageIndex: messageIndex,
                                    },
                                    threadMessageIndex,
                                ),
                            });
                        } else {
                            publish("navigateTo", {
                                url: routeForMessage(
                                    "community",
                                    { chatId: preview.location },
                                    messageIndex,
                                ),
                            });
                        }
                    } else {
                        publish("navigateTo", {
                            url: routeForChatIdentifier(scope.kind, preview.location),
                        });
                    }
                } else if (preview.kind === "failure") {
                    publish("notFound");
                    return;
                }
            }
            chat = chatSummariesStore.value.get(chatId);

            // The user may have moved on while the preview was in flight
            if (!chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
                return;
            }
        }

        if (chat !== undefined) {
            // If an archived chat has been explicitly selected (for example by searching for it) then un-archive it
            if (chat.membership.archived) {
                void unarchiveChatsReportingFailure([chat.id], this.#unarchiving, (chatIds) =>
                    this.unarchiveChats(chatIds),
                );
            }

            // if it's a known chat let's select it
            this.closeNotificationsForChat(chat.id);
            eventListScrollTop.set(undefined);
            this.#setSelectedChat(chat.id, messageIndex);
            this.filterRightPanelHistoryByChatType(chat);

            if (autojoin && chat.kind !== "direct_chat") {
                publish("joinGroup", chat);
            }
        }
    }

    #setSelectedChat(chatId: ChatIdentifier, messageIndex?: number): void {
        const clientChat = chatSummariesStore.value.get(chatId);
        const serverChat = allServerChatsStore.value.get(chatId);

        if (clientChat === undefined) {
            return;
        }

        this.#chatSelectionSeq++;

        if (messageIndex === undefined) {
            messageIndex = isPreviewing(clientChat)
                ? undefined
                : messagesRead.getFirstUnreadMessageIndex(
                      clientChat.id,
                      clientChat.latestMessage?.event.messageIndex,
                  );

            const latestMessageIndex = clientChat.latestMessage?.event.messageIndex;
            if (messageIndex !== undefined && latestMessageIndex !== undefined) {
                if (latestMessageExpired(clientChat)) {
                    // Every unread message has disappeared: nothing to anchor a window on, and
                    // nothing that could ever be read to clear the unread count. Mark the chat
                    // read and load the latest events instead.
                    messagesRead.markReadUpTo({ chatId }, latestMessageIndex);
                    messageIndex = undefined;
                } else {
                    const latestServerMessageIndex =
                        serverChat?.latestMessage?.event.messageIndex ?? 0;

                    if (messageIndex > latestServerMessageIndex) {
                        messageIndex = undefined;
                    }
                }
            }
        }

        // A message below the caller's min visible index cannot anchor a window: a member who
        // has never read anything gets message 0 as their first unread even when the chat's
        // history is hidden from them, and a link can point into that history. Anchor on the
        // first visible message instead, if there is one.
        if (
            messageIndex !== undefined &&
            clientChat.kind !== "direct_chat" &&
            messageIndex < clientChat.minVisibleMessageIndex
        ) {
            const latestMessageIndex = clientChat.latestMessage?.event.messageIndex ?? -1;
            messageIndex =
                clientChat.minVisibleMessageIndex <= latestMessageIndex
                    ? clientChat.minVisibleMessageIndex
                    : undefined;
        }

        // TODO - this might belong as a derivation in the selected chat state
        this.#userLookupForMentions = undefined;

        const selectedChat = selectedChatSummaryStore.value;
        if (selectedChat === undefined) {
            this.#reportEmptyChat("no_selected_chat_summary", {
                chatId: chatIdentifierToString(chatId),
                selectedChatId:
                    selectedChatIdStore.value === undefined
                        ? undefined
                        : chatIdentifierToString(selectedChatIdStore.value),
                summaryStoreDirty: selectedChatSummaryStore.dirty,
                hasServerChat: serverChat !== undefined,
            });
        }
        if (selectedChat !== undefined) {
            if (!this.#uninstalledBotChat(selectedChat)) {
                // Captured now: the details load after the events, by when the user may have moved on
                const visit = selectedChatFor(chatId);
                const path = messageIndex !== undefined ? "window" : "previous";
                const load =
                    messageIndex !== undefined
                        ? this.loadEventWindow(chatId, messageIndex, undefined, true)
                        : this.loadPreviousMessages(chatId, undefined, true);
                const loaded = load.then(() => {
                    void this.#checkForEmptyChat(chatId, path);
                    if (serverChat !== undefined) {
                        return this.#loadChatDetails(visit, serverChat);
                    }
                });
                this.#chatDetailsLoad = { chatId, loaded };
            }
            if (selectedChat.kind === "direct_chat") {
                const them = userStore.get(selectedChat.them.userId);
                // Refresh user details if they are more than 5 minutes out of date
                if (
                    them === undefined ||
                    Date.now() - Number(them.updated) > 5 * ONE_MINUTE_MILLIS
                ) {
                    this.getUser(selectedChat.them.userId);
                }
            }

            lastSelectedChatByScopeStore.update((map) => {
                map.set(chatListScopeStore.value, chatId);
                return map;
            });
        }

        if (isProposalsChat(clientChat)) {
            const { isNns, governanceCanisterId } = clientChat.subtype;
            if (!isNns) {
                this.#updateNervousSystemFunctions(governanceCanisterId);
            }
            const id = clientChat.id;
            this.#proposalTalliesPoller = new Poller(
                () => this.#updateProposalTallies(id),
                20_000,
                undefined,
                true,
            );

            selectedChatFor(clientChat.id)?.setFilteredProposals(
                FilteredProposals.fromStorage(governanceCanisterId),
            );
        }
    }

    openThreadFromMessageIndex(
        chatId: ChatIdentifier,
        messageIndex: number,
        threadMessageIndex?: number,
    ): void {
        const event = eventsStore.value.find(
            (ev) => ev.event.kind === "message" && ev.event.messageIndex === messageIndex,
        ) as EventWrapper<Message> | undefined;
        if (event !== undefined) {
            this.openThread(chatId, event, event.event.thread === undefined, threadMessageIndex);
        }
    }

    openThread(
        chatId: ChatIdentifier,
        threadRootEvent: EventWrapper<Message>,
        initiating: boolean,
        focusThreadMessageIndex?: number,
    ): void {
        // Opening the thread that is already open starts it again too, which the store's own
        // subscription would not, since the thread is unchanged
        withPausedStores(() => {
            const thread = { chatId, threadRootMessageIndex: threadRootEvent.event.messageIndex };
            selectedThreadIdStore.set(thread);
            startThreadVisit(thread);
        });

        if (!initiating) {
            if (focusThreadMessageIndex !== undefined) {
                this.loadEventWindow(chatId, focusThreadMessageIndex, threadRootEvent, true);
            } else {
                this.loadPreviousMessages(chatId, threadRootEvent, true);
            }
        }

        rightPanelHistory.set([
            {
                kind: "message_thread_panel",
                threadRootMessageIndex: threadRootEvent.event.messageIndex,
                threadRootMessageId: threadRootEvent.event.messageId,
            },
        ]);

        const chat = allChatsStore.value.get(chatId);
        if (chat) {
            publish("openThread", { msg: threadRootEvent, chat });
        }
    }

    async loadThreadMessages(
        chatId: ChatIdentifier,
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number,
        initialLoad = false,
    ): Promise<void> {
        const chat = chatSummariesStore.value.get(chatId);

        if (chat === undefined) {
            return Promise.resolve();
        }

        const visit = selectedThreadFor({ chatId, threadRootMessageIndex });
        const eventsResponse: EventsResponse<ChatEvent> = await this.#worker
            .stream({
                kind: "chatEvents",
                chatType: chat.kind,
                chatId,
                eventIndexRange: range,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate: chat.lastUpdated,
            })
            .aggregate(mergeEventStreamResponses, emptyEventsResponse())
            .mapAsync((resp) =>
                this.#handleEventsResponse(visit, chat, threadRootMessageIndex, resp),
            )
            .toPromise()
            .catch(CommonResponses.failure);

        if (isSuccessfulEventsResponse(eventsResponse)) {
            if (ascending) {
                publish("loadedNewMessages", { chatId, threadRootMessageIndex });
            } else {
                publish("loadedPreviousMessages", {
                    context: { chatId, threadRootMessageIndex },
                    initialLoad,
                });
            }
        }
    }

    /**
     * Takes a chat `canRemoveFromList` allows off the list: a DM with a bot uninstalls the bot,
     * anything else is a preview dropped. Goes to the list if it was open.
     */
    removeFromList(chat: ChatSummary): void {
        const directBot =
            chat.kind === "direct_chat" ? botState.externalBots.get(chat.them.userId) : undefined;
        if (directBot !== undefined) {
            this.uninstallBot(
                { kind: "direct_chat", userId: currentUserIdStore.value },
                directBot.id,
            );
        } else {
            this.removePreviewedChat(chat.id);
        }
        if (chatIdentifiersEqual(chat.id, selectedChatIdStore.value)) {
            publish("navigateTo", { url: routeForScope(chatListScopeStore.value) });
        }
    }

    removePreviewedChat(chatId: ChatIdentifier) {
        switch (chatId.kind) {
            case "direct_chat":
                localUpdates.removeUninitialisedDirectChat(chatId);
                break;
            default:
                localUpdates.removeGroupPreview(chatId);
                break;
        }
    }

    removeChat(chatId: ChatIdentifier) {
        return localUpdates.removeChat(chatId);
    }

    removeCommunity(id: CommunityIdentifier): void {
        localUpdates.removeCommunity(id);
    }

    // Called when the selected community changes. If we were only previewing the
    // community we just left, drop the preview (and any of its channels we were
    // previewing) so that leaving by any route behaves the same as cancelling.
    removeCommunityIfPreviewing(id: CommunityIdentifier): void {
        const preview = localUpdates.getPreviewingCommunity(id);
        if (preview === undefined) return;
        preview.channels.forEach((c) => localUpdates.removeGroupPreview(c.id));
        localUpdates.removeCommunityPreview(id);
    }

    messageContentFromFile(
        file: File | LazyFile,
        context: MessageContext,
    ): Promise<AttachmentContent> {
        return messageContentFromFile(file, isDiamondStore.value, {
            websiteVersion: this.config.websiteVersion,
            onProgress: (p) =>
                videoProcessingProgress.set(p === undefined ? undefined : { context, progress: p }),
        });
    }

    formatFileSize = formatFileSize;

    getTokenDetailsForAccessGate(gate: AccessGate): CryptocurrencyDetails | undefined {
        if (gate.kind === "neuron_gate") {
            return this.tryGetNervousSystem(gate.governanceCanister)?.token;
        } else if (gate.kind === "payment_gate" || gate.kind === "token_balance_gate") {
            return this.tryGetCryptocurrency(gate.ledgerCanister);
        }
    }

    getMinDissolveDelayDays(gate: AccessGate): number | undefined {
        if (isNeuronGate(gate)) {
            return gate.minDissolveDelay ? gate.minDissolveDelay / ONE_DAY : undefined;
        }
    }

    getPaymentAmount(gate: AccessGate): bigint | undefined {
        return isPaymentGate(gate) ? gate.amount : undefined;
    }

    getMinStakeInTokens(gate: AccessGate): number | undefined {
        if (isNeuronGate(gate)) {
            return gate.minStakeE8s ? gate.minStakeE8s / E8S_PER_TOKEN : undefined;
        }
    }

    earliestLoadedThreadIndex(): number | undefined {
        return threadEventsStore.value.length === 0 ? undefined : threadEventsStore.value[0].index;
    }

    // Thread events start at index 0, so a thread whose latest event index is 0 holds one event
    // at most. When that event is our own unconfirmed message, the send that creates the thread
    // on the server is still in flight: the local summary written by `afterSendMessage` is what
    // made the thread exist here, and asking the server for its events now gets ThreadNotFound.
    // Once the send lands the event is confirmed and there is still nothing older to fetch.
    #firstThreadReplyInFlight(
        chatId: ChatIdentifier,
        threadRootEvent: EventWrapper<Message>,
    ): boolean {
        const thread = threadRootEvent.event.thread;
        if (thread === undefined || thread.latestEventIndex > 0) return false;
        const context = { chatId, threadRootMessageIndex: threadRootEvent.event.messageIndex };
        return localUpdates.unconfirmedMessages(context).length > 0;
    }

    previousThreadMessagesCriteria(thread: ThreadSummary): [number, boolean] | undefined {
        const minLoadedEventIndex = this.earliestLoadedThreadIndex();
        if (minLoadedEventIndex === undefined) {
            return [thread.latestEventIndex, false];
        }
        // Thread events start at index 0. Once it is loaded there is nothing
        // earlier to ask for; a start index of -1 makes the cache iterator
        // throw ("Start index exceeds bound") and the whole load fails.
        if (minLoadedEventIndex <= 0) {
            return undefined;
        }
        return [minLoadedEventIndex - 1, false];
    }

    async loadPreviousMessages(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
        initialLoad = false,
    ): Promise<void> {
        const serverChat = allServerChatsStore.value.get(chatId);

        if (serverChat === undefined || this.#isPrivatePreview(serverChat)) {
            return Promise.resolve();
        }

        if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
            if (this.#firstThreadReplyInFlight(chatId, threadRootEvent)) return;
            const thread = threadRootEvent.event.thread;
            const threadCriteria = this.previousThreadMessagesCriteria(thread);
            if (threadCriteria === undefined) {
                return;
            }
            const [index, ascending] = threadCriteria;
            return this.loadThreadMessages(
                chatId,
                [0, thread.latestEventIndex],
                index,
                ascending,
                threadRootEvent.event.messageIndex,
                initialLoad,
            );
        }

        const criteria = this.#previousMessagesCriteria(serverChat);
        const visit = selectedChatFor(chatId);

        const eventsResponse = criteria
            ? await this.#loadEvents(visit, serverChat, criteria[0], criteria[1], initialLoad)
            : undefined;

        if (criteria && isSuccessfulEventsResponse(eventsResponse)) {
            this.#fillLoadedEventGaps(visit, serverChat, eventsResponse, criteria[0], criteria[1]);
            publish("loadedPreviousMessages", {
                context: { chatId, threadRootMessageIndex: threadRootEvent?.event.messageIndex },
                initialLoad,
            });
        }
    }

    // A paged events request walks every index from its start index in the
    // requested direction and returns everything it has, so any index inside
    // the span it walked that came back with neither an event nor an expired
    // range has nothing this user can ever fetch (e.g. pruned or not
    // visible). Record those holes as covered. Without this the loaded event
    // ranges become disjoint, the timeline splits into segments, and because
    // previous-message loads always start below the GLOBAL earliest loaded
    // index, scroll-back keeps loading below the split while the visible
    // segment never grows — a permanent "wall" mid-history.
    #fillLoadedEventGaps(
        visit: SelectedChat | undefined,
        serverChat: ChatSummary,
        resp: EventsSuccessResult<ChatEvent>,
        requestStart: number,
        ascending: boolean,
    ): void {
        const covered = new DRange();
        resp.events.forEach((e) => covered.add(e.index));
        resp.expiredEventRanges.forEach((r) => covered.add(r.start, r.end));

        let min: number;
        let max: number;
        if (covered.length === 0) {
            // The page caps on events found, not indexes walked, so an empty
            // response means the walk ran off the end of the log and the
            // entire remaining span in the walked direction is holes.
            if (ascending) {
                if (resp.latestEventIndex === undefined) return;
                min = requestStart;
                max = resp.latestEventIndex;
            } else {
                min = this.earliestAvailableEventIndex(serverChat);
                max = requestStart;
            }
        } else {
            min = Math.min(covered.index(0), requestStart);
            max = Math.max(covered.index(covered.length - 1), requestStart);
        }

        // never mark indexes above the responding replica's own latest event
        // index — requestStart can come from a fresher summary, and those
        // indexes are real events this replica just hasn't seen yet
        if (resp.latestEventIndex !== undefined) {
            max = Math.min(max, resp.latestEventIndex);
        }
        if (max < min) return;

        const holes = new DRange(min, max).subtract(covered);
        if (holes.length === 0) return;

        visit?.updateExpiredEventRanges((ranges) => {
            const merged = new DRange();
            merged.add(ranges);
            merged.add(holes);
            return merged;
        });
    }

    #loadEvents(
        visit: SelectedChat | undefined,
        serverChat: ChatSummary,
        startIndex: number,
        ascending: boolean,
        initialLoad = false,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.#worker
            .stream({
                kind: "chatEvents",
                chatType: serverChat.kind,
                chatId: serverChat.id,
                eventIndexRange: indexRangeForChat(serverChat),
                startIndex,
                ascending,
                threadRootMessageIndex: undefined,
                latestKnownUpdate: serverChat.lastUpdated,
            })
            .aggregate(mergeEventStreamResponses, emptyEventsResponse())
            .mapAsync((resp) => this.#handleEventsResponse(visit, serverChat, undefined, resp))
            .toPromise()
            .catch((err) => {
                if (initialLoad && !this.maskChatMessages(serverChat)) {
                    this.#reportEmptyChat("previous_load_failed", {
                        chatId: chatIdentifierToString(serverChat.id),
                        startIndex,
                        error: (err as { message?: string })?.message ?? String(err),
                    });
                }
                return CommonResponses.failure();
            });
    }

    #previousMessagesCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
        if (serverChat.latestEventIndex < 0) {
            return undefined;
        }

        // An uninitialised direct chat is a local placeholder for someone we have never
        // messaged (localUpdates.addUninitialisedDirectChat), carrying latestEventIndex 0 and
        // no latestMessage. There is no event 0 to fetch: asking the user canister for one
        // returns ChatNotFound, which was filing a previous_load_failed report for every new
        // conversation anyone started.
        if (
            serverChat.kind === "direct_chat" &&
            serverChat.latestEventIndex === 0 &&
            serverChat.latestMessage === undefined
        ) {
            return undefined;
        }

        const minLoadedEventIndex = this.#earliestLoadedIndex(serverChat.id);
        if (minLoadedEventIndex === undefined) {
            return [serverChat.latestEventIndex, false];
        }
        const minVisibleEventIndex = this.earliestAvailableEventIndex(serverChat);
        return minLoadedEventIndex !== undefined && minLoadedEventIndex > minVisibleEventIndex
            ? [minLoadedEventIndex - 1, false]
            : undefined;
    }

    earliestAvailableEventIndex(chat: ChatSummary): number {
        return chat.kind === "direct_chat" ? 0 : chat.minVisibleEventIndex;
    }

    #earliestLoadedIndex(chatId: ChatIdentifier): number | undefined {
        const confirmedLoaded = eventIndexesLoaded(chatId);
        return confirmedLoaded.length > 0 ? confirmedLoaded.index(0) : undefined;
    }

    async loadNewMessages(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): Promise<void> {
        const serverChat = allServerChatsStore.value.get(chatId);

        if (serverChat === undefined || this.#isPrivatePreview(serverChat)) {
            return Promise.resolve();
        }

        if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
            const thread = threadRootEvent.event.thread;
            const [index, ascending] = this.#newThreadMessageCriteria(thread);
            return this.loadThreadMessages(
                chatId,
                [0, thread.latestEventIndex],
                index,
                ascending,
                threadRootEvent.event.messageIndex,
                false,
            );
        }

        const criteria = this.#newMessageCriteria(serverChat);
        if (criteria === undefined) {
            return;
        }

        const visit = selectedChatFor(chatId);
        const eventsResponse = await this.#loadEvents(visit, serverChat, criteria[0], criteria[1]);

        if (isSuccessfulEventsResponse(eventsResponse)) {
            this.#fillLoadedEventGaps(visit, serverChat, eventsResponse, criteria[0], criteria[1]);
            publish("loadedNewMessages", {
                chatId,
                threadRootMessageIndex: threadRootEvent?.event.messageIndex,
            });
        }
    }

    morePreviousMessagesAvailable(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): boolean {
        if (threadRootEvent !== undefined) {
            if (this.#firstThreadReplyInFlight(chatId, threadRootEvent)) return false;
            const earliestIndex = this.earliestLoadedThreadIndex();
            return earliestIndex === undefined || earliestIndex > 0;
        }

        const chat = chatSummariesStore.value.get(chatId);

        return (
            chat !== undefined &&
            chat.latestEventIndex >= 0 &&
            (this.#earliestLoadedIndex(chatId) ?? Number.MAX_VALUE) >
                this.earliestAvailableEventIndex(chat)
        );
    }

    moreNewMessagesAvailable(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): boolean {
        if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
            return (
                (this.#confirmedThreadUpToEventIndex() ?? -1) <
                threadRootEvent.event.thread.latestEventIndex
            );
        }
        const serverChat = allServerChatsStore.value.get(chatId);
        return (
            serverChat !== undefined &&
            (this.#confirmedUpToEventIndex(serverChat.id) ?? -1) < serverChat.latestEventIndex
        );
    }

    async #loadCommunityDetails(community: CommunitySummary): Promise<void> {
        const id = community.id;
        const held = selectedServerCommunityStore.value;
        const detailsSyncedUpTo =
            held !== undefined && communityIdentifiersEqual(held.communityId, id)
                ? held.timestamp
                : undefined;
        const lastUpdated = detailsLastUpdated(community);
        if (detailsSyncedUpTo !== undefined && detailsSyncedUpTo >= lastUpdated) {
            // The details held are already up to date
            return;
        }
        // If the details are already held the worker only says whether they have changed, rather
        // than sending every member across to be rebuilt into the stores
        const resp: CommunityDetailsResponse = await this.#worker
            .send({
                kind: "getCommunityDetails",
                id,
                detailsLastUpdated: lastUpdated,
                detailsSyncedUpTo,
            })
            .catch(() => ({ kind: "failure" }));
        if (resp.kind !== "failure") {
            if (!communityIdentifiersEqual(community.id, selectedCommunityIdStore.value)) {
                console.warn(
                    "Attempting to set community details on the wrong community - probably a stale response",
                    community.id,
                    selectedCommunityIdStore.value,
                );
                return;
            }
            const currentStoreValue = selectedServerCommunityStore.value;
            if (
                currentStoreValue !== undefined &&
                communityIdentifiersEqual(currentStoreValue.communityId, community.id) &&
                resp.lastUpdated <= currentStoreValue.timestamp
            ) {
                // The store already has the latest updates, exiting
                return;
            }

            if (resp.kind === "success_no_updates") {
                // Nothing reads the timestamp reactively, so it is set without the store telling
                // its subscribers, which would have everything showing a member work out again
                if (
                    currentStoreValue !== undefined &&
                    communityIdentifiersEqual(currentStoreValue.communityId, community.id)
                ) {
                    currentStoreValue.timestamp = resp.lastUpdated;
                }
            } else {
                const [lapsed, members] = partition(resp.members, (m) => m.lapsed);

                this.#forgetNotMembers(this.#communityMemberLookups, community.id.communityId);
                selectedServerCommunityStore.set(
                    new CommunityDetailsState(
                        community.id,
                        resp.lastUpdated,
                        resp.userGroups,
                        new Map(members.map((m) => [m.userId, m])),
                        resp.blockedUsers,
                        new Set(lapsed.map((m) => m.userId)),
                        resp.invitedUsers,
                        resp.referrals,
                        resp.bots.reduce((all, b) => all.set(b.id, b.permissions), new Map()),
                        resp.rules,
                        resp.moreMembersAfter,
                    ),
                );
                this.#updateUserStoreFromCommunityState();
            }
        }
    }

    // `visit` is the selection the details are loaded for: they go nowhere once it has gone
    async #loadChatDetails(
        visit: SelectedChat | undefined,
        serverChat: ChatSummary,
    ): Promise<void> {
        if (get(offlineStore) || visit === undefined) {
            return;
        }
        switch (serverChat.kind) {
            case "group_chat":
            case "channel":
                const held = selectedServerChatStore.value;
                const detailsSyncedUpTo =
                    held !== undefined && chatIdentifiersEqual(held.chatId, serverChat.id)
                        ? held.timestamp
                        : undefined;
                const lastUpdated = detailsLastUpdated(serverChat);
                if (detailsSyncedUpTo !== undefined && detailsSyncedUpTo >= lastUpdated) {
                    // The details held are already up to date
                    return;
                }
                // As for the community's details, if these are already held the worker only says
                // whether they have changed
                const resp: GroupChatDetailsResponse = await this.#worker
                    .send({
                        kind: "getGroupDetails",
                        chatId: serverChat.id,
                        detailsLastUpdated: lastUpdated,
                        detailsSyncedUpTo,
                    })
                    .catch(CommonResponses.failure);
                if ("members" in resp || resp.kind === "success_no_updates") {
                    if (!visit.current) {
                        console.warn(
                            "Attempting to set chat details on the wrong chat - probably a stale response",
                            serverChat.id,
                            selectedChatIdStore.value,
                        );
                        return;
                    }
                    const currentStoreValue = selectedServerChatStore.value;
                    if (
                        currentStoreValue !== undefined &&
                        chatIdentifiersEqual(currentStoreValue.chatId, serverChat.id) &&
                        resp.timestamp <= currentStoreValue.timestamp
                    ) {
                        // The store already has the latest updates, exiting
                        return;
                    }
                    if (!("members" in resp)) {
                        // Set without the store telling its subscribers, as for the community
                        if (
                            currentStoreValue !== undefined &&
                            chatIdentifiersEqual(currentStoreValue.chatId, serverChat.id)
                        ) {
                            currentStoreValue.timestamp = resp.timestamp;
                        }
                        return;
                    }
                    const members = resp.members.filter((m) => !m.lapsed);
                    const lapsed = new Set(
                        resp.members.filter((m) => m.lapsed).map((m) => m.userId),
                    );
                    const webhooksToAdd = resp.webhooks.filter(
                        (w) => !webhookUserIdsStore.value.has(w.id),
                    );
                    if (webhooksToAdd.length > 0) {
                        webhookUserIdsStore.update((set) => {
                            for (const webhook of webhooksToAdd) {
                                set.add(webhook.id);
                            }
                            return set;
                        });
                    }

                    this.#forgetNotMembers(
                        this.#chatMemberLookups,
                        chatIdentifierToString(serverChat.id),
                    );
                    visit.setDetails(
                        new ChatDetailsState(
                            serverChat.id,
                            resp.timestamp,
                            new Map(members.map((m) => [m.userId, m])),
                            lapsed,
                            resp.blockedUsers,
                            resp.invitedUsers,
                            resp.pinnedMessages,
                            resp.bots.reduce((all, b) => all.set(b.id, b.permissions), new Map()),
                            new Map(resp.webhooks.map((w) => [w.id, w])),
                            resp.rules,
                            resp.moreMembersAfter,
                        ),
                    );
                    // Not awaited, since a forwarded message may be waiting for the details
                    void this.#updateUserStoreFromEvents(visit, serverChat.id, []);
                }
                break;
            case "direct_chat":
                visit.setDetails(undefined);
                break;
        }
    }

    achievementLogo(id: number): string {
        return `${this.config.canisterUrlPath.replace(
            "{canisterId}",
            this.config.userIndexCanister,
        )}/achievement_logo/${id}`;
    }

    webhookUrl(
        webhook: { id: string; secret?: string },
        chatId: MultiUserChatIdentifier,
    ): string | undefined {
        if (webhook.secret === undefined) {
            return undefined;
        }

        const canisterId = chatId.kind === "channel" ? chatId.communityId : chatId.groupId;
        const channelPart = chatId.kind === "channel" ? `/channel/${chatId.channelId}` : "";

        return (
            this.config.canisterUrlPath.replace("{canisterId}", canisterId) +
            `${channelPart}/webhook/${webhook.id}/${webhook.secret}`
        );
    }

    // this is unavoidably duplicated from the agent
    #rehydrateDataContent<T extends DataContent>(
        dataContent: T,
        blobType: "blobs" | "avatar" = "blobs",
    ): T {
        const ref = dataContent.blobReference;
        return ref !== undefined
            ? {
                  ...dataContent,
                  blobData: undefined,
                  blobUrl: buildBlobUrl(
                      this.config.blobUrlPattern,
                      ref.canisterId,
                      ref.blobId,
                      blobType,
                  ),
              }
            : dataContent;
    }

    async #refreshUpdatedEvents(
        serverChat: ChatSummary,
        updatedEvents: UpdatedEvent[],
    ): Promise<void> {
        const confirmedLoaded = eventIndexesLoaded(serverChat.id);
        const confirmedThreadLoaded = threadEventIndexesLoadedStore.value;
        const chatId = serverChat.id;
        const selectedThreadRootMessageIndex = selectedThreadIdStore.value?.threadRootMessageIndex;
        const chatVisit = selectedChatFor(chatId);
        const threadVisit =
            selectedThreadRootMessageIndex === undefined
                ? undefined
                : selectedThreadFor({
                      chatId,
                      threadRootMessageIndex: selectedThreadRootMessageIndex,
                  });

        // Partition the updated events into those that belong to the currently selected thread and those that don't
        const [currentChatEvents, currentThreadEvents] = updatedEvents.reduce(
            ([chat, thread], e) => {
                if (e.threadRootMessageIndex !== undefined) {
                    if (
                        e.threadRootMessageIndex === selectedThreadRootMessageIndex &&
                        chatIdentifiersEqual(chatId, selectedChatIdStore.value) &&
                        indexIsInRanges(e.eventIndex, confirmedThreadLoaded)
                    ) {
                        thread.push(e.eventIndex);
                    }
                } else {
                    if (indexIsInRanges(e.eventIndex, confirmedLoaded)) {
                        chat.push(e.eventIndex);
                    }
                }
                return [chat, thread];
            },
            [[], []] as [number[], number[]],
        );

        const eventStreams: [boolean, Stream<EventsResponse<ChatEvent>>][] = [];

        if (currentChatEvents.length > 0) {
            const stream = this.#worker.stream({
                kind: "chatEventsByEventIndex",
                chatId,
                eventIndexes: currentChatEvents,
                threadRootMessageIndex: undefined,
                latestKnownUpdate: serverChat.lastUpdated,
            });
            eventStreams.push([false, stream]);
        }

        if (currentThreadEvents.length > 0) {
            const stream = this.#worker.stream({
                kind: "chatEventsByEventIndex",
                chatId,
                eventIndexes: currentThreadEvents,
                threadRootMessageIndex: selectedThreadRootMessageIndex,
                latestKnownUpdate: serverChat.lastUpdated,
            });
            eventStreams.push([true, stream]);
        }

        const promises = eventStreams.map(([isThread, stream]) => {
            stream
                .aggregate(mergeEventStreamResponses, emptyEventsResponse())
                .toPromise()
                .then((resp) => {
                    if (!isThread && isSuccessfulEventsResponse(resp)) {
                        resp.events.forEach((e) => {
                            if (
                                e.event.kind === "message" &&
                                e.event.content.kind === "video_call_content"
                            ) {
                                publish("videoCallMessageUpdated", {
                                    chatId,
                                    messageId: e.event.messageId,
                                });
                            }
                        });
                    }
                    return this.#handleEventsResponse(
                        isThread ? threadVisit : chatVisit,
                        serverChat,
                        isThread ? selectedThreadRootMessageIndex : undefined,
                        resp,
                    );
                })
                .catch(CommonResponses.failure);
        });

        await Promise.all(promises);
        return;
    }

    #newThreadMessageCriteria(thread: ThreadSummary): [number, boolean] {
        const loadedUpTo = this.#confirmedThreadUpToEventIndex();

        if (loadedUpTo === undefined) {
            return [thread.latestEventIndex, false];
        }

        return [loadedUpTo + 1, true];
    }

    #newMessageCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
        if (serverChat.latestEventIndex < 0) {
            return undefined;
        }

        const loadedUpTo = this.#confirmedUpToEventIndex(serverChat.id);

        if (loadedUpTo === undefined) {
            return [serverChat.latestEventIndex, false];
        }

        return loadedUpTo < serverChat.latestEventIndex ? [loadedUpTo + 1, true] : undefined;
    }

    #confirmedUpToEventIndex(chatId: ChatIdentifier): number | undefined {
        const ranges = confirmedEventIndexesLoaded(chatId).subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return undefined;
    }

    #confirmedThreadUpToEventIndex(): number | undefined {
        const ranges = confirmedThreadEventIndexesLoadedStore.value.subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return undefined;
    }

    messageIsReadByThem(chatId: ChatIdentifier, messageIndex: number): boolean {
        const chat = chatSummariesStore.value.get(chatId);
        return chat !== undefined && messageIsReadByThem(chat, messageIndex);
    }

    unpinMessage(chatId: MultiUserChatIdentifier, messageIndex: number): Promise<boolean> {
        const undo = localUpdates.unpinMessage(chatId, messageIndex);
        return this.#worker
            .send({ kind: "unpinMessage", chatId, messageIndex })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                return true;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    pinMessage(chatId: MultiUserChatIdentifier, messageIndex: number): Promise<boolean> {
        const undo = localUpdates.pinMessage(chatId, messageIndex);
        return this.#worker
            .send({
                kind: "pinMessage",
                chatId,
                messageIndex,
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                if (resp.kind === "success") {
                    this.markPinnedMessagesRead(chatId, resp.timestamp);
                }
                return true;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    #removeMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        userId: string,
        threadRootMessageIndex: number | undefined,
    ): void {
        if (userId === currentUserIdStore.value) {
            const userIds = selectedChatUserIdsStore.value;
            rtcConnectionsManager.sendMessage([...userIds], {
                kind: "remote_user_removed_message",
                id: chatId,
                messageId: messageId,
                userId: userId,
                threadRootMessageIndex,
            });
        }
        const context = { chatId, threadRootMessageIndex };
        localUpdates.deleteUnconfirmed(context, messageId);
        messagesRead.removeUnconfirmedMessage(context, messageId);
    }
    groupWhile = groupWhile;
    sameUser = sameUser;

    forwardMessage(messageContext: MessageContext, msg: Message): void {
        this.sendMessageWithContent(
            messageContext,
            { ...msg.content },
            msg.blockLevelMarkdown,
            [],
            true,
            undefined,
            msg.ogPreviews.length > 0 ? Promise.resolve(msg.ogPreviews) : undefined,
        );
    }

    // `visit` is the selection the store writes are for. The other effects of the events (on
    // failed, unconfirmed and in-flight messages, unread counts and the chat summary) happen
    // whether or not it is still selected.
    #addServerEventsToStores(
        visit: EventsVisit | undefined,
        chatId: ChatIdentifier,
        newEvents: EventWrapper<ChatEvent>[],
        threadRootMessageIndex: number | undefined,
        expiredEventRanges: ExpiredEventsRange[],
    ): void {
        if (newEvents.length === 0 && expiredEventRanges.length === 0) {
            return;
        }

        let contextUpdated: MessageContext | undefined = undefined;

        withPausedStores(() => {
            const context = { chatId, threadRootMessageIndex };
            const myUserId = currentUserIdStore.value;
            const bridgedUsers = bridgedUsersStore.value;
            const now = BigInt(Date.now());
            const recentlyActiveCutOff = now - BigInt(12 * ONE_HOUR);

            // To ensure we keep the chat summary up to date, if these events are in the main event list, check if there is
            // now a new latest message and if so, mark it as a local chat summary update.
            let latestMessageIndex =
                threadRootMessageIndex === undefined
                    ? (allServerChatsStore.value.get(chatId)?.latestMessageIndex ?? -1)
                    : undefined;
            let newLatestMessage: EventWrapper<Message> | undefined = undefined;

            const anyFailedMessages = localUpdates.anyFailed(context);

            for (const event of newEvents) {
                if (event.event.kind === "message") {
                    const { content, messageIndex, messageId } = event.event;
                    if (anyFailedMessages && localUpdates.deleteFailedMessage(context, messageId)) {
                        this.#worker.send({
                            kind: "deleteFailedMessage",
                            chatId,
                            messageId,
                            threadRootMessageIndex,
                        });
                    }
                    const inflightMessagePromise = this.#inflightMessagePromises.get(messageId);
                    if (inflightMessagePromise !== undefined) {
                        // If we reach here, then a message is currently being sent but the update call is yet to complete.
                        // So given that we have received the message from the backend we know that the message has
                        // successfully been sent, so we resolve the promise early.
                        this.#inflightMessagePromises.delete(messageId);

                        let result: SendMessageSuccess | TransferSuccess = {
                            kind: "success",
                            timestamp: event.timestamp,
                            messageIndex: event.event.messageIndex,
                            eventIndex: event.index,
                            expiresAt: event.expiresAt,
                        };
                        if (content.kind === "crypto_content") {
                            result = {
                                ...result,
                                kind: "transfer_success",
                                transfer: content.transfer as CompletedCryptocurrencyTransfer,
                            };
                        }
                        inflightMessagePromise(result);
                    }
                    if (localUpdates.deleteUnconfirmed(context, messageId)) {
                        messagesRead.confirmMessage(context, messageIndex, messageId);
                    }
                    this.#markReadIfOwn(context, event.event, myUserId, bridgedUsers);
                    if (latestMessageIndex !== undefined && messageIndex > latestMessageIndex) {
                        newLatestMessage = event as EventWrapper<Message>;
                        latestMessageIndex = messageIndex;
                    }
                }
                if (event.timestamp > recentlyActiveCutOff) {
                    const userId = activeUserIdFromEvent(event.event);
                    if (userId !== undefined && userId !== myUserId) {
                        this.#recentlyActiveUsersTracker.track(userId, event.timestamp);
                    }
                }
            }

            if (threadRootMessageIndex === undefined) {
                if (newLatestMessage !== undefined) {
                    localUpdates.updateLatestMessage(chatId, newLatestMessage);
                }

                if (isContiguous(chatId, newEvents, expiredEventRanges)) {
                    visit?.chat?.updateEvents((events) =>
                        mergeServerEvents(events, newEvents, context),
                    );

                    const selectedThreadRootMessageIndex =
                        selectedThreadIdStore.value?.threadRootMessageIndex;
                    if (selectedThreadRootMessageIndex !== undefined) {
                        const threadRootEvent = newEvents.find(
                            (e) =>
                                e.event.kind === "message" &&
                                e.event.messageIndex === selectedThreadRootMessageIndex,
                        );
                        if (threadRootEvent !== undefined) {
                            contextUpdated = {
                                chatId,
                                threadRootMessageIndex: selectedThreadRootMessageIndex,
                            };
                        }
                    }
                } else if (serverEventsStore.value.length === 0 && visit?.chat?.current) {
                    // Dropping new events while scrolled up is routine; dropping them into an
                    // empty store means the expired ranges are stale and the chat stays empty
                    const loaded = eventIndexesLoaded(chatId);
                    this.#reportEmptyChat("non_contiguous_dropped", {
                        chatId: chatIdentifierToString(chatId),
                        newFrom: newEvents[0]?.index,
                        newTo: newEvents[newEvents.length - 1]?.index,
                        loadedFrom: loaded.length > 0 ? loaded.index(0) : undefined,
                        loadedTo: loaded.length > 0 ? loaded.index(loaded.length - 1) : undefined,
                    });
                }
            } else if (isContiguousInThread({ chatId, threadRootMessageIndex }, newEvents)) {
                if (visit instanceof SelectedThread) {
                    visit.updateEvents((events) => mergeServerEvents(events, newEvents, context));
                }
            }

            if (expiredEventRanges.length > 0) {
                visit?.chat?.updateExpiredEventRanges((ranges) => {
                    const merged = new DRange();
                    merged.add(ranges);
                    expiredEventRanges.forEach((r) => merged.add(r.start, r.end));
                    return merged;
                });
            }
        });

        if (contextUpdated !== undefined) {
            publish("chatUpdated", contextUpdated);
        }
    }

    deleteFailedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        localUpdates.deleteFailedMessage({ chatId, threadRootMessageIndex }, messageId);
        return this.#worker.send({
            kind: "deleteFailedMessage",
            chatId,
            messageId,
            threadRootMessageIndex,
        });
    }

    async #sendMessageCommon(
        chat: ChatSummary,
        messageContext: MessageContext,
        message: NewUnconfirmedMessage,
        mentioned: User[] = [],
        retrying: boolean,
        ogPreviewsPromise?: Promise<OgPreview[]>,
        hooks?: SendHooks,
    ): Promise<SendMessageResponse> {
        const { chatId, threadRootMessageIndex } = messageContext;

        // A forwarded message is sent as soon as the chat it's forwarded to opens, before the
        // details of that chat and its community, which hold their rules, have loaded. So it waits
        // for them, to ask the user to accept those rules rather than have the message rejected.
        if (message.forwarded) {
            await Promise.allSettled(this.#selectedDetailsLoading(chatId));
        }

        let acceptedRules: AcceptedRules | undefined = undefined;
        if (this.#rulesNeedAccepting(chatId)) {
            acceptedRules = await this.#promptForRuleAcceptance();
            if (acceptedRules === undefined) {
                hooks?.rulesDeclined();
                return CommonResponses.failure();
            }
        }

        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value && isTransfer(message.content)) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        if (this.#throttleSendMessage()) {
            return Promise.resolve({ kind: "message_throttled" });
        }

        const messageEvent = createMessage(messageContext, message);

        // The agent fills in the previews of the OpenChat messages a message links to only for the
        // messages it loads, so they're looked up here for a message being sent. They're only shown,
        // never sent, so the send doesn't wait for them.
        const messagePreviewsPromise =
            linkedMessageUrls(messageEvent.event.content).length > 0
                ? this.#loadMessagePreviews(chat, messageContext, messageEvent)
                : undefined;

        if (!retrying) {
            this.#postSendMessage(chat, messageEvent, threadRootMessageIndex);
            hooks?.posted();
        } else {
            // remove the *original* event from the failed store
            await this.deleteFailedMessage(chatId, message.messageId, threadRootMessageIndex);

            // add the *new* event to unconfirmed
            localUpdates.addUnconfirmed(messageContext, messageEvent);
        }

        // Fetch og previews lazily so the message appears in the UI immediately.
        // We await here (after pushing to localUpdates) so the worker call still
        // sends og_previews to the backend in the same request.
        if (ogPreviewsPromise !== undefined) {
            const ogPreviews = await ogPreviewsPromise;
            if (ogPreviews.length > 0) {
                messageEvent.event.ogPreviews = ogPreviews;
                localUpdates.setUnconfirmedPreviews(messageContext, messageEvent.event.messageId, {
                    ogPreviews,
                });
            }
        }

        const canRetry = canRetryMessage(message.content);

        const messageFilterFailed = doesMessageFailFilter(
            message.content,
            messageFiltersStore.value,
        );

        const messageId = message.messageId;
        const newAchievement = this.#isNewSendMessageAchievement(
            messageContext,
            messageEvent.event,
        );
        const ledger = this.#extractLedgerFromContent(message.content);

        const messageRecipients = rtcMessageRecipients(chat.id);

        const sendMessagePromise: Promise<SendMessageResponse> = new Promise((resolve) => {
            this.#inflightMessagePromises.set(messageId, resolve);
            this.#worker
                .stream({
                    kind: "sendMessage",
                    chatType: chat.kind,
                    messageContext,
                    user: currentUserStore.value,
                    mentioned,
                    event: messageEvent,
                    acceptedRules,
                    messageFilterFailed,
                    pin,
                    newAchievement,
                })
                .subscribe({
                    onResult: (response) => {
                        if (response === "accepted") {
                            localUpdates.markUnconfirmedAccepted(messageContext, messageId);

                            if (!isTransfer(message.content)) {
                                rtcConnectionsManager.sendMessage(messageRecipients, {
                                    kind: "remote_user_sent_message",
                                    id: chat.id,
                                    message: serialiseMessageForRtc(message),
                                    userId: currentUserIdStore.value,
                                    threadRootMessageIndex,
                                });
                            }
                            return;
                        }
                        this.#inflightMessagePromises.delete(messageId);
                        const [resp, msg] = response;
                        if (resp.kind === "success" || resp.kind === "transfer_success") {
                            const event = mergeSendMessageResponse(msg, resp);
                            const visit = eventsVisitFor(chat.id, threadRootMessageIndex);
                            this.#addServerEventsToStores(
                                visit,
                                chat.id,
                                [event],
                                threadRootMessageIndex,
                                [],
                            );
                            if (messagePreviewsPromise !== undefined) {
                                void this.#addConfirmedMessagePreviews(
                                    visit,
                                    event.index,
                                    messagePreviewsPromise,
                                );
                            }
                        } else if (resp.kind === "error") {
                            const pinNumberFailure = pinNumberFailureFromError(resp);
                            if (pinNumberFailure !== undefined) {
                                pinNumberFailureStore.set(pinNumberFailure);
                            } else if (resp.code === ErrorCode.ChatRulesNotAccepted) {
                                localUpdates.updateChatRulesAccepted(chat.id, false);
                            } else if (resp.code === ErrorCode.CommunityRulesNotAccepted) {
                                this.#markCommunityRulesAcceptedLocally(false);
                            }

                            this.#onSendMessageFailure(
                                chatId,
                                msg.messageId,
                                threadRootMessageIndex,
                                messageEvent,
                                canRetry,
                                resp,
                            );
                        }

                        resolve(resp);
                    },
                    onError: () => {
                        this.#inflightMessagePromises.delete(messageId);
                        this.#onSendMessageFailure(
                            chatId,
                            messageId,
                            threadRootMessageIndex,
                            messageEvent,
                            canRetry,
                            undefined,
                        );

                        return resolve(CommonResponses.failure());
                    },
                });
        });

        // `sendMessagePromise` is resolved either when the update call which initially sent the message completes, or
        // if the message is found when reading new events
        return sendMessagePromise.then((resp) => {
            if (resp.kind === "success" || resp.kind === "transfer_success") {
                if (ledger !== undefined) {
                    lastCryptoSent.set(ledger);
                    this.refreshAccountBalance(ledger);
                }
                if (threadRootMessageIndex !== undefined) {
                    trackEvent("sent_threaded_message");
                } else {
                    if (chat.kind === "direct_chat") {
                        trackEvent("sent_direct_message");
                    } else {
                        if (chat.public) {
                            trackEvent("sent_public_group_message");
                        } else {
                            trackEvent("sent_private_group_message");
                        }
                    }
                }
                if (messageEvent.event.repliesTo !== undefined) {
                    // double counting here which I think is OK since we are limited to string events
                    trackEvent("replied_to_message");
                }

                if (acceptedRules?.chat !== undefined) {
                    localUpdates.updateChatRulesAccepted(chat.id, true);
                }
                if (acceptedRules?.community !== undefined) {
                    this.#markCommunityRulesAcceptedLocally(true);
                }
            }
            return resp;
        });
    }

    // The previews of the OpenChat messages that a message links to, which the agent otherwise fills
    // in only for the messages it loads. Undefined if they couldn't be looked up.
    async #lookUpMessagePreviews(
        chat: ChatSummary,
        threadRootMessageIndex: number | undefined,
        event: EventWrapper<Message>,
    ): Promise<RehydratedMessagePreview[] | undefined> {
        try {
            const rehydrated = await this.#worker.send({
                kind: "rehydrateMessage",
                chatId: chat.id,
                // without the previews it has, which would come back unchanged if none were found
                message: { ...event, event: { ...event.event, messagePreviews: [] } },
                threadRootMessageIndex,
                latestKnownUpdate: chat.lastUpdated,
            });
            return rehydrated.event.messagePreviews;
        } catch (err) {
            console.warn("Unable to load the messages a message links to", err);
            return undefined;
        }
    }

    // Looks up the previews of the OpenChat messages that a message being sent links to, and shows
    // them on it while it's unconfirmed
    async #loadMessagePreviews(
        chat: ChatSummary,
        messageContext: MessageContext,
        messageEvent: EventWrapper<Message>,
    ): Promise<RehydratedMessagePreview[]> {
        const messagePreviews =
            (await this.#lookUpMessagePreviews(
                chat,
                messageContext.threadRootMessageIndex,
                messageEvent,
            )) ?? [];
        if (messagePreviews.length > 0) {
            localUpdates.setUnconfirmedPreviews(messageContext, messageEvent.event.messageId, {
                messagePreviews,
            });
        }
        return messagePreviews;
    }

    // The confirmed message is made from the one the worker was given, which has no message
    // previews, so they're added to it once both are in, whichever comes first
    async #addConfirmedMessagePreviews(
        visit: EventsVisit | undefined,
        eventIndex: number,
        messagePreviewsPromise: Promise<RehydratedMessagePreview[]>,
    ): Promise<void> {
        const messagePreviews = await messagePreviewsPromise;
        if (messagePreviews.length === 0) return;
        visit?.updateEvents((events) =>
            events.map((e) =>
                e.index === eventIndex && e.event.kind === "message"
                    ? { ...e, event: { ...e.event, messagePreviews } }
                    : e,
            ),
        );
    }

    // An edit can change which messages a message links to, and so its message previews: those of
    // the messages it still links to stay, the rest go, and any it now links to are looked up
    #refreshEditedMessagePreviews(
        chat: ChatSummary,
        messageContext: MessageContext,
        editingEvent: EventWrapper<Message>,
        edited: Message,
    ): UndoLocalUpdate {
        const urls = linkedMessageUrls(edited.content);
        if (sameUrls(urls, linkedMessageUrls(editingEvent.event.content))) {
            return () => {};
        }
        const kept = editingEvent.event.messagePreviews.filter((p) => urls.includes(p.url));
        const refresh = { undo: localUpdates.setEditedMessagePreviews(edited.messageId, kept) };
        if (kept.length < urls.length) {
            void this.#lookUpEditedMessagePreviews(
                chat,
                messageContext,
                editingEvent,
                edited,
                refresh,
            );
        }
        return () => refresh.undo();
    }

    async #lookUpEditedMessagePreviews(
        chat: ChatSummary,
        messageContext: MessageContext,
        editingEvent: EventWrapper<Message>,
        edited: Message,
        refresh: { undo: UndoLocalUpdate },
    ): Promise<void> {
        const messagePreviews = await this.#lookUpMessagePreviews(
            chat,
            messageContext.threadRootMessageIndex,
            { ...editingEvent, event: edited },
        );
        // Not if the edit has since been refused, or edited again to link to other messages
        const current = localUpdates.editedContent(edited.messageId);
        if (
            messagePreviews !== undefined &&
            current !== undefined &&
            sameUrls(linkedMessageUrls(current), linkedMessageUrls(edited.content))
        ) {
            refresh.undo = localUpdates.setEditedMessagePreviews(edited.messageId, messagePreviews);
        }
    }

    #extractLedgerFromContent(content: MessageContent): string | undefined {
        switch (content.kind) {
            case "crypto_content":
            case "prize_content_initial":
                return content.transfer.ledger;

            case "prize_content":
                return content.ledger;

            case "p2p_swap_content":
            case "p2p_swap_content_initial":
                return content.token0.ledger;

            default:
                return undefined;
        }
    }

    #isNewSendMessageAchievement(message_context: MessageContext, message: Message): boolean {
        let achievement: Achievement | undefined = undefined;

        switch (message.content.kind) {
            case "audio_content":
                achievement = "sent_audio";
                break;
            case "crypto_content":
                achievement = "sent_crypto";
                break;
            case "file_content":
                achievement = "sent_file";
                break;
            case "giphy_content":
                achievement = "sent_giphy";
                break;
            case "image_content":
                achievement = "sent_image";
                break;
            case "meme_fighter_content":
                achievement = "sent_meme";
                break;
            case "p2p_swap_content_initial":
                achievement = "sent_swap_offer";
                break;
            case "poll_content":
                achievement = "sent_poll";
                break;
            case "prize_content_initial":
                achievement = "sent_prize";
                break;
            case "text_content":
                achievement = "sent_text";
                break;
            case "video_call_content":
                achievement = "started_call";
                break;
            case "video_content":
                achievement = "sent_video";
                break;
        }

        const achievements: Achievement[] = [];

        if (achievement !== undefined) {
            achievements.push(achievement);
        }

        if (message_context.chatId.kind === "direct_chat") {
            achievements.push("sent_direct_message");
        }

        if (message.forwarded) {
            achievements.push("forwarded_message");
        }

        if (message.repliesTo !== undefined) {
            achievements.push("quote_replied");
        } else if (
            message_context.threadRootMessageIndex !== undefined &&
            message.messageIndex == 0
        ) {
            achievements.push("replied_in_thread");
        }

        for (const a of achievements.values()) {
            if (!achievementsStore.value.has(a as Achievement)) {
                return true;
            }
        }

        return false;
    }

    // Those loads of the selected chat's and community's details which are for the given chat and
    // haven't yet put its details in the stores
    #selectedDetailsLoading(chatId: ChatIdentifier): Promise<void>[] {
        const loading: Promise<void>[] = [];
        const chatLoad = this.#chatDetailsLoad;
        if (
            chatId.kind !== "direct_chat" &&
            chatLoad !== undefined &&
            chatIdentifiersEqual(chatLoad.chatId, chatId) &&
            !chatIdentifiersEqual(selectedServerChatStore.value?.chatId, chatId)
        ) {
            loading.push(chatLoad.loaded);
        }
        const communityLoad = this.#communityDetailsLoad;
        if (
            chatId.kind === "channel" &&
            communityLoad?.communityId.communityId === chatId.communityId &&
            selectedServerCommunityStore.value?.communityId.communityId !== chatId.communityId
        ) {
            loading.push(communityLoad.loaded);
        }
        return loading;
    }

    #rulesNeedAccepting(chatId: ChatIdentifier): boolean {
        // The chat's rules aren't known until its details load, but its community's may be (when
        // the chat is in the community already selected), so each is checked on its own
        const chatRules = selectedChatRulesStore.value;
        const chat = selectedChatSummaryStore.value;
        // The rules known are the selected chat's, which may no longer be the chat sent to
        if (chat === undefined || !chatIdentifiersEqual(chat.id, chatId)) {
            return false;
        }

        const communityRules = selectedCommunityRulesStore.value;
        const community = selectedCommunitySummaryStore.value;

        console.debug(
            "RULES: rulesNeedAccepting",
            chatRules?.enabled,
            chat.membership?.rulesAccepted,
            communityRules?.enabled,
            community?.membership?.rulesAccepted,
        );

        return (
            ((chatRules?.enabled ?? false) && !(chat.membership?.rulesAccepted ?? false)) ||
            ((communityRules?.enabled ?? false) && !(community?.membership?.rulesAccepted ?? false))
        );
    }

    combineRulesText(
        chatRules: VersionedRules | undefined,
        communityRules: VersionedRules | undefined,
    ): string {
        const chatRulesEnabled = chatRules?.enabled ?? false;
        const communityRulesEnabled = communityRules?.enabled ?? false;
        const chatRulesText = chatRulesEnabled ? chatRules?.text : "";
        const communityRulesText = communityRulesEnabled ? communityRules?.text : "";
        const lineBreak = chatRulesEnabled && communityRulesEnabled ? "\n" : "";
        return chatRulesText + lineBreak + communityRulesText;
    }

    #markCommunityRulesAcceptedLocally(rulesAccepted: boolean) {
        const selectedCommunityId = selectedCommunitySummaryStore.value?.id;
        if (selectedCommunityId !== undefined) {
            localUpdates.updateCommunityRulesAccepted(selectedCommunityId, rulesAccepted);
        }
    }

    eventExpiry(chat: ChatSummary, timestamp: number): number | undefined {
        if (chat.eventsTTL !== undefined) {
            return timestamp + Number(chat.eventsTTL);
        }
        return undefined;
    }

    async sendMessageWithContent(
        messageContext: MessageContext,
        content: MessageContent,
        blockLevelMarkdown: boolean,
        mentioned: User[] = [],
        forwarded: boolean = false,
        messageIdIfRetrying?: bigint,
        ogPreviewsPromise?: Promise<OgPreview[]>,
        hooks?: SendHooks,
    ): Promise<SendMessageResponse> {
        const { chatId, threadRootMessageIndex } = messageContext;
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined) {
            return Promise.resolve(CommonResponses.failure());
        }

        // A forwarded message isn't the chat's draft, which is left for the user to carry on with
        const draftMessage = forwarded
            ? undefined
            : localUpdates.draftMessages.value.get(messageContext);
        const timestamp = Date.now();
        const msg = {
            timestamp: BigInt(timestamp),
            expiresAt: threadRootMessageIndex ? undefined : this.eventExpiry(chat, timestamp),
            messageId: messageIdIfRetrying ?? random64(),
            sender: currentUserIdStore.value,
            content,
            repliesTo: draftMessage?.replyingTo,
            forwarded,
            blockLevelMarkdown,
            ogPreviews: [], // This will get filled in later
        };

        return this.#sendMessageCommon(
            chat,
            messageContext,
            msg,
            mentioned,
            messageIdIfRetrying !== undefined,
            ogPreviewsPromise,
            hooks,
        );
    }

    // the chats and threads with a send from the composer not yet posted or refused
    #sendsBeingPosted = new Set<string>();

    /**
     * Sends what the composer holds (its text, and an attachment it captions) and settles as soon as
     * the message shows in the chat, or is refused before that: the rules turned down, the PIN
     * prompt dismissed, the user throttled. A second send from the same chat or thread while one is
     * on its way is `busy`. Never rejects. Those mentioned as @username in the text are mentioned,
     * along with those picked from the mention picker (`mentioned`).
     */
    async sendMessage(
        messageContext: MessageContext,
        textContent: string | undefined,
        blockLevelMarkdown: boolean,
        attachment: AttachmentContent | undefined,
        mentioned: User[] = [],
    ): Promise<SendMessageOutcome> {
        const key = messageContextToString(messageContext);
        if (this.#sendsBeingPosted.has(key)) return { kind: "busy" };
        this.#sendsBeingPosted.add(key);
        try {
            const expanded = await this.#expandTypedMentions(
                messageContext,
                textContent,
                mentioned,
            );
            return await new Promise<SendMessageOutcome>((settle) => {
                let rulesDeclined = false;
                this.sendMessageWithContent(
                    messageContext,
                    this.#getMessageContent(expanded.text, attachment),
                    blockLevelMarkdown,
                    expanded.mentioned,
                    false,
                    undefined,
                    fetchOgPreviews(
                        extractEnabledLinks(expanded.text),
                        import.meta.env.OC_PREVIEW_PROXY_URL,
                    ),
                    {
                        posted: () => settle({ kind: "posted" }),
                        rulesDeclined: () => (rulesDeclined = true),
                    },
                ).then(
                    // settled already if it was posted; otherwise it was refused before posting
                    (resp) =>
                        settle(
                            resp.kind === "message_throttled"
                                ? { kind: "throttled" }
                                : rulesDeclined
                                  ? { kind: "rules_declined" }
                                  : { kind: "failed" },
                        ),
                    (err) => {
                        // the user dismissed the PIN prompt
                        if (err === "cancelled") return settle({ kind: "pin_cancelled" });
                        this.logError("Unable to send a message", err);
                        settle({ kind: "failed" });
                    },
                );
            });
        } finally {
            this.#sendsBeingPosted.delete(key);
        }
    }

    #throttleSendMessage(): boolean {
        return shouldThrottle(isDiamondStore.value);
    }

    sendMessageWithAttachment(
        messageContext: MessageContext,
        textContent: string | undefined,
        blockLevelMarkdown: boolean,
        attachment: AttachmentContent | undefined,
        mentioned: User[] = [],
    ) {
        return this.sendMessageWithContent(
            messageContext,
            this.#getMessageContent(textContent, attachment),
            blockLevelMarkdown,
            mentioned,
            false,
            undefined,
            fetchOgPreviews(extractEnabledLinks(textContent), import.meta.env.OC_PREVIEW_PROXY_URL),
        );
    }

    #getMessageContent(
        text: string | undefined,
        captioned: CaptionedContent | undefined,
    ): MessageContent {
        if (captioned === undefined) {
            return { kind: "text_content", text: text ?? "" };
        }
        return { ...captioned, caption: text };
    }

    #onSendMessageFailure(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        event: EventWrapper<Message>,
        canRetry: boolean,
        response?: SendMessageResponse,
    ) {
        this.#removeMessage(chatId, messageId, currentUserIdStore.value, threadRootMessageIndex);

        if (canRetry) {
            localUpdates.addFailedMessage({ chatId, threadRootMessageIndex }, event);
        }

        if (response !== undefined) {
            console.error("Error sending message", JSON.stringify(response));
        }

        if (!isTransfer(event.event.content)) {
            publish("sendMessageFailed", !canRetry);
        }
    }

    #postSendMessage(
        chat: ChatSummary,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
    ) {
        const context = { chatId: chat.id, threadRootMessageIndex };
        publish("sendingMessage", context);

        // HACK - we need to defer this very slightly so that we can guarantee that we handle SendingMessage events
        // *before* the new message is added to the unconfirmed store. Is this nice? No it is not.
        window.setTimeout(() => {
            withPausedStores(() => {
                // TODO - I'm not sure *why* we are doing this - it does not appear to be necessary
                // if (!isTransfer(messageEvent.event.content)) {
                //     localUpdates.addUnconfirmed(context, messageEvent);
                // }
                localUpdates.addUnconfirmed(context, messageEvent);

                localUpdates.deleteFailedMessage(context, messageEvent.event.messageId);

                // mark our own messages as read manually since we will not be observing them
                messagesRead.markMessageRead(
                    context,
                    messageEvent.event.messageIndex,
                    messageEvent.event.messageId,
                );
                // Mark all existing messages as read
                if (messageEvent.event.messageIndex > 0) {
                    messagesRead.markReadUpTo(context, messageEvent.event.messageIndex - 1);
                }

                // The user may have typed into the draft while a forwarded message waited to be sent
                if (!messageEvent.event.forwarded) {
                    localUpdates.draftMessages.delete(context);
                }
            });
            publish("sentMessage", { context, event: messageEvent });
        }, 0);
    }

    buildCryptoTransferText(
        formatter: MessageFormatter,
        myUserId: string,
        senderId: string,
        content: CryptocurrencyContent,
        me: boolean,
    ): string | undefined {
        return buildCryptoTransferText(
            formatter,
            myUserId,
            senderId,
            content,
            me,
            cryptoLookup.value,
        );
    }

    buildTransactionLink(
        formatter: MessageFormatter,
        transfer: CryptocurrencyTransfer,
    ): string | undefined {
        return buildTransactionLink(formatter, transfer, cryptoLookup.value);
    }

    buildTransactionUrl(transactionIndex: bigint, ledger: string): string | undefined {
        return buildTransactionUrlByIndex(transactionIndex, ledger, cryptoLookup.value);
    }

    getFirstUnreadMention(chat: ChatSummary): Mention | undefined {
        return messagesRead.getFirstUnreadMention(chat);
    }

    markAllRead(chat: ChatSummary) {
        messagesRead.markAllRead(chat);
    }

    markAllReadForCurrentScope() {
        withPausedStores(() => {
            chatSummariesStore.value.forEach((chat) => messagesRead.markAllRead(chat));
        });
    }

    getDisplayDate = getDisplayDate;
    calculateMediaDimensions = calculateMediaDimensions;
    dataToBlobUrl = dataToBlobUrl;
    askForNotificationPermission = askForNotificationPermission;
    setSoftDisabled = setSoftDisabled;
    gaTrack = gaTrack;

    // An edit only changes the text: a text message's text, or the caption of an image, video,
    // audio, file or gif. A file pasted or dropped while editing isn't part of the edit.
    async editMessage(
        messageContext: MessageContext,
        textContent: string | undefined,
        blockLevelMarkdown: boolean,
        editingEvent: EventWrapper<Message>,
    ): Promise<boolean> {
        const chat = chatSummariesStore.value.get(messageContext.chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        const captioned = isCaptionedContent(editingEvent.event.content)
            ? editingEvent.event.content
            : undefined;

        if (textContent || captioned) {
            // The draft, which holds the message being edited, is done with. (Done before looking up
            // those mentioned, else a message sent meanwhile would be taken as another edit.)
            localUpdates.draftMessages.delete(messageContext);
            textContent = (await this.#expandTypedMentions(messageContext, textContent, [])).text;

            const msg: Message = {
                ...editingEvent.event,
                edited: true,
                content: this.#getMessageContent(textContent ?? undefined, captioned),
                ogPreviews: [], // This will get filled in asynchronously after local updates are set
            };
            const updatedBlockLevelMarkdown =
                msg.blockLevelMarkdown === blockLevelMarkdown ? undefined : blockLevelMarkdown;

            // Apply content update to local state immediately — don't block on og preview fetch.
            const undo = localUpdates.markMessageContentEdited(msg, updatedBlockLevelMarkdown);
            const undoMessagePreviews = this.#refreshEditedMessagePreviews(
                chat,
                messageContext,
                editingEvent,
                msg,
            );

            const newAchievement = !achievementsStore.value.has("edited_message");

            // Fetch og previews in the background; content change is already visible in the UI.
            const ogPreviews = await fetchOgPreviews(
                extractEnabledLinks(textContent),
                import.meta.env.OC_PREVIEW_PROXY_URL,
            );
            msg.ogPreviews = ogPreviews;
            const undoOgPreviews = localUpdates.setEditedOgPreviews(msg.messageId, ogPreviews);

            return this.#worker
                .send({
                    kind: "editMessage",
                    chatId: chat.id,
                    msg,
                    threadRootMessageIndex: messageContext.threadRootMessageIndex,
                    blockLevelMarkdown: updatedBlockLevelMarkdown,
                    newAchievement,
                })
                .then((resp) => {
                    if (resp.kind !== "success") {
                        undo();
                        undoOgPreviews();
                        undoMessagePreviews();
                        return false;
                    }
                    return true;
                })
                .catch(() => {
                    undo();
                    undoOgPreviews();
                    undoMessagePreviews();
                    return false;
                });
        }
        return Promise.resolve(false);
    }

    hideLinkPreview(
        messageContext: MessageContext,
        event: EventWrapper<Message>,
        link: string,
    ): Promise<boolean> {
        // TODO Fix/enable link preview removal from image_content!
        // Currently, removing links from image captions also removes the image.

        if (event.event.content.kind !== "text_content") {
            return Promise.resolve(false);
        }

        const msg = {
            ...removeOpenGraphPreviews(event.event, [link]),
        };
        const undo = localUpdates.markLinkRemoved(msg.messageId, msg.ogPreviews);

        return this.#worker
            .send({
                kind: "editMessage",
                chatId: messageContext.chatId,
                msg,
                threadRootMessageIndex: messageContext.threadRootMessageIndex,
                newAchievement: false,
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                    return false;
                }
                return true;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    /**
     * Every notification means its chat has changed on the server, so the chat is brought up to
     * date now rather than at the next poll (up to a minute in the background). Everything else
     * follows from the updated summary as it would from a poll: the chat list, unread counts and
     * latest message, a video call starting or ending, and the selected chat's new messages.
     *
     * A group or channel is refreshed on its own, with one query. A direct chat's summary comes
     * only from the user's canister, and being added to a channel changes its state too, so those,
     * and a refresh that can't be done on its own, run a full updates pass instead.
     */
    notificationReceived(notification: Notification): void {
        const chatId = notification.chatId;
        if (
            notification.kind === "added_to_channel_notification" ||
            chatId.kind === "direct_chat"
        ) {
            this.#chatsPoller?.triggerNow();
            return;
        }
        this.#worker
            .send({ kind: "refreshChat", chatId })
            .catch(() => false)
            .then((refreshed) => {
                if (!refreshed) this.#chatsPoller?.triggerNow();
            });
    }

    #handleConfirmedMessageSentByOther(
        serverChat: ChatSummary,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
    ) {
        const confirmedLoaded = eventIndexesLoaded(serverChat.id);

        if (indexIsInRanges(messageEvent.index, confirmedLoaded)) {
            // We already have this confirmed message
            return;
        }

        const isAdjacentToAlreadyLoadedEvents =
            indexIsInRanges(messageEvent.index - 1, confirmedLoaded) ||
            indexIsInRanges(messageEvent.index + 1, confirmedLoaded);

        if (!isAdjacentToAlreadyLoadedEvents) {
            return;
        }

        this.#worker
            .send({
                kind: "rehydrateMessage",
                chatId: serverChat.id,
                message: messageEvent,
                threadRootMessageIndex,
                latestKnownUpdate: serverChat.lastUpdated,
            })
            .then((m) => {
                this.#handleEventsResponse(selectedChatFor(serverChat.id), serverChat, undefined, {
                    events: [m],
                    expiredEventRanges: [],
                    latestEventIndex: undefined,
                });
            });
    }

    expandDeletedMessages(messageIndexes: Set<number>): void {
        expandDeletedMessages(messageIndexes);
    }

    remoteUserToggledReaction(
        events: EventWrapper<ChatEvent>[],
        message: RemoteUserToggledReaction,
    ): void {
        const matchingMessage = this.#findMessageById(message.messageId, events);
        const kind = message.added ? "add" : "remove";

        if (matchingMessage !== undefined) {
            publish("reactionSelected", { messageId: message.messageId, kind });

            localUpdates.markReaction(message.messageId, {
                reaction: message.reaction,
                kind: message.added ? "add" : "remove",
                userId: message.userId,
            });
        }
    }

    /**
     * We *may* be able to conclude that the user meets the gate purely through
     * reference to the user data in which case we don't need to do anything else
     */
    #doesUserMeetAccessGates(gates: AccessGate[]): boolean {
        return gates.every((g) => this.doesUserMeetAccessGate(g));
    }

    doesUserMeetAccessGate(gate: AccessGate): boolean {
        if (isCompositeGate(gate)) {
            // Unique person gates are suspended and filtered out of composites: an OR then requires
            // another branch (no one is a unique person), an AND is unaffected (everyone is). If
            // nothing remains the gate collapses to no gate.
            const gates = gate.gates.filter((g) => g.kind !== "unique_person_gate");
            if (gates.length === 0) return true;
            return gate.operator === "and"
                ? gates.every((g) => this.doesUserMeetAccessGate(g))
                : gates.some((g) => this.doesUserMeetAccessGate(g));
        } else {
            if (gate.kind === "diamond_gate") {
                return currentUserStore.value.diamondStatus.kind !== "inactive";
            } else if (gate.kind === "lifetime_diamond_gate") {
                return currentUserStore.value.diamondStatus.kind === "lifetime";
            } else if (gate.kind === "unique_person_gate") {
                // Unique person verification (DecideAI) is suspended - always pass.
                return true;
            } else if (gate.kind === "chit_earned_gate") {
                return currentUserStore.value.totalChitEarned >= gate.minEarned;
            } else if (gate.kind === "token_balance_gate") {
                // Note that this takes no account of accumulated commitments incurred during gate evaluation
                // So it is only good for telling us if a balance gate is *initially* satisfied.
                // How to make that *reactive* is another issue
                return (cryptoBalanceStore.value.get(gate.ledgerCanister) ?? 0n) >= gate.minBalance;
            } else {
                return false;
            }
        }
    }

    #gatePreprocessingRequired(gates: AccessGate[]): boolean {
        return this.#getAllPreprocessLeafGates(gates).length > 0;
    }

    #getAllPreprocessLeafGates(gates: AccessGate[]): PreprocessedGate[] {
        return gates.reduce((all, g) => {
            if (isCompositeGate(g)) {
                all.push(...this.#getAllPreprocessLeafGates(g.gates));
            } else {
                if (shouldPreprocessGate(g)) {
                    all.push(g);
                }
            }
            return all;
        }, [] as PreprocessedGate[]);
    }

    /**
     * When joining a channel it is possible that both the channel & the community
     * have access gates so we need to work out all applicable gates for the chat
     * Note that we only return gates if we are not already a member (or our membership is lapsed).
     * We may also optionally exclude gates for things we are invited to in some scenariose
     */
    accessGatesForChat(chat: MultiUserChat, excludeInvited: boolean = false): EnhancedAccessGate[] {
        const gates: EnhancedAccessGate[] = [];
        const community =
            chat.kind === "channel" ? this.getCommunityForChannel(chat.id) : undefined;
        if (
            community !== undefined &&
            (community.membership.role === ROLE_NONE || community.membership.lapsed)
        ) {
            gates.push(...this.#accessGatesForCommunity(community, excludeInvited));
        }
        if (
            chat.gateConfig.gate.kind !== "no_gate" &&
            (chat.membership.role === ROLE_NONE || chat.membership.lapsed) &&
            (!chat.isInvited || !excludeInvited)
        ) {
            gates.push({
                level: chat.level,
                expiry: chat.gateConfig.expiry,
                collectionName: chat.name,
                ...chat.gateConfig.gate,
            });
        }
        return gates;
    }

    #accessGatesForCommunity(
        community: CommunitySummary,
        excludeInvited: boolean = false,
    ): EnhancedAccessGate[] {
        if (
            community.gateConfig.gate.kind === "no_gate" ||
            (community.isInvited && excludeInvited)
        ) {
            return [];
        }
        return [
            {
                level: "community",
                expiry: community.gateConfig.expiry,
                collectionName: community.name,
                ...community.gateConfig.gate,
            },
        ];
    }

    #handleWebRtcMessage(msg: WebRtcMessage): void {
        if (userStore.blockedUsers.has(msg.userId)) {
            return;
        }

        if (msg.kind === "remote_video_call_started") {
            const ev = createRemoteVideoStartedEvent(msg);
            if (ev) {
                this.#publishRemoteVideoCallStarted(ev);
            }
            return;
        }
        if (msg.kind === "remote_video_call_ended") {
            this.#publishRemoteVideoCallEnded(msg.messageId);
            return;
        }
        const fromChatId = filterWebRtcMessage(msg);
        if (fromChatId === undefined) return;

        // this means we have a selected chat but it doesn't mean it's the same as this message
        const parsedMsg = parseWebRtcMessage(fromChatId, msg);
        const selectedChat = selectedChatSummaryStore.value;

        if (
            selectedChat !== undefined &&
            chatIdentifiersEqual(fromChatId, selectedChat.id) &&
            parsedMsg.threadRootMessageIndex === selectedThreadIdStore.value?.threadRootMessageIndex
        ) {
            this.#handleWebRtcMessageInternal(
                fromChatId,
                parsedMsg,
                parsedMsg.threadRootMessageIndex === undefined
                    ? eventsStore.value
                    : threadEventsStore.value,
                parsedMsg.threadRootMessageIndex,
            );
        } else {
            if (
                parsedMsg.kind === "remote_user_sent_message" &&
                parsedMsg.threadRootMessageIndex === undefined
            ) {
                const context = { chatId: fromChatId };
                localUpdates.addUnconfirmed(context, createMessage(context, parsedMsg.message));
            }
        }
    }

    #handleWebRtcMessageInternal(
        fromChatId: ChatIdentifier,
        msg: WebRtcMessage,
        events: EventWrapper<ChatEvent>[],
        threadRootMessageIndex: number | undefined,
    ): void {
        switch (msg.kind) {
            case "remote_user_typing":
                typing.startTyping(
                    { chatId: fromChatId, threadRootMessageIndex: msg.threadRootMessageIndex },
                    msg.userId,
                );
                break;
            case "remote_user_stopped_typing":
                typing.stopTyping(msg.userId);
                break;
            case "remote_user_toggled_reaction":
                this.remoteUserToggledReaction(events, msg);
                break;
            case "remote_user_deleted_message":
                localUpdates.markMessageDeleted(msg.messageId, msg.userId);
                break;
            case "remote_user_removed_message":
                this.#removeMessage(fromChatId, msg.messageId, msg.userId, threadRootMessageIndex);
                break;
            case "remote_user_undeleted_message":
                localUpdates.markMessageUndeleted(msg.messageId);
                break;
            case "remote_user_sent_message":
                this.#remoteUserSentMessage(fromChatId, msg, events, threadRootMessageIndex);
                break;
            case "remote_user_read_message":
                unconfirmedReadByThem.add(BigInt(msg.messageId));
                break;
        }
    }

    #remoteUserSentMessage(
        chatId: ChatIdentifier,
        message: RemoteUserSentMessage,
        events: EventWrapper<ChatEvent>[],
        threadRootMessageIndex: number | undefined,
    ) {
        // This is the old version
        if ("messageEvent" in message) {
            return;
        }
        const existing = this.#findMessageById(message.message.messageId, events);
        if (existing !== undefined) {
            return;
        }

        const context = { chatId, threadRootMessageIndex };
        const messageEvent = createMessage(context, message.message);

        publish("sendingMessage", context);

        window.setTimeout(() => {
            localUpdates.addUnconfirmed(context, messageEvent);

            publish("sentMessage", { context, event: messageEvent });
        }, 0);
    }

    checkUsername(username: string, isBot: boolean): Promise<CheckUsernameResponse> {
        return this.#worker.send({ kind: "checkUsername", username, isBot });
    }

    // `pageIndex` picks which page of `maxResults` users to return, starting from 0
    searchUsers(searchTerm: string, maxResults = 20, pageIndex?: number): Promise<UserSummary[]> {
        return this.#worker
            .send({ kind: "searchUsers", searchTerm, maxResults, pageIndex })
            .then((resp) => {
                userStore.addMany(resp);
                return resp;
            })
            .catch(() => []);
    }

    lookupChatSummary(chatId: ChatIdentifier): ChatSummary | undefined {
        return allChatsStore.value.get(chatId);
    }

    async searchUsersForInvite(
        searchTerm: string,
        maxResults: number,
        level: Level,
        newGroup: boolean,
        canInviteUsers: boolean,
    ): Promise<[UserSummary[], UserSummary[]]> {
        if (level === "channel") {
            const communityId = selectedCommunityIdStore.value;
            const channelId = newGroup ? undefined : selectedChatIdStore.value;
            if (
                (communityId !== undefined && this.membersIncomplete(communityId)) ||
                (channelId?.kind === "channel" && this.membersIncomplete(channelId))
            ) {
                return this.#searchUsersForChannelLookingUpMembers(
                    searchTerm,
                    maxResults,
                    communityId,
                    channelId?.kind === "channel" ? channelId : undefined,
                    canInviteUsers,
                );
            }

            // Put the existing channel members into a map for quick lookup
            const channelMembers = newGroup ? undefined : selectedChatMembersStore.value;

            // First try searching the community members and return immediately if there are already enough matches
            // or if the caller does not have permission to invite users to the community
            const communityMatches = this.#searchCommunityUsersForChannelInvite(
                searchTerm,
                maxResults,
                channelMembers,
            );
            if (!canInviteUsers || communityMatches.length >= maxResults) {
                return [communityMatches, []];
            }

            // Search the global user list and overfetch if there are existing members we might need to remove
            const maxToSearch = newGroup ? maxResults : maxResults * 2;
            const globalMatches = await this.searchUsers(searchTerm, maxToSearch);
            if (!newGroup) {
                // Remove any existing members from the global matches until there are at most `maxResults`
                // TODO: Ideally we would return the total number of matches from the server and use that
                const maxToKeep = globalMatches.length < maxToSearch ? 0 : maxResults;
                keepMax(globalMatches, (u) => !channelMembers?.has(u.userId), maxToKeep);
            }

            const matches = [];

            // Add the global matches to the results, but only if they are not already in the community matches
            for (const match of globalMatches) {
                if (matches.length >= maxResults) {
                    break;
                }
                if (!communityMatches.some((m) => m.userId === match.userId)) {
                    matches.push(match);
                }
            }

            return [communityMatches, matches];
        } else {
            // Search the global user list and overfetch if there are existing members we might need to remove
            const maxToSearch = newGroup ? maxResults : maxResults * 2;
            const matches = await this.searchUsers(searchTerm, maxToSearch);
            if (!newGroup) {
                const id =
                    level === "community"
                        ? selectedCommunityIdStore.value
                        : selectedChatIdStore.value;

                // The existing members, of whom those not held are looked up if only some are held
                const existing =
                    id === undefined || id.kind === "direct_chat"
                        ? new Set<string>()
                        : await this.#membersAmong(
                              id,
                              matches.map((u) => u.userId),
                          );

                // Remove any existing members from the global matches until there are at most `maxResults`
                // TODO: Ideally we would return the total number of matches from the server and use that
                const maxToKeep = matches.length < maxToSearch ? 0 : maxResults;
                keepMax(matches, (u) => !existing.has(u.userId), maxToKeep);
            }
            return [[], matches];
        }
    }

    searchCommunityMembersToAdd(
        searchTerm: string,
        maxResults: number,
    ): Promise<[UserSummary[], UserSummary[]]> {
        const communityId = selectedCommunityIdStore.value;
        const channelId = selectedChatIdStore.value;
        if (
            (communityId !== undefined && this.membersIncomplete(communityId)) ||
            (channelId?.kind === "channel" && this.membersIncomplete(channelId))
        ) {
            return this.#searchUsersForChannelLookingUpMembers(
                searchTerm,
                maxResults,
                communityId,
                channelId?.kind === "channel" ? channelId : undefined,
                false,
            );
        }

        // Search the community members excluding the existing channel members
        const communityMatches = this.#searchCommunityUsersForChannelInvite(
            searchTerm,
            maxResults,
            selectedChatMembersStore.value,
        );

        return Promise.resolve([communityMatches, []]);
    }

    // Searches for users to add or invite to a channel when it, or its community, holds only some of
    // its members, so that whether each user found is a member of either may need looking up.
    // Returns members of the community who aren't members of the channel and, if `canInviteUsers`,
    // other users who aren't members of the channel.
    async #searchUsersForChannelLookingUpMembers(
        searchTerm: string,
        maxResults: number,
        communityId: CommunityIdentifier | undefined,
        channelId: ChannelIdentifier | undefined,
        canInviteUsers: boolean,
    ): Promise<[UserSummary[], UserSummary[]]> {
        // The community members held who match, and the users who match, of whom those who are
        // members of the community but aren't held are found by looking them up
        const held = this.#searchCommunityUsersForChannelInvite(
            searchTerm,
            USERS_SEARCHED_TO_FIND_MEMBERS,
            undefined,
        );
        const heldIds = new Set(held.map((u) => u.userId));
        let foundInCommunity: UserSummary[] = [];
        let others: UserSummary[] = [];
        if (communityId !== undefined && (canInviteUsers || this.membersIncomplete(communityId))) {
            // Of the community members found, only those not already found above, and not members
            // of the channel, are of use, so they are the ones counted towards `maxResults`
            const found = await this.#searchForMembers(
                communityId,
                searchTerm,
                maxResults,
                async (members) => {
                    const notHeld = members.filter((u) => !heldIds.has(u.userId));
                    if (channelId === undefined) {
                        return notHeld;
                    }
                    const inChannel = await this.#membersAmong(
                        channelId,
                        notHeld.map((u) => u.userId),
                    );
                    return notHeld.filter((u) => !inChannel.has(u.userId));
                },
            );
            foundInCommunity = found.members.map((u) => this.#withCommunityDisplayName(u));
            others = found.others;
        }

        // Those found who aren't members of the community are checked too, since someone whose
        // membership of the community has lapsed can still be a member of the channel
        const inChannel =
            channelId === undefined
                ? new Set<string>()
                : await this.#membersAmong(
                      channelId,
                      [...held, ...others].map((u) => u.userId),
                  );

        const communityMatches = [
            ...held.filter((u) => !inChannel.has(u.userId)),
            ...foundInCommunity,
        ].slice(0, maxResults);
        if (!canInviteUsers) {
            return [communityMatches, []];
        }
        const shown = new Set(communityMatches.map((u) => u.userId));
        const matches = others
            .filter((u) => !shown.has(u.userId) && !inChannel.has(u.userId))
            .slice(0, maxResults);
        return [communityMatches, matches];
    }

    // The user with their display name in the selected community, if they have one
    #withCommunityDisplayName(user: UserSummary): UserSummary {
        const displayName = selectedCommunityMembersStore.value.get(user.userId)?.displayName;
        return displayName === undefined ? user : { ...user, displayName };
    }

    #searchCommunityUsersForChannelInvite(
        term: string,
        maxResults: number,
        channelMembers: ReadonlyMap<string, Member> | undefined,
    ): UserSummary[] {
        const termLower = term.toLowerCase();
        const matches: UserSummary[] = [];
        for (const [userId, member] of selectedCommunityMembersStore.value) {
            let user = userStore.get(userId);
            if (user?.username !== undefined) {
                const displayName = member.displayName ?? user.displayName;
                if (
                    user.username.toLowerCase().includes(termLower) ||
                    (displayName !== undefined && displayName.toLowerCase().includes(termLower))
                ) {
                    if (channelMembers === undefined || !channelMembers.has(userId)) {
                        if (member.displayName !== undefined) {
                            user = { ...user, displayName: member.displayName };
                        }
                        matches.push(user);
                        if (matches.length >= maxResults) {
                            break;
                        }
                    }
                }
            }
        }
        return matches;
    }

    clearReferralCode(): void {
        localStorage.removeItem("openchat_referredby");
        this.#referralCode = undefined;
    }

    setReferralCode(code: string) {
        localStorage.setItem("openchat_referredby", code);
        this.#referralCode = code;
    }

    #extractReferralCodeFromPath(): string | undefined {
        return querystringReferralCodeStore.value ?? undefined;
    }

    captureReferralCode(): boolean {
        const code = this.#extractReferralCodeFromPath();
        let captured = false;
        // A referral code is the referrer's user id; anything else (a username typed into the
        // link) would fail Principal.fromText the moment we looked the referrer up
        if (code && isPrincipalValid(code)) {
            gaTrack("captured_referral_code", "registration");
            localStorage.setItem("openchat_referredby", code);
            captured = true;
        }
        const stored = localStorage.getItem("openchat_referredby");
        this.#referralCode = stored !== null && isPrincipalValid(stored) ? stored : undefined;
        return captured;
    }

    getReferringUser(): Promise<UserSummary | undefined> {
        return this.#referralCode === undefined
            ? Promise.resolve(undefined)
            : this.getUser(this.#referralCode);
    }

    registerBot(principal: string, bot: ExternalBot): Promise<boolean> {
        return this.#worker
            .send({
                kind: "registerBot",
                principal,
                bot,
            })
            .then((success) => {
                if (success) {
                    this.#loadBots();
                }
                return success;
            })
            .catch((err) => {
                this.#logger.error("Failed to register bot: ", err);
                return false;
            });
    }

    removeBot(botId: string): Promise<boolean> {
        return this.#worker
            .send({
                kind: "removeBot",
                botId,
            })
            .then((success) => {
                if (success) {
                    this.#loadBots();
                }
                return success;
            })
            .catch((err) => {
                this.#logger.error("Failed to register bot: ", err);
                return false;
            });
    }

    updateRegisteredBot(
        id: string,
        principal?: string,
        ownerId?: string,
        avatarUrl?: string,
        endpoint?: string,
        definition?: BotDefinition,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "updateRegisteredBot",
                id,
                principal,
                ownerId,
                avatarUrl,
                endpoint,
                definition,
            })
            .then((success) => {
                if (success) {
                    this.#loadBots();
                }
                return success;
            })
            .catch((err) => {
                this.#logger.error("Failed to update registered bot: ", err);
                return false;
            });
    }

    // referral codes the backend turned down: they're never sent again
    #refusedReferralCodes = new Set<string>();
    // a passkey was made for the sign-up in progress; another would leave the person two
    #passkeyMadeForSignUp = false;

    /**
     * Makes the account: a passkey first, unless the identity signed in already has no account
     * (signed in some other way, or the passkey made on an earlier try), then the user. The
     * referral code set (setReferralCode) goes with it, unless it was turned down before. No
     * account is made unless the person has agreed to the terms (`termsAccepted`).
     * `signal` gives the sign-up up before the account is asked for; once asked for, it's made.
     */
    async signUp(
        username: string,
        email: string | undefined,
        termsAccepted: boolean,
        signal?: AbortSignal,
    ): Promise<SignUpOutcome> {
        // the forms only offer sign-up once the terms are agreed to; this is the backstop
        if (!termsAccepted) return { kind: "failed", reason: i18nKey("unexpectedError") };
        selectedAuthProviderStore.set(AuthProvider.PASSKEY);
        // a passkey already made for this sign-up isn't made again
        if (identityStateStore.value.kind !== "registering" && !this.#passkeyMadeForSignUp) {
            try {
                await (this.isNativeApp()
                    ? this.signUpWithAndroidWebAuthn(true, username)
                    : this.signUpWithWebAuthn(true, username));
                this.#passkeyMadeForSignUp = true;
            } catch (err) {
                // the passkey was made and its identity was being loaded when it failed
                if (identityStateStore.value.kind === "loading_user") {
                    this.#passkeyMadeForSignUp = true;
                    this.logError("Unable to load the signed-up identity", err);
                    return { kind: "failed", reason: i18nKey("unexpectedError") };
                }
                // the passkey prompt dismissed
                return { kind: "cancelled" };
            }
        }
        if (signal?.aborted) return { kind: "cancelled" };
        // the passkey's identity has no account (registering), or it's still loading the user,
        // after a failed load, which registerUser can still make the account for; signed out
        // instead (anonymous: no OpenChat identity for the passkey), there's nothing to make it for
        const state = identityStateStore.value.kind;
        if (state !== "registering" && !(this.#passkeyMadeForSignUp && state === "loading_user")) {
            return { kind: "failed", reason: i18nKey("unexpectedError") };
        }
        // a code turned down before is never sent again
        const code = this.#referralCode;
        if (code !== undefined && this.#refusedReferralCodes.has(code)) this.clearReferralCode();
        const sent = this.#referralCode;
        const resp = await this.registerUser(username, email);
        if (sent !== undefined && referralCodeRefused(resp.kind)) {
            this.#refusedReferralCodes.add(sent);
        }
        if (resp.kind === "success") {
            this.#passkeyMadeForSignUp = false;
            this.onRegisteredUser(createdUserFrom(username, resp));
            return { kind: "success" };
        }
        if (referralCodeRefused(resp.kind)) {
            return { kind: "referral_refused", reason: i18nKey("register.referralCodeInvalid") };
        }
        return {
            kind: "failed",
            reason: i18nKey(registerFailureKey(resp.kind) ?? "unexpectedError"),
        };
    }

    registerUser(username: string, email: string | undefined): Promise<RegisterUserResponse> {
        // Without an OpenChat identity the worker's agent is anonymous and can't sign the request.
        // The sign-in that got here is already signing out (see openChatIdentityOrSignOut), but a
        // sign-up flow can call this before the navigation lands (#9635).
        if (this.#ocIdentityPrincipal === undefined) {
            return Promise.resolve({ kind: "internal_error" });
        }
        return this.#worker
            .send({
                kind: "registerUser",
                username,
                email,
                referralCode: this.#referralCode,
            })
            .then((res) => {
                console.log("register user response: ", res);
                if (res.kind === "success") {
                    gaTrack("registered_user", "registration");
                    if (this.#referralCode !== undefined) {
                        gaTrack("registered_user_with_referral_code", "registration");
                    }
                }

                switch (res.kind) {
                    case "success":
                    case "referral_code_invalid":
                    case "referral_code_already_claimed":
                    case "referral_code_expired":
                        this.clearReferralCode();
                }

                return res;
            })
            .catch(() => ({ kind: "internal_error" }));
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return new Promise((resolve, reject) => {
            let resolved = false;
            this.#worker.stream({ kind: "getCurrentUser" }).subscribe({
                onResult: (user) => {
                    // If the id has changed, the session restarts under the new one
                    if (user.kind === "created_user" && !this.#currentUserIdChanged(user.userId)) {
                        userCreatedStore.set(true);
                        currentUserStore.set(user);
                        this.#setDiamondStatus(user.diamondStatus);
                        this.#loadCurrentUserProfile(user.userId);
                    }
                    if (!resolved) {
                        // we want to resolve the promise with the first response from the stream so that
                        // we are not waiting unnecessarily
                        resolve(user);
                        resolved = true;
                    }
                },
                onError: (err) => {
                    console.log("Stream error: ", err);
                    reject(err);
                },
            });
        });
    }

    getDisplayName(
        userId: string | undefined,
        communityMembers?: ReadonlyMap<string, Member>,
        webhooks?: ReadonlyMap<string, WebhookDetails>,
    ): string {
        if (userId !== undefined) {
            const user = userStore.get(userId);
            if (user !== undefined) {
                const communityDisplayName = communityMembers?.get(userId)?.displayName;
                const displayName = communityDisplayName ?? user.displayName ?? user.username;
                if (displayName?.length > 0) {
                    return displayName;
                }
            } else {
                const webhook = webhooks?.get(userId);
                if (webhook !== undefined) {
                    return webhook.name;
                }
                if (
                    isDeletedWebhook(
                        userId,
                        webhooks,
                        webhookUserIdsStore.value,
                        selectedServerChatStore.value !== undefined,
                    )
                ) {
                    return this.config.i18nFormatter("webhook.deleted");
                }
            }
        }

        return this.config.i18nFormatter("unknownUser");
    }

    #subscriptionExists(endpoint: string): Promise<boolean> {
        return this.#worker.send({ kind: "subscriptionExists", endpoint }).catch(() => false);
    }

    #pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.#worker.send({ kind: "pushSubscription", subscription });
    }

    #removeSubscription(endpoint: string): Promise<void> {
        return this.#worker.send({ kind: "removeSubscription", endpoint });
    }

    #inviteUsersLocally(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): UndoLocalUpdate {
        if (id.kind === "community") {
            return localUpdates.inviteCommunityUsers(id, userIds);
        } else {
            return localUpdates.inviteChatUsers(id, userIds);
        }
    }

    #uninviteUsersLocally(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): void {
        if (id.kind === "community") {
            localUpdates.uninviteCommunityUsers(id, userIds);
            const community = communitiesStore.value.get({
                kind: "community",
                communityId: id.communityId,
            });

            if (community !== undefined) {
                for (const channel of community.channels) {
                    this.#uninviteUsersLocally(channel.id, userIds);
                }
            }
        } else {
            localUpdates.uninviteChatUsers(id, userIds);
        }
    }

    checkFcmTokenExists(fcmToken: string): Promise<boolean> {
        return this.#worker.send({ kind: "fcmTokenExists", fcmToken });
    }

    addFcmToken(fcmToken: string): Promise<void> {
        return this.#worker.send({ kind: "addFcmToken", fcmToken });
    }

    removeFcmToken(fcmToken: string): Promise<void> {
        return this.#worker.send({ kind: "removeFcmToken", fcmToken });
    }

    inviteUsers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        const undo = this.#inviteUsersLocally(id, userIds);
        return this.#worker
            .send({
                kind: "inviteUsers",
                id,
                userIds,
                callerUsername: currentUserStore.value.username,
            })
            .then((resp) => {
                if (!resp) {
                    undo();
                }
                return resp;
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    cancelInvites(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        this.#uninviteUsersLocally(id, userIds);
        return this.#worker
            .send({
                kind: "cancelInvites",
                id,
                userIds,
            })
            .then((resp) => {
                if (!resp) {
                    this.#inviteUsersLocally(id, userIds);
                }
                return resp;
            })
            .catch(() => {
                this.#inviteUsersLocally(id, userIds);
                return false;
            });
    }

    addMembersToChannel(
        chatId: ChannelIdentifier,
        userIds: string[],
    ): Promise<AddMembersToChannelResponse> {
        return this.#worker
            .send({
                kind: "addMembersToChannel",
                chatId,
                userIds,
                username: currentUserStore.value.username,
                displayName: currentUserStore.value.displayName,
            })
            .catch((err) => {
                return { kind: "internal_error", error: err.toString() };
            });
    }

    removeCommunityMember(id: CommunityIdentifier, userId: string): Promise<RemoveMemberResponse> {
        const undo = localUpdates.removeCommunityMember(id, userId);
        return this.#worker
            .send({ kind: "removeCommunityMember", id, userId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp;
            })
            .catch(() => {
                undo();
                return CommonResponses.failure();
            });
    }

    removeMember(chatId: MultiUserChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        const undo = localUpdates.removeChatMember(chatId, userId);
        return this.#worker
            .send({ kind: "removeMember", chatId, userId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp;
            })
            .catch(() => {
                undo();
                return CommonResponses.failure();
            });
    }

    changeCommunityRole(
        id: CommunityIdentifier,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole,
    ): Promise<boolean> {
        if (newRole === oldRole) return Promise.resolve(true);

        const m = selectedCommunityMembersStore.value.get(userId);
        let undo = undefined;
        if (m !== undefined) {
            undo = localUpdates.updateCommunityMember(id, userId, { ...m, role: newRole });
        }

        return this.#worker
            .send({ kind: "changeCommunityRole", id, userId, newRole })
            .then((resp) => {
                return resp.kind === "success";
            })
            .catch(() => false)
            .then((success) => {
                if (!success) {
                    undo?.();
                }
                return success;
            });
    }

    changeRole(
        chatId: MultiUserChatIdentifier,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole,
    ): Promise<boolean> {
        if (newRole === oldRole) return Promise.resolve(true);

        const undo = localUpdates.updateChatMember(
            chatId,
            userId,
            selectedChatMembersStore.value.get(userId),
            (m) => ({ ...m, role: newRole }),
        );
        return this.#worker
            .send({ kind: "changeRole", chatId, userId, newRole })
            .then((resp) => {
                return resp.kind === "success";
            })
            .catch(() => false)
            .then((success) => {
                if (!success) {
                    undo();
                }
                return success;
            });
    }

    /**
     * Votes on the proposal in `content`, recording the vote in `proposalVotesStore` while it is in flight
     * and once it succeeds, and clearing it if it fails so the user can try again
     */
    async voteOnProposal(
        chatId: ChatIdentifier,
        messageIndex: number,
        messageId: bigint,
        content: ProposalContent,
        adopt: boolean,
    ): Promise<ProposalVoteOutcome> {
        if (
            (chatId.kind !== "group_chat" && chatId.kind !== "channel") ||
            content.myVote !== undefined ||
            proposalVotesStore.has(messageId)
        ) {
            return { kind: "skipped" };
        }

        const { governanceCanisterId, proposal } = content;
        const isNns = proposal.kind === "nns";
        proposalVotesStore.insert(messageId, adopt ? "adopting" : "rejecting");

        const outcome = proposalVoteResult(
            await this.#registerProposalVote(
                chatId,
                messageIndex,
                governanceCanisterId,
                proposal.id,
                isNns,
                adopt,
            ),
        );

        if (outcome.kind === "voted") {
            proposalVotesStore.insert(messageId, adopt ? "adopted" : "rejected");
            this.#getProposalVoteDetails(messageId, governanceCanisterId, proposal.id, isNns).catch(
                (err) => this.#logger.error("Unable to refresh the proposal tally", err),
            );
        } else {
            proposalVotesStore.delete(messageId);
        }
        return outcome;
    }

    #registerProposalVote(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.#worker
            .send({
                kind: "registerProposalVote",
                chatId,
                messageIndex,
                governanceCanisterId,
                proposalId,
                isNns,
                adopt,
            })
            .catch(CommonResponses.failure);
    }

    #getProposalVoteDetails(
        messageId: bigint,
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
    ): Promise<ProposalVoteDetails> {
        return this.#worker
            .send({
                kind: "getProposalVoteDetails",
                governanceCanisterId,
                proposalId,
                isNns,
            })
            .then((resp) => {
                localUpdates.markProposalTallyUpdated(messageId, resp.latestTally);
                return resp;
            });
    }

    getRecommendedGroups(): Promise<GroupChatSummary[]> {
        // TODO get the list of exclusions from the user canister

        const exclusions = new Set<string>(
            [...chatSummariesStore.value.values()]
                .filter((c) => c.kind === "group_chat" && c.public)
                .map((g) => chatIdentifierToString(g.id)),
        );

        recommendedGroupExclusions.value.forEach((c) => exclusions.add(c));

        return this.#worker
            .send({
                kind: "getRecommendedGroups",
                exclusions: [...exclusions],
            })
            .then((groups) => (appStoreBuild ? groups.filter((g) => !chatRestricted(g)) : groups))
            .catch(() => []);
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.#worker.send({
            kind: "searchGroups",
            searchTerm,
            flags: appStoreBuild
                ? moderationFlagsEnabledStore.value & ModerationFlags.UnderReview
                : moderationFlagsEnabledStore.value,
            maxResults,
        });
    }

    exploreBots(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        location: BotInstallationLocation | undefined,
        excludeInstalled: boolean,
    ): Promise<ExploreBotsResponse> {
        // Callers use their own direct chat as the location to mean "bots available for direct
        // chat", but the anonymous user id is not a principal and cannot be encoded as one
        if (location?.kind === "direct_chat" && anonUserStore.value) {
            location = undefined;
        }
        return this.#worker.send({
            kind: "exploreBots",
            searchTerm,
            pageIndex,
            pageSize,
            location,
            excludeInstalled,
        });
    }

    exploreCommunities(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        flags: number,
        languages: string[],
    ): Promise<ExploreCommunitiesResponse> {
        return this.#worker
            .send({
                kind: "exploreCommunities",
                searchTerm,
                pageIndex,
                pageSize,
                flags: appStoreBuild ? flags & ModerationFlags.UnderReview : flags,
                languages,
            })
            .then((response) => {
                if (appStoreBuild && response.kind === "success") {
                    response.matches = response.matches.filter(
                        (m) => !moderationFlagsRestricted(m.flags),
                    );
                }
                return response;
            });
    }

    exploreChannels(
        id: CommunityIdentifier,
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
    ): Promise<ExploreChannelsResponse> {
        return this.#worker
            .send({
                kind: "exploreChannels",
                id,
                searchTerm,
                pageIndex,
                pageSize,
            })
            .catch(() => ({ kind: "failure" }));
    }

    dismissRecommendation(chatId: GroupChatIdentifier): Promise<void> {
        recommendedGroupExclusions.add(chatIdentifierToString(chatId));
        return this.#worker.send({ kind: "dismissRecommendation", chatId });
    }

    set groupInvite(value: GroupInvite) {
        this.config.groupInvite = value;
        this.#worker.send({
            kind: "groupInvite",
            value,
        });
    }

    setCommunityInvite(value: CommunityInvite): Promise<void> {
        this.config.communityInvite = value;
        return this.#worker.send({
            kind: "communityInvite",
            value,
        });
    }

    setCommunityReferral(communityId: CommunityIdentifier, referredBy: string) {
        // make sure that we can't refer ourselves
        if (currentUserIdStore.value !== referredBy) {
            return this.#worker.send({
                kind: "setCommunityReferral",
                communityId,
                referredBy,
            });
        }
    }

    searchChat(
        chatId: ChatIdentifier,
        searchTerm: string,
        userIds: string[],
        maxResults: number,
    ): Promise<SearchDirectChatResponse | SearchGroupChatResponse> {
        switch (chatId.kind) {
            case "channel":
            case "group_chat":
                return this.#worker.send({
                    kind: "searchGroupChat",
                    chatId,
                    searchTerm,
                    userIds,
                    maxResults,
                });
            case "direct_chat":
                return this.#worker.send({
                    kind: "searchDirectChat",
                    chatId,
                    searchTerm,
                    maxResults,
                });
        }
    }

    // Resolves with the balance, or undefined if it couldn't be refreshed (eg. offline). Never rejects,
    // and a failure leaves the cached balance as it was.
    refreshAccountBalance(
        ledger: string,
        allowCached: boolean = false,
    ): Promise<bigint | undefined> {
        const user = currentUserStore.value;
        // The anonymous user has no wallet, and its id isn't a principal
        if (user === undefined || user.userId === ANON_USER_ID) {
            return Promise.resolve(0n);
        }

        if (allowCached) {
            const cached = cryptoBalanceStore.valueIfUpdatedRecently(ledger);
            if (cached !== undefined) {
                return Promise.resolve(cached);
            }
        }

        // If there is already an inflight promise for this same ledger, return that existing promise rather than
        // sending an additional query to the canister.
        const existingPromise = this.#inflightBalanceRefreshPromises.get(ledger);
        if (existingPromise !== undefined) {
            return existingPromise;
        }

        const promise: Promise<bigint | undefined> = new Promise((resolve) => {
            this.#refreshBalanceSemaphore
                .execute(() => {
                    // Race the request against a timeout - without it, a worker request which
                    // never responds (eg. the worker was suspended while backgrounded on mobile)
                    // would leak a semaphore permit and leave this ledger's inflight promise
                    // wedged for the rest of the session.
                    return Promise.race([
                        this.#worker
                            .send({
                                kind: "refreshAccountBalance",
                                ledger,
                                principal: user.userId,
                            })
                            .then((val) => {
                                cryptoBalanceStore.setBalance(ledger, val);
                                return val;
                            }),
                        new Promise<bigint>((_, reject) =>
                            window.setTimeout(
                                () => reject(new Error("refreshAccountBalance timed out")),
                                20_000,
                            ),
                        ),
                    ])
                        .catch((err) => {
                            console.warn(`Couldn't refresh the balance of ${ledger}`, err);
                            return undefined;
                        })
                        .finally(() => this.#inflightBalanceRefreshPromises.delete(ledger));
                })
                .then(resolve);
        });

        this.#inflightBalanceRefreshPromises.set(ledger, promise);

        return promise;
    }

    // The balances left behind in the wallets of the canisters the user had before being migrated to
    // a MultiUser canister. They aren't in the user's wallet until moved there with
    // `moveFundsFromPreviousWallets`. Rejects if the wallets couldn't be checked at all.
    fundsInPreviousWallets(): Promise<FundsInPreviousWallet[]> {
        const previousUserIds = currentUserStore.value.previousUserIds ?? [];
        if (previousUserIds.length === 0) {
            return Promise.resolve([]);
        }
        return this.#worker.send({ kind: "fundsInPreviousWallets", previousUserIds });
    }

    // Moves the given balances, from `fundsInPreviousWallets`, to the user's wallet, then refreshes
    // the wallet's balance of each of their tokens, including those which failed to move, since a
    // transfer which timed out may still have been made
    moveFundsFromPreviousWallets(funds: FundsInPreviousWallet[]): Promise<MoveFundsOutcome[]> {
        if (funds.length === 0) {
            return Promise.resolve([]);
        }
        return this.#worker
            .send({ kind: "moveFundsFromPreviousWallets", funds })
            .catch((err): MoveFundsOutcome[] =>
                funds.map(({ previousUserId, ledger }) => ({
                    previousUserId,
                    ledger,
                    result: {
                        kind: "failed",
                        // The worker's errors arrive as plain objects
                        error: { kind: "error", code: -1, message: err?.message ?? String(err) },
                    },
                })),
            )
            .then(async (outcomes) => {
                // Each refresh resolves, to undefined if it fails or times out
                const ledgers = new Set(funds.map((f) => f.ledger));
                await Promise.all([...ledgers].map((ledger) => this.refreshAccountBalance(ledger)));
                return outcomes;
            });
    }

    // Moves anything left in the wallets of the canisters the user had before being migrated to a
    // MultiUser canister to their wallet, as the message telling them of their new wallet promises.
    // While the website stays open, this is tried again every hour, which only checks the wallets
    // when a check is due (see `movePreviousWalletFunds`).
    async #movePreviousWalletFunds(): Promise<void> {
        window.clearTimeout(this.#movePreviousWalletFundsTimer);
        const user = currentUserStore.value;
        if ((user.previousUserIds ?? []).length === 0) return;

        try {
            // Left for the next try rather than counted as a check which found nothing
            if (get(offlineStore)) return;

            const outcomes = await movePreviousWalletFunds(
                user,
                () => this.fundsInPreviousWallets(),
                (funds) => this.moveFundsFromPreviousWallets(funds),
            );
            // `AlreadyInProgress` is left out, since it only means the old canister was still
            // busy, eg. being closed out straight after the migration, so is expected now and then
            const failures = (outcomes ?? []).flatMap(({ previousUserId, ledger, result }) =>
                result.kind === "failed" && result.error.code !== ErrorCode.AlreadyInProgress
                    ? [
                          {
                              previousUserId,
                              ledger,
                              code: result.error.code,
                              message: result.error.message,
                          },
                      ]
                    : [],
            );
            if (failures.length > 0) {
                const message = "Failed to move funds from previous wallets";
                this.#logger.error(message, new Error(message), { failures });
            }
        } finally {
            this.#movePreviousWalletFundsTimer = window.setTimeout(
                () => this.#movePreviousWalletFunds(),
                PREVIOUS_WALLETS_RETRY_INTERVAL,
            );
        }
    }

    // Finishes off any swap the user made straight from their wallet which they left part way
    // through, withdrawing to their wallet anything the DEX still holds for them
    async #recoverUnfinishedTokenSwaps(): Promise<void> {
        try {
            await this.#worker.send({ kind: "recoverUnfinishedTokenSwaps" });
        } catch (err) {
            this.#logger.error("Failed to recover unfinished token swaps", err);
        }
    }

    refreshTranslationsBalance(): Promise<bigint> {
        return this.#worker
            .send({
                kind: "refreshAccountBalance",
                ledger: LEDGER_CANISTER_CHAT,
                principal: this.config.translationsCanister,
            })
            .catch(() => 0n);
    }

    async getAccountTransactions(
        ledgerIndex: string,
        fromId?: bigint,
    ): Promise<AccountTransactionResult> {
        return this.#worker
            .send({
                kind: "getAccountTransactions",
                ledgerIndex: ledgerIndex,
                fromId,
                principal: currentUserIdStore.value,
            })
            .then(async (resp) => {
                if (resp.kind === "success") {
                    const userIds = userIdsFromTransactions(resp.transactions);
                    const users = await this.getMissingUsers(userIds);
                    // A transfer made before the other user was migrated to a MultiUser canister
                    // names them by their earlier id, which the UserIndex maps to their latest
                    const latest = (id: string | undefined) =>
                        id === undefined ? undefined : (users.migratedUserIds?.get(id) ?? id);
                    if (users.migratedUserIds !== undefined) {
                        resp.transactions = resp.transactions.map((t) => ({
                            ...t,
                            from: latest(t.from),
                            to: latest(t.to),
                        }));
                    }
                }
                return resp;
            })
            .catch(() => ({ kind: "failure" }));
    }

    async threadPreviews(threadsByChat: ChatMap<ThreadSyncDetails[]>): Promise<ThreadPreview[]> {
        const request: ChatMap<[ThreadSyncDetails[], bigint | undefined]> = threadsByChat.reduce(
            (map, [chatId, threads]) => {
                if (chatId.kind === "group_chat" || chatId.kind === "channel") {
                    const latestKnownUpdate = allServerChatsStore.value.get(chatId)?.lastUpdated;
                    map.set(chatId, [threads, latestKnownUpdate]);
                }
                return map;
            },
            new ChatMap<[ThreadSyncDetails[], bigint | undefined]>(),
        );

        return this.#worker
            .send({
                kind: "threadPreviews",
                threadsByChat: request.toMap() as Map<
                    string,
                    [ThreadSyncDetails[], bigint | undefined]
                >,
            })
            .then((threads) => {
                const events = threads.flatMap((t) => [t.rootMessage, ...t.latestReplies]);
                const { userIds, webhooks } = this.userIdsFromEvents(events);
                this.getMissingUsers(userIds);
                userStore.addWebhookIds([...webhooks]);
                void this.getBridgedUsers(bridgedUserIdsFromEvents(events));
                return threads;
            })
            .catch(() => []);
    }

    // Fetches the profiles of the bridged accounts which haven't been fetched, or not recently.
    // One the UserIndex doesn't have yet, eg. as the message reached the chat first, or which
    // couldn't be fetched, is tried again shortly.
    // So the chat list can show who the chats' relayed latest messages are from
    #getLatestMessagesBridgedUsers(chats: ChatSummary[]): void {
        void this.getBridgedUsers(bridgedUserIdsFromLatestMessages(chats));
    }

    async getBridgedUsers(ids: BridgedUserId[], retry = true): Promise<void> {
        const now = Date.now();
        const toFetch = ids.filter((id) => {
            const key = bridgedUserKey(id)!;
            const fetchedAt = this.#bridgedUsersFetchedAt.get(key);
            return (
                !this.#bridgedUsersInFlight.has(key) &&
                (fetchedAt === undefined || now - fetchedAt > BRIDGED_USER_MAX_AGE)
            );
        });
        if (toFetch.length === 0) return;

        const keys = toFetch.map((id) => bridgedUserKey(id)!);
        keys.forEach((key) => this.#bridgedUsersInFlight.add(key));
        const users = await this.#worker
            .send({ kind: "getBridgedUsers", ids: toFetch })
            .catch(() => [] as BridgedUserSummary[])
            .finally(() => keys.forEach((key) => this.#bridgedUsersInFlight.delete(key)));

        const fetched = new Set<string>();
        if (users.length > 0) {
            bridgedUsersStore.update((map) => {
                for (const u of users) {
                    const key = bridgedUserKey(bridgedUserId(u.user))!;
                    map.set(key, u);
                    fetched.add(key);
                    this.#bridgedUsersFetchedAt.set(key, now);
                }
                return map;
            });
        }

        const missing = toFetch.filter((id) => !fetched.has(bridgedUserKey(id)!));
        if (retry && missing.length > 0) {
            window.setTimeout(
                () => void this.getBridgedUsers(missing, false),
                BRIDGED_USER_RETRY_DELAY,
            );
        }

        if (users.some((u) => u.linkedUserId === currentUserIdStore.value)) {
            this.#markLoadedOwnMessagesRead();
        }

        // Those who linked the accounts of the selected chat's relayed messages can now be looked up
        // among its members, if they aren't held
        if (
            users.some(
                (u) =>
                    u.linkedUserId !== undefined &&
                    this.#usersSeenInChat.bridgedUsers.has(bridgedUserKey(bridgedUserId(u.user))!),
            )
        ) {
            this.#lookupMembersSeen();
        }

        // A linked account's messages are shown as its OpenChat user's
        await this.getMissingUsers(users.flatMap((u) => u.linkedUserId ?? []));
    }

    // A one-time code for the user to pass to the platform's bridge bot, to link their account there
    startBridgedUserLink(platform: BridgePlatform): Promise<BridgedUserLinkCode | OCError> {
        return this.#worker.send({ kind: "startBridgedUserLink", platform });
    }

    async unlinkBridgedUser(id: BridgedUserId): Promise<Success | OCError> {
        const resp = await this.#worker.send({ kind: "unlinkBridgedUser", id });
        if (resp.kind === "success") {
            const key = bridgedUserKey(id)!;
            bridgedUsersStore.update((map) => {
                const summary = map.get(key);
                if (summary !== undefined) {
                    map.set(key, { ...summary, linkedUserId: undefined });
                }
                return map;
            });
        }
        return resp;
    }

    // The accounts the user has linked to themself. They go in the store too, so the user's messages
    // from a newly linked account show as theirs, and are read, straight away.
    async getLinkedBridgedUsers(): Promise<BridgedUserSummary[]> {
        const users = await this.#worker.send({ kind: "getLinkedBridgedUsers" });
        const now = Date.now();
        bridgedUsersStore.update((map) => {
            for (const u of users) {
                const key = bridgedUserKey(bridgedUserId(u.user))!;
                map.set(key, u);
                this.#bridgedUsersFetchedAt.set(key, now);
            }
            return map;
        });
        if (users.length > 0) {
            this.#markLoadedOwnMessagesRead();
        }
        return users;
    }

    getMissingUsers(userIds: Iterable<string>): Promise<UsersResponse> {
        return this.getUsers(
            {
                userGroups: [
                    {
                        users: missingUserIds(
                            userStore.allUsers,
                            webhookUserIdsStore.value,
                            userIds,
                        ),
                        updatedSince: BigInt(0),
                    },
                ],
            },
            true,
        );
    }

    getUsers(userArgs: UsersArgs, allowStale = false): Promise<UsersResponse> {
        const userGroups = userArgs.userGroups
            .map((g) => ({ ...g, users: g.users.filter((u) => u !== undefined) }))
            .filter((g) => g.users.length > 0);

        if (userGroups.length === 0) {
            return Promise.resolve({
                users: [],
                deletedUserIds: new Set(),
            });
        }

        return this.#worker
            .send({
                kind: "getUsers",
                users: { userGroups },
                allowStale,
            })
            .then((resp) => {
                const deletedUsers = [...resp.deletedUserIds].map(deletedUser);
                userStore.addMany([...resp.users, ...deletedUsers]);
                if (resp.serverTimestamp !== undefined) {
                    // If we went to the server, all users not returned are still up to date, so we mark them as such
                    const usersReturned = new Set<string>(resp.users.map((u) => u.userId));
                    const allOtherUsers = userArgs.userGroups.flatMap((g) =>
                        g.users.filter((u) => !usersReturned.has(u)),
                    );
                    userStore.setUpdated(allOtherUsers, resp.serverTimestamp);
                }
                if (resp.currentUser && !this.#currentUserIdChanged(resp.currentUser.userId)) {
                    currentUserStore.set(
                        updateCreatedUser(currentUserStore.value, resp.currentUser),
                    );
                }
                return resp;
            })
            .catch(() => ({ users: [], deletedUserIds: new Set() }));
    }

    getUser(userId: string, allowStale = false): Promise<UserSummary | undefined> {
        // Via getUsers, which adds the user to the store. A user asked for by an id they had
        // before being migrated to a MultiUser canister, eg. from an old link, is returned under
        // their latest id.
        return this.getUsers(
            { userGroups: [{ users: [userId], updatedSince: BigInt(0) }] },
            allowStale,
        ).then((resp) => {
            const latestUserId = resp.migratedUserIds?.get(userId) ?? userId;
            return resp.users.find((u) => u.userId === latestUserId);
        });
    }

    getUserStatus(userId: string, now: number): Promise<UserStatus> {
        return this.getLastOnlineDate(userId, now).then((lastOnline) =>
            userStatus(lastOnline, Date.now()),
        );
    }

    async getLastOnlineDate(userId: string, now: number): Promise<number | undefined> {
        const user = userStore.get(userId);
        if (user === undefined || user.kind === "bot") return undefined;

        if (userId === currentUserIdStore.value) return now;

        const lastOnlineCached = lastOnlineDates.get(userId, now);

        const cacheValid =
            lastOnlineCached !== undefined &&
            (lastOnlineCached.lastOnline < now - 5 * ONE_MINUTE_MILLIS ||
                lastOnlineCached.updated > now - 30 * 1000);

        if (cacheValid) {
            return lastOnlineCached.lastOnline;
        } else {
            const response = await this.#getLastOnlineDatesBatched([userId]);
            return response[userId];
        }
    }

    getPublicProfile(userId?: string): Stream<PublicProfile | undefined> {
        return this.#worker.stream({ kind: "getPublicProfile", userId });
    }

    /**
     * Loads the current user's profile into currentUserProfileStore again, so a change made on
     * another device shows (the profile is otherwise loaded once, at sign-in). Only the live
     * profile counts: the cached one may be older than the store, and so may a live one asked for
     * before a change here (a save, an image) wrote the store.
     */
    refreshCurrentUserProfile(): void {
        if (anonUserStore.value || get(offlineStore)) return;
        const writes = this.#currentUserProfileWrites;
        this.getPublicProfile(currentUserIdStore.value).subscribe({
            onResult: (profile, final) => {
                if (!final || profile === undefined) return;
                if (writes !== this.#currentUserProfileWrites) return;
                currentUserProfileStore.set(profile);
            },
        });
    }

    #updateCurrentUserProfile(update: (profile: PublicProfile) => PublicProfile): void {
        this.#currentUserProfileWrites++;
        currentUserProfileStore.update(update);
    }

    #loadCurrentUserProfile(userId: string): void {
        this.getPublicProfile(userId).subscribe({
            onResult: (profile) => {
                if (profile !== undefined) {
                    currentUserProfileStore.set(profile);
                }
            },
        });
    }

    /**
     * Saves the profile fields that differ from `original`, in parallel. A field the backend rejects keeps its
     * unsaved value and carries the reason to show under it. Each saved field is written to
     * currentUserProfileStore.
     */
    async saveProfile(
        original: PublicProfile,
        candidate: PublicProfile,
    ): Promise<SaveProfileOutcome> {
        const outcome: SaveProfileOutcome = { profile: original, errors: {} };
        if (anonUserStore.value) return outcome;

        const userId = currentUserIdStore.value;
        const changes = profileChanges(original, candidate);
        const save = async (
            field: "username" | "displayName" | "bio",
            send: () => Promise<ProfileFieldResult>,
        ) => {
            try {
                const result = await send();
                switch (result.kind) {
                    case "saved":
                        outcome.profile = { ...outcome.profile, [field]: candidate[field] };
                        this.#updateCurrentUserProfile((profile) => ({
                            ...profile,
                            [field]: candidate[field],
                        }));
                        break;
                    case "rejected":
                        outcome.errors[field] = result.message;
                        break;
                    case "failed":
                        outcome.failure = i18nKey("unableToSaveUserProfile");
                        break;
                    default:
                        result satisfies never;
                }
            } catch (err) {
                outcome.failure = i18nKey("unableToSaveUserProfile");
                this.logError(`Unable to save ${field}: `, err);
            }
        };

        await Promise.all([
            changes.username &&
                save("username", async () =>
                    usernameResult(await this.#setUsername(userId, candidate.username)),
                ),
            changes.displayName &&
                save("displayName", async () =>
                    displayNameResult(await this.#setDisplayName(userId, candidate.displayName)),
                ),
            changes.bio &&
                save("bio", async () =>
                    bioResult(await this.#worker.send({ kind: "setBio", bio: candidate.bio })),
                ),
        ]);
        return outcome;
    }

    #setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.#worker.send({ kind: "setUsername", userId, username }).then((resp) => {
            if (resp === "success") {
                currentUserStore.set({
                    ...currentUserStore.value,
                    username,
                });
                userStore.updateUser(userId, (user) => ({ ...user, username }));
            }
            return resp;
        });
    }

    #setDisplayName(
        userId: string,
        displayName: string | undefined,
    ): Promise<SetDisplayNameResponse> {
        return this.#worker.send({ kind: "setDisplayName", userId, displayName }).then((resp) => {
            if (resp === "success") {
                currentUserStore.set({
                    ...currentUserStore.value,
                    displayName,
                });
                userStore.updateUser(userId, (user) => ({ ...user, displayName }));
            }
            return resp;
        });
    }

    acceptTerms(version: number): Promise<boolean> {
        // The blocking notice closes only once the acceptance is recorded against the user
        // record on the user_index: closing on a failed call would leave the session usable
        // with no acceptance recorded - the record is the whole point of the gate
        return this.#worker
            .send({ kind: "acceptTerms", version })
            .then((success) => {
                if (success) {
                    currentUserStore.set({
                        ...currentUserStore.value,
                        acceptedTermsVersion: version,
                    });
                }
                return success;
            })
            .catch(() => false);
    }

    setHideOnlineStatus(hideOnlineStatus: boolean): Promise<void> {
        return this.#worker.send({
            kind: "setHideOnlineStatus",
            hideOnlineStatus,
        });
    }

    getBio(userId?: string): Promise<string> {
        return this.#worker.send({ kind: "getBio", userId });
    }

    getProfileBackgroundImage(_userId?: string): Promise<DataContent | undefined> {
        return Promise.resolve(undefined);
    }

    /**
     * Sends a withdrawal from the user's wallet, prompting for their PIN if they have one, and refreshes
     * the ledger's balance once it has gone. An address which is the account of a user id in a MultiUser
     * canister is refused without sending anything: no one can sign for it, so anything sent there is
     * lost, and since a withdrawal goes straight to the ledger nothing on the backend checks it.
     */
    async withdraw(withdrawal: Withdrawal): Promise<WithdrawOutcome> {
        if (isAccountOfMultiUserCanisterUserId(withdrawal.to)) {
            return { kind: "failed", message: i18nKey("cryptoAccount.sendToUserId") };
        }

        let outcome: WithdrawOutcome;
        try {
            const resp = await this.#sendWithdrawal(withdrawal);
            outcome = withdrawResult(resp, withdrawal.symbol);
            if (outcome.kind === "failed") {
                this.logMessage(`Unable to withdraw ${withdrawal.symbol}`, resp);
            }
        } catch (err) {
            // the user dismissed the PIN prompt
            if (err === "cancelled") return { kind: "cancelled" };
            this.logError(`Unable to withdraw ${withdrawal.symbol}`, err);
            return withdrawFailed(withdrawal.symbol);
        }

        if (outcome.kind === "sent") {
            this.refreshAccountBalance(withdrawal.ledger);
        }
        return outcome;
    }

    #sendWithdrawal({
        ledger,
        symbol,
        route,
        to,
        amount,
        fee,
    }: Withdrawal): Promise<
        WithdrawCryptocurrencyResponse | WithdrawBtcResponse | WithdrawSolResponse
    > {
        switch (route.kind) {
            case "ledger":
                return this.#withdrawCryptocurrency({
                    kind: "pending",
                    ledger,
                    token: symbol,
                    to,
                    amountE8s: amount,
                    feeE8s: fee,
                    createdAtNanos: BigInt(Date.now()) * 1_000_000n,
                });
            case "btc":
                return this.#withdrawBtc(to, amount);
            case "sol":
                return this.#withdrawSol(to, amount);
            case "one_sec":
                return this.#withdrawViaOneSec(ledger, symbol, route.chain, to, amount);
        }
    }

    async #withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
    ): Promise<WithdrawCryptocurrencyResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        return this.#worker.send({ kind: "withdrawCryptocurrency", domain, pin }).then((resp) => {
            if (resp.kind === "error") {
                const pinNumberFailure = pinNumberFailureFromError(resp);
                if (pinNumberFailure !== undefined) {
                    pinNumberFailureStore.set(pinNumberFailure);
                }
            }

            return resp;
        });
    }

    async getMessagesByMessageIndex(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageIndexes: number[],
    ): Promise<EventsResponse<Message>> {
        const serverChat = allServerChatsStore.value.get(chatId);
        const visit = eventsVisitFor(chatId, threadRootMessageIndex);

        try {
            const resp = await this.#worker
                .stream({
                    kind: "getMessagesByMessageIndex",
                    chatId,
                    threadRootMessageIndex,
                    messageIndexes,
                    latestKnownUpdate: serverChat?.lastUpdated,
                })
                .aggregate(mergeEventStreamResponses, emptyEventsResponse<Message>())
                .toPromise()
                .catch(CommonResponses.failure);

            if (isSuccessfulEventsResponse(resp)) {
                await this.#updateUserStoreFromEvents(visit, chatId, resp.events);
            }
            return resp;
        } catch {
            return CommonResponses.failure();
        }
    }

    /** The current invite link of a group or community, loaded from the backend if it is private */
    async getInviteLink(collection: MultiUserChat | CommunitySummary): Promise<InviteLinkOutcome> {
        const id = this.#inviteCodeId(collection);
        if (id === undefined) return this.#codelessInviteLink(collection);
        const resp = await this.#worker
            .send({ kind: "getInviteCode", id })
            .catch(CommonResponses.failure);
        return inviteCodeResult(resp, "invite.errorGettingLink");
    }

    async setInviteLinkEnabled(
        collection: MultiUserChat | CommunitySummary,
        enabled: boolean,
    ): Promise<InviteLinkOutcome> {
        const id = this.#inviteCodeId(collection);
        if (id === undefined) return this.#codelessInviteLink(collection);
        if (enabled) {
            const resp = await this.#worker
                .send({ kind: "enableInviteCode", id })
                .catch(CommonResponses.failure);
            return inviteCodeResult(resp, "invite.errorEnablingLink");
        }
        const resp = await this.#worker
            .send({ kind: "disableInviteCode", id })
            .catch(CommonResponses.failure);
        return disableInviteCodeResult(resp);
    }

    /** Replaces the invite code, so links shared with the old one stop working */
    async resetInviteLink(
        collection: MultiUserChat | CommunitySummary,
    ): Promise<InviteLinkOutcome> {
        const id = this.#inviteCodeId(collection);
        if (id === undefined) return this.#codelessInviteLink(collection);
        const resp = await this.#worker
            .send({ kind: "resetInviteCode", id })
            .catch(CommonResponses.failure);
        return inviteCodeResult(resp, "invite.errorResettingLink");
    }

    // Only private groups and communities have an invite code
    #inviteCodeId(
        collection: MultiUserChat | CommunitySummary,
    ): GroupChatIdentifier | CommunityIdentifier | undefined {
        if (collection.public || collection.id.kind === "channel") return undefined;
        return collection.id;
    }

    #codelessInviteLink(collection: MultiUserChat | CommunitySummary): InviteLink {
        return collection.public ? { kind: "public" } : { kind: "none" };
    }

    /**
     * Saves the changes the user has made to a group, sending only the fields that differ. A change the
     * user has to confirm (see `GroupChangeConfirmation`) and hasn't is returned for them to confirm
     * before anything is sent.
     */
    async updateGroup(
        original: CandidateGroupChat,
        candidate: CandidateGroupChat,
        confirmed: GroupChangeConfirmation[] = [],
    ): Promise<UpdateGroupOutcome> {
        const changes = groupChanges(original, candidate);
        if (Object.keys(changes).length === 0) return { kind: "unchanged" };

        const confirmation = groupChangeConfirmationNeeded(original, changes, confirmed);
        if (confirmation !== undefined) return { kind: "needs_confirmation", confirmation };

        const chatId = candidate.id;
        let resp: UpdateGroupResponse;
        try {
            resp = await this.#worker.send({
                kind: "updateGroup",
                chatId,
                name: changes.name,
                desc: changes.description,
                rules: changes.rules,
                permissions: changes.permissions,
                avatar: changes.avatar,
                eventsTimeToLive: changes.eventsTimeToLive,
                gateConfig: changes.gateConfig,
                isPublic: changes.isPublic,
                messagesVisibleToNonMembers: changes.messagesVisibleToNonMembers,
                externalUrl: changes.externalUrl,
            });
        } catch (err) {
            this.logError("Unable to update group", err);
            resp = { kind: "failure" };
        }

        if (resp.kind === "success") {
            localUpdates.updateChatProperties(
                chatId,
                changes.name,
                changes.description,
                changes.permissions,
                changes.gateConfig,
                changes.eventsTimeToLive,
                changes.isPublic,
            );

            if (changes.rules !== undefined && resp.rulesVersion !== undefined) {
                localUpdates.updateChatRules(chatId, {
                    text: changes.rules.text,
                    enabled: changes.rules.enabled,
                    version: resp.rulesVersion,
                });
            }
        } else {
            this.logMessage("Unable to update group", resp);
        }
        return groupUpdateResult(resp, candidate.level);
    }

    #isMultiUserChat(chat: ChatSummary): chat is MultiUserChat {
        return chat.kind === "group_chat" || chat.kind === "channel";
    }

    maskChatMessages(chat: ChatSummary): boolean {
        // notANonLapsedMember && (private || !messagesVisibleToNonMembers)
        return (
            this.#isMultiUserChat(chat) &&
            (chat.membership.role === ROLE_NONE || this.isLapsed(chat.id)) &&
            (!chat.public || !chat.messagesVisibleToNonMembers)
        );
    }

    // Creates a group, then invites `invitees` to it, and adds the community's members `toAdd` to a
    // new channel
    async createGroup(
        candidate: CandidateGroupChat,
        invitees: string[],
        toAdd: string[] = [],
    ): Promise<CreateGroupOutcome> {
        let resp: CreateGroupResponse;
        try {
            resp = await this.#worker.send({ kind: "createGroupChat", candidate });
        } catch (err) {
            this.logError("Unable to create group", err);
            return { kind: "failed", message: i18nKey("groupCreationFailed") };
        }
        if (resp.kind !== "success") {
            this.logMessage("Unable to create group", resp);
            return { kind: "failed", message: groupCreationFailure(resp, candidate.level) };
        }

        const chatId = resp.canisterId;
        const communityMemberCount =
            chatId.kind === "channel"
                ? communitiesStore.value.get({ kind: "community", communityId: chatId.communityId })
                      ?.memberCount
                : undefined;
        localUpdates.addChat(groupChatFromCandidate(chatId, candidate, communityMemberCount));

        if (invitees.length > 0) {
            const invited = await this.inviteUsers(chatId, invitees).catch((err) => {
                this.logError("Unable to invite users to a new group", err);
                return false;
            });
            if (!invited) {
                return {
                    kind: "created_without_invites",
                    chatId,
                    message: i18nKey("group.inviteUsersFailed", undefined, candidate.level, true),
                };
            }
        }
        if (chatId.kind === "channel" && toAdd.length > 0) {
            const added = await this.addMembersToChannel(chatId, toAdd);
            if (added.kind !== "success") {
                this.logMessage("Unable to add members to a new channel", added);
                return {
                    kind: "created_without_invites",
                    chatId,
                    message: i18nKey(
                        added.kind === "add_to_channel_partial_success"
                            ? "group.addMembersPartialSuccess"
                            : "group.addMembersFailed",
                    ),
                };
            }
        }
        return { kind: "created", chatId };
    }

    markThreadSummaryUpdated(threadRootMessageId: bigint, summary: Partial<ThreadSummary>): void {
        localUpdates.markThreadSummaryUpdated(threadRootMessageId, summary);
    }

    freezeCommunity(id: CommunityIdentifier, reason: string | undefined): Promise<boolean> {
        return this.#worker
            .send({ kind: "freezeCommunity", id, reason })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    unfreezeCommunity(id: CommunityIdentifier): Promise<boolean> {
        return this.#worker
            .send({ kind: "unfreezeCommunity", id })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    freezeGroup(chatId: GroupChatIdentifier, reason: string | undefined): Promise<boolean> {
        return this.#worker
            .send({ kind: "freezeGroup", chatId, reason })
            .then((resp) => {
                if (typeof resp !== "string") {
                    this.#onChatFrozen(chatId, resp);
                    return true;
                }
                return false;
            })
            .catch(() => false);
    }

    unfreezeGroup(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.#worker
            .send({ kind: "unfreezeGroup", chatId })
            .then((resp) => {
                if (typeof resp !== "string") {
                    this.#onChatFrozen(chatId, resp);
                    return true;
                }
                return false;
            })
            .catch(() => false);
    }

    deleteFrozenGroup(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.#worker
            .send({ kind: "deleteFrozenGroup", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    addHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.#worker
            .send({ kind: "addHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    removeHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.#worker
            .send({ kind: "removeHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    addRemoveSwapProvider(swapProvider: DexId, add: boolean): Promise<boolean> {
        return this.#worker.send({ kind: "addRemoveSwapProvider", swapProvider, add });
    }

    addMessageFilter(regex: string): Promise<boolean> {
        try {
            new RegExp(regex);
        } catch (e) {
            console.error("Unable to add message filter - invalid regex", regex);
            return Promise.resolve(false);
        }

        return this.#worker.send({ kind: "addMessageFilter", regex });
    }

    removeMessageFilter(id: bigint): Promise<boolean> {
        return this.#worker.send({ kind: "removeMessageFilter", id }).catch(() => false);
    }

    suspendUser(userId: string, reason: string): Promise<boolean> {
        return this.#worker
            .send({ kind: "suspendUser", userId, reason })
            .then((resp) => {
                if (resp === "success") {
                    userStore.userSuspended(userId, true);
                }
                return resp === "success";
            })
            .catch(() => false);
    }

    unsuspendUser(userId: string): Promise<boolean> {
        return this.#worker
            .send({ kind: "unsuspendUser", userId })
            .then((resp) => {
                if (resp === "success") {
                    userStore.userSuspended(userId, false);
                }
                return resp === "success";
            })
            .catch(() => false);
    }

    resolveModerationReport(
        reportIndex: bigint,
        verdict: ModerationVerdict,
        urgent: boolean | undefined,
    ): Promise<Success | OCError> {
        return this.#worker
            .send({ kind: "resolveModerationReport", reportIndex, verdict, urgent })
            .catch(() => ({ kind: "error", code: -1, message: undefined }) as OCError);
    }

    contestModerationSanction(): Promise<boolean> {
        return this.#worker.send({ kind: "contestModerationSanction" }).catch(() => false);
    }

    // Direct blob URL for reviewing non-quarantined reported media (content still live)
    reportedMediaUrl(ref: BlobReference): string {
        return buildBlobUrl(this.config.blobUrlPattern, ref.canisterId, ref.blobId, "blobs");
    }

    vaultFileChunk(
        bucketCanisterId: string,
        fileId: bigint,
        chunkIndex: number,
    ): Promise<VaultFileChunkResponse> {
        return this.#worker.send({ kind: "vaultFileChunk", bucketCanisterId, fileId, chunkIndex });
    }

    vaultFileInfo(bucketCanisterId: string, fileId: bigint): Promise<VaultFileInfoResponse> {
        return this.#worker.send({ kind: "vaultFileInfo", bucketCanisterId, fileId });
    }

    setCommunityModerationFlags(communityId: string, flags: number): Promise<boolean> {
        return this.#worker
            .send({ kind: "setCommunityModerationFlags", communityId, flags })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setGroupModerationFlags(chatId: string, flags: number): Promise<boolean> {
        return this.#worker
            .send({ kind: "setGroupModerationFlags", chatId, flags })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setGroupUpgradeConcurrency(value: number): Promise<boolean> {
        return this.#worker
            .send({ kind: "setGroupUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setCommunityUpgradeConcurrency(value: number): Promise<boolean> {
        return this.#worker
            .send({ kind: "setCommunityUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    // Platform operators only
    createMultiUserCanister(
        localUserIndexCanisterId: string,
    ): Promise<CreateMultiUserCanisterResponse> {
        return this.#worker
            .send({ kind: "createMultiUserCanister", localUserIndexCanisterId })
            .catch((err) => ({ kind: "internal_error", error: String(err) }));
    }

    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<boolean> {
        return this.#worker
            .send({ kind: "markLocalGroupIndexFull", canisterId, full })
            .catch(() => false);
    }

    setDiamondMembershipFees(fees: DiamondMembershipFees[]): Promise<boolean> {
        return this.#worker.send({ kind: "setDiamondMembershipFees", fees }).catch(() => false);
    }

    setAirdropConfig(
        channelId: number,
        channelName: string,
        communityId?: string,
        communityName?: string,
    ): Promise<boolean> {
        return this.#worker.send({
            kind: "setAirdropConfig",
            channelId,
            channelName,
            communityId,
            communityName,
        });
    }

    setTokenEnabled(ledger: string, enabled: boolean): Promise<boolean> {
        return this.#worker.send({ kind: "setTokenEnabled", ledger, enabled });
    }

    stakeNeuronForSubmittingProposals(
        governanceCanisterId: string,
        stake: bigint,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "stakeNeuronForSubmittingProposals",
                governanceCanisterId,
                stake,
            })
            .then((resp) => resp.kind === "success")
            .catch(() => false);
    }

    topUpNeuronForSubmittingProposals(
        governanceCanisterId: string,
        amount: bigint,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "topUpNeuronForSubmittingProposals",
                governanceCanisterId,
                amount,
            })
            .then((resp) => resp.kind === "success")
            .catch(() => false);
    }

    #onChatFrozen(
        chatId: MultiUserChatIdentifier,
        event: EventWrapper<ChatFrozenEvent | ChatUnfrozenEvent>,
    ): void {
        const frozen = event.event.kind === "chat_frozen";
        if (this.isPreviewing(chatId)) {
            const summary = localUpdates.groupChatPreviews.value.get(chatId);
            if (summary !== undefined) {
                localUpdates.addGroupPreview({ ...summary, frozen });
            }
        } else {
            localUpdates.updateChatFrozen(chatId, frozen);
            this.#addServerEventsToStores(selectedChatFor(chatId), chatId, [event], undefined, []);
        }
    }

    #userIdsFromChatSummaries(chats: ChatSummary[]): PartitionedUserIds {
        const userIds = new Set<string>();
        const webhooks = new Set<string>();
        chats.forEach((chat) => {
            if (chat.kind === "direct_chat") {
                userIds.add(chat.them?.userId ?? chat.id.userId);
            } else if (chat.latestMessage?.event !== undefined) {
                const sender = chat.latestMessage.event.sender;
                if (chat.latestMessage.event.senderContext?.kind === "webhook") {
                    webhooks.add(sender);
                } else {
                    userIds.add(sender);
                }
                userIds.add(chat.latestMessage.event.sender);
                this.extractUserIdsFromMentions(
                    getContentAsFormattedText(
                        (k) => k,
                        chat.latestMessage.event.content,
                        cryptoLookup.value,
                    ),
                ).forEach((id) => userIds.add(id));
            }
        });
        return {
            userIds,
            webhooks,
        };
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    async #updateUsers() {
        try {
            const now = BigInt(Date.now());
            const allUsers = userStore.allUsers;
            const usersToUpdate = new Set<string>();
            if (!anonUserStore.value) {
                usersToUpdate.add(currentUserIdStore.value);
            }

            const tenMinsAgo = now - BigInt(10 * ONE_MINUTE_MILLIS);
            for (const userId of this.#recentlyActiveUsersTracker.consume()) {
                const current = allUsers.get(userId);
                if (current === undefined || current.updated < tenMinsAgo) {
                    usersToUpdate.add(userId);
                }
                if (usersToUpdate.size >= 100) {
                    break;
                }
            }

            // Update all users we have direct chats with, other than those who've been deleted
            for (const chat of chatSummariesStore.value.values()) {
                if (chat.kind == "direct_chat" && !isDeletedUser(allUsers.get(chat.them.userId))) {
                    usersToUpdate.add(chat.them.userId);
                }
            }

            // Also update any users who haven't been updated for at least 24 hours
            const oneDayAgo = now - BigInt(24 * ONE_HOUR);
            for (const user of allUsers.values()) {
                if (user.updated < oneDayAgo) {
                    usersToUpdate.add(user.userId);
                    if (usersToUpdate.size >= MAX_USERS_TO_UPDATE_PER_BATCH) {
                        break;
                    }
                }
            }

            for (const userId of userStore.specialUsers) {
                usersToUpdate.delete(userId);
            }

            console.log(`getting updates for ${usersToUpdate.size} user(s)`);
            const userGroups = groupBy<string, bigint>(usersToUpdate, (u) => {
                return allUsers.get(u)?.updated ?? BigInt(0);
            });

            await this.getUsers({
                userGroups: Array.from(userGroups).map(([updatedSince, users]) => ({
                    users,
                    updatedSince,
                })),
            });
        } catch (err) {
            this.#logger.error("Error updating users", err as Error);
        }
    }

    async #handleChatsResponse(
        updateRegistryTask: Promise<void> | undefined,
        initialLoad: boolean,
        chatsResponse: UpdatesResult,
    ): Promise<void> {
        if (chatsResponse.suspensionChanged !== undefined) {
            publish("userSuspensionChanged");
            return;
        }

        if (updateRegistryTask !== undefined) {
            // We need the registry to be loaded before we attempt to render chats / events
            await updateRegistryTask;
        }

        const chatsAddedUpdated = (chatsResponse.directChatsAddedUpdated as ChatSummary[])
            .concat(chatsResponse.groupsAddedUpdated)
            .concat(chatsResponse.communitiesAddedUpdated.flatMap((c) => c.channels));

        const { userIds, webhooks } = this.#userIdsFromChatSummaries(chatsAddedUpdated);
        this.#getLatestMessagesBridgedUsers(chatsAddedUpdated);
        if (chatsResponse.referrals !== undefined) {
            for (const userId of chatsResponse.referrals.map((r) => r.userId)) {
                userIds.add(userId);
            }
        }
        if (!anonUserStore.value) {
            userIds.add(currentUserIdStore.value);
        }

        await this.getMissingUsers(userIds);

        // Held so the fold's answer can be compared with it: see `answerTouchesChat`
        const selectedBeforeFold = selectedServerChatSummaryStore.value;

        withPausedStores(() => {
            this.#updateReadUpToStore(chatsAddedUpdated);

            if (chatsResponse.blockedUsers !== undefined) {
                userStore.setBlockedUsers(chatsResponse.blockedUsers);
            }
            userStore.addWebhookIds([...webhooks]);

            // if the selected community has updates, reload the details
            const selectedCommunity = selectedCommunitySummaryStore.value;
            if (selectedCommunity !== undefined) {
                const updatedCommunity = chatsResponse.communitiesAddedUpdated.find(
                    (c) => c.id.communityId === selectedCommunity.id.communityId,
                );

                if (
                    updatedCommunity !== undefined &&
                    updatedCommunity.lastUpdated > selectedCommunity.lastUpdated
                ) {
                    this.#loadCommunityDetails(updatedCommunity);
                }
            }

            if (localUpdates.anyCommunityPreviews()) {
                // If we are now a member of a community we were previewing, remove the preview
                for (const community of chatsResponse.communitiesAddedUpdated) {
                    if (
                        community?.membership !== undefined &&
                        localUpdates.isPreviewingCommunity(community.id)
                    ) {
                        localUpdates.removeCommunityPreview(community.id);
                    }
                }
            }

            // Likewise drop any group / channel previews for chats we are now a member of
            // (e.g. one we were viewing anonymously before logging in), otherwise the preview
            // takes precedence over the server summary and we keep showing "Join"
            if (localUpdates.groupChatPreviews.value.size > 0) {
                for (const chat of chatsAddedUpdated) {
                    if (chat.kind !== "direct_chat" && !isPreviewing(chat)) {
                        localUpdates.removeGroupPreview(chat.id);
                    }
                }
            }

            if (localUpdates.anyUninitialisedDirectChats()) {
                for (const chat of chatsAddedUpdated) {
                    localUpdates.removeUninitialisedDirectChat(chat.id);
                }
            }

            if (chatsResponse.avatarId !== undefined) {
                const currentUser = userStore.get(currentUserIdStore.value);
                const blobReference =
                    chatsResponse.avatarId === "set_to_none"
                        ? undefined
                        : {
                              canisterId: currentUserIdStore.value,
                              blobId: chatsResponse.avatarId.value,
                          };
                if (currentUser) {
                    const user = {
                        ...currentUser,
                        blobReference,
                        blobData: undefined,
                        blobUrl: buildUserAvatarUrl(
                            this.config.blobUrlPattern,
                            currentUser.userId,
                            currentUser.blobReference?.blobId,
                        ),
                    };

                    userStore.addUser(this.#rehydrateDataContent(user, "avatar"));
                }
            }

            if (chatsResponse.pinNumberSettings !== undefined) {
                pinNumberRequiredStore.set(chatsResponse.pinNumberSettings !== "set_to_none");
            }

            OpenChat.setGlobalStateStores(
                chatsResponse.directChatsAddedUpdated,
                chatsResponse.groupsAddedUpdated,
                chatsResponse.communitiesAddedUpdated,
                chatsResponse.directChatsRemoved,
                chatsResponse.groupsRemoved,
                chatsResponse.communitiesRemoved,
                chatsResponse.favouriteChats,
                chatsResponse.pinnedChats,
                chatsResponse.pinnedChannels,
                chatsResponse.pinnedFavouriteChats,
                chatsResponse.achievements,
                chatsResponse.chitState,
                chatsResponse.referrals,
                chatsResponse.walletConfig,
                chatsResponse.messageActivitySummary,
                chatsResponse.installedBots,
                chatsResponse.streakInsurance,
                chatsResponse.premiumItems,
            );
        });

        // An archived chat that has unread messages comes out of the archive, whatever the scope.
        // Only the chats in this answer can have gained any
        unarchiveChatsWithUnread(
            chatsAddedUpdated.map((chat) => chat.id),
            this.#unarchiving,
            (chatIds) => this.unarchiveChats(chatIds),
        );

        const selectedChatId = selectedChatIdStore.value;
        if (selectedChatId !== undefined) {
            if (chatSummariesStore.value.get(selectedChatId) === undefined) {
                publish("selectedChatInvalid");
            } else {
                const updatedEvents =
                    ChatMap.fromMap(chatsResponse.updatedEvents).get(selectedChatId) ?? [];
                // An answer that did not change the selected chat (a CHIT balance, another
                // chat's message, another channel in its community) has nothing new for it: no
                // latest message to confirm, no events to refresh
                if (
                    answerTouchesChat(
                        selectedChatId,
                        selectedBeforeFold,
                        chatsAddedUpdated,
                        updatedEvents.length,
                    )
                ) {
                    this.#chatUpdated(selectedChatId, updatedEvents);
                } else {
                    // Every answer used to reload the details, which is what retried a load that
                    // failed (offline, say) or came from a lagging replica. Only a retry is
                    // needed here, so only when the details held are not this chat's latest.
                    const serverChat = selectedServerChatSummaryStore.value;
                    if (serverChat !== undefined && this.#chatDetailsBehind(serverChat)) {
                        this.#loadChatDetails(selectedChatFor(serverChat.id), serverChat);
                    }
                    // Still published: the timeline answers it by loading any new messages it
                    // is missing, and does nothing if there are none, so a load that failed
                    // earlier gets another go
                    publish("chatUpdated", {
                        chatId: selectedChatId,
                        threadRootMessageIndex: undefined,
                    });
                }
            }
        }

        for (const chat of chatsAddedUpdated) {
            const vc = chat.videoCallInProgress;
            if (vc !== undefined) {
                if (this.#serverVideoCallsInProgress.get(chat.id) !== vc.messageId) {
                    this.#serverVideoCallsInProgress.set(chat.id, vc.messageId);
                    this.#publishRemoteVideoCallStarted({
                        chatId: chat.id,
                        userId: vc.startedBy,
                        messageId: vc.messageId,
                        currentUserIsParticipant: vc.joinedByCurrentUser,
                        callType: vc.callType,
                        timestamp: vc.started,
                    });
                }
            } else {
                const videoCallMessageId = this.#serverVideoCallsInProgress.get(chat.id);
                if (videoCallMessageId !== undefined) {
                    this.#serverVideoCallsInProgress.delete(chat.id);
                    this.#publishRemoteVideoCallEnded(videoCallMessageId);
                }
            }
        }

        this.#closeNotificationsIfNecessary();

        if (chatsResponse.newAchievements.length > 0) {
            publish("chitEarned", chatsResponse.newAchievements);
        }

        if (initialLoad) {
            this.#startExchangeRatePoller();
            if (!anonUserStore.value) {
                this.#initWebRtc();
                startMessagesReadTracker(this);
                this.refreshSwappableTokens();
                // Previous wallets are checked once the balances have refreshed, since checking
                // them queries every token too
                window.setTimeout(
                    () =>
                        this.refreshBalancesInSeries().finally(() => {
                            this.#movePreviousWalletFunds();
                            this.#recoverUnfinishedTokenSwaps();
                        }),
                    1000,
                );
            }

            // horribly enough - we need to slightly defer this so that all the cascade of derived stuff is complete
            // I am hopeful that we can remove this when we aren't manually synchronising runes & stores
            tick().then(() => {
                chatsInitialisedStore.set(true);
            });
        }

        if (chatsResponse.bitcoinAddress !== undefined) {
            bitcoinAddress.set(chatsResponse.bitcoinAddress);
        }
        if (chatsResponse.oneSecAddress !== undefined) {
            oneSecAddress.set(chatsResponse.oneSecAddress);
        }
        if (chatsResponse.solanaAddress !== undefined) {
            solanaAddress.set(chatsResponse.solanaAddress);
        }
    }

    static setGlobalStateStores(
        directChatsAddedUpdated: DirectChatSummary[],
        groupsAddedUpdated: GroupChatSummary[],
        communitiesAddedUpdated: CommunitySummary[],
        directChatsRemoved: string[],
        groupsRemoved: string[],
        communitiesRemoved: string[],
        favourites: ChatIdentifier[] | undefined,
        pinnedChats: ChatIdentifier[] | undefined,
        pinnedChannels: ChannelIdentifier[] | undefined,
        pinnedFavourites: ChatIdentifier[] | undefined,
        achievements: Set<string> | undefined,
        chitState: ChitState | undefined,
        referrals: Referral[] | undefined,
        walletConfig: WalletConfig | undefined,
        messageActivitySummary: MessageActivitySummary | undefined,
        installedBots: Map<string, GrantedBotPermissions> | undefined,
        streakInsurance: OptionUpdate<StreakInsurance>,
        premiumItems: Set<PremiumItem> | undefined,
    ): void {
        if (directChatsAddedUpdated.length > 0 || directChatsRemoved.length > 0) {
            serverDirectChatsStore.update((map) => {
                for (const chat of directChatsAddedUpdated) {
                    map.set(chat.id, chat);
                }
                for (const id of directChatsRemoved) {
                    map.delete({ kind: "direct_chat", userId: id });
                }
                return map;
            });
        }
        if (groupsAddedUpdated.length > 0 || groupsRemoved.length > 0) {
            serverGroupChatsStore.update((map) => {
                for (const chat of groupsAddedUpdated) {
                    map.set(chat.id, chat);
                }
                for (const id of groupsRemoved) {
                    map.delete({ kind: "group_chat", groupId: id });
                }
                return map;
            });
        }
        if (communitiesAddedUpdated.length > 0 || communitiesRemoved.length > 0) {
            serverCommunitiesStore.update((map) => {
                for (const community of communitiesAddedUpdated) {
                    map.set(community.id, community);
                }
                for (const id of communitiesRemoved) {
                    map.delete({ kind: "community", communityId: id });
                }
                return map;
            });
        }
        if (favourites !== undefined) {
            serverFavouritesStore.set(new ChatSet(favourites));
        }

        if (pinnedChats !== undefined) {
            serverPinnedChatsStore.update((map) => map.set("chats", [...pinnedChats.values()]));
        }

        if (pinnedChannels !== undefined) {
            serverPinnedChatsStore.update((map) => map.set("community", pinnedChannels));
        }
        if (pinnedFavourites !== undefined) {
            serverPinnedChatsStore.update((map) => map.set("favourite", pinnedFavourites));
        }
        if (achievements !== undefined) {
            achievementsStore.set(achievements);
        }
        if (messageActivitySummary !== undefined) {
            serverMessageActivitySummaryStore.set(messageActivitySummary);
        }
        if (referrals !== undefined) {
            referralsStore.set(referrals);
        }
        if (installedBots !== undefined) {
            serverDirectChatBotsStore.set(installedBots);
        }
        if (walletConfig !== undefined) {
            serverWalletConfigStore.set(walletConfig);
        }
        if (streakInsurance !== undefined) {
            serverStreakInsuranceStore.set(
                streakInsurance === "set_to_none"
                    ? { daysInsured: 0, daysMissed: 0 }
                    : streakInsurance.value,
            );
        }
        if (premiumItems !== undefined) {
            premiumItemsStore.set(premiumItems);
        }
        if (chitState !== undefined) {
            // The balances are authoritative whatever the streak says: the streakEnds gate
            // exists so a stale streak (eg. from a response that raced a local claim) cannot
            // roll the streak back, but a stale balance was never protected by it, only left
            // to drift. Apply the balances unconditionally and gate only the streak fields.
            OpenChat.#setChitBalance(chitState.chitBalance, chitState.totalChitEarned);
            if (chitState.streakEnds >= chitStateStore.value.streakEnds) {
                chitStateStore.set(chitState);
                userStore.updateUser(currentUserIdStore.value, (user) => ({
                    ...user,
                    streak: chitState.streak,
                    maxStreak: chitState.maxStreak,
                }));
            }
        }
    }

    #botsLoaded = false;

    async #loadBots() {
        return new Promise<void>((resolve) => {
            this.#worker
                .stream({
                    kind: "getBots",
                    initialLoad: !this.#botsLoaded,
                })
                .subscribe({
                    onResult: async ({ bots }) => {
                        botState.setExternalBots(bots);
                        this.#botsLoaded = true;
                    },
                    onError: (err) => {
                        console.warn("getBots threw an error: ", err);
                        resolve();
                    },
                    onEnd: () => {
                        resolve();
                    },
                });
        });
    }

    // Runs one pass of the updates loop in the worker. On an initial load the worker answers
    // with a snapshot of its cache which seeds the sync cursor; everything after that reaches
    // the UI by pulling (see SyncPuller), so the pass itself resolves nothing.
    async #loadChats() {
        const initialLoad = !chatsInitialisedStore.value;

        const updateRegistryTask = initialLoad ? this.#updateRegistry() : undefined;
        // Taken before the load starts: if the identity changes while it is in flight, the
        // snapshot it delivers belongs to the old session and the puller drops it
        const generation = this.#syncPuller.generation;

        return new Promise<void>((resolve) => {
            // The stream ends without waiting for an async onResult, so the pass is only done
            // once the snapshot it delivered has been folded. Otherwise the poller would count
            // it finished, and could start the next, while the fold is still running.
            let folding: Promise<void> = Promise.resolve();
            const done = () => folding.then(resolve);
            this.#worker
                .stream({
                    kind: "getUpdates",
                    initialLoad,
                })
                .subscribe({
                    onResult: (snapshot) => {
                        folding = folding
                            .then(async () => {
                                if (snapshot !== undefined) {
                                    await this.#syncPuller.seed(
                                        snapshot,
                                        (updates) =>
                                            this.#handleChatsResponse(
                                                updateRegistryTask,
                                                initialLoad,
                                                updates,
                                            ),
                                        generation,
                                    );
                                }
                                latestSuccessfulUpdatesLoop.set(Date.now());
                            })
                            .catch((err) => console.warn("Failed to fold the chats snapshot", err));
                    },
                    onError: (err) => {
                        console.warn("getUpdates threw an error: ", err);
                        done();
                    },
                    onEnd: () => {
                        done();
                    },
                });
        });
    }

    async #getLastOnlineDatesBatched(userIds: string[]): Promise<Record<string, number>> {
        userIds.forEach((u) => this.#lastOnlineDatesPending.add(u));
        if (this.#lastOnlineDatesPromise === undefined) {
            // Wait 50ms so that the last online dates can be retrieved in a single batch
            this.#lastOnlineDatesPromise = new Promise((resolve) =>
                window.setTimeout(resolve, 50),
            ).then((_) => this.#processLastOnlineDatesQueue());
        }

        return this.#lastOnlineDatesPromise;
    }

    async #processLastOnlineDatesQueue(): Promise<Record<string, number>> {
        const userIds = [...this.#lastOnlineDatesPending];
        this.#lastOnlineDatesPromise = undefined;
        this.#lastOnlineDatesPending.clear();

        try {
            const response = await this.#worker.send({ kind: "lastOnline", userIds });
            // for any userIds that did not come back in the response set the lastOnline value to 0
            // we still want to capture a value so that we don't keep trying to look up the same user over and over
            const updates = userIds.reduce(
                (updates, userId) => {
                    updates[userId] = response[userId] ?? 0;
                    return updates;
                },
                {} as Record<string, number>,
            );
            lastOnlineDates.set(Object.entries(updates), Date.now());
            return updates;
        } catch {
            return {};
        }
    }

    #updateReadUpToStore(chatSummaries: ChatSummary[]): void {
        withPausedStores(() => {
            for (const chat of chatSummaries) {
                if (chat.kind === "group_chat" || chat.kind === "channel") {
                    const threads: ThreadRead[] = (chat.membership?.latestThreads ?? []).reduce(
                        (res, next) => {
                            if (next.readUpTo !== undefined) {
                                res.push({
                                    threadRootMessageIndex: next.threadRootMessageIndex,
                                    readUpTo: next.readUpTo,
                                });
                            }
                            return res;
                        },
                        [] as ThreadRead[],
                    );

                    messagesRead.syncWithServer(
                        chat.id,
                        chat.membership?.readByMeUpTo,
                        threads,
                        chat.dateReadPinned,
                    );
                } else {
                    messagesRead.syncWithServer(
                        chat.id,
                        chat.membership?.readByMeUpTo,
                        [],
                        undefined,
                    );
                }

                this.#markReadIfLatestMessageOwn(chat);
            }
        });
    }

    // If the latest message in a chat is the current user's, then we know they must have read up to
    // that message, so we mark the chat as read up to that message if it isn't already. This
    // happens when a user sends a message on one device then looks at OpenChat on another, or sends
    // it from an account they've linked on another platform, eg. Telegram.
    #markReadIfLatestMessageOwn(chat: ChatSummary): void {
        const latestMessage = chat.latestMessage?.event;
        if (
            latestMessage !== undefined &&
            !isPreviewing(chat) &&
            isOwnMessage(latestMessage, currentUserIdStore.value, bridgedUsersStore.value) &&
            (chat.membership?.readByMeUpTo ?? -1) < latestMessage.messageIndex &&
            !localUpdates.isUnconfirmed({ chatId: chat.id }, latestMessage.messageId)
        ) {
            messagesRead.markReadUpTo({ chatId: chat.id }, latestMessage.messageIndex);
        }
    }

    // The user's messages relayed from an account they've linked are read, like those they send.
    // But the link only becomes known once the account's profile has been fetched, which can be
    // after the messages have loaded, so they're marked read again then.
    #markLoadedOwnMessagesRead(): void {
        const myUserId = currentUserIdStore.value;
        const bridgedUsers = bridgedUsersStore.value;
        const markRead = (context: MessageContext, events: EventWrapper<ChatEvent>[]) => {
            for (const e of events) {
                if (e.event.kind === "message") {
                    this.#markReadIfOwn(context, e.event, myUserId, bridgedUsers);
                }
            }
        };
        withPausedStores(() => {
            const chatVisit = currentChatVisit();
            if (chatVisit !== undefined) {
                markRead({ chatId: chatVisit.chatId }, serverEventsStore.value);
            }
            const threadVisit = currentThreadVisit();
            if (threadVisit !== undefined) {
                const { chatId, threadRootMessageIndex } = threadVisit;
                markRead({ chatId, threadRootMessageIndex }, serverThreadEventsStore.value);
            }
            allChatsStore.value.forEach((chat) => this.#markReadIfLatestMessageOwn(chat));
        });
    }

    // The current user's messages are read, including those relayed from an account they've
    // linked. Not in a chat they're only previewing, which has no read state on the server to sync
    // with, so it would be sent again every time.
    #markReadIfOwn(
        context: MessageContext,
        message: Message,
        myUserId: string,
        bridgedUsers: Map<string, BridgedUserSummary>,
    ): void {
        if (
            isOwnMessage(message, myUserId, bridgedUsers) &&
            !messagesRead.isRead(context, message.messageIndex, message.messageId) &&
            !this.isPreviewing(context.chatId)
        ) {
            messagesRead.markMessageRead(context, message.messageIndex, message.messageId);
        }
    }

    claimPrize(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        e: MouseEvent,
        signInProof: string | undefined,
    ): Promise<boolean> {
        if (!isTrustedClick(e)) {
            return Promise.resolve(false);
        }

        return this.#worker
            .send({ kind: "claimPrize", chatId, messageId, signInProof })
            .then((resp) => {
                if (resp.kind !== "success") {
                    return false;
                } else {
                    localUpdates.markPrizeClaimed(messageId);
                    return true;
                }
            })
            .catch(() => false);
    }

    // `token1` and `token1Amount` are what accepting the swap costs, as the swap's message has them
    async acceptP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        token1: TokenInfo,
        token1Amount: bigint,
        fromAccount?: string,
    ): Promise<AcceptP2PSwapResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const undo = localUpdates.setP2PSwapStatus(messageId, {
            kind: "p2p_swap_reserved",
            reservedBy: currentUserIdStore.value,
        });

        const newAchievement = !achievementsStore.value.has("accepted_swap_offer");

        return this.#worker
            .send({
                kind: "acceptP2PSwap",
                chatId,
                threadRootMessageIndex,
                messageId,
                token1,
                token1Amount,
                pin,
                newAchievement,
                fromAccount,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.setP2PSwapStatus(messageId, {
                        kind: "p2p_swap_accepted",
                        acceptedBy: currentUserIdStore.value,
                        token1TxnIn: resp.token1TxnIn,
                    });
                }

                if (resp.kind === "error") {
                    const pinNumberFailure = pinNumberFailureFromError(resp);
                    if (pinNumberFailure !== undefined) {
                        pinNumberFailureStore.set(pinNumberFailure);
                    }
                    undo();
                }

                return resp;
            })
            .catch((err) => {
                undo();
                return { kind: "internal_error", text: err.toString() };
            });
    }

    cancelP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        const undo = localUpdates.setP2PSwapStatus(messageId, {
            kind: "p2p_swap_cancelled",
        });
        return this.#worker
            .send({
                kind: "cancelP2PSwap",
                chatId,
                threadRootMessageIndex,
                messageId,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.setP2PSwapStatus(messageId, {
                        kind: "p2p_swap_cancelled",
                    });
                } else {
                    undo();
                }
                return resp;
            })
            .catch((err) => {
                undo();
                return { kind: "internal_error", text: err.toString() };
            });
    }

    #joinVideoCall(chatId: ChatIdentifier, messageId: bigint): Promise<JoinVideoCallResponse> {
        const newAchievement = !achievementsStore.value.has("joined_call");

        return this.#worker.send({
            kind: "joinVideoCall",
            chatId,
            messageId,
            newAchievement,
        });
    }

    setVideoCallPresence(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        presence: VideoCallPresence,
    ): Promise<boolean> {
        const newAchievement = !achievementsStore.value.has("joined_call");

        return this.#worker
            .send({
                kind: "setVideoCallPresence",
                chatId,
                messageId,
                presence,
                newAchievement,
            })
            .then((resp) => resp.kind === "success")
            .catch(() => false);
    }

    #publishRemoteVideoCallStarted(event: PubSubEvents["remoteVideoCallStarted"]) {
        if (this.#videoCallsInProgress.add(event.messageId)) {
            publish("remoteVideoCallStarted", event);
        }
    }

    #publishRemoteVideoCallEnded(messageId: bigint) {
        if (this.#videoCallsInProgress.delete(messageId)) {
            publish("remoteVideoCallEnded", messageId);
        }
    }

    // FIXME - should this input param be a Map
    #mapVideoCallParticipants(
        usrs: Record<string, UserSummary>,
        participant: VideoCallParticipant,
    ): Record<string, UserSummary> {
        const user = userStore.get(participant.userId);
        if (user) {
            usrs[participant.userId] = user;
        }
        return usrs;
    }

    videoCallParticipants(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        updatesSince: bigint,
    ): Promise<{
        participants: Record<string, UserSummary>;
        hidden: Record<string, UserSummary>;
        lastUpdated: bigint;
    }> {
        return this.#worker
            .send({
                kind: "videoCallParticipants",
                chatId,
                messageId,
                updatesSince,
            })
            .then(async (resp) => {
                if (resp.kind === "success") {
                    const allUserIds = [
                        ...resp.participants.map((u) => u.userId),
                        ...resp.hidden.map((u) => u.userId),
                    ];
                    await this.getMissingUsers(allUserIds);

                    return {
                        participants: resp.participants.reduce<Record<string, UserSummary>>(
                            (u, p) => this.#mapVideoCallParticipants(u, p),
                            {},
                        ),
                        hidden: resp.hidden.reduce<Record<string, UserSummary>>(
                            (u, p) => this.#mapVideoCallParticipants(u, p),
                            {},
                        ),
                        lastUpdated: resp.lastUpdated,
                    };
                } else {
                    return {
                        participants: {},
                        hidden: {},
                        lastUpdated: updatesSince,
                    };
                }
            })
            .catch((_) => ({
                participants: {},
                hidden: {},
                lastUpdated: updatesSince,
            }));
    }

    #updateDiamondStatusInUserStore(status: DiamondMembershipStatus): void {
        userStore.updateUser(currentUserIdStore.value, (user) => {
            const changed = status.kind !== user.diamondStatus;
            return changed ? { ...user, diamondStatus: status.kind } : undefined;
        });
    }

    // The current user's id changes if their account is deleted and a new one created on the same
    // principal. The session (the user client, the chats and everything else keyed by user id) was
    // built for the old one, so rather than swap the id out from under it, we have the app restart
    // under the new one. Returns whether the id has changed.
    #currentUserIdChanged(userId: string): boolean {
        const currentUserId = currentUserStore.value.userId;
        if (currentUserId === ANON_USER_ID || currentUserId === userId) return false;

        if (!this.#currentUserIdChangedPublished) {
            this.#currentUserIdChangedPublished = true;
            if (shouldRestartForNewUserId(currentUserId, userId)) {
                this.#logger.log("Current user id changed, restarting the session", {
                    from: currentUserId,
                    to: userId,
                });
                publish("currentUserIdChanged");
            } else {
                // We've already restarted for this change, yet the session started under the old
                // id again, so caching the new one must have failed. The session carries on under
                // the old id rather than restarting over and over.
                this.#logger.error(
                    "Current user id changed again after restarting for it",
                    new Error("Current user id changed"),
                    { from: currentUserId, to: userId },
                );
            }
        }
        return true;
    }

    #setDiamondStatus(status: DiamondMembershipStatus): void {
        const now = Date.now();
        this.#updateDiamondStatusInUserStore(status);
        if (status.kind === "active") {
            const expiry = Number(status.expiresAt);
            if (expiry > now) {
                if (this.#membershipCheck !== undefined) {
                    window.clearTimeout(this.#membershipCheck);
                }
                const interval = expiry - now;
                this.#membershipCheck = window.setTimeout(
                    () => {
                        this.getCurrentUser().then((user) => {
                            if (user.kind === "created_user") {
                                if (!this.#currentUserIdChanged(user.userId)) {
                                    currentUserStore.set(user);
                                }
                            } else {
                                this.logout();
                            }
                        });
                        this.#membershipCheck = undefined;
                    },
                    Math.min(MAX_INT32, interval),
                );
            }
        }
    }

    diamondMembershipFees(): Promise<DiamondMembershipFees[]> {
        return this.#worker
            .send({
                kind: "diamondMembershipFees",
            })
            .catch(() => []);
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this.#worker.send({
            kind: "reportedMessages",
            userId,
        });
    }

    // Opens the given wallet and asks it to approve OpenChat spending `amount` of `ledger`, so that
    // the payment which follows can be pulled straight from it. Returns the account to pass as that
    // payment's `fromAccount`, or undefined if the user backed out.
    //
    // `amount` must include the transfer fee, which the ledger charges against the allowance on top
    // of the amount moved. `chatId` is the chat a payment in a message or a tip is made in, which
    // decides what pulls it, so what the wallet approves (see `paymentSpenderAccount`).
    //
    // Call this directly from a click handler and await nothing first: the wallet opens in a popup,
    // which browsers only allow while the click which asked for it is still being handled.
    approveExternalWalletSpending(
        wallet: SignerWallet,
        ledger: string,
        amount: bigint,
        chatId: ChatIdentifier | undefined,
        chooseAccount: (accounts: WalletAccount[]) => Promise<WalletAccount | undefined>,
        onApproving?: () => void,
    ): Promise<string | undefined> {
        return approveFromExternalWallet(
            {
                wallet,
                ledger,
                amount,
                spender: paymentSpenderAccount(
                    currentUserIdStore.value,
                    chatId,
                    () => this.OcIdentityPrincipal,
                ),
            },
            this.config.icUrl ?? window.location.origin,
            chooseAccount,
            onApproving,
        );
    }

    async payForDiamondMembership(
        ledger: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
        fromAccount?: string,
    ): Promise<PayForDiamondMembershipResponse> {
        // The user approves the payment from their wallet, which is only approved once their PIN
        // is checked. A payment from another account approves nothing.
        let pin: string | undefined = undefined;
        if (pinNumberRequiredStore.value && fromAccount === undefined) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        return this.#worker
            .send({
                kind: "payForDiamondMembership",
                userId: currentUserIdStore.value,
                ledger,
                duration,
                recurring,
                expectedPriceE8s,
                fromAccount,
                pin,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    currentUserStore.set({
                        ...currentUserStore.value,
                        diamondStatus: resp.status,
                    });
                    this.#setDiamondStatus(resp.status);
                } else if (resp.kind === "error") {
                    const pinNumberFailure = pinNumberFailureFromError(resp);
                    if (pinNumberFailure !== undefined) {
                        pinNumberFailureStore.set(pinNumberFailure);
                    }
                }
                return resp;
            })
            .catch(() => ({ kind: "internal_error" }));
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "setMessageReminder",
                chatId,
                eventIndex,
                remindAt,
                notes,
                threadRootMessageIndex,
            })
            .then((res) => {
                return res.kind === "success";
            })
            .catch(() => false);
    }

    cancelMessageReminder(
        messageId: bigint,
        content: MessageReminderCreatedContent,
    ): Promise<boolean> {
        const undo = localUpdates.markCancelledReminder(messageId, content);
        return this.#worker
            .send({
                kind: "cancelMessageReminder",
                reminderId: content.reminderId,
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    reportMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
        csam: boolean,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "reportMessage",
                chatId,
                threadRootMessageIndex,
                messageId,
                deleteMessage,
                csam,
            })
            .catch(() => false);
    }

    declineInvitation(chatId: MultiUserChatIdentifier): Promise<boolean> {
        return this.#worker
            .send({ kind: "declineInvitation", chatId })
            .then((res) => {
                return res.kind === "success";
            })
            .catch(() => false);
    }

    displayName(user?: UserSummary): string {
        return user !== undefined
            ? `${user?.displayName ?? user?.username}`
            : this.config.i18nFormatter("unknownUser");
    }

    hasModerationFlag(flags: number, flag: ModerationFlag): boolean {
        return hasFlag(flags, flag);
    }

    proposeSetOpenAIApiKey(
        apiKey: string | undefined,
    ): Promise<ProposedProtectedAction | undefined> {
        return this.#worker.send({ kind: "proposeSetOpenAIApiKey", apiKey }).catch(() => undefined);
    }

    vaultBuckets(): Promise<string[]> {
        return this.#worker.send({ kind: "vaultBuckets" }).catch(() => []);
    }

    vaultLog(
        bucketCanisterId: string,
        start: bigint,
        max: number,
        fileId?: bigint,
    ): Promise<VaultLogResponse> {
        return this.#worker.send({ kind: "vaultLog", bucketCanisterId, start, max, fileId });
    }

    moderationConfig(): Promise<ModerationConfig | undefined> {
        return this.#worker.send({ kind: "moderationConfig" }).catch(() => undefined);
    }

    authorityReports(): Promise<string | undefined> {
        return this.#worker.send({ kind: "authorityReports" }).catch(() => undefined);
    }

    recordAuthorityReportFiled(
        reportIndex: bigint,
        portalReference: string,
        urgent: boolean,
        unverified: boolean,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "recordAuthorityReportFiled",
                reportIndex,
                portalReference,
                urgent,
                unverified,
            })
            .catch(() => false);
    }

    clearAuthorityReportAttempt(reportIndex: bigint): Promise<boolean> {
        return this.#worker
            .send({ kind: "clearAuthorityReportAttempt", reportIndex })
            .catch(() => false);
    }

    authorityReportToken(
        reportIndex: bigint,
        priority: NcaPriority,
        reporter: NcaReporterContact,
        oohCallAcknowledged: boolean,
    ): Promise<AuthorityReportTokenResponse> {
        return this.#worker
            .send({
                kind: "authorityReportToken",
                reportIndex,
                priority,
                reporter,
                oohCallAcknowledged,
            })
            .catch((err) => ({ kind: "error", message: String(err) }) as const);
    }

    proposeSetVaultLegalHold(
        reportIndex: bigint,
        legalHold: boolean,
        reference: string,
    ): Promise<ProposedProtectedAction | undefined> {
        return this.#worker
            .send({ kind: "proposeSetVaultLegalHold", reportIndex, legalHold, reference })
            .catch(() => undefined);
    }

    proposeSetVaultReviewers(userIds: string[]): Promise<ProposedProtectedAction | undefined> {
        return this.#worker
            .send({ kind: "proposeSetVaultReviewers", userIds })
            .catch(() => undefined);
    }

    proposeSetMediaScanConfig(
        enabled: boolean,
        scanners: string[],
    ): Promise<ProposedProtectedAction | undefined> {
        return this.#worker
            .send({ kind: "proposeSetMediaScanConfig", enabled, scanners })
            .catch(() => undefined);
    }

    proposeSetAuthorityReporter(
        principal: string | undefined,
    ): Promise<ProposedProtectedAction | undefined> {
        return this.#worker
            .send({ kind: "proposeSetAuthorityReporter", principal })
            .catch(() => undefined);
    }

    confirmProtectedAction(actionId: bigint): Promise<Success | OCError> {
        return this.#worker
            .send({ kind: "confirmProtectedAction", actionId })
            .catch(() => ({ kind: "error", code: -1, message: undefined }) as OCError);
    }

    cancelProtectedAction(actionId: bigint): Promise<Success | OCError> {
        return this.#worker
            .send({ kind: "cancelProtectedAction", actionId })
            .catch(() => ({ kind: "error", code: -1, message: undefined }) as OCError);
    }

    protectedActions(): Promise<string | undefined> {
        return this.#worker.send({ kind: "protectedActions" }).catch(() => undefined);
    }

    setVaultLegalHold(
        reportIndex: bigint,
        legalHold: boolean,
        reference: string,
    ): Promise<boolean> {
        return this.#worker
            .send({ kind: "setVaultLegalHold", reportIndex, legalHold, reference })
            .catch(() => false);
    }

    proposeDestroyVaultEvidence(
        reportIndex: bigint,
        leRequestRef: string,
    ): Promise<ProposedProtectedAction | undefined> {
        return this.#worker
            .send({ kind: "proposeDestroyVaultEvidence", reportIndex, leRequestRef })
            .catch(() => undefined);
    }

    setModerationReferralConfig(
        config: { categories: { category: number; scoreThreshold: number }[] } | undefined,
    ): Promise<boolean> {
        return this.#worker
            .send({ kind: "setModerationReferralConfig", config })
            .catch(() => false);
    }

    proposeSetInternalModerationChannel(
        channel: { communityId: string; channelId: number } | undefined,
    ): Promise<ProposedProtectedAction | undefined> {
        return this.#worker
            .send({ kind: "proposeSetInternalModerationChannel", channel })
            .catch(() => undefined);
    }

    async setModerationFlags(flags: number): Promise<number> {
        const previousValue = moderationFlagsEnabledStore.value;
        currentUserStore.set({
            ...currentUserStore.value,
            moderationFlagsEnabled: flags,
        });

        const saved = await this.#worker
            .send({
                kind: "setModerationFlags",
                flags,
            })
            .catch(() => false);
        if (saved) return flags;

        currentUserStore.set({
            ...currentUserStore.value,
            moderationFlagsEnabled: previousValue,
        });
        return previousValue;
    }

    /**
     * Tips a message, prompting for the user's PIN if they have one. The tip shows on the message
     * straight away and is taken off again if it fails. The ledger's balance is refreshed once it
     * has gone.
     */
    async tipMessage(
        messageContext: MessageContext,
        message: Message,
        transfer: PendingCryptocurrencyTransfer,
    ): Promise<TipOutcome> {
        const chat = chatSummariesStore.value.get(messageContext.chatId);
        if (chat === undefined) return tipResult({ kind: "failure" });

        let pin: string | undefined = undefined;
        if (pinNumberRequiredStore.value) {
            try {
                pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
            } catch {
                // the user dismissed the PIN prompt
                return { kind: "cancelled" };
            }
        }

        const userId = currentUserIdStore.value;
        const totalTip = transfer.amountE8s + currentTip(message, transfer.ledger, userId);
        const decimals = cryptoLookup.value.get(transfer.ledger)?.decimals ?? 0;
        const undo = localUpdates.markTip(message.messageId, transfer.ledger, userId, totalTip);

        let resp: TipMessageResponse;
        try {
            resp = await this.#worker.send({
                kind: "tipMessage",
                messageContext,
                messageId: message.messageId,
                transfer,
                decimals,
                pin,
                username: currentUserStore.value.username,
                displayName: currentUserStore.value.displayName,
                newAchievement: !achievementsStore.value.has("tipped_message"),
            });
        } catch (err) {
            this.logError("Unable to tip message", err);
            resp = { kind: "failure" };
        }

        if (resp.kind === "success") {
            this.refreshAccountBalance(transfer.ledger, false);
        } else {
            undo();
            if (resp.kind === "error") {
                const pinNumberFailure = pinNumberFailureFromError(resp);
                if (pinNumberFailure !== undefined) {
                    pinNumberFailureStore.set(pinNumberFailure);
                }
            }
        }
        return tipResult(resp);
    }

    /**
     * Sends tokens to a user in a message, prompting for the user's PIN if they have one. The
     * ledger's balance is refreshed once the transfer has gone.
     */
    async sendCryptoTransfer(
        messageContext: MessageContext,
        transfer: PendingCryptocurrencyTransfer,
        caption: string,
    ): Promise<CryptoTransferOutcome> {
        const content: CryptocurrencyContent = {
            kind: "crypto_content",
            caption: caption === "" ? undefined : caption,
            transfer,
        };
        let resp: SendMessageResponse;
        try {
            resp = await this.sendMessageWithContent(messageContext, content, false);
        } catch (err) {
            // the user dismissed the PIN prompt
            if (err === "cancelled") return { kind: "cancelled" };
            this.logError("Unable to send a crypto transfer", err);
            resp = CommonResponses.failure();
        }
        return cryptoTransferResult(resp);
    }

    /** Loads the user's saved accounts into `namedAccountsStore` (kept as it was if they fail to load). */
    async loadSavedCryptoAccounts(): Promise<NamedAccount[]> {
        try {
            const accounts = await this.#worker.send({ kind: "loadSavedCryptoAccounts" });
            namedAccountsStore.set(accounts);
            return accounts;
        } catch {
            return namedAccountsStore.value;
        }
    }

    saveCryptoAccount(namedAccount: NamedAccount): Promise<SaveCryptoAccountResponse> {
        return this.#worker
            .send({
                kind: "saveCryptoAccount",
                namedAccount,
            })
            .catch(() => ({ kind: "failure" }));
    }

    deleteCryptoAccount(name: string): Promise<DeleteCryptoAccountResponse> {
        return this.#worker
            .send({
                kind: "deleteCryptoAccount",
                name,
            })
            .catch(() => ({ kind: "failure" }));
    }

    async #updateRegistry(): Promise<void> {
        let resolved = false;
        return new Promise((resolve) => {
            this.#worker
                .stream({
                    kind: "updateRegistry",
                })
                .subscribe({
                    onResult: ([registry, updated]) => {
                        if (updated || [...cryptoLookup.value.keys()].length === 0) {
                            this.currentAirdropChannel = registry.currentAirdropChannel;
                            const cryptoMap = new Map(
                                registry.tokenDetails.map((t) => [t.ledger, t]),
                            );
                            const nsMap = new Map(
                                registry.nervousSystemSummary.reduce(
                                    (entries, ns) => {
                                        const token = cryptoMap.get(ns.ledgerCanisterId);
                                        if (token) {
                                            entries.push([
                                                ns.governanceCanisterId,
                                                {
                                                    ...ns,
                                                    token,
                                                },
                                            ]);
                                        }
                                        return entries;
                                    },
                                    [] as [string, NervousSystemDetails][],
                                ),
                            );

                            nervousSystemLookup.set(nsMap);
                            cryptoLookup.set(cryptoMap);

                            // If the last token the user sent has since been removed from the
                            // registry (eg. its ledger was uninstalled), clear it, otherwise
                            // anything defaulting to it (eg. tipping) will blow up
                            const lastSent = lastCryptoSent.value;
                            if (lastSent !== undefined && !cryptoMap.has(lastSent)) {
                                lastCryptoSent.set(undefined);
                            }

                            messageFiltersStore.set(
                                registry.messageFilters
                                    .map((f) => {
                                        try {
                                            return { id: f.id, regex: new RegExp(f.regex, "mi") };
                                        } catch {
                                            return undefined;
                                        }
                                    })
                                    .filter((f) => f !== undefined) as MessageFilter[],
                            );

                            this.#evmContractAddresses = registry.tokenDetails.flatMap(
                                (t) => t.evmContractAddresses,
                            );
                            swapProvidersStore.set(registry.swapProviders);
                        }

                        // make sure we only resolve once so that we don't end up waiting for the downstream fetch
                        if (!resolved) {
                            resolved = true;
                            resolve();
                        }
                    },
                    onError: (err) => {
                        console.warn(`Failed to update the registry: ${err}`);
                        resolve();
                    },
                });
        });
    }

    #updateExchangeRates(): Promise<void> {
        return this.#worker
            .send({ kind: "exchangeRates" })
            .then((prices) => {
                // undefined if the prices couldn't be loaded, in which case the last ones are kept
                if (prices !== undefined) {
                    exchangeRatesLookupStore.set(new Map(Object.entries(prices.exchangeRates)));
                    cashtagCoinsStore.set(new Map(Object.entries(prices.coins)));
                    priceSourcesStore.set(new Map(Object.entries(prices.sources)));
                }
            })
            .catch(() => undefined);
    }

    // A token's or coin's prices over the last 7 days, for its price chart. Undefined if they couldn't
    // be loaded
    async getPriceHistory(subject: PriceSubject): Promise<PriceHistory | undefined> {
        try {
            return await this.#worker.send({ kind: "priceHistory", subject });
        } catch {
            return undefined;
        }
    }

    async refreshBalancesInSeries() {
        const config = walletConfigStore.value;
        for (const t of [...cryptoLookup.value.values()]) {
            if (config.kind === "auto_wallet" || config.tokens.has(t.ledger)) {
                await this.refreshAccountBalance(t.ledger);
            }
        }
    }

    #getSnsLogo(governanceCanisterId: string): string | undefined {
        return this.tryGetNervousSystem(governanceCanisterId)?.token.logo;
    }

    tryGetNervousSystem(
        governanceCanisterId: string | undefined,
    ): NervousSystemDetails | undefined {
        if (governanceCanisterId !== undefined) {
            return nervousSystemLookup.value.get(governanceCanisterId);
        }
    }

    tryGetCryptocurrency(ledgerCanisterId: string | undefined): CryptocurrencyDetails | undefined {
        if (ledgerCanisterId !== undefined) {
            return cryptoLookup.value.get(ledgerCanisterId);
        }
    }

    // the key might be a username or it might be a user group name
    getUserLookupForMentions(): Record<string, UserOrUserGroup> {
        const members = selectedChatMembersStore.value;
        const communityMembers = selectedCommunityMembersStore.value;
        const cached = this.#userLookupForMentions;
        if (
            cached === undefined ||
            cached.members !== members ||
            cached.communityMembers !== communityMembers ||
            (cached.usersVersion !== undefined && cached.usersVersion !== userStore.version)
        ) {
            const lookup = {} as Record<string, UserOrUserGroup>;
            let usersMissing = false;
            for (const [userId] of members) {
                const user = userStore.get(userId);
                if (user !== undefined) {
                    const displayName = this.getDisplayName(userId, communityMembers);
                    lookup[user.username.toLowerCase()] =
                        displayName === user.displayName
                            ? user
                            : {
                                  ...user,
                                  displayName,
                              };
                } else {
                    usersMissing = true;
                }
            }
            if (selectedCommunitySummaryStore.value !== undefined) {
                const userGroups = [...selectedCommunitySummaryStore.value.userGroups.values()];
                userGroups.forEach((ug) => (lookup[ug.name.toLowerCase()] = ug));
            }
            if (
                selectedChatIdStore.value !== undefined &&
                this.canMentionAllMembers(selectedChatIdStore.value)
            ) {
                lookup["everyone"] = { kind: "everyone" };
            }
            this.#userLookupForMentions = {
                lookup,
                members,
                communityMembers,
                usersVersion: usersMissing ? userStore.version : undefined,
            };
            return lookup;
        }
        return cached.lookup;
    }

    lookupUserForMention(username: string, includeSelf: boolean): UserOrUserGroup | undefined {
        const lookup = this.getUserLookupForMentions();

        const userOrGroup = lookup[username.toLowerCase()];
        if (userOrGroup === undefined) return undefined;

        switch (userOrGroup.kind) {
            case "user_group":
            case "everyone":
                return userOrGroup;
            default:
                return includeSelf || userOrGroup.userId !== currentUserIdStore.value
                    ? userOrGroup
                    : undefined;
        }
    }

    /**
     * Makes a proposal to an SNS, prompting for the user's PIN if they have one. The ProposalsBot is
     * approved to take the proposal's fee, and the canister that takes the payment the proposal's
     * execution needs, if any, is approved to take that. Nothing is submitted unless every approval
     * succeeds.
     */
    async makeProposal(
        governanceCanisterId: string,
        proposal: CandidateProposal,
        executionPayment?: ProposalExecutionPayment,
    ): Promise<MakeProposalOutcome> {
        const nervousSystem = this.tryGetNervousSystem(governanceCanisterId);
        if (nervousSystem === undefined) {
            this.logError(
                "Cannot find the nervous system to make a proposal to",
                governanceCanisterId,
            );
            return proposalFailed();
        }
        const { ledger, symbol, transferFee } = nervousSystem.token;

        const approvals: { spender: string; amount: bigint; expiresIn: bigint }[] = [
            {
                spender: this.config.proposalBotCanister,
                amount: proposalFee(nervousSystem),
                expiresIn: BigInt(APPROVAL_VALIDITY_MS),
            },
        ];
        if (executionPayment !== undefined) {
            approvals.push({
                spender:
                    executionPayment.kind === "token_listing"
                        ? this.config.registryCanister
                        : this.config.userIndexCanister,
                amount: executionPaymentAmount(executionPayment, transferFee),
                expiresIn: PROPOSAL_EXECUTION_WINDOW,
            });
        }

        try {
            const pin = await this.#promptForPinIfRequired();
            for (const { spender, amount, expiresIn } of approvals) {
                const resp = await this.#approveTransfer(spender, ledger, amount, expiresIn, pin);
                if (resp.kind !== "success") {
                    return { kind: "failed", message: i18nKey("proposal.maker.approvalError") };
                }
            }
        } catch (err) {
            // the user dismissed the PIN prompt
            if (err === "cancelled") return { kind: "cancelled" };
            this.logError("Unable to approve the payments for a proposal", err);
            return proposalFailed();
        }

        let resp: SubmitProposalResponse;
        try {
            resp = await this.#worker.send({
                kind: "submitProposal",
                currentUserId: currentUserIdStore.value,
                governanceCanisterId,
                proposal,
                ledger,
                token: symbol,
                proposalRejectionFee: nervousSystem.proposalRejectionFee,
                transactionFee: transferFee,
            });
        } catch (err) {
            this.logError("Unable to submit proposal", err);
            return proposalFailed();
        }
        if (resp.kind !== "success" && resp.kind !== "retrying") {
            this.logError("Failed to submit proposal", resp);
        }
        return submitProposalResult(resp);
    }

    refreshSwappableTokens(): Promise<Set<string>> {
        return this.#worker
            .send({
                kind: "canSwap",
                tokenLedgers: new Set([...cryptoLookup.value.keys()]),
            })
            .then((tokens) => {
                swappableTokensStore.set(tokens);
                return tokens;
            });
    }

    getTokenSwaps(inputTokenLedger: string): Promise<Record<string, DexId[]>> {
        const outputTokenLedgers = [...cryptoLookup.value.keys()].filter(
            (t) => t !== inputTokenLedger,
        );

        return this.#worker.send({
            kind: "getTokenSwaps",
            inputTokenLedger,
            outputTokenLedgers,
        });
    }

    /**
     * Quotes swapping `amountIn` from the user's wallet, fees included, on each DEX the wallet swaps
     * with. `onQuotes` is told of every DEX's quote as each comes in, starting with all of them being
     * asked. Resolves with the best quote once they're all in.
     */
    async getSwapQuotes(
        ledgerIn: string,
        ledgerOut: string,
        amountIn: bigint,
        onQuotes?: (quotes: [DexId, DexQuote][]) => void,
    ): Promise<SwapQuoteOutcome> {
        const tokenIn = cryptoLookup.value.get(ledgerIn)!;
        const tokenOut = cryptoLookup.value.get(ledgerOut)!;
        const quotes: [DexId, DexQuote][] = swapProvidersStore.value.map((dex) => [
            dex,
            { kind: "quoting" },
        ]);
        onQuotes?.([...quotes]);

        await Promise.all(
            quotes.map(async ([dex], i) => {
                let quote: DexQuote;
                try {
                    // What the DEX pulls is less the fees for approving it and for its pull, and its
                    // quote is what reaches the wallet, after the fee for sending it there
                    quote = await this.#worker.send({
                        kind: "getTokenSwapQuote",
                        dex,
                        inputTokenLedger: ledgerIn,
                        outputTokenLedger: ledgerOut,
                        amountIn: amountIn - 2n * tokenIn.transferFee,
                        outputTokenFee: tokenOut.transferFee,
                    });
                } catch (err) {
                    this.logError(`Error getting a ${dex} quote to swap ${tokenIn.symbol}`, err);
                    quote = { kind: "failed" };
                }
                quotes[i] = [dex, quote];
                onQuotes?.([...quotes]);
            }),
        );

        const rates = exchangeRatesLookupStore.value;
        return swapQuoteResult(
            tokenIn,
            tokenOut,
            amountIn,
            quotes,
            (ledger) => rates.get(ledger)?.toUSD,
        );
    }

    /**
     * Swaps the quoted amount straight from the user's wallet, provided the wallet still holds it and
     * the output is at least 98% of the quote. A quote with a value warning is only swapped once the
     * user has confirmed it. `onStep` is told of each step of the swap as it starts (see
     * `SwapFromWalletStep`). Both balances are refreshed once the swap has been sent.
     */
    async swapTokens(
        quote: SwapQuote,
        warningConfirmed: boolean,
        onStep?: (step: SwapFromWalletStep) => void,
    ): Promise<SwapOutcome> {
        if (quote.valueWarning !== undefined && !warningConfirmed) {
            return { kind: "failed", message: i18nKey("tokenSwap.confirmUnderstanding") };
        }

        // The output balance before the swap, to tell when its output has reached the wallet
        const [balance, balanceOut] = await Promise.all([
            this.refreshAccountBalance(quote.ledgerIn),
            this.refreshAccountBalance(quote.ledgerOut),
        ]);
        if (balance === undefined) {
            return { kind: "failed", message: swapError };
        }
        if (balance < quote.amountIn) {
            return { kind: "insufficient_funds", message: swapInsufficientFunds };
        }

        let outcome: SwapOutcome;
        try {
            const resp = await this.#swapTokens(
                random128(),
                quote.ledgerIn,
                quote.ledgerOut,
                quote.amountIn,
                (quote.amountOut * 98n) / 100n,
                quote.dex,
                onStep,
            );
            outcome = swapResult(resp);
            if (outcome.kind !== "swapped") {
                this.logMessage("Unable to swap tokens", resp);
            }
        } catch (err) {
            // the user dismissed the PIN prompt
            if (err === "cancelled") return { kind: "cancelled" };
            this.logError("Unable to swap tokens", err);
            outcome = { kind: "failed", message: swapUnconfirmed };
        }

        this.refreshAccountBalance(quote.ledgerIn);
        this.#refreshSwapOutput(
            quote.ledgerOut,
            outcome.kind === "swapped" ? balanceOut : undefined,
        ).catch((err) => this.logError("Unable to refresh a balance after a swap", err));
        return outcome;
    }

    // Each DEX pays the output of a swap out of a queue, so it can reach the wallet a few seconds after
    // the swap is reported done. Given the balance before a successful swap, this keeps refreshing
    // until the balance has gone up, so the user doesn't see their input gone and no output.
    async #refreshSwapOutput(ledger: string, balanceBefore: bigint | undefined): Promise<void> {
        for (let check = 1; check <= SWAP_OUTPUT_CHECKS; check++) {
            if (check > 1) {
                await new Promise((resolve) => setTimeout(resolve, SWAP_OUTPUT_CHECK_INTERVAL_MS));
            }
            const balance = await this.refreshAccountBalance(ledger);
            if (balanceBefore === undefined || (balance !== undefined && balance > balanceBefore))
                return;
        }
    }

    // Swaps tokens straight from the user's wallet, asking for the user's PIN first if they have set
    // one. `onStep` is told of each step of the swap as it starts (see `SwapFromWalletStep`).
    async #swapTokens(
        swapId: bigint,
        inputTokenLedger: string,
        outputTokenLedger: string,
        amountIn: bigint,
        minAmountOut: bigint,
        dex: DexId,
        onStep?: (step: SwapFromWalletStep) => void,
    ): Promise<SwapTokensResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const lookup = cryptoLookup.value;

        const resp = await new Promise<SwapTokensResponse>((resolve, reject) => {
            this.#worker
                .stream({
                    kind: "swapTokens",
                    swapId,
                    inputTokenDetails: lookup.get(inputTokenLedger)!,
                    outputTokenDetails: lookup.get(outputTokenLedger)!,
                    amountIn,
                    minAmountOut,
                    dex,
                    pin,
                })
                .subscribe({
                    onResult: (value) => {
                        if (value.kind === "swap_step") {
                            onStep?.(value);
                        } else {
                            resolve(value);
                        }
                    },
                    onError: reject,
                });
        });

        if (resp.kind === "error") {
            const pinNumberFailure = pinNumberFailureFromError(resp);
            if (pinNumberFailure !== undefined) {
                pinNumberFailureStore.set(pinNumberFailure);
            }
        }

        return resp;
    }

    cachedLocalUserIndexForCommunity(communityId: string): string | undefined {
        const community = communitiesStore.value.get({ kind: "community", communityId });
        return community !== undefined ? community.localUserIndex : undefined;
    }

    // This will pretend that the value is english and apply it to the english i18n dictionary temporarily.
    // This is just so that we have the option to look at it in the UI to check for layout problems
    previewTranslationCorrection(key: string, value: string): void {
        applyTranslationCorrection("en-GB", key, value);
    }

    proposeTranslationCorrection(
        language: string,
        key: string,
        value: string,
    ): Promise<ProposeResponse> {
        // The correction is filed under the language, but is applied here to the locale in use,
        // which can be a dialect of it. svelte-i18n caches the messages it has looked up per
        // locale and adding a message only clears the cache of the locale it is added to, so a
        // correction applied to the language would not show for a user on one of its dialects.
        const currentLocale = this.#locale;
        return this.#worker
            .send({
                kind: "proposeTranslation",
                locale: language,
                key,
                value,
            })
            .then((res) => {
                if (res === "success") {
                    applyTranslationCorrection(currentLocale, key, value);
                }
                return res;
            })
            .catch(() => "failure");
    }

    getProposedTranslationCorrections(): Promise<CandidateTranslations[]> {
        return this.#worker
            .send({
                kind: "getProposedTranslations",
            })
            .then((res) => (res.kind === "success" ? res.proposed : []))
            .catch(() => []);
    }

    rejectTranslationCorrection(id: bigint, reason: RejectReason): Promise<boolean> {
        return this.#worker
            .send({
                kind: "rejectTranslation",
                id,
                reason,
            })
            .then((res) => res === "success")
            .catch(() => false);
    }

    approveTranslationCorrection(id: bigint): Promise<boolean> {
        return this.#worker
            .send({
                kind: "approveTranslation",
                id,
            })
            .then((res) => res === "success")
            .catch(() => false);
    }

    async #sendVideoCallUsersWebRtcMessage(msg: WebRtcMessage, chatId: ChatIdentifier) {
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined) {
            throw new Error(`Unknown chat: ${chatId}`);
        }
        let userIds: string[] = [];
        const me = currentUserIdStore.value;
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") {
                userIds.push(chat.them.userId);
            } else if (
                this.isChatPrivate(chat) &&
                chatIdentifiersEqual(selectedChatIdStore.value, chatId)
            ) {
                userIds = [...selectedChatMembersStore.value.keys()].filter((id) => id !== me);
            }
            if (0 < userIds.length && userIds.length < 50) {
                await Promise.all(
                    userIds.map((id) =>
                        rtcConnectionsManager.create(
                            currentUserIdStore.value,
                            id,
                            this.config.meteredApiKey,
                        ),
                    ),
                );
                this.#sendRtcMessage(userIds, msg);
            }
        }
    }

    #ringOtherUsers(chatId: ChatIdentifier, messageId: bigint, callType: VideoCallType) {
        this.#sendVideoCallUsersWebRtcMessage(
            {
                kind: "remote_video_call_started",
                id: chatId,
                userId: currentUserIdStore.value,
                messageId,
                callType,
            },
            chatId,
        );
    }

    #getRoomAccessToken(
        authToken: string,
    ): Promise<{ token: string; roomName: string; messageId: bigint; joining: boolean }> {
        // This will send the OC access JWT to the daily middleware service which will:
        // * validate the jwt
        // * create the room if necessary
        // * obtain an access token for the user
        // * return it to the front end
        const displayName = this.getDisplayName(
            currentUserIdStore.value,
            selectedCommunityMembersStore.value,
            selectedChatWebhooksStore.value,
        );
        const user = currentUserStore.value;
        const username = user.username;
        const avatarId = userStore.get(user.userId)?.blobReference?.blobId;
        const headers = new Headers();
        headers.append("x-auth-jwt", authToken);

        let url = `${this.config.videoBridgeUrl}/room/meeting_access_token?initiator-username=${username}&initiator-displayname=${displayName}`;
        if (avatarId) {
            url += `&initiator-avatarid=${avatarId}`;
        }
        return fetch(url, {
            method: "GET",
            headers: headers,
        }).then((res) => {
            if (res.ok) {
                return res.json();
            }
            if (res.status === 401) {
                const msg =
                    "Auth failed trying to obtain room access token. Might be something wrong with your JWT.";
                console.error(msg);
                throw new Error(msg);
            }
            if (res.status === 400) {
                throw new NoMeetingToJoin();
            }
            throw new Error(`Unable to get room access token: ${res.status}, ${res.statusText}`);
        });
    }

    #getLocalUserIndexForBotActionScope(scope: BotActionScope): Promise<string> {
        switch (scope.kind) {
            case "chat_scope":
                const chat = this.lookupChatSummary(scope.chatId);
                if (chat) {
                    return this.#getLocalUserIndex(chat, true);
                }
                throw new Error(`Unable to get the local user index for scope: ${scope}`);
            case "community_scope":
                return this.#getLocalUserIndexForCommunity(scope.communityId.communityId);
        }
    }

    #getLocalUserIndexForCommunity(communityId: string): Promise<string> {
        const community = communitiesStore.value.get({
            kind: "community",
            communityId,
        });
        if (community) {
            return Promise.resolve(community.localUserIndex);
        } else {
            throw new Error(`Unable to get the local user index for community: ${communityId}`);
        }
    }

    #getLocalUserIndex(chat: ChatSummary, flipDirect: boolean = false): Promise<string> {
        switch (chat.kind) {
            case "group_chat":
                return Promise.resolve(chat.localUserIndex);
            case "channel":
                const community = communitiesStore.value.get({
                    kind: "community",
                    communityId: chat.id.communityId,
                });
                if (community) {
                    return Promise.resolve(community.localUserIndex);
                } else {
                    throw new Error(`Unable to get the local user index for channel: ${chat.id}`);
                }
            case "direct_chat":
                return this.#worker.send({
                    kind: "getLocalUserIndexForUser",
                    userId: flipDirect ? currentUserIdStore.value : chat.them.userId,
                });
        }
    }

    endVideoCallOnBridge(authToken: string) {
        const headers = new Headers();
        headers.append("x-auth-jwt", authToken);
        return fetch(`${this.config.videoBridgeUrl}/room/end_meeting`, {
            method: "POST",
            headers: headers,
        }).then((res) => {
            if (!res.ok) {
                console.error(`Unable to get end meeting: ${res.status}, ${res.statusText}`);
            }
        });
    }

    // Declining a ringing call (#9534). For a direct call the bridge ends it for both sides;
    // for a group call it only stops the ring on this user's other devices. Nothing records
    // that the user declined, and a failure is logged and otherwise ignored. The bridge takes
    // a participant token here (proof of belonging to the chat), never a join token.
    declineVideoCall(chatId: ChatIdentifier): Promise<void> {
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined) {
            return Promise.resolve();
        }
        return this.#getLocalUserIndex(chat)
            .then((localUserIndex) =>
                this.#worker.send({
                    kind: "getAccessToken",
                    accessTokenType: { kind: "video_call_participant", chatId },
                    localUserIndex,
                }),
            )
            .then((token) => {
                if (token === undefined) {
                    throw new Error("Didn't get an access token");
                }
                const headers = new Headers();
                headers.append("x-auth-jwt", token);
                return fetch(`${this.config.videoBridgeUrl}/room/decline`, {
                    method: "POST",
                    headers,
                });
            })
            .then((res) => {
                if (!res.ok) {
                    console.error(`Unable to decline the call: ${res.status}, ${res.statusText}`);
                }
            })
            .catch((err) => console.error("Unable to decline the call", err));
    }

    // The bridge token the Android shell uses when the app is killed mid-call (#9559):
    // for a direct call one that marks the call ended, for a group or channel call a
    // participant token with which the bridge takes the phone out of the room. Five
    // minutes' validity.
    getVideoCallTeardownToken(chatId: ChatIdentifier, kind: "end" | "leave"): Promise<string> {
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined) {
            return Promise.reject(new Error(`Unknown chat: ${chatId}`));
        }
        return this.#getLocalUserIndex(chat)
            .then((localUserIndex) =>
                this.#worker.send({
                    kind: "getAccessToken",
                    accessTokenType:
                        kind === "end"
                            ? { kind: "mark_video_call_ended", chatId }
                            : { kind: "video_call_participant", chatId },
                    localUserIndex,
                }),
            )
            .then((token) => {
                if (token === undefined) {
                    throw new Error("Didn't get an access token");
                }
                return token;
            });
    }

    endVideoCall(chatId: ChatIdentifier, messageId?: bigint) {
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined) {
            throw new Error(`Unknown chat: ${chatId}`);
        }
        if (messageId !== undefined) {
            this.#sendVideoCallUsersWebRtcMessage(
                {
                    kind: "remote_video_call_ended",
                    id: chatId,
                    userId: currentUserIdStore.value,
                    messageId,
                },
                chatId,
            );
        }
        return this.#getLocalUserIndex(chat).then((localUserIndex) => {
            return this.#worker
                .send({
                    kind: "getAccessToken",
                    accessTokenType: { kind: "mark_video_call_ended", chatId },
                    localUserIndex,
                })
                .then((token) => {
                    if (token === undefined) {
                        throw new Error("Didn't get an access token");
                    }
                    return token;
                })
                .then((token) => this.endVideoCallOnBridge(token));
        });
    }

    /**
     * Starts a call of the given type in the chat, or joins the one running there. `enterRoom`
     * enters the call's room. Once it has, a join is recorded, or a new call rings the chat's
     * other users.
     */
    async startOrJoinVideoCall(
        chatId: ChatIdentifier,
        callType: VideoCallType,
        join: boolean,
        enterRoom: (room: VideoCallRoom) => Promise<void>,
    ): Promise<VideoCallOutcome> {
        const accessType: AccessTokenType = join
            ? { kind: "join_video_call", chatId }
            : { kind: "start_video_call", callType, chatId };

        try {
            const access = await this.#getVideoChatAccessToken(chatId, accessType);
            const room: VideoCallRoom = {
                token: access.token,
                roomName: access.roomName,
                messageId: BigInt(access.messageId),
                callType,
                joining: access.joining,
            };
            await enterRoom(room);
            // only a new call rings, and only once the caller is in it
            if (room.joining) {
                await this.#recordCallJoined(chatId, room.messageId, callType);
            } else {
                this.#ringOtherUsers(chatId, room.messageId, callType);
            }
            return { kind: "joined" };
        } catch (err) {
            if (err instanceof NoMeetingToJoin) return { kind: "no_meeting" };
            console.error("Unable to start video call: ", err);
            return { kind: "failed", message: i18nKey("videoCall.callFailed") };
        }
    }

    // A broadcast's audience joins hidden, so it is not on stage
    async #recordCallJoined(chatId: ChatIdentifier, messageId: bigint, callType: VideoCallType) {
        switch (chatId.kind) {
            case "direct_chat":
                await this.#joinVideoCall(chatId, messageId);
                break;
            default:
                await this.setVideoCallPresence(
                    chatId,
                    messageId,
                    callType === "broadcast" ? "hidden" : "default",
                );
        }
    }

    async #getVideoChatAccessToken(
        chatId: ChatIdentifier,
        accessTokenType: AccessTokenType,
    ): Promise<{ token: string; roomName: string; messageId: bigint; joining: boolean }> {
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined) {
            throw new Error(`Unknown chat: ${chatId}`);
        }
        const localUserIndex = await this.#getLocalUserIndex(chat);
        const token = await this.#worker.send({
            kind: "getAccessToken",
            chatId,
            accessTokenType,
            localUserIndex,
        });
        if (token === undefined) {
            throw new Error("Didn't get an access token");
        }
        return this.#getRoomAccessToken(token);
    }

    // Games in messages, through the MiniApp service. Where there's no service, nothing's live, and
    // a game's card shows only what's stored in its chat.

    /** Follows a game's card, which has come into view, so it's shown live in `miniAppCardsStore` */
    followMiniApp(game: MiniAppGame): void {
        this.#miniApps?.follow(game);
    }

    joinMiniApp(game: MiniAppGame): Promise<MiniAppOutcome> {
        return this.#miniApps?.join(game) ?? Promise.resolve(noMiniAppService());
    }

    leaveMiniApp(game: MiniAppGame): Promise<MiniAppOutcome> {
        return this.#miniApps?.leave(game) ?? Promise.resolve(noMiniAppService());
    }

    /** Opens a game as its app is shown, after which `listener` hears its state and the user's role */
    openMiniApp(game: MiniAppGame, listener: MiniAppGameListener): Promise<MiniAppOpenOutcome> {
        return this.#miniApps?.open(game, listener) ?? Promise.resolve(noMiniAppService());
    }

    closeMiniApp(game: MiniAppGame, listener: MiniAppGameListener): void {
        this.#miniApps?.close(game, listener);
    }

    miniAppPlayerToken(game: MiniAppGame): Promise<string | undefined> {
        return this.#miniApps?.playerToken(game) ?? Promise.resolve(undefined);
    }

    startMiniApp(game: MiniAppGame): Promise<MiniAppStartOutcome> {
        return this.#miniApps?.start(game) ?? Promise.resolve(noMiniAppService());
    }

    // The MiniApp service's token for a chat, which says the user can see it, and whether they're a
    // member. Undefined if OpenChat won't issue one, eg. the chat's private and the user's left it.
    async #miniAppChatToken(chatId: MultiUserChatIdentifier): Promise<string | undefined> {
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined || anonUserStore.value) return undefined;
        try {
            const localUserIndex = await this.#getLocalUserIndex(chat);
            return await this.#worker.send({
                kind: "getAccessToken",
                accessTokenType: { kind: "mini_app_chat", chatId },
                localUserIndex,
            });
        } catch (err) {
            console.warn("Couldn't get a token for the chat's games", err);
            return undefined;
        }
    }

    #translationToken: { token: string; expiresAt: number } | undefined;

    async getTranslationToken(forceRefresh: boolean = false): Promise<string | undefined> {
        const margin = 60 * 1000;
        if (
            !forceRefresh &&
            this.#translationToken !== undefined &&
            this.#translationToken.expiresAt - margin > Date.now()
        ) {
            return this.#translationToken.token;
        }

        const localUserIndex = await this.#worker.send({
            kind: "getLocalUserIndexForUser",
            userId: currentUserIdStore.value,
        });
        const token = await this.#worker.send({
            kind: "getAccessToken",
            accessTokenType: { kind: "translate" },
            localUserIndex,
        });
        if (token === undefined) {
            this.#translationToken = undefined;
            return undefined;
        }
        this.#translationToken = { token, expiresAt: jwtExpiryMs(token) ?? 0 };
        return token;
    }

    async translateText(text: string, targetLocale: string): Promise<string | undefined> {
        const token = await this.getTranslationToken();
        if (token === undefined) return undefined;

        let resp = await this.#translateRequest(token, text, targetLocale);
        if (resp?.status === 401) {
            const freshToken = await this.getTranslationToken(true);
            if (freshToken === undefined) return undefined;
            resp = await this.#translateRequest(freshToken, text, targetLocale);
        }
        if (resp === undefined || !resp.ok) return undefined;

        const { translations } = await resp.json();
        return Array.isArray(translations) ? translations[0] : undefined;
    }

    #translateRequest(
        token: string,
        text: string,
        targetLocale: string,
    ): Promise<Response | undefined> {
        return fetch(`${this.config.translateProxyUrl}/translate`, {
            method: "POST",
            headers: {
                "x-auth-jwt": token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ texts: [text], target: targetLocale }),
        }).catch((err) => {
            console.warn("Translation request failed: ", err);
            return undefined;
        });
    }

    async translateMessage(
        messageId: bigint,
        text: string,
        targetLocale: string,
    ): Promise<boolean> {
        const translation = await this.translateText(text, targetLocale);
        if (translation === undefined) return false;
        this.translate(messageId, translation);
        return true;
    }

    #startBtcBalanceUpdateJob() {
        this.#btcAddressUnsub?.();
        this.#btcAddressUnsub = bitcoinAddress.subscribe((addr) => {
            // store subscribers cannot return a cleanup, so stop the previous poller explicitly
            this.#btcBalancePoller?.stop();
            this.#btcBalancePoller = undefined;
            if (addr !== undefined) {
                this.#btcBalancePoller = new Poller(
                    () => this.#updateBtcBalance(addr),
                    ONE_MINUTE_MILLIS,
                    5 * ONE_MINUTE_MILLIS,
                    true,
                );
            }
        });
    }

    #startOneSecBalanceUpdateJob() {
        this.#oneSecAddressUnsub?.();
        this.#oneSecAddressUnsub = oneSecAddress.subscribe((addr) => {
            if (addr !== undefined) {
                this.#oneSecEnableForwarding(currentUserIdStore.value, addr)
                    .then(() => {
                        // Check balances in case a deposit was made before the OneSecForwarder
                        // canister started tracking the address
                        this.#checkOneSecBalances(addr);
                    })
                    .catch((err) => this.logError("Failed to enable OneSec forwarding", err));
            }
        });
    }

    // The user's SOL deposit address is checked once when it's loaded, which credits SOL sent to it
    // since the user's last visit, then every minute (every 5 in the background) for an hour after
    // the user is shown it, since SOL sent from an exchange can take a while to arrive. Each check
    // calls Alchemy, unlike the BTC checks, which query the Bitcoin canister, so it isn't watched
    // for longer.
    #startSolBalanceUpdateJob() {
        this.#solAddressUnsub?.();
        this.#solAddressUnsub = solanaAddress.subscribe((addr) => {
            // store subscribers cannot return a cleanup, so stop the previous poller explicitly
            this.#solBalancePoller?.stop();
            this.#solBalancePoller = undefined;
            if (addr !== undefined) {
                let checked = false;
                this.#solBalancePoller = new Poller(
                    async () => {
                        if (!checked || Date.now() < this.#solDepositWatchedUntil) {
                            checked = true;
                            await this.#updateSolBalance(addr);
                        }
                    },
                    ONE_MINUTE_MILLIS,
                    5 * ONE_MINUTE_MILLIS,
                    true,
                );
            }
        });
    }

    #oneSecEnableForwarding(userId: string, evmAddress: string) {
        return this.#worker.send({
            kind: "oneSecEnableForwarding",
            userId,
            evmAddress,
        });
    }

    async #checkOneSecBalances(address: string) {
        let balances: Erc20TokenBalance[];
        try {
            balances = await getErc20TokenBalances(address, this.#evmContractAddresses);
        } catch (err) {
            this.logError("Failed to check OneSec balances", err);
            return;
        }
        if (balances.length > 0) {
            // Notify the OneSec minter of any tokens with non-zero balances
            for (const balance of balances) {
                this.#worker.send({
                    kind: "oneSecForwardEvmToIcp",
                    chain: balance.chain,
                    tokenSymbol: balance.token,
                    address,
                    receiver: currentUserIdStore.value,
                });
            }
        }
    }

    oneSecGetNetworks(token: string): string[] {
        const ethNetworks = [ETHEREUM_NETWORK, ARBITRUM_NETWORK, BASE_NETWORK].filter((n) =>
            this.#evmContractAddresses.some((c) => c.token === token && c.chain === n),
        );

        return [ICP_SYMBOL, ...ethNetworks];
    }

    async getBtcAddress(): Promise<string> {
        const storeValue = get(bitcoinAddress);
        if (storeValue !== undefined) {
            return Promise.resolve(storeValue);
        }
        if (this.#getBtcAddressPromise !== undefined) {
            return this.#getBtcAddressPromise;
        }
        this.#getBtcAddressPromise = this.#worker.send({
            kind: "generateBtcAddress",
        });
        const address = await this.#getBtcAddressPromise.finally(
            () => (this.#getBtcAddressPromise = undefined),
        );
        bitcoinAddress.set(address);
        return address;
    }

    // The address the deposit view shows the user, which is watched for deposits from then on for a
    // while (see `#startSolBalanceUpdateJob`)
    async getSolAddress(): Promise<string> {
        this.#solDepositWatchedUntil = Date.now() + ONE_HOUR;
        const storeValue = get(solanaAddress);
        if (storeValue !== undefined) {
            return Promise.resolve(storeValue);
        }
        if (this.#getSolAddressPromise !== undefined) {
            return this.#getSolAddressPromise;
        }
        this.#getSolAddressPromise = this.#worker.send({
            kind: "generateSolAddress",
        });
        const address = await this.#getSolAddressPromise.finally(
            () => (this.#getSolAddressPromise = undefined),
        );
        solanaAddress.set(address);
        return address;
    }

    async getOneSecAddress(): Promise<string> {
        const storeValue = get(oneSecAddress);
        if (storeValue !== undefined) {
            return Promise.resolve(storeValue);
        }
        if (this.#getOneSecAddressPromise !== undefined) {
            return this.#getOneSecAddressPromise;
        }
        this.#getOneSecAddressPromise = this.#worker.send({
            kind: "generateOneSecAddress",
        });
        const address = await this.#getOneSecAddressPromise.finally(
            () => (this.#getOneSecAddressPromise = undefined),
        );
        oneSecAddress.set(address);
        return address;
    }

    async #withdrawBtc(address: string, amount: bigint): Promise<WithdrawBtcResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const response = await this.#worker.send({
            kind: "withdrawBtc",
            address,
            amount,
            pin,
        });

        if (response.kind === "error") {
            const pinNumberFailure = pinNumberFailureFromError(response);
            if (pinNumberFailure !== undefined) {
                pinNumberFailureStore.set(pinNumberFailure);
            }
        }
        return response;
    }

    async #withdrawSol(address: string, amount: bigint): Promise<WithdrawSolResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const response = await this.#worker.send({
            kind: "withdrawSol",
            address,
            amount,
            pin,
        });

        if (response.kind === "error") {
            const pinNumberFailure = pinNumberFailureFromError(response);
            if (pinNumberFailure !== undefined) {
                pinNumberFailureStore.set(pinNumberFailure);
            }
        }
        return response;
    }

    async #withdrawViaOneSec(
        ledger: string,
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        amount: bigint,
    ): Promise<WithdrawBtcResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const response = await this.#worker.send({
            kind: "withdrawViaOneSec",
            ledger,
            tokenSymbol,
            chain,
            address,
            amount,
            pin,
        });

        if (response.kind === "error") {
            const pinNumberFailure = pinNumberFailureFromError(response);
            if (pinNumberFailure !== undefined) {
                pinNumberFailureStore.set(pinNumberFailure);
            }
        }
        return response;
    }

    async #updateBtcBalance(address: string): Promise<void> {
        await this.#worker.send({
            kind: "updateBtcBalance",
            userId: currentUserIdStore.value,
            bitcoinAddress: address,
        });
    }

    getCkbtcMinterDepositInfo(): Promise<CkbtcMinterDepositInfo> {
        return this.#worker.send({
            kind: "ckbtcMinterDepositInfo",
        });
    }

    // Asks the user's canister to have the ckSOL minter credit the SOL sent to the user's deposit
    // address, once the address holds the minter's minimum. The canister pays the minter for each
    // request, so the balance is checked first. The minter sweeps the address, then mints a minute
    // or two later. Until the sweep the address still holds the deposit, but asking again meanwhile
    // costs nothing, as the minter returns the deposit already in flight.
    async #updateSolBalance(address: string): Promise<void> {
        const [balance, depositInfo] = await Promise.all([
            getSolBalance(address),
            this.getCksolMinterDepositInfo(),
        ]);
        if (balance >= depositInfo.minimumDepositAmount) {
            await this.#worker.send({
                kind: "updateSolBalance",
            });
        }
    }

    getCksolMinterDepositInfo(): Promise<CksolMinterDepositInfo> {
        return this.#worker.send({
            kind: "cksolMinterDepositInfo",
        });
    }

    getCksolMinterWithdrawalInfo(): Promise<CksolMinterWithdrawalInfo> {
        return this.#worker.send({ kind: "cksolMinterWithdrawalInfo" });
    }

    getCkbtcMinterWithdrawalInfo(amount: bigint): Promise<CkbtcMinterWithdrawalInfo> {
        return this.#worker.send({
            kind: "ckbtcMinterWithdrawalInfo",
            amount,
        });
    }

    oneSecGetTransferFees(): Promise<OneSecTransferFees[]> {
        return this.#worker.send({ kind: "oneSecGetTransferFees" });
    }

    oneSecForwardEvmToIcp(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
    ): Promise<OneSecForwardingStatus> {
        return this.#worker.send({
            kind: "oneSecForwardEvmToIcp",
            tokenSymbol,
            chain,
            address,
            receiver: currentUserIdStore.value,
        });
    }

    oneSecForwardingStatus(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
    ): Promise<OneSecForwardingStatus> {
        return this.#worker.send({
            kind: "oneSecGetForwardingStatus",
            tokenSymbol,
            chain,
            address,
            receiver: currentUserIdStore.value,
        });
    }

    async signUpWithWebAuthn(
        assumeIdentity: boolean,
        username?: string,
    ): Promise<[ECDSAKeyIdentity, DelegationChain, WebAuthnKey]> {
        const webAuthnOrigin = this.config.webAuthnOrigin;
        if (webAuthnOrigin === undefined) throw new Error("WebAuthn origin not set");

        const webAuthnIdentity = await createWebAuthnIdentity(
            webAuthnOrigin,
            (key) => this.#storeWebAuthnKeyInCache(key),
            username,
        );

        // We create a temporary key so that the user doesn't have to reauthenticate via WebAuthn, we store this key
        // in IndexedDb, it is valid for 30 days (the same as the other key delegations we use).
        const tempKey = await ECDSAKeyIdentity.generate();

        return this.#finaliseWebAuthnSignin(tempKey, () => webAuthnIdentity, assumeIdentity, true);
    }

    async signUpWithAndroidWebAuthn(
        assumeIdentity: boolean,
        username: string,
    ): Promise<[ECDSAKeyIdentity, DelegationChain, WebAuthnKey]> {
        const webAuthnIdentity = await createAndroidWebAuthnPasskeyIdentity(username, (key) =>
            this.#storeWebAuthnKeyInCache(key),
        );

        // We create a temporary key so that the user doesn't have to reauthenticate via WebAuthn, we store this key
        // in IndexedDb, it is valid for 30 days (the same as the other key delegations we use).
        const tempKey = await ECDSAKeyIdentity.generate();

        return await this.#finaliseWebAuthnSignin(tempKey, () => webAuthnIdentity, assumeIdentity);
    }

    async linkAccountsWithAndroidWebAuthn(accountLinkingCode: string): Promise<void> {
        try {
            // Also used as session key
            const tempKey = await ECDSAKeyIdentity.generate();

            // Verify code
            const verificationRes = await this.verifyAccountLinkingCode(
                accountLinkingCode,
                tempKey,
            );

            // Error should be of type AccountLinkingError
            if ("error" === verificationRes.kind) {
                return Promise.reject(verificationRes);
            }

            // Create passkey
            let cachedWebAuthnKey: WebAuthnKeyFull | undefined;
            const webAuthnIdentity = await createAndroidWebAuthnPasskeyIdentity(
                verificationRes.username,
                (key) => {
                    cachedWebAuthnKey = key;
                    return this.#storeWebAuthnKeyInCache(key);
                },
            );

            if (!cachedWebAuthnKey) {
                return Promise.reject({
                    code: AndroidWebAuthnErrorCode.FailedToCacheWebAuthnKey,
                    msg: "failed to cache webauthn key",
                });
            }

            // Finalise linking and get the delegated identity
            await this.finaliseAccountLinkingWithCode(
                tempKey,
                webAuthnIdentity.getPrincipal().toString(),
                webAuthnIdentity.getPublicKey().toDer(),
                cachedWebAuthnKey,
            );

            await this.#finaliseWebAuthnSignin(tempKey, () => webAuthnIdentity, true);

            return Promise.resolve();
        } catch (e) {
            if (typeof e === "object") {
                // Either android webauthn error, or account linking error
                return Promise.reject(e);
            }

            // Unknown error!
            console.error(e);
            return Promise.reject({
                kind: "error",
                code: ErrorCode.Unknown,
                msg: e ? e.toString() : undefined,
            });
        }
    }

    async signInWithWebAuthn() {
        const webAuthnOrigin = this.config.webAuthnOrigin;
        if (webAuthnOrigin === undefined) throw new Error("WebAuthn origin not set");

        const webAuthnIdentity = new MultiWebAuthnIdentity(webAuthnOrigin, (credentialId) =>
            this.lookupWebAuthnPubKey(credentialId),
        );
        await this.#finaliseWebAuthnSignin(
            webAuthnIdentity,
            () => webAuthnIdentity.innerIdentity(),
            true,
        );
    }

    async signInWithAndroidWebAuthn(): Promise<[ECDSAKeyIdentity, DelegationChain, WebAuthnKey]> {
        const webAuthnIdentity = new AndroidWebAuthnPasskeyIdentity((credentialId) =>
            this.lookupWebAuthnPubKey(credentialId),
        );

        return await this.#finaliseWebAuthnSignin(
            webAuthnIdentity,
            () => webAuthnIdentity.identity(),
            true,
        );
    }

    async reSignInWithCurrentWebAuthnIdentity(): Promise<
        [ECDSAKeyIdentity, DelegationChain, WebAuthnKey]
    > {
        const webAuthnKey =
            this.#webAuthnKey ??
            (await this.#worker.send({
                kind: "currentUserWebAuthnKey",
            }));
        if (webAuthnKey === undefined) throw new Error("WebAuthnKey not set");

        if (this.isNativeApp()) {
            // Not 100% sure that this is right
            const webAuthnIdentity = new AndroidWebAuthnPasskeyIdentity((credentialId) =>
                this.lookupWebAuthnPubKey(credentialId),
            );
            return await this.#finaliseWebAuthnSignin(
                webAuthnIdentity,
                () => webAuthnIdentity.identity(),
                false,
            );
        } else {
            const cose = unwrapDER(webAuthnKey.publicKey, DER_COSE_OID);
            const webAuthnIdentity = new WebAuthnIdentity(
                webAuthnKey.credentialId,
                cose,
                undefined,
            );
            return await this.#finaliseWebAuthnSignin(
                webAuthnIdentity,
                () => webAuthnIdentity,
                false,
            );
        }
    }

    async #finaliseWebAuthnSignin(
        initialKey: SignIdentity,
        webAuthnIdentityFn: () => WebAuthnIdentity,
        assumeIdentity: boolean,
        registering: boolean = false,
    ): Promise<[ECDSAKeyIdentity, DelegationChain, WebAuthnKey]> {
        const sessionKey = await ECDSAKeyIdentity.generate();
        const delegation = await DelegationChain.create(
            initialKey,
            sessionKey.getPublicKey(),
            new Date(Date.now() + 30 * ONE_DAY),
        );
        // In the sign in case, we must defer getting the webAuthnIdentity until after it has been used to sign the
        // delegation, before that point we don't know which identity the user will choose.
        const webAuthnIdentity = webAuthnIdentityFn();
        const webAuthnKey = {
            publicKey: new Uint8Array(webAuthnIdentity.getPublicKey().toDer()),
            credentialId: new Uint8Array(webAuthnIdentity.rawId),
        };
        if (assumeIdentity) {
            this.#webAuthnKey = webAuthnKey;
            await this.#authIdentityStorage.set(sessionKey, delegation);
            await this.#loadedAuthenticationIdentity(
                { key: sessionKey, delegation },
                AuthProvider.PASSKEY,
                registering,
            );
        }
        return [sessionKey, delegation, webAuthnKey];
    }

    async lookupWebAuthnPubKey(credentialId: Uint8Array): Promise<Uint8Array> {
        const pubKey = await this.#worker.send({
            kind: "lookupWebAuthnPubKey",
            credentialId,
        });

        if (pubKey === undefined) {
            throw new Error("Failed to lookup WebAuthn PubKey");
        }
        return pubKey;
    }

    #storeWebAuthnKeyInCache(key: WebAuthnKeyFull): Promise<void> {
        return this.#worker.send({
            kind: "setCachedWebAuthnKey",
            key,
        });
    }

    getSignInProof(
        identityKey: ECDSAKeyIdentity,
        delegation: DelegationChain,
    ): Promise<string | undefined> {
        return this.#worker.send({
            kind: "getSignInProof",
            identityKey: identityKey.getKeyPair(),
            delegation: delegation.toJSON(),
        });
    }

    async generateMagicLink(
        email: string,
        sessionKey: ECDSAKeyIdentity,
    ): Promise<GenerateMagicLinkResponse> {
        const sessionKeyDer = toDer(sessionKey);

        const resp = await this.#worker
            .send({
                kind: "generateMagicLink",
                email,
                sessionKey: sessionKeyDer,
            })
            .catch(
                (error) =>
                    ({
                        kind: "failed_to_send_email",
                        error: error.toString(),
                    }) as GenerateMagicLinkResponse,
            );

        if (resp.kind === "success") {
            await storeEmailSignInSession(this.#authIdentityStorage.storage, {
                key: sessionKey,
                email,
                userKey: resp.userKey,
                expiration: resp.expiration,
            });
        } else {
            await removeEmailSignInSession(this.#authIdentityStorage.storage);
        }

        return resp;
    }

    getExternalAchievements() {
        return this.#worker.send({ kind: "getExternalAchievements" }).catch((err) => {
            console.error("getExternalAchievements error", err);
            return [];
        });
    }

    markAchievementsSeen() {
        this.#worker.send({ kind: "markAchievementsSeen" }).catch((err) => {
            console.error("markAchievementsSeen", err);
        });
    }

    /**
     * Emails a sign-in link and, once it's sent, checks every second whether it has been followed;
     * followed (on any device), this browser takes the identity it signs in. `signal` gives the
     * request up: before the link is sent, nothing is waited for; after, `signedIn` settles
     * cancelled and the checking stops.
     */
    async requestEmailSignIn(email: string, signal?: AbortSignal): Promise<EmailSignInRequest> {
        selectedAuthProviderStore.set(AuthProvider.EMAIL);
        const resp = await this.#requestEmailLink(email, SIGN_IN_BY_EMAIL, signal);
        if (resp.kind !== "sent") return resp;
        const signedIn = resp.followed.then(
            (followed): SignInOutcome =>
                followed === undefined
                    ? { kind: "cancelled" }
                    : signInOutcome(identityStateStore.value),
        );
        return { kind: "sent", code: resp.code, signedIn };
    }

    /**
     * Emails a link to sign in again with (ReAuthMethod) and, once it's sent, waits for it to be
     * followed, as requestEmailSignIn, without taking the identity it signs in. A check for the
     * link that fails is reported to `onCheckFailed` (the old trees show
     * `identity.failure.pollingError`) and the checking goes on, so the link still works.
     */
    async requestEmailReAuthentication(
        email: string,
        signal?: AbortSignal,
        onCheckFailed?: () => void,
    ): Promise<EmailReAuthRequest> {
        const resp = await this.#requestEmailLink(email, REAUTH_BY_EMAIL, signal, onCheckFailed);
        if (resp.kind !== "sent") return resp;
        const reAuthenticated = resp.followed.then(
            (followed): Promise<ReAuthOutcome> | ReAuthOutcome =>
                followed === undefined
                    ? { kind: "cancelled" }
                    : this.reAuthenticate(
                          { kind: "identity", provider: AuthProvider.EMAIL, ...followed },
                          signal,
                      ),
        );
        return { kind: "sent", code: resp.code, reAuthenticated };
    }

    /**
     * Emails a sign-in link and checks every second whether it has been followed. `followed`
     * settles with the identity it signs in (taken by this browser only for `"take"`), or
     * undefined once `signal` gives it up. A failed check goes to `onCheckFailed` and the checking
     * goes on.
     */
    async #requestEmailLink(
        email: string,
        link: EmailLink,
        signal?: AbortSignal,
        onCheckFailed?: () => void,
    ): Promise<
        | { kind: "sent"; code: string; followed: Promise<EmailLinkFollowed> }
        | { kind: "failed"; reason: ResourceKey }
        | { kind: "cancelled" }
    > {
        const sessionKey = await ECDSAKeyIdentity.generate();
        let resp: GenerateMagicLinkResponse | { kind: "unexpected_error" };
        try {
            resp = await this.generateMagicLink(email, sessionKey);
        } catch (err) {
            console.warn("generateMagicLink error", err);
            resp = { kind: "unexpected_error" };
        }
        if (signal?.aborted) return { kind: "cancelled" };
        if (resp.kind !== "success") {
            if (resp.kind === "failed_to_send_email") {
                console.debug("generateMagicLink failed_to_send_email", resp.error);
            }
            return { kind: "failed", reason: emailLinkFailure(resp.kind) };
        }
        this.gaTrack("generated_magic_signin_link", link.category);
        const { userKey, expiration } = resp;

        const followed = new Promise<EmailLinkFollowed>((resolve) => {
            let waiting = true;
            const done = (outcome: EmailLinkFollowed) => {
                if (!waiting) return;
                waiting = false;
                poller.stop();
                resolve(outcome);
            };
            const checkFailed = () => {
                if (waiting) onCheckFailed?.();
            };
            const poller = new Poller(
                async () => {
                    if (!waiting) return;
                    try {
                        const r = await this.getSignInWithEmailDelegation(
                            email,
                            userKey,
                            sessionKey,
                            expiration,
                            link.identity === "take",
                        );
                        if (r.kind === "success") {
                            this.gaTrack("received_email_signin_delegation", link.category);
                            done({ key: r.key, delegation: r.delegation });
                        } else if (r.kind === "error") {
                            console.debug("getSignInWithEmailDelegation error", r.error);
                            checkFailed();
                        }
                    } catch (err) {
                        console.warn("getSignInWithEmailDelegation error", err);
                        checkFailed();
                    }
                },
                1000,
                1000,
            );
            signal?.addEventListener("abort", () => done(undefined), { once: true });
        });
        return { kind: "sent", code: resp.code, followed };
    }

    /**
     * Signs the user in again to prove it's them, without changing who's signed in. Never succeeds
     * with an identity that isn't theirs: the one they're signed in with or one linked to their
     * account (isOwnPrincipal). Deleting the account relies on this check alone. `signal` gives it
     * up. It doesn't reject: anything that goes wrong is `failed`.
     */
    async reAuthenticate(method: ReAuthMethod, signal?: AbortSignal): Promise<ReAuthOutcome> {
        const failed: ReAuthOutcome = {
            kind: "failed",
            reason: i18nKey("identity.failure.loginApprover"),
        };
        try {
            const identity = await this.#reAuthIdentity(method);
            if (signal?.aborted) return { kind: "cancelled" };
            if (identity === "failed") return failed;
            const { key, delegation } = identity;
            const principal = DelegationIdentity.fromDelegation(key, delegation)
                .getPrincipal()
                .toString();
            const own = await isOwnPrincipal(principal, this.AuthPrincipal, async () =>
                (await this.getAuthenticationPrincipals()).map((p) => p.principal),
            );
            if (!own) {
                return { kind: "failed", reason: i18nKey("identity.failure.principalMismatch") };
            }
            const signInProofJwt = await this.getSignInProof(key, delegation);
            if (signal?.aborted) return { kind: "cancelled" };
            return {
                kind: "success",
                provider: identity.provider,
                key,
                delegation,
                signInProofJwt,
            };
        } catch (err) {
            console.error("Unable to sign in again: ", err);
            return signal?.aborted ? { kind: "cancelled" } : failed;
        }
    }

    // The identity a ReAuthMethod signs in, without taking it
    async #reAuthIdentity(method: ReAuthMethod): Promise<ReAuthIdentity | "failed"> {
        switch (method.kind) {
            case "identity":
                return method;
            case "passkey": {
                const [key, delegation] = await this.reSignInWithCurrentWebAuthnIdentity();
                return { provider: AuthProvider.PASSKEY, key, delegation };
            }
            case "wallet": {
                const resp = await this.signInWithWallet(
                    method.token,
                    method.address,
                    method.signature,
                    false,
                );
                return resp.kind === "success"
                    ? { provider: signInProvider(method), ...resp }
                    : "failed";
            }
            case "auth_client": {
                // Internet Identity or NFID, in a window of their own: a new key, kept in memory
                const provider = signInProvider(method);
                const key = await ECDSAKeyIdentity.generate();
                const storage = new InMemoryAuthClientStorage();
                const authClient = await AuthClient.create({ storage, identity: key });
                return new Promise((resolve) => {
                    authClient.login({
                        ...this.getAuthClientOptions(provider),
                        onSuccess: async () => {
                            const delegation = await storage.get("delegation");
                            resolve(
                                delegation
                                    ? {
                                          provider,
                                          key,
                                          delegation: DelegationChain.fromJSON(delegation),
                                      }
                                    : "failed",
                            );
                        },
                        onError: (err) => {
                            console.log("Failed to log into approver: ", err);
                            resolve("failed");
                        },
                    });
                });
            }
        }
    }

    async handleMagicLink(qs: string): Promise<HandleMagicLinkResponse> {
        const signInWithEmailCanister = this.config.signInWithEmailCanister;

        const response = await fetch(`https://${signInWithEmailCanister}.raw.icp0.io/auth${qs}`);

        if (response.ok) {
            const session = await getEmailSignInSession(this.#authIdentityStorage.storage);
            if (session === undefined) {
                return { kind: "session_not_found" };
            }

            await this.getSignInWithEmailDelegation(
                session.email,
                session.userKey,
                session.key,
                session.expiration,
                true,
            ).catch((error) => ({
                kind: "error",
                error: error.toString(),
            }));

            return { kind: "success" };
        } else if (response.status === 400) {
            const body = await response.text();
            if (body === "Link expired") {
                return { kind: "link_expired" };
            }
        }

        return { kind: "link_invalid" };
    }

    async getSignInWithEmailDelegation(
        email: string,
        userKey: Uint8Array,
        sessionKey: ECDSAKeyIdentity,
        expiration: bigint,
        assumeIdentity: boolean,
    ): Promise<
        | { kind: "success"; key: ECDSAKeyIdentity; delegation: DelegationChain }
        | { kind: "error"; error: string }
        | { kind: "not_found" }
    > {
        const sessionKeyDer = toDer(sessionKey);
        const getDelegationResponse = await this.#worker.send({
            kind: "getSignInWithEmailDelegation",
            email,
            sessionKey: sessionKeyDer,
            expiration,
        });
        if (getDelegationResponse.kind === "success") {
            const delegation = buildDelegationChain(
                userKey,
                getDelegationResponse.delegation,
                getDelegationResponse.signature,
            );
            if (assumeIdentity) {
                await this.#authIdentityStorage.set(sessionKey, delegation);
                await this.#loadedAuthenticationIdentity(
                    { key: sessionKey, delegation },
                    AuthProvider.EMAIL,
                );
            }
            return {
                kind: "success",
                key: sessionKey,
                delegation,
            };
        }
        return getDelegationResponse;
    }

    siwePrepareLogin(address: string): Promise<SiwePrepareLoginResponse> {
        return this.#worker.send({
            kind: "siwePrepareLogin",
            address,
        });
    }

    siwsPrepareLogin(address: string): Promise<SiwsPrepareLoginResponse> {
        return this.#worker.send({
            kind: "siwsPrepareLogin",
            address,
        });
    }

    async signInWithWallet(
        token: "eth" | "sol",
        address: string,
        signature: string,
        assumeIdentity: boolean,
    ): Promise<
        | { kind: "success"; key: ECDSAKeyIdentity; delegation: DelegationChain }
        | { kind: "failure" }
    > {
        const sessionKey = await ECDSAKeyIdentity.generate();
        const sessionKeyDer = toDer(sessionKey);
        const loginResponse = await this.#worker.send({
            kind: "loginWithWallet",
            token,
            address,
            signature,
            sessionKey: sessionKeyDer,
        });

        if (loginResponse.kind === "success") {
            const getDelegationResponse = await this.#worker.send({
                kind: "getDelegationWithWallet",
                token,
                address,
                sessionKey: sessionKeyDer,
                expiration: loginResponse.expiration,
            });
            if (getDelegationResponse.kind === "success") {
                const delegation = buildDelegationChain(
                    loginResponse.userKey,
                    getDelegationResponse.delegation,
                    getDelegationResponse.signature,
                );
                if (assumeIdentity) {
                    await this.#authIdentityStorage.set(sessionKey, delegation);
                    await this.#loadedAuthenticationIdentity(
                        { key: sessionKey, delegation },
                        token === "eth" ? AuthProvider.ETH : AuthProvider.SOL,
                    );
                }
                return {
                    kind: "success",
                    key: sessionKey,
                    delegation,
                };
            }
            return { kind: "failure" };
        } else {
            return { kind: "failure" };
        }
    }

    // **** Communities Stuff

    // takes a list of communities that may contain communities that we are a member of and/or preview communities
    // and overwrites them in the correct place
    updateCommunityIndexes(orderedCommunities: CommunitySummary[]): void {
        const updates: Record<string, number> = {};
        for (let i = 0; i < orderedCommunities.length; i++) {
            const community = orderedCommunities[i];
            const index = orderedCommunities.length - i;

            // Skip if index is unchanged
            if (community.membership.index === index) continue;

            localUpdates.updateCommunityIndex(community.id, index);

            if (!localUpdates.isPreviewingCommunity(community.id)) {
                updates[community.id.communityId] = index;
            }
        }

        if (Object.keys(updates).length > 0) {
            this.#worker.send({ kind: "setCommunityIndexes", indexes: updates }).catch(() => false);
        }
    }

    getOpenChatCommunity() {
        if (import.meta.env.OC_NODE_ENV === "production") {
            return this.getCommunitySummary({
                kind: "community",
                communityId: "dgegb-daaaa-aaaar-arlhq-cai",
            });
        }
        return Promise.resolve(undefined);
    }

    async getCommunitySummary(id: CommunityIdentifier): Promise<CommunitySummary | undefined> {
        const community = communitiesStore.value.get(id);
        if (community) return community;

        const resp = await this.#worker.send({
            kind: "getCommunitySummary",
            communityId: id.communityId,
        });
        if ("id" in resp) {
            return resp;
        } else {
            return undefined;
        }
    }

    async setSelectedCommunity(id: CommunityIdentifier): Promise<boolean> {
        let community = communitiesStore.value.get(id);
        let preview = false;
        if (community !== undefined && communityRestricted(community)) {
            publish("restrictedContent");
            return false;
        }
        if (community === undefined) {
            // if we don't have the community it means we're not a member and we need to look it up
            if (querystringCodeStore.value) {
                await this.setCommunityInvite({ id, code: querystringCodeStore.value });
            }

            const referredBy = this.#extractReferralCodeFromPath() ?? this.#referralCode;
            if (referredBy) {
                await this.setCommunityReferral(id, referredBy);
            }

            const resp = await this.#worker.send({
                kind: "getCommunitySummary",
                communityId: id.communityId,
            });
            if ("id" in resp) {
                if (communityRestricted(resp)) {
                    publish("restrictedContent");
                    return false;
                }
                // Make the community appear at the top of the list
                resp.membership.index = nextCommunityIndexStore.value;
                community = resp;
                localUpdates.addCommunityPreview(community);
                this.#getLatestMessagesBridgedUsers(community.channels);
                preview = true;
            } else {
                // if we get here it means we're not a member of the community and we can't look it up
                // it may be private and we may not be invited.
                publish("noAccess");
                return false;
            }
        }

        if (community !== undefined) {
            lastSelectedCommunityIdStore.set(community.id);
            this.#communityDetailsLoad = {
                communityId: community.id,
                loaded: this.#loadCommunityDetails(community),
            };
        }

        return preview;
    }

    #selectLastSelectedCommunity(): boolean {
        const mostRecentId = lastSelectedCommunityIdStore.value;
        const mostRecentCommunity = mostRecentId
            ? communitiesStore.value.get(mostRecentId)
            : undefined;
        if (mostRecentCommunity !== undefined) {
            publish("navigateTo", {
                url: `/community/${mostRecentCommunity.id.communityId}`,
            });
            return true;
        }
        return false;
    }

    #selectFirstCommunity(): boolean {
        const first = sortedCommunitiesStore.value?.find((c) => !c.membership.archived);
        if (first !== undefined) {
            publish("navigateTo", { url: `/community/${first.id.communityId}` });
            return true;
        }
        return false;
    }

    selectDefaultCommunity(): boolean {
        if (!this.#selectLastSelectedCommunity()) {
            return this.#selectFirstCommunity();
        }
        return true;
    }

    selectDefaultChat(desktopOnly: boolean = true): boolean {
        if (!desktopOnly || !get(mobileWidth)) {
            const scope = chatListScopeStore.value;
            const chat = defaultChat(
                chatSummariesListStore.value,
                lastSelectedChatByScopeStore.value.get(scope),
            );
            if (chat !== undefined) {
                publish("navigateTo", {
                    url: routeForChatIdentifier(scope.kind, chat.id),
                    intent: "auto",
                });
                return true;
            }
        }
        return false;
    }

    importToCommunity(
        groupId: GroupChatIdentifier,
        communityId: CommunityIdentifier,
    ): Promise<GroupMoveOutcome> {
        const failed: GroupMoveOutcome = {
            kind: "failed",
            message: i18nKey("communities.errors.importFailed"),
        };
        const group = chatSummariesStore.value.get(groupId);
        return this.#worker
            .send({
                kind: "importGroupToCommunity",
                groupId,
                communityId,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    if (group !== undefined) {
                        localUpdates.addChat({
                            ...group,
                            id: resp.channelId,
                            kind: "channel",
                            level: "channel",
                        } as ChannelSummary);
                    }
                    return { kind: "success", channelId: resp.channelId } as const;
                }
                return failed;
            })
            .catch(() => failed);
    }

    submitProofOfUniquePersonhood(
        credential: string,
        iiPrincipal: string,
    ): Promise<SubmitProofOfUniquePersonhoodResponse> {
        return this.#worker
            .send({
                kind: "submitProofOfUniquePersonhood",
                iiPrincipal,
                credential,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    currentUserStore.set({
                        ...currentUserStore.value,
                        isUniquePerson: true,
                    });
                    userStore.updateUser(currentUserIdStore.value, (u) => ({
                        ...u,
                        isUniquePerson: true,
                    }));
                }
                return resp;
            })
            .catch((err) => {
                console.error("Failed to submit proof of unique personhood to the user index", err);
                return { kind: "invalid" };
            });
    }

    /**
     * Join a community. Like `joinGroup`, gates that can't be checked from the user's own data come
     * back as `needs_gate_evaluation`, and the caller calls again with the result. Rejects if the
     * user cancels the PIN prompt for a payment.
     */
    async joinCommunity(
        community: CommunitySummary,
        gateCheck?: GateCheckSucceeded,
    ): Promise<JoinOutcome> {
        if (anonUserStore.value) {
            this.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "join_community", community },
            });
            return { kind: "skipped" };
        }

        // We may have got here by replaying a join captured before login, in which case we may
        // already be a member
        const current = communitiesStore.value.get(community.id) ?? community;
        if (current.membership.role !== ROLE_NONE && !current.membership.lapsed) {
            return { kind: "skipped" };
        }

        if (gateCheck === undefined) {
            const gates = this.#accessGatesForCommunity(community, true);
            if (!this.#doesUserMeetAccessGates(gates) && this.#gatePreprocessingRequired(gates)) {
                return { kind: "needs_gate_evaluation", gates };
            }
        }

        const resp = await this.#sendJoinCommunity(
            community,
            gateCheck?.credentials ?? [],
            gateCheck?.paymentApprovals ?? new Map(),
            gateCheck?.compositeGateIndex,
        );
        if (resp.kind === "success") return resp;
        if (resp.kind === "gate_check_failed") {
            // With no gates to show the user would see nothing, so report a plain failure
            const gates = this.#accessGatesForCommunity(community);
            if (gates.length > 0) return { kind: "gate_check_failed", gates };
        }
        return { kind: "failed", message: i18nKey("communities.errors.joinFailed") };
    }

    async #sendJoinCommunity(
        community: CommunitySummary,
        credentials: string[],
        paymentApprovals: PaymentGateApprovals,
        compositeGateIndex?: number,
    ): Promise<ClientJoinCommunityResponse> {
        const approveResponse = await this.approveAccessGatePayments(community, paymentApprovals);
        if (approveResponse.kind !== "success") {
            return approveResponse;
        }

        return this.#worker
            .send({
                kind: "joinCommunity",
                id: community.id,
                credentialArgs: this.#buildVerifiedCredentialArgs(credentials),
                compositeGateIndex,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    // Make the community appear at the top of the list
                    resp.community.membership.index = nextCommunityIndexStore.value;
                    resp.community.avatar = community.avatar;
                    localUpdates.addCommunity(resp.community);
                    this.#loadCommunityDetails(resp.community);
                    resp.community.channels.forEach((c) => this.#miniApps?.joinedChat(c.id));
                    withPausedStores(() => {
                        resp.community.channels.forEach((c) => {
                            if (c.latestMessage) {
                                messagesRead.markReadUpTo(
                                    { chatId: c.id },
                                    c.latestMessage.event.messageIndex,
                                );
                            }
                        });
                    });
                } else {
                    if (resp.kind === "gate_check_failed") {
                        return resp;
                    }
                    return CommonResponses.failure();
                }
                return CommonResponses.success();
            })
            .catch(() => CommonResponses.failure());
    }

    deleteCommunity(id: CommunityIdentifier): Promise<boolean> {
        const community = communitiesStore.value.get(id);
        if (community === undefined) return Promise.resolve(false);

        const undo = localUpdates.removeCommunity(id);

        return this.#worker
            .send({ kind: "deleteCommunity", id })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo?.();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo?.();
                return false;
            });
    }

    leaveCommunity(id: CommunityIdentifier): Promise<boolean> {
        const community = communitiesStore.value.get(id);
        if (community === undefined) return Promise.resolve(false);

        const undo = localUpdates.removeCommunity(id);

        return this.#worker
            .send({ kind: "leaveCommunity", id })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo?.();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo?.();
                return false;
            });
    }

    // Creates a community with the given channels, then invites `invitees` to it
    async createCommunity(
        { community: candidate, rules }: CommunityAndRules,
        defaultChannels: string[],
        invitees: string[],
    ): Promise<CreateCommunityOutcome> {
        let resp: CreateCommunityResponse;
        try {
            resp = await this.#worker.send({
                kind: "createCommunity",
                community: candidate,
                rules,
                defaultChannels,
                defaultChannelRules: defaultChatRules("channel"),
            });
        } catch (err) {
            this.logError("Unable to create community", err);
            resp = { kind: "failure" };
        }
        if (resp.kind !== "success") {
            this.logMessage("Unable to create community", resp);
            return { kind: "failed", message: communityCreationFailure(resp) };
        }

        const id: CommunityIdentifier = { kind: "community", communityId: resp.id };
        localUpdates.addCommunity({
            ...candidate,
            id,
            channels: resp.channels.map(([id, name]) => newDefaultChannel(id, name)),
        });

        if (invitees.length > 0) {
            const invited = await this.inviteUsers(id, invitees).catch((err) => {
                this.logError("Unable to invite users to a new community", err);
                return false;
            });
            if (!invited) {
                return {
                    kind: "created_without_invites",
                    id,
                    message: i18nKey("group.inviteUsersFailed", undefined, "community", true),
                };
            }
        }
        return { kind: "created", id };
    }

    addToFavourites(chatId: ChatIdentifier): Promise<boolean> {
        const undo = localUpdates.favourite(chatId);
        return this.#worker
            .send({ kind: "addToFavourites", chatId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    removeFromFavourites(chatId: ChatIdentifier): Promise<boolean> {
        const undo = localUpdates.unfavourite(chatId);
        if (chatSummariesStore.value.size === 0) {
            publish("selectedChatInvalid");
        }

        return this.#worker
            .send({ kind: "removeFromFavourites", chatId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    /**
     * Saves the changes the user has made to a community, sending only the fields that differ. A
     * change the user has to confirm (see `GroupChangeConfirmation`) and hasn't is returned for them
     * to confirm before anything is sent.
     */
    async updateCommunity(
        original: CommunityAndRules,
        candidate: CommunityAndRules,
        confirmed: GroupChangeConfirmation[] = [],
    ): Promise<UpdateCommunityOutcome> {
        const changes = communityChanges(original, candidate);
        if (Object.keys(changes).length === 0) return { kind: "unchanged" };

        const confirmation = communityChangeConfirmationNeeded(
            original.community,
            changes,
            confirmed,
        );
        if (confirmation !== undefined) return { kind: "needs_confirmation", confirmation };

        const community = candidate.community;
        let resp: UpdateCommunityResponse;
        try {
            resp = await this.#worker.send({
                kind: "updateCommunity",
                communityId: community.id.communityId,
                ...changes,
            });
        } catch (err) {
            this.logError("Unable to update community", err);
            resp = CommonResponses.unknownError(undefined);
        }

        if (resp.kind === "success") {
            localUpdates.addCommunity(community);
            if (changes.rules !== undefined && resp.rulesVersion !== undefined) {
                localUpdates.updateCommunityRules(community.id, {
                    text: changes.rules.text,
                    enabled: changes.rules.enabled,
                    version: resp.rulesVersion,
                });
            }
        } else {
            this.logMessage("Unable to update community", resp);
        }
        return communityUpdateResult(resp);
    }

    convertGroupToCommunity(group: GroupChatSummary, rules: Rules): Promise<GroupMoveOutcome> {
        const failed: GroupMoveOutcome = {
            kind: "failed",
            message: i18nKey("communities.errors.convertFailed"),
        };
        return this.#worker
            .send({
                kind: "convertGroupToCommunity",
                chatId: group.id,
                historyVisible: group.historyVisible,
                rules,
            })
            .then((resp) =>
                resp.kind === "success"
                    ? ({ kind: "success", channelId: resp.id } as const)
                    : failed,
            )
            .catch(() => failed);
    }

    deleteUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): Promise<boolean> {
        const undo = localUpdates.deleteUserGroup(id, userGroup.id);
        return this.#worker
            .send({
                kind: "deleteUserGroups",
                communityId: id.communityId,
                userGroupIds: [userGroup.id],
            })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();
                }
                return resp.kind === "success";
            })
            .catch(() => {
                undo();
                return false;
            });
    }

    /**
     * Creates a user group (no `original`) or renames and edits the members of `original`, from the
     * name and members the user picked. An update sends only the members added and removed, and the
     * original's member set (the store's) is never changed.
     */
    async saveUserGroup(
        id: CommunityIdentifier,
        original: UserGroupDetails | undefined,
        name: string,
        memberIds: string[],
    ): Promise<UserGroupSaveOutcome> {
        const userGroup: UserGroupDetails = {
            kind: "user_group",
            id: original?.id ?? -1,
            name,
            members: new Set(memberIds),
        };
        if (original === undefined) {
            return userGroupSaveOutcome(await this.#createUserGroup(id, userGroup), true);
        }
        const { toAdd, toRemove } = userGroupMemberChanges(original.members, memberIds);
        return userGroupSaveOutcome(
            await this.#updateUserGroup(id, userGroup, toAdd, toRemove),
            false,
        );
    }

    #createUserGroup(
        id: CommunityIdentifier,
        userGroup: UserGroupDetails,
    ): Promise<CreateUserGroupResponse> {
        return this.#worker
            .send({
                kind: "createUserGroup",
                communityId: id.communityId,
                name: userGroup.name,
                userIds: [...userGroup.members],
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.addOrUpdateUserGroup(id, {
                        ...userGroup,
                        id: resp.userGroupId,
                    });
                }
                return resp;
            })
            .catch(() => CommonResponses.failure());
    }

    getCommunityForChannel(id: ChannelIdentifier): CommunitySummary | undefined {
        return [...communitiesStore.value.values()].find((c) => {
            return c.channels.findIndex((ch) => chatIdentifiersEqual(ch.id, id)) >= 0;
        });
    }

    #updateUserGroup(
        id: CommunityIdentifier,
        userGroup: UserGroupDetails,
        toAdd: Set<string>,
        toRemove: Set<string>,
    ): Promise<UpdateUserGroupResponse> {
        return this.#worker
            .send({
                kind: "updateUserGroup",
                communityId: id.communityId,
                userGroupId: userGroup.id,
                name: userGroup.name,
                usersToAdd: [...toAdd],
                usersToRemove: [...toRemove],
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.addOrUpdateUserGroup(id, userGroup);
                }
                return resp;
            })
            .catch(() => CommonResponses.failure());
    }

    setChatListScopeAndRedirect(route: RouteParams): boolean {
        if (route.kind === "home_route") {
            publish("navigateTo", { url: routeForScope(this.getDefaultScope()), intent: "auto" });
            return true;
        }
        return false;
    }

    getDefaultScope(): ChatListScope {
        if (anonUserStore.value) return { kind: "none" };

        // sometimes we have to re-direct the user to home route "/"
        // However, with communities enabled it is not clear what this means
        // we actually need to direct the user to one of the global scopes "direct", "group" or "favourites"
        // which one we choose is kind of unclear and probably depends on the state

        const favourites = favouritesStore.value;
        if (favourites.size > 0) return { kind: "favourite" };
        return { kind: "chats" };
    }

    getUserLocation(): Promise<string | undefined> {
        if (this.#userLocation !== undefined) {
            return Promise.resolve(this.#userLocation);
        }
        return getUserCountryCode()
            .then((country) => {
                this.#userLocation = country;
                console.debug("GEO: derived user's location: ", country);
                return country;
            })
            .catch((err) => {
                console.warn("GEO: Unable to determine user's country location", err);
                return undefined;
            });
    }

    // **** End of Communities stuff
    diamondDurationToMs = diamondDurationToMs;

    swapRestricted(): Promise<boolean> {
        if (platformOperatorStore.value) {
            return Promise.resolve(false);
        }
        return this.getUserLocation().then((location) => featureRestricted(location, "swap"));
    }

    setPinNumber(
        verification: Verification,
        newPin: string | undefined,
    ): Promise<SetPinNumberResponse> {
        pinNumberFailureStore.set(undefined);

        return this.#worker.send({ kind: "setPinNumber", verification, newPin }).then((resp) => {
            if (resp.kind === "success") {
                pinNumberRequiredStore.set(newPin !== undefined);
            } else if (resp.kind === "error") {
                const pinNumberFailure = pinNumberFailureFromError(resp);
                if (pinNumberFailure !== undefined) {
                    pinNumberFailureStore.set(pinNumberFailure);
                }
            }

            return resp;
        });
    }

    #promptForPinIfRequired(): Promise<string | undefined> {
        return pinNumberRequiredStore.value
            ? this.#promptForCurrentPin("pinNumber.enterPinInfo")
            : Promise.resolve(undefined);
    }

    #promptForCurrentPin(message: string | undefined): Promise<string> {
        pinNumberFailureStore.set(undefined);

        return new Promise((resolve, reject) => {
            pinNumberResolverStore.set({
                resolve: (pin: string) => {
                    pinNumberResolverStore.set(undefined);
                    resolve(pin);
                },
                reject: () => {
                    pinNumberResolverStore.set(undefined);
                    reject("cancelled");
                },
                message,
            });
        });
    }

    #promptForRuleAcceptance(): Promise<AcceptedRules | undefined> {
        return new Promise((resolve, _) => {
            captureRulesAcceptanceStore.set({
                resolve: (accepted: boolean) => {
                    let acceptedRules: AcceptedRules | undefined = undefined;

                    if (accepted) {
                        acceptedRules = {
                            chat: undefined,
                            community: undefined,
                        };

                        if (selectedChatRulesStore.value?.enabled ?? false) {
                            acceptedRules.chat = selectedChatRulesStore.value?.version;
                        }

                        if (selectedCommunityRulesStore.value?.enabled ?? false) {
                            acceptedRules.community = selectedCommunityRulesStore.value?.version;
                        }
                    }

                    captureRulesAcceptanceStore.set(undefined);
                    resolve(acceptedRules);
                },
            });
        });
    }

    getStreak(userId: string | undefined) {
        return userId ? (userStore.get(userId)?.streak ?? 0) : 0;
    }

    getBotDefinition(endpoint: string): Promise<BotDefinitionResponse> {
        return this.#worker
            .send({
                kind: "getBotDefinition",
                endpoint,
            })
            .catch((err) => {
                this.#logger.error("Failed to get the bot definition", err, endpoint);
                return {
                    kind: "bot_definition_failure",
                    error: err,
                };
            });
    }

    #callBotCommandEndpoint(endpoint: string, token: string): Promise<BotCommandResponse> {
        return this.#worker.send({
            kind: "callBotCommandEndpoint",
            endpoint,
            token,
        });
    }

    registerWebhook(
        chatId: MultiUserChatIdentifier,
        name: string,
        avatar: string | undefined,
    ): Promise<FullWebhookDetails | undefined> {
        return this.#worker
            .send({
                kind: "registerWebhook",
                chatId,
                name,
                avatar,
            })
            .then((resp) => {
                if (resp !== undefined) {
                    userStore.addWebhookIds([resp.id]);
                    localUpdates.addWebhookToChat(chatId, resp);
                }
                return resp;
            })
            .catch((err) => {
                this.#logger.error("Failed to register webhook", err);
                return undefined;
            });
    }

    updateWebhook(
        chatId: MultiUserChatIdentifier,
        existing: WebhookDetails,
        name: string | undefined,
        avatar: OptionUpdate<string>,
    ): Promise<boolean> {
        const webhook = { ...existing };
        if (name !== undefined) {
            webhook.name = name;
        }
        if (avatar === "set_to_none") {
            webhook.avatarUrl = undefined;
        } else if (avatar !== undefined) {
            webhook.avatarUrl = avatar.value;
        }

        const undo = localUpdates.updateWebhook(chatId, webhook);

        return this.#worker
            .send({
                kind: "updateWebhook",
                chatId,
                id: webhook.id,
                name,
                avatar,
            })
            .then((resp) => {
                if (!resp) {
                    undo();
                }
                return resp;
            })
            .catch((err) => {
                this.#logger.error("Failed to update webhook", err);
                undo();
                return false;
            });
    }

    /**
     * Registers a webhook (no `original`), or sends the name and avatar changes to `original`;
     * nothing when there are none.
     */
    async saveWebhook(
        chatId: MultiUserChatIdentifier,
        original: WebhookDetails | undefined,
        name: string,
        avatarUrl: string | undefined,
    ): Promise<WebhookSaveOutcome> {
        if (original === undefined) {
            const webhook = await this.registerWebhook(chatId, name, avatarUrl);
            return webhook === undefined
                ? { kind: "failed", message: webhookFailure("register") }
                : { kind: "registered", webhook };
        }
        const changes = webhookChanges(original, name, avatarUrl);
        if (changes === undefined) return { kind: "unchanged" };
        const updated = await this.updateWebhook(chatId, original, changes.name, changes.avatar);
        return updated
            ? { kind: "updated" }
            : { kind: "failed", message: webhookFailure("update") };
    }

    regenerateWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<string | undefined> {
        return this.#worker
            .send({
                kind: "regenerateWebhook",
                chatId,
                id,
            })
            .catch((err) => {
                this.#logger.error("Failed to regenerate webhook", err);
                return undefined;
            });
    }

    deleteWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<boolean> {
        const undo = localUpdates.removeWebhookFromChat(chatId, id);

        return this.#worker
            .send({
                kind: "deleteWebhook",
                chatId,
                id,
            })
            .then((resp) => {
                if (!resp) {
                    undo();
                }
                return resp;
            })
            .catch((err) => {
                undo();
                this.#logger.error("Failed to delete webhook", err);
                return false;
            });
    }

    getWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<string | undefined> {
        return this.#worker
            .send({
                kind: "getWebhook",
                chatId,
                id,
            })
            .catch((err) => {
                this.#logger.error("Failed to get webhook", err);
                return undefined;
            });
    }

    executeInternalBotCommand(
        scope: BotActionScope,
        bot: InternalBotCommandInstance,
    ): Promise<"success" | "failure" | "too_many_requests"> {
        // Internal commands currently only make sense in a chat scope
        if (scope.kind === "community_scope") return Promise.resolve("success");

        const context = {
            chatId: scope.chatId,
            threadRootMessageIndex: scope.threadRootMessageIndex,
        };

        if (bot.command.name === "witch") {
            publish("summonWitch");
        } else if (bot.command.name === "register_bot") {
            publish("registerBot");
        } else if (bot.command.name === "register_webhook") {
            if (
                selectedChatSummaryStore.value !== undefined &&
                selectedChatSummaryStore.value.kind !== "direct_chat"
            ) {
                publish("registerWebhook", selectedChatSummaryStore.value);
            }
        } else if (bot.command.name === "update_bot") {
            publish("updateBot");
        } else if (bot.command.name === "remove_bot") {
            publish("removeBot");
        } else if (bot.command.name === "poll") {
            publish("createPoll", context);
        } else if (bot.command.name === "gif") {
            const param = bot.command.arguments[0];
            if (param !== undefined && param.kind === "string" && param.value !== undefined) {
                publish("attachGif", [context, param.value]);
            }
        } else if (bot.command.name === "crypto") {
            const ev: { context: MessageContext; ledger?: string; amount?: bigint } = {
                context: context,
            };
            const [token, amount] = bot.command.arguments;
            if (
                token !== undefined &&
                token.kind === "string" &&
                amount !== undefined &&
                amount.kind === "decimal" &&
                amount.value !== null
            ) {
                const tokenDetails =
                    token.value !== undefined ? walletTokenBySymbol(token.value) : undefined;
                if (tokenDetails !== undefined) {
                    ev.ledger = tokenDetails.ledger;
                    ev.amount = this.validateTokenInput(
                        amount.value.toString(),
                        tokenDetails.decimals,
                    ).amount;
                }
            }
            publish("tokenTransfer", ev);
        } else if (bot.command.name === "test-msg") {
            const param = bot.command.arguments[0];
            if (param !== undefined && param.kind === "decimal" && param.value !== null) {
                publish("createTestMessages", [context, param.value]);
            }
        } else if (bot.command.name === "diamond") {
            const url = addQueryStringParam("diamond", "");
            const msg = `[${this.config.i18nFormatter("upgrade.message")}](${url})`;
            this.sendMessageWithAttachment(context, msg, false, undefined, []);
        } else if (bot.command.name === "faq") {
            const topic =
                bot.command.arguments[0]?.kind === "string"
                    ? bot.command.arguments[0]?.value
                    : undefined;
            const url = topic === undefined || topic === "" ? "/faq" : `/faq?q=${topic}`;
            const msg =
                topic === undefined
                    ? `[🤔 FAQs](/faq)`
                    : `[🤔 FAQ: ${this.config.i18nFormatter(`faq.${topic}_q`)}](${url})`;
            this.sendMessageWithAttachment(context, msg, false, undefined, []);
        } else if (bot.command.name === "search" && bot.command.arguments[0]?.kind === "string") {
            publish("searchChat", bot.command.arguments[0]?.value ?? "");
        }
        return Promise.resolve("success");
    }

    #messageIdFromBotActionScope(scope: BotActionScope) {
        switch (scope.kind) {
            case "chat_scope":
                return scope.messageId;
            case "community_scope":
                return random64();
        }
    }

    #getAuthTokenForBotCommand(
        scope: BotActionScope,
        bot: ExternalBotCommandInstance,
    ): Promise<[string, bigint]> {
        const messageId = this.#messageIdFromBotActionScope(scope);
        return this.#getLocalUserIndexForBotActionScope(scope).then((localUserIndex) => {
            return this.#worker
                .send({
                    kind: "getAccessToken",
                    accessTokenType: {
                        kind: "bot_action_by_command",
                        botId: bot.id,
                        scope:
                            scope.kind === "chat_scope" && scope.chatId.kind === "direct_chat"
                                ? {
                                      ...scope,
                                      chatId: { ...scope.chatId, userId: currentUserIdStore.value },
                                  }
                                : scope,
                        command: {
                            initiator: currentUserIdStore.value,
                            commandName: bot.command.name,
                            arguments: bot.command.arguments,
                            meta: {
                                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                language: this.#locale.substring(0, 2),
                            },
                        },
                    },
                    localUserIndex,
                })
                .then((token) => {
                    if (token === undefined) {
                        throw new Error("Didn't get an access token");
                    }
                    console.log("TOKEN: ", token, messageId);
                    return [token, messageId];
                });
        });
    }

    installBot(
        id: BotInstallationLocation,
        botId: string,
        grantedPermissions: GrantedBotPermissions,
    ): Promise<boolean> {
        const undo = this.#installBotLocally(id, botId, grantedPermissions);
        return this.#worker
            .send({
                kind: "installBot",
                id,
                botId,
                grantedPermissions,
            })
            .then((resp) => {
                if (!resp) {
                    undo();
                }
                return resp;
            })
            .catch((err) => {
                undo();
                this.#logger.error("Error adding bot to group or community", err);
                return false;
            });
    }

    updateInstalledBot(
        id: BotInstallationLocation,
        botId: string,
        grantedPermissions: GrantedBotPermissions,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "updateInstalledBot",
                id,
                botId,
                grantedPermissions,
            })
            .catch((err) => {
                this.#logger.error("Error adding bot to group or community", err);
                return false;
            });
    }

    #uninstallBotLocally(id: BotInstallationLocation, botId: string): UndoLocalUpdate {
        switch (id.kind) {
            case "community":
                return localUpdates.removeBotFromCommunity(id, botId);
            case "group_chat":
                return localUpdates.removeBotFromChat(id, botId);
            case "direct_chat":
                return localUpdates.removeDirectChatBot(botId);
        }
    }

    #installBotLocally(
        id: BotInstallationLocation,
        botId: string,
        perm: GrantedBotPermissions,
    ): UndoLocalUpdate {
        switch (id.kind) {
            case "community":
                return localUpdates.installBotInCommunity(id, botId, perm);
            case "group_chat":
                return localUpdates.installBotInChat(id, botId, perm);
            case "direct_chat":
                return localUpdates.installDirectChatBot(botId, perm);
        }
    }

    uninstallBot(id: BotInstallationLocation, botId: string): Promise<boolean> {
        const undo = this.#uninstallBotLocally(id, botId);
        return this.#worker
            .send({
                kind: "uninstallBot",
                id,
                botId,
            })
            .then((success) => {
                if (!success) {
                    undo();
                }
                return success;
            })
            .catch((err) => {
                undo();
                this.#logger.error("Error removing bot from group or community", err);
                return false;
            });
    }

    sendPlaceholderBotMessage(
        scope: BotActionScope,
        botContext: BotMessageContext | undefined,
        content: MessageContent,
        msgId: bigint,
        senderId: string,
        blockLevelMarkdown: boolean,
    ): () => void {
        // we can't send a placeholder message to a community scope but that's ok
        if (scope.kind === "community_scope") return () => undefined;

        this.getMissingUsers([senderId]);

        const context: MessageContext = {
            chatId: scope.chatId,
            threadRootMessageIndex: scope.threadRootMessageIndex,
        };

        if (localUpdates.isUnconfirmed(context, msgId)) {
            localUpdates.overwriteUnconfirmedContent(
                context,
                msgId,
                content,
                botContext,
                blockLevelMarkdown,
            );
        } else {
            publish("sendingMessage", context);
            const event = createMessage(context, {
                timestamp: BigInt(Date.now()),
                content,
                sender: senderId,
                messageId: msgId,
                forwarded: false,
                blockLevelMarkdown,
                senderContext: botContext,
                ogPreviews: [],
            });
            localUpdates.addUnconfirmed(context, event);
            publish("sentMessage", { context, event });
        }
        return () => localUpdates.deleteUnconfirmed(context, msgId);
    }

    executeBotCommand(
        scope: BotActionScope,
        bot: BotCommandInstance,
        direct: boolean = false,
    ): Promise<"success" | "failure" | "too_many_requests"> {
        const botContext = direct
            ? undefined
            : ({
                  kind: "bot",
                  finalised: false,
                  command: {
                      name: bot.command.name,
                      args: bot.command.arguments,
                      initiator: currentUserIdStore.value,
                  },
              } as BotMessageContext);
        let removePlaceholder: (() => void) | undefined = undefined;
        switch (bot.kind) {
            case "external_bot":
                return this.#getAuthTokenForBotCommand(scope, bot)
                    .then(([token, msgId]) => {
                        removePlaceholder = this.sendPlaceholderBotMessage(
                            scope,
                            botContext,
                            bot.command.placeholder !== undefined
                                ? { kind: "text_content", text: bot.command.placeholder }
                                : { kind: "bot_placeholder_content" },
                            msgId,
                            bot.id,
                            false,
                        );
                        return this.#callBotCommandEndpoint(bot.endpoint, token);
                    })
                    .then((resp) => {
                        if (resp.kind !== "success") {
                            console.error("Bot command failed with: ", resp);
                            removePlaceholder?.();
                            if (resp.kind === "too_many_requests") {
                                console.log("Too many requests");
                                return "too_many_requests";
                            } else {
                                return "failure";
                            }
                        } else {
                            if (resp.message !== undefined) {
                                // if the bot responded with an ephemeral message remove any existing placeholder
                                // as the message will be displayed in popup
                                if (resp.message.ephemeral) {
                                    removePlaceholder?.();
                                    publish("ephemeralMessage", {
                                        message: resp.message,
                                        scope,
                                        botId: bot.id,
                                        commandName: bot.command.name,
                                    });
                                } else {
                                    this.sendPlaceholderBotMessage(
                                        scope,
                                        botContext === undefined
                                            ? undefined
                                            : {
                                                  ...botContext,
                                                  finalised: resp.message.finalised,
                                              },
                                        resp.message.messageContent,
                                        resp.message.messageId,
                                        bot.id,
                                        resp.message.blockLevelMarkdown,
                                    );
                                }
                            } else {
                                removePlaceholder?.();
                            }
                            return "success";
                        }
                    })
                    .catch((err) => {
                        console.log("Bot command failed with", err);
                        removePlaceholder?.();
                        return "failure";
                    });
            case "internal_bot":
                return this.executeInternalBotCommand(scope, bot);
        }
    }

    /**
     * Sends what the user typed in a direct chat with a bot as that bot's direct-message command:
     * the user's message shows in the chat at once, the draft is cleared and the command runs (its
     * reply, or its failure, arrives as for any command). `no_direct_command`: the chat isn't with a
     * bot the client knows, or the bot takes no direct messages, so nothing was sent. Never rejects.
     */
    sendDirectBotMessage(
        messageContext: MessageContext,
        text: string,
        blockLevelMarkdown: boolean,
    ): DirectBotMessageOutcome {
        const chat = allChatsStore.value.get(messageContext.chatId);
        const botId = chat === undefined ? undefined : this.directChatWithBot(chat);
        const bot = botId === undefined ? undefined : botState.externalBots.get(botId);
        const command = bot === undefined ? undefined : directMessageCommandInstance(bot, text);
        if (command === undefined) return { kind: "no_direct_command" };

        const userMessageId = random64();
        const scope: BotActionScope = {
            kind: "chat_scope",
            chatId: messageContext.chatId,
            threadRootMessageIndex: messageContext.threadRootMessageIndex,
            messageId: random64(),
            userMessageId,
        };
        this.sendPlaceholderBotMessage(
            scope,
            undefined,
            { kind: "text_content", text },
            userMessageId,
            currentUserIdStore.value,
            blockLevelMarkdown,
        );
        void this.executeBotCommand(scope, command, true);
        localUpdates.draftMessages.delete(messageContext);
        return { kind: "sent" };
    }

    contentTypeSupportsEdit(contentType: MessageContent["kind"]): boolean {
        return isEditableContent(contentType);
    }

    claimDailyChit(): Promise<ClaimDailyChitResponse> {
        const userId = currentUserIdStore.value;
        const utcOffsetMins = -new Date().getTimezoneOffset();

        return this.#worker.send({ kind: "claimDailyChit", utcOffsetMins }).then((resp) => {
            if (resp.kind === "success") {
                if (resp.nextDailyChitClaim > chitStateStore.value.nextDailyChitClaim) {
                    chitStateStore.update((state) => ({
                        chitBalance: resp.chitBalance,
                        streakEnds: resp.nextDailyChitClaim + BigInt(ONE_DAY),
                        streak: resp.streak,
                        maxStreak: resp.maxStreak,
                        nextDailyChitClaim: resp.nextDailyChitClaim,
                        totalChitEarned: state.totalChitEarned + resp.chitEarned,
                    }));
                }
                userStore.updateUser(userId, (user) => ({
                    ...user,
                    chitBalance: resp.chitBalance,
                    streak: resp.streak,
                    maxStreak: resp.maxStreak,
                }));
            } else if (resp.kind === "already_claimed") {
                chitStateStore.update((state) => ({
                    ...state,
                    nextDailyChitClaim: resp.nextDailyChitClaim,
                }));
            }

            return resp;
        });
    }

    chitLeaderboard(): Promise<ChitLeaderboardResponse> {
        return this.#worker.send({ kind: "chitLeaderboard" });
    }

    /**
     * The user's CHIT events from `from` (ms epoch) until now, oldest first, all of them (the CHIT
     * calendar's history). Rejects if a page fails to load: a part of the history isn't it.
     */
    chitHistory(from: bigint): Promise<ChitEvent[]> {
        // a day ahead: an event just made carries the canister's time, which may be ahead of ours
        const to = BigInt(Date.now() + ONE_DAY);
        return allChitEvents(
            async (skip, max) =>
                (await this.#worker.send(newestFirstChitEvents(from, to, skip, max))).events,
        );
    }

    chitEvents(req: ChitEventsRequest): Promise<ChitEventsResponse> {
        return this.#worker.send(req).catch((err) => {
            this.logError("Failed to load chit events", err);
            return {
                events: [],
                total: 0,
            };
        });
    }

    #authProviderFromAuthPrincipal(principal: AuthenticationPrincipal): AuthProvider {
        if (principal.originatingCanister === WEBAUTHN_ORIGINATING_CANISTER) {
            return AuthProvider.PASSKEY;
        } else if (principal.originatingCanister === this.config.signInWithEthereumCanister) {
            return AuthProvider.ETH;
        } else if (principal.originatingCanister === this.config.signInWithSolanaCanister) {
            return AuthProvider.SOL;
        } else if (principal.originatingCanister === this.config.signInWithEmailCanister) {
            return AuthProvider.EMAIL;
        } else if (
            principal.originatingCanister === import.meta.env.OC_INTERNET_IDENTITY_CANISTER_ID
        ) {
            if (principal.isIIPrincipal) {
                return AuthProvider.II;
            } else {
                return AuthProvider.NFID;
            }
        }
        return AuthProvider.II;
    }

    createAccountLinkingCode(): Promise<AccountLinkingCode | undefined> {
        return this.#worker.send({
            kind: "createAccountLinkingCode",
        });
    }

    verifyAccountLinkingCode(
        code: string,
        tempKey: ECDSAKeyIdentity,
    ): Promise<VerifyAccountLinkingCodeResponse> {
        return this.#worker.send({
            kind: "verifyAccountLinkingCode",
            code,
            tempKey: tempKey.getKeyPair(),
        });
    }

    finaliseAccountLinkingWithCode(
        tempKey: ECDSAKeyIdentity,
        principal: string,
        publicKey: Uint8Array,
        webAuthnKey?: WebAuthnKeyFull,
    ): Promise<FinaliseAccountLinkingResponse> {
        return this.#worker.send({
            kind: "finaliseAccountLinkingWithCode",
            tempKey: tempKey.getKeyPair(),
            principal,
            publicKey,
            webAuthnKey,
        });
    }

    async getAuthenticationPrincipals(): Promise<LinkedAuthenticationPrincipal[]> {
        const principals = await this.#worker.send({ kind: "getAuthenticationPrincipals" });
        // the passkey this session signed in with, which the backend can't tell from the others;
        // best effort: without it the list is still the list (reAuthenticate depends on it)
        const currentCredentialId = principals.some((p) => p.webAuthnKey !== undefined)
            ? await this.#currentWebAuthnCredentialId()
            : undefined;
        return Promise.all(
            markCurrentSignIn(principals, currentCredentialId).map(async (p) => ({
                ...p,
                provider: this.#authProviderFromAuthPrincipal(p),
                passkeyProvider: p.webAuthnKey
                    ? await passkeyProviderName(p.webAuthnKey.aaguid)
                    : undefined,
            })),
        );
    }

    async #currentWebAuthnCredentialId(): Promise<Uint8Array | undefined> {
        if (this.#webAuthnKey !== undefined) return this.#webAuthnKey.credentialId;
        try {
            return (await this.#worker.send({ kind: "currentUserWebAuthnKey" }))?.credentialId;
        } catch (err) {
            console.warn("Unable to tell which passkey this session signed in with", err);
            return undefined;
        }
    }

    getLinkedIIPrincipal(): Promise<string | undefined> {
        return this.#worker
            .send({
                kind: "getAuthenticationPrincipals",
            })
            .then((resp) => {
                const iiPrincipals = resp
                    .filter(
                        ({ originatingCanister, isIIPrincipal }) =>
                            originatingCanister ===
                                import.meta.env.OC_INTERNET_IDENTITY_CANISTER_ID && isIIPrincipal,
                    )
                    .map((p) => p.principal);
                if (iiPrincipals.length === 0) {
                    console.debug(
                        "No II principals found, we will have to ask the user to link one",
                    );
                }
                if (
                    this.#authPrincipal !== undefined &&
                    iiPrincipals.includes(this.#authPrincipal)
                ) {
                    return this.#authPrincipal;
                }
                return iiPrincipals[0];
            })
            .catch((err) => {
                console.log("Error loading authentication principals: ", err);
                return undefined;
            });
    }

    linkIdentities(
        initiatorKey: ECDSAKeyIdentity,
        initiatorDelegation: DelegationChain,
        initiatorIsIIPrincipal: boolean,
        initiatorWebAuthnKey: WebAuthnKey | undefined,
        approverKey: ECDSAKeyIdentity,
        approverDelegation: DelegationChain,
    ): Promise<LinkIdentitiesResponse> {
        return this.#worker.send({
            kind: "linkIdentities",
            initiatorKey: initiatorKey.getKeyPair(),
            initiatorDelegation: initiatorDelegation.toJSON(),
            initiatorIsIIPrincipal,
            initiatorWebAuthnKey,
            approverKey: approverKey.getKeyPair(),
            approverDelegation: approverDelegation.toJSON(),
        });
    }

    removeIdentityLink(linked_principal: string): Promise<RemoveIdentityLinkResponse> {
        return this.#worker.send({
            kind: "removeIdentityLink",
            linked_principal,
        });
    }

    removeTokenFromWallet(ledger: string) {
        const config = walletConfigWithoutToken(walletConfigStore.value, ledger);
        if (config !== undefined) {
            return this.setWalletConfig(config);
        }
    }

    setsAreEqual<T>(a: Set<T>, b: Set<T>): boolean {
        if (a.size !== b.size) return false;
        for (const item of a) {
            if (!b.has(item)) {
                return false;
            }
        }
        return true;
    }

    walletConfigChanged(a: WalletConfig, b: WalletConfig): boolean {
        if (a.kind !== b.kind) return true;
        if (a.kind === "auto_wallet" && b.kind === "auto_wallet")
            return a.minDollarValue !== b.minDollarValue;
        if (a.kind === "manual_wallet" && b.kind === "manual_wallet")
            return !this.setsAreEqual(a.tokens, b.tokens);
        return false;
    }

    setWalletConfig(config: WalletConfig): Promise<boolean> {
        const undo = localUpdates.updateWalletConfig(config);
        return this.#worker
            .send({
                kind: "configureWallet",
                config,
            })
            .then(() => true)
            .catch(() => {
                undo();
                return false;
            });
    }

    isEventKindHidden = isEventKindHidden;
    mergeCombinedUnreadCounts = mergeCombinedUnreadCounts;

    #setMinLogLevel(minLogLevel: LogLevel): void {
        setMinLogLevel(minLogLevel);

        this.#worker.send({
            kind: "setMinLogLevel",
            minLogLevel,
        });
    }

    getBotConfig(): Promise<BotClientConfigData> {
        const metricsUrl =
            import.meta.env.OC_NODE_ENV === "production"
                ? `https://${this.config.userIndexCanister}.raw.ic0.app/metrics`
                : `http://${this.config.userIndexCanister}.raw.localhost:${import.meta.env.OC_REPLICA_PORT ?? "8080"}/metrics`;
        return fetch(metricsUrl, {
            headers: { "Content-Type": "application/json" },
        })
            .then((res) => {
                if (res.ok) {
                    return res.json();
                }
            })
            .then((metrics: UserIndexMetrics) => {
                return {
                    ocPublicKey: metrics.oc_public_key,
                    openStorageIndexCanister: this.config.openStorageIndexCanister,
                    icHost: this.config.icUrl ?? window.location.origin,
                };
            });
    }

    setPremiumItemCost(item: PremiumItem, chitCost: number): Promise<void> {
        return this.#worker.send({
            kind: "setPremiumItemCost",
            item,
            chitCost,
        });
    }

    // The daily puzzle. Everything per user goes through the local user index; the daily
    // canister is only asked for the public puzzle and for result verification.

    dailyPuzzleFetch(): Promise<DailyPuzzleState> {
        if (anonUserStore.value) return Promise.resolve(dailyPuzzleStore.value);
        return this.#worker
            .send({ kind: "dailyPuzzleFetch", userId: currentUserIdStore.value })
            .then((resp) => {
                if ("kind" in resp) {
                    console.warn("Daily puzzle fetch failed", resp);
                    return dailyPuzzleStore.value;
                }
                const next: DailyPuzzleState = {
                    puzzles: resp.puzzles,
                    states: resp.states,
                    lastFetched: Date.now(),
                };
                dailyPuzzleStore.set(next);
                this.#scheduleDailyPuzzleRollover(next);
                return next;
            })
            .catch((err) => {
                console.warn("Daily puzzle fetch failed", err);
                return dailyPuzzleStore.value;
            });
    }

    // Sets the CHIT stores from balances the server reported. Never guess a delta client-side:
    // a debit the user canister answered AlreadyAdded charges nothing, and a credit can be queued
    // for retry, so a guessed delta drifts from the real balance.
    static #setChitBalance(chitBalance: number, totalChitEarned: number) {
        withPausedStores(() => {
            chitStateStore.update((chit) => {
                chit.chitBalance = chitBalance;
                chit.totalChitEarned = totalChitEarned;
                return chit;
            });
            currentUserStore.update((user) => {
                user.chitBalance = chitBalance;
                user.totalChitEarned = totalChitEarned;
                return user;
            });
            userStore.updateUser(currentUserIdStore.value, (u) => ({
                ...u,
                chitBalance,
                totalChitEarned,
            }));
        });
    }

    static #setChitBalanceFrom(resp: { chitBalance?: number; totalChitEarned?: number }) {
        if (resp.chitBalance !== undefined && resp.totalChitEarned !== undefined) {
            OpenChat.#setChitBalance(resp.chitBalance, resp.totalChitEarned);
        }
    }

    dailyPuzzleStart(gameId: string, expectedFee: number): Promise<DailyPuzzleStartResponse> {
        const puzzle = todaysPuzzle(dailyPuzzleStore.value, gameId);
        if (puzzle === undefined) {
            return Promise.resolve({ kind: "error", code: -1, message: "No daily puzzle" });
        }
        return this.#worker
            .send({
                kind: "dailyPuzzleStart",
                userId: currentUserIdStore.value,
                gameId: puzzle.gameId,
                number: puzzle.number,
                expectedEntryFee: expectedFee,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    dailyPuzzleStore.update((s) => withUserState(s, resp.state));
                    OpenChat.#setChitBalanceFrom(resp);
                    this.dailyPuzzleFetch();
                }
                return resp;
            });
    }

    dailyPuzzleSubmit(gameId: string, grid: Uint8Array): Promise<DailyPuzzleSubmitResponse> {
        const puzzle = todaysPuzzle(dailyPuzzleStore.value, gameId);
        if (puzzle === undefined) {
            return Promise.resolve({ kind: "error", code: -1, message: "No daily puzzle" });
        }
        return this.#worker
            .send({
                kind: "dailyPuzzleSubmit",
                userId: currentUserIdStore.value,
                gameId: puzzle.gameId,
                number: puzzle.number,
                grid,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    dailyPuzzleStore.update((s) => {
                        const state = stateFor(s, gameId);
                        return state === undefined
                            ? s
                            : withUserState(s, {
                                  ...state,
                                  solved: resp.solved,
                                  streak: resp.solved.streak,
                                  hasSolvedBefore: true,
                              });
                    });
                    OpenChat.#setChitBalanceFrom(resp.solved);
                    this.dailyPuzzleFetch();
                }
                return resp;
            });
    }

    dailyPuzzleHint(
        gameId: string,
        level: number,
        filled: [number, number][],
        expectedPrice: number,
    ): Promise<DailyPuzzleHintResponse> {
        const puzzle = todaysPuzzle(dailyPuzzleStore.value, gameId);
        if (puzzle === undefined) {
            return Promise.resolve({ kind: "error", code: -1, message: "No daily puzzle" });
        }
        return this.#worker
            .send({
                kind: "dailyPuzzleHint",
                userId: currentUserIdStore.value,
                gameId: puzzle.gameId,
                number: puzzle.number,
                level,
                filled,
                expectedPrice,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    dailyPuzzleStore.update((s) => withUserState(s, resp.state));
                    OpenChat.#setChitBalanceFrom(resp);
                    this.dailyPuzzleFetch();
                }
                return resp;
            });
    }

    // Operator endpoints on the daily_puzzle canister. Every answer is the server's own: a
    // refusal comes back as an OCError for the caller to show, never swallowed.
    dailyPuzzleConfig(): Promise<DailyPuzzleConfig | OCError> {
        return this.#worker.send({ kind: "dailyPuzzleConfig" });
    }

    dailyPuzzleSetEnabled(enabled: boolean): Promise<Success | OCError> {
        return this.#worker.send({ kind: "dailyPuzzleSetEnabled", enabled });
    }

    // The native call push kill switch (#9456), platform operators only
    callPushEnabled(): Promise<boolean> {
        return this.#worker.send({ kind: "callPushEnabled" });
    }

    setCallPushEnabled(enabled: boolean): Promise<Success | OCError> {
        return this.#worker.send({ kind: "setCallPushEnabled", enabled });
    }

    setMiniAppServicePrincipal(principal: string): Promise<Success | OCError> {
        return this.#worker.send({ kind: "setMiniAppServicePrincipal", principal });
    }

    setAlchemyApiKey(apiKey: string | undefined): Promise<Success | OCError> {
        return this.#worker.send({ kind: "setAlchemyApiKey", apiKey });
    }

    setBridgeBot(platform: BridgePlatform, botId: string | undefined): Promise<Success | OCError> {
        return this.#worker.send({ kind: "setBridgeBot", platform, botId });
    }
    dailyPuzzleRegenerateToday(gameId: string | undefined): Promise<Success | OCError> {
        return this.#worker.send({ kind: "dailyPuzzleRegenerateToday", gameId });
    }
    dailyPuzzleSaveGrid(gameId: string, grid: Uint8Array): Promise<boolean> {
        const puzzle = todaysPuzzle(dailyPuzzleStore.value, gameId);
        if (puzzle === undefined) return Promise.resolve(false);
        return this.#worker
            .send({
                kind: "dailyPuzzleSaveGrid",
                userId: currentUserIdStore.value,
                gameId: puzzle.gameId,
                number: puzzle.number,
                grid,
            })
            .then((resp) => resp.kind === "success")
            .catch(() => false);
    }

    // Result cards check themselves against the daily canister's results index. Calls made
    // within 50ms of each other for the same puzzle are coalesced into one query, and answers
    // (including "no row") are cached for a few minutes.
    verifyDailyResults(
        gameId: string,
        number: number,
        userIds: string[],
    ): Promise<Record<string, DailyPuzzleResult>> {
        const now = Date.now();
        const verified: Record<string, DailyPuzzleResult> = {};
        const missing: string[] = [];
        for (const userId of userIds) {
            const cached = dailyPuzzleResultsCache.get(gameId, number, userId, now);
            if (cached === undefined) {
                missing.push(userId);
            } else if (cached.result !== undefined) {
                verified[userId] = cached.result;
            }
        }
        if (missing.length === 0) return Promise.resolve(verified);
        return this.#verifyDailyResultsBatched(gameId, number, missing).then((fetched) => ({
            ...verified,
            ...fetched,
        }));
    }

    #verifyDailyResultsBatched(
        gameId: string,
        number: number,
        userIds: string[],
    ): Promise<Record<string, DailyPuzzleResult>> {
        const key = `${gameId}:${number}`;
        let pending = this.#dailyResultsPending.get(key);
        if (pending === undefined) {
            const batch = new Set<string>();
            const promise = new Promise<void>((resolve) => window.setTimeout(resolve, 50)).then(
                () => {
                    this.#dailyResultsPending.delete(key);
                    return this.#processDailyResultsQueue(gameId, number, [...batch]);
                },
            );
            pending = { userIds: batch, promise };
            this.#dailyResultsPending.set(key, pending);
        }
        userIds.forEach((u) => pending.userIds.add(u));
        return pending.promise;
    }

    async #processDailyResultsQueue(
        gameId: string,
        number: number,
        userIds: string[],
    ): Promise<Record<string, DailyPuzzleResult>> {
        const byUser: Record<string, DailyPuzzleResult> = {};
        try {
            // the canister caps user_ids at 200 per call
            for (let i = 0; i < userIds.length; i += 200) {
                const chunk = userIds.slice(i, i + 200);
                const rows = await this.#worker.send({
                    kind: "dailyPuzzleResults",
                    gameId,
                    number,
                    userIds: chunk,
                });
                for (const row of rows) {
                    byUser[row.userId] = row;
                }
                dailyPuzzleResultsCache.set(
                    gameId,
                    number,
                    chunk.map((u) => [u, byUser[u]]),
                    Date.now(),
                );
            }
        } catch (err) {
            console.warn("Daily puzzle result verification failed", err);
        }
        return byUser;
    }

    payForPremiumItem(item: PremiumItem): Promise<PayForPremiumItemResponse> {
        return this.#worker
            .send({
                kind: "payForPremiumItem",
                item,
                userId: currentUserIdStore.value,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    withPausedStores(() => {
                        OpenChat.#setChitBalance(resp.chitBalance, resp.totalChitEarned);
                        premiumItemsStore.add(item);
                    });
                } else {
                    console.log("Failed to pay for premium", resp);
                }
                return resp;
            })
            .catch((err) => {
                console.log("Failed to pay for premium item", err);
                return CommonResponses.unknownError(JSON.stringify(err));
            });
    }

    async payForStreakInsurance(
        additionalDays: number,
        expectedPrice: bigint,
    ): Promise<PayForStreakInsuranceResponse> {
        let pin: string | undefined = undefined;
        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const local = {
            ...serverStreakInsuranceStore.value,
            daysInsured: serverStreakInsuranceStore.value.daysInsured + additionalDays,
        };

        return this.#worker
            .send({
                kind: "payForStreakInsurance",
                additionalDays,
                expectedPrice,
                pin,
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.updateStreakInsurance(local);
                }
                return resp;
            })
            .catch((err) => {
                console.log("Failed to pay for streak insurance: ", err);
                return CommonResponses.failure();
            });
    }

    updateDirectChatSettings(
        chat: DirectChatSummary,
        eventsTtl: OptionUpdate<bigint>,
    ): Promise<boolean> {
        return this.#worker
            .send({
                kind: "updateDirectChatSettings",
                userId: chat.them.userId,
                eventsTtl,
            })
            .then((success) => {
                if (success) {
                    localUpdates.updateDirectChatProperties(chat.id, eventsTtl);
                }
                return success;
            })
            .catch((err) => {
                console.log("Failed to update direct chat settings", err);
                return false;
            });
    }

    async #updateProposalTallies(chatId: MultiUserChatIdentifier) {
        if (get(offlineStore)) return;

        const updatedMessages = await this.#worker.send({
            kind: "updateProposalTallies",
            chatId,
        });

        selectedChatFor(chatId)?.updateEvents((events) =>
            updateExistingMessages(events, updatedMessages),
        );
    }

    async initialiseNotifications(): Promise<boolean> {
        if (!notificationsSupported) {
            console.debug("PUSH: notifications not supported");
            return false;
        }

        // Register a service worker if it hasn't already been done
        const registration = await this.#registerServiceWorker();
        if (registration == null) {
            return false;
        }
        // Ensure the service worker is updated to the latest version
        registration.update();

        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data.type === "NOTIFICATION_RECEIVED") {
                console.debug(
                    "PUSH: received push notification from the service worker",
                    event.data,
                );
                publish("notification", event.data.data as Notification);
            } else if (event.data.type === "NOTIFICATION_CLICKED") {
                console.debug(
                    "PUSH: notification clicked existing client routing to: ",
                    event.data.path,
                );
                const acknowledgeNotificationClick = async (): Promise<void> => {
                    const ackMessage = {
                        type: "NOTIFICATION_CLICKED_ACK",
                        path: event.data.path,
                    };

                    if (event.source != null && "postMessage" in event.source) {
                        (event.source as { postMessage: (msg: unknown) => void }).postMessage(
                            ackMessage,
                        );
                        return;
                    }

                    const registration = await navigator.serviceWorker.ready;
                    if (registration.active != null) {
                        registration.active.postMessage(ackMessage);
                    } else {
                        console.error(
                            "PUSH: unable to send NOTIFICATION_CLICKED_ACK - no active service worker",
                        );
                    }
                };
                publish("navigateTo", { url: event.data.path, intent: "notification" });
                void acknowledgeNotificationClick().catch((err) => {
                    console.error("PUSH: failed to acknowledge notification click", err);
                });
            }
        });

        navigator.serviceWorker.ready
            .then((registration) => {
                registration.active?.postMessage({
                    type: "NOTIFICATION_CLIENT_READY",
                });
            })
            .catch((err) => {
                console.debug("PUSH: unable to notify service worker that client is ready", err);
            });

        notificationStatus.subscribe(
            (status) => {
                switch (status) {
                    case "granted":
                        this.#notificationSubscriptionPoller = new Poller(
                            () => this.#trySubscribe(),
                            ONE_HOUR,
                            undefined,
                            true,
                        );
                        break;
                    case "pending-init":
                        break;
                    default:
                        this.#unsubscribeNotifications();
                        break;
                }
            },
            () => {
                if (this.#notificationSubscriptionPoller !== undefined) {
                    this.#notificationSubscriptionPoller.stop();
                    this.#notificationSubscriptionPoller = undefined;
                }
            },
        );

        return true;
    }

    async #registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
        // Does the browser have all the support needed for web push
        if (!notificationsSupported) {
            return undefined;
        }

        await this.#unregisterOldServiceWorker();

        try {
            return await navigator.serviceWorker.register(import.meta.env.OC_SERVICE_WORKER_PATH, {
                type: "module",
            });
        } catch (e) {
            console.log(e);
            return undefined;
        }
    }

    async #trySubscribe(): Promise<boolean> {
        console.debug("PUSH: checking user's subscription status");
        const registration = await this.#getRegistration();
        if (registration === undefined) {
            console.debug("PUSH: couldn't find push notifications service worker");
            return false;
        }

        // Check if the user has subscribed already
        let pushSubscription = await registration.pushManager.getSubscription();
        if (pushSubscription) {
            console.debug("PUSH: found existing push subscription");
            // Check if the subscription has already been pushed to the notifications canister
            if (await this.#subscriptionExists(pushSubscription.endpoint)) {
                this.#worker.send({
                    kind: "markNotificationSubscriptionActive",
                    endpoint: pushSubscription.endpoint,
                });
                console.debug("PUSH: subscription exists in the backend");
                return true;
            }
        } else {
            // Subscribe the user to webpush notifications
            console.debug("PUSH: creating a new subscription");
            pushSubscription = await this.#subscribeUserToPush(registration);
            if (pushSubscription == null) {
                return false;
            }
        }

        // Add the subscription to the user record on the notifications canister
        try {
            console.debug(
                "PUSH: saving new subscription",
                pushSubscription,
                pushSubscription.toJSON(),
            );
            await this.#pushSubscription(pushSubscription.toJSON());
            return true;
        } catch (e) {
            console.log("PUSH: Push subscription failed: ", e);
            return false;
        }
    }

    async #getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
        if (!notificationsSupported) return undefined;
        return await navigator.serviceWorker.getRegistration(
            import.meta.env.OC_SERVICE_WORKER_PATH,
        );
    }

    async #subscribeUserToPush(
        registration: ServiceWorkerRegistration,
    ): Promise<PushSubscription | null> {
        const subscribeOptions = {
            userVisibleOnly: true,
            applicationServerKey: this.#toUint8Array(this.#vapidPublicKey) as BufferSource,
        };

        try {
            const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
            return pushSubscription;
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    // The VAPID public key may be standard base64 (prod) or base64url (the dev key, and what
    // most key generators emit); atob only takes the former
    #toUint8Array(base64String: string): Uint8Array {
        const base64 = base64String.replace(/-/g, "+").replace(/_/g, "/");
        return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    }

    async #unsubscribeNotifications(): Promise<void> {
        console.debug("PUSH: unsubscribing from notifications");
        const registration = await this.#getRegistration();
        if (registration !== undefined) {
            const pushSubscription = await registration.pushManager.getSubscription();
            if (pushSubscription) {
                if (await this.#subscriptionExists(pushSubscription.endpoint)) {
                    console.debug("PUSH: removing push subscription");
                    await this.#removeSubscription(pushSubscription.endpoint);
                }
            }
        }
    }
    async #unregisterOldServiceWorker() {
        const registrations = await navigator.serviceWorker.getRegistrations();
        registrations.forEach((reg) => {
            if (reg.active && reg.active.scriptURL.endsWith("sw.js")) {
                console.debug("SW_CLIENT: unregistering old service worker");
                return reg.unregister();
            }
        });
    }

    async closeNotificationsForChat(chatId: ChatIdentifier): Promise<void> {
        const registration = await this.#getRegistration();
        if (registration !== undefined) {
            const notifications = await registration.getNotifications();
            for (const notification of notifications) {
                const url = routeForChatIdentifier("none", chatId);
                if (notification.data?.path.startsWith(url)) {
                    notification.close();
                }
            }
        }
    }

    #shouldCloseNotification(notification: Notification) {
        if (
            notification.kind === "channel_notification" ||
            notification.kind === "direct_notification" ||
            notification.kind === "group_notification"
        ) {
            return this.isMessageRead(
                {
                    chatId: notification.chatId,
                },
                notification.messageIndex,
                undefined,
            );
        }

        return false;
    }

    async #closeNotificationsIfNecessary(): Promise<void> {
        const registration = await this.#getRegistration();
        if (registration !== undefined) {
            const notifications = await registration.getNotifications();
            for (const notification of notifications) {
                const raw = notification?.data?.notification as Notification;
                if (raw !== undefined && this.#shouldCloseNotification(raw)) {
                    notification.close();
                }
            }
        }
    }

    pushRightPanelHistory(val: RightPanelContent) {
        rightPanelHistory.update((h) => {
            h.push(val);
            return h;
        });
    }

    popRightPanelHistory() {
        rightPanelHistory.update((h) => {
            return h.slice(0, h.length - 1);
        });
    }

    rightPanelContains(kind: RightPanelContent["kind"]) {
        return rightPanelHistory.value.find((p) => p.kind === kind) !== undefined;
    }

    filterRightPanelHistory(fn: (state: RightPanelContent) => boolean) {
        rightPanelHistory.update((h) => h.filter(fn));
    }

    filterRightPanelHistoryByChatType(chat?: ChatSummary) {
        if (chat === undefined) return;

        return this.filterRightPanelHistory((p) => {
            if (chat.kind === "direct_chat") {
                return ["new_group_panel", "user_profile"].includes(p.kind);
            }
            if (
                chat.kind === "group_chat" &&
                (chat.previewed ||
                    (!(chat.subtype?.isNns ?? false) && p.kind === "proposal_filters"))
            ) {
                return false;
            }
            return true;
        });
    }

    isChatListRoute(route: RouteParams): route is ChatListRoute {
        return route.kind === "chat_list_route";
    }

    isHomeRoute(route: RouteParams): route is HomeRoute {
        return route.kind === "home_route";
    }

    isCommunitiesRoute(route: RouteParams): route is CommunitiesRoute {
        return route.kind === "communities_route";
    }

    isSelectedCommunityRoute(route: RouteParams): route is SelectedCommunityRoute {
        return route.kind === "selected_community_route";
    }

    isSelectedChannelRoute(route: RouteParams): route is SelectedChannelRoute {
        return route.kind === "selected_channel_route";
    }

    isShareRoute(route: RouteParams): route is ShareRoute {
        return route.kind === "share_route";
    }

    isGlobalChatSelectedRoute(route: RouteParams): route is GlobalSelectedChatRoute {
        return route.kind === "global_chat_selected_route";
    }

    isBlogRoute(route: RouteParams): route is BlogRoute {
        return route.kind === "blog_route";
    }

    isRoadmapRoute(route: RouteParams): route is RoadmapRoute {
        return route.kind === "roadmap_route";
    }

    isWhitepaperRoute(route: RouteParams): route is WhitepaperRoute {
        return route.kind === "whitepaper_route";
    }

    isArchitectureRoute(route: RouteParams): route is ArchitectureRoute {
        return route.kind === "architecture_route";
    }

    isGuidelinesRoute(route: RouteParams): route is GuidelinesRoute {
        return route.kind === "guidelines_route";
    }

    isTermsRoute(route: RouteParams): route is TermsRoute {
        return route.kind === "terms_route";
    }

    isPrivacyRoute(route: RouteParams): route is PrivacyRoute {
        return route.kind === "privacy_route";
    }

    isFaqRoute(route: RouteParams): route is FaqRoute {
        return route.kind === "faq_route";
    }

    isDiamondRoute(route: RouteParams): route is DiamondRoute {
        return route.kind === "diamond_route";
    }

    setRouteParams(ctx: PageJS.Context, p: RouteParams) {
        withPausedStores(() => {
            routeStore.set(p);
            pathContextStore.set(ctx);
            notFoundStore.set(false);
        });
    }

    #modifyFilteredProposals(fn: (fp: FilteredProposals) => void) {
        currentChatVisit()?.updateFilteredProposals(fn);
    }

    toggleProposalFilterMessageExpansion(messageId: bigint, expand: boolean) {
        this.#modifyFilteredProposals((fp) => fp.toggleMessageExpansion(messageId, expand));
    }

    enableAllProposalFilters() {
        this.#modifyFilteredProposals((fp) => fp.enableAll());
    }

    disableAllProposalFilters(ids: number[]) {
        this.#modifyFilteredProposals((fp) => fp.disableAll(ids));
    }

    toggleProposalFilter(topic: number) {
        this.#modifyFilteredProposals((fp) => fp.toggleFilter(topic));
    }

    untranslate(messageId: bigint) {
        return removeFromWritableMap(messageId, translationsStore);
    }

    translate(messageId: bigint, translation: string) {
        return addToWritableMap(messageId, translation, translationsStore);
    }

    toggleNav() {
        navOpen.update((v) => !v);
    }

    closeNavIfOpen() {
        navOpen.update((open) => {
            if (open) {
                return false;
            }
            return open;
        });
    }

    toggleCommunityFilterLanguage(lang: string) {
        if (communityFiltersStore.value.has(lang)) {
            communityFiltersStore.update((val) => {
                const clone = new Set([...val]);
                clone.delete(lang);
                return clone;
            });
        } else {
            communityFiltersStore.update((val) => {
                const clone = new Set([...val]);
                clone.add(lang);
                return clone;
            });
        }
    }

    reinstateMissedDailyClaims(userId: string, days: number[]): Promise<boolean> {
        return this.#worker.send({
            kind: "reinstateMissedDailyClaims",
            userId,
            days,
        });
    }

    createCandidateGroup(level: Level, embeddedContent: boolean): CandidateGroupChat | undefined {
        if (level === "channel" && chatListScopeStore.value.kind !== "community") {
            return;
        }
        const id: MultiUserChatIdentifier =
            level === "channel" && chatListScopeStore.value.kind === "community"
                ? {
                      kind: "channel",
                      communityId: chatListScopeStore.value.id.communityId,
                      channelId: 0,
                  }
                : { kind: "group_chat", groupId: "" };

        return {
            id,
            kind: "candidate_group_chat",
            name: "",
            description: "",
            historyVisible: true,
            public: false,
            frozen: false,
            members: [],
            permissions: defaultChatPermissions(),
            rules: { ...defaultChatRules(level), newVersion: false },
            gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
            level,
            membership: {
                ...nullMembership(),
                role: ROLE_OWNER,
            },
            messagesVisibleToNonMembers: false,
            externalUrl: embeddedContent ? "" : undefined,
            verified: false,
        };
    }

    extractDimensionsFromMessageContent(content: MessageContent): Dimensions | undefined {
        if (content.kind === "image_content") {
            return {
                width: content.width,
                height: content.height,
            };
        } else if (content.kind === "video_content") {
            return {
                width: content.width,
                height: content.height,
            };
        } else if (content.kind === "meme_fighter_content") {
            return {
                width: content.width,
                height: content.height,
            };
        } else if (content.kind === "giphy_content") {
            return mobileWidth.value
                ? { width: content.mobile.width, height: content.mobile.height }
                : { width: content.desktop.width, height: content.desktop.height };
        }

        return undefined;
    }

    updateBlockedUsernamePatterns(pattern: string, add: boolean): Promise<void> {
        return this.#worker.send({
            kind: "updateBlockedUsernamePatterns",
            pattern,
            add,
        });
    }
}

type UserIndexMetrics = {
    oc_public_key: string;
};

function noMiniAppService(): { kind: "failed"; message: ResourceKey } {
    return { kind: "failed", message: i18nKey("bots.miniApp.refusals.unreachable") };
}
