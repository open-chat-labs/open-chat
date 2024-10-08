/* eslint-disable no-case-declarations */
import { gaTrack } from "./utils/ga";
import { type Identity } from "@dfinity/agent";
import {
    AuthClient,
    type AuthClientLoginOptions,
    type AuthClientStorage,
    IdbStorage,
} from "@dfinity/auth-client";
import { get, writable, type Readable } from "svelte/store";
import DRange from "drange";
import {
    canChangeRoles as canChangeCommunityRoles,
    canBlockUsers as canBlockCommunityUsers,
    canUnblockUsers as canUnblockCommunityUsers,
    canInviteUsers as canInviteCommunityUsers,
    canRemoveMembers as canRemoveCommunityMembers,
    canDeleteCommunity,
    canEditCommunity,
    canChangeCommunityPermissions,
    canCreatePublicChannel,
    canCreatePrivateChannel,
    canManageUserGroups,
} from "./utils/community";
import {
    buildUserAvatarUrl,
    canBlockUsers,
    canAddMembers,
    canChangePermissions,
    canChangeRoles,
    canDeleteGroup,
    canDeleteOtherUsersMessages,
    canEditGroupDetails,
    canForward,
    canInviteUsers,
    canLeaveGroup,
    canChangeVisibility,
    canPinMessages,
    canReactToMessages,
    canRemoveMembers,
    canMentionAllMembers,
    canUnblockUsers,
    containsReaction,
    createMessage,
    findMessageById,
    getMembersString,
    groupBySender,
    groupChatFromCandidate,
    groupEvents,
    groupMessagesByDate,
    makeRtcConnections,
    mergeServerEvents,
    messageIsReadByThem,
    metricsEqual,
    sameUser,
    isFrozen,
    isPreviewing,
    buildTransactionLink,
    buildTransactionUrlByIndex,
    buildCryptoTransferText,
    mergeSendMessageResponse,
    serialiseMessageForRtc,
    canConvertToCommunity,
    canImportToCommunity,
    buildIdenticonUrl,
    isEventKindHidden,
    getMessageText,
    diffGroupPermissions,
    canSendDirectMessage,
    canSendGroupMessage,
    permittedMessagesInDirectChat,
    permittedMessagesInGroup,
    activeUserIdFromEvent,
    doesMessageFailFilter,
    canStartVideoCalls,
    buildBlobUrl,
    isLapsed,
} from "./utils/chat";
import {
    buildUsernameList,
    compareIsNotYouThenUsername,
    compareUsername,
    formatLastOnlineDate,
    nullUser,
    userAvatarUrl,
} from "./utils/user";
import { rtcConnectionsManager } from "./utils/rtcConnectionsManager";
import { showTrace } from "./utils/profiling";
import { CachePrimer } from "./utils/cachePrimer";
import { Poller } from "./utils/poller";
import { RecentlyActiveUsersTracker } from "./utils/recentlyActiveUsersTracker";
import { selectedAuthProviderStore } from "./stores/authProviders";
import { blockedUsers } from "./stores/blockedUsers";
import { undeletingMessagesStore } from "./stores/undeletingMessages";
import {
    chatsInitialised,
    chatsLoading,
    chatStateStore,
    chatSummariesListStore,
    chatSummariesStore,
    clearSelectedChat,
    userMetrics,
    createDirectChat,
    currentChatBlockedUsers,
    currentChatInvitedUsers,
    currentChatDraftMessage,
    currentChatEditingEvent,
    currentChatAttachment,
    currentChatMembers,
    currentChatPinnedMessages,
    currentChatReplyingTo,
    currentChatRules,
    currentChatTextContent,
    eventsStore,
    focusMessageIndex,
    expandedDeletedMessages,
    isProposalGroup,
    nextEventAndMessageIndexes,
    numberOfThreadsStore,
    proposalTopicsStore,
    selectedChatId,
    selectedChatStore,
    selectedServerChatStore,
    serverChatSummariesStore,
    setSelectedChat,
    threadsByChatStore,
    threadsFollowedByMeStore,
    userGroupKeys,
    threadServerEventsStore,
    threadEvents,
    nextEventAndMessageIndexesForThread,
    selectedThreadRootMessageIndex,
    clearServerEvents,
    confirmedEventIndexesLoaded,
    addGroupPreview,
    removeUninitializedDirectChat,
    removeGroupPreview,
    groupPreviewsStore,
    isContiguous,
    confirmedThreadEventIndexesLoadedStore,
    isContiguousInThread,
    focusThreadMessageIndex,
    selectedMessageContext,
    currentChatMembersMap,
    hideMessagesFromDirectBlocked,
} from "./stores/chat";
import {
    cryptoBalance,
    cryptoLookup,
    cryptoTokensSorted,
    enhancedCryptoLookup,
    exchangeRatesLookupStore,
    lastCryptoSent,
    nervousSystemLookup,
    walletConfigStore,
    walletTokensSorted,
} from "./stores/crypto";
import {
    disableAllProposalFilters,
    enableAllProposalFilters,
    filteredProposalsStore,
    toggleProposalFilter,
    toggleProposalFilterMessageExpansion,
} from "./stores/filteredProposals";
import { lastOnlineDates } from "./stores/lastOnlineDates";
import { localChatSummaryUpdates } from "./stores/localChatSummaryUpdates";
import { localMessageUpdates } from "./stores/localMessageUpdates";
import { messagesRead, startMessagesReadTracker } from "./stores/markRead";
import {
    askForNotificationPermission,
    initNotificationStores,
    notificationStatus,
    setSoftDisabled,
} from "./stores/notifications";
import { profileStore } from "./stores/profiling";
import { recommendedGroupExclusions } from "./stores/recommendedGroupExclusions";
import { proposalTallies } from "./stores/proposalTallies";
import {
    percentageStorageRemaining,
    percentageStorageUsed,
    storageInGb,
    storageStore,
    updateStorageLimit,
} from "./stores/storage";
import { translationStore } from "./stores/translation";
import { byContext, isTyping, typing } from "./stores/typing";
import { unconfirmed, unconfirmedReadByThem } from "./stores/unconfirmed";
import {
    openChatBotUser,
    OPENCHAT_BOT_USER_ID,
    proposalsBotUser,
    specialUsers,
    userStore,
    currentUser,
    anonymousUserSummary,
    anonUser,
    suspendedUser,
    platformModerator,
    platformOperator,
    videoCallBotUser,
    AIRDROP_BOT_USER_ID,
    airdropBotUser,
} from "./stores/user";
import { userCreatedStore } from "./stores/userCreated";
import { dataToBlobUrl } from "./utils/blob";
import { formatTokens, parseBigInt, validateTokenInput } from "./utils/cryptoFormatter";
import {
    formatMessageDate,
    toDateString,
    toDatetimeString,
    toLongDateString,
    toShortTimeString,
    toMonthString,
} from "./utils/date";
import formatFileSize from "./utils/fileSize";
import { calculateMediaDimensions } from "./utils/layout";
import {
    findLast,
    groupBy,
    groupWhile,
    keepMax,
    partition,
    toRecord,
    toRecord2,
} from "./utils/list";
import {
    audioRecordingMimeType,
    containsSocialVideoLink,
    DIAMOND_MAX_SIZES,
    fillMessage,
    FREE_MAX_SIZES,
    isSocialVideoLink,
    type MaxMediaSizes,
    messageContentFromFile,
    twitterLinkRegex,
    youtubeRegex,
    spotifyRegex,
} from "./utils/media";
import { mergeKeepingOnlyChanged } from "./utils/object";
import {
    createRemoteVideoEndedEvent,
    createRemoteVideoStartedEvent,
    filterWebRtcMessage,
    parseWebRtcMessage,
} from "./utils/rtc";
import {
    durationFromMilliseconds,
    formatDisappearingMessageTime,
    formatDuration,
    formatRelativeTime,
    formatTimeRemaining,
} from "./utils/time";
import { initialiseTracking, startTrackingSession, trackEvent } from "./utils/tracking";
import { startSwCheckPoller } from "./utils/updateSw";
import type { OpenChatConfig } from "./config";
import {
    ChatsUpdated,
    ChatUpdated,
    ChitEarnedEvent,
    LoadedMessageWindow,
    LoadedNewMessages,
    LoadedPreviousMessages,
    ReactionSelected,
    RemoteVideoCallStartedEvent,
    SelectedChatInvalid,
    SendingMessage,
    SendMessageFailed,
    SentMessage,
    ThreadClosed,
    ThreadSelected,
    UserLoggedIn,
    UserSuspensionChanged,
    VideoCallMessageUpdated,
} from "./events";
import { LiveState } from "./liveState";
import { getTypingString, startTyping, stopTyping } from "./utils/chat";
import { indexIsInRanges } from "./utils/range";
import { DEFAULT_WORKER_TIMEOUT, OpenChatAgentWorker } from "./agentWorker";
import type {
    CreatedUser,
    IdentityState,
    ThreadSyncDetails,
    WebRtcMessage,
    ChatSummary,
    EventWrapper,
    Message,
    GroupChatSummary,
    MemberRole,
    Rules,
    EventsResponse,
    ChatEvent,
    ThreadSummary,
    DataContent,
    SendMessageSuccess,
    TransferSuccess,
    User,
    RemoteUserToggledReaction,
    RemoteUserSentMessage,
    CheckUsernameResponse,
    UserSummary,
    RegisterUserResponse,
    CurrentUserResponse,
    RemoveMemberResponse,
    RegisterProposalVoteResponse,
    GroupInvite,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    ThreadPreview,
    UsersArgs,
    UsersResponse,
    PublicProfile,
    SetUsernameResponse,
    SetBioResponse,
    PendingCryptocurrencyWithdrawal,
    WithdrawCryptocurrencyResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    UpdateGroupResponse,
    CandidateGroupChat,
    CreateGroupResponse,
    Notification,
    Logger,
    ChatFrozenEvent,
    ChatUnfrozenEvent,
    UserStatus,
    ThreadRead,
    DiamondMembershipDuration,
    DiamondMembershipFees,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
    UpdatedEvent,
    AccessGate,
    ProposalVoteDetails,
    MessageReminderCreatedContent,
    CommunityPermissions,
    CommunitySummary,
    CreateCommunityResponse,
    GroupSearchResponse,
    ChatPermissions,
    ChatIdentifier,
    GroupChatIdentifier,
    DirectChatIdentifier,
    CommunityIdentifier,
    ExploreCommunitiesResponse,
    MultiUserChatIdentifier,
    MultiUserChat,
    ChatListScope,
    ChannelIdentifier,
    ExploreChannelsResponse,
    CommunityInvite,
    ModerationFlag,
    ChannelSummary,
    GroupMoved,
    CryptocurrencyContent,
    CryptocurrencyDetails,
    CryptocurrencyTransfer,
    Mention,
    SetDisplayNameResponse,
    UserGroupDetails,
    CreateUserGroupResponse,
    UpdateUserGroupResponse,
    SetMemberDisplayNameResponse,
    UserOrUserGroup,
    AttachmentContent,
    MessageContent,
    MessageContext,
    UpdatedRules,
    PendingCryptocurrencyTransfer,
    TipMessageResponse,
    NamedAccount,
    SaveCryptoAccountResponse,
    CandidateProposal,
    GroupSubtype,
    NervousSystemDetails,
    OptionUpdate,
    AccountTransactionResult,
    MessagePermission,
    OptionalChatPermissions,
    ExpiredEventsRange,
    UpdatesResult,
    DexId,
    SwapTokensResponse,
    TokenSwapStatusResponse,
    Member,
    Level,
    VersionedRules,
    DiamondMembershipStatus,
    Success,
    Failure,
    AcceptP2PSwapResponse,
    CancelP2PSwapResponse,
    CommunityDetailsResponse,
    GroupChatDetailsResponse,
    CandidateTranslations,
    ProposeResponse,
    RejectReason,
    JoinVideoCallResponse,
    AccessTokenType,
    UpdateBtcBalanceResponse,
    ApproveAccessGatePaymentResponse,
    ClientJoinGroupResponse,
    ClientJoinCommunityResponse,
    GenerateMagicLinkResponse,
    HandleMagicLinkResponse,
    SiwePrepareLoginResponse,
    SiwsPrepareLoginResponse,
    VideoCallPresence,
    VideoCallParticipant,
    AcceptedRules,
    ClaimDailyChitResponse,
    VerifiedCredentialArgs,
    VideoCallContent,
    ChitEventsRequest,
    ChitEventsResponse,
    GenerateChallengeResponse,
    ChallengeAttempt,
    AccessGateWithLevel,
    PreprocessedGate,
    SubmitProofOfUniquePersonhoodResponse,
    Achievement,
    PayForDiamondMembershipResponse,
    LinkIdentitiesResponse,
    AddMembersToChannelResponse,
    WalletConfig,
    AirdropChannelDetails,
    ChitLeaderboardResponse,
    AccessGateConfig,
    Verification,
} from "openchat-shared";
import {
    AuthProvider,
    missingUserIds,
    getTimeUntilSessionExpiryMs,
    userIdsFromEvents,
    getContentAsFormattedText,
    indexRangeForChat,
    getDisplayDate,
    MessagesReadFromServer,
    StorageUpdated,
    UsersLoaded,
    userStatus,
    compareRoles,
    E8S_PER_TOKEN,
    ChatMap,
    chatIdentifiersEqual,
    chatIdentifierToString,
    MessageContextMap,
    messageContextsEqual,
    communityRoles,
    isNeuronGate,
    toTitleCase,
    CommonResponses,
    defaultChatRules,
    userOrUserGroupName,
    userOrUserGroupId,
    extractUserIdsFromMentions,
    isMessageNotification,
    userIdsFromTransactions,
    contentTypeToPermission,
    mapAcceptP2PSwapResponseToStatus,
    mapCancelP2PSwapResponseToStatus,
    anonymousUser,
    ANON_USER_ID,
    isPaymentGate,
    ONE_MINUTE_MILLIS,
    ONE_HOUR,
    LEDGER_CANISTER_CHAT,
    OPENCHAT_VIDEO_CALL_USER_ID,
    IdentityStorage,
    NoMeetingToJoin,
    featureRestricted,
    buildDelegationIdentity,
    toDer,
    storeIdentity,
    updateCreatedUser,
    LARGE_GROUP_THRESHOLD,
    isCompositeGate,
    shouldPreprocessGate,
    deletedUser,
} from "openchat-shared";
import { failedMessagesStore } from "./stores/failedMessages";
import {
    canExtendDiamond,
    diamondStatus,
    isDiamond,
    diamondDurationToMs,
    isLifetimeDiamond,
} from "./stores/diamond";
import {
    addCommunityPreview,
    communities,
    communitiesList,
    communityPreviewsStore,
    communityStateStore,
    currentCommunityBlockedUsers,
    currentCommunityInvitedUsers,
    currentCommunityMembers,
    currentCommunityReferrals,
    currentCommunityRules,
    currentCommunityUserGroups,
    nextCommunityIndex,
    removeCommunityPreview,
    selectedCommunity,
    userGroupSummaries,
} from "./stores/community";
import {
    globalStateStore,
    favouritesStore,
    setGlobalState,
    updateSummaryWithConfirmedMessage,
    chatListScopeStore,
    unreadGroupCounts,
    unreadDirectCounts,
    unreadFavouriteCounts,
    unreadCommunityChannelCounts,
    globalUnreadCount,
    mergeCombinedUnreadCounts,
    groupVideoCallCounts,
    directVideoCallCounts,
    favouritesVideoCallCounts,
    communityChannelVideoCallCounts,
    chitStateStore,
} from "./stores/global";
import { localCommunitySummaryUpdates } from "./stores/localCommunitySummaryUpdates";
import { hasFlag, moderationFlags } from "./stores/flagStore";
import { hasOwnerRights } from "./utils/permissions";
import { isDisplayNameValid, isUsernameValid } from "./utils/validation";
import { verifyCredential } from "./utils/credentials";
import { offlineStore } from "./stores/network";
import { messageFiltersStore, type MessageFilter } from "./stores/messageFilters";
import { draftMessagesStore } from "./stores/draftMessages";
import {
    disableLinksInText,
    extractDisabledLinks,
    extractEnabledLinks,
    stripLinkDisabledMarker,
} from "./utils/linkPreviews";
import type { SendMessageResponse } from "openchat-shared";
import { applyTranslationCorrection } from "./stores/i18n";
import { getUserCountryCode } from "./utils/location";
import { isBalanceGate, isCredentialGate } from "openchat-shared";
import { DelegationChain, ECDSAKeyIdentity } from "@dfinity/identity";
import {
    capturePinNumberStore,
    pinNumberFailureStore,
    pinNumberRequiredStore,
} from "./stores/pinNumber";
import { captureRulesAcceptanceStore } from "./stores/rules";
import type { SetPinNumberResponse } from "openchat-shared";
import type { PinNumberFailures, MessageFormatter } from "openchat-shared";
import { canRetryMessage, isTransfer } from "openchat-shared";
import {
    initialiseMostRecentSentMessageTimes,
    shouldThrottle,
    throttleDeadline,
} from "./stores/throttling";
import { storeEmailSignInSession } from "openchat-shared";
import { getEmailSignInSession } from "openchat-shared";
import { removeEmailSignInSession } from "openchat-shared";
import { localGlobalUpdates } from "./stores/localGlobalUpdates";

const MARK_ONLINE_INTERVAL = 61 * 1000;
const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE_MILLIS;
const USER_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
const REGISTRY_UPDATE_INTERVAL = 2 * ONE_MINUTE_MILLIS;
const EXCHANGE_RATE_UPDATE_INTERVAL = 5 * ONE_MINUTE_MILLIS;
const MAX_USERS_TO_UPDATE_PER_BATCH = 500;
const MAX_INT32 = Math.pow(2, 31) - 1;

export class OpenChat extends OpenChatAgentWorker {
    private _ocIdentityStorage: IdentityStorage;
    private _userLocation: string | undefined;
    private _authClientStorage: AuthClientStorage = new IdbStorage();
    private _authClient: Promise<AuthClient>;
    private _authPrincipal: string | undefined;
    private _ocIdentity: Identity | undefined;
    private _liveState: LiveState;
    private _identityState = writable<IdentityState>({ kind: "loading_user" });
    private _logger: Logger;
    private _lastOnlineDatesPending = new Set<string>();
    private _lastOnlineDatesPromise: Promise<Record<string, number>> | undefined;
    private _cachePrimer: CachePrimer | undefined = undefined;
    private _membershipCheck: number | undefined;
    private _referralCode: string | undefined = undefined;
    private _userLookupForMentions: Record<string, UserOrUserGroup> | undefined = undefined;
    private _chatsPoller: Poller | undefined = undefined;
    private _registryPoller: Poller | undefined = undefined;
    private _userUpdatePoller: Poller | undefined = undefined;
    private _exchangeRatePoller: Poller | undefined = undefined;
    private _recentlyActiveUsersTracker: RecentlyActiveUsersTracker =
        new RecentlyActiveUsersTracker();

    currentAirdropChannel: AirdropChannelDetails | undefined = undefined;
    user = currentUser;
    anonUser = anonUser;
    suspendedUser = suspendedUser;
    platformModerator = platformModerator;
    platformOperator = platformOperator;

    constructor(config: OpenChatConfig) {
        super(config);

        this.addEventListener("openchat_event", (ev) => this.handleAgentEvent(ev));

        this._logger = config.logger;
        this._liveState = new LiveState();

        console.log("OpenChatConfig: ", config);

        specialUsers.set(
            new Map([
                [OPENCHAT_BOT_USER_ID, openChatBotUser],
                [OPENCHAT_VIDEO_CALL_USER_ID, videoCallBotUser],
                [AIRDROP_BOT_USER_ID, airdropBotUser],
                [ANON_USER_ID, anonymousUserSummary],
                [config.proposalBotCanister, proposalsBotUser(config.proposalBotCanister)],
            ]),
        );

        localStorage.removeItem("ic-delegation");
        localStorage.removeItem("ic-identity");
        initialiseTracking(config);

        this._ocIdentityStorage = new IdentityStorage();
        this._authClient = AuthClient.create({
            idleOptions: {
                disableIdle: true,
                disableDefaultIdleCallback: true,
            },
            storage: this._authClientStorage,
        });

        this._authClient
            .then((c) => c.getIdentity())
            .then((authIdentity) => this.loadedAuthenticationIdentity(authIdentity, undefined));
    }

    public get AuthPrincipal(): string {
        if (this._authPrincipal === undefined) {
            throw new Error("Trying to access the _authPrincipal before it has been set up");
        }
        return this._authPrincipal;
    }

    clearCachedData() {
        this.sendRequest({
            kind: "clearCachedData",
        }).then((_) => window.location.reload());
    }

    private chatUpdated(chatId: ChatIdentifier, updatedEvents: UpdatedEvent[]): void {
        if (
            this._liveState.selectedChatId === undefined ||
            !chatIdentifiersEqual(chatId, this._liveState.selectedChatId)
        ) {
            return;
        }

        const serverChat = this._liveState.selectedServerChat;
        if (serverChat === undefined) return;
        // The chat summary has been updated which means the latest message may be new
        const latestMessage = serverChat.latestMessage;
        if (
            latestMessage !== undefined &&
            latestMessage.event.sender !== this._liveState.user.userId
        ) {
            this.handleConfirmedMessageSentByOther(serverChat, latestMessage, undefined);
        }

        this.refreshUpdatedEvents(serverChat, updatedEvents);
        this.loadChatDetails(serverChat);
        this.dispatchEvent(new ChatUpdated({ chatId, threadRootMessageIndex: undefined }));
    }

    clearPostLoginState() {
        this._identityState.update((state) => ({ ...state, postLogin: undefined }));
    }

    updateIdentityState(newState: IdentityState) {
        this._identityState.update((previous) => {
            return {
                ...newState,
                postLogin: newState.postLogin ?? previous.postLogin,
            };
        });
    }

    get identityState(): Readable<IdentityState> {
        return this._identityState;
    }

    private async loadedAuthenticationIdentity(
        id: Identity,
        authProvider: AuthProvider | undefined,
    ) {
        currentUser.set(anonymousUser());
        chatsInitialised.set(false);
        const anon = id.getPrincipal().isAnonymous();
        const authPrincipal = id.getPrincipal().toString();
        this._authPrincipal = anon ? undefined : authPrincipal;
        this.updateIdentityState(anon ? { kind: "anon" } : { kind: "loading_user" });

        const connectToWorkerResponse = await this.connectToWorker(authPrincipal, authProvider);

        if (!anon) {
            if (connectToWorkerResponse === "oc_identity_not_found") {
                if (authProvider !== AuthProvider.II && authProvider !== AuthProvider.EMAIL) {
                    this.updateIdentityState({ kind: "challenging" });
                    return;
                }

                await this.sendRequest({
                    kind: "createOpenChatIdentity",
                    challengeAttempt: undefined,
                });
            }

            this._ocIdentity = await this._ocIdentityStorage.get(authPrincipal);
        } else {
            await this._ocIdentityStorage.remove();
        }

        this.loadUser();
    }

    logError(message: unknown, error: unknown, ...optionalParams: unknown[]): void {
        this._logger.error(message, error, ...optionalParams);
    }

    logMessage(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.log(message, ...optionalParams);
    }

    logDebug(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.debug(message, ...optionalParams);
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
        const authProvider = this._liveState.selectedAuthProvider!;
        this._authClient.then((c) => {
            c.login({
                ...this.getAuthClientOptions(authProvider),
                onSuccess: () => this.loadedAuthenticationIdentity(c.getIdentity(), authProvider),
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

    private startSession(identity: Identity): Promise<void> {
        if (this._liveState.anonUser) {
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

    private handleAgentEvent(ev: Event): void {
        if (ev instanceof MessagesReadFromServer) {
            messagesRead.syncWithServer(
                ev.detail.chatId,
                ev.detail.readByMeUpTo,
                ev.detail.threadsRead,
                ev.detail.dateReadPinned,
            );
        }
        if (ev instanceof StorageUpdated) {
            storageStore.set(ev.detail);
        }
        if (ev instanceof UsersLoaded) {
            userStore.addMany(ev.detail);
        }
    }

    async submitChallenge(challengeAttempt: ChallengeAttempt): Promise<boolean> {
        if (this._authPrincipal === undefined) {
            return false;
        }

        const resp = await this.sendRequest({
            kind: "createOpenChatIdentity",
            challengeAttempt,
        }).catch(() => "challenge_failed");

        if (resp !== "success") {
            return false;
        }

        this._ocIdentity = await this._ocIdentityStorage
            .get(this._authPrincipal)
            .catch(() => undefined);

        this.loadUser();
        return true;
    }

    private async loadUser() {
        this.startRegistryPoller();

        if (this._ocIdentity === undefined) {
            // short-circuit if we *know* that the user is anonymous
            this.onCreatedUser(anonymousUser());
            return;
        }

        this.sendRequest({ kind: "loadFailedMessages" }).then((res) =>
            failedMessagesStore.initialise(MessageContextMap.fromMap(res)),
        );

        this.getCurrentUser()
            .then((user) => {
                switch (user.kind) {
                    case "unknown_user":
                        this.onCreatedUser(anonymousUser());
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
        this.sendRequest({ kind: "getAllCachedUsers" }).then((users) => userStore.set(users));
    }

    userIsDiamond(userId: string): boolean {
        const user = this._liveState.userStore.get(userId);
        if (user === undefined || user.kind === "bot") return false;

        if (userId === this._liveState.user.userId) return this._liveState.isDiamond;

        return user.diamondStatus !== "inactive";
    }

    userIsLifetimeDiamond(userId: string): boolean {
        const user = this._liveState.userStore.get(userId);
        if (user === undefined || user.kind === "bot") return false;

        if (userId === this._liveState.user.userId) return this._liveState.isLifetimeDiamond;

        return user.diamondStatus === "lifetime";
    }

    diamondExpiresIn(now: number, locale: string | null | undefined): string | undefined {
        if (this._liveState.diamondStatus.kind === "active") {
            return formatRelativeTime(now, locale, this._liveState.diamondStatus.expiresAt);
        }
    }

    maxMediaSizes(): MaxMediaSizes {
        return this._liveState.isDiamond ? DIAMOND_MAX_SIZES : FREE_MAX_SIZES;
    }

    onCreatedUser(user: CreatedUser): void {
        this.user.set(user);
        this.setDiamondStatus(user.diamondStatus);
        initialiseMostRecentSentMessageTimes(this._liveState.isDiamond);
        const id = this._ocIdentity;

        this.sendRequest({ kind: "createUserClient", userId: user.userId });
        startSwCheckPoller();
        if (id !== undefined) {
            this.startSession(id).then(() => this.logout());
        }

        this.startChatsPoller();
        this.startUserUpdatePoller();

        initNotificationStores();
        if (!this._liveState.anonUser) {
            this.startOnlinePoller();
            this.sendRequest({ kind: "getUserStorageLimits" })
                .then(storageStore.set)
                .catch((err) => {
                    console.warn("Unable to retrieve user storage limits", err);
                });
            this.updateIdentityState({ kind: "logged_in" });
            this.dispatchEvent(new UserLoggedIn(user.userId));
        }
    }

    private startUserUpdatePoller() {
        this._userUpdatePoller?.stop();
        this._userUpdatePoller = new Poller(
            () => this.updateUsers(),
            USER_UPDATE_INTERVAL,
            USER_UPDATE_INTERVAL,
        );
    }

    pauseEventLoop() {
        this._chatsPoller?.stop();
    }

    resumeEventLoop() {
        this.startChatsPoller();
    }

    private startChatsPoller() {
        this._chatsPoller?.stop();
        this._chatsPoller = new Poller(
            () => this.loadChats(),
            CHAT_UPDATE_INTERVAL,
            CHAT_UPDATE_IDLE_INTERVAL,
            true,
        );

        // we need to load chats at least once if we are completely offline
        if (this._liveState.offlineStore) {
            this.loadChats();
        }
    }

    private startOnlinePoller() {
        if (!this._liveState.anonUser) {
            new Poller(
                () => this.sendRequest({ kind: "markAsOnline" }) ?? Promise.resolve(),
                MARK_ONLINE_INTERVAL,
                undefined,
                true,
            );
        }
    }

    private startRegistryPoller() {
        this._registryPoller?.stop();
        this._registryPoller = new Poller(
            () => this.updateRegistry(),
            REGISTRY_UPDATE_INTERVAL,
            REGISTRY_UPDATE_INTERVAL,
            false,
        );
    }

    private startExchangeRatePoller() {
        this._exchangeRatePoller?.stop();
        this._exchangeRatePoller = new Poller(
            () => this.updateExchangeRates(),
            EXCHANGE_RATE_UPDATE_INTERVAL,
            EXCHANGE_RATE_UPDATE_INTERVAL,
            true,
        );
    }

    async logout(): Promise<void> {
        await Promise.all([
            this._ocIdentityStorage.remove(),
            this._authClient.then((c) => c.logout()),
        ]).then(() => window.location.replace("/"));
    }

    async previouslySignedIn(): Promise<boolean> {
        const KEY_STORAGE_IDENTITY = "identity";
        const identity = await this._authClientStorage.get(KEY_STORAGE_IDENTITY);
        return this._liveState.userCreated && identity !== null;
    }

    generateIdentityChallenge(): Promise<GenerateChallengeResponse> {
        return this.sendRequest({
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
        return this.messagesRead.unreadThreadMessageCount(
            chatId,
            threadRootMessageIndex,
            latestMessageIndex,
        );
    }

    unreadMessageCount(chatId: ChatIdentifier, latestMessageIndex: number | undefined): number {
        return this.messagesRead.unreadMessageCount(chatId, latestMessageIndex);
    }

    unreadPinned(chatId: MultiUserChatIdentifier, dateLastPinned: bigint | undefined): boolean {
        return this.messagesRead.unreadPinned(chatId, dateLastPinned);
    }

    markThreadRead(chatId: ChatIdentifier, threadRootMessageIndex: number, readUpTo: number): void {
        this.messagesRead.markReadUpTo({ chatId, threadRootMessageIndex }, readUpTo);
    }

    markMessageRead(
        context: MessageContext,
        messageIndex: number,
        messageId: bigint | undefined,
    ): void {
        if (this.messagesRead.isRead(context, messageIndex, messageId)) {
            return;
        }

        this.messagesRead.markMessageRead(context, messageIndex, messageId);

        const selectedChat = this._liveState.selectedChat;
        if (
            selectedChat?.id === context.chatId &&
            messageId !== undefined &&
            selectedChat.kind === "direct_chat"
        ) {
            const rtc: WebRtcMessage = {
                kind: "remote_user_read_message",
                messageId: messageId,
                id: selectedChat.id,
                userId: this._liveState.user.userId,
            };
            this.sendRtcMessage([selectedChat.id.userId], rtc);
        }
    }

    markPinnedMessagesRead(chatId: ChatIdentifier, dateLastPinned: bigint): void {
        this.messagesRead.markPinnedMessagesRead(chatId, dateLastPinned);
    }

    isMessageRead(
        context: MessageContext,
        messageIndex: number,
        messageId: bigint | undefined,
    ): boolean {
        return this.messagesRead.isRead(context, messageIndex, messageId);
    }

    private sendRtcMessage(userIds: string[], message: WebRtcMessage): void {
        rtcConnectionsManager.sendMessage(userIds, message);
    }

    private initWebRtc(): void {
        rtcConnectionsManager
            .init(this._liveState.user.userId, this.config.meteredApiKey)
            .then((_) => {
                rtcConnectionsManager.subscribe((msg) =>
                    this.handleWebRtcMessage(msg as WebRtcMessage),
                );
            });
    }

    previewChat(chatId: MultiUserChatIdentifier): Promise<Success | Failure | GroupMoved> {
        switch (chatId.kind) {
            case "group_chat":
                return this.sendRequest({ kind: "getPublicGroupSummary", chatId })
                    .then((resp) => {
                        if (resp.kind === "success" && !resp.group.frozen) {
                            addGroupPreview(resp.group);
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
                return this.sendRequest({ kind: "getChannelSummary", chatId })
                    .then((resp) => {
                        if (resp.kind === "channel") {
                            addGroupPreview(resp);
                            return CommonResponses.success();
                        }
                        return CommonResponses.failure();
                    })
                    .catch(() => CommonResponses.failure());
        }
    }

    toggleMuteNotifications(chatId: ChatIdentifier, muted: boolean): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { notificationsMuted: muted });
        return this.sendRequest({ kind: "toggleMuteNotifications", id: chatId, muted })
            .then((resp) => {
                if (resp !== "success") {
                    localChatSummaryUpdates.markUpdated(chatId, { notificationsMuted: undefined });
                }
                return resp === "success";
            })
            .catch(() => {
                localChatSummaryUpdates.markUpdated(chatId, { notificationsMuted: undefined });
                return false;
            });
    }

    muteAllChannels(communityId: CommunityIdentifier): Promise<boolean> {
        const community = this._liveState.communities.get(communityId);
        if (community === undefined) {
            return Promise.resolve(false);
        }

        community.channels.forEach((c) =>
            localChatSummaryUpdates.markUpdated(c.id, { notificationsMuted: true }),
        );

        return this.sendRequest({ kind: "toggleMuteNotifications", id: communityId, muted: true })
            .then((resp) => {
                if (resp !== "success") {
                    community.channels.forEach((c) =>
                        localChatSummaryUpdates.markUpdated(c.id, {
                            notificationsMuted: undefined,
                        }),
                    );
                }
                return resp === "success";
            })
            .catch(() => {
                community.channels.forEach((c) =>
                    localChatSummaryUpdates.markUpdated(c.id, { notificationsMuted: undefined }),
                );
                return false;
            });
    }

    archiveChat(chatId: ChatIdentifier): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { archived: true });
        return this.sendRequest({ kind: "archiveChat", chatId })
            .then((resp) => {
                return resp === "success";
            })
            .catch(() => {
                localChatSummaryUpdates.markUpdated(chatId, { archived: undefined });
                return false;
            });
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { archived: false });
        return this.sendRequest({ kind: "unarchiveChat", chatId })
            .then((resp) => resp === "success")
            .catch(() => {
                localChatSummaryUpdates.markUpdated(chatId, { archived: undefined });
                return false;
            });
    }

    private pinLocally(chatId: ChatIdentifier, scope: ChatListScope["kind"]): void {
        globalStateStore.update((state) => {
            const ids = state.pinnedChats[scope];
            if (!ids.find((id) => chatIdentifiersEqual(id, chatId))) {
                return {
                    ...state,
                    pinnedChats: {
                        ...state.pinnedChats,
                        [scope]: [chatId, ...ids],
                    },
                };
            }
            return state;
        });
    }

    private unpinLocally(chatId: ChatIdentifier, scope: ChatListScope["kind"]): void {
        globalStateStore.update((state) => {
            const ids = state.pinnedChats[scope];
            const index = ids.findIndex((id) => chatIdentifiersEqual(id, chatId));
            if (index >= 0) {
                const ids_clone = [...ids];
                ids_clone.splice(index, 1);
                return {
                    ...state,
                    pinnedChats: {
                        ...state.pinnedChats,
                        [scope]: ids_clone,
                    },
                };
            }
            return state;
        });
    }

    pinned(scope: ChatListScope["kind"], chatId: ChatIdentifier): boolean {
        const pinned = this._liveState.globalState.pinnedChats;
        return pinned[scope].find((id) => chatIdentifiersEqual(id, chatId)) !== undefined;
    }

    pinChat(chatId: ChatIdentifier): Promise<boolean> {
        const scope = this._liveState.chatListScope.kind;
        this.pinLocally(chatId, scope);
        return this.sendRequest({
            kind: "pinChat",
            chatId,
            favourite: scope === "favourite",
        })
            .then((resp) => resp === "success")
            .catch(() => {
                this.unpinLocally(chatId, scope);
                return false;
            });
    }

    unpinChat(chatId: ChatIdentifier): Promise<boolean> {
        const scope = this._liveState.chatListScope.kind;
        this.unpinLocally(chatId, scope);
        return this.sendRequest({
            kind: "unpinChat",
            chatId,
            favourite: scope === "favourite",
        })
            .then((resp) => resp === "success")
            .catch(() => {
                this.pinLocally(chatId, scope);
                return false;
            });
    }

    blockUserFromDirectChat(userId: string): Promise<boolean> {
        blockedUsers.add(userId);
        return this.sendRequest({ kind: "blockUserFromDirectChat", userId })
            .then((resp) => {
                return resp === "success";
            })
            .catch(() => {
                blockedUsers.delete(userId);
                return false;
            });
    }

    unblockUserFromDirectChat(userId: string): Promise<boolean> {
        blockedUsers.delete(userId);
        return this.sendRequest({ kind: "unblockUserFromDirectChat", userId })
            .then((resp) => {
                return resp === "success";
            })
            .catch(() => {
                blockedUsers.add(userId);
                return false;
            });
    }

    setUserAvatar(data: Uint8Array, url: string): Promise<boolean> {
        const partialUser = this._liveState.userStore.get(this._liveState.user.userId);
        if (partialUser) {
            userStore.add({
                ...partialUser,
                blobData: data,
                blobUrl: url,
            });
        }

        return this.sendRequest({ kind: "setUserAvatar", data })
            .then((_resp) => true)
            .catch(() => false);
    }

    deleteGroup(chatId: MultiUserChatIdentifier): Promise<boolean> {
        // TODO we don't use the local updates mechanism here at the moment for some reason. Probably should.
        return this.sendRequest({ kind: "deleteGroup", chatId })
            .then((resp) => {
                if (resp === "success") {
                    this.removeChat(chatId);
                    return true;
                } else {
                    return false;
                }
            })
            .catch(() => false);
    }

    deleteDirectChat(userId: string, blockUser: boolean): Promise<boolean> {
        const chatId: ChatIdentifier = { kind: "direct_chat", userId };
        localChatSummaryUpdates.markRemoved(chatId);
        return this.sendRequest({ kind: "deleteDirectChat", userId, blockUser })
            .then((success) => {
                if (!success) {
                    const chat = this._liveState.chatSummaries.get(chatId);
                    if (chat !== undefined) {
                        localChatSummaryUpdates.markAdded(chat);
                    }
                }
                return success;
            })
            .catch(() => false);
    }

    leaveGroup(
        chatId: MultiUserChatIdentifier,
    ): Promise<"success" | "failure" | "owner_cannot_leave"> {
        localChatSummaryUpdates.markRemoved(chatId);
        return this.sendRequest({ kind: "leaveGroup", chatId })
            .then((resp) => {
                if (resp === "success") {
                    return "success";
                } else {
                    const chat = this._liveState.chatSummaries.get(chatId);
                    if (chat) {
                        localChatSummaryUpdates.markAdded(chat);
                    }
                    if (resp === "owner_cannot_leave") {
                        return "owner_cannot_leave";
                    } else {
                        return "failure";
                    }
                }
            })
            .catch(() => "failure");
    }

    private addCommunityLocally(community: CommunitySummary): void {
        localCommunitySummaryUpdates.markAdded(community);
        community.channels.forEach((c) => localChatSummaryUpdates.markAdded(c));
    }

    private removeCommunityLocally(id: CommunityIdentifier): void {
        if (this._liveState.communityPreviews.has(id)) {
            removeCommunityPreview(id);
        }
        localCommunitySummaryUpdates.markRemoved(id);
        const community = this._liveState.communities.get(id);
        if (community !== undefined) {
            community.channels.forEach((c) => localChatSummaryUpdates.markRemoved(c.id));
        }
    }

    verifyAccessGate(gate: AccessGate, iiPrincipal: string): Promise<string | undefined> {
        if (gate.kind !== "credential_gate" || this._authPrincipal === undefined) {
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

    async approveAccessGatePayment(
        group: MultiUserChat | CommunitySummary,
    ): Promise<ApproveAccessGatePaymentResponse> {
        // If there is no payment gate then do nothing
        if (!isPaymentGate(group.gateConfig.gate)) {
            // If this is a channel there might still be a payment gate on the community
            if (group.kind === "channel") {
                return this.approveAccessGatePayment(
                    this._liveState.communities.get({
                        kind: "community",
                        communityId: group.id.communityId,
                    })!,
                );
            } else {
                return CommonResponses.success();
            }
        }

        // If there is a payment gateway then first call the user's canister to get an
        // approval for the group/community to transfer the payment
        const spender = group.kind === "group_chat" ? group.id.groupId : group.id.communityId;

        const token = this.getTokenDetailsForAccessGate(group.gateConfig.gate);

        if (token === undefined) {
            return CommonResponses.failure();
        }

        let pin: string | undefined = undefined;

        if (this._liveState.pinNumberRequired) {
            pin = await this.promptForCurrentPin("pinNumber.enterPinInfo");
        }

        return this.sendRequest({
            kind: "approveTransfer",
            spender,
            ledger: group.gateConfig.gate.ledgerCanister,
            amount: group.gateConfig.gate.amount - token.transferFee, // The user should pay only the amount not amount+fee so it is a round number
            expiresIn: BigInt(5 * 60 * 1000), // Allow 5 mins for the join_group call before the approval expires
            pin,
        })
            .then((response) => {
                if (response.kind === "approve_error" || response.kind === "internal_error") {
                    this._logger.error("Unable to approve transfer", response.error);
                    return CommonResponses.failure();
                } else if (
                    response.kind === "pin_incorrect" ||
                    response.kind === "pin_required" ||
                    response.kind === "too_main_failed_pin_attempts"
                ) {
                    pinNumberFailureStore.set(response as PinNumberFailures);
                }

                return response;
            })
            .catch(() => CommonResponses.failure());
    }

    async joinGroup(chat: MultiUserChat, credentials: string[]): Promise<ClientJoinGroupResponse> {
        const approveResponse = await this.approveAccessGatePayment(chat);
        if (approveResponse.kind !== "success") {
            return approveResponse;
        }

        return this.sendRequest({
            kind: "joinGroup",
            chatId: chat.id,
            credentialArgs: this.buildVerifiedCredentialArgs(credentials),
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    localChatSummaryUpdates.markAdded(resp.group);
                    this.loadChatDetails(resp.group);
                    messagesRead.syncWithServer(
                        resp.group.id,
                        resp.group.membership?.readByMeUpTo,
                        [],
                        undefined,
                    );
                } else if (resp.kind === "success_joined_community") {
                    this.addCommunityLocally(resp.community);
                    messagesRead.batchUpdate(() =>
                        resp.community.channels.forEach((c) => {
                            if (chatIdentifiersEqual(c.id, chat.id)) {
                                localChatSummaryUpdates.markAdded(c);
                                this.loadChatDetails(c);
                            }
                            if (c.latestMessage) {
                                messagesRead.markReadUpTo(
                                    { chatId: c.id },
                                    c.latestMessage.event.messageIndex,
                                );
                            }
                        }),
                    );
                    if (this._liveState.communityPreviews.has(resp.community.id)) {
                        removeCommunityPreview(resp.community.id);
                    }
                } else {
                    if (resp.kind === "user_blocked") {
                        return CommonResponses.blocked();
                    } else if (resp.kind === "gate_check_failed") {
                        return resp;
                    }
                    return CommonResponses.failure();
                }
                return CommonResponses.success();
            })
            .then((resp) => {
                if (resp.kind === "success") {
                    if (this._liveState.groupPreviews.has(chat.id)) {
                        removeGroupPreview(chat.id);
                    }
                }
                return resp;
            })
            .catch(() => CommonResponses.failure());
    }

    private buildVerifiedCredentialArgs(credentials: string[]): VerifiedCredentialArgs | undefined {
        if (credentials.length === 0) return undefined;

        if (this._authPrincipal === undefined)
            throw new Error(
                "Cannot construct a VerifiedCredentialArg because the _authPrincipal is undefined",
            );

        return {
            userIIPrincipal: this._authPrincipal,
            iiOrigin: new URL(this.config.internetIdentityUrl).origin,
            credentialJwts: credentials,
        };
    }

    setCommunityIndexes(indexes: Record<string, number>): Promise<boolean> {
        Object.entries(indexes).forEach(([k, v]) =>
            localCommunitySummaryUpdates.updateIndex({ kind: "community", communityId: k }, v),
        );
        return this.sendRequest({ kind: "setCommunityIndexes", indexes }).catch(() => false);
    }

    setMemberDisplayName(
        id: CommunityIdentifier,
        displayName: string | undefined,
    ): Promise<SetMemberDisplayNameResponse> {
        const newAchievement = !this._liveState.globalState.achievements.has(
            "set_community_display_name",
        );

        return this.sendRequest({
            kind: "setMemberDisplayName",
            communityId: id.communityId,
            displayName,
            newAchievement,
        }).then((resp) => {
            if (resp === "success") {
                communityStateStore.updateProp(id, "members", (ms) => {
                    const userId = this._liveState.user.userId;
                    if (userId !== undefined) {
                        const m = ms.get(userId);
                        if (m !== undefined) {
                            ms.set(userId, { ...m, displayName });
                            return new Map(ms);
                        }
                    }
                    return ms;
                });

                localCommunitySummaryUpdates.updateDisplayName(id, displayName);
            }
            return resp;
        });
    }

    followThread(chatId: ChatIdentifier, message: Message, follow: boolean): Promise<boolean> {
        const threadRootMessageIndex = message.messageIndex;

        // Assume it will succeed
        localMessageUpdates.markThreadSummaryUpdated(message.messageId, {
            followedByMe: follow,
        });

        return this.sendRequest({
            kind: "followThread",
            chatId,
            threadRootMessageIndex,
            follow,
        })
            .then((resp) => {
                if (resp === "failed") {
                    localMessageUpdates.markThreadSummaryUpdated(message.messageId, {
                        followedByMe: !follow,
                    });
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

    getContentAsText(formatter: MessageFormatter, content: MessageContent): string {
        return getContentAsFormattedText(formatter, content, get(cryptoLookup));
    }

    groupAvatarUrl<T extends { blobUrl?: string; subtype?: GroupSubtype }>(chat?: T): string {
        if (chat?.blobUrl !== undefined) {
            return chat.blobUrl;
        } else if (chat?.subtype?.kind === "governance_proposals") {
            // If this is a governance proposals chat and no avatar has been set, use the default one for the SNS
            const snsLogo = this.getSnsLogo(chat.subtype.governanceCanisterId);
            if (snsLogo !== undefined) {
                return snsLogo;
            }
        }
        return "/assets/group.svg";
    }

    toShortTimeString(date: Date): string {
        return toShortTimeString(date, this._liveState.locale);
    }

    toMonthString(date: Date): string {
        return toMonthString(date, this._liveState.locale);
    }

    formatMessageDate(
        timestamp: bigint,
        today: string,
        yesterday: string,
        timeIfToday = false,
        short = false,
    ): string {
        return formatMessageDate(
            timestamp,
            today,
            yesterday,
            this._liveState.locale,
            timeIfToday,
            short,
        );
    }

    toDatetimeString(date: Date): string {
        return toDatetimeString(date, this._liveState.locale);
    }

    toDateString(date: Date): string {
        return toDateString(date, this._liveState.locale);
    }

    toLongDateString(date: Date): string {
        return toLongDateString(date, this._liveState.locale);
    }

    /**
     * Wrap a bunch of pure utility functions
     */
    showTrace = showTrace;
    userAvatarUrl = userAvatarUrl;
    updateStorageLimit = updateStorageLimit;
    formatTokens = formatTokens;
    validateTokenInput = validateTokenInput;
    parseBigInt = parseBigInt;
    userIdsFromEvents = userIdsFromEvents;
    missingUserIds = missingUserIds;
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
                return this.communityPredicate(chatId, canBlockCommunityUsers);
            case "channel":
                return false;
            default:
                return this.chatPredicate(chatId, canBlockUsers);
        }
    }

    canSendMessage(
        chatId: ChatIdentifier,
        mode: "message" | "thread" | "any",
        permission?: MessagePermission,
    ): boolean {
        return this.chatPredicate(chatId, (chat) => {
            if (chat.kind === "direct_chat") {
                const recipient = this._liveState.userStore.get(chat.them.userId);
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
                return canSendGroupMessage(this._liveState.user, chat, mode, permission);
            }
        });
    }

    permittedMessages(
        chatId: ChatIdentifier,
        mode: "message" | "thread",
    ): Map<MessagePermission, boolean> {
        const chat = this._liveState.allChats.get(chatId);
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") {
                const recipient = this._liveState.userStore.get(chat.them.userId);
                if (recipient !== undefined) {
                    return permittedMessagesInDirectChat(
                        recipient,
                        mode,
                        this.config.proposalBotCanister,
                    );
                }
            } else {
                return permittedMessagesInGroup(this._liveState.user, chat, mode);
            }
        }

        return new Map();
    }

    canDeleteOtherUsersMessages(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canDeleteOtherUsersMessages);
    }

    canStartVideoCalls(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, (chat) =>
            canStartVideoCalls(chat, this._liveState.userStore),
        );
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

    canPinMessages(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canPinMessages);
    }

    canReactToMessages(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canReactToMessages);
    }

    canMentionAllMembers(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canMentionAllMembers);
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
                return this.communityPredicate(id, (community) =>
                    canChangeCommunityRoles(community, currentRole, newRole),
                );
            default:
                return this.chatPredicate(id, (chat) => canChangeRoles(chat, currentRole, newRole));
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
                return this.communityPredicate(identifier, canUnblockCommunityUsers);
            default:
                return this.chatPredicate(identifier, canUnblockUsers);
        }
    }

    canRemoveMembers(id: ChatIdentifier | CommunityIdentifier): boolean {
        switch (id.kind) {
            case "community":
                return this.communityPredicate(id, canRemoveCommunityMembers);
            default:
                return this.chatPredicate(id, canRemoveMembers);
        }
    }

    canEditGroupDetails(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canEditGroupDetails);
    }

    canImportToCommunity(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canImportToCommunity);
    }

    canChangePermissions(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canChangePermissions);
    }

    canInviteUsers(id: ChatIdentifier | CommunityIdentifier): boolean {
        switch (id.kind) {
            case "community":
                return this.communityPredicate(id, canInviteCommunityUsers);
            default:
                return this.chatPredicate(id, canInviteUsers);
        }
    }

    canAddMembers(id: ChatIdentifier): boolean {
        return this.chatPredicate(id, canAddMembers);
    }

    canCreateChannel(id: CommunityIdentifier): boolean {
        return this.canCreatePrivateChannel(id) || this.canCreatePublicChannel(id);
    }

    canCreatePublicChannel(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canCreatePublicChannel);
    }

    canCreatePrivateChannel(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canCreatePrivateChannel);
    }

    canManageUserGroups(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canManageUserGroups);
    }

    canChangeCommunityPermissions(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canChangeCommunityPermissions);
    }

    canEditCommunity(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canEditCommunity);
    }

    canDeleteCommunity(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canDeleteCommunity);
    }

    canDeleteGroup(chatId: MultiUserChatIdentifier): boolean {
        return this.multiUserChatPredicate(chatId, canDeleteGroup);
    }

    canChangeVisibility = canChangeVisibility;
    hasOwnerRights = hasOwnerRights;

    canConvertGroupToCommunity(chatId: GroupChatIdentifier): boolean {
        return this.multiUserChatPredicate(chatId, canConvertToCommunity);
    }

    canLeaveGroup(chatId: MultiUserChatIdentifier): boolean {
        return this.multiUserChatPredicate(chatId, canLeaveGroup);
    }

    isPreviewing(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.multiUserChatPredicate(chatId, isPreviewing);
    }

    isLapsed(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.multiUserChatPredicate(chatId, isLapsed);
    }

    isFrozen(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.multiUserChatPredicate(chatId, isFrozen);
    }

    isOpenChatBot(userId: string): boolean {
        return userId === OPENCHAT_BOT_USER_ID;
    }

    isVideoCallBot(userId: string): boolean {
        return userId === OPENCHAT_VIDEO_CALL_USER_ID;
    }

    isChatReadOnly(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this._liveState.suspendedUser || this.isPreviewing(chatId);
    }

    private chatPredicate(
        chatId: ChatIdentifier,
        predicate: (chat: ChatSummary) => boolean,
    ): boolean {
        const chat = this._liveState.allChats.get(chatId);
        return chat !== undefined && predicate(chat);
    }

    private communityPredicate(
        communityId: CommunityIdentifier,
        predicate: (community: CommunitySummary) => boolean,
    ): boolean {
        const community = this._liveState.communities.get(communityId);
        return community !== undefined && predicate(community);
    }

    private multiUserChatPredicate(
        chatId: MultiUserChatIdentifier,
        predicate: (chat: MultiUserChat) => boolean,
    ): boolean {
        const chat = this._liveState.chatSummaries.get(chatId);
        return (
            chat !== undefined &&
            (chat.kind === "group_chat" || chat.kind === "channel") &&
            predicate(chat)
        );
    }

    private createMessage = createMessage;
    private findMessageById = findMessageById;
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
        const userId = this._liveState.user.userId;

        localMessageUpdates.markPollVote(messageId, {
            answerIndex: answerIdx,
            type,
            userId,
        });

        const newAchievement = !this._liveState.globalState.achievements.has("voted_on_poll");

        return this.sendRequest({
            kind: "registerPollVote",
            chatId,
            messageIdx,
            answerIdx,
            voteType: type,
            threadRootMessageIndex,
            newAchievement,
        })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    deleteMessage(
        id: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        asPlatformModerator?: boolean,
    ): Promise<boolean> {
        const chat = this._liveState.chatSummaries.get(id);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        const userId = this._liveState.user.userId;
        localMessageUpdates.markDeleted(messageId, userId);
        undeletingMessagesStore.delete(messageId);

        const recipients = [...chatStateStore.getProp(id, "userIds")];

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
            localMessageUpdates.markUndeleted(messageId);
        }

        const newAchievement = !this._liveState.globalState.achievements.has("deleted_message");

        return this.sendRequest({
            kind: "deleteMessage",
            chatId: id,
            messageId,
            threadRootMessageIndex,
            asPlatformModerator,
            newAchievement,
        })
            .then((resp) => {
                const success = resp === "success";
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

    undeleteMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        msg: Message,
    ): Promise<boolean> {
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined || !msg.deleted) {
            return Promise.resolve(false);
        }

        undeletingMessagesStore.add(msg.messageId);

        return this.sendRequest({
            kind: "undeleteMessage",
            chatType: chat.kind,
            chatId,
            messageId: msg.messageId,
            threadRootMessageIndex,
        })
            .then((resp) => {
                const success = resp.kind === "success";
                if (success) {
                    localMessageUpdates.markUndeleted(msg.messageId, resp.message.content);
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
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        const result =
            chatId.kind === "group_chat" || chatId.kind === "channel"
                ? this.sendRequest({
                      kind: "getDeletedGroupMessage",
                      chatId,
                      messageId,
                      threadRootMessageIndex,
                  })
                : this.sendRequest({
                      kind: "getDeletedDirectMessage",
                      userId: chatId.userId,
                      messageId,
                  });

        return result
            .then((resp) => {
                const success = resp.kind === "success";
                if (success) {
                    localMessageUpdates.markContentRevealed(messageId, resp.content);
                }
                return success;
            })
            .catch(() => false);
    }

    revealBlockedMessage(messageId: bigint) {
        localMessageUpdates.markBlockedMessageRevealed(messageId);
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
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        localMessageUpdates.markReaction(messageId, {
            reaction,
            kind,
            userId,
        });

        function undoLocally() {
            localMessageUpdates.markReaction(messageId, {
                reaction,
                kind: kind === "add" ? "remove" : "add",
                userId,
            });
        }

        this.dispatchEvent(new ReactionSelected(messageId, kind));

        const newAchievement = !this._liveState.globalState.achievements.has("reacted_to_message");

        const result = (
            kind == "add"
                ? this.sendRequest({
                      kind: "addReaction",
                      chatId,
                      messageId,
                      reaction,
                      username,
                      displayName,
                      threadRootMessageIndex,
                      newAchievement,
                  })
                : this.sendRequest({
                      kind: "removeReaction",
                      chatId,
                      messageId,
                      reaction,
                      threadRootMessageIndex,
                  })
        )
            .then((resp) => {
                if (resp.kind !== "success") {
                    undoLocally();
                    return false;
                }
                return true;
            })
            .catch((_) => {
                undoLocally();
                return false;
            });

        this.sendRtcMessage([...this._liveState.currentChatUserIds], {
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

    private async loadThreadEventWindow(
        chat: ChatSummary,
        messageIndex: number,
        threadRootEvent: EventWrapper<Message>,
        initialLoad = false,
    ): Promise<number | undefined> {
        if (threadRootEvent.event.thread === undefined) return undefined;

        const chatId = chat.id;
        const threadRootMessageIndex = threadRootEvent.event.messageIndex;

        const eventsResponse: EventsResponse<ChatEvent> = await this.sendRequest({
            kind: "chatEventsWindow",
            eventIndexRange: [0, threadRootEvent.event.thread.latestEventIndex],
            chatId,
            messageIndex,
            threadRootMessageIndex: threadRootEvent.event.messageIndex,
            latestKnownUpdate: chat.lastUpdated,
        }).catch(() => "events_failed");

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return undefined;
        }

        this.clearThreadEvents();
        await this.handleThreadEventsResponse(chatId, threadRootMessageIndex, eventsResponse);

        this.dispatchEvent(
            new LoadedMessageWindow(
                { chatId, threadRootMessageIndex: threadRootEvent.event.messageIndex },
                messageIndex,
                initialLoad,
            ),
        );

        return messageIndex;
    }

    async loadEventWindow(
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootEvent?: EventWrapper<Message>,
        initialLoad = false,
    ): Promise<number | undefined> {
        const clientChat = this._liveState.chatSummaries.get(chatId);
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        if (clientChat === undefined || this.isPrivatePreview(clientChat)) {
            return Promise.resolve(undefined);
        }

        if (messageIndex >= 0) {
            if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
                return this.loadThreadEventWindow(
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
            const eventsResponse: EventsResponse<ChatEvent> = await this.sendRequest({
                kind: "chatEventsWindow",
                eventIndexRange: range,
                chatId,
                messageIndex,
                threadRootMessageIndex: undefined,
                latestKnownUpdate: serverChat?.lastUpdated,
            }).catch(() => "events_failed");

            if (eventsResponse === undefined || eventsResponse === "events_failed") {
                return undefined;
            }

            if (await this.handleEventsResponse(clientChat, eventsResponse, false)) {
                this.dispatchEvent(
                    new LoadedMessageWindow(
                        {
                            chatId: clientChat.id,
                            threadRootMessageIndex: threadRootEvent?.event.messageIndex,
                        },
                        messageIndex,
                        initialLoad,
                    ),
                );
            }

            return messageIndex;
        }
    }

    private async handleEventsResponse(
        chat: ChatSummary,
        resp: EventsResponse<ChatEvent>,
        keepCurrentEvents = true,
    ): Promise<boolean> {
        if (resp === "events_failed") return false;

        if (!keepCurrentEvents) {
            clearServerEvents(chat.id);
            chatStateStore.setProp(chat.id, "userGroupKeys", new Set<string>());
        }

        await this.updateUserStoreFromEvents(chat.id, resp.events);

        this.addServerEventsToStores(chat.id, resp.events, undefined, resp.expiredEventRanges);

        if (!this._liveState.offlineStore) {
            makeRtcConnections(
                this._liveState.user.userId,
                chat,
                resp.events,
                this._liveState.userStore,
                this.config.meteredApiKey,
            );
        }

        return true;
    }

    private async updateUserStoreFromCommunityState(id: CommunityIdentifier): Promise<void> {
        const allUserIds = new Set<string>();
        this.getTruncatedUserIdsFromMembers([
            ...communityStateStore.getProp(id, "members").values(),
        ]).forEach((m) => allUserIds.add(m.userId));
        communityStateStore.getProp(id, "blockedUsers").forEach((u) => allUserIds.add(u));
        communityStateStore.getProp(id, "invitedUsers").forEach((u) => allUserIds.add(u));
        communityStateStore.getProp(id, "referrals").forEach((u) => allUserIds.add(u));
        await this.getMissingUsers(allUserIds);
    }

    // We create add a limited subset of the members to the userstore for performance reasons.
    // We will already be adding users from events so it's not critical that we get all members
    // at this point
    private getTruncatedUserIdsFromMembers(members: Member[]): Member[] {
        const elevated = members.filter((m) => m.role !== "none" && m.role !== "member");
        const rest = members.slice(0, LARGE_GROUP_THRESHOLD);
        return [...elevated, ...rest];
    }

    private async updateUserStoreFromEvents(
        chatId: ChatIdentifier,
        events: EventWrapper<ChatEvent>[],
    ): Promise<void> {
        const userId = this._liveState.user.userId;
        const allUserIds = new Set<string>();
        this.getTruncatedUserIdsFromMembers(chatStateStore.getProp(chatId, "members")).forEach(
            (m) => allUserIds.add(m.userId),
        );
        chatStateStore.getProp(chatId, "blockedUsers").forEach((u) => allUserIds.add(u));
        chatStateStore.getProp(chatId, "invitedUsers").forEach((u) => allUserIds.add(u));
        for (const u of userIdsFromEvents(events)) {
            allUserIds.add(u);
        }

        chatStateStore.updateProp(chatId, "userIds", (userIds) => {
            allUserIds.forEach((u) => {
                if (u !== userId) {
                    userIds.add(u);
                }
            });
            return userIds;
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

    private blockCommunityUserLocally(id: CommunityIdentifier, userId: string): void {
        communityStateStore.updateProp(id, "blockedUsers", (b) => new Set([...b, userId]));
        communityStateStore.updateProp(id, "members", (ms) => {
            ms.delete(userId);
            return new Map(ms);
        });
    }

    private unblockCommunityUserLocally(
        id: CommunityIdentifier,
        userId: string,
        addToMembers: boolean,
    ): void {
        communityStateStore.updateProp(id, "blockedUsers", (b) => {
            return new Set([...b].filter((u) => u !== userId));
        });
        if (addToMembers) {
            communityStateStore.updateProp(id, "members", (ms) => {
                ms.set(userId, {
                    role: "member",
                    userId,
                    displayName: undefined,
                });
                return new Map(ms);
                return ms;
            });
        }
    }

    private blockUserLocally(chatId: ChatIdentifier, userId: string): void {
        chatStateStore.updateProp(chatId, "blockedUsers", (b) => new Set([...b, userId]));
        chatStateStore.updateProp(chatId, "members", (p) => p.filter((p) => p.userId !== userId));
    }

    private unblockUserLocally(
        chatId: ChatIdentifier,
        userId: string,
        addToMembers: boolean,
    ): void {
        chatStateStore.updateProp(chatId, "blockedUsers", (b) => {
            return new Set([...b].filter((u) => u !== userId));
        });
        if (addToMembers) {
            chatStateStore.updateProp(chatId, "members", (p) => [
                ...p,
                {
                    role: "member",
                    userId,
                    displayName: undefined,
                },
            ]);
        }
    }

    blockCommunityUser(id: CommunityIdentifier, userId: string): Promise<boolean> {
        this.blockCommunityUserLocally(id, userId);
        return this.sendRequest({ kind: "blockCommunityUser", id, userId })
            .then((resp) => {
                console.log("blockUser result", resp);
                if (resp.kind !== "success") {
                    this.unblockCommunityUserLocally(id, userId, true);
                    return false;
                }
                return true;
            })
            .catch(() => {
                this.unblockCommunityUserLocally(id, userId, true);
                return false;
            });
    }

    unblockCommunityUser(id: CommunityIdentifier, userId: string): Promise<boolean> {
        this.unblockCommunityUserLocally(id, userId, false);
        return this.sendRequest({ kind: "unblockCommunityUser", id, userId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    this.blockCommunityUserLocally(id, userId);
                    return false;
                }
                return true;
            })
            .catch(() => {
                this.blockCommunityUserLocally(id, userId);
                return false;
            });
    }

    blockUser(chatId: MultiUserChatIdentifier, userId: string): Promise<boolean> {
        this.blockUserLocally(chatId, userId);
        return this.sendRequest({ kind: "blockUserFromGroupChat", chatId, userId })
            .then((resp) => {
                console.log("blockUser result", resp);
                if (resp !== "success") {
                    this.unblockUserLocally(chatId, userId, true);
                    return false;
                }
                return true;
            })
            .catch(() => {
                this.unblockUserLocally(chatId, userId, true);
                return false;
            });
    }

    unblockUser(chatId: MultiUserChatIdentifier, userId: string): Promise<boolean> {
        this.unblockUserLocally(chatId, userId, false);
        return this.sendRequest({ kind: "unblockUserFromGroupChat", chatId, userId })
            .then((resp) => {
                if (resp !== "success") {
                    this.blockUserLocally(chatId, userId);
                    return false;
                }
                return true;
            })
            .catch(() => {
                this.blockUserLocally(chatId, userId);
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
    enableAllProposalFilters = enableAllProposalFilters;
    disableAllProposalFilters = disableAllProposalFilters;
    toggleProposalFilter = toggleProposalFilter;
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
        if (!this._liveState.userStore.has(chatId.userId)) {
            const user = await this.getUser(chatId.userId);
            if (user === undefined) {
                return false;
            }
        }
        createDirectChat(chatId);
        return true;
    }

    private isPrivatePreview(chat: ChatSummary): boolean {
        return chat.kind === "group_chat" && chat.membership === undefined && !chat.public;
    }

    setSelectedChat(
        chatId: ChatIdentifier,
        messageIndex?: number,
        threadMessageIndex?: number,
    ): void {
        const clientChat = this._liveState.chatSummaries.get(chatId);
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        if (clientChat === undefined) {
            return;
        }

        setSelectedChat(this, clientChat, serverChat, messageIndex, threadMessageIndex);

        this._userLookupForMentions = undefined;

        const { selectedChat, focusMessageIndex } = this._liveState;
        if (selectedChat !== undefined) {
            if (focusMessageIndex !== undefined) {
                this.loadEventWindow(chatId, focusMessageIndex, undefined, true).then(() => {
                    if (serverChat !== undefined) {
                        this.loadChatDetails(serverChat);
                    }
                });
            } else {
                this.loadPreviousMessages(chatId, undefined, true).then(() => {
                    if (serverChat !== undefined) {
                        this.loadChatDetails(serverChat);
                    }
                });
            }
            if (selectedChat.kind === "direct_chat") {
                const them = this._liveState.userStore.get(selectedChat.them.userId);
                // Refresh user details if they are more than 5 minutes out of date
                if (
                    them === undefined ||
                    Date.now() - Number(them.updated) > 5 * ONE_MINUTE_MILLIS
                ) {
                    this.getUser(selectedChat.them.userId);
                }
            }
        }
    }

    openThreadFromMessageIndex(_chatId: ChatIdentifier, messageIndex: number): void {
        const event = this._liveState.events.find(
            (ev) => ev.event.kind === "message" && ev.event.messageIndex === messageIndex,
        ) as EventWrapper<Message> | undefined;
        if (event !== undefined) {
            this.openThread(event, event.event.thread === undefined);
        }
    }

    openThread(threadRootEvent: EventWrapper<Message>, initiating: boolean): void {
        this.clearThreadEvents();
        selectedMessageContext.update((context) => {
            if (context) {
                return {
                    ...context,
                    threadRootMessageIndex: threadRootEvent.event.messageIndex,
                };
            }
            return context;
        });

        const context = this._liveState.selectedMessageContext;
        if (context) {
            if (!initiating) {
                if (this._liveState.focusThreadMessageIndex !== undefined) {
                    this.loadEventWindow(
                        context.chatId,
                        this._liveState.focusThreadMessageIndex,
                        threadRootEvent,
                        true,
                    );
                } else {
                    this.loadPreviousMessages(context.chatId, threadRootEvent, true);
                }
            }
            this.dispatchEvent(new ThreadSelected(threadRootEvent, initiating));
        }
    }

    closeThread(): void {
        selectedMessageContext.update((context) => {
            if (context) {
                return { chatId: context.chatId };
            }
        });
        this.dispatchEvent(new ThreadClosed());
    }

    clearThreadEvents(): void {
        threadServerEventsStore.set([]);
    }

    async loadThreadMessages(
        chatId: ChatIdentifier,
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number,
        clearEvents: boolean,
        initialLoad = false,
    ): Promise<void> {
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return Promise.resolve();
        }

        const context = { chatId, threadRootMessageIndex };

        if (!messageContextsEqual(context, this._liveState.selectedMessageContext)) return;

        const eventsResponse: EventsResponse<ChatEvent> = await this.sendRequest({
            kind: "chatEvents",
            chatType: chat.kind,
            chatId,
            eventIndexRange: range,
            startIndex,
            ascending,
            threadRootMessageIndex,
            latestKnownUpdate: chat.lastUpdated,
        }).catch(() => "events_failed");

        if (!messageContextsEqual(context, this._liveState.selectedMessageContext)) {
            // the selected thread has changed while we were loading the messages
            return;
        }

        if (eventsResponse !== undefined && eventsResponse !== "events_failed") {
            if (clearEvents) {
                threadServerEventsStore.set([]);
            }
            await this.handleThreadEventsResponse(chatId, threadRootMessageIndex, eventsResponse);

            if (!this._liveState.offlineStore) {
                makeRtcConnections(
                    this._liveState.user.userId,
                    chat,
                    this._liveState.threadEvents,
                    this._liveState.userStore,
                    this.config.meteredApiKey,
                );
            }

            if (ascending) {
                this.dispatchEvent(new LoadedNewMessages({ chatId, threadRootMessageIndex }));
            } else {
                this.dispatchEvent(
                    new LoadedPreviousMessages({ chatId, threadRootMessageIndex }, initialLoad),
                );
            }
        }
    }

    private async handleThreadEventsResponse(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        resp: EventsResponse<ChatEvent>,
    ): Promise<EventWrapper<ChatEvent>[]> {
        if (resp === "events_failed") return [];

        const context = { chatId, threadRootMessageIndex };

        // make sure that the message context (chatId or threadRootMessageIndex) has not changed
        if (!messageContextsEqual(context, this._liveState.selectedMessageContext)) return [];

        await this.updateUserStoreFromEvents(chatId, resp.events);

        this.addServerEventsToStores(chatId, resp.events, threadRootMessageIndex, []);

        for (const event of resp.events) {
            if (event.event.kind === "message") {
                unconfirmed.delete(context, event.event.messageId);
            }
        }
        return resp.events;
    }

    removeChat(chatId: ChatIdentifier): void {
        if (this._liveState.uninitializedDirectChats.has(chatId)) {
            removeUninitializedDirectChat(chatId);
        }
        if (this._liveState.groupPreviews.has(chatId)) {
            removeGroupPreview(chatId);
        }
        if (this._liveState.chatSummaries.has(chatId)) {
            localChatSummaryUpdates.markRemoved(chatId);
        }
    }

    removeCommunity(id: CommunityIdentifier): void {
        this.removeCommunityLocally(id);
    }

    clearSelectedChat = clearSelectedChat;
    diffGroupPermissions = diffGroupPermissions;

    messageContentFromFile(file: File): Promise<AttachmentContent> {
        return messageContentFromFile(file, this._liveState.isDiamond);
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
        return this._liveState.threadEvents.length === 0
            ? undefined
            : this._liveState.threadEvents[0].index;
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
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        if (serverChat === undefined || this.isPrivatePreview(serverChat)) {
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
                false,
                initialLoad,
            );
        }

        const criteria = this.previousMessagesCriteria(serverChat);

        const eventsResponse = criteria
            ? await this.loadEvents(serverChat, criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return;
        }

        if (await this.handleEventsResponse(serverChat, eventsResponse)) {
            this.dispatchEvent(
                new LoadedPreviousMessages(
                    { chatId, threadRootMessageIndex: threadRootEvent?.event.messageIndex },
                    initialLoad,
                ),
            );
        }
    }

    private loadEvents(
        serverChat: ChatSummary,
        startIndex: number,
        ascending: boolean,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.sendRequest({
            kind: "chatEvents",
            chatType: serverChat.kind,
            chatId: serverChat.id,
            eventIndexRange: indexRangeForChat(serverChat),
            startIndex,
            ascending,
            threadRootMessageIndex: undefined,
            latestKnownUpdate: serverChat.lastUpdated,
        }).catch(() => "events_failed");
    }

    private previousMessagesCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
        if (serverChat.latestEventIndex < 0) {
            return undefined;
        }

        const minLoadedEventIndex = this.earliestLoadedIndex(serverChat.id);
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

    private earliestLoadedIndex(chatId: ChatIdentifier): number | undefined {
        const confirmedLoaded = confirmedEventIndexesLoaded(chatId);
        return confirmedLoaded.length > 0 ? confirmedLoaded.index(0) : undefined;
    }

    async loadNewMessages(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): Promise<boolean> {
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        if (serverChat === undefined || this.isPrivatePreview(serverChat)) {
            return Promise.resolve(false);
        }

        if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
            const thread = threadRootEvent.event.thread;
            const [index, ascending] = this.newThreadMessageCriteria(thread);
            return this.loadThreadMessages(
                chatId,
                [0, thread.latestEventIndex],
                index,
                ascending,
                threadRootEvent.event.messageIndex,
                false,
            ).then(() => false);
        }

        const criteria = this.newMessageCriteria(serverChat);

        const eventsResponse = criteria
            ? await this.loadEvents(serverChat, criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return false;
        }

        await this.handleEventsResponse(serverChat, eventsResponse);
        // We may have loaded messages which are more recent than what the chat summary thinks is the latest message,
        // if so, we update the chat summary to show the correct latest message.
        const latestMessage = findLast(eventsResponse.events, (e) => e.event.kind === "message");
        const newLatestMessage =
            latestMessage !== undefined && latestMessage.index > serverChat.latestEventIndex;

        if (newLatestMessage) {
            updateSummaryWithConfirmedMessage(
                serverChat.id,
                latestMessage as EventWrapper<Message>,
            );
        }

        this.dispatchEvent(
            new LoadedNewMessages({
                chatId,
                threadRootMessageIndex: threadRootEvent?.event.messageIndex,
            }),
        );
        return newLatestMessage;
    }

    morePreviousMessagesAvailable(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): boolean {
        if (threadRootEvent !== undefined) {
            const earliestIndex = this.earliestLoadedThreadIndex();
            return earliestIndex === undefined || earliestIndex > 0;
        }

        const chat = this._liveState.chatSummaries.get(chatId);

        return (
            chat !== undefined &&
            chat.latestEventIndex >= 0 &&
            (this.earliestLoadedIndex(chatId) ?? Number.MAX_VALUE) >
                this.earliestAvailableEventIndex(chat)
        );
    }

    moreNewMessagesAvailable(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>,
    ): boolean {
        if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
            return (
                (this.confirmedThreadUpToEventIndex() ?? -1) <
                threadRootEvent.event.thread.latestEventIndex
            );
        }
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        return (
            serverChat !== undefined &&
            (this.confirmedUpToEventIndex(serverChat.id) ?? -1) < serverChat.latestEventIndex
        );
    }

    private async loadCommunityDetails(community: CommunitySummary): Promise<void> {
        const resp: CommunityDetailsResponse = await this.sendRequest({
            kind: "getCommunityDetails",
            id: community.id,
            communityLastUpdated: community.lastUpdated,
        }).catch(() => "failure");
        if (resp !== "failure") {
            communityStateStore.setProp(
                community.id,
                "members",
                new Map(resp.members.map((m) => [m.userId, m])),
            );
            communityStateStore.setProp(community.id, "blockedUsers", resp.blockedUsers);
            communityStateStore.setProp(community.id, "invitedUsers", resp.invitedUsers);
            communityStateStore.setProp(community.id, "rules", resp.rules);
            communityStateStore.setProp(community.id, "userGroups", resp.userGroups);
            communityStateStore.setProp(community.id, "referrals", resp.referrals);
        }
        await this.updateUserStoreFromCommunityState(community.id);
    }

    private async loadChatDetails(serverChat: ChatSummary): Promise<void> {
        // currently this is only meaningful for group chats, but we'll set it up generically just in case
        if (serverChat.kind === "group_chat" || serverChat.kind === "channel") {
            const resp: GroupChatDetailsResponse = await this.sendRequest({
                kind: "getGroupDetails",
                chatId: serverChat.id,
                chatLastUpdated: serverChat.lastUpdated,
            }).catch(() => "failure");
            if (resp !== "failure") {
                chatStateStore.setProp(serverChat.id, "members", resp.members);
                chatStateStore.setProp(
                    serverChat.id,
                    "membersMap",
                    resp.members.reduce((all, m) => {
                        all.set(m.userId, m);
                        return all;
                    }, new Map()),
                );
                chatStateStore.setProp(serverChat.id, "blockedUsers", resp.blockedUsers);
                chatStateStore.setProp(serverChat.id, "invitedUsers", resp.invitedUsers);
                chatStateStore.setProp(serverChat.id, "pinnedMessages", resp.pinnedMessages);
                chatStateStore.setProp(serverChat.id, "rules", resp.rules);
            }
            await this.updateUserStoreFromEvents(serverChat.id, []);
        }
    }

    achievementLogo(id: number): string {
        return `${this.config.achievementUrlPath.replace(
            "{canisterId}",
            this.config.userIndexCanister,
        )}/achievement_logo/${id}`;
    }

    // this is unavoidably duplicated from the agent
    private rehydrateDataContent<T extends DataContent>(
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

    private async refreshUpdatedEvents(
        serverChat: ChatSummary,
        updatedEvents: UpdatedEvent[],
    ): Promise<void> {
        const confirmedLoaded = confirmedEventIndexesLoaded(serverChat.id);
        const confirmedThreadLoaded = this._liveState.confirmedThreadEventIndexesLoaded;
        const selectedThreadRootMessageIndex =
            this._liveState.selectedMessageContext?.threadRootMessageIndex;
        const selectedChatId = this._liveState.selectedChatId;

        // Partition the updated events into those that belong to the currently selected thread and those that don't
        const [currentChatEvents, currentThreadEvents] = updatedEvents.reduce(
            ([chat, thread], e) => {
                if (e.threadRootMessageIndex !== undefined) {
                    if (
                        e.threadRootMessageIndex === selectedThreadRootMessageIndex &&
                        chatIdentifiersEqual(serverChat.id, selectedChatId) &&
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
                      ? this.sendRequest({
                            kind: "chatEventsByEventIndex",
                            chatId: serverChat.them,
                            eventIndexes: currentChatEvents,
                            threadRootMessageIndex: undefined,
                            latestKnownUpdate: serverChat.lastUpdated,
                        }).catch(() => "events_failed" as EventsResponse<ChatEvent>)
                      : this.sendRequest({
                            kind: "chatEventsByEventIndex",
                            chatId: serverChat.id,
                            eventIndexes: currentChatEvents,
                            threadRootMessageIndex: undefined,
                            latestKnownUpdate: serverChat.lastUpdated,
                        }).catch(() => "events_failed" as EventsResponse<ChatEvent>)
                  ).then((resp) => {
                      if (resp !== "events_failed") {
                          resp.events.forEach((e) => {
                              if (
                                  e.event.kind === "message" &&
                                  e.event.content.kind === "video_call_content"
                              ) {
                                  this.dispatchEvent(
                                      new VideoCallMessageUpdated(serverChat.id, e.event.messageId),
                                  );
                              }
                          });
                      }
                      return this.handleEventsResponse(serverChat, resp);
                  });

        const threadEventPromise =
            currentThreadEvents.length === 0
                ? Promise.resolve()
                : this.sendRequest({
                      kind: "chatEventsByEventIndex",
                      chatId: serverChat.id,
                      eventIndexes: currentThreadEvents,
                      threadRootMessageIndex: selectedThreadRootMessageIndex,
                      latestKnownUpdate: serverChat.lastUpdated,
                  })
                      .catch(() => "events_failed" as EventsResponse<ChatEvent>)
                      .then((resp) =>
                          this.handleThreadEventsResponse(
                              serverChat.id,
                              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                              selectedThreadRootMessageIndex!,
                              resp,
                          ),
                      );

        await Promise.all([chatEventsPromise, threadEventPromise]);
        return;
    }

    private newThreadMessageCriteria(thread: ThreadSummary): [number, boolean] {
        const loadedUpTo = this.confirmedThreadUpToEventIndex();

        if (loadedUpTo === undefined) {
            return [thread.latestEventIndex, false];
        }

        return [loadedUpTo + 1, true];
    }

    private newMessageCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
        if (serverChat.latestEventIndex < 0) {
            return undefined;
        }

        const loadedUpTo = this.confirmedUpToEventIndex(serverChat.id);

        if (loadedUpTo === undefined) {
            return [serverChat.latestEventIndex, false];
        }

        return loadedUpTo < serverChat.latestEventIndex ? [loadedUpTo + 1, true] : undefined;
    }

    private confirmedUpToEventIndex(chatId: ChatIdentifier): number | undefined {
        const ranges = confirmedEventIndexesLoaded(chatId).subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return undefined;
    }

    private confirmedThreadUpToEventIndex(): number | undefined {
        const ranges = get(confirmedThreadEventIndexesLoadedStore).subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return undefined;
    }

    messageIsReadByThem(chatId: ChatIdentifier, messageIndex: number): boolean {
        const chat = this._liveState.chatSummaries.get(chatId);
        return chat !== undefined && messageIsReadByThem(chat, messageIndex);
    }

    private addPinnedMessage(chatId: ChatIdentifier, messageIndex: number): void {
        chatStateStore.updateProp(chatId, "pinnedMessages", (s) => {
            return new Set([...s, messageIndex]);
        });
    }

    private removePinnedMessage(chatId: ChatIdentifier, messageIndex: number): void {
        chatStateStore.updateProp(chatId, "pinnedMessages", (s) => {
            return new Set([...s].filter((idx) => idx !== messageIndex));
        });
    }

    unpinMessage(chatId: MultiUserChatIdentifier, messageIndex: number): Promise<boolean> {
        this.removePinnedMessage(chatId, messageIndex);
        return this.sendRequest({ kind: "unpinMessage", chatId, messageIndex })
            .then((resp) => {
                if (resp !== "success") {
                    this.addPinnedMessage(chatId, messageIndex);
                    return false;
                }
                return true;
            })
            .catch(() => {
                this.addPinnedMessage(chatId, messageIndex);
                return false;
            });
    }

    pinMessage(chatId: MultiUserChatIdentifier, messageIndex: number): Promise<boolean> {
        this.addPinnedMessage(chatId, messageIndex);
        return this.sendRequest({
            kind: "pinMessage",
            chatId,
            messageIndex,
        })
            .then((resp) => {
                if (resp.kind !== "success" && resp.kind !== "no_change") {
                    this.removePinnedMessage(chatId, messageIndex);
                    return false;
                }
                if (resp.kind === "success") {
                    this.markPinnedMessagesRead(chatId, resp.timestamp);
                }
                return true;
            })
            .catch(() => {
                this.removePinnedMessage(chatId, messageIndex);
                return false;
            });
    }

    private removeMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        userId: string,
        threadRootMessageIndex: number | undefined,
    ): void {
        if (userId === this._liveState.user.userId) {
            const userIds = chatStateStore.getProp(chatId, "userIds");
            rtcConnectionsManager.sendMessage([...userIds], {
                kind: "remote_user_removed_message",
                id: chatId,
                messageId: messageId,
                userId: userId,
                threadRootMessageIndex,
            });
        }
        const context = { chatId, threadRootMessageIndex };
        unconfirmed.delete(context, messageId);
        messagesRead.removeUnconfirmedMessage(context, messageId);
    }

    toggleProposalFilterMessageExpansion = toggleProposalFilterMessageExpansion;
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

    private onSendMessageSuccess(
        chatId: ChatIdentifier,
        resp: SendMessageSuccess | TransferSuccess,
        msg: Message,
        threadRootMessageIndex: number | undefined,
    ) {
        const event = mergeSendMessageResponse(msg, resp);
        this.addServerEventsToStores(chatId, [event], threadRootMessageIndex, []);
        if (threadRootMessageIndex === undefined) {
            updateSummaryWithConfirmedMessage(chatId, event);
        }
    }

    private addServerEventsToStores(
        chatId: ChatIdentifier,
        newEvents: EventWrapper<ChatEvent>[],
        threadRootMessageIndex: number | undefined,
        expiredEventRanges: ExpiredEventsRange[],
    ): void {
        if (newEvents.length === 0 && expiredEventRanges.length === 0) {
            return;
        }

        if (
            threadRootMessageIndex === undefined &&
            !isContiguous(chatId, newEvents, expiredEventRanges)
        ) {
            return;
        }

        if (threadRootMessageIndex !== undefined && !isContiguousInThread(newEvents)) {
            return;
        }

        const context = { chatId, threadRootMessageIndex };
        const myUserId = this._liveState.user.userId;
        const now = BigInt(Date.now());
        const recentlyActiveCutOff = now - BigInt(12 * ONE_HOUR);

        // To ensure we keep the chat summary up to date, if these events are in the main event list, check if there is
        // now a new latest message and if so, mark it as a local chat summary update.
        let latestMessageIndex =
            threadRootMessageIndex === undefined
                ? this._liveState.serverChatSummaries.get(chatId)?.latestMessageIndex ?? -1
                : undefined;
        let newLatestMessage: EventWrapper<Message> | undefined = undefined;

        for (const event of newEvents) {
            if (event.event.kind === "message") {
                const { messageIndex, messageId } = event.event;
                if (failedMessagesStore.delete(context, messageId)) {
                    this.sendRequest({
                        kind: "deleteFailedMessage",
                        chatId,
                        messageId,
                        threadRootMessageIndex,
                    });
                }
                if (unconfirmed.delete(context, messageId)) {
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
                    this._recentlyActiveUsersTracker.track(userId, event.timestamp);
                }
            }
        }

        if (threadRootMessageIndex === undefined) {
            chatStateStore.updateProp(chatId, "serverEvents", (events) =>
                mergeServerEvents(events, newEvents, context),
            );
            if (newLatestMessage !== undefined) {
                localChatSummaryUpdates.markUpdated(chatId, { latestMessage: newLatestMessage });
            }
            const selectedThreadRootMessageIndex = this._liveState.selectedThreadRootMessageIndex;
            if (selectedThreadRootMessageIndex !== undefined) {
                const threadRootEvent = newEvents.find(
                    (e) =>
                        e.event.kind === "message" &&
                        e.event.messageIndex === selectedThreadRootMessageIndex,
                );
                if (threadRootEvent !== undefined) {
                    this.dispatchEvent(
                        new ChatUpdated({
                            chatId,
                            threadRootMessageIndex: selectedThreadRootMessageIndex,
                        }),
                    );
                }
            }
        } else if (messageContextsEqual(context, this._liveState.selectedMessageContext)) {
            threadServerEventsStore.update((events) =>
                mergeServerEvents(events, newEvents, context),
            );
        }

        if (expiredEventRanges.length > 0) {
            chatStateStore.updateProp(chatId, "expiredEventRanges", (ranges) => {
                const merged = new DRange();
                merged.add(ranges);
                expiredEventRanges.forEach((r) => merged.add(r.start, r.end));
                return merged;
            });
        }
    }

    private async sendMessageWebRtc(
        clientChat: ChatSummary,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
    ): Promise<void> {
        rtcConnectionsManager.sendMessage([...chatStateStore.getProp(clientChat.id, "userIds")], {
            kind: "remote_user_sent_message",
            id: clientChat.id,
            messageEvent: serialiseMessageForRtc(messageEvent),
            userId: this._liveState.user.userId,
            threadRootMessageIndex,
        });
    }

    deleteFailedMessage(
        chatId: ChatIdentifier,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        failedMessagesStore.delete({ chatId, threadRootMessageIndex }, event.event.messageId);
        return this.sendRequest({
            kind: "deleteFailedMessage",
            chatId,
            messageId: event.event.messageId,
            threadRootMessageIndex,
        });
    }

    async retrySendMessage(
        messageContext: MessageContext,
        event: EventWrapper<Message>,
    ): Promise<void> {
        const { chatId, threadRootMessageIndex } = messageContext;
        const chat = this._liveState.chatSummaries.get(chatId);
        if (chat === undefined) {
            return;
        }

        const currentEvents = this.eventsForMessageContext(messageContext);
        const [nextEventIndex, nextMessageIndex] =
            threadRootMessageIndex !== undefined
                ? nextEventAndMessageIndexesForThread(currentEvents)
                : nextEventAndMessageIndexes();

        // remove the *original* event from the failed store
        await this.deleteFailedMessage(chatId, event, threadRootMessageIndex);

        // regenerate the indexes for the retry message
        const retryEvent = {
            ...event,
            index: nextEventIndex,
            timestamp: BigInt(Date.now()),
            event: {
                ...event.event,
                messageIndex: nextMessageIndex,
            },
        };

        // add the *new* event to unconfirmed
        unconfirmed.add(messageContext, retryEvent);

        // TODO - what about mentions?
        this.sendMessageCommon(chat, messageContext, retryEvent, [], true);
    }

    private async sendMessageCommon(
        chat: ChatSummary,
        messageContext: MessageContext,
        eventWrapper: EventWrapper<Message>,
        mentioned: User[] = [],
        retrying: boolean,
    ): Promise<SendMessageResponse> {
        const { chatId, threadRootMessageIndex } = messageContext;

        let acceptedRules: AcceptedRules | undefined = undefined;
        if (this.rulesNeedAccepting()) {
            acceptedRules = await this.promptForRuleAcceptance();
            if (acceptedRules === undefined) {
                return CommonResponses.failure();
            }
        }

        let pin: string | undefined = undefined;

        if (this._liveState.pinNumberRequired && isTransfer(eventWrapper.event.content)) {
            pin = await this.promptForCurrentPin("pinNumber.enterPinInfo");
        }

        if (this.throttleSendMessage()) {
            return Promise.resolve({ kind: "message_throttled" });
        }

        if (!retrying) {
            this.postSendMessage(chat, eventWrapper, threadRootMessageIndex);
        }

        const canRetry = canRetryMessage(eventWrapper.event.content);

        const messageFilterFailed = doesMessageFailFilter(
            eventWrapper.event,
            get(messageFiltersStore),
        );

        const newAchievement = this.isNewSendMessageAchievement(messageContext, eventWrapper.event);
        const isCryptoMessage = eventWrapper.event.content.kind === "crypto_content";

        return new Promise((resolve) => {
            this.sendStreamRequest(
                {
                    kind: "sendMessage",
                    chatType: chat.kind,
                    messageContext,
                    user: this._liveState.user,
                    mentioned,
                    event: eventWrapper,
                    acceptedRules,
                    messageFilterFailed,
                    pin,
                    newAchievement,
                },
                undefined,
                isCryptoMessage ? 2 * DEFAULT_WORKER_TIMEOUT : undefined,
            )
                .subscribe((response) => {
                    if (response === "accepted") {
                        unconfirmed.markAccepted(messageContext, eventWrapper.event.messageId);
                        return;
                    }
                    const [resp, msg] = response;
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        this.onSendMessageSuccess(chatId, resp, msg, threadRootMessageIndex);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            this.refreshAccountBalance(msg.content.transfer.ledger);
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
                        if (msg.repliesTo !== undefined) {
                            // double counting here which I think is OK since we are limited to string events
                            trackEvent("replied_to_message");
                        }

                        if (acceptedRules?.chat !== undefined) {
                            this.markChatRulesAcceptedLocally(true);
                        }
                        if (acceptedRules?.community !== undefined) {
                            this.markCommunityRulesAcceptedLocally(true);
                        }
                    } else {
                        if (resp.kind == "rules_not_accepted") {
                            this.markChatRulesAcceptedLocally(false);
                        } else if (resp.kind == "community_rules_not_accepted") {
                            this.markCommunityRulesAcceptedLocally(false);
                        } else if (
                            resp.kind === "pin_incorrect" ||
                            resp.kind === "pin_required" ||
                            resp.kind === "too_main_failed_pin_attempts"
                        ) {
                            pinNumberFailureStore.set(resp as PinNumberFailures);
                        }

                        this.onSendMessageFailure(
                            chatId,
                            msg.messageId,
                            threadRootMessageIndex,
                            eventWrapper,
                            canRetry,
                            resp,
                        );
                    }

                    resolve(resp);
                })
                .catch(() => {
                    this.onSendMessageFailure(
                        chatId,
                        eventWrapper.event.messageId,
                        threadRootMessageIndex,
                        eventWrapper,
                        canRetry,
                        undefined,
                    );

                    return resolve(CommonResponses.failure());
                });
        });
    }

    private isNewSendMessageAchievement(
        message_context: MessageContext,
        message: Message,
    ): boolean {
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
            if (!this._liveState.globalState.achievements.has(a as Achievement)) {
                return true;
            }
        }

        return false;
    }

    private rulesNeedAccepting(): boolean {
        const chatRules = this._liveState.currentChatRules;
        const chat = this._liveState.selectedChat;
        if (chat === undefined || chatRules === undefined) {
            return false;
        }

        const communityRules = this._liveState.currentCommunityRules;
        const community = this._liveState.selectedCommunity;

        console.debug(
            "RULES: rulesNeedAccepting",
            chatRules.enabled,
            chat.membership?.rulesAccepted,
            communityRules?.enabled,
            community?.membership?.rulesAccepted,
        );

        return (
            (chatRules.enabled && !(chat.membership?.rulesAccepted ?? false)) ||
            ((communityRules?.enabled ?? true) && !(community?.membership?.rulesAccepted ?? false))
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

    private markChatRulesAcceptedLocally(rulesAccepted: boolean) {
        const selectedChatId = this._liveState.selectedChatId;
        if (selectedChatId !== undefined) {
            localChatSummaryUpdates.markUpdated(selectedChatId, { rulesAccepted });
        }
    }

    private markCommunityRulesAcceptedLocally(rulesAccepted: boolean) {
        const selectedCommunityId = this._liveState.selectedCommunity?.id;
        if (selectedCommunityId !== undefined) {
            localCommunitySummaryUpdates.updateRulesAccepted(selectedCommunityId, rulesAccepted);
        }
    }

    private eventsForMessageContext({
        threadRootMessageIndex,
    }: MessageContext): EventWrapper<ChatEvent>[] {
        if (threadRootMessageIndex === undefined) return this._liveState.events;
        return this._liveState.threadEvents;
    }

    eventExpiry(chat: ChatSummary, timestamp: number): number | undefined {
        if (chat.kind === "group_chat" || chat.kind === "channel") {
            if (chat.eventsTTL !== undefined) {
                return timestamp + Number(chat.eventsTTL);
            }
        }
        return undefined;
    }

    async sendMessageWithContent(
        messageContext: MessageContext,
        content: MessageContent,
        blockLevelMarkdown: boolean,
        mentioned: User[] = [],
        forwarded: boolean = false,
    ): Promise<SendMessageResponse> {
        const { chatId, threadRootMessageIndex } = messageContext;
        const chat = this._liveState.chatSummaries.get(chatId);
        if (chat === undefined) {
            return Promise.resolve(CommonResponses.failure());
        }

        const draftMessage = this._liveState.draftMessages.get(messageContext);
        const currentEvents = this.eventsForMessageContext(messageContext);
        const [nextEventIndex, nextMessageIndex] =
            threadRootMessageIndex !== undefined
                ? nextEventAndMessageIndexesForThread(currentEvents)
                : nextEventAndMessageIndexes();

        const msg = this.createMessage(
            this._liveState.user.userId,
            nextMessageIndex,
            content,
            blockLevelMarkdown,
            draftMessage?.replyingTo,
            forwarded,
        );
        const timestamp = Date.now();
        const event = {
            event: msg,
            index: nextEventIndex,
            timestamp: BigInt(timestamp),
            expiresAt: threadRootMessageIndex ? undefined : this.eventExpiry(chat, timestamp),
        };

        return this.sendMessageCommon(chat, messageContext, event, mentioned, false);
    }

    private throttleSendMessage(): boolean {
        return shouldThrottle(this._liveState.isDiamond);
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
            this.getMessageContent(textContent, attachment),
            blockLevelMarkdown,
            mentioned,
            false,
        );
    }

    private getMessageContent(
        text: string | undefined,
        attachment: AttachmentContent | undefined,
    ): MessageContent {
        return attachment
            ? { ...attachment, caption: text }
            : ({
                  kind: "text_content",
                  text: text ?? "",
              } as MessageContent);
    }

    private onSendMessageFailure(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        event: EventWrapper<Message>,
        canRetry: boolean,
        response?: SendMessageResponse,
    ) {
        this.removeMessage(chatId, messageId, this._liveState.user.userId, threadRootMessageIndex);

        if (canRetry) {
            failedMessagesStore.add({ chatId, threadRootMessageIndex }, event);
        }

        if (response !== undefined) {
            console.error("Error sending message", JSON.stringify(response));
        }

        if (!isTransfer(event.event.content)) {
            this.dispatchEvent(new SendMessageFailed(!canRetry));
        }
    }

    private postSendMessage(
        chat: ChatSummary,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
    ) {
        const context = { chatId: chat.id, threadRootMessageIndex };
        this.dispatchEvent(new SendingMessage(context));

        // HACK - we need to defer this very slightly so that we can guarantee that we handle SendingMessage events
        // *before* the new message is added to the unconfirmed store. Is this nice? No it is not.
        window.setTimeout(() => {
            if (!isTransfer(messageEvent.event.content)) {
                unconfirmed.add(context, messageEvent);
            }

            failedMessagesStore.delete(context, messageEvent.event.messageId);

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

            draftMessagesStore.delete(context);

            if (!isTransfer(messageEvent.event.content)) {
                this.sendMessageWebRtc(chat, messageEvent, threadRootMessageIndex).then(() => {
                    this.dispatchEvent(new SentMessage(context, messageEvent));
                });
            }
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
            get(cryptoLookup),
        );
    }

    buildTransactionLink(
        formatter: MessageFormatter,
        transfer: CryptocurrencyTransfer,
    ): string | undefined {
        return buildTransactionLink(formatter, transfer, get(cryptoLookup));
    }

    buildTransactionUrl(transactionIndex: bigint, ledger: string): string | undefined {
        return buildTransactionUrlByIndex(transactionIndex, ledger, get(cryptoLookup));
    }

    getFirstUnreadMention(chat: ChatSummary): Mention | undefined {
        return messagesRead.getFirstUnreadMention(chat);
    }

    markAllRead(chat: ChatSummary) {
        messagesRead.markAllRead(chat);
    }

    markAllReadForCurrentScope() {
        this._liveState.chatSummariesList.forEach((chat) => messagesRead.markAllRead(chat));
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
        const chat = this._liveState.chatSummaries.get(messageContext.chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        if (textContent || attachment) {
            if (textContent && editingEvent.event.content.kind === "text_content") {
                const disabledLinks = extractDisabledLinks(editingEvent.event.content.text);
                textContent = disableLinksInText(textContent, disabledLinks);
            }

            const msg = {
                ...editingEvent.event,
                edited: true,
                content: this.getMessageContent(textContent ?? undefined, attachment),
            };
            localMessageUpdates.markContentEdited(msg.messageId, msg.content);
            draftMessagesStore.delete(messageContext);

            const updatedBlockLevelMarkdown =
                msg.blockLevelMarkdown === blockLevelMarkdown ? undefined : blockLevelMarkdown;
            if (updatedBlockLevelMarkdown !== undefined) {
                localMessageUpdates.setBlockLevelMarkdown(msg.messageId, updatedBlockLevelMarkdown);
            }

            const newAchievement = !this._liveState.globalState.achievements.has("edited_message");

            return this.sendRequest({
                kind: "editMessage",
                chatId: chat.id,
                msg,
                threadRootMessageIndex: messageContext.threadRootMessageIndex,
                blockLevelMarkdown: updatedBlockLevelMarkdown,
                newAchievement,
            })
                .then((resp) => {
                    if (resp !== "success") {
                        localMessageUpdates.revertEditedContent(msg.messageId);
                        return false;
                    }
                    return true;
                })
                .catch(() => {
                    localMessageUpdates.revertEditedContent(msg.messageId);
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
            content: this.getMessageContent(text, undefined),
        };
        localMessageUpdates.markLinkRemoved(msg.messageId, msg.content);

        return this.sendRequest({
            kind: "editMessage",
            chatId: messageContext.chatId,
            msg,
            threadRootMessageIndex: messageContext.threadRootMessageIndex,
            newAchievement: false,
        })
            .then((resp) => {
                if (resp !== "success") {
                    localMessageUpdates.revertLinkRemoved(msg.messageId);
                    return false;
                }
                return true;
            })
            .catch(() => {
                localMessageUpdates.revertEditedContent(msg.messageId);
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

        const serverChat = this._liveState.serverChatSummaries.get(chatId);
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
        this.sendRequest({
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
                if (resp === "events_failed") return resp;
                if (!this.isChatPrivate(serverChat)) return resp;

                const ev = resp.events.find((e) => e.index === eventIndex);
                if (ev !== undefined) {
                    if (
                        ev.event.kind === "message" &&
                        ev.event.content.kind === "video_call_content"
                    ) {
                        this.dispatchEvent(
                            RemoteVideoCallStartedEvent.create(
                                chatId,
                                this._liveState.user.userId,
                                ev.event as Message<VideoCallContent>,
                                ev.timestamp,
                            ),
                        );
                    }
                }
                return resp;
            })
            .catch(() => {
                console.warn("Failed to load event from notification");
            });
    }

    private handleConfirmedMessageSentByOther(
        serverChat: ChatSummary,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
    ) {
        const confirmedLoaded = confirmedEventIndexesLoaded(serverChat.id);

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

        this.sendRequest({
            kind: "rehydrateMessage",
            chatId: serverChat.id,
            message: messageEvent,
            threadRootMessageIndex,
            latestKnownUpdate: serverChat.lastUpdated,
        }).then((m) => {
            this.handleEventsResponse(serverChat, {
                events: [m],
                expiredEventRanges: [],
                expiredMessageRanges: [],
                latestEventIndex: undefined,
            });
        });
    }

    setFocusMessageIndex(chatId: ChatIdentifier, messageIndex: number | undefined): void {
        chatStateStore.setProp(chatId, "focusMessageIndex", messageIndex);
    }

    setFocusThreadMessageIndex(chatId: ChatIdentifier, messageIndex: number | undefined): void {
        chatStateStore.setProp(chatId, "focusThreadMessageIndex", messageIndex);
    }

    expandDeletedMessages(chatId: ChatIdentifier, messageIndexes: Set<number>): void {
        chatStateStore.updateProp(chatId, "expandedDeletedMessages", (data) => {
            return new Set([...messageIndexes, ...data]);
        });
    }

    remoteUserToggledReaction(
        events: EventWrapper<ChatEvent>[],
        message: RemoteUserToggledReaction,
    ): void {
        const matchingMessage = this.findMessageById(message.messageId, events);
        const kind = message.added ? "add" : "remove";

        if (matchingMessage !== undefined) {
            this.dispatchEvent(new ReactionSelected(message.messageId, kind));

            localMessageUpdates.markReaction(message.messageId, {
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
                return this._liveState.user.diamondStatus.kind !== "inactive";
            } else if (gate.kind === "lifetime_diamond_gate") {
                return this._liveState.user.diamondStatus.kind === "lifetime";
            } else if (gate.kind === "unique_person_gate") {
                return this._liveState.user.isUniquePerson;
            } else {
                return false;
            }
        }
    }

    gatePreprocessingRequired(gates: AccessGate[]): boolean {
        return this.getAllPreprocessLeafGates(gates).length > 0;
    }

    private getAllPreprocessLeafGates(gates: AccessGate[]): PreprocessedGate[] {
        return gates.reduce((all, g) => {
            if (isCompositeGate(g)) {
                all.push(...this.getAllPreprocessLeafGates(g.gates));
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
     * Note that we only return gates if we are not already a member.
     * We may also optionally exclude gates for things we are invited to in some scenariose
     */
    accessGatesForChat(
        chat: MultiUserChat,
        excludeInvited: boolean = false,
    ): AccessGateWithLevel[] {
        const gates: AccessGateWithLevel[] = [];
        const community =
            chat.kind === "channel" ? this.getCommunityForChannel(chat.id) : undefined;
        if (
            community !== undefined &&
            community.gateConfig.gate.kind !== "no_gate" &&
            community.membership.role === "none" &&
            (!community.isInvited || !excludeInvited)
        ) {
            gates.push({ level: "community", ...community.gateConfig.gate });
        }
        if (
            chat.gateConfig.gate.kind !== "no_gate" &&
            chat.membership.role === "none" &&
            (!chat.isInvited || !excludeInvited)
        ) {
            gates.push({ level: chat.level, ...chat.gateConfig.gate });
        }
        return gates;
    }

    private handleWebRtcMessage(msg: WebRtcMessage): void {
        if (msg.kind === "remote_video_call_started") {
            const ev = createRemoteVideoStartedEvent(msg);
            if (ev) {
                this.dispatchEvent(ev);
            }
            return;
        }
        if (msg.kind === "remote_video_call_ended") {
            const ev = createRemoteVideoEndedEvent(msg);
            if (ev) {
                this.dispatchEvent(ev);
            }
            return;
        }
        const fromChatId = filterWebRtcMessage(msg);
        if (fromChatId === undefined) return;

        // this means we have a selected chat but it doesn't mean it's the same as this message
        const parsedMsg = parseWebRtcMessage(fromChatId, msg);
        const { selectedChat, threadEvents, events } = this._liveState;

        if (
            selectedChat !== undefined &&
            chatIdentifiersEqual(fromChatId, selectedChat.id) &&
            parsedMsg.threadRootMessageIndex === this._liveState.selectedThreadRootMessageIndex
        ) {
            this.handleWebRtcMessageInternal(
                fromChatId,
                parsedMsg,
                parsedMsg.threadRootMessageIndex === undefined ? events : threadEvents,
                parsedMsg.threadRootMessageIndex,
            );
        } else {
            if (
                parsedMsg.kind === "remote_user_sent_message" &&
                parsedMsg.threadRootMessageIndex === undefined
            ) {
                unconfirmed.add({ chatId: fromChatId }, parsedMsg.messageEvent);
            }
        }
    }

    private handleWebRtcMessageInternal(
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
                localMessageUpdates.markDeleted(msg.messageId, msg.userId);
                break;
            case "remote_user_removed_message":
                this.removeMessage(fromChatId, msg.messageId, msg.userId, threadRootMessageIndex);
                break;
            case "remote_user_undeleted_message":
                localMessageUpdates.markUndeleted(msg.messageId);
                break;
            case "remote_user_sent_message":
                this.remoteUserSentMessage(fromChatId, msg, events, threadRootMessageIndex);
                break;
            case "remote_user_read_message":
                unconfirmedReadByThem.add(BigInt(msg.messageId));
                break;
        }
    }

    private remoteUserSentMessage(
        chatId: ChatIdentifier,
        message: RemoteUserSentMessage,
        events: EventWrapper<ChatEvent>[],
        threadRootMessageIndex: number | undefined,
    ) {
        const existing = this.findMessageById(message.messageEvent.event.messageId, events);
        if (existing !== undefined) {
            return;
        }

        const [eventIndex, messageIndex] =
            threadRootMessageIndex !== undefined
                ? nextEventAndMessageIndexesForThread(events)
                : nextEventAndMessageIndexes();

        const context = { chatId, threadRootMessageIndex };

        this.dispatchEvent(new SendingMessage(context));

        window.setTimeout(() => {
            unconfirmed.add(context, {
                ...message.messageEvent,
                index: eventIndex,
                event: {
                    ...message.messageEvent.event,
                    messageIndex,
                },
            });

            this.dispatchEvent(new SentMessage(context, message.messageEvent));
        }, 0);
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this.sendRequest({ kind: "checkUsername", username });
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this.sendRequest({ kind: "searchUsers", searchTerm, maxResults })
            .then((resp) => {
                userStore.addMany(resp);
                return resp;
            })
            .catch(() => []);
    }

    lookupChatSummary(chatId: ChatIdentifier): ChatSummary | undefined {
        return this._liveState.allChats.get(chatId);
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
            const channelMembers = newGroup
                ? undefined
                : new Map(this._liveState.currentChatMembers.map((m) => [m.userId, m]));

            // First try searching the community members and return immediately if there are already enough matches
            // or if the caller does not have permission to invite users to the community
            const communityMatches = this.searchCommunityUsersForChannelInvite(
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
                            ? this._liveState.currentCommunityMembers
                            : new Map(this._liveState.currentChatMembers.map((m) => [m.userId, m]));

                    // Remove any existing members from the global matches until there are at most `maxResults`
                    // TODO: Ideally we would return the total number of matches from the server and use that
                    const maxToKeep = matches.length < maxToSearch ? 0 : maxResults;
                    keepMax(matches, (u) => !existing.has(u.userId), maxToKeep);
                }
                return [[], matches];
            });
        }
    }

    searchCommunityMembersToAdd(
        searchTerm: string,
        maxResults: number,
    ): Promise<[UserSummary[], UserSummary[]]> {
        // Put the existing channel members into a map for quick lookup
        const channelMembers = new Map(
            this._liveState.currentChatMembers.map((m) => [m.userId, m]),
        );

        // Search the community members excluding the existing channel members
        const communityMatches = this.searchCommunityUsersForChannelInvite(
            searchTerm,
            maxResults,
            channelMembers,
        );

        return Promise.resolve([communityMatches, []]);
    }

    private searchCommunityUsersForChannelInvite(
        term: string,
        maxResults: number,
        channelMembers: Map<string, Member> | undefined,
    ): UserSummary[] {
        const termLower = term.toLowerCase();
        const matches: UserSummary[] = [];
        for (const [userId, member] of this._liveState.currentCommunityMembers) {
            let user = this._liveState.userStore.get(userId);
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
        this._referralCode = undefined;
    }

    setReferralCode(code: string) {
        localStorage.setItem("openchat_referredby", code);
        this._referralCode = code;
    }

    private extractReferralCodeFromPath(): string | undefined {
        const qs = new URLSearchParams(window.location.search);
        return qs.get("ref") ?? undefined;
    }

    captureReferralCode(): boolean {
        const code = this.extractReferralCodeFromPath();
        let captured = false;
        if (code) {
            gaTrack("captured_referral_code", "registration");
            localStorage.setItem("openchat_referredby", code);
            captured = true;
        }
        this._referralCode = localStorage.getItem("openchat_referredby") ?? undefined;
        return captured;
    }

    getReferringUser(): Promise<UserSummary | undefined> {
        return this._referralCode === undefined
            ? Promise.resolve(undefined)
            : this.getUser(this._referralCode);
    }

    registerUser(username: string): Promise<RegisterUserResponse> {
        return this.sendRequest({
            kind: "registerUser",
            username,
            referralCode: this._referralCode,
        })
            .then((res) => {
                console.log("register user response: ", res);
                if (res.kind === "success") {
                    gaTrack("registered_user", "registration", res.userId);
                    if (this._referralCode !== undefined) {
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
            this.sendStreamRequest({ kind: "getCurrentUser" })
                .subscribe((user) => {
                    if (user.kind === "created_user") {
                        userCreatedStore.set(true);
                        this.user.set(user);
                        this.setDiamondStatus(user.diamondStatus);
                    }
                    if (!resolved) {
                        // we want to resolve the promise with the first response from the stream so that
                        // we are not waiting unnecessarily
                        resolve(user);
                        resolved = true;
                    }
                })
                .catch(reject);
        });
    }

    getDisplayNameById(userId: string, communityMembers?: Map<string, Member>): string {
        return this.getDisplayName(this._liveState.userStore.get(userId), communityMembers);
    }

    getDisplayName(
        user: { userId: string; username: string; displayName?: string } | undefined,
        communityMembers?: Map<string, Member>,
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

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.sendRequest({ kind: "subscriptionExists", p256dh_key }).catch(() => false);
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({ kind: "pushSubscription", subscription });
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({ kind: "removeSubscription", subscription });
    }

    private inviteUsersLocally(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): void {
        if (id.kind === "community") {
            communityStateStore.updateProp(id, "invitedUsers", (b) => new Set([...b, ...userIds]));
        } else {
            chatStateStore.updateProp(id, "invitedUsers", (b) => new Set([...b, ...userIds]));
        }
    }

    private uninviteUsersLocally(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): void {
        if (id.kind === "community") {
            communityStateStore.updateProp(id, "invitedUsers", (b) => {
                return new Set([...b].filter((u) => !userIds.includes(u)));
            });

            const community = this._liveState.communities.get({
                kind: "community",
                communityId: id.communityId,
            });

            if (community !== undefined) {
                for (const channel of community.channels) {
                    this.uninviteUsersLocally(channel.id, userIds);
                }
            }
        } else {
            chatStateStore.updateProp(id, "invitedUsers", (b) => {
                return new Set([...b].filter((u) => !userIds.includes(u)));
            });
        }
    }

    inviteUsers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        this.inviteUsersLocally(id, userIds);
        return this.sendRequest({
            kind: "inviteUsers",
            id,
            userIds,
            callerUsername: this._liveState.user.username,
        })
            .then((resp) => {
                if (!resp) {
                    this.uninviteUsersLocally(id, userIds);
                }
                return resp;
            })
            .catch(() => {
                this.uninviteUsersLocally(id, userIds);
                return false;
            });
    }

    cancelInvites(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        this.uninviteUsersLocally(id, userIds);
        return this.sendRequest({
            kind: "cancelInvites",
            id,
            userIds,
        })
            .then((resp) => {
                if (!resp) {
                    this.inviteUsersLocally(id, userIds);
                }
                return resp;
            })
            .catch(() => {
                this.inviteUsersLocally(id, userIds);
                return false;
            });
    }

    addMembersToChannel(
        chatId: ChannelIdentifier,
        userIds: string[],
    ): Promise<AddMembersToChannelResponse> {
        return this.sendRequest({
            kind: "addMembersToChannel",
            chatId,
            userIds,
            username: this._liveState.user.username,
            displayName: this._liveState.user.displayName,
        }).catch((err) => {
            return { kind: "internal_error", error: err.toString() };
        });
    }

    removeCommunityMember(id: CommunityIdentifier, userId: string): Promise<RemoveMemberResponse> {
        communityStateStore.updateProp(id, "members", (ms) => {
            ms.delete(userId);
            return new Map(ms);
        });
        return this.sendRequest({ kind: "removeCommunityMember", id, userId }).catch(
            () => "failure",
        );
    }

    removeMember(chatId: MultiUserChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        chatStateStore.updateProp(chatId, "members", (ps) => ps.filter((p) => p.userId !== userId));
        return this.sendRequest({ kind: "removeMember", chatId, userId }).catch(() => "failure");
    }

    changeCommunityRole(
        id: CommunityIdentifier,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole,
    ): Promise<boolean> {
        if (newRole === oldRole) return Promise.resolve(true);

        // Update the local store
        communityStateStore.updateProp(id, "members", (ms) => {
            const m = ms.get(userId);
            if (m !== undefined) {
                ms.set(userId, { ...m, role: newRole });
                return new Map(ms);
            }
            return ms;
        });

        return this.sendRequest({ kind: "changeCommunityRole", id, userId, newRole })
            .then((resp) => {
                return resp === "success";
            })
            .catch(() => false)
            .then((success) => {
                if (!success) {
                    // Revert the local store
                    communityStateStore.updateProp(id, "members", (ms) => {
                        const m = ms.get(userId);
                        if (m !== undefined) {
                            ms.set(userId, { ...m, role: oldRole });
                            return new Map(ms);
                        }
                        return ms;
                    });
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

        // Update the local store
        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: newRole } : p)),
        );
        return this.sendRequest({ kind: "changeRole", chatId, userId, newRole })
            .then((resp) => {
                return resp === "success";
            })
            .catch(() => false)
            .then((success) => {
                if (!success) {
                    // Revert the local store
                    chatStateStore.updateProp(chatId, "members", (ps) =>
                        ps.map((p) => (p.userId === userId ? { ...p, role: oldRole } : p)),
                    );
                }
                return success;
            });
    }

    registerProposalVote(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.sendRequest(
            {
                kind: "registerProposalVote",
                chatId,
                messageIndex,
                adopt,
            },
            false,
            2 * DEFAULT_WORKER_TIMEOUT,
        ).catch(() => "internal_error");
    }

    getProposalVoteDetails(
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
    ): Promise<ProposalVoteDetails> {
        return this.sendRequest({
            kind: "getProposalVoteDetails",
            governanceCanisterId,
            proposalId,
            isNns,
        }).then((resp) => {
            proposalTallies.setTally(governanceCanisterId, proposalId, resp.latestTally);
            return resp;
        });
    }

    getRecommendedGroups(): Promise<GroupChatSummary[]> {
        // TODO get the list of exclusions from the user canister

        const exclusions = new Set<string>(
            this._liveState.chatSummariesList
                .filter((c) => c.kind === "group_chat" && c.public)
                .map((g) => chatIdentifierToString(g.id)),
        );

        recommendedGroupExclusions.value().forEach((c) => exclusions.add(c));

        return this.sendRequest({
            kind: "getRecommendedGroups",
            exclusions: [...exclusions],
        }).catch(() => []);
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.sendRequest({ kind: "searchGroups", searchTerm, maxResults });
    }

    exploreCommunities(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        flags: number,
        languages: string[],
    ): Promise<ExploreCommunitiesResponse> {
        return this.sendRequest({
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
        return this.sendRequest({
            kind: "exploreChannels",
            id,
            searchTerm,
            pageIndex,
            pageSize,
        }).catch(() => ({ kind: "failure" }));
    }

    dismissRecommendation(chatId: GroupChatIdentifier): Promise<void> {
        recommendedGroupExclusions.add(chatIdentifierToString(chatId));
        return this.sendRequest({ kind: "dismissRecommendation", chatId });
    }

    set groupInvite(value: GroupInvite) {
        this.config.groupInvite = value;
        this.sendRequest({
            kind: "groupInvite",
            value,
        });
    }

    setCommunityInvite(value: CommunityInvite): Promise<void> {
        return this.sendRequest({
            kind: "communityInvite",
            value,
        });
    }

    setCommunityReferral(communityId: CommunityIdentifier, referredBy: string) {
        // make sure that we can't refer ourselves
        if (this._liveState.user.userId !== referredBy) {
            return this.sendRequest({
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
        maxResults = 10,
    ): Promise<SearchDirectChatResponse | SearchGroupChatResponse> {
        switch (chatId.kind) {
            case "channel":
            case "group_chat":
                return this.sendRequest({
                    kind: "searchGroupChat",
                    chatId,
                    searchTerm,
                    userIds,
                    maxResults,
                });
            case "direct_chat":
                return this.sendRequest({
                    kind: "searchDirectChat",
                    chatId,
                    searchTerm,
                    maxResults,
                });
        }
    }

    refreshAccountBalance(ledger: string): Promise<bigint> {
        const user = this._liveState.user;
        if (user === undefined) {
            return Promise.resolve(0n);
        }

        return this.sendRequest({
            kind: "refreshAccountBalance",
            ledger,
            principal: user.userId,
        })
            .then((val) => {
                cryptoBalance.set(ledger, val);
                return val;
            })
            .catch(() => 0n);
    }

    refreshTranslationsBalance(): Promise<bigint> {
        return this.sendRequest({
            kind: "refreshAccountBalance",
            ledger: LEDGER_CANISTER_CHAT,
            principal: this.config.translationsCanister,
        }).catch(() => 0n);
    }

    async getAccountTransactions(
        ledgerIndex: string,
        fromId?: bigint,
    ): Promise<AccountTransactionResult> {
        return this.sendRequest({
            kind: "getAccountTransactions",
            ledgerIndex: ledgerIndex,
            fromId,
            principal: this._liveState.user.userId,
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

    async threadPreviews(
        _chatId: ChatIdentifier | undefined,
        threadsByChat: ChatMap<ThreadSyncDetails[]>,
        serverChatSummaries: ChatMap<ChatSummary>,
    ): Promise<ThreadPreview[]> {
        const request: ChatMap<[ThreadSyncDetails[], bigint | undefined]> = threadsByChat
            .entries()
            .reduce((map, [chatId, threads]) => {
                if (chatId.kind === "group_chat" || chatId.kind === "channel") {
                    const latestKnownUpdate = serverChatSummaries.get(chatId)?.lastUpdated;
                    map.set(chatId, [threads, latestKnownUpdate]);
                }
                return map;
            }, new ChatMap<[ThreadSyncDetails[], bigint | undefined]>());

        return this.sendRequest({
            kind: "threadPreviews",
            threadsByChat: request.toMap(),
        })
            .then((threads) => {
                const events = threads.flatMap((t) => [t.rootMessage, ...t.latestReplies]);
                const userIds = this.userIdsFromEvents(events);
                this.getMissingUsers(userIds);
                return threads;
            })
            .catch(() => []);
    }

    getMissingUsers(userIds: string[] | Set<string>): Promise<UsersResponse> {
        const userIdsSet = Array.isArray(userIds) ? new Set<string>(userIds) : userIds;
        return this.getUsers(
            {
                userGroups: [
                    {
                        users: this.missingUserIds(this._liveState.userStore, userIdsSet),
                        updatedSince: BigInt(0),
                    },
                ],
            },
            true,
        );
    }

    getUsers(users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        const userGroups = users.userGroups
            .map((g) => ({ ...g, users: g.users.filter((u) => u !== undefined) }))
            .filter((g) => g.users.length > 0);

        if (userGroups.length === 0) {
            return Promise.resolve({
                users: [],
                deletedUserIds: new Set(),
            });
        }

        return this.sendRequest({
            kind: "getUsers",
            chitState: this._liveState.chitState,
            users: { userGroups },
            allowStale,
        })
            .then((resp) => {
                const deletedUsers = [...resp.deletedUserIds].map(deletedUser);
                userStore.addMany([...resp.users, ...deletedUsers]);
                if (resp.serverTimestamp !== undefined) {
                    // If we went to the server, all users not returned are still up to date, so we mark them as such
                    const usersReturned = new Set<string>(resp.users.map((u) => u.userId));
                    const allOtherUsers = users.userGroups.flatMap((g) =>
                        g.users.filter((u) => !usersReturned.has(u)),
                    );
                    userStore.setUpdated(allOtherUsers, resp.serverTimestamp);
                }
                if (resp.currentUser) {
                    this.user.update((u) => {
                        return resp.currentUser ? updateCreatedUser(u, resp.currentUser) : u;
                    });
                }
                return resp;
            })
            .catch(() => ({ users: [], deletedUserIds: new Set() }));
    }

    getUser(userId: string, allowStale = false): Promise<UserSummary | undefined> {
        return this.sendRequest({
            kind: "getUser",
            chitState: this._liveState.chitState,
            userId,
            allowStale,
        })
            .then((resp) => {
                if (resp !== undefined) {
                    userStore.add(resp);
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
        const user = this._liveState.userStore.get(userId);
        if (user === undefined || user.kind === "bot") return undefined;

        if (userId === this._liveState.user.userId) return now;

        const lastOnlineCached = lastOnlineDates.get(userId, now);

        const cacheValid =
            lastOnlineCached !== undefined &&
            (lastOnlineCached.lastOnline < now - 5 * ONE_MINUTE_MILLIS ||
                lastOnlineCached.updated > now - 30 * 1000);

        if (cacheValid) {
            return lastOnlineCached.lastOnline;
        } else {
            const response = await this.getLastOnlineDatesBatched([userId]);
            return response[userId];
        }
    }

    getPublicProfile(userId?: string): Promise<PublicProfile> {
        return this.sendRequest({ kind: "getPublicProfile", userId });
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.sendRequest({ kind: "setUsername", userId, username }).then((resp) => {
            if (resp === "success") {
                this.user.update((user) => ({
                    ...user,
                    username,
                }));
                this.overwriteUserInStore(userId, (user) => ({ ...user, username }));
            }
            return resp;
        });
    }

    setDisplayName(
        userId: string,
        displayName: string | undefined,
    ): Promise<SetDisplayNameResponse> {
        return this.sendRequest({ kind: "setDisplayName", userId, displayName }).then((resp) => {
            if (resp === "success") {
                this.user.update((user) => ({
                    ...user,
                    displayName,
                }));
                this.overwriteUserInStore(userId, (user) => ({ ...user, displayName }));
            }
            return resp;
        });
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.sendRequest({ kind: "setBio", bio });
    }

    getBio(userId?: string): Promise<string> {
        return this.sendRequest({ kind: "getBio", userId });
    }

    async withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
    ): Promise<WithdrawCryptocurrencyResponse> {
        let pin: string | undefined = undefined;

        if (this._liveState.pinNumberRequired) {
            pin = await this.promptForCurrentPin("pinNumber.enterPinInfo");
        }

        return this.sendRequest({ kind: "withdrawCryptocurrency", domain, pin }).then((resp) => {
            if (
                resp.kind === "pin_incorrect" ||
                resp.kind === "pin_required" ||
                resp.kind === "too_main_failed_pin_attempts"
            ) {
                pinNumberFailureStore.set(resp as PinNumberFailures);
            }

            return resp;
        });
    }

    async getGroupMessagesByMessageIndex(
        chatId: MultiUserChatIdentifier,
        messageIndexes: Set<number>,
    ): Promise<EventsResponse<Message>> {
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        try {
            const resp = await this.sendRequest({
                kind: "getGroupMessagesByMessageIndex",
                chatId,
                messageIndexes,
                latestKnownUpdate: serverChat?.lastUpdated,
            });
            if (resp !== "events_failed") {
                await this.updateUserStoreFromEvents(chatId, resp.events);
            }
            return resp;
        } catch {
            return "events_failed";
        }
    }

    getInviteCode(id: GroupChatIdentifier | CommunityIdentifier): Promise<InviteCodeResponse> {
        return this.sendRequest({ kind: "getInviteCode", id }).catch(() => ({ kind: "failure" }));
    }

    enableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<EnableInviteCodeResponse> {
        return this.sendRequest({ kind: "enableInviteCode", id }).catch(() => ({
            kind: "failure",
        }));
    }

    disableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<DisableInviteCodeResponse> {
        return this.sendRequest({ kind: "disableInviteCode", id }).catch(() => "failure");
    }

    resetInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<ResetInviteCodeResponse> {
        return this.sendRequest({ kind: "resetInviteCode", id }).catch(() => ({ kind: "failure" }));
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
        return this.sendRequest({
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
                    localChatSummaryUpdates.markUpdated(chatId, {
                        kind: chatId.kind,
                        name,
                        description: desc,
                        permissions,
                        gateConfig: gateConfig,
                        eventsTTL: eventsTimeToLive,
                    });

                    if (rules !== undefined && resp.rulesVersion !== undefined) {
                        chatStateStore.setProp(chatId, "rules", {
                            text: rules.text,
                            enabled: rules.enabled,
                            version: resp.rulesVersion,
                        });
                    }
                } else {
                    this._logger.error("Update group rules failed: ", resp.kind);
                }
                return resp;
            })
            .catch(() => ({ kind: "failure" }));
    }

    private isMultiUserChat(chat: ChatSummary): chat is MultiUserChat {
        return chat.kind === "group_chat" || chat.kind === "channel";
    }

    maskChatMessages(chat: ChatSummary): boolean {
        // notAMember && (private || !messagesVisibleToNonMembers)
        return (
            this.isMultiUserChat(chat) &&
            chat.membership.role === "none" &&
            (!chat.public || !chat.messagesVisibleToNonMembers)
        );
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.sendRequest({ kind: "createGroupChat", candidate }).then((resp) => {
            if (resp.kind === "success") {
                const group = groupChatFromCandidate(resp.canisterId, candidate);
                localChatSummaryUpdates.markAdded(group);
            }
            return resp;
        });
    }

    markThreadSummaryUpdated(threadRootMessageId: bigint, summary: Partial<ThreadSummary>): void {
        localMessageUpdates.markThreadSummaryUpdated(threadRootMessageId, summary);
    }

    freezeGroup(chatId: GroupChatIdentifier, reason: string | undefined): Promise<boolean> {
        return this.sendRequest({ kind: "freezeGroup", chatId, reason })
            .then((resp) => {
                if (typeof resp !== "string") {
                    this.onChatFrozen(chatId, resp);
                    return true;
                }
                return false;
            })
            .catch(() => false);
    }

    unfreezeGroup(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "unfreezeGroup", chatId })
            .then((resp) => {
                if (typeof resp !== "string") {
                    this.onChatFrozen(chatId, resp);
                    return true;
                }
                return false;
            })
            .catch(() => false);
    }

    deleteFrozenGroup(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "deleteFrozenGroup", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    addHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "addHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    removeHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "removeHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    addRemoveSwapProvider(swapProvider: DexId, add: boolean): Promise<boolean> {
        return this.sendRequest({ kind: "addRemoveSwapProvider", swapProvider, add });
    }

    addMessageFilter(regex: string): Promise<boolean> {
        try {
            new RegExp(regex);
        } catch (e) {
            console.error("Unable to add message filter - invalid regex", regex);
            return Promise.resolve(false);
        }

        return this.sendRequest({ kind: "addMessageFilter", regex });
    }

    removeMessageFilter(id: bigint): Promise<boolean> {
        return this.sendRequest({ kind: "removeMessageFilter", id }).catch(() => false);
    }

    suspendUser(userId: string, reason: string): Promise<boolean> {
        return this.sendRequest({ kind: "suspendUser", userId, reason })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    unsuspendUser(userId: string): Promise<boolean> {
        return this.sendRequest({ kind: "unsuspendUser", userId })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setCommunityModerationFlags(communityId: string, flags: number): Promise<boolean> {
        return this.sendRequest({ kind: "setCommunityModerationFlags", communityId, flags })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setGroupUpgradeConcurrency(value: number): Promise<boolean> {
        return this.sendRequest({ kind: "setGroupUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setCommunityUpgradeConcurrency(value: number): Promise<boolean> {
        return this.sendRequest({ kind: "setCommunityUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    setUserUpgradeConcurrency(value: number): Promise<boolean> {
        return this.sendRequest({ kind: "setUserUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<boolean> {
        return this.sendRequest({ kind: "markLocalGroupIndexFull", canisterId, full }).catch(
            () => false,
        );
    }

    setDiamondMembershipFees(fees: DiamondMembershipFees[]): Promise<boolean> {
        return this.sendRequest({ kind: "setDiamondMembershipFees", fees }).catch(() => false);
    }

    setTokenEnabled(ledger: string, enabled: boolean): Promise<boolean> {
        return this.sendRequest({ kind: "setTokenEnabled", ledger, enabled });
    }

    stakeNeuronForSubmittingProposals(
        governanceCanisterId: string,
        stake: bigint,
    ): Promise<boolean> {
        return this.sendRequest({
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
        return this.sendRequest({
            kind: "topUpNeuronForSubmittingProposals",
            governanceCanisterId,
            amount,
        })
            .then((resp) => resp.kind === "success")
            .catch(() => false);
    }

    private onChatFrozen(
        chatId: MultiUserChatIdentifier,
        event: EventWrapper<ChatFrozenEvent | ChatUnfrozenEvent>,
    ): void {
        const frozen = event.event.kind === "chat_frozen";
        if (this.isPreviewing(chatId)) {
            groupPreviewsStore.update((summaries) => {
                const summary = summaries.get(chatId);
                if (summary === undefined) {
                    return summaries;
                }
                const clone = summaries.clone();
                clone.set(chatId, {
                    ...summary,
                    frozen,
                });
                return clone as ChatMap<GroupChatSummary>;
            });
        } else {
            localChatSummaryUpdates.markUpdated(chatId, { kind: "group_chat", frozen });
            this.addServerEventsToStores(chatId, [event], undefined, []);
        }
    }

    private userIdsFromChatSummaries(chats: ChatSummary[]): Set<string> {
        const userIds = new Set<string>();
        chats.forEach((chat) => {
            if (chat.kind === "direct_chat") {
                userIds.add(chat.them.userId);
            } else if (chat.latestMessage !== undefined) {
                userIds.add(chat.latestMessage.event.sender);
                this.extractUserIdsFromMentions(
                    getContentAsFormattedText(
                        (k) => k,
                        chat.latestMessage.event.content,
                        get(cryptoLookup),
                    ),
                ).forEach((id) => userIds.add(id));
            }
        });
        return userIds;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    private async updateUsers() {
        try {
            const now = BigInt(Date.now());
            const allUsers = this._liveState.userStore;
            const usersToUpdate = new Set<string>();
            if (!this._liveState.anonUser) {
                usersToUpdate.add(this._liveState.user.userId);
            }

            const tenMinsAgo = now - BigInt(10 * ONE_MINUTE_MILLIS);
            for (const userId of this._recentlyActiveUsersTracker.consume()) {
                const current = allUsers.get(userId);
                if (current === undefined || current.updated < tenMinsAgo) {
                    usersToUpdate.add(userId);
                }
                if (usersToUpdate.size >= 100) {
                    break;
                }
            }

            // Update all users we have direct chats with
            for (const chat of this._liveState.chatSummariesList) {
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

            for (const userId of get(specialUsers).keys()) {
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
            this._logger.error("Error updating users", err as Error);
        }
    }

    private async handleChatsResponse(
        updateRegistryTask: Promise<void> | undefined,
        initialLoad: boolean,
        chatsResponse: UpdatesResult,
    ): Promise<void> {
        if (initialLoad || chatsResponse.anyUpdates) {
            if (chatsResponse.suspensionChanged !== undefined) {
                this.dispatchEvent(new UserSuspensionChanged());
                return;
            }

            if (updateRegistryTask !== undefined) {
                // We need the registry to be loaded before we attempt to render chats / events
                await updateRegistryTask;
            }

            const chats = (chatsResponse.state.directChats as ChatSummary[])
                .concat(chatsResponse.state.groupChats)
                .concat(chatsResponse.state.communities.flatMap((c) => c.channels));

            this.updateReadUpToStore(chats);

            if (this._cachePrimer === undefined && !this._liveState.anonUser) {
                this._cachePrimer = new CachePrimer(
                    this,
                    this._liveState.user.userId,
                    chatsResponse.state.userCanisterLocalUserIndex,
                    (ev) => this.dispatchEvent(ev),
                    (ev) => this.dispatchEvent(ev),
                );
            }
            if (this._cachePrimer !== undefined) {
                this._cachePrimer.processChats(chats);
            }

            const userIds = this.userIdsFromChatSummaries(chats);
            if (chatsResponse.state.referrals !== undefined) {
                for (const userId of chatsResponse.state.referrals.map((r) => r.userId)) {
                    userIds.add(userId);
                }
            }
            if (!this._liveState.anonUser) {
                userIds.add(this._liveState.user.userId);
            }
            await this.getMissingUsers(userIds);

            if (chatsResponse.state.blockedUsers !== undefined) {
                blockedUsers.set(new Set(chatsResponse.state.blockedUsers));
            }

            // if the selected community has updates, reload the details
            const selectedCommunity = this._liveState.selectedCommunity;
            if (selectedCommunity !== undefined) {
                const updatedCommunity = chatsResponse.state.communities.find(
                    (c) => c.id.communityId === selectedCommunity.id.communityId,
                );
                if (
                    updatedCommunity !== undefined &&
                    updatedCommunity.latestEventIndex > selectedCommunity.latestEventIndex
                ) {
                    this.loadCommunityDetails(updatedCommunity);
                }
            }

            // If we are still previewing a community we are a member of then remove the preview
            for (const community of chatsResponse.state.communities) {
                if (
                    community?.membership !== undefined &&
                    this._liveState.communityPreviews.has(community.id)
                ) {
                    removeCommunityPreview(community.id);
                }
            }

            if (this._liveState.uninitializedDirectChats.size > 0) {
                for (const chat of chats) {
                    if (this._liveState.uninitializedDirectChats.has(chat.id)) {
                        removeUninitializedDirectChat(chat.id);
                    }
                }
            }

            setGlobalState(
                chatsResponse.state.communities,
                chats,
                chatsResponse.state.favouriteChats,
                {
                    group_chat: chatsResponse.state.pinnedGroupChats,
                    direct_chat: chatsResponse.state.pinnedDirectChats,
                    favourite: chatsResponse.state.pinnedFavouriteChats,
                    community: chatsResponse.state.pinnedChannels,
                    none: [],
                },
                chatsResponse.state.achievements,
                chatsResponse.state.chitState,
                chatsResponse.state.referrals,
                chatsResponse.state.walletConfig,
            );

            const selectedChatId = this._liveState.selectedChatId;

            if (selectedChatId !== undefined) {
                if (this._liveState.chatSummaries.get(selectedChatId) === undefined) {
                    clearSelectedChat();
                    this.dispatchEvent(new SelectedChatInvalid());
                } else {
                    const updatedEvents = ChatMap.fromMap(chatsResponse.updatedEvents);
                    this.chatUpdated(selectedChatId, updatedEvents.get(selectedChatId) ?? []);
                }
            }

            const currentUser = this._liveState.userStore.get(this._liveState.user.userId);
            const avatarId = currentUser?.blobReference?.blobId;
            if (chatsResponse.state.avatarId !== avatarId) {
                const blobReference =
                    chatsResponse.state.avatarId === undefined
                        ? undefined
                        : {
                              canisterId: this._liveState.user.userId,
                              blobId: chatsResponse.state.avatarId,
                          };
                const dataContent = {
                    blobReference,
                    blobData: undefined,
                    blobUrl: undefined,
                };
                if (currentUser) {
                    const user = {
                        ...currentUser,
                        ...dataContent,
                    };
                    userStore.add(this.rehydrateDataContent(user, "avatar"));
                }
            }

            // If the latest message in a chat is sent by the current user, then we know they must have read up to
            // that message, so we mark the chat as read up to that message if it isn't already. This happens when a
            // user sends a message on one device then looks at OpenChat on another.
            for (const chat of chats) {
                const latestMessage = chat.latestMessage?.event;
                if (
                    latestMessage !== undefined &&
                    latestMessage.sender === this._liveState.user.userId &&
                    (chat.membership?.readByMeUpTo ?? -1) < latestMessage.messageIndex &&
                    !unconfirmed.contains({ chatId: chat.id }, latestMessage.messageId)
                ) {
                    messagesRead.markReadUpTo({ chatId: chat.id }, latestMessage.messageIndex);
                }
            }

            pinNumberRequiredStore.set(chatsResponse.state.pinNumberSettings !== undefined);

            chatsInitialised.set(true);

            this.dispatchEvent(new ChatsUpdated());

            if (chatsResponse.newAchievements.length > 0) {
                const filtered = chatsResponse.newAchievements.filter(
                    (a) => a.timestamp > chatsResponse.state.achievementsLastSeen,
                );
                if (filtered.length > 0) {
                    this.dispatchEvent(new ChitEarnedEvent(filtered));
                }
            }

            if (initialLoad) {
                this.startExchangeRatePoller();
                if (!this._liveState.anonUser) {
                    this.initWebRtc();
                    startMessagesReadTracker(this);
                    window.setTimeout(() => this.refreshBalancesInSeries(), 0);
                }
            }
        }
    }

    private async loadChats() {
        const initialLoad = !this._liveState.chatsInitialised;
        chatsLoading.set(initialLoad);

        const updateRegistryTask = initialLoad ? this.updateRegistry() : undefined;

        return new Promise<void>((resolve) => {
            this.sendStreamRequest({
                kind: "getUpdates",
                initialLoad,
            })
                .subscribe(async (resp) => {
                    await this.handleChatsResponse(
                        updateRegistryTask,
                        !this._liveState.chatsInitialised,
                        resp as UpdatesResult,
                    );
                    chatsLoading.set(!this._liveState.chatsInitialised);
                })
                .catch((err) => {
                    console.warn("getUpdates threw an error: ", err);
                    resolve();
                })
                .finally(() => {
                    resolve();
                });
        });
    }

    private async getLastOnlineDatesBatched(userIds: string[]): Promise<Record<string, number>> {
        userIds.forEach((u) => this._lastOnlineDatesPending.add(u));
        if (this._lastOnlineDatesPromise === undefined) {
            // Wait 50ms so that the last online dates can be retrieved in a single batch
            this._lastOnlineDatesPromise = new Promise((resolve) =>
                window.setTimeout(resolve, 50),
            ).then((_) => this.processLastOnlineDatesQueue());
        }

        return this._lastOnlineDatesPromise;
    }

    private async processLastOnlineDatesQueue(): Promise<Record<string, number>> {
        const userIds = [...this._lastOnlineDatesPending];
        this._lastOnlineDatesPromise = undefined;
        this._lastOnlineDatesPending.clear();

        try {
            const response = await this.sendRequest({ kind: "lastOnline", userIds });
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

    private updateReadUpToStore(chatSummaries: ChatSummary[]): void {
        messagesRead.batchUpdate(() => {
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
            }
        });
    }

    claimPrize(chatId: MultiUserChatIdentifier, messageId: bigint): Promise<boolean> {
        return this.sendRequest({ kind: "claimPrize", chatId, messageId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    return false;
                } else {
                    localMessageUpdates.markPrizeClaimed(messageId, this._liveState.user.userId);
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

        if (this._liveState.pinNumberRequired) {
            pin = await this.promptForCurrentPin("pinNumber.enterPinInfo");
        }

        localMessageUpdates.setP2PSwapStatus(messageId, {
            kind: "p2p_swap_reserved",
            reservedBy: this._liveState.user.userId,
        });

        const newAchievement = !this._liveState.globalState.achievements.has("accepted_swap_offer");

        return this.sendRequest({
            kind: "acceptP2PSwap",
            chatId,
            threadRootMessageIndex,
            messageId,
            pin,
            newAchievement,
        })
            .then((resp) => {
                localMessageUpdates.setP2PSwapStatus(
                    messageId,
                    mapAcceptP2PSwapResponseToStatus(resp, this._liveState.user.userId),
                );

                if (
                    resp.kind === "pin_incorrect" ||
                    resp.kind === "pin_required" ||
                    resp.kind === "too_main_failed_pin_attempts"
                ) {
                    pinNumberFailureStore.set(resp as PinNumberFailures);
                }

                return resp;
            })
            .catch((err) => {
                localMessageUpdates.setP2PSwapStatus(messageId, { kind: "p2p_swap_open" });
                return { kind: "internal_error", text: err.toString() };
            });
    }

    cancelP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        localMessageUpdates.setP2PSwapStatus(messageId, {
            kind: "p2p_swap_cancelled",
        });
        return this.sendRequest({
            kind: "cancelP2PSwap",
            chatId,
            threadRootMessageIndex,
            messageId,
        })
            .then((resp) => {
                localMessageUpdates.setP2PSwapStatus(
                    messageId,
                    mapCancelP2PSwapResponseToStatus(resp),
                );
                return resp;
            })
            .catch((err) => {
                localMessageUpdates.setP2PSwapStatus(messageId, { kind: "p2p_swap_open" });
                return { kind: "internal_error", text: err.toString() };
            });
    }

    joinVideoCall(chatId: ChatIdentifier, messageId: bigint): Promise<JoinVideoCallResponse> {
        const newAchievement = !this._liveState.globalState.achievements.has("joined_call");

        return this.sendRequest({
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
        const newAchievement = !this._liveState.globalState.achievements.has("joined_call");

        return this.sendRequest({
            kind: "setVideoCallPresence",
            chatId,
            messageId,
            presence,
            newAchievement,
        })
            .then((resp) => resp === "success")
            .catch(() => false);
    }

    // FIXME - should this input param be a Map
    private mapVideoCallParticipants(
        users: Record<string, UserSummary>,
        participant: VideoCallParticipant,
    ): Record<string, UserSummary> {
        const user = this._liveState.userStore.get(participant.userId);
        if (user) {
            users[participant.userId] = user;
        }
        return users;
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
        return this.sendRequest({
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
                            (u, p) => this.mapVideoCallParticipants(u, p),
                            {},
                        ),
                        hidden: resp.hidden.reduce<Record<string, UserSummary>>(
                            (u, p) => this.mapVideoCallParticipants(u, p),
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

    private overwriteUserInStore(
        userId: string,
        updater: (user: UserSummary) => UserSummary | undefined,
    ): void {
        const user = this._liveState.userStore.get(userId);
        if (user !== undefined) {
            const updated = updater(user);
            if (updated !== undefined) {
                userStore.add(updated);
            }
        }
    }

    private updateDiamondStatusInUserStore(status: DiamondMembershipStatus): void {
        this.overwriteUserInStore(this._liveState.user.userId, (user) => {
            const changed = status.kind !== user.diamondStatus;
            return changed ? { ...user, diamondStatus: status.kind } : undefined;
        });
    }

    private setDiamondStatus(status: DiamondMembershipStatus): void {
        const now = Date.now();
        this.updateDiamondStatusInUserStore(status);
        if (status.kind === "active") {
            const expiry = Number(status.expiresAt);
            if (expiry > now) {
                if (this._membershipCheck !== undefined) {
                    window.clearTimeout(this._membershipCheck);
                }
                const interval = expiry - now;
                this._membershipCheck = window.setTimeout(
                    () => {
                        this.getCurrentUser().then((user) => {
                            if (user.kind === "created_user") {
                                this.user.set(user);
                            } else {
                                this.logout();
                            }
                        });
                        this._membershipCheck = undefined;
                    },
                    Math.min(MAX_INT32, interval),
                );
            }
        }
    }

    diamondMembershipFees(): Promise<DiamondMembershipFees[]> {
        return this.sendRequest({
            kind: "diamondMembershipFees",
        }).catch(() => []);
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this.sendRequest({
            kind: "reportedMessages",
            userId,
        });
    }

    payForDiamondMembership(
        token: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
    ): Promise<PayForDiamondMembershipResponse> {
        return this.sendRequest({
            kind: "payForDiamondMembership",
            userId: this._liveState.user.userId,
            token,
            duration,
            recurring,
            expectedPriceE8s,
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    this.user.update((user) => ({
                        ...user,
                        diamondStatus: resp.status,
                    }));
                    this.setDiamondStatus(resp.status);
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
        return this.sendRequest({
            kind: "setMessageReminder",
            chatId,
            eventIndex,
            remindAt,
            notes,
            threadRootMessageIndex,
        })
            .then((res) => {
                return res === "success";
            })
            .catch(() => false);
    }

    cancelMessageReminder(
        messageId: bigint,
        content: MessageReminderCreatedContent,
    ): Promise<boolean> {
        localMessageUpdates.markCancelled(messageId, content);
        return this.sendRequest({
            kind: "cancelMessageReminder",
            reminderId: content.reminderId,
        }).catch(() => {
            localMessageUpdates.revertCancelled(messageId);
            return false;
        });
    }

    reportMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.sendRequest({
            kind: "reportMessage",
            chatId,
            threadRootMessageIndex,
            messageId,
            deleteMessage,
        }).catch(() => false);
    }

    declineInvitation(chatId: MultiUserChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "declineInvitation", chatId })
            .then((res) => {
                return res === "success";
            })
            .catch(() => false);
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs,
    ): Promise<UpdateMarketMakerConfigResponse> {
        return this.sendRequest({ kind: "updateMarketMakerConfig", ...config });
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
        const previousValue = this._liveState.user.moderationFlagsEnabled;
        this.user.update((user) => ({
            ...user,
            moderationFlagsEnabled: flags,
        }));

        return this.sendRequest({
            kind: "setModerationFlags",
            flags,
        })
            .then((resp) => (resp === "success" ? flags : previousValue))
            .catch(() => {
                this.user.update((user) => ({
                    ...user,
                    moderationFlagsEnabled: previousValue,
                }));
                return previousValue;
            });
    }

    async tipMessage(
        messageContext: MessageContext,
        messageId: bigint,
        transfer: PendingCryptocurrencyTransfer,
        currentTip: bigint,
    ): Promise<TipMessageResponse> {
        const chat = this._liveState.chatSummaries.get(messageContext.chatId);
        if (chat === undefined) {
            return Promise.resolve({ kind: "failure" });
        }

        let pin: string | undefined = undefined;

        if (this._liveState.pinNumberRequired) {
            pin = await this.promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const userId = this._liveState.user.userId;
        const totalTip = transfer.amountE8s + currentTip;
        const decimals = get(cryptoLookup)[transfer.ledger].decimals;

        localMessageUpdates.markTip(messageId, transfer.ledger, userId, totalTip);

        function undoLocally() {
            localMessageUpdates.markTip(messageId, transfer.ledger, userId, -totalTip);
        }

        return this.sendRequest({
            kind: "tipMessage",
            messageContext,
            messageId,
            transfer,
            decimals,
            pin,
        })
            .then((resp) => {
                if (resp.kind !== "success") {
                    undoLocally();

                    if (
                        resp.kind === "pin_incorrect" ||
                        resp.kind === "pin_required" ||
                        resp.kind === "too_main_failed_pin_attempts"
                    ) {
                        pinNumberFailureStore.set(resp as PinNumberFailures);
                    }
                }

                return resp;
            })
            .catch((_) => {
                undoLocally();
                return { kind: "failure" };
            });
    }

    loadSavedCryptoAccounts(): Promise<NamedAccount[]> {
        return this.sendRequest({
            kind: "loadSavedCryptoAccounts",
        }).catch(() => []);
    }

    saveCryptoAccount(namedAccount: NamedAccount): Promise<SaveCryptoAccountResponse> {
        return this.sendRequest({
            kind: "saveCryptoAccount",
            namedAccount,
        }).catch(() => ({ kind: "failure" }));
    }

    isMemberOfAirdropChannel(): boolean {
        if (this.currentAirdropChannel === undefined) return false;
        const airdropChannel = this._liveState.allChats.get(this.currentAirdropChannel.id);
        return (airdropChannel?.membership.role ?? "none") !== "none";
    }

    private async updateRegistry(): Promise<void> {
        let resolved = false;
        return new Promise((resolve) => {
            this.sendStreamRequest({
                kind: "updateRegistry",
            })
                .subscribe(([registry, updated]) => {
                    if (updated || Object.keys(get(cryptoLookup)).length === 0) {
                        this.currentAirdropChannel = registry.currentAirdropChannel;
                        const cryptoRecord = toRecord(registry.tokenDetails, (t) => t.ledger);

                        nervousSystemLookup.set(
                            toRecord(
                                registry.nervousSystemSummary.map((ns) => ({
                                    ...ns,
                                    token: cryptoRecord[ns.ledgerCanisterId],
                                })),
                                (ns) => ns.governanceCanisterId,
                            ),
                        );

                        cryptoLookup.set(cryptoRecord);

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
                })
                .catch((err) => {
                    console.warn(`Failed to update the registry: ${err}`);
                    resolve();
                });
        });
    }

    private updateExchangeRates(): Promise<void> {
        return this.sendRequest({ kind: "exchangeRates" })
            .then((exchangeRates) => exchangeRatesLookupStore.set(exchangeRates))
            .catch(() => undefined);
    }

    private async refreshBalancesInSeries() {
        const config = this._liveState.walletConfig;
        for (const t of Object.values(get(cryptoLookup))) {
            if (config.kind === "auto_wallet" || config.tokens.has(t.ledger)) {
                await this.refreshAccountBalance(t.ledger);
            }
        }
    }

    private getSnsLogo(governanceCanisterId: string): string | undefined {
        return this.tryGetNervousSystem(governanceCanisterId)?.token.logo;
    }

    tryGetNervousSystem(
        governanceCanisterId: string | undefined,
    ): NervousSystemDetails | undefined {
        if (governanceCanisterId !== undefined) {
            const nsLookup = get(nervousSystemLookup);
            if (governanceCanisterId in nsLookup) {
                return nsLookup[governanceCanisterId];
            }
        }
    }

    tryGetCryptocurrency(ledgerCanisterId: string | undefined): CryptocurrencyDetails | undefined {
        if (ledgerCanisterId !== undefined) {
            const lookup = get(cryptoLookup);
            if (ledgerCanisterId in lookup) {
                return lookup[ledgerCanisterId];
            }
        }
    }

    // the key might be a username or it might be a user group name
    getUserLookupForMentions(): Record<string, UserOrUserGroup> {
        if (this._userLookupForMentions === undefined) {
            const lookup = {} as Record<string, UserOrUserGroup>;
            const userStore = this._liveState.userStore;
            for (const member of this._liveState.currentChatMembers) {
                const userId = member.userId;
                let user = userStore.get(userId);
                if (user !== undefined && this._liveState.selectedChat?.kind === "channel") {
                    user = {
                        ...user,
                        displayName: this.getDisplayName(
                            user,
                            this._liveState.currentCommunityMembers,
                        ),
                    };
                }
                if (user?.username !== undefined) {
                    lookup[user.username.toLowerCase()] = user as UserSummary;
                }
            }
            if (this._liveState.selectedCommunity !== undefined) {
                const userGroups = [...this._liveState.selectedCommunity.userGroups.values()];
                userGroups.forEach((ug) => (lookup[ug.name.toLowerCase()] = ug));
            }
            if (
                this._liveState.selectedChatId !== undefined &&
                this.canMentionAllMembers(this._liveState.selectedChatId)
            ) {
                lookup["everyone"] = { kind: "everyone" };
            }
            this._userLookupForMentions = lookup;
        }
        return this._userLookupForMentions;
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
                return includeSelf || userOrGroup.userId !== this._liveState.user.userId
                    ? userOrGroup
                    : undefined;
        }
    }

    getCachePrimerTimestamps(): Promise<Record<string, bigint>> {
        return this.sendRequest({ kind: "getCachePrimerTimestamps" }).catch(() => ({}));
    }

    submitProposal(governanceCanisterId: string, proposal: CandidateProposal): Promise<boolean> {
        const nervousSystem = this.tryGetNervousSystem(governanceCanisterId);
        if (nervousSystem === undefined) {
            this._logger.error(
                "Cannot find NervousSystemDetails for governanceCanisterId",
                governanceCanisterId,
            );
            return Promise.resolve(false);
        }

        return this.sendRequest(
            {
                kind: "submitProposal",
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

                this._logger.error("Failed to submit proposal", resp);
                return false;
            })
            .catch(() => false);
    }

    swappableTokens(): Promise<Set<string>> {
        return this.sendRequest({
            kind: "canSwap",
            tokenLedgers: new Set(Object.keys(get(cryptoLookup))),
        });
    }

    getTokenSwaps(inputTokenLedger: string): Promise<Record<string, DexId[]>> {
        const outputTokenLedgers = Object.keys(get(cryptoLookup)).filter(
            (t) => t !== inputTokenLedger,
        );

        return this.sendRequest({
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
        return this.sendRequest({
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

        if (this._liveState.pinNumberRequired) {
            pin = await this.promptForCurrentPin("pinNumber.enterPinInfo");
        }

        const lookup = get(cryptoLookup);

        return this.sendRequest(
            {
                kind: "swapTokens",
                swapId,
                inputTokenDetails: lookup[inputTokenLedger],
                outputTokenDetails: lookup[outputTokenLedger],
                amountIn,
                minAmountOut,
                dex,
                pin,
            },
            false,
            1000 * 60 * 3,
        ).then((resp) => {
            if (
                resp.kind === "pin_incorrect" ||
                resp.kind === "pin_required" ||
                resp.kind === "too_main_failed_pin_attempts"
            ) {
                pinNumberFailureStore.set(resp as PinNumberFailures);
            }

            return resp;
        });
    }

    tokenSwapStatus(swapId: bigint): Promise<TokenSwapStatusResponse> {
        return this.sendRequest({
            kind: "tokenSwapStatus",
            swapId,
        });
    }

    localUserIndexForCommunity(communityId: string): string {
        const community = this._liveState.communities.get({ kind: "community", communityId });
        if (community === undefined) {
            throw new Error("Community not found");
        }
        return community.localUserIndex;
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
        return this.sendRequest({
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
        return this.sendRequest({
            kind: "getProposedTranslations",
        })
            .then((res) => (res.kind === "success" ? res.proposed : []))
            .catch(() => []);
    }

    rejectTranslationCorrection(id: bigint, reason: RejectReason): Promise<boolean> {
        return this.sendRequest({
            kind: "rejectTranslation",
            id,
            reason,
        })
            .then((res) => res === "success")
            .catch(() => false);
    }

    approveTranslationCorrection(id: bigint): Promise<boolean> {
        return this.sendRequest({
            kind: "approveTranslation",
            id,
        })
            .then((res) => res === "success")
            .catch(() => false);
    }

    private async sendVideoCallUsersWebRtcMessage(msg: WebRtcMessage, chatId: ChatIdentifier) {
        const chat = this._liveState.allChats.get(chatId);
        if (chat === undefined) {
            throw new Error(`Unknown chat: ${chatId}`);
        }
        let userIds: string[] = [];
        const me = this._liveState.user.userId;
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") {
                userIds.push(chat.them.userId);
            } else if (this.isChatPrivate(chat)) {
                userIds = this._liveState.currentChatMembers
                    .map((m) => m.userId)
                    .filter((id) => id !== me);
            }
            if (userIds.length > 0) {
                await Promise.all(
                    userIds.map((id) =>
                        rtcConnectionsManager.create(
                            this._liveState.user.userId,
                            id,
                            this.config.meteredApiKey,
                        ),
                    ),
                );
                this.sendRtcMessage(userIds, msg);
            }
        }
    }

    async ringOtherUsers(chatId: ChatIdentifier, messageId: bigint) {
        this.sendVideoCallUsersWebRtcMessage(
            {
                kind: "remote_video_call_started",
                id: chatId,
                userId: this._liveState.user.userId,
                messageId,
            },
            chatId,
        );
    }

    private getRoomAccessToken(
        authToken: string,
    ): Promise<{ token: string; roomName: string; messageId: bigint; joining: boolean }> {
        // This will send the OC access JWT to the daily middleware service which will:
        // * validate the jwt
        // * create the room if necessary
        // * obtain an access token for the user
        // * return it to the front end
        const displayName = this.getDisplayName(
            this._liveState.user,
            this._liveState.currentCommunityMembers,
        );
        const user = this._liveState.user;
        const username = user.username;
        const avatarId = this._liveState.userStore.get(user.userId)?.blobReference?.blobId;
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

    private getLocalUserIndex(chat: ChatSummary): Promise<string> {
        switch (chat.kind) {
            case "group_chat":
                return Promise.resolve(chat.localUserIndex);
            case "channel":
                const community = this._liveState.communities.get({
                    kind: "community",
                    communityId: chat.id.communityId,
                });
                if (community) {
                    return Promise.resolve(community.localUserIndex);
                } else {
                    throw new Error(`Unable to get the local user index for channel: ${chat.id}`);
                }
            case "direct_chat":
                return this.sendRequest({
                    kind: "getLocalUserIndexForUser",
                    userId: chat.them.userId,
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
        const chat = this._liveState.allChats.get(chatId);
        if (chat === undefined) {
            throw new Error(`Unknown chat: ${chatId}`);
        }
        if (messageId !== undefined) {
            this.sendVideoCallUsersWebRtcMessage(
                {
                    kind: "remote_video_call_ended",
                    id: chatId,
                    userId: this._liveState.user.userId,
                    messageId,
                },
                chatId,
            );
        }
        return this.getLocalUserIndex(chat).then((localUserIndex) => {
            return this.sendRequest({
                kind: "getAccessToken",
                chatId,
                accessTokenType: { kind: "join_video_call" }, // TODO - this should have it's own token type really
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
        const chat = this._liveState.allChats.get(chatId);
        if (chat === undefined) {
            throw new Error(`Unknown chat: ${chatId}`);
        }

        return this.getLocalUserIndex(chat).then((localUserIndex) => {
            return this.sendRequest({
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
                .then((token) => this.getRoomAccessToken(token));
        });
    }

    updateBtcBalance(): Promise<UpdateBtcBalanceResponse> {
        return this.sendRequest({ kind: "updateBtcBalance", userId: this._liveState.user.userId });
    }

    async generateMagicLink(
        email: string,
        sessionKey: ECDSAKeyIdentity,
    ): Promise<GenerateMagicLinkResponse> {
        const sessionKeyDer = toDer(sessionKey);

        const resp = await this.sendRequest({
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
            await storeEmailSignInSession(this._authClientStorage, {
                key: sessionKey,
                email,
                userKey: resp.userKey,
                expiration: resp.expiration,
            });
        } else {
            await removeEmailSignInSession(this._authClientStorage);
        }

        return resp;
    }

    getExternalAchievements() {
        return this.sendRequest({ kind: "getExternalAchievements" }).catch((err) => {
            console.error("getExternalAchievements error", err);
            return [];
        });
    }

    markAchievementsSeen() {
        this.sendRequest({ kind: "markAchievementsSeen" }).catch((err) => {
            console.error("markAchievementsSeen", err);
        });
    }

    async handleMagicLink(qs: string): Promise<HandleMagicLinkResponse> {
        const signInWithEmailCanister = this.config.signInWithEmailCanister;

        const response = await fetch(`https://${signInWithEmailCanister}.raw.icp0.io/auth${qs}`);

        if (response.ok) {
            const session = await getEmailSignInSession(this._authClientStorage);
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
        connectToWorker: boolean,
    ): Promise<
        | { kind: "success"; key: ECDSAKeyIdentity; delegation: DelegationChain }
        | { kind: "error"; error: string }
        | { kind: "not_found" }
    > {
        const sessionKeyDer = toDer(sessionKey);
        const getDelegationResponse = await this.sendRequest({
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
            await storeIdentity(this._authClientStorage, sessionKey, delegation);
            if (connectToWorker) {
                this.loadedAuthenticationIdentity(identity, AuthProvider.EMAIL);
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
        return this.sendRequest({
            kind: "siwePrepareLogin",
            address,
        });
    }

    siwsPrepareLogin(address: string): Promise<SiwsPrepareLoginResponse> {
        return this.sendRequest({
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
        const loginResponse = await this.sendRequest({
            kind: "loginWithWallet",
            token,
            address,
            signature,
            sessionKey: sessionKeyDer,
        });

        if (loginResponse.kind === "success") {
            const getDelegationResponse = await this.sendRequest({
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
                    await storeIdentity(this._authClientStorage, sessionKey, delegation);
                    this.loadedAuthenticationIdentity(
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
    updateCommunityIndexes(communities: CommunitySummary[]): void {
        const [previews, member] = communities.reduce(
            ([previews, member], c) => {
                if (this._liveState.communityPreviews.has(c.id)) {
                    previews.push(c);
                } else {
                    member.push(c);
                }
                return [previews, member];
            },
            [[], []] as [CommunitySummary[], CommunitySummary[]],
        );
        if (previews.length > 0) {
            communityPreviewsStore.update((state) => {
                previews.forEach((p) => state.set(p.id, p));
                return state;
            });
        }

        if (member.length > 0) {
            globalStateStore.update((state) => {
                const communities = state.communities.clone();
                member.forEach((m) => communities.set(m.id, m));
                return {
                    ...state,
                    communities,
                };
            });
        }
        this.setCommunityIndexes(
            member.reduce(
                (idxs, c) => {
                    idxs[c.id.communityId] = c.membership.index;
                    return idxs;
                },
                {} as Record<string, number>,
            ),
        );
    }

    async setSelectedCommunity(
        id: CommunityIdentifier,
        inviteCode: string | null,
        clearChat = true,
    ): Promise<boolean> {
        let community = this._liveState.communities.get(id);
        if (community === undefined) {
            // if we don't have the community it means we're not a member and we need to look it up
            if (inviteCode) {
                await this.setCommunityInvite({ id, code: inviteCode });
            }

            const referredBy = this.extractReferralCodeFromPath() ?? this._referralCode;
            if (referredBy) {
                await this.setCommunityReferral(id, referredBy);
            }

            const resp = await this.sendRequest({
                kind: "getCommunitySummary",
                communityId: id.communityId,
            });
            if ("id" in resp) {
                // Make the community appear at the top of the list
                resp.membership.index = nextCommunityIndex();
                community = resp;
                addCommunityPreview(community);
            } else {
                // if we get here it means we're not a member of the community and we can't look it up
                // it may be private and we may not be invited.
                return false;
            }
        }

        if (clearChat) {
            this.clearSelectedChat();
        }

        if (community !== undefined) {
            this.loadCommunityDetails(community);
        }
        return true;
    }

    importToCommunity(
        groupId: GroupChatIdentifier,
        communityId: CommunityIdentifier,
    ): Promise<ChannelIdentifier | undefined> {
        const group = this._liveState.chatSummaries.get(groupId);
        return this.sendRequest({
            kind: "importGroupToCommunity",
            groupId,
            communityId,
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    if (group !== undefined) {
                        localChatSummaryUpdates.markAdded({
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
        return this.sendRequest({
            kind: "submitProofOfUniquePersonhood",
            iiPrincipal,
            credential,
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    this.user.update((user) => ({
                        ...user,
                        isUniquePerson: true,
                    }));
                    this.overwriteUserInStore(this._liveState.user.userId, (u) => ({
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
    ): Promise<ClientJoinCommunityResponse> {
        const approveResponse = await this.approveAccessGatePayment(community);
        if (approveResponse.kind !== "success") {
            return approveResponse;
        }

        return this.sendRequest({
            kind: "joinCommunity",
            id: community.id,
            credentialArgs: this.buildVerifiedCredentialArgs(credentials),
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    // Make the community appear at the top of the list
                    resp.community.membership.index = nextCommunityIndex();
                    this.addCommunityLocally(resp.community);
                    removeCommunityPreview(community.id);
                    this.loadCommunityDetails(resp.community);
                    messagesRead.batchUpdate(() => {
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
        const community = this._liveState.communities.get(id);
        if (community === undefined) return Promise.resolve(false);

        this.removeCommunityLocally(id);

        return this.sendRequest({ kind: "deleteCommunity", id })
            .then((resp) => {
                if (resp !== "success") {
                    this.addCommunityLocally(community);
                }
                return resp === "success";
            })
            .catch(() => false);
    }

    leaveCommunity(id: CommunityIdentifier): Promise<boolean> {
        const community = this._liveState.communities.get(id);
        if (community === undefined) return Promise.resolve(false);

        this.removeCommunityLocally(id);

        return this.sendRequest({ kind: "leaveCommunity", id })
            .then((resp) => {
                if (resp !== "success") {
                    this.addCommunityLocally(community);
                }
                return resp === "success";
            })
            .catch(() => false);
    }

    createCommunity(
        candidate: CommunitySummary,
        rules: Rules,
        defaultChannels: string[],
    ): Promise<CreateCommunityResponse> {
        return this.sendRequest({
            kind: "createCommunity",
            community: candidate,
            rules,
            defaultChannels,
            defaultChannelRules: defaultChatRules("channel"),
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    candidate.id = {
                        kind: "community",
                        communityId: resp.id,
                    };
                    this.addCommunityLocally(candidate);
                }
                return resp;
            })
            .catch(() => ({
                kind: "failure",
            }));
    }

    private addToFavouritesLocally(chatId: ChatIdentifier): void {
        globalStateStore.update((state) => {
            state.favourites.add(chatId);
            return state;
        });
    }

    private removeFromFavouritesLocally(chatId: ChatIdentifier): void {
        globalStateStore.update((state) => {
            state.favourites.delete(chatId);
            return state;
        });
    }

    addToFavourites(chatId: ChatIdentifier): Promise<boolean> {
        this.addToFavouritesLocally(chatId);
        return this.sendRequest({ kind: "addToFavourites", chatId })
            .then((resp) => {
                if (resp !== "success") {
                    this.removeFromFavouritesLocally(chatId);
                }
                return resp === "success";
            })
            .catch(() => {
                this.removeFromFavouritesLocally(chatId);
                return false;
            });
    }

    removeFromFavourites(chatId: ChatIdentifier): Promise<boolean> {
        this.removeFromFavouritesLocally(chatId);
        return this.sendRequest({ kind: "removeFromFavourites", chatId })
            .then((resp) => {
                if (resp !== "success") {
                    this.addToFavouritesLocally(chatId);
                }
                return resp === "success";
            })
            .catch(() => {
                this.addToFavouritesLocally(chatId);
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
        return this.sendRequest({
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
                    globalStateStore.update((g) => {
                        g.communities.set(community.id, community);
                        return g;
                    });
                    if (rules !== undefined && resp.rulesVersion !== undefined) {
                        communityStateStore.setProp(community.id, "rules", {
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
        return this.sendRequest({
            kind: "convertGroupToCommunity",
            chatId: group.id,
            historyVisible: group.historyVisible,
            rules,
        })
            .then((resp) => (resp.kind === "success" ? resp.id : undefined))
            .catch(() => undefined);
    }

    private deleteUserGroupLocally(id: CommunityIdentifier, userGroup: UserGroupDetails) {
        communityStateStore.updateProp(id, "userGroups", (groups) => {
            groups.delete(userGroup.id);
            return new Map(groups);
        });
    }

    private undeleteUserGroupLocally(id: CommunityIdentifier, userGroup: UserGroupDetails) {
        communityStateStore.updateProp(id, "userGroups", (groups) => {
            groups.set(userGroup.id, userGroup);
            return new Map(groups);
        });
    }

    deleteUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): Promise<boolean> {
        this.deleteUserGroupLocally(id, userGroup);
        return this.sendRequest({
            kind: "deleteUserGroups",
            communityId: id.communityId,
            userGroupIds: [userGroup.id],
        })
            .then((resp) => {
                if (resp.kind !== "success") {
                    this.undeleteUserGroupLocally(id, userGroup);
                }
                return resp.kind === "success";
            })
            .catch(() => {
                this.undeleteUserGroupLocally(id, userGroup);
                return false;
            });
    }

    createUserGroup(
        id: CommunityIdentifier,
        userGroup: UserGroupDetails,
    ): Promise<CreateUserGroupResponse> {
        return this.sendRequest({
            kind: "createUserGroup",
            communityId: id.communityId,
            name: userGroup.name,
            userIds: [...userGroup.members],
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    communityStateStore.updateProp(id, "userGroups", (groups) => {
                        groups.set(resp.userGroupId, { ...userGroup, id: resp.userGroupId });
                        return new Map(groups);
                    });
                }
                return resp;
            })
            .catch(() => CommonResponses.failure());
    }

    getCommunityForChannel(id: ChannelIdentifier): CommunitySummary | undefined {
        return this._liveState.communities.values().find((c) => {
            return c.channels.findIndex((ch) => chatIdentifiersEqual(ch.id, id)) >= 0;
        });
    }

    updateUserGroup(
        id: CommunityIdentifier,
        userGroup: UserGroupDetails,
        toAdd: Set<string>,
        toRemove: Set<string>,
    ): Promise<UpdateUserGroupResponse> {
        return this.sendRequest({
            kind: "updateUserGroup",
            communityId: id.communityId,
            userGroupId: userGroup.id,
            name: userGroup.name,
            usersToAdd: [...toAdd],
            usersToRemove: [...toRemove],
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    communityStateStore.updateProp(id, "userGroups", (groups) => {
                        groups.set(userGroup.id, userGroup);
                        return new Map(groups);
                    });
                }
                return resp;
            })
            .catch(() => CommonResponses.failure());
    }

    setChatListScope(scope: ChatListScope): void {
        if (scope.kind === "none") {
            chatListScopeStore.set(this.getDefaultScope());
        } else if (this._liveState.chatListScope !== scope) {
            chatListScopeStore.set(scope);
        }
    }

    getDefaultScope(): ChatListScope {
        if (this._liveState.anonUser) return { kind: "group_chat" };

        // sometimes we have to re-direct the user to home route "/"
        // However, with communities enabled it is not clear what this means
        // we actually need to direct the user to one of the global scopes "direct", "group" or "favourites"
        // which one we choose is kind of unclear and probably depends on the state
        const global = this._liveState.globalState;
        if (global.favourites.size > 0) return { kind: "favourite" };
        if (global.groupChats.size > 0) return { kind: "group_chat" };
        return { kind: "direct_chat" };
    }

    getUserLocation(): Promise<string | undefined> {
        if (this._userLocation !== undefined) {
            return Promise.resolve(this._userLocation);
        }
        return getUserCountryCode()
            .then((country) => {
                this._userLocation = country;
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
        if (this._liveState.user.isPlatformOperator) {
            return Promise.resolve(false);
        }
        return this.getUserLocation().then((location) => featureRestricted(location, "swap"));
    }

    setPinNumber(
        verification: Verification,
        newPin: string | undefined,
    ): Promise<SetPinNumberResponse> {
        pinNumberFailureStore.set(undefined);

        return this.sendRequest({ kind: "setPinNumber", verification, newPin }).then((resp) => {
            if (resp.kind === "success") {
                this.pinNumberRequiredStore.set(newPin !== undefined);
            } else if (
                resp.kind === "pin_incorrect" ||
                resp.kind === "pin_required" ||
                resp.kind === "too_main_failed_pin_attempts"
            ) {
                pinNumberFailureStore.set(resp as PinNumberFailures);
            }

            return resp;
        });
    }

    private promptForCurrentPin(message: string | undefined): Promise<string> {
        pinNumberFailureStore.set(undefined);

        return new Promise((resolve, reject) => {
            capturePinNumberStore.set({
                resolve: (pin: string) => {
                    capturePinNumberStore.set(undefined);
                    resolve(pin);
                },
                reject: () => {
                    capturePinNumberStore.set(undefined);
                    reject("cancelled");
                },
                message,
            });
        });
    }

    private promptForRuleAcceptance(): Promise<AcceptedRules | undefined> {
        return new Promise((resolve, _) => {
            captureRulesAcceptanceStore.set({
                resolve: (accepted: boolean) => {
                    let acceptedRules: AcceptedRules | undefined = undefined;

                    if (accepted) {
                        acceptedRules = {
                            chat: undefined,
                            community: undefined,
                        };

                        if (this._liveState.currentChatRules?.enabled ?? false) {
                            acceptedRules.chat = this._liveState.currentChatRules?.version;
                        }

                        if (this._liveState.currentCommunityRules?.enabled ?? false) {
                            acceptedRules.community =
                                this._liveState.currentCommunityRules?.version;
                        }
                    }

                    captureRulesAcceptanceStore.set(undefined);
                    resolve(acceptedRules);
                },
            });
        });
    }

    getStreak(userId: string | undefined) {
        if (userId === undefined) return 0;

        if (userId === this._liveState.user.userId) {
            const now = Date.now();
            return this._liveState.chitState.streakEnds < now
                ? 0
                : this._liveState.chitState.streak;
        }

        return this._liveState.userStore.get(userId)?.streak ?? 0;
    }

    claimDailyChit(): Promise<ClaimDailyChitResponse> {
        const userId = this._liveState.user.userId;

        return this.sendRequest({ kind: "claimDailyChit" }).then((resp) => {
            if (resp.kind === "success") {
                this.chitStateStore.update((state) => ({
                    chitBalance: resp.chitBalance,
                    streakEnds: resp.nextDailyChitClaim + BigInt(1000 * 60 * 60 * 24),
                    streak: resp.streak,
                    nextDailyChitClaim: resp.nextDailyChitClaim,
                    totalChitEarned: state.totalChitEarned + resp.chitEarned,
                }));
                this.overwriteUserInStore(userId, (user) => ({
                    ...user,
                    chitBalance: resp.chitBalance,
                    streak: resp.streak,
                }));
            } else if (resp.kind === "already_claimed") {
                this.chitStateStore.update((state) => ({
                    ...state,
                    nextDailyChitClaim: resp.nextDailyChitClaim,
                }));
            }

            return resp;
        });
    }

    chitLeaderboard(): Promise<ChitLeaderboardResponse> {
        return this.sendRequest({ kind: "chitLeaderboard" });
    }

    chitEvents(req: ChitEventsRequest): Promise<ChitEventsResponse> {
        return this.sendRequest(req).catch((err) => {
            this.logError("Failed to load chit events", err);
            return {
                events: [],
                total: 0,
            };
        });
    }

    getLinkedIIPrincipal(): Promise<string | undefined> {
        return this.sendRequest({
            kind: "getAuthenticationPrincipals",
        })
            .then((resp) => {
                const iiPrincipals = resp
                    .filter(
                        ({ originatingCanister }) =>
                            originatingCanister === process.env.INTERNET_IDENTITY_CANISTER_ID,
                    )
                    .map((p) => p.principal);
                if (iiPrincipals.length === 0) {
                    console.debug(
                        "No II principals found, we will have to ask the user to link one",
                    );
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
        approverKey: ECDSAKeyIdentity,
        approverDelegation: DelegationChain,
    ): Promise<LinkIdentitiesResponse> {
        return this.sendRequest({
            kind: "linkIdentities",
            initiatorKey: initiatorKey.getKeyPair(),
            initiatorDelegation: initiatorDelegation.toJSON(),
            initiatorIsIIPrincipal,
            approverKey: approverKey.getKeyPair(),
            approverDelegation: approverDelegation.toJSON(),
        });
    }

    removeTokenFromWallet(ledger: string) {
        const config = this._liveState.walletConfig;
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
        localGlobalUpdates.updateWallet(config);
        return this.sendRequest({
            kind: "configureWallet",
            config,
        })
            .then(() => true)
            .catch(() => false);
    }

    /**
     * Reactive state provided in the form of svelte stores
     */
    walletConfigStore = walletConfigStore;
    profileStore = profileStore;
    percentageStorageRemaining = percentageStorageRemaining;
    percentageStorageUsed = percentageStorageUsed;
    storageStore = storageStore;
    storageInGb = storageInGb;
    userStore = userStore;
    userCreatedStore = userCreatedStore;
    selectedAuthProviderStore = selectedAuthProviderStore;
    messagesRead = messagesRead;
    threadsFollowedByMeStore = threadsFollowedByMeStore;
    threadsByChatStore = threadsByChatStore;
    serverChatSummariesStore = serverChatSummariesStore;
    chatSummariesStore = chatSummariesStore;
    typersByContext = byContext;
    typing = typing;
    selectedChatId = selectedChatId;
    currentChatMembers = currentChatMembers;
    currentChatMembersMap = currentChatMembersMap;
    currentChatBlockedUsers = currentChatBlockedUsers;
    currentChatInvitedUsers = currentChatInvitedUsers;
    hideMessagesFromDirectBlocked = hideMessagesFromDirectBlocked;
    chatStateStore = chatStateStore;
    unconfirmed = unconfirmed;
    failedMessagesStore = failedMessagesStore;
    cryptoLookup = cryptoLookup;
    cryptoTokensSorted = cryptoTokensSorted;
    walletTokensSorted = walletTokensSorted;
    enhancedCryptoLookup = enhancedCryptoLookup;
    nervousSystemLookup = nervousSystemLookup;
    exchangeRatesLookupStore = exchangeRatesLookupStore;
    lastCryptoSent = lastCryptoSent;
    draftMessagesStore = draftMessagesStore;
    translationStore = translationStore;
    eventsStore = eventsStore;
    selectedChatStore = selectedChatStore;
    currentChatPinnedMessages = currentChatPinnedMessages;
    currentChatRules = currentChatRules;
    proposalTopicsStore = proposalTopicsStore;
    filteredProposalsStore = filteredProposalsStore;
    cryptoBalance = cryptoBalance;
    selectedServerChatStore = selectedServerChatStore;
    chatSummariesListStore = chatSummariesListStore;
    chatsLoading = chatsLoading;
    chatsInitialised = chatsInitialised;
    currentChatDraftMessage = currentChatDraftMessage;
    blockedUsers = blockedUsers;
    undeletingMessagesStore = undeletingMessagesStore;
    focusMessageIndex = focusMessageIndex;
    focusThreadMessageIndex = focusThreadMessageIndex;
    expandedDeletedMessages = expandedDeletedMessages;
    userGroupKeys = userGroupKeys;
    unconfirmedReadByThem = unconfirmedReadByThem;
    currentChatReplyingTo = currentChatReplyingTo;
    currentChatEditingEvent = currentChatEditingEvent;
    isProposalGroup = isProposalGroup;
    currentChatAttachment = currentChatAttachment;
    currentChatTextContent = currentChatTextContent;
    numberOfThreadsStore = numberOfThreadsStore;
    notificationStatus = notificationStatus;
    userMetrics = userMetrics;
    threadEvents = threadEvents;
    isDiamond = isDiamond;
    isLifetimeDiamond = isLifetimeDiamond;
    canExtendDiamond = canExtendDiamond;
    diamondStatus = diamondStatus;
    selectedThreadRootMessageIndex = selectedThreadRootMessageIndex;
    selectedMessageContext = selectedMessageContext;
    userGroupSummaries = userGroupSummaries;
    offlineStore = offlineStore;
    pinNumberRequiredStore = pinNumberRequiredStore;
    capturePinNumberStore = capturePinNumberStore;
    captureRulesAcceptanceStore = captureRulesAcceptanceStore;
    throttleDeadline = throttleDeadline;

    // current community stores
    chatListScope = chatListScopeStore;
    selectedCommunity = selectedCommunity;
    communities = communities;
    communitiesList = communitiesList;
    currentCommunityMembers = currentCommunityMembers;
    currentCommunityRules = currentCommunityRules;
    currentCommunityBlockedUsers = currentCommunityBlockedUsers;
    currentCommunityReferrals = currentCommunityReferrals;
    currentCommunityInvitedUsers = currentCommunityInvitedUsers;
    currentCommunityUserGroups = currentCommunityUserGroups;
    communityStateStore = communityStateStore;
    favouritesStore = favouritesStore;
    globalStateStore = globalStateStore;
    chitStateStore = chitStateStore;
    unreadGroupCounts = unreadGroupCounts;
    groupVideoCallCounts = groupVideoCallCounts;
    unreadDirectCounts = unreadDirectCounts;
    directVideoCallCounts = directVideoCallCounts;
    favouritesVideoCallCounts = favouritesVideoCallCounts;
    unreadFavouriteCounts = unreadFavouriteCounts;
    unreadCommunityChannelCounts = unreadCommunityChannelCounts;
    communityChannelVideoCallCounts = communityChannelVideoCallCounts;
    globalUnreadCount = globalUnreadCount;
    mergeCombinedUnreadCounts = mergeCombinedUnreadCounts;
    moderationFlags = moderationFlags;
    isEventKindHidden = isEventKindHidden;
}
