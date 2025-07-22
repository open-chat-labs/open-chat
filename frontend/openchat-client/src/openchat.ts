/* eslint-disable no-case-declarations */
import { DER_COSE_OID, type Identity, type SignIdentity, unwrapDER } from "@dfinity/agent";
import { AuthClient, type AuthClientLoginOptions } from "@dfinity/auth-client";
import {
    DelegationChain,
    DelegationIdentity,
    ECDSAKeyIdentity,
    type JsonnableDelegationChain,
    WebAuthnIdentity,
} from "@dfinity/identity";
import DRange from "drange";
import {
    type AcceptedRules,
    type AcceptP2PSwapResponse,
    type AccessGate,
    type AccessGateConfig,
    type AccessTokenType,
    type AccountTransactionResult,
    type Achievement,
    type AddMembersToChannelResponse,
    type AirdropChannelDetails,
    anonymousUser,
    type ApproveAccessGatePaymentResponse,
    type ApproveTransferResponse,
    type ArchitectureRoute,
    type AttachmentContent,
    type AuthenticationPrincipal,
    AuthProvider,
    type BlogRoute,
    type BotActionScope,
    type BotClientConfigData,
    type BotCommandInstance,
    type BotCommandResponse,
    type BotDefinition,
    type BotDefinitionResponse,
    type BotInstallationLocation,
    type BotMessageContext,
    buildDelegationIdentity,
    type CancelP2PSwapResponse,
    type CandidateGroupChat,
    type CandidateProposal,
    type CandidateTranslations,
    canRetryMessage,
    type CaptionedContent,
    type ChallengeAttempt,
    type ChannelIdentifier,
    type ChannelSummary,
    type ChatEvent,
    type ChatFrozenEvent,
    type ChatIdentifier,
    chatIdentifiersEqual,
    chatIdentifierToString,
    type ChatListRoute,
    type ChatListScope,
    ChatMap,
    type ChatPermissions,
    ChatSet,
    type ChatSummary,
    type ChatUnfrozenEvent,
    type CheckUsernameResponse,
    type ChitEventsRequest,
    type ChitEventsResponse,
    type ChitLeaderboardResponse,
    type ChitState,
    type CkbtcMinterDepositInfo,
    type CkbtcMinterWithdrawalInfo,
    type ClaimDailyChitResponse,
    type ClientJoinCommunityResponse,
    type ClientJoinGroupResponse,
    CommonResponses,
    type CommunitiesRoute,
    type CommunityDetailsResponse,
    type CommunityIdentifier,
    communityIdentifiersEqual,
    type CommunityInvite,
    type CommunityPermissions,
    communityRoles,
    type CommunitySummary,
    compareRoles,
    type CompletedCryptocurrencyTransfer,
    type ConnectToWorkerResponse,
    contentTypeToPermission,
    type CreateCommunityResponse,
    type CreatedUser,
    type CreateGroupResponse,
    type CreateUserGroupResponse,
    type CryptocurrencyContent,
    type CryptocurrencyDetails,
    type CryptocurrencyTransfer,
    type CurrentUserResponse,
    type DataContent,
    defaultChatRules,
    deletedUser,
    type DexId,
    type DiamondMembershipDuration,
    type DiamondMembershipFees,
    type DiamondMembershipStatus,
    type DiamondRoute,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type DisableInviteCodeResponse,
    E8S_PER_TOKEN,
    type EnableInviteCodeResponse,
    type EnhancedAccessGate,
    ErrorCode,
    type EventsResponse,
    type EventWrapper,
    type ExpiredEventsRange,
    type ExploreBotsResponse,
    type ExploreChannelsResponse,
    type ExploreCommunitiesResponse,
    type ExternalBot,
    type ExternalBotCommandInstance,
    extractUserIdsFromMentions,
    type Failure,
    type FaqRoute,
    featureRestricted,
    type FromWorker,
    type FullWebhookDetails,
    type GenerateChallengeResponse,
    type GenerateMagicLinkResponse,
    getContentAsFormattedText,
    getDisplayDate,
    getEmailSignInSession,
    getTimeUntilSessionExpiryMs,
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
    type IdentityState,
    IdentityStorage,
    indexRangeForChat,
    type InternalBotCommandInstance,
    type InviteCodeResponse,
    isBalanceGate,
    isCaptionedContent,
    isCompositeGate,
    isCredentialGate,
    isEditableContent,
    isMessageNotification,
    isNeuronGate,
    isPaymentGate,
    isProposalsChat,
    isSuccessfulEventsResponse,
    isTransfer,
    type JoinVideoCallResponse,
    LARGE_GROUP_THRESHOLD,
    LEDGER_CANISTER_CHAT,
    type Level,
    type LinkIdentitiesResponse,
    type Logger,
    type MarkReadRequest,
    type Member,
    type MemberRole,
    type Mention,
    mergeCombinedUnreadCounts,
    type Message,
    type MessageActivityFeedResponse,
    type MessageActivitySummary,
    type MessageContent,
    type MessageContext,
    MessageContextMap,
    messageContextsEqual,
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
    NoMeetingToJoin,
    type Notification,
    ONE_DAY,
    ONE_HOUR,
    ONE_MINUTE_MILLIS,
    OPENCHAT_BOT_USER_ID,
    OPENCHAT_VIDEO_CALL_USER_ID,
    type OptionalChatPermissions,
    type OptionUpdate,
    parseBigInt,
    type PartitionedUserIds,
    type PayForDiamondMembershipResponse,
    type PayForStreakInsuranceResponse,
    type PaymentGateApproval,
    type PaymentGateApprovals,
    type PendingCryptocurrencyTransfer,
    type PendingCryptocurrencyWithdrawal,
    pinNumberFailureFromError,
    type PreprocessedGate,
    type ProposalVoteDetails,
    type ProposeResponse,
    type PublicProfile,
    publish,
    type PubSubEvents,
    random128,
    random64,
    type ReadonlyMap,
    type ReadonlySet,
    type Referral,
    type RegisterProposalVoteResponse,
    type RegisterUserResponse,
    type RejectReason,
    type RemoteUserSentMessage,
    type RemoteUserToggledReaction,
    removeEmailSignInSession,
    type RemoveIdentityLinkResponse,
    type RemoveMemberResponse,
    type ResetInviteCodeResponse,
    type RightPanelContent,
    type RoadmapRoute,
    ROLE_MEMBER,
    ROLE_NONE,
    routeForChatIdentifier,
    routeForMessage,
    type RouteParams,
    type Rules,
    type SaveCryptoAccountResponse,
    type SearchDirectChatResponse,
    type SearchGroupChatResponse,
    type SelectedChannelRoute,
    type SelectedCommunityRoute,
    type SendMessageResponse,
    type SendMessageSuccess,
    type SetBioResponse,
    type SetDisplayNameResponse,
    type SetMemberDisplayNameResponse,
    setMinLogLevel,
    type SetPinNumberResponse,
    type SetUsernameResponse,
    type ShareRoute,
    shouldPreprocessGate,
    type SiwePrepareLoginResponse,
    type SiwsPrepareLoginResponse,
    storeEmailSignInSession,
    type StreakInsurance,
    Stream,
    type SubmitProofOfUniquePersonhoodResponse,
    type Success,
    type SwapTokensResponse,
    type TermsRoute,
    type ThreadIdentifier,
    type ThreadPreview,
    type ThreadRead,
    type ThreadSummary,
    type ThreadSyncDetails,
    type TipMessageResponse,
    toDer,
    type TokenSwapStatusResponse,
    toTitleCase,
    type TransferSuccess,
    updateCreatedUser,
    type UpdatedEvent,
    type UpdatedRules,
    type UpdateGroupResponse,
    type UpdateMarketMakerConfigArgs,
    type UpdateMarketMakerConfigResponse,
    type UpdatesResult,
    type UpdateUserGroupResponse,
    type User,
    type UserGroupDetails,
    userIdsFromEvents,
    userIdsFromTransactions,
    type UserOrUserGroup,
    userOrUserGroupId,
    userOrUserGroupName,
    type UsersArgs,
    type UsersResponse,
    type UserStatus,
    userStatus,
    type UserSummary,
    type Verification,
    type VerifiedCredentialArgs,
    type VersionedRules,
    type VideoCallParticipant,
    type VideoCallPresence,
    type VideoCallType,
    type WalletConfig,
    WEBAUTHN_ORIGINATING_CANISTER,
    type WebAuthnKey,
    type WebAuthnKeyFull,
    type WebhookDetails,
    type WebRtcMessage,
    type WhitepaperRoute,
    type WithdrawBtcResponse,
    type WithdrawCryptocurrencyResponse,
    type WorkerError,
    type WorkerRequest,
    type WorkerResponse,
    type WorkerResult,
} from "openchat-shared";
import page from "page";
import { tick } from "svelte";
import { locale } from "svelte-i18n";
import { get } from "svelte/store";
import type { OpenChatConfig } from "./config";
import { snapshot } from "./snapshot.svelte";
import {
    achievementsStore,
    allChatsStore,
    allServerChatsStore,
    anonUserStore,
    askForNotificationPermission,
    bitcoinAddress,
    chatListScopeStore,
    chatsInitialisedStore,
    chatSummariesListStore,
    chatSummariesStore,
    chitStateStore,
    communitiesStore,
    communityFiltersStore,
    cryptoBalanceStore,
    cryptoLookup,
    currentUserIdStore,
    currentUserStore,
    diamondStatusStore,
    directChatBotsStore,
    eventListScrollTop,
    eventsStore,
    exchangeRatesLookupStore,
    expiredServerEventRanges,
    favouritesStore,
    FilteredProposals,
    filteredProposalsStore,
    hasFlag,
    identityStateStore,
    initNotificationStores,
    isDiamondStore,
    isLifetimeDiamondStore,
    lastCryptoSent,
    latestSuccessfulUpdatesLoop,
    localUpdates,
    messageActivitySummaryStore,
    messageFiltersStore,
    mobileWidth,
    moderationFlagsEnabledStore,
    navOpen,
    nervousSystemLookup,
    nextCommunityIndexStore,
    notFoundStore,
    notificationsSupported,
    notificationStatus,
    pathContextStore,
    pinnedChatsStore,
    pinNumberFailureStore,
    pinNumberRequiredStore,
    pinNumberResolverStore,
    platformOperatorStore,
    querystringCodeStore,
    querystringReferralCodeStore,
    querystringStore,
    referralsStore,
    rightPanelHistory,
    routeStore,
    selectedAuthProviderStore,
    selectedChatBlockedUsersStore,
    selectedChatExpandedDeletedMessageStore,
    selectedChatIdStore,
    selectedChatInvitedUsersStore,
    selectedChatMembersStore,
    selectedChatRulesStore,
    selectedChatSummaryStore,
    selectedChatUserGroupKeysStore,
    selectedChatUserIdsStore,
    selectedCommunityBlockedUsersStore,
    selectedCommunityIdStore,
    selectedCommunityInvitedUsersStore,
    selectedCommunityMembersStore,
    selectedCommunityReferralsStore,
    selectedCommunityRulesStore,
    selectedCommunitySummaryStore,
    selectedServerChatStore,
    selectedServerChatSummaryStore,
    selectedServerCommunityStore,
    selectedThreadIdStore,
    serverCommunitiesStore,
    serverDirectChatBotsStore,
    serverDirectChatsStore,
    serverEventsStore,
    serverFavouritesStore,
    serverGroupChatsStore,
    serverMessageActivitySummaryStore,
    serverPinnedChatsStore,
    serverStreakInsuranceStore,
    serverThreadEventsStore,
    serverWalletConfigStore,
    setSoftDisabled,
    snsFunctionsStore,
    storageStore,
    suspendedUserStore,
    swappableTokensStore,
    threadEventIndexesLoadedStore,
    threadEventsStore,
    translationsStore,
    userCreatedStore,
    walletConfigStore,
    webhookUserIdsStore,
} from "./state";
import { botState } from "./state/bots.svelte";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { CommunityDetailsState } from "./state/community/server";
import type { UndoLocalUpdate } from "./state/undo";
import { messagesRead, startMessagesReadTracker } from "./state/unread/markRead";
import { userStore } from "./state/users/state";
import { addToWritableMap, removeFromWritableMap } from "./state/utils";
import { offlineStore } from "./stores";
import { diamondDurationToMs } from "./stores/diamond";
import { applyTranslationCorrection } from "./stores/i18n";
import { lastOnlineDates } from "./stores/lastOnlineDates";
import { minutesOnlineStore } from "./stores/minutesOnline";
import { recommendedGroupExclusions } from "./stores/recommendedGroupExclusions";
import { captureRulesAcceptanceStore } from "./stores/rules";
import { initialiseMostRecentSentMessageTimes, shouldThrottle } from "./stores/throttling";
import { isTyping, typing } from "./stores/typing";
import { unconfirmedReadByThem } from "./stores/unconfirmed";
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
import {
    activeUserIdFromEvent,
    applyTranslation,
    buildBlobUrl,
    buildCryptoTransferText,
    buildIdenticonUrl,
    buildTransactionLink,
    buildTransactionUrlByIndex,
    buildUserAvatarUrl,
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
    canUnblockUsers,
    containsReaction,
    createMessage,
    diffGroupPermissions,
    doesMessageFailFilter,
    eventIndexesLoaded,
    findMessageById,
    getMembersString,
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
    sameUser,
    serialiseMessageForRtc,
    startTyping,
    stopTyping,
    updateExistingMessages,
} from "./utils/chat";
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
    isCommunityLapsed,
} from "./utils/community";
import { configKeys } from "./utils/config";
import { verifyCredential } from "./utils/credentials";
import { formatTokens, validateTokenInput } from "./utils/cryptoFormatter";
import {
    formatMessageDate,
    toDateString,
    toDatetimeString,
    toLongDateString,
    toMonthString,
    toShortTimeString,
} from "./utils/date";
import formatFileSize from "./utils/fileSize";
import { gaTrack } from "./utils/ga";
import { calculateMediaDimensions } from "./utils/layout";
import {
    disableLinksInText,
    extractDisabledLinks,
    extractEnabledLinks,
    stripLinkDisabledMarker,
} from "./utils/linkPreviews";
import { groupBy, groupWhile, keepMax, partition, toRecord, toRecord2 } from "./utils/list";
import { getUserCountryCode } from "./utils/location";
import {
    audioRecordingMimeType,
    containsSocialVideoLink,
    DIAMOND_MAX_SIZES,
    fillMessage,
    FREE_MAX_SIZES,
    isSocialVideoLink,
    type MaxMediaSizes,
    messageContentFromFile,
    spotifyRegex,
    twitterLinkRegex,
    youtubeRegex,
} from "./utils/media";
import { mergeKeepingOnlyChanged } from "./utils/object";
import { hasOwnerRights } from "./utils/permissions";
import { Poller } from "./utils/poller";
import { showTrace } from "./utils/profiling";
import { indexIsInRanges } from "./utils/range";
import { RecentlyActiveUsersTracker } from "./utils/recentlyActiveUsersTracker";
import { pageRedirect, pageReplace, routeForScope } from "./utils/routes";
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
    buildUsernameList,
    compareIsNotYouThenUsername,
    compareUsername,
    formatLastOnlineDate,
    missingUserIds,
    nullUser,
    userAvatarUrl,
} from "./utils/user";
import { isDisplayNameValid, isUsernameValid } from "./utils/validation";
import { createWebAuthnIdentity, MultiWebAuthnIdentity } from "./utils/webAuthn";

export const DEFAULT_WORKER_TIMEOUT = 1000 * 90;
const MARK_ONLINE_INTERVAL = 61 * 1000;
const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE_MILLIS;
const BOT_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
const BOT_UPDATE_IDLE_INTERVAL = 5 * ONE_MINUTE_MILLIS;
const USER_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
const REGISTRY_UPDATE_INTERVAL = 2 * ONE_MINUTE_MILLIS;
const EXCHANGE_RATE_UPDATE_INTERVAL = 5 * ONE_MINUTE_MILLIS;
const MAX_USERS_TO_UPDATE_PER_BATCH = 500;
const MAX_INT32 = Math.pow(2, 31) - 1;

type UnresolvedRequest = {
    kind: string;
    sentAt: number;
};

type PromiseResolver<T> = {
    resolve: (val: T | PromiseLike<T>, final: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void;
    timeout: number;
};

export class OpenChat {
    #worker!: Worker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    #pending: Map<string, PromiseResolver<any>> = new Map(); // in-flight requests
    #unresolved: Map<string, UnresolvedRequest> = new Map(); // requests that never resolved
    #connectedToWorker = false;
    #authIdentityStorage: IdentityStorage;
    #authPrincipal: string | undefined;
    #ocIdentityStorage: IdentityStorage;
    #authClient: Promise<AuthClient>;
    #webAuthnKey: WebAuthnKey | undefined = undefined;
    #ocIdentity: Identity | undefined;
    #userLocation: string | undefined;
    #logger: Logger;
    #lastOnlineDatesPending = new Set<string>();
    #lastOnlineDatesPromise: Promise<Record<string, number>> | undefined;
    #membershipCheck: number | undefined;
    #referralCode: string | undefined = undefined;
    #userLookupForMentions: Record<string, UserOrUserGroup> | undefined = undefined;
    #chatsPoller: Poller | undefined = undefined;
    #botsPoller: Poller | undefined = undefined;
    #registryPoller: Poller | undefined = undefined;
    #userUpdatePoller: Poller | undefined = undefined;
    #exchangeRatePoller: Poller | undefined = undefined;
    #proposalTalliesPoller: Poller | undefined = undefined;
    #recentlyActiveUsersTracker: RecentlyActiveUsersTracker = new RecentlyActiveUsersTracker();
    #inflightMessagePromises: Map<
        bigint,
        (response: SendMessageSuccess | TransferSuccess) => void
    > = new Map();
    #refreshBalanceSemaphore: Semaphore = new Semaphore(10);
    #inflightBalanceRefreshPromises: Map<string, Promise<bigint>> = new Map();
    #appType?: "android" | "ios" | "web" = undefined;
    #videoCallsInProgress: Set<bigint> = new Set();
    #serverVideoCallsInProgress: ChatMap<bigint> = new ChatMap();
    #locale!: string;
    #vapidPublicKey: string;

    currentAirdropChannel: AirdropChannelDetails | undefined = undefined;

    constructor(private config: OpenChatConfig) {
        this.#logger = config.logger;
        this.#appType = config.appType;
        this.#vapidPublicKey = config.vapidPublicKey;
        locale.subscribe((v) => (this.#locale = v ?? "en"));

        console.log("OpenChatConfig: ", config);

        userStore.setSpecialUsers([
            openChatBotUser,
            videoCallBotUser,
            airdropBotUser,
            anonymousUserSummary,
            proposalsBotUser(config.proposalBotCanister),
        ]);

        initialiseTracking(config);

        this.#authIdentityStorage = IdentityStorage.createForAuthIdentity();
        this.#ocIdentityStorage = IdentityStorage.createForOcIdentity();
        this.#authClient = AuthClient.create({
            idleOptions: {
                disableIdle: true,
                disableDefaultIdleCallback: true,
            },
            storage: this.#authIdentityStorage.storage,
        });

        this.#authClient
            .then((c) => c.getIdentity())
            .then((authIdentity) => this.#loadedAuthenticationIdentity(authIdentity, undefined));
    }

    public get AuthPrincipal(): string {
        if (this.#authPrincipal === undefined) {
            throw new Error("Trying to access the _authPrincipal before it has been set up");
        }
        return this.#authPrincipal;
    }

    isNativeAndroid() {
        return this.#appType === "android";
    }

    isNativeApp() {
        // TODO this will be updated to include iOS
        return this.isNativeAndroid();
    }

    clearCachedData() {
        return this.#sendRequest({
            kind: "clearCachedData",
        });
    }

    deleteCurrentUser(
        identityKey: CryptoKeyPair,
        delegation: JsonnableDelegationChain,
    ): Promise<boolean> {
        if (!anonUserStore.value) {
            return this.#sendRequest({
                kind: "deleteUser",
                identityKey,
                delegation,
            }).then((success) => {
                if (success) {
                    this.clearCachedData().finally(() => this.logout());
                }
                return success;
            });
        } else {
            return Promise.resolve(false);
        }
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
        this.#loadChatDetails(serverChat);
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
        id: Identity,
        authProvider: AuthProvider | undefined,
        registering: boolean = false,
    ) {
        currentUserStore.set(anonymousUser());
        chatsInitialisedStore.set(false);
        const anon = id.getPrincipal().isAnonymous();
        const authPrincipal = id.getPrincipal().toString();
        this.#authPrincipal = anon ? undefined : authPrincipal;
        this.updateIdentityState(anon ? { kind: "anon" } : { kind: "loading_user", registering });

        const connectToWorkerResponse = await this.#connectToWorker(authPrincipal, authProvider);

        if (!anon) {
            if (connectToWorkerResponse === "oc_identity_not_found") {
                if (
                    authProvider !== AuthProvider.II &&
                    authProvider !== AuthProvider.EMAIL &&
                    authProvider !== AuthProvider.PASSKEY
                ) {
                    this.updateIdentityState({ kind: "challenging" });
                    return;
                }

                await this.#sendRequest({
                    kind: "createOpenChatIdentity",
                    webAuthnCredentialId: this.#webAuthnKey?.credentialId,
                    challengeAttempt: undefined,
                });
            }

            this.#ocIdentity = await this.#ocIdentityStorage.get(authPrincipal);
        } else {
            await this.#ocIdentityStorage.remove();
        }

        await this.#loadUser();
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
        this.updateIdentityState({ kind: "logging_in" });
        const authProvider = selectedAuthProviderStore.value!;
        this.#authClient.then((c) => {
            c.login({
                ...this.getAuthClientOptions(authProvider),
                onSuccess: () => this.#loadedAuthenticationIdentity(c.getIdentity(), authProvider),
                onError: (err) => {
                    this.updateIdentityState({ kind: "anon" });
                    console.warn("Login error from auth client: ", err);
                },
            });
        });
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

    #startSession(identity: Identity): Promise<void> {
        if (anonUserStore.value) {
            return new Promise((_) => {
                console.debug("ANON: creating an anon session which will never expire");
            });
        }

        startTrackingSession(identity);

        return new Promise((resolve) => {
            const durationUntilSessionExpireMS = getTimeUntilSessionExpiryMs(identity);
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

    async submitChallenge(challengeAttempt: ChallengeAttempt): Promise<boolean> {
        if (this.#authPrincipal === undefined) {
            return false;
        }

        const resp = await this.#sendRequest({
            kind: "createOpenChatIdentity",
            webAuthnCredentialId: undefined,
            challengeAttempt,
        }).catch(() => "challenge_failed");

        if (resp !== "success") {
            return false;
        }

        this.#ocIdentity = await this.#ocIdentityStorage
            .get(this.#authPrincipal)
            .catch(() => undefined);

        this.#loadUser();
        return true;
    }

    async #loadUser() {
        this.#startRegistryPoller();

        if (this.#ocIdentity === undefined) {
            // short-circuit if we *know* that the user is anonymous
            this.onCreatedUser(anonymousUser());
            return;
        }

        this.#sendRequest({ kind: "loadFailedMessages" }).then((res) =>
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

        this.getCurrentUser()
            .then((user) => {
                switch (user.kind) {
                    case "unknown_user":
                        this.onCreatedUser(anonymousUser());
                        console.log("So this should not really happen now");
                        this.updateIdentityState({ kind: "registering" });
                        break;
                    case "created_user":
                        this.onCreatedUser(user);
                        break;
                }
            })
            .catch((e) => {
                if (e.code === 403) {
                    // This happens locally if you run a new instance of the IC and have an identity based on the
                    // previous version's root key in the cache
                    this.logout();
                }
            });
        this.#sendRequest({ kind: "getAllCachedUsers" }).then((u) => userStore.addMany(u));
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

        this.#sendRequest({
            kind: "listNervousSystemFunctions",
            snsGovernanceCanisterId: governanceCanisterId,
        }).then((val) => {
            snsFunctionsStore.update((s) => {
                s.set(governanceCanisterId, val.functions);
                return s;
            });
        });
    }

    sendMarkReadRequest(req: MarkReadRequest) {
        return this.#sendRequest({ kind: "markMessagesRead", payload: req });
    }

    maxMediaSizes(): MaxMediaSizes {
        return isDiamondStore.value ? DIAMOND_MAX_SIZES : FREE_MAX_SIZES;
    }

    onRegisteredUser(user: CreatedUser) {
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
            blobUrl: buildUserAvatarUrl(
                this.config.blobUrlPattern,
                user.userId,
                user.blobReference?.blobId ?? undefined,
            ),
            isUniquePerson: user.isUniquePerson,
        });
    }

    onCreatedUser(user: CreatedUser): void {
        currentUserStore.set(user);
        this.#setDiamondStatus(user.diamondStatus);
        initialiseMostRecentSentMessageTimes(isDiamondStore.value);
        const id = this.#ocIdentity;

        this.#sendRequest({ kind: "createUserClient", userId: user.userId });
        startSwCheckPoller();
        if (id !== undefined) {
            this.#startSession(id).then(() => this.logout());
        }

        this.#startChatsPoller();
        this.#startBotsPoller();
        this.#startUserUpdatePoller();

        initNotificationStores();
        if (!anonUserStore.value) {
            this.#startOnlinePoller();
            this.#startBtcBalanceUpdateJob();
            this.#sendRequest({ kind: "getUserStorageLimits" })
                .then((storage) => {
                    storageStore.set(storage);
                })
                .catch((err) => {
                    console.warn("Unable to retrieve user storage limits", err);
                });
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

    #startBotsPoller() {
        this.#botsPoller?.stop();
        this.#botsPoller = new Poller(
            () => this.#loadBots(),
            BOT_UPDATE_INTERVAL,
            BOT_UPDATE_IDLE_INTERVAL,
            true,
        );
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
            new Poller(
                () =>
                    (this.#sendRequest({ kind: "markAsOnline" }) ?? Promise.resolve()).then(
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

    async logout(): Promise<void> {
        await Promise.all([
            this.#authClient.then((c) => c.logout()),
            this.#ocIdentityStorage.remove(),
        ]).then(() => window.location.replace("/"));
    }

    async previouslySignedIn(): Promise<boolean> {
        const KEY_STORAGE_IDENTITY = "identity";
        const identity = await this.#authIdentityStorage.storage.get(KEY_STORAGE_IDENTITY);
        return userCreatedStore.value && identity !== null;
    }

    generateIdentityChallenge(): Promise<GenerateChallengeResponse> {
        return this.#sendRequest({
            kind: "generateIdentityChallenge",
            identityCanister: this.config.identityCanister,
            icUrl: this.config.icUrl ?? window.location.origin,
        }).catch(() => ({ kind: "failed" }));
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
                return this.#sendRequest({ kind: "getPublicGroupSummary", chatId })
                    .then((resp) => {
                        if (resp.kind === "success" && !resp.group.frozen) {
                            localUpdates.addGroupPreview(resp.group);
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
                return this.#sendRequest({ kind: "getChannelSummary", chatId })
                    .then((resp) => {
                        if (resp.kind === "channel") {
                            localUpdates.addGroupPreview(resp);
                            return CommonResponses.success();
                        }
                        return CommonResponses.failure();
                    })
                    .catch(CommonResponses.failure);
        }
    }

    toggleMuteNotifications(chatId: ChatIdentifier, muted: boolean): Promise<boolean> {
        const undo = localUpdates.updateNotificationsMuted(chatId, muted);
        return this.#sendRequest({ kind: "toggleMuteNotifications", id: chatId, muted })
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

    muteAllChannels(communityId: CommunityIdentifier): Promise<boolean> {
        const community = communitiesStore.value.get(communityId);
        if (community === undefined) {
            return Promise.resolve(false);
        }

        const undos = community.channels.map((c) =>
            localUpdates.updateNotificationsMuted(c.id, true),
        );

        return this.#sendRequest({ kind: "toggleMuteNotifications", id: communityId, muted: true })
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
        const undo = localUpdates.updateArchived(chatId, true);
        if (chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
            this.selectFirstChat();
        }
        return this.#sendRequest({ kind: "archiveChat", chatId })
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

    unarchiveChat(chatId: ChatIdentifier): Promise<boolean> {
        const undo = localUpdates.updateArchived(chatId, false);
        return this.#sendRequest({ kind: "unarchiveChat", chatId })
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
        return this.#sendRequest({
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
        return this.#sendRequest({
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
        return this.#sendRequest({ kind: "blockUserFromDirectChat", userId })
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

    unblockUserFromDirectChat(userId: string): Promise<boolean> {
        const undo = localUpdates.unblockDirectUser(userId);
        return this.#sendRequest({ kind: "unblockUserFromDirectChat", userId })
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

    setUserAvatar(data: Uint8Array, url: string): Promise<boolean> {
        const partialUser = userStore.get(currentUserIdStore.value);
        if (partialUser) {
            userStore.addUser({
                ...partialUser,
                blobData: data,
                blobUrl: url,
            });
        }

        return this.#sendRequest({ kind: "setUserAvatar", data })
            .then((_resp) => true)
            .catch(() => false);
    }

    deleteGroup(chatId: MultiUserChatIdentifier): Promise<boolean> {
        // TODO we don't use the local updates mechanism here at the moment for some reason. Probably should.
        return this.#sendRequest({ kind: "deleteGroup", chatId })
            .then((resp) => {
                if (resp.kind === "success") {
                    this.removeChat(chatId);
                    if (chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
                        this.selectFirstChat();
                    }
                    return true;
                } else {
                    return false;
                }
            })
            .catch(() => false);
    }

    deleteDirectChat(userId: string, blockUser: boolean): Promise<boolean> {
        const chatId: ChatIdentifier = { kind: "direct_chat", userId };
        const undo = localUpdates.removeChat(chatId);
        return this.#sendRequest({ kind: "deleteDirectChat", userId, blockUser })
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

    leaveGroup(
        chatId: MultiUserChatIdentifier,
    ): Promise<"success" | "failure" | "owner_cannot_leave"> {
        const undo = localUpdates.removeChat(chatId);
        return this.#sendRequest({ kind: "leaveGroup", chatId })
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

        const spender = entity.kind === "group_chat" ? entity.id.groupId : entity.id.communityId;

        const results = await Promise.all(
            [...approvals.entries()].map(([ledger, approval]) =>
                this.approveAccessGatePayment(spender, ledger, approval, pin),
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
        return this.#sendRequest({
            kind: "markActivityFeedRead",
            readUpTo,
        }).catch(undo);
    }

    subscribeToMessageActivityFeed(
        subscribeFn: (value: MessageActivityFeedResponse, final: boolean) => void,
    ) {
        this.#sendStreamRequest({
            kind: "messageActivityFeed",
            since: messageActivitySummaryStore.value.readUpToTimestamp,
        }).subscribe({
            onResult: (response, final) => {
                const userIds = new Set<string>();
                for (const event of response.events) {
                    if (event.userId !== undefined) {
                        userIds.add(event.userId);
                    }
                }
                this.getMissingUsers(userIds);
                subscribeFn(response, final);
            },
        });
    }

    async approveTransfer(
        spender: string,
        ledger: string,
        amount: bigint,
        expiresIn: bigint,
    ): Promise<ApproveTransferResponse> {
        let pin: string | undefined = undefined;
        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        return this.#sendRequest({
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

    async approveAccessGatePayment(
        spender: string,
        ledger: string,
        { amount, approvalFee }: PaymentGateApproval,
        pin: string | undefined,
    ): Promise<ApproveAccessGatePaymentResponse> {
        return this.#sendRequest({
            kind: "approveTransfer",
            spender,
            ledger,
            amount: amount - approvalFee, // The user should pay only the amount not amount+fee so it is a round number
            expiresIn: BigInt(5 * 60 * 1000), // Allow 5 mins for the join_group call before the approval expires
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

    async joinGroup(
        chat: MultiUserChat,
        credentials: string[],
        paymentApprovals: PaymentGateApprovals,
    ): Promise<ClientJoinGroupResponse> {
        const approveResponse = await this.approveAccessGatePayments(chat, paymentApprovals);
        if (approveResponse.kind !== "success") {
            return approveResponse;
        }

        return this.#sendRequest({
            kind: "joinGroup",
            chatId: chat.id,
            credentialArgs: this.#buildVerifiedCredentialArgs(credentials),
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
                        this.#loadChatDetails(resp.group);
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
                                this.#loadChatDetails(c);
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

        return this.#sendRequest({
            kind: "setMemberDisplayName",
            communityId: id.communityId,
            displayName,
            newAchievement,
        }).then((resp) => {
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
        });
    }

    followThread(chatId: ChatIdentifier, message: Message, follow: boolean): Promise<boolean> {
        const threadRootMessageIndex = message.messageIndex;

        // Assume it will succeed
        const undo = localUpdates.markThreadSummaryUpdated(message.messageId, {
            followedByMe: follow,
        });

        const newAchievement = !achievementsStore.value.has("followed_thread");

        return this.#sendRequest({
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
        return "/assets/group.svg";
    }

    toShortTimeString(date: Date): string {
        return toShortTimeString(date, this.#locale);
    }

    toMonthString(date: Date): string {
        return toMonthString(date, this.#locale);
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

    /**
     * Wrap a bunch of pure utility functions
     */
    showTrace = showTrace;
    userAvatarUrl = userAvatarUrl;
    formatTokens = formatTokens;
    validateTokenInput = validateTokenInput;
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
    disableLinksInText = disableLinksInText;

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
                return !(community?.public ?? true) || !chat.public;
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

        return this.#sendRequest({
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

        return this.#sendRequest({
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

        return this.#sendRequest({
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
                ? this.#sendRequest({
                      kind: "getDeletedGroupMessage",
                      chatId,
                      messageId,
                      threadRootMessageIndex,
                  })
                : this.#sendRequest({
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
                ? this.#sendRequest({
                      kind: "addReaction",
                      chatId,
                      messageId,
                      reaction,
                      username,
                      displayName,
                      threadRootMessageIndex,
                      newAchievement,
                  })
                : this.#sendRequest({
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

        this.#sendRtcMessage([...selectedChatUserIdsStore.value], {
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

        const eventsResponse: EventsResponse<ChatEvent> = await this.#sendRequest({
            kind: "chatEventsWindow",
            eventIndexRange: [0, threadRootEvent.event.thread.latestEventIndex],
            chatId,
            messageIndex,
            threadRootMessageIndex: threadRootEvent.event.messageIndex,
            latestKnownUpdate: chat.lastUpdated,
        }).catch(CommonResponses.failure);

        if (!isSuccessfulEventsResponse(eventsResponse)) {
            return undefined;
        }

        await this.#handleThreadEventsResponse(chatId, threadRootMessageIndex, eventsResponse);

        publish("loadedMessageWindow", {
            context: { chatId, threadRootMessageIndex: threadRootEvent.event.messageIndex },
            messageIndex,
            initialLoad,
        });

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
            const eventsResponse: EventsResponse<ChatEvent> = await this.#sendRequest({
                kind: "chatEventsWindow",
                eventIndexRange: range,
                chatId,
                messageIndex,
                threadRootMessageIndex: undefined,
                latestKnownUpdate: serverChat?.lastUpdated,
            }).catch(CommonResponses.failure);

            if (!isSuccessfulEventsResponse(eventsResponse)) {
                return undefined;
            }

            if (await this.#handleEventsResponse(clientChat, eventsResponse, false)) {
                publish("loadedMessageWindow", {
                    context: {
                        chatId: clientChat.id,
                        threadRootMessageIndex: threadRootEvent?.event.messageIndex,
                    },
                    messageIndex,
                    initialLoad,
                });
            }

            return messageIndex;
        }
    }

    async #handleEventsResponse(
        chat: ChatSummary,
        resp: EventsResponse<ChatEvent>,
        keepCurrentEvents = true,
    ): Promise<boolean> {
        if (!isSuccessfulEventsResponse(resp)) return false;

        if (!keepCurrentEvents) {
            serverEventsStore.set([]);
        }

        await this.#updateUserStoreFromEvents(resp.events);

        this.#addServerEventsToStores(chat.id, resp.events, undefined, resp.expiredEventRanges);

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

        return true;
    }

    async #updateUserStoreFromCommunityState(): Promise<void> {
        const allUserIds = new Set<string>();
        this.#getTruncatedUserIdsFromMembers([
            ...selectedCommunityMembersStore.value.values(),
        ]).forEach((m) => allUserIds.add(m.userId));
        selectedCommunityBlockedUsersStore.value.forEach((u) => allUserIds.add(u));
        selectedCommunityInvitedUsersStore.value.forEach((u) => allUserIds.add(u));
        selectedCommunityReferralsStore.value.forEach((u) => allUserIds.add(u));
        await this.getMissingUsers(allUserIds);
    }

    // We create add a limited subset of the members to the userstore for performance reasons.
    // We will already be adding users from events so it's not critical that we get all members
    // at this point
    #getTruncatedUserIdsFromMembers(members: Member[]): Member[] {
        const elevated = members.filter((m) => m.role > ROLE_MEMBER);
        const rest = members.slice(0, LARGE_GROUP_THRESHOLD);
        return [...elevated, ...rest];
    }

    async #updateUserStoreFromEvents(events: EventWrapper<ChatEvent>[]): Promise<void> {
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
        userStore.addWebhookIds([...webhooks]);
        selectedChatUserIdsStore.update((set) => {
            [...allUserIds].forEach((u) => {
                if (u !== userId) {
                    set.add(u);
                }
            });
            return set;
        });
        await this.getMissingUsers(allUserIds);
    }

    isTyping = isTyping;
    trackEvent = trackEvent;
    twitterLinkRegex = twitterLinkRegex;
    youtubeRegex = youtubeRegex;
    spotifyRegex = spotifyRegex;
    metricsEqual = metricsEqual;
    getMembersString = getMembersString;
    compareIsNotYouThenUsername = compareIsNotYouThenUsername;
    compareUsername = compareUsername;

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
        return this.#sendRequest({ kind: "blockCommunityUser", id, userId })
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
        return this.#sendRequest({ kind: "unblockCommunityUser", id, userId })
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
        return this.#sendRequest({ kind: "blockUserFromGroupChat", chatId, userId })
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
        return this.#sendRequest({ kind: "unblockUserFromGroupChat", chatId, userId })
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
    buildUsernameList = buildUsernameList;
    groupMessagesByDate = groupMessagesByDate;
    fillMessage = fillMessage;
    audioRecordingMimeType = audioRecordingMimeType;
    isDisplayNameValid = isDisplayNameValid;
    isUsernameValid = isUsernameValid;

    async createDirectChat(chatId: DirectChatIdentifier): Promise<boolean> {
        if (!userStore.has(chatId.userId)) {
            const user = await this.getUser(chatId.userId);
            if (user === undefined) {
                return false;
            }
        }
        localUpdates.addUninitialisedDirectChat(chatId);
        return true;
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
        this.#proposalTalliesPoller?.stop();
        this.#proposalTalliesPoller = undefined;

        // if this is an unknown chat let's preview it
        if (chat === undefined) {
            // if the scope is favourite let's redirect to the non-favourite counterpart and try again
            // this is necessary if the link is no longer in our favourites or came from another user and was *never* in our favourites.
            if (scope.kind === "favourite") {
                pageRedirect(
                    routeForChatIdentifier(
                        selectedCommunityIdStore.value === undefined ? "group_chat" : "community",
                        chatId,
                    ),
                );
                return;
            }
            if (chatId.kind === "direct_chat") {
                if (!(await this.createDirectChat(chatId))) {
                    publish("notFound");
                } else {
                    page(routeForChatIdentifier("direct_chat", chatId));
                }
            } else if (chatId.kind === "group_chat" || chatId.kind === "channel") {
                autojoin = querystringStore.value.has("autojoin");
                const code = querystringStore.value.get("code");
                if (code) {
                    this.groupInvite = {
                        chatId,
                        code,
                    };
                }
                const preview = await this.previewChat(chatId);
                if (preview.kind === "group_moved") {
                    if (messageIndex !== undefined) {
                        if (threadMessageIndex !== undefined) {
                            pageReplace(
                                routeForMessage(
                                    "community",
                                    {
                                        chatId: preview.location,
                                        threadRootMessageIndex: messageIndex,
                                    },
                                    threadMessageIndex,
                                ),
                            );
                        } else {
                            pageReplace(
                                routeForMessage(
                                    "community",
                                    { chatId: preview.location },
                                    messageIndex,
                                ),
                            );
                        }
                    } else {
                        pageReplace(routeForChatIdentifier(scope.kind, preview.location));
                    }
                } else if (preview.kind === "failure") {
                    publish("notFound");
                    return;
                }
            }
            chat = chatSummariesStore.value.get(chatId);
        }

        if (chat !== undefined) {
            // If an archived chat has been explicitly selected (for example by searching for it) then un-archive it
            if (chat.membership.archived) {
                this.unarchiveChat(chat.id);
            }

            // if it's a known chat let's select it
            this.closeNotificationsForChat(chat.id);
            eventListScrollTop.set(undefined);
            this.#setSelectedChat(chat.id, messageIndex);
            this.filterRightPanelHistoryByChatType(chat);

            if (autojoin && chat.kind !== "direct_chat") {
                publish("joinGroup", { group: chat, select: true });
            }
        }
    }

    #setSelectedChat(chatId: ChatIdentifier, messageIndex?: number): void {
        const clientChat = chatSummariesStore.value.get(chatId);
        const serverChat = allServerChatsStore.value.get(chatId);

        if (clientChat === undefined) {
            return;
        }

        if (messageIndex === undefined) {
            messageIndex = isPreviewing(clientChat)
                ? undefined
                : messagesRead.getFirstUnreadMessageIndex(
                      clientChat.id,
                      clientChat.latestMessage?.event.messageIndex,
                  );

            if (messageIndex !== undefined) {
                const latestServerMessageIndex = serverChat?.latestMessage?.event.messageIndex ?? 0;

                if (messageIndex > latestServerMessageIndex) {
                    messageIndex = undefined;
                }
            }
        }

        // TODO - this might belong as a derivation in the selected chat state
        this.#userLookupForMentions = undefined;

        const selectedChat = selectedChatSummaryStore.value;
        if (selectedChat !== undefined) {
            if (!this.#uninstalledBotChat(selectedChat)) {
                if (messageIndex !== undefined) {
                    this.loadEventWindow(chatId, messageIndex, undefined, true).then(() => {
                        if (serverChat !== undefined) {
                            this.#loadChatDetails(serverChat);
                        }
                    });
                } else {
                    this.loadPreviousMessages(chatId, undefined, true).then(() => {
                        if (serverChat !== undefined) {
                            this.#loadChatDetails(serverChat);
                        }
                    });
                }
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

            filteredProposalsStore.set(FilteredProposals.fromStorage(governanceCanisterId));
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
        withPausedStores(() => {
            serverThreadEventsStore.set([]);
            selectedThreadIdStore.set({
                chatId,
                threadRootMessageIndex: threadRootEvent.event.messageIndex,
            });
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

        const eventsResponse: EventsResponse<ChatEvent> = await this.#sendRequest({
            kind: "chatEvents",
            chatType: chat.kind,
            chatId,
            eventIndexRange: range,
            startIndex,
            ascending,
            threadRootMessageIndex,
            latestKnownUpdate: chat.lastUpdated,
        }).catch(CommonResponses.failure);

        if (isSuccessfulEventsResponse(eventsResponse)) {
            await this.#handleThreadEventsResponse(chatId, threadRootMessageIndex, eventsResponse);

            if (!get(offlineStore)) {
                makeRtcConnections(
                    currentUserIdStore.value,
                    chat,
                    threadEventsStore.value,
                    userStore.allUsers,
                    userStore.blockedUsers,
                    this.config.meteredApiKey,
                );
            }

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

    async #handleThreadEventsResponse(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        resp: EventsResponse<ChatEvent>,
    ): Promise<EventWrapper<ChatEvent>[]> {
        if (!isSuccessfulEventsResponse(resp)) return [];

        await this.#updateUserStoreFromEvents(resp.events);

        this.#addServerEventsToStores(chatId, resp.events, threadRootMessageIndex, []);

        return resp.events;
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

    diffGroupPermissions = diffGroupPermissions;

    messageContentFromFile(file: File): Promise<AttachmentContent> {
        return messageContentFromFile(file, isDiamondStore.value);
    }

    formatFileSize = formatFileSize;

    haveCommunityPermissionsChanged(p1: CommunityPermissions, p2: CommunityPermissions): boolean {
        const args = mergeKeepingOnlyChanged(p1, p2);
        return Object.keys(args).length > 0;
    }

    haveGroupPermissionsChanged(p1: ChatPermissions, p2: ChatPermissions): boolean {
        return this.diffGroupPermissions(p1, p2) !== undefined;
    }

    hasAccessGateChanged(
        currentConfig: AccessGateConfig,
        originalConfig: AccessGateConfig,
    ): boolean {
        if (currentConfig === originalConfig) return false;
        const current = currentConfig.gate;
        const original = originalConfig.gate;
        if (current.kind !== original.kind) return true;
        if (currentConfig.expiry !== originalConfig.expiry) return true;
        if (isNeuronGate(current) && isNeuronGate(original)) {
            return (
                current.governanceCanister !== original.governanceCanister ||
                current.minDissolveDelay !== original.minDissolveDelay ||
                current.minStakeE8s !== original.minStakeE8s
            );
        }
        if (isPaymentGate(current) && isPaymentGate(original)) {
            return (
                current.ledgerCanister !== original.ledgerCanister ||
                current.amount !== original.amount
            );
        }
        if (isBalanceGate(current) && isBalanceGate(original)) {
            return (
                current.ledgerCanister !== original.ledgerCanister ||
                current.minBalance !== original.minBalance
            );
        }
        if (isCredentialGate(current) && isCredentialGate(original)) {
            return JSON.stringify(current.credential) !== JSON.stringify(original.credential);
        }
        if (isCompositeGate(current) && isCompositeGate(original)) {
            return JSON.stringify(current) !== JSON.stringify(original);
        }
        return false;
    }

    getTokenDetailsForAccessGate(gate: AccessGate): CryptocurrencyDetails | undefined {
        if (gate.kind === "neuron_gate") {
            return this.tryGetNervousSystem(gate.governanceCanister)?.token;
        } else if (gate.kind === "payment_gate" || gate.kind === "token_balance_gate") {
            return this.tryGetCryptocurrency(gate.ledgerCanister);
        }
    }

    getMinDissolveDelayDays(gate: AccessGate): number | undefined {
        if (isNeuronGate(gate)) {
            return gate.minDissolveDelay
                ? gate.minDissolveDelay / (24 * 60 * 60 * 1000)
                : undefined;
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

    previousThreadMessagesCriteria(thread: ThreadSummary): [number, boolean] {
        const minLoadedEventIndex = this.earliestLoadedThreadIndex();
        if (minLoadedEventIndex === undefined) {
            return [thread.latestEventIndex, false];
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
            const thread = threadRootEvent.event.thread;
            const [index, ascending] = this.previousThreadMessagesCriteria(thread);
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

        const eventsResponse = criteria
            ? await this.#loadEvents(serverChat, criteria[0], criteria[1])
            : undefined;

        if (!isSuccessfulEventsResponse(eventsResponse)) {
            return;
        }

        if (await this.#handleEventsResponse(serverChat, eventsResponse)) {
            publish("loadedPreviousMessages", {
                context: { chatId, threadRootMessageIndex: threadRootEvent?.event.messageIndex },
                initialLoad,
            });
        }
    }

    #loadEvents(
        serverChat: ChatSummary,
        startIndex: number,
        ascending: boolean,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.#sendRequest({
            kind: "chatEvents",
            chatType: serverChat.kind,
            chatId: serverChat.id,
            eventIndexRange: indexRangeForChat(serverChat),
            startIndex,
            ascending,
            threadRootMessageIndex: undefined,
            latestKnownUpdate: serverChat.lastUpdated,
        }).catch(CommonResponses.failure);
    }

    #previousMessagesCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
        if (serverChat.latestEventIndex < 0) {
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

        const eventsResponse = criteria
            ? await this.#loadEvents(serverChat, criteria[0], criteria[1])
            : undefined;

        if (!isSuccessfulEventsResponse(eventsResponse)) {
            return;
        }

        await this.#handleEventsResponse(serverChat, eventsResponse);

        publish("loadedNewMessages", {
            chatId,
            threadRootMessageIndex: threadRootEvent?.event.messageIndex,
        });
    }

    morePreviousMessagesAvailable(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): boolean {
        if (threadRootEvent !== undefined) {
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
        const resp: CommunityDetailsResponse = await this.#sendRequest({
            kind: "getCommunityDetails",
            id,
            communityLastUpdated: community.lastUpdated,
        }).catch(() => ({ kind: "failure" }));
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
                selectedServerCommunityStore.update((state) => {
                    if (state) {
                        state.timestamp = resp.lastUpdated;
                    }
                    return state;
                });
            } else {
                const [lapsed, members] = partition(resp.members, (m) => m.lapsed);

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
                    ),
                );
                this.#updateUserStoreFromCommunityState();
            }
        }
    }

    async #loadChatDetails(serverChat: ChatSummary): Promise<void> {
        if (get(offlineStore)) {
            return;
        }
        switch (serverChat.kind) {
            case "group_chat":
            case "channel":
                const resp: GroupChatDetailsResponse = await this.#sendRequest({
                    kind: "getGroupDetails",
                    chatId: serverChat.id,
                    chatLastUpdated: serverChat.lastUpdated,
                }).catch(CommonResponses.failure);
                if ("members" in resp) {
                    if (!chatIdentifiersEqual(serverChat.id, selectedChatIdStore.value)) {
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

                    selectedServerChatStore.set(
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
                        ),
                    );
                    await this.#updateUserStoreFromEvents([]);
                }
                break;
            case "direct_chat":
                selectedServerChatStore.set(undefined);
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
        const selectedThreadRootMessageIndex = selectedThreadIdStore.value?.threadRootMessageIndex;

        // Partition the updated events into those that belong to the currently selected thread and those that don't
        const [currentChatEvents, currentThreadEvents] = updatedEvents.reduce(
            ([chat, thread], e) => {
                if (e.threadRootMessageIndex !== undefined) {
                    if (
                        e.threadRootMessageIndex === selectedThreadRootMessageIndex &&
                        chatIdentifiersEqual(serverChat.id, selectedChatIdStore.value) &&
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

        const chatEventsPromise =
            currentChatEvents.length === 0
                ? Promise.resolve()
                : (serverChat.kind === "direct_chat"
                      ? this.#sendRequest({
                            kind: "chatEventsByEventIndex",
                            chatId: serverChat.them,
                            eventIndexes: currentChatEvents,
                            threadRootMessageIndex: undefined,
                            latestKnownUpdate: serverChat.lastUpdated,
                        }).catch(CommonResponses.failure)
                      : this.#sendRequest({
                            kind: "chatEventsByEventIndex",
                            chatId: serverChat.id,
                            eventIndexes: currentChatEvents,
                            threadRootMessageIndex: undefined,
                            latestKnownUpdate: serverChat.lastUpdated,
                        }).catch(CommonResponses.failure)
                  ).then((resp) => {
                      if (isSuccessfulEventsResponse(resp)) {
                          resp.events.forEach((e) => {
                              if (
                                  e.event.kind === "message" &&
                                  e.event.content.kind === "video_call_content"
                              ) {
                                  publish("videoCallMessageUpdated", {
                                      chatId: serverChat.id,
                                      messageId: e.event.messageId,
                                  });
                              }
                          });
                      }
                      return this.#handleEventsResponse(serverChat, resp);
                  });

        const threadEventPromise =
            currentThreadEvents.length === 0
                ? Promise.resolve()
                : this.#sendRequest({
                      kind: "chatEventsByEventIndex",
                      chatId: serverChat.id,
                      eventIndexes: currentThreadEvents,
                      threadRootMessageIndex: selectedThreadRootMessageIndex,
                      latestKnownUpdate: serverChat.lastUpdated,
                  })
                      .then((resp) =>
                          this.#handleThreadEventsResponse(
                              serverChat.id,
                              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                              selectedThreadRootMessageIndex!,
                              resp,
                          ),
                      )
                      .catch(CommonResponses.failure);

        await Promise.all([chatEventsPromise, threadEventPromise]);
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
        const ranges = eventIndexesLoaded(chatId).subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return undefined;
    }

    #confirmedThreadUpToEventIndex(): number | undefined {
        const ranges = threadEventIndexesLoadedStore.value.subranges();
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
        return this.#sendRequest({ kind: "unpinMessage", chatId, messageIndex })
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
        return this.#sendRequest({
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
        );
    }

    #addServerEventsToStores(
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
            const now = BigInt(Date.now());
            const recentlyActiveCutOff = now - BigInt(12 * ONE_HOUR);

            // To ensure we keep the chat summary up to date, if these events are in the main event list, check if there is
            // now a new latest message and if so, mark it as a local chat summary update.
            let latestMessageIndex =
                threadRootMessageIndex === undefined
                    ? allServerChatsStore.value.get(chatId)?.latestMessageIndex ?? -1
                    : undefined;
            let newLatestMessage: EventWrapper<Message> | undefined = undefined;

            const anyFailedMessages = localUpdates.anyFailed(context);

            for (const event of newEvents) {
                if (event.event.kind === "message") {
                    const { content, messageIndex, messageId } = event.event;
                    if (anyFailedMessages && localUpdates.deleteFailedMessage(context, messageId)) {
                        this.#sendRequest({
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
                    // If the message was sent by the current user, mark it as read
                    if (
                        event.event.sender === myUserId &&
                        !messagesRead.isRead(context, messageIndex, messageId)
                    ) {
                        messagesRead.markMessageRead(context, messageIndex, messageId);
                    }
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
                    this.#updateServerEventsStore(chatId, (events) =>
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
                }
            } else if (isContiguousInThread({ chatId, threadRootMessageIndex }, newEvents)) {
                this.#updateServerThreadEventsStore({ chatId, threadRootMessageIndex }, (events) =>
                    mergeServerEvents(events, newEvents, context),
                );
            }

            if (expiredEventRanges.length > 0) {
                this.#updateServerExpiredEventRanges(chatId, (ranges) => {
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

    #updateServerExpiredEventRanges(chatId: ChatIdentifier, fn: (existing: DRange) => DRange) {
        if (!chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
            console.warn(
                "Attempting to updateExpiredServerEventRanges for the wrong chat - probably a stale response",
                chatId,
                selectedChatIdStore.value,
            );
            return;
        }
        expiredServerEventRanges.update(fn);
    }

    #updateServerThreadEventsStore(
        id: ThreadIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!messageContextsEqual(id, selectedThreadIdStore.value)) {
            console.warn(
                "Attempting to updateServerThreadEvents for the wrong thread - probably a stale response",
                id,
                selectedThreadIdStore.value,
            );
            return;
        }
        serverThreadEventsStore.update(fn);
    }

    #updateServerEventsStore(
        chatId: ChatIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
            console.warn(
                "Attempting to updateServerEvents for the wrong chat - probably a stale response",
                chatId,
                selectedChatIdStore.value,
            );
            return;
        }
        serverEventsStore.update(fn);
    }

    async #sendMessageWebRtc(
        clientChat: ChatSummary,
        message: NewUnconfirmedMessage,
        threadRootMessageIndex: number | undefined,
    ): Promise<void> {
        rtcConnectionsManager.sendMessage([...selectedChatUserIdsStore.value], {
            kind: "remote_user_sent_message",
            id: clientChat.id,
            message: serialiseMessageForRtc(message),
            userId: currentUserIdStore.value,
            threadRootMessageIndex,
        });
    }

    deleteFailedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        localUpdates.deleteFailedMessage({ chatId, threadRootMessageIndex }, messageId);
        return this.#sendRequest({
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
    ): Promise<SendMessageResponse> {
        const { chatId, threadRootMessageIndex } = messageContext;

        let acceptedRules: AcceptedRules | undefined = undefined;
        if (this.#rulesNeedAccepting()) {
            acceptedRules = await this.#promptForRuleAcceptance();
            if (acceptedRules === undefined) {
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

        if (!retrying) {
            this.#postSendMessage(chat, messageEvent, threadRootMessageIndex);
        } else {
            // remove the *original* event from the failed store
            await this.deleteFailedMessage(chatId, message.messageId, threadRootMessageIndex);

            // add the *new* event to unconfirmed
            localUpdates.addUnconfirmed(messageContext, messageEvent);
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

        const sendMessagePromise: Promise<SendMessageResponse> = new Promise((resolve) => {
            this.#inflightMessagePromises.set(messageId, resolve);
            this.#sendStreamRequest(
                {
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
                },
                undefined,
                ledger !== undefined ? 2 * DEFAULT_WORKER_TIMEOUT : undefined,
            ).subscribe({
                onResult: (response) => {
                    if (response === "accepted") {
                        localUpdates.markUnconfirmedAccepted(messageContext, messageId);

                        if (!isTransfer(message.content)) {
                            this.#sendMessageWebRtc(chat, message, threadRootMessageIndex);
                        }
                        return;
                    }
                    this.#inflightMessagePromises.delete(messageId);
                    const [resp, msg] = response;
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        const event = mergeSendMessageResponse(msg, resp);
                        this.#addServerEventsToStores(chat.id, [event], threadRootMessageIndex, []);
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

    #extractLedgerFromContent(content: MessageContent): string | undefined {
        switch (content.kind) {
            case "crypto_content":
            case "prize_content_initial":
                return content.transfer.ledger;

            case "prize_content":
                return content.token;

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

    #rulesNeedAccepting(): boolean {
        const chatRules = selectedChatRulesStore.value;
        const chat = selectedChatSummaryStore.value;
        if (chat === undefined || chatRules === undefined) {
            return false;
        }

        const communityRules = selectedCommunityRulesStore.value;
        const community = selectedCommunitySummaryStore.value;

        console.debug(
            "RULES: rulesNeedAccepting",
            chatRules.enabled,
            chat.membership?.rulesAccepted,
            communityRules?.enabled,
            community?.membership?.rulesAccepted,
        );

        return (
            (chatRules.enabled && !(chat.membership?.rulesAccepted ?? false)) ||
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
        retrying = false,
    ): Promise<SendMessageResponse> {
        const { chatId, threadRootMessageIndex } = messageContext;
        const chat = chatSummariesStore.value.get(chatId);
        if (chat === undefined) {
            return Promise.resolve(CommonResponses.failure());
        }

        const draftMessage = localUpdates.draftMessages.value.get(messageContext);
        const timestamp = Date.now();
        const msg = {
            timestamp: BigInt(timestamp),
            expiresAt: threadRootMessageIndex ? undefined : this.eventExpiry(chat, timestamp),
            messageId: random64(),
            sender: currentUserIdStore.value,
            content,
            repliesTo: draftMessage?.replyingTo,
            forwarded,
            blockLevelMarkdown,
        };

        return this.#sendMessageCommon(chat, messageContext, msg, mentioned, retrying);
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
    ): void {
        this.sendMessageWithContent(
            messageContext,
            this.#getMessageContent(textContent, attachment),
            blockLevelMarkdown,
            mentioned,
            false,
        );
    }

    #getMessageContent(
        text: string | undefined,
        captioned: CaptionedContent | undefined,
    ): MessageContent {
        return captioned
            ? { ...captioned, caption: text }
            : ({
                  kind: "text_content",
                  text: text ?? "",
              } as MessageContent);
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
                if (!isTransfer(messageEvent.event.content)) {
                    localUpdates.addUnconfirmed(context, messageEvent);
                }

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

                localUpdates.draftMessages.delete(context);
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
    isSocialVideoLink = isSocialVideoLink;
    containsSocialVideoLink = containsSocialVideoLink;
    calculateMediaDimensions = calculateMediaDimensions;
    dataToBlobUrl = dataToBlobUrl;
    askForNotificationPermission = askForNotificationPermission;
    setSoftDisabled = setSoftDisabled;
    gaTrack = gaTrack;

    editMessageWithAttachment(
        messageContext: MessageContext,
        textContent: string | undefined,
        blockLevelMarkdown: boolean,
        attachment: AttachmentContent | undefined,
        editingEvent: EventWrapper<Message>,
    ): Promise<boolean> {
        const chat = chatSummariesStore.value.get(messageContext.chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        if (textContent || attachment) {
            if (textContent && editingEvent.event.content.kind === "text_content") {
                const disabledLinks = extractDisabledLinks(editingEvent.event.content.text);
                textContent = disableLinksInText(textContent, disabledLinks);
            }

            const captioned =
                attachment ??
                (isCaptionedContent(editingEvent.event.content)
                    ? editingEvent.event.content
                    : undefined);

            const msg = {
                ...editingEvent.event,
                edited: true,
                content: this.#getMessageContent(textContent ?? undefined, captioned),
            };
            const updatedBlockLevelMarkdown =
                msg.blockLevelMarkdown === blockLevelMarkdown ? undefined : blockLevelMarkdown;

            const undo = localUpdates.markMessageContentEdited(msg, updatedBlockLevelMarkdown);
            localUpdates.draftMessages.delete(messageContext);

            const newAchievement = !achievementsStore.value.has("edited_message");

            return this.#sendRequest({
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
                        return false;
                    }
                    return true;
                })
                .catch(() => {
                    undo();
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
        if (event.event.content.kind !== "text_content") {
            return Promise.resolve(false);
        }

        const text = disableLinksInText(event.event.content.text, [link]);

        const msg = {
            ...event.event,
            content: this.#getMessageContent(text, undefined),
        };
        const undo = localUpdates.markLinkRemoved(msg.messageId, msg.content);

        return this.#sendRequest({
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

    notificationReceived(notification: Notification): void {
        let chatId: ChatIdentifier;
        let threadRootMessageIndex: number | undefined = undefined;
        let eventIndex: number;
        switch (notification.kind) {
            case "direct_notification":
            case "direct_reaction":
            case "direct_message_tipped":
            case "group_notification":
            case "group_reaction":
            case "group_message_tipped":
            case "channel_notification":
            case "channel_reaction":
            case "channel_message_tipped": {
                chatId = notification.chatId;
                eventIndex = notification.messageEventIndex;
                if ("threadRootMessageIndex" in notification) {
                    threadRootMessageIndex = notification.threadRootMessageIndex;
                }
                break;
            }

            case "added_to_channel_notification":
                return;
        }

        const serverChat = allServerChatsStore.value.get(chatId);
        if (serverChat === undefined) {
            return;
        }

        if (!isMessageNotification(notification)) {
            // TODO first clear the existing cache entry
            return;
        }

        const minVisibleEventIndex =
            serverChat.kind === "direct_chat" ? 0 : serverChat.minVisibleEventIndex;
        const latestEventIndex = Math.max(eventIndex, serverChat.latestEventIndex);

        // Load the event
        this.#sendRequest({
            kind: "chatEvents",
            chatType: serverChat.kind,
            chatId,
            eventIndexRange: [minVisibleEventIndex, latestEventIndex],
            startIndex: eventIndex,
            ascending: false,
            threadRootMessageIndex,
            latestKnownUpdate: serverChat.lastUpdated,
        })
            .then((resp) => {
                if (!isSuccessfulEventsResponse(resp)) return resp;
                if (!this.isChatPrivate(serverChat)) return resp;

                const ev = resp.events.find((e) => e.index === eventIndex);
                if (ev !== undefined) {
                    if (
                        ev.event.kind === "message" &&
                        ev.event.content.kind === "video_call_content"
                    ) {
                        this.#publishRemoteVideoCallStarted({
                            chatId,
                            userId: ev.event.sender,
                            messageId: ev.event.messageId,
                            currentUserIsParticipant: false,
                            callType: ev.event.content.callType,
                            timestamp: ev.timestamp,
                        });
                    }
                }
                return resp;
            })
            .catch(() => {
                console.warn("Failed to load event from notification");
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

        this.#sendRequest({
            kind: "rehydrateMessage",
            chatId: serverChat.id,
            message: messageEvent,
            threadRootMessageIndex,
            latestKnownUpdate: serverChat.lastUpdated,
        }).then((m) => {
            this.#handleEventsResponse(serverChat, {
                events: [m],
                expiredEventRanges: [],
                expiredMessageRanges: [],
                latestEventIndex: undefined,
            });
        });
    }

    expandDeletedMessages(messageIndexes: Set<number>): void {
        selectedChatExpandedDeletedMessageStore.update((set) => {
            messageIndexes.forEach((i) => set.add(i));
            return set;
        });
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
    doesUserMeetAccessGates(gates: AccessGate[]): boolean {
        return gates.every((g) => this.doesUserMeetAccessGate(g));
    }

    doesUserMeetAccessGate(gate: AccessGate): boolean {
        if (isCompositeGate(gate)) {
            return gate.operator === "and"
                ? gate.gates.every((g) => this.doesUserMeetAccessGate(g))
                : gate.gates.some((g) => this.doesUserMeetAccessGate(g));
        } else {
            if (gate.kind === "diamond_gate") {
                return currentUserStore.value.diamondStatus.kind !== "inactive";
            } else if (gate.kind === "lifetime_diamond_gate") {
                return currentUserStore.value.diamondStatus.kind === "lifetime";
            } else if (gate.kind === "unique_person_gate") {
                return currentUserStore.value.isUniquePerson;
            } else {
                return false;
            }
        }
    }

    gatePreprocessingRequired(gates: AccessGate[]): boolean {
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
            community.gateConfig.gate.kind !== "no_gate" &&
            (community.membership.role === ROLE_NONE || community.membership.lapsed) &&
            (!community.isInvited || !excludeInvited)
        ) {
            gates.push({
                level: "community",
                expiry: community.gateConfig.expiry,
                ...community.gateConfig.gate,
            });
        }
        if (
            chat.gateConfig.gate.kind !== "no_gate" &&
            (chat.membership.role === ROLE_NONE || chat.membership.lapsed) &&
            (!chat.isInvited || !excludeInvited)
        ) {
            gates.push({
                level: chat.level,
                expiry: chat.gateConfig.expiry,
                ...chat.gateConfig.gate,
            });
        }
        return gates;
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
        return this.#sendRequest({ kind: "checkUsername", username, isBot }).then((resp) => {
            console.log("Resp: ", resp);
            return resp;
        });
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this.#sendRequest({ kind: "searchUsers", searchTerm, maxResults })
            .then((resp) => {
                userStore.addMany(resp);
                return resp;
            })
            .catch(() => []);
    }

    lookupChatSummary(chatId: ChatIdentifier): ChatSummary | undefined {
        return allChatsStore.value.get(chatId);
    }

    searchUsersForInvite(
        searchTerm: string,
        maxResults: number,
        level: Level,
        newGroup: boolean,
        canInviteUsers: boolean,
    ): Promise<[UserSummary[], UserSummary[]]> {
        if (level === "channel") {
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
                return Promise.resolve([communityMatches, []]);
            }

            // Search the global user list and overfetch if there are existing members we might need to remove
            const maxToSearch = newGroup ? maxResults : maxResults * 2;
            return this.searchUsers(searchTerm, maxToSearch).then((globalMatches) => {
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
            });
        } else {
            // Search the global user list and overfetch if there are existing members we might need to remove
            const maxToSearch = newGroup ? maxResults : maxResults * 2;
            return this.searchUsers(searchTerm, maxToSearch).then((matches) => {
                if (!newGroup) {
                    // Put the existing users in a map for easy lookup - for communities the existing members
                    // are already in a map
                    const existing =
                        level === "community"
                            ? selectedCommunityMembersStore.value
                            : selectedChatMembersStore.value;

                    // Remove any existing members from the global matches until there are at most `maxResults`
                    // TODO: Ideally we would return the total number of matches from the server and use that
                    const maxToKeep = matches.length < maxToSearch ? 0 : maxResults;
                    keepMax(matches, (u) => !existing?.has(u.userId), maxToKeep);
                }
                return [[], matches];
            });
        }
    }

    searchCommunityMembersToAdd(
        searchTerm: string,
        maxResults: number,
    ): Promise<[UserSummary[], UserSummary[]]> {
        // Search the community members excluding the existing channel members
        const communityMatches = this.#searchCommunityUsersForChannelInvite(
            searchTerm,
            maxResults,
            selectedChatMembersStore.value,
        );

        return Promise.resolve([communityMatches, []]);
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
        if (code) {
            gaTrack("captured_referral_code", "registration");
            localStorage.setItem("openchat_referredby", code);
            captured = true;
        }
        this.#referralCode = localStorage.getItem("openchat_referredby") ?? undefined;
        return captured;
    }

    getReferringUser(): Promise<UserSummary | undefined> {
        return this.#referralCode === undefined
            ? Promise.resolve(undefined)
            : this.getUser(this.#referralCode);
    }

    registerBot(principal: string, bot: ExternalBot): Promise<boolean> {
        return this.#sendRequest({
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
        return this.#sendRequest({
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
        return this.#sendRequest({
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

    registerUser(username: string): Promise<RegisterUserResponse> {
        return this.#sendRequest({
            kind: "registerUser",
            username,
            referralCode: this.#referralCode,
        })
            .then((res) => {
                console.log("register user response: ", res);
                if (res.kind === "success") {
                    gaTrack("registered_user", "registration", res.userId);
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
            this.#sendStreamRequest({ kind: "getCurrentUser" }).subscribe({
                onResult: (user) => {
                    if (user.kind === "created_user") {
                        userCreatedStore.set(true);
                        currentUserStore.set(user);
                        this.#setDiamondStatus(user.diamondStatus);
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

    getDisplayNameById(userId: string, communityMembers?: ReadonlyMap<string, Member>): string {
        return this.getDisplayName(userStore.get(userId), communityMembers);
    }

    getDisplayName(
        user: { userId: string; username: string; displayName?: string } | undefined,
        communityMembers?: ReadonlyMap<string, Member>,
    ): string {
        if (user !== undefined) {
            const member = communityMembers?.get(user.userId);
            const displayName = member?.displayName ?? user.displayName ?? user.username;
            if (displayName?.length > 0) {
                return displayName;
            }
        }

        return this.config.i18nFormatter("unknownUser");
    }

    #subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.#sendRequest({ kind: "subscriptionExists", p256dh_key }).catch(() => false);
    }

    #pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.#sendRequest({ kind: "pushSubscription", subscription });
    }

    #removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.#sendRequest({ kind: "removeSubscription", subscription });
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
        return this.#sendRequest({ kind: "fcmTokenExists", fcmToken });
    }

    addFcmToken(fcmToken: string, onResponseError?: (error: string | null) => void): Promise<void> {
        return this.#sendRequest({ kind: "addFcmToken", fcmToken, onResponseError });
    }

    inviteUsers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        const undo = this.#inviteUsersLocally(id, userIds);
        return this.#sendRequest({
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
        return this.#sendRequest({
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
        return this.#sendRequest({
            kind: "addMembersToChannel",
            chatId,
            userIds,
            username: currentUserStore.value.username,
            displayName: currentUserStore.value.displayName,
        }).catch((err) => {
            return { kind: "internal_error", error: err.toString() };
        });
    }

    removeCommunityMember(id: CommunityIdentifier, userId: string): Promise<RemoveMemberResponse> {
        const undo = localUpdates.removeCommunityMember(id, userId);
        return this.#sendRequest({ kind: "removeCommunityMember", id, userId })
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
        return this.#sendRequest({ kind: "removeMember", chatId, userId })
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

        return this.#sendRequest({ kind: "changeCommunityRole", id, userId, newRole })
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
        return this.#sendRequest({ kind: "changeRole", chatId, userId, newRole })
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

    registerProposalVote(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.#sendRequest(
            {
                kind: "registerProposalVote",
                chatId,
                messageIndex,
                adopt,
            },
            false,
            2 * DEFAULT_WORKER_TIMEOUT,
        ).catch(CommonResponses.failure);
    }

    getProposalVoteDetails(
        messageId: bigint,
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
    ): Promise<ProposalVoteDetails> {
        return this.#sendRequest({
            kind: "getProposalVoteDetails",
            governanceCanisterId,
            proposalId,
            isNns,
        }).then((resp) => {
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

        recommendedGroupExclusions.value().forEach((c) => exclusions.add(c));

        return this.#sendRequest({
            kind: "getRecommendedGroups",
            exclusions: [...exclusions],
        }).catch(() => []);
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.#sendRequest({ kind: "searchGroups", searchTerm, maxResults });
    }

    exploreBots(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        location: BotInstallationLocation | undefined,
        excludeInstalled: boolean,
    ): Promise<ExploreBotsResponse> {
        return this.#sendRequest({
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
        return this.#sendRequest({
            kind: "exploreCommunities",
            searchTerm,
            pageIndex,
            pageSize,
            flags,
            languages,
        });
    }

    exploreChannels(
        id: CommunityIdentifier,
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
    ): Promise<ExploreChannelsResponse> {
        return this.#sendRequest({
            kind: "exploreChannels",
            id,
            searchTerm,
            pageIndex,
            pageSize,
        }).catch(() => ({ kind: "failure" }));
    }

    dismissRecommendation(chatId: GroupChatIdentifier): Promise<void> {
        recommendedGroupExclusions.add(chatIdentifierToString(chatId));
        return this.#sendRequest({ kind: "dismissRecommendation", chatId });
    }

    set groupInvite(value: GroupInvite) {
        this.config.groupInvite = value;
        this.#sendRequest({
            kind: "groupInvite",
            value,
        });
    }

    setCommunityInvite(value: CommunityInvite): Promise<void> {
        this.config.communityInvite = value;
        return this.#sendRequest({
            kind: "communityInvite",
            value,
        });
    }

    setCommunityReferral(communityId: CommunityIdentifier, referredBy: string) {
        // make sure that we can't refer ourselves
        if (currentUserIdStore.value !== referredBy) {
            return this.#sendRequest({
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
                return this.#sendRequest({
                    kind: "searchGroupChat",
                    chatId,
                    searchTerm,
                    userIds,
                    maxResults,
                });
            case "direct_chat":
                return this.#sendRequest({
                    kind: "searchDirectChat",
                    chatId,
                    searchTerm,
                    maxResults,
                });
        }
    }

    refreshAccountBalance(ledger: string, allowCached: boolean = false): Promise<bigint> {
        const user = currentUserStore.value;
        if (user === undefined) {
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

        const promise: Promise<bigint> = new Promise((resolve) => {
            this.#refreshBalanceSemaphore
                .execute(() => {
                    return this.#sendRequest({
                        kind: "refreshAccountBalance",
                        ledger,
                        principal: user.userId,
                    })
                        .then((val) => {
                            cryptoBalanceStore.setBalance(ledger, val);
                            return val;
                        })
                        .catch(() => 0n)
                        .finally(() => this.#inflightBalanceRefreshPromises.delete(ledger));
                })
                .then(resolve);
        });

        this.#inflightBalanceRefreshPromises.set(ledger, promise);

        return promise;
    }

    refreshTranslationsBalance(): Promise<bigint> {
        return this.#sendRequest({
            kind: "refreshAccountBalance",
            ledger: LEDGER_CANISTER_CHAT,
            principal: this.config.translationsCanister,
        }).catch(() => 0n);
    }

    async getAccountTransactions(
        ledgerIndex: string,
        fromId?: bigint,
    ): Promise<AccountTransactionResult> {
        return this.#sendRequest({
            kind: "getAccountTransactions",
            ledgerIndex: ledgerIndex,
            fromId,
            principal: currentUserIdStore.value,
        })
            .then(async (resp) => {
                if (resp.kind === "success") {
                    const userIds = userIdsFromTransactions(resp.transactions);
                    await this.getMissingUsers(userIds);
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

        return this.#sendRequest({
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
                return threads;
            })
            .catch(() => []);
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

        return this.#sendRequest({
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
                if (resp.currentUser) {
                    currentUserStore.set(
                        resp.currentUser
                            ? updateCreatedUser(currentUserStore.value, resp.currentUser)
                            : currentUserStore.value,
                    );
                }
                return resp;
            })
            .catch(() => ({ users: [], deletedUserIds: new Set() }));
    }

    getUser(userId: string, allowStale = false): Promise<UserSummary | undefined> {
        return this.#sendRequest({
            kind: "getUser",
            userId,
            allowStale,
        })
            .then((resp) => {
                if (resp !== undefined) {
                    userStore.addUser(resp);
                }
                return resp;
            })
            .catch(() => undefined);
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

    getPublicProfile(userId?: string): Promise<PublicProfile | undefined> {
        return this.#sendRequest({ kind: "getPublicProfile", userId });
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.#sendRequest({ kind: "setUsername", userId, username }).then((resp) => {
            if (resp === "success") {
                currentUserStore.set({
                    ...currentUserStore.value,
                    username,
                });
                this.#overwriteUserInStore(userId, (user) => ({ ...user, username }));
            }
            return resp;
        });
    }

    setDisplayName(
        userId: string,
        displayName: string | undefined,
    ): Promise<SetDisplayNameResponse> {
        return this.#sendRequest({ kind: "setDisplayName", userId, displayName }).then((resp) => {
            if (resp === "success") {
                currentUserStore.set({
                    ...currentUserStore.value,
                    displayName,
                });
                this.#overwriteUserInStore(userId, (user) => ({ ...user, displayName }));
            }
            return resp;
        });
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.#sendRequest({ kind: "setBio", bio });
    }

    getBio(userId?: string): Promise<string> {
        return this.#sendRequest({ kind: "getBio", userId });
    }

    async withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
    ): Promise<WithdrawCryptocurrencyResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        return this.#sendRequest({ kind: "withdrawCryptocurrency", domain, pin }).then((resp) => {
            if (resp.kind === "error") {
                const pinNumberFailure = pinNumberFailureFromError(resp);
                if (pinNumberFailure !== undefined) {
                    pinNumberFailureStore.set(pinNumberFailure);
                }
            }

            return resp;
        });
    }

    async getGroupMessagesByMessageIndex(
        chatId: MultiUserChatIdentifier,
        messageIndexes: ReadonlySet<number>,
    ): Promise<EventsResponse<Message>> {
        const serverChat = allServerChatsStore.value.get(chatId);

        try {
            const resp = await this.#sendRequest({
                kind: "getGroupMessagesByMessageIndex",
                chatId,
                messageIndexes: new Set(messageIndexes),
                latestKnownUpdate: serverChat?.lastUpdated,
            });
            if (isSuccessfulEventsResponse(resp)) {
                await this.#updateUserStoreFromEvents(resp.events);
            }
            return resp;
        } catch {
            return CommonResponses.failure();
        }
    }

    getInviteCode(id: GroupChatIdentifier | CommunityIdentifier): Promise<InviteCodeResponse> {
        return this.#sendRequest({ kind: "getInviteCode", id }).catch(CommonResponses.failure);
    }

    enableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<EnableInviteCodeResponse> {
        return this.#sendRequest({ kind: "enableInviteCode", id }).catch(CommonResponses.failure);
    }

    disableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<DisableInviteCodeResponse> {
        return this.#sendRequest({ kind: "disableInviteCode", id }).catch(CommonResponses.failure);
    }

    resetInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<ResetInviteCodeResponse> {
        return this.#sendRequest({ kind: "resetInviteCode", id }).catch(CommonResponses.failure);
    }

    updateGroup(
        chatId: MultiUserChatIdentifier,
        name?: string,
        desc?: string,
        rules?: UpdatedRules,
        permissions?: OptionalChatPermissions,
        avatar?: Uint8Array,
        eventsTimeToLive?: OptionUpdate<bigint>,
        gateConfig?: AccessGateConfig,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
        externalUrl?: string,
    ): Promise<UpdateGroupResponse> {
        return this.#sendRequest({
            kind: "updateGroup",
            chatId,
            name,
            desc,
            rules,
            permissions,
            avatar,
            eventsTimeToLive,
            gateConfig,
            isPublic,
            messagesVisibleToNonMembers,
            externalUrl,
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.updateChatProperties(
                        chatId,
                        name,
                        desc,
                        permissions,
                        gateConfig,
                        eventsTimeToLive,
                        isPublic,
                    );

                    if (rules !== undefined && resp.rulesVersion !== undefined) {
                        localUpdates.updateChatRules(chatId, {
                            text: rules.text,
                            enabled: rules.enabled,
                            version: resp.rulesVersion,
                        });
                    }
                } else {
                    this.#logger.error("Update group rules failed: ", resp.kind);
                }
                return resp;
            })
            .catch(() => ({ kind: "failure" }));
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

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.#sendRequest({ kind: "createGroupChat", candidate }).then((resp) => {
            if (resp.kind === "success") {
                const group = groupChatFromCandidate(resp.canisterId, candidate);
                localUpdates.addChat(group);
            }
            return resp;
        });
    }

    markThreadSummaryUpdated(threadRootMessageId: bigint, summary: Partial<ThreadSummary>): void {
        localUpdates.markThreadSummaryUpdated(threadRootMessageId, summary);
    }

    freezeCommunity(id: CommunityIdentifier, reason: string | undefined): Promise<boolean> {
        return this.#sendRequest({ kind: "freezeCommunity", id, reason })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    unfreezeCommunity(id: CommunityIdentifier): Promise<boolean> {
        return this.#sendRequest({ kind: "unfreezeCommunity", id })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    freezeGroup(chatId: GroupChatIdentifier, reason: string | undefined): Promise<boolean> {
        return this.#sendRequest({ kind: "freezeGroup", chatId, reason })
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
        return this.#sendRequest({ kind: "unfreezeGroup", chatId })
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
        return this.#sendRequest({ kind: "deleteFrozenGroup", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    addHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.#sendRequest({ kind: "addHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    removeHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.#sendRequest({ kind: "removeHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    addRemoveSwapProvider(swapProvider: DexId, add: boolean): Promise<boolean> {
        return this.#sendRequest({ kind: "addRemoveSwapProvider", swapProvider, add });
    }

    addMessageFilter(regex: string): Promise<boolean> {
        try {
            new RegExp(regex);
        } catch (e) {
            console.error("Unable to add message filter - invalid regex", regex);
            return Promise.resolve(false);
        }

        return this.#sendRequest({ kind: "addMessageFilter", regex });
    }

    removeMessageFilter(id: bigint): Promise<boolean> {
        return this.#sendRequest({ kind: "removeMessageFilter", id }).catch(() => false);
    }

    suspendUser(userId: string, reason: string): Promise<boolean> {
        return this.#sendRequest({ kind: "suspendUser", userId, reason })
            .then((resp) => {
                if (resp === "success") {
                    userStore.userSuspended(userId, true);
                }
                return resp === "success";
            })
            .catch(() => false);
    }

    unsuspendUser(userId: string): Promise<boolean> {
        return this.#sendRequest({ kind: "unsuspendUser", userId })
            .then((resp) => {
                if (resp === "success") {
                    userStore.userSuspended(userId, false);
                }
                return resp === "success";
            })
            .catch(() => false);
    }

    setCommunityModerationFlags(communityId: string, flags: number): Promise<boolean> {
        return this.#sendRequest({ kind: "setCommunityModerationFlags", communityId, flags })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setGroupUpgradeConcurrency(value: number): Promise<boolean> {
        return this.#sendRequest({ kind: "setGroupUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setCommunityUpgradeConcurrency(value: number): Promise<boolean> {
        return this.#sendRequest({ kind: "setCommunityUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setUserUpgradeConcurrency(value: number): Promise<boolean> {
        return this.#sendRequest({ kind: "setUserUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<boolean> {
        return this.#sendRequest({ kind: "markLocalGroupIndexFull", canisterId, full }).catch(
            () => false,
        );
    }

    setDiamondMembershipFees(fees: DiamondMembershipFees[]): Promise<boolean> {
        return this.#sendRequest({ kind: "setDiamondMembershipFees", fees }).catch(() => false);
    }

    setAirdropConfig(
        channelId: number,
        channelName: string,
        communityId?: string,
        communityName?: string,
    ): Promise<boolean> {
        return this.#sendRequest({
            kind: "setAirdropConfig",
            channelId,
            channelName,
            communityId,
            communityName,
        });
    }

    setTokenEnabled(ledger: string, enabled: boolean): Promise<boolean> {
        return this.#sendRequest({ kind: "setTokenEnabled", ledger, enabled });
    }

    stakeNeuronForSubmittingProposals(
        governanceCanisterId: string,
        stake: bigint,
    ): Promise<boolean> {
        return this.#sendRequest({
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
        return this.#sendRequest({
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
            this.#addServerEventsToStores(chatId, [event], undefined, []);
        }
    }

    #userIdsFromChatSummaries(chats: ChatSummary[]): PartitionedUserIds {
        const userIds = new Set<string>();
        const webhooks = new Set<string>();
        chats.forEach((chat) => {
            if (chat.kind === "direct_chat") {
                userIds.add(chat.them.userId);
            } else if (chat.latestMessage !== undefined) {
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

            // Update all users we have direct chats with
            for (const chat of chatSummariesStore.value.values()) {
                if (chat.kind == "direct_chat") {
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
        if (chatsResponse.referrals !== undefined) {
            for (const userId of chatsResponse.referrals.map((r) => r.userId)) {
                userIds.add(userId);
            }
        }
        if (!anonUserStore.value) {
            userIds.add(currentUserIdStore.value);
        }

        await this.getMissingUsers(userIds);

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
                        blobUrl: undefined,
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
                chatsResponse.pinnedDirectChats,
                chatsResponse.pinnedGroupChats,
                chatsResponse.pinnedChannels,
                chatsResponse.pinnedFavouriteChats,
                chatsResponse.achievements,
                chatsResponse.chitState,
                chatsResponse.referrals,
                chatsResponse.walletConfig,
                chatsResponse.messageActivitySummary,
                chatsResponse.installedBots,
                chatsResponse.streakInsurance,
            );
        });

        if (selectedChatIdStore.value !== undefined) {
            if (chatSummariesStore.value.get(selectedChatIdStore.value) === undefined) {
                publish("selectedChatInvalid");
            } else {
                const updatedEvents = ChatMap.fromMap(chatsResponse.updatedEvents);
                this.#chatUpdated(
                    selectedChatIdStore.value,
                    updatedEvents.get(selectedChatIdStore.value) ?? [],
                );
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

        // horribly enough - we need to slightly defer this so that all the cascade of derived stuff is complete
        // I am hopeful that we can remove this when we aren't manually synchronising runes & stores
        tick().then(() => {
            chatsInitialisedStore.set(true);
        });

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
                window.setTimeout(() => this.#refreshBalancesInSeries(), 1000);
            }
        }

        if (chatsResponse.bitcoinAddress !== undefined) {
            bitcoinAddress.set(chatsResponse.bitcoinAddress);
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
        pinnedDirectChats: DirectChatIdentifier[] | undefined,
        pinnedGroupChats: GroupChatIdentifier[] | undefined,
        pinnedChannels: ChannelIdentifier[] | undefined,
        pinnedFavourites: ChatIdentifier[] | undefined,
        achievements: Set<string> | undefined,
        chitState: ChitState | undefined,
        referrals: Referral[] | undefined,
        walletConfig: WalletConfig | undefined,
        messageActivitySummary: MessageActivitySummary | undefined,
        installedBots: Map<string, GrantedBotPermissions> | undefined,
        streakInsurance: OptionUpdate<StreakInsurance>,
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
        if (pinnedDirectChats !== undefined) {
            serverPinnedChatsStore.update((map) => map.set("direct_chat", pinnedDirectChats));
        }
        if (pinnedGroupChats !== undefined) {
            serverPinnedChatsStore.update((map) => map.set("group_chat", pinnedGroupChats));
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
        if (chitState !== undefined) {
            chitStateStore.update((curr) => {
                // Skip the new update if it is behind what we already have locally
                const skipUpdate = chitState.streakEnds < curr.streakEnds;
                return skipUpdate ? curr : chitState;
            });
        }
    }

    #botsLoaded = false;

    async #loadBots() {
        return new Promise<void>((resolve) => {
            this.#sendStreamRequest({
                kind: "getBots",
                initialLoad: !this.#botsLoaded,
            }).subscribe({
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
    async #loadChats() {
        const initialLoad = !chatsInitialisedStore.value;

        const updateRegistryTask = initialLoad ? this.#updateRegistry() : undefined;

        return new Promise<void>((resolve) => {
            this.#sendStreamRequest({
                kind: "getUpdates",
                initialLoad,
            }).subscribe({
                onResult: async (resp) => {
                    if (resp !== undefined) {
                        await this.#handleChatsResponse(
                            updateRegistryTask,
                            !chatsInitialisedStore.value,
                            resp as UpdatesResult,
                        );
                    }
                    latestSuccessfulUpdatesLoop.set(Date.now());
                },
                onError: (err) => {
                    console.warn("getUpdates threw an error: ", err);
                    resolve();
                },
                onEnd: () => {
                    resolve();
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
            const response = await this.#sendRequest({ kind: "lastOnline", userIds });
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
                        chat.membership.readByMeUpTo,
                        [],
                        undefined,
                    );
                }

                // If the latest message in a chat is sent by the current user, then we know they must have read up to
                // that message, so we mark the chat as read up to that message if it isn't already. This happens when a
                // user sends a message on one device then looks at OpenChat on another.
                const latestMessage = chat.latestMessage?.event;
                if (
                    latestMessage !== undefined &&
                    latestMessage.sender === currentUserIdStore.value &&
                    (chat.membership?.readByMeUpTo ?? -1) < latestMessage.messageIndex &&
                    !localUpdates.isUnconfirmed({ chatId: chat.id }, latestMessage.messageId)
                ) {
                    messagesRead.markReadUpTo({ chatId: chat.id }, latestMessage.messageIndex);
                }
            }
        });
    }

    #validMouseEvent(e: MouseEvent) {
        return e instanceof MouseEvent && e.isTrusted && e.type === "click";
    }

    claimPrize(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        e: MouseEvent,
    ): Promise<boolean> {
        if (!this.#validMouseEvent(e)) {
            return Promise.resolve(false);
        }

        return this.#sendRequest({ kind: "claimPrize", chatId, messageId })
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

    async acceptP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
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

        return this.#sendRequest({
            kind: "acceptP2PSwap",
            chatId,
            threadRootMessageIndex,
            messageId,
            pin,
            newAchievement,
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
        return this.#sendRequest({
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

    joinVideoCall(chatId: ChatIdentifier, messageId: bigint): Promise<JoinVideoCallResponse> {
        const newAchievement = !achievementsStore.value.has("joined_call");

        return this.#sendRequest({
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

        return this.#sendRequest({
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
        return this.#sendRequest({
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

    #overwriteUserInStore(
        userId: string,
        updater: (user: UserSummary) => UserSummary | undefined,
    ): void {
        const user = userStore.get(userId);
        if (user !== undefined) {
            const updated = updater(user);
            if (updated !== undefined) {
                userStore.addUser(updated);
            }
        }
    }

    #updateDiamondStatusInUserStore(status: DiamondMembershipStatus): void {
        this.#overwriteUserInStore(currentUserIdStore.value, (user) => {
            const changed = status.kind !== user.diamondStatus;
            return changed ? { ...user, diamondStatus: status.kind } : undefined;
        });
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
                                currentUserStore.set(user);
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
        return this.#sendRequest({
            kind: "diamondMembershipFees",
        }).catch(() => []);
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this.#sendRequest({
            kind: "reportedMessages",
            userId,
        });
    }

    payForDiamondMembership(
        ledger: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
    ): Promise<PayForDiamondMembershipResponse> {
        return this.#sendRequest({
            kind: "payForDiamondMembership",
            userId: currentUserIdStore.value,
            ledger,
            duration,
            recurring,
            expectedPriceE8s,
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    currentUserStore.set({
                        ...currentUserStore.value,
                        diamondStatus: resp.status,
                    });
                    this.#setDiamondStatus(resp.status);
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
        return this.#sendRequest({
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
        return this.#sendRequest({
            kind: "cancelMessageReminder",
            reminderId: content.reminderId,
        }).catch(() => {
            undo();
            return false;
        });
    }

    reportMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.#sendRequest({
            kind: "reportMessage",
            chatId,
            threadRootMessageIndex,
            messageId,
            deleteMessage,
        }).catch(() => false);
    }

    declineInvitation(chatId: MultiUserChatIdentifier): Promise<boolean> {
        return this.#sendRequest({ kind: "declineInvitation", chatId })
            .then((res) => {
                return res.kind === "success";
            })
            .catch(() => false);
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs,
    ): Promise<UpdateMarketMakerConfigResponse> {
        return this.#sendRequest({ kind: "updateMarketMakerConfig", ...config });
    }

    displayName(user?: UserSummary): string {
        return user !== undefined
            ? `${user?.displayName ?? user?.username}`
            : this.config.i18nFormatter("unknownUser");
    }

    hasModerationFlag(flags: number, flag: ModerationFlag): boolean {
        return hasFlag(flags, flag);
    }

    setModerationFlags(flags: number): Promise<number> {
        const previousValue = moderationFlagsEnabledStore.value;
        currentUserStore.set({
            ...currentUserStore.value,
            moderationFlagsEnabled: flags,
        });

        return this.#sendRequest({
            kind: "setModerationFlags",
            flags,
        })
            .then((resp) => (resp === "success" ? flags : previousValue))
            .catch(() => {
                currentUserStore.set({
                    ...currentUserStore.value,
                    moderationFlagsEnabled: previousValue,
                });
                return previousValue;
            });
    }

    async tipMessage(
        messageContext: MessageContext,
        messageId: bigint,
        transfer: PendingCryptocurrencyTransfer,
        currentTip: bigint,
    ): Promise<TipMessageResponse> {
        const chat = chatSummariesStore.value.get(messageContext.chatId);
        if (chat === undefined) {
            return Promise.resolve({ kind: "failure" });
        }

        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const userId = currentUserIdStore.value;
        const totalTip = transfer.amountE8s + currentTip;
        const decimals = cryptoLookup.value.get(transfer.ledger)?.decimals ?? 0;
        const undo = localUpdates.markTip(messageId, transfer.ledger, userId, totalTip);

        return this.#sendRequest({
            kind: "tipMessage",
            messageContext,
            messageId,
            transfer,
            decimals,
            pin,
        })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undo();

                    if (resp.kind === "error") {
                        const pinNumberFailure = pinNumberFailureFromError(resp);
                        if (pinNumberFailure !== undefined) {
                            pinNumberFailureStore.set(pinNumberFailure);
                        }
                    }
                }

                return resp;
            })
            .catch((_) => {
                undo();
                return { kind: "failure" };
            });
    }

    loadSavedCryptoAccounts(): Promise<NamedAccount[]> {
        return this.#sendRequest({
            kind: "loadSavedCryptoAccounts",
        }).catch(() => []);
    }

    saveCryptoAccount(namedAccount: NamedAccount): Promise<SaveCryptoAccountResponse> {
        return this.#sendRequest({
            kind: "saveCryptoAccount",
            namedAccount,
        }).catch(() => ({ kind: "failure" }));
    }

    async #updateRegistry(): Promise<void> {
        let resolved = false;
        return new Promise((resolve) => {
            this.#sendStreamRequest({
                kind: "updateRegistry",
            }).subscribe({
                onResult: ([registry, updated]) => {
                    if (updated || [...cryptoLookup.value.keys()].length === 0) {
                        this.currentAirdropChannel = registry.currentAirdropChannel;
                        const cryptoMap = new Map(registry.tokenDetails.map((t) => [t.ledger, t]));
                        const nsMap = new Map(
                            registry.nervousSystemSummary.map((ns) => [
                                ns.governanceCanisterId,
                                {
                                    ...ns,
                                    token: cryptoMap.get(ns.ledgerCanisterId)!,
                                },
                            ]),
                        );

                        nervousSystemLookup.set(nsMap);
                        cryptoLookup.set(cryptoMap);

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
        return this.#sendRequest({ kind: "exchangeRates" })
            .then((exchangeRates) =>
                exchangeRatesLookupStore.set(new Map(Object.entries(exchangeRates))),
            )
            .catch(() => undefined);
    }

    async #refreshBalancesInSeries() {
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
        if (this.#userLookupForMentions === undefined) {
            const lookup = {} as Record<string, UserOrUserGroup>;
            for (const [userId] of selectedChatMembersStore.value) {
                let user = userStore.get(userId);
                if (user !== undefined && selectedChatSummaryStore.value?.kind === "channel") {
                    user = {
                        ...user,
                        displayName: this.getDisplayName(user, selectedCommunityMembersStore.value),
                    };
                }
                if (user?.username !== undefined) {
                    lookup[user.username.toLowerCase()] = user as UserSummary;
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
            this.#userLookupForMentions = lookup;
        }
        return this.#userLookupForMentions;
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

    submitProposal(governanceCanisterId: string, proposal: CandidateProposal): Promise<boolean> {
        const nervousSystem = this.tryGetNervousSystem(governanceCanisterId);
        if (nervousSystem === undefined) {
            this.#logger.error(
                "Cannot find NervousSystemDetails for governanceCanisterId",
                governanceCanisterId,
            );
            return Promise.resolve(false);
        }

        return this.#sendRequest(
            {
                kind: "submitProposal",
                currentUserId: currentUserIdStore.value,
                governanceCanisterId,
                proposal,
                ledger: nervousSystem.token.ledger,
                token: nervousSystem.token.symbol,
                proposalRejectionFee: nervousSystem.proposalRejectionFee,
                transactionFee: nervousSystem.token.transferFee,
            },
            false,
            2 * DEFAULT_WORKER_TIMEOUT,
        )
            .then((resp) => {
                if (resp.kind === "success" || resp.kind === "retrying") {
                    return true;
                }

                this.#logger.error("Failed to submit proposal", resp);
                return false;
            })
            .catch(() => false);
    }

    refreshSwappableTokens(): Promise<Set<string>> {
        return this.#sendRequest({
            kind: "canSwap",
            tokenLedgers: new Set([...cryptoLookup.value.keys()]),
        }).then((tokens) => {
            swappableTokensStore.set(tokens);
            return tokens;
        });
    }

    getTokenSwaps(inputTokenLedger: string): Promise<Record<string, DexId[]>> {
        const outputTokenLedgers = [...cryptoLookup.value.keys()].filter(
            (t) => t !== inputTokenLedger,
        );

        return this.#sendRequest({
            kind: "getTokenSwaps",
            inputTokenLedger,
            outputTokenLedgers,
        });
    }

    getTokenSwapQuotes(
        inputTokenLedger: string,
        outputTokenLedger: string,
        amountIn: bigint,
    ): Promise<[DexId, bigint][]> {
        return this.#sendRequest({
            kind: "getTokenSwapQuotes",
            inputTokenLedger,
            outputTokenLedger,
            amountIn,
        });
    }

    async swapTokens(
        swapId: bigint,
        inputTokenLedger: string,
        outputTokenLedger: string,
        amountIn: bigint,
        minAmountOut: bigint,
        dex: DexId,
    ): Promise<SwapTokensResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const lookup = cryptoLookup.value;

        return this.#sendRequest(
            {
                kind: "swapTokens",
                swapId,
                inputTokenDetails: lookup.get(inputTokenLedger)!,
                outputTokenDetails: lookup.get(outputTokenLedger)!,
                amountIn,
                minAmountOut,
                dex,
                pin,
            },
            false,
            1000 * 60 * 3,
        ).then((resp) => {
            if (resp.kind === "error") {
                const pinNumberFailure = pinNumberFailureFromError(resp);
                if (pinNumberFailure !== undefined) {
                    pinNumberFailureStore.set(pinNumberFailure);
                }
            }

            return resp;
        });
    }

    tokenSwapStatus(swapId: bigint): Promise<TokenSwapStatusResponse> {
        return this.#sendRequest({
            kind: "tokenSwapStatus",
            swapId,
        });
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
        locale: string,
        key: string,
        value: string,
    ): Promise<ProposeResponse> {
        return this.#sendRequest({
            kind: "proposeTranslation",
            locale,
            key,
            value,
        })
            .then((res) => {
                if (res === "success") {
                    applyTranslationCorrection(locale, key, value);
                }
                return res;
            })
            .catch(() => "failure");
    }

    getProposedTranslationCorrections(): Promise<CandidateTranslations[]> {
        return this.#sendRequest({
            kind: "getProposedTranslations",
        })
            .then((res) => (res.kind === "success" ? res.proposed : []))
            .catch(() => []);
    }

    rejectTranslationCorrection(id: bigint, reason: RejectReason): Promise<boolean> {
        return this.#sendRequest({
            kind: "rejectTranslation",
            id,
            reason,
        })
            .then((res) => res === "success")
            .catch(() => false);
    }

    approveTranslationCorrection(id: bigint): Promise<boolean> {
        return this.#sendRequest({
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
            } else if (this.isChatPrivate(chat) && chatIdentifiersEqual(selectedChatIdStore.value, chatId)) {
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

    async ringOtherUsers(chatId: ChatIdentifier, messageId: bigint, callType: VideoCallType) {
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
            currentUserStore.value,
            selectedCommunityMembersStore.value,
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
                return this.#sendRequest({
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
            return this.#sendRequest({
                kind: "getAccessToken",
                accessTokenType: { kind: "join_video_call", chatId }, // TODO - this should have it's own token type really
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

    getVideoChatAccessToken(
        chatId: ChatIdentifier,
        accessTokenType: AccessTokenType,
    ): Promise<{ token: string; roomName: string; messageId: bigint; joining: boolean }> {
        const chat = allChatsStore.value.get(chatId);
        if (chat === undefined) {
            throw new Error(`Unknown chat: ${chatId}`);
        }

        return this.#getLocalUserIndex(chat).then((localUserIndex) => {
            return this.#sendRequest({
                kind: "getAccessToken",
                chatId,
                accessTokenType,
                localUserIndex,
            })
                .then((token) => {
                    if (token === undefined) {
                        throw new Error("Didn't get an access token");
                    }
                    console.log("TOKEN: ", token);
                    return token;
                })
                .then((token) => this.#getRoomAccessToken(token));
        });
    }

    #startBtcBalanceUpdateJob() {
        bitcoinAddress.subscribe((addr) => {
            if (addr !== undefined) {
                const poller = new Poller(
                    () => this.#updateBtcBalance(addr),
                    ONE_MINUTE_MILLIS,
                    5 * ONE_MINUTE_MILLIS,
                    true,
                );
                return () => poller.stop();
            }
        });
    }

    async getBtcAddress(): Promise<string> {
        const storeValue = get(bitcoinAddress);
        if (storeValue !== undefined) {
            return Promise.resolve(storeValue);
        }
        const address = await this.#sendRequest({
            kind: "generateBtcAddress",
        });
        bitcoinAddress.set(address);
        return address;
    }

    async withdrawBtc(address: string, amount: bigint): Promise<WithdrawBtcResponse> {
        let pin: string | undefined = undefined;

        if (pinNumberRequiredStore.value) {
            pin = await this.#promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const response = await this.#sendRequest({
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

    async #updateBtcBalance(address: string): Promise<void> {
        await this.#sendRequest({
            kind: "updateBtcBalance",
            userId: currentUserIdStore.value,
            bitcoinAddress: address,
        });
    }

    getCkbtcMinterDepositInfo(): Promise<CkbtcMinterDepositInfo> {
        return this.#sendRequest({
            kind: "ckbtcMinterDepositInfo",
        });
    }

    getCkbtcMinterWithdrawalInfo(amount: bigint): Promise<CkbtcMinterWithdrawalInfo> {
        return this.#sendRequest({
            kind: "ckbtcMinterWithdrawalInfo",
            amount,
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
            (await this.#sendRequest({
                kind: "currentUserWebAuthnKey",
            }));
        if (webAuthnKey === undefined) throw new Error("WebAuthnKey not set");

        const cose = unwrapDER(webAuthnKey.publicKey, DER_COSE_OID);
        const webAuthnIdentity = new WebAuthnIdentity(webAuthnKey.credentialId, cose, undefined);

        return await this.#finaliseWebAuthnSignin(webAuthnIdentity, () => webAuthnIdentity, false);
    }

    async #finaliseWebAuthnSignin(
        initialKey: SignIdentity,
        webAuthnIdentityFn: () => WebAuthnIdentity,
        assumeIdentity: boolean,
        registering: boolean = false,
    ): Promise<[ECDSAKeyIdentity, DelegationChain, WebAuthnKey]> {
        const sessionKey = await ECDSAKeyIdentity.generate();
        const delegationChain = await DelegationChain.create(
            initialKey,
            sessionKey.getPublicKey(),
            new Date(Date.now() + 30 * ONE_DAY),
        );
        const identity = DelegationIdentity.fromDelegation(sessionKey, delegationChain);
        // In the sign in case, we must defer getting the webAuthnIdentity until after it has been used to sign the
        // delegation, before that point we don't know which identity the user will choose.
        const webAuthnIdentity = webAuthnIdentityFn();
        const webAuthnKey = {
            publicKey: new Uint8Array(webAuthnIdentity.getPublicKey().toDer()),
            credentialId: new Uint8Array(webAuthnIdentity.rawId),
        };
        if (assumeIdentity) {
            this.#webAuthnKey = webAuthnKey;
            this.#authIdentityStorage.set(sessionKey, delegationChain);
            await this.#loadedAuthenticationIdentity(identity, AuthProvider.PASSKEY, registering);
        }
        return [sessionKey, delegationChain, webAuthnKey];
    }

    async lookupWebAuthnPubKey(credentialId: Uint8Array): Promise<Uint8Array> {
        const pubKey = await this.#sendRequest({
            kind: "lookupWebAuthnPubKey",
            credentialId,
        });

        if (pubKey === undefined) {
            throw new Error("Failed to lookup WebAuthn PubKey");
        }
        return pubKey;
    }

    #storeWebAuthnKeyInCache(key: WebAuthnKeyFull): Promise<void> {
        return this.#sendRequest({
            kind: "setCachedWebAuthnKey",
            key,
        });
    }

    async generateMagicLink(
        email: string,
        sessionKey: ECDSAKeyIdentity,
    ): Promise<GenerateMagicLinkResponse> {
        const sessionKeyDer = toDer(sessionKey);

        const resp = await this.#sendRequest({
            kind: "generateMagicLink",
            email,
            sessionKey: sessionKeyDer,
        }).catch(
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
        return this.#sendRequest({ kind: "getExternalAchievements" }).catch((err) => {
            console.error("getExternalAchievements error", err);
            return [];
        });
    }

    markAchievementsSeen() {
        this.#sendRequest({ kind: "markAchievementsSeen" }).catch((err) => {
            console.error("markAchievementsSeen", err);
        });
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
        const getDelegationResponse = await this.#sendRequest({
            kind: "getSignInWithEmailDelegation",
            email,
            sessionKey: sessionKeyDer,
            expiration,
        });
        if (getDelegationResponse.kind === "success") {
            const identity = buildDelegationIdentity(
                userKey,
                sessionKey,
                getDelegationResponse.delegation,
                getDelegationResponse.signature,
            );
            const delegation = identity.getDelegation();
            if (assumeIdentity) {
                this.#authIdentityStorage.set(sessionKey, delegation);
                this.#loadedAuthenticationIdentity(identity, AuthProvider.EMAIL);
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
        return this.#sendRequest({
            kind: "siwePrepareLogin",
            address,
        });
    }

    siwsPrepareLogin(address: string): Promise<SiwsPrepareLoginResponse> {
        return this.#sendRequest({
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
        const loginResponse = await this.#sendRequest({
            kind: "loginWithWallet",
            token,
            address,
            signature,
            sessionKey: sessionKeyDer,
        });

        if (loginResponse.kind === "success") {
            const getDelegationResponse = await this.#sendRequest({
                kind: "getDelegationWithWallet",
                token,
                address,
                sessionKey: sessionKeyDer,
                expiration: loginResponse.expiration,
            });
            if (getDelegationResponse.kind === "success") {
                const identity = buildDelegationIdentity(
                    loginResponse.userKey,
                    sessionKey,
                    getDelegationResponse.delegation,
                    getDelegationResponse.signature,
                );
                const delegation = identity.getDelegation();
                if (assumeIdentity) {
                    await this.#authIdentityStorage.set(sessionKey, delegation);
                    this.#loadedAuthenticationIdentity(
                        identity,
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
            this.#sendRequest({ kind: "setCommunityIndexes", indexes: updates }).catch(() => false);
        }
    }

    async setSelectedCommunity(id: CommunityIdentifier): Promise<boolean> {
        let community = communitiesStore.value.get(id);
        let preview = false;
        if (community === undefined) {
            // if we don't have the community it means we're not a member and we need to look it up
            if (querystringCodeStore.value) {
                await this.setCommunityInvite({ id, code: querystringCodeStore.value });
            }

            const referredBy = this.#extractReferralCodeFromPath() ?? this.#referralCode;
            if (referredBy) {
                await this.setCommunityReferral(id, referredBy);
            }

            const resp = await this.#sendRequest({
                kind: "getCommunitySummary",
                communityId: id.communityId,
            });
            if ("id" in resp) {
                // Make the community appear at the top of the list
                resp.membership.index = nextCommunityIndexStore.value;
                community = resp;
                localUpdates.addCommunityPreview(community);
                preview = true;
            } else {
                // if we get here it means we're not a member of the community and we can't look it up
                // it may be private and we may not be invited.
                publish("noAccess");
                return false;
            }
        }

        if (community !== undefined) {
            this.#loadCommunityDetails(community);
        }

        return preview;
    }

    selectFirstChat(): boolean {
        if (!get(mobileWidth)) {
            const first = [...chatSummariesListStore.value.values()].find(
                (c) => !c.membership.archived,
            );
            if (first !== undefined) {
                pageRedirect(routeForChatIdentifier(chatListScopeStore.value.kind, first.id));
                return true;
            }
        }
        return false;
    }

    importToCommunity(
        groupId: GroupChatIdentifier,
        communityId: CommunityIdentifier,
    ): Promise<ChannelIdentifier | undefined> {
        const group = chatSummariesStore.value.get(groupId);
        return this.#sendRequest({
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
                        } as ChannelSummary);
                    }
                    return resp.channelId;
                }
                return undefined;
            })
            .catch(() => undefined);
    }

    submitProofOfUniquePersonhood(
        credential: string,
        iiPrincipal: string,
    ): Promise<SubmitProofOfUniquePersonhoodResponse> {
        return this.#sendRequest({
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
                    this.#overwriteUserInStore(currentUserIdStore.value, (u) => ({
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

    async joinCommunity(
        community: CommunitySummary,
        credentials: string[],
        paymentApprovals: PaymentGateApprovals,
    ): Promise<ClientJoinCommunityResponse> {
        const approveResponse = await this.approveAccessGatePayments(community, paymentApprovals);
        if (approveResponse.kind !== "success") {
            return approveResponse;
        }

        return this.#sendRequest({
            kind: "joinCommunity",
            id: community.id,
            credentialArgs: this.#buildVerifiedCredentialArgs(credentials),
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    // Make the community appear at the top of the list
                    resp.community.membership.index = nextCommunityIndexStore.value;
                    localUpdates.addCommunity(resp.community);
                    this.#loadCommunityDetails(resp.community);
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

        return this.#sendRequest({ kind: "deleteCommunity", id })
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

        return this.#sendRequest({ kind: "leaveCommunity", id })
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

    createCommunity(
        candidate: CommunitySummary,
        rules: Rules,
        defaultChannels: string[],
    ): Promise<CreateCommunityResponse> {
        return this.#sendRequest({
            kind: "createCommunity",
            community: candidate,
            rules,
            defaultChannels,
            defaultChannelRules: defaultChatRules("channel"),
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.addCommunity({
                        ...candidate,
                        id: {
                            kind: "community",
                            communityId: resp.id,
                        },
                        channels: resp.channels.map(([id, name]) => newDefaultChannel(id, name)),
                    });
                }
                return resp;
            })
            .catch(() => ({
                kind: "failure",
            }));
    }

    addToFavourites(chatId: ChatIdentifier): Promise<boolean> {
        const undo = localUpdates.favourite(chatId);
        return this.#sendRequest({ kind: "addToFavourites", chatId })
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

        return this.#sendRequest({ kind: "removeFromFavourites", chatId })
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

    saveCommunity(
        community: CommunitySummary,
        name: string | undefined,
        description: string | undefined,
        rules: UpdatedRules | undefined,
        permissions: CommunityPermissions | undefined,
        avatar: Uint8Array | undefined,
        banner: Uint8Array | undefined,
        gateConfig: AccessGateConfig | undefined,
        isPublic: boolean | undefined,
        primaryLanguage: string | undefined,
    ): Promise<boolean> {
        return this.#sendRequest({
            kind: "updateCommunity",
            communityId: community.id.communityId,
            name,
            description,
            rules,
            permissions,
            avatar,
            banner,
            gateConfig,
            isPublic,
            primaryLanguage,
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    localUpdates.addCommunity(community);
                    if (rules !== undefined && resp.rulesVersion !== undefined) {
                        localUpdates.updateCommunityRules(community.id, {
                            text: rules.text,
                            enabled: rules.enabled,
                            version: resp.rulesVersion,
                        });
                    }
                    return true;
                }
                return false;
            })
            .catch(() => false);
    }

    convertGroupToCommunity(
        group: GroupChatSummary,
        rules: Rules,
    ): Promise<ChannelIdentifier | undefined> {
        return this.#sendRequest({
            kind: "convertGroupToCommunity",
            chatId: group.id,
            historyVisible: group.historyVisible,
            rules,
        })
            .then((resp) => (resp.kind === "success" ? resp.id : undefined))
            .catch(() => undefined);
    }

    deleteUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): Promise<boolean> {
        const undo = localUpdates.deleteUserGroup(id, userGroup.id);
        return this.#sendRequest({
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

    createUserGroup(
        id: CommunityIdentifier,
        userGroup: UserGroupDetails,
    ): Promise<CreateUserGroupResponse> {
        return this.#sendRequest({
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

    updateUserGroup(
        id: CommunityIdentifier,
        userGroup: UserGroupDetails,
        toAdd: Set<string>,
        toRemove: Set<string>,
    ): Promise<UpdateUserGroupResponse> {
        return this.#sendRequest({
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
            page(routeForScope(this.getDefaultScope()));
            return true;
        }
        return false;
    }

    getDefaultScope(): ChatListScope {
        if (anonUserStore.value) return { kind: "group_chat" };

        // sometimes we have to re-direct the user to home route "/"
        // However, with communities enabled it is not clear what this means
        // we actually need to direct the user to one of the global scopes "direct", "group" or "favourites"
        // which one we choose is kind of unclear and probably depends on the state

        const favourites = favouritesStore.value;
        if (favourites.size > 0) return { kind: "favourite" };
        if (serverGroupChatsStore.value.size > 0) return { kind: "group_chat" };
        return { kind: "direct_chat" };
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

        return this.#sendRequest({ kind: "setPinNumber", verification, newPin }).then((resp) => {
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
        return userId ? userStore.get(userId)?.streak ?? 0 : 0;
    }

    getBotDefinition(endpoint: string): Promise<BotDefinitionResponse> {
        return this.#sendRequest({
            kind: "getBotDefinition",
            endpoint,
        }).catch((err) => {
            this.#logger.error("Failed to get the bot definition", endpoint, err);
            return {
                kind: "bot_definition_failure",
                error: err,
            };
        });
    }

    #callBotCommandEndpoint(endpoint: string, token: string): Promise<BotCommandResponse> {
        return this.#sendRequest({
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
        return this.#sendRequest({
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

        return this.#sendRequest({
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

    regenerateWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<string | undefined> {
        return this.#sendRequest({
            kind: "regenerateWebhook",
            chatId,
            id,
        }).catch((err) => {
            this.#logger.error("Failed to regenerate webhook", err);
            return undefined;
        });
    }

    deleteWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<boolean> {
        const undo = localUpdates.removeWebhookFromChat(chatId, id);

        return this.#sendRequest({
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
        return this.#sendRequest({
            kind: "getWebhook",
            chatId,
            id,
        }).catch((err) => {
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
            publish("registerWebhook");
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
                const tokenDetails = [...cryptoLookup.value.values()].find(
                    (t) => t.symbol.toLowerCase() === token.value?.toLocaleLowerCase(),
                );
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
            return this.#sendRequest({
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
            }).then((token) => {
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
        return this.#sendRequest({
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
        return this.#sendRequest({
            kind: "updateInstalledBot",
            id,
            botId,
            grantedPermissions,
        }).catch((err) => {
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
        return this.#sendRequest({
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

    contentTypeSupportsEdit(contentType: MessageContent["kind"]): boolean {
        return isEditableContent(contentType);
    }

    claimDailyChit(): Promise<ClaimDailyChitResponse> {
        const userId = currentUserIdStore.value;
        const utcOffsetMins = -new Date().getTimezoneOffset();

        return this.#sendRequest({ kind: "claimDailyChit", utcOffsetMins }).then((resp) => {
            if (resp.kind === "success") {
                if (resp.nextDailyChitClaim > chitStateStore.value.nextDailyChitClaim) {
                    chitStateStore.update((state) => ({
                        chitBalance: resp.chitBalance,
                        streakEnds: resp.nextDailyChitClaim + BigInt(1000 * 60 * 60 * 24),
                        streak: resp.streak,
                        maxStreak: resp.maxStreak,
                        nextDailyChitClaim: resp.nextDailyChitClaim,
                        totalChitEarned: state.totalChitEarned + resp.chitEarned,
                    }));
                }
                this.#overwriteUserInStore(userId, (user) => ({
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
        return this.#sendRequest({ kind: "chitLeaderboard" });
    }

    chitEvents(req: ChitEventsRequest): Promise<ChitEventsResponse> {
        return this.#sendRequest(req).catch((err) => {
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

    getAuthenticationPrincipals(): Promise<
        (AuthenticationPrincipal & { provider: AuthProvider })[]
    > {
        return this.#sendRequest({
            kind: "getAuthenticationPrincipals",
        }).then((principals) => {
            return principals.map((p) => {
                return {
                    ...p,
                    provider: this.#authProviderFromAuthPrincipal(p),
                };
            });
        });
    }

    getLinkedIIPrincipal(): Promise<string | undefined> {
        return this.#sendRequest({
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
        return this.#sendRequest({
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
        return this.#sendRequest({
            kind: "removeIdentityLink",
            linked_principal,
        });
    }

    removeTokenFromWallet(ledger: string) {
        const config = { ...walletConfigStore.value };
        if (config.kind === "manual_wallet") {
            if (config.tokens.delete(ledger)) {
                return this.setWalletConfig(config);
            }
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
        return this.#sendRequest({
            kind: "configureWallet",
            config,
        })
            .then(() => true)
            .catch(() => {
                undo();
                return false;
            });
    }

    withdrawFromIcpSwap(
        userId: string,
        swapId: bigint,
        inputToken: boolean,
        amount: bigint | undefined,
        fee: bigint | undefined,
    ): Promise<boolean> {
        return this.#sendRequest({
            kind: "withdrawFromIcpSwap",
            userId,
            swapId,
            inputToken,
            amount,
            fee,
        });
    }

    isEventKindHidden = isEventKindHidden;
    mergeCombinedUnreadCounts = mergeCombinedUnreadCounts;

    // This is stuff that used to be in agentWorker

    #connectToWorker(
        authPrincipal: string,
        authProvider: AuthProvider | undefined,
    ): Promise<ConnectToWorkerResponse> {
        console.debug("WORKER_CLIENT: loading worker with version: ", this.config.websiteVersion);
        const workerUrl = `/worker.js?v=${this.config.websiteVersion}`;
        this.#worker = new Worker(new URL(workerUrl, import.meta.url), {
            type: "module",
        });
        const initResponse = new Promise<ConnectToWorkerResponse>((resolve) => {
            this.#sendRequest(
                {
                    kind: "init",
                    authPrincipal,
                    authProvider,
                    icUrl: this.config.icUrl ?? window.location.origin,
                    iiDerivationOrigin: this.config.iiDerivationOrigin,
                    openStorageIndexCanister: this.config.openStorageIndexCanister,
                    groupIndexCanister: this.config.groupIndexCanister,
                    notificationsCanister: this.config.notificationsCanister,
                    identityCanister: this.config.identityCanister,
                    onlineCanister: this.config.onlineCanister,
                    userIndexCanister: this.config.userIndexCanister,
                    translationsCanister: this.config.translationsCanister,
                    registryCanister: this.config.registryCanister,
                    internetIdentityUrl: this.config.internetIdentityUrl,
                    nfidUrl: this.config.nfidUrl,
                    userGeekApiKey: this.config.userGeekApiKey,
                    enableMultiCrypto: this.config.enableMultiCrypto,
                    blobUrlPattern: this.config.blobUrlPattern,
                    canisterUrlPath: this.config.canisterUrlPath,
                    proposalBotCanister: this.config.proposalBotCanister,
                    marketMakerCanister: this.config.marketMakerCanister,
                    signInWithEmailCanister: this.config.signInWithEmailCanister,
                    signInWithEthereumCanister: this.config.signInWithEthereumCanister,
                    signInWithSolanaCanister: this.config.signInWithSolanaCanister,
                    websiteVersion: this.config.websiteVersion,
                    rollbarApiKey: this.config.rollbarApiKey,
                    env: this.config.env,
                    bitcoinMainnetEnabled: this.config.bitcoinMainnetEnabled,
                    groupInvite: this.config.groupInvite,
                    communityInvite: this.config.communityInvite,
                },
                true,
            ).then((resp) => {
                resolve(resp);
                this.#connectedToWorker = true;
                this.#setMinLogLevel(
                    (localStorage.getItem(configKeys.minLogLevel) ?? "warn") as
                        | "debug"
                        | "log"
                        | "warn"
                        | "error",
                );
            });
        });

        this.#worker.onmessage = (ev: MessageEvent<FromWorker>) => {
            if (!ev.data) {
                console.debug("WORKER_CLIENT: event message with no data received");
                return;
            }

            const data = ev.data;

            if (data.kind === "worker_event") {
                if (data.event.subkind === "messages_read_from_server") {
                    const { chatId, readByMeUpTo, threadsRead, dateReadPinned } = data.event;
                    withPausedStores(() => {
                        messagesRead.syncWithServer(
                            chatId,
                            readByMeUpTo,
                            threadsRead,
                            dateReadPinned,
                        );
                    });
                }
                if (data.event.subkind === "storage_updated") {
                    storageStore.set(data.event.status);
                }
                if (data.event.subkind === "users_loaded") {
                    userStore.addMany(data.event.users);
                }
            } else if (data.kind === "worker_response") {
                console.debug("WORKER_CLIENT: response: ", ev);
                this.#resolveResponse(data);
            } else if (data.kind === "worker_error") {
                console.debug("WORKER_CLIENT: error: ", ev);
                this.#resolveError(data);
            } else {
                console.debug("WORKER_CLIENT: unknown message: ", ev);
            }
        };
        return initResponse;
    }

    #setMinLogLevel(minLogLevel: "debug" | "log" | "warn" | "error"): void {
        setMinLogLevel(minLogLevel);

        this.#sendRequest({
            kind: "setMinLogLevel",
            minLogLevel,
        });
    }

    #logUnexpected(correlationId: string): void {
        const unresolved = this.#unresolved.get(correlationId);
        const timedOut =
            unresolved === undefined
                ? ""
                : `Timed-out req of kind: ${unresolved.kind} received after ${
                      Date.now() - unresolved.sentAt
                  }ms`;
        console.error(
            `WORKER_CLIENT: unexpected correlationId received (${correlationId}). ${timedOut}`,
        );
    }

    #resolveResponse(data: WorkerResponse): void {
        const promise = this.#pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.resolve(data.response, data.final);
            if (data.final) {
                window.clearTimeout(promise.timeout);
                this.#pending.delete(data.correlationId);
            }
        } else {
            this.#logUnexpected(data.correlationId);
        }
        this.#unresolved.delete(data.correlationId);
    }

    #resolveError(data: WorkerError): void {
        const promise = this.#pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.reject(JSON.parse(data.error));
            window.clearTimeout(promise.timeout);
            this.#pending.delete(data.correlationId);
        } else {
            this.#logUnexpected(data.correlationId);
        }
        this.#unresolved.delete(data.correlationId);
    }

    responseHandler<Req extends WorkerRequest, T>(
        req: Req,
        correlationId: string,
        timeout: number,
    ): (resolve: (val: T, final: boolean) => void, reject: (reason?: unknown) => void) => void {
        return (resolve, reject) => {
            const sentAt = Date.now();
            this.#pending.set(correlationId, {
                resolve,
                reject,
                timeout: window.setTimeout(() => {
                    reject(
                        `WORKER_CLIENT: Request of kind ${req.kind} with correlationId ${correlationId} did not receive a response withing the ${DEFAULT_WORKER_TIMEOUT}ms timeout`,
                    );
                    this.#unresolved.set(correlationId, {
                        kind: req.kind,
                        sentAt,
                    });
                    this.#pending.delete(correlationId);
                }, timeout),
            });
        };
    }

    #sendStreamRequest<Req extends WorkerRequest>(
        req: Req,
        connecting = false,
        timeout: number = DEFAULT_WORKER_TIMEOUT,
    ): Stream<WorkerResult<Req>> {
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        return new Stream<WorkerResult<Req>>(this.#sendRequestInternal(req, connecting, timeout));
    }

    async #sendRequest<Req extends WorkerRequest>(
        req: Req,
        connecting = false,
        timeout: number = DEFAULT_WORKER_TIMEOUT,
    ): Promise<WorkerResult<Req>> {
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        return new Promise<WorkerResult<Req>>(this.#sendRequestInternal(req, connecting, timeout));
    }

    #sendRequestInternal<Req extends WorkerRequest, T>(
        req: Req,
        connecting: boolean,
        timeout: number,
    ): (resolve: (val: T, final: boolean) => void, reject: (reason?: unknown) => void) => void {
        if (!connecting && !this.#connectedToWorker) {
            throw new Error("WORKER_CLIENT: the client is not yet connected to the worker");
        }
        const correlationId = random128().toString();
        try {
            this.#worker.postMessage({
                ...snapshot(req),
                correlationId,
            });
        } catch (err) {
            console.error("Error sending postMessage to worker", err);
            throw err;
        }
        return this.responseHandler(req, correlationId, timeout);
    }

    getBotConfig(): Promise<BotClientConfigData> {
        const metricsUrl =
            import.meta.env.OC_NODE_ENV === "production"
                ? `https://${this.config.userIndexCanister}.raw.ic0.app/metrics`
                : `http://${this.config.userIndexCanister}.raw.localhost:8080/metrics`;
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

    streakInsurancePrice(daysInsured: number, additionalDays: number): bigint {
        let total = 0n;
        for (let i = 0; i < additionalDays; i++) {
            total += 2n ** BigInt(daysInsured + i) * 100_000_000n;
        }
        return total;
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

        return this.#sendRequest({
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
        return this.#sendRequest({
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

        const updatedMessages = await this.#sendRequest({
            kind: "updateProposalTallies",
            chatId,
        });

        if (chatIdentifiersEqual(chatId, selectedChatIdStore.value)) {
            this.#updateServerEventsStore(chatId, (events) =>
                updateExistingMessages(events, updatedMessages),
            );
        }
    }

    async initialiseNotifications(): Promise<boolean> {
        if (!notificationsSupported) {
            console.debug("PUSH: notifications not supported");
            return false;
        }

        if (import.meta.env.OC_BUILD_ENV !== "development") {
            // Register a service worker if it hasn't already been done
            const registration = await this.#registerServiceWorker();
            if (registration == null) {
                return false;
            }
            // Ensure the service worker is updated to the latest version
            registration.update();
        }

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
                page(event.data.path);
            }
        });

        notificationStatus.subscribe((status) => {
            switch (status) {
                case "granted":
                    this.#trySubscribe();
                    break;
                case "pending-init":
                    break;
                default:
                    this.#unsubscribeNotifications();
                    break;
            }
        });

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
            if (await this.#subscriptionExists(this.#extract_p256dh_key(pushSubscription))) {
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
            applicationServerKey: this.#toUint8Array(this.#vapidPublicKey),
        };

        try {
            const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
            return pushSubscription;
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    #toUint8Array(base64String: string): Uint8Array {
        return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
    }

    #extract_p256dh_key(subscription: PushSubscription): string {
        const json = subscription.toJSON();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const key = json.keys!["p256dh"];
        return key;
    }
    async #unsubscribeNotifications(): Promise<void> {
        console.debug("PUSH: unsubscribing from notifications");
        const registration = await this.#getRegistration();
        if (registration !== undefined) {
            const pushSubscription = await registration.pushManager.getSubscription();
            if (pushSubscription) {
                if (await this.#subscriptionExists(this.#extract_p256dh_key(pushSubscription))) {
                    console.debug("PUSH: removing push subscription");
                    await this.#removeSubscription(pushSubscription.toJSON());
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

    addUserGroupKey(key: string) {
        selectedChatUserGroupKeysStore.update((set) => set.add(key));
    }

    #modifyFilteredProposals(fn: (fp: FilteredProposals) => void) {
        filteredProposalsStore.update((fp) => {
            if (fp !== undefined) {
                fn(fp);
                return fp;
            }
        });
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
}

type UserIndexMetrics = {
    oc_public_key: string;
};
