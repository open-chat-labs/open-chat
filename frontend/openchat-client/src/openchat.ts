/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { get, writable } from "svelte/store";
import { load } from "@fingerprintjs/botd";
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
} from "./utils/community";
import {
    buildUserAvatarUrl,
    canBlockUsers,
    canChangePermissions,
    canChangeRoles,
    canCreatePolls,
    canDeleteGroup,
    canDeleteOtherUsersMessages,
    canEditGroupDetails,
    canForward,
    canInviteUsers,
    canLeaveGroup,
    canMakePrivate,
    canPinMessages,
    canReactToMessages,
    canRemoveMembers,
    canReplyInThread,
    canSendMessages,
    canUnblockUsers,
    containsReaction,
    createMessage,
    findMessageById,
    getFirstUnreadMention,
    getMembersString,
    getMessageContent,
    groupBySender,
    groupChatFromCandidate,
    groupEvents,
    groupMessagesByDate,
    makeRtcConnections,
    markAllRead,
    mergeServerEvents,
    messageIsReadByThem,
    metricsEqual,
    newMessageId,
    sameUser,
    isFrozen,
    isPreviewing,
    buildTransactionLink,
    buildCryptoTransferText,
    mergeSendMessageResponse,
    serialiseMessageForRtc,
    canConvertToCommunity,
} from "./utils/chat";
import {
    buildUsernameList,
    compareIsNotYouThenUsername,
    compareUsername,
    formatLastOnlineDate,
    groupAvatarUrl,
    nullUser,
    userAvatarUrl,
} from "./utils/user";
import { rtcConnectionsManager } from "./utils/rtcConnectionsManager";
import { showTrace } from "./utils/profiling";
import { CachePrimer } from "./utils/cachePrimer";
import { Poller } from "./utils/poller";
import {
    idbAuthClientStore,
    lsAuthClientStore,
    selectedAuthProviderStore,
} from "./stores/authProviders";
import { blockedUsers } from "./stores/blockedUsers";
import { undeletingMessagesStore } from "./stores/undeletingMessages";
import {
    chatsInitialised,
    chatsLoading,
    chatStateStore,
    chatSummariesListStore,
    chatSummariesStore,
    chatUpdatedStore,
    clearSelectedChat,
    userMetrics,
    createDirectChat,
    currentChatBlockedUsers,
    currentChatInvitedUsers,
    currentChatDraftMessage,
    currentChatEditingEvent,
    currentChatFileToAttach,
    currentChatMembers,
    currentChatPinnedMessages,
    currentChatReplyingTo,
    currentChatRules,
    currentChatTextContent,
    currentUserStore,
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
    selectedThreadRootEvent,
    confirmedThreadEventIndexesLoadedStore,
    isContiguousInThread,
    focusThreadMessageIndex,
    selectedMessageContext,
    staleThreadsCount,
} from "./stores/chat";
import { cryptoBalance, lastCryptoSent } from "./stores/crypto";
import { draftThreadMessages } from "./stores/draftThreadMessages";
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
import { pinnedChatsStore } from "./stores/pinnedChats";
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
} from "./stores/user";
import { userCreatedStore } from "./stores/userCreated";
import { dataToBlobUrl } from "./utils/blob";
import { formatTokens, validateTokenInput } from "./utils/cryptoFormatter";
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
import { findLast, groupBy, groupWhile, toRecord2 } from "./utils/list";
import {
    audioRecordingMimeType,
    containsSocialVideoLink,
    DIAMOND_MAX_SIZES,
    fillMessage,
    FREE_MAX_SIZES,
    isSocialVideoLink,
    MaxMediaSizes,
    messageContentFromFile,
    twitterLinkRegex,
    youtubeRegex,
} from "./utils/media";
import { mergeKeepingOnlyChanged } from "./utils/object";
import { filterWebRtcMessage, parseWebRtcMessage } from "./utils/rtc";
import { toTitleCase } from "./utils/string";
import { formatRelativeTime, formatTimeRemaining } from "./utils/time";
import { initialiseTracking, startTrackingSession, trackEvent } from "./utils/tracking";
import { startSwCheckPoller } from "./utils/updateSw";
import type { OpenChatConfig } from "./config";
import {
    ChatsUpdated,
    ChatUpdated,
    LoadedMessageWindow,
    LoadedNewMessages,
    LoadedNewThreadMessages,
    LoadedPreviousMessages,
    LoadedPreviousThreadMessages,
    LoadedThreadMessageWindow,
    ReactionSelected,
    SelectedChatInvalid,
    SendingMessage,
    SendingThreadMessage,
    SendMessageFailed,
    SentMessage,
    SentThreadMessage,
    ThreadClosed,
    ThreadReactionSelected,
    ThreadSelected,
} from "./events";
import { LiveState } from "./liveState";
import { getTypingString } from "./utils/chat";
import { startTyping } from "./utils/chat";
import { stopTyping } from "./utils/chat";
import { indexIsInRanges } from "./utils/range";
import { OpenChatAgentWorker } from "./agentWorker";
import {
    type CreatedUser,
    type IdentityState,
    AuthProvider,
    type ThreadSyncDetails,
    type WebRtcMessage,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type GroupChatSummary,
    type MemberRole,
    type AccessRules,
    missingUserIds,
    type EventsResponse,
    type ChatEvent,
    type ThreadSummary,
    type DataContent,
    type SendMessageSuccess,
    type TransferSuccess,
    type User,
    type MessageContent,
    type EnhancedReplyContext,
    type RemoteUserToggledReaction,
    type RemoteUserSentMessage,
    type CheckUsernameResponse,
    type UserSummary,
    type RegisterUserResponse,
    type CurrentUserResponse,
    type RemoveMemberResponse,
    type RegisterProposalVoteResponse,
    type GroupInvite,
    type SearchDirectChatResponse,
    type SearchGroupChatResponse,
    type Cryptocurrency,
    type Tokens,
    type ThreadPreview,
    type UsersArgs,
    type UsersResponse,
    type PartialUserSummary,
    type PublicProfile,
    type SetUsernameResponse,
    type SetBioResponse,
    type PendingCryptocurrencyWithdrawal,
    type WithdrawCryptocurrencyResponse,
    type InviteCodeResponse,
    type EnableInviteCodeResponse,
    type DisableInviteCodeResponse,
    type ResetInviteCodeResponse,
    type UpdateGroupResponse,
    type CandidateGroupChat,
    type CreateGroupResponse,
    type Notification,
    getTimeUntilSessionExpiryMs,
    userIdsFromEvents,
    getContentAsText,
    indexRangeForChat,
    getDisplayDate,
    MessagesReadFromServer,
    StorageUpdated,
    UsersLoaded,
    type Logger,
    type ChatFrozenEvent,
    type ChatUnfrozenEvent,
    type UserStatus,
    userStatus,
    ThreadRead,
    DiamondMembershipDuration,
    DiamondMembershipDetails,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
    UpdatedEvent,
    compareRoles,
    AccessGate,
    ProposalVoteDetails,
    MessageReminderCreatedContent,
    InviteUsersResponse,
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
    CommunityPermissions,
    E8S_PER_TOKEN,
    CommunitySummary,
    CreateCommunityResponse,
    GroupSearchResponse,
    ChatPermissions,
    ChatIdentifier,
    ChatMap,
    chatIdentifiersEqual,
    GroupChatIdentifier,
    DirectChatIdentifier,
    type CommunityIdentifier,
    chatIdentifierToString,
    MessageContextMap,
    messageContextsEqual,
    ExploreCommunitiesResponse,
    MultiUserChatIdentifier,
    MultiUserChat,
    ChannelMatch,
    communityRoles,
    ChatListScope,
    ChatStateFull,
    ChannelIdentifier,
} from "openchat-shared";
import { failedMessagesStore } from "./stores/failedMessages";
import {
    canExtendDiamond,
    diamondMembership,
    isDiamond,
    diamondDurationToMs,
} from "./stores/diamond";
import {
    communities,
    communitiesList,
    communityStateStore,
    currentCommunityBlockedUsers,
    currentCommunityInvitedUsers,
    currentCommunityMembers,
    currentCommunityRules,
    selectedCommunity,
} from "./stores/community";
import {
    globalStateStore,
    favouritesStore,
    setGlobalState,
    updateSummaryWithConfirmedMessage,
    chatListScopeStore,
    unreadGroupChats,
    unreadDirectChats,
    unreadFavouriteChats,
    unreadCommunityChannels,
    globalUnreadCount,
} from "./stores/global";
import { localCommunitySummaryUpdates } from "./stores/localCommunitySummaryUpdates";

const UPGRADE_POLL_INTERVAL = 1000;
const MARK_ONLINE_INTERVAL = 61 * 1000;
const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const ONE_MINUTE_MILLIS = 60 * 1000;
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE_MILLIS;
const USER_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
const ONE_HOUR = 60 * ONE_MINUTE_MILLIS;
const MAX_USERS_TO_UPDATE_PER_BATCH = 500;
const MAX_INT32 = Math.pow(2, 31) - 1;
const communitiesEnabled = localStorage.getItem("openchat_communities_enabled") === "true";

export class OpenChat extends OpenChatAgentWorker {
    private _authClient: Promise<AuthClient>;
    private _identity: Identity | undefined;
    private _user: CreatedUser | undefined;
    private _liveState: LiveState;
    identityState = writable<IdentityState>("loading_user");
    private _logger: Logger;
    private _botDetected = false;
    private _lastOnlineDatesPending = new Set<string>();
    private _lastOnlineDatesPromise: Promise<Record<string, number>> | undefined;
    private _cachePrimer: CachePrimer | undefined = undefined;
    private _membershipCheck: number | undefined;
    private _referralCode: string | undefined = undefined;

    constructor(config: OpenChatConfig) {
        super(config);

        this.addEventListener("openchat_event", (ev) => this.handleAgentEvent(ev));

        this._logger = config.logger;
        this._liveState = new LiveState();

        console.log("OpenChatConfig: ", config);

        specialUsers.set({
            [OPENCHAT_BOT_USER_ID]: openChatBotUser,
            [config.proposalBotCanister]: proposalsBotUser(config.proposalBotCanister),
        });

        localStorage.removeItem("ic-delegation");
        localStorage.removeItem("ic-identity");
        this._authClient = AuthClient.create({
            idleOptions: {
                disableIdle: true,
                disableDefaultIdleCallback: true,
            },
            storage: idbAuthClientStore,
        });
        initialiseTracking(config);

        this._authClient.then((c) => c.getIdentity()).then((id) => this.loadedIdentity(id));

        chatUpdatedStore.subscribe((val) => {
            if (val !== undefined) {
                this.chatUpdated(val.chatId, val.updatedEvents);
                chatUpdatedStore.set(undefined);
            }
        });

        load()
            .then((botd) => botd.detect())
            .then((result) => {
                console.log("BOTD: ", result);
                this._botDetected = result.bot;
            })
            .catch((err) => console.error(err));
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
        if (latestMessage !== undefined && latestMessage.event.sender !== this.user.userId) {
            this.handleConfirmedMessageSentByOther(serverChat, latestMessage, undefined);
        }

        this.refreshUpdatedEvents(serverChat, updatedEvents);
        this.updateChatDetails(serverChat);
        this.dispatchEvent(new ChatUpdated());
    }

    private loadedIdentity(id: Identity) {
        this._identity = id;
        const anon = id.getPrincipal().isAnonymous();
        this.identityState.set(anon ? "requires_login" : "loading_user");
        if (!anon) {
            this.loadUser();
        }
    }

    logError(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.error(message, ...optionalParams);
    }

    logMessage(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.log(message, ...optionalParams);
    }

    logDebug(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.debug(message, ...optionalParams);
    }

    login(): void {
        this.identityState.set("logging_in");
        const authProvider = this._liveState.selectedAuthProvider;
        this._authClient.then((c) => {
            c.login({
                identityProvider: this.buildAuthProviderUrl(authProvider),
                maxTimeToLive: SESSION_TIMEOUT_NANOS,
                derivationOrigin: this.config.iiDerivationOrigin,
                onSuccess: () => this.loadedIdentity(c.getIdentity()),
                onError: (err) => {
                    throw new Error(err);
                },
            });
        });
    }

    private buildAuthProviderUrl(authProvider: AuthProvider): string | undefined {
        if (authProvider === AuthProvider.II) {
            return this.config.internetIdentityUrl;
        } else {
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
                    durationUntilSessionExpireMS
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
                    durationUntilSessionExpireMS
                );
                setTimeout(timeout, Math.min(MAX_TIMEOUT_MS, durationUntilLogoutMs));
            }
        });
    }

    private handleAgentEvent(ev: Event): void {
        if (ev instanceof MessagesReadFromServer) {
            messagesRead.syncWithServer(
                ev.detail.chatId,
                ev.detail.readByMeUpTo,
                ev.detail.threadsRead,
                ev.detail.dateReadPinned
            );
        }
        if (ev instanceof StorageUpdated) {
            storageStore.set(ev.detail);
        }
        if (ev instanceof UsersLoaded) {
            userStore.addMany(ev.detail);
        }
    }

    private async loadUser() {
        this._cachePrimer = new CachePrimer(this);
        await this.connectToWorker();
        this.sendRequest({ kind: "loadFailedMessages" }).then((res) =>
            failedMessagesStore.initialise(MessageContextMap.fromMap(res))
        );
        this.getCurrentUser()
            .then((user) => {
                switch (user.kind) {
                    case "unknown_user":
                        // TODO remove this once the principal migration can be done via the UI
                        const principalMigrationUserId = localStorage.getItem(
                            "openchat_principal_migration_user_id"
                        );
                        if (principalMigrationUserId !== null) {
                            console.log("Migrating user principal", principalMigrationUserId);
                            this.sendRequest({
                                kind: "migrateUserPrincipal",
                                userId: principalMigrationUserId,
                            });
                            return;
                        }

                        this.identityState.set("registering");
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
        const user = this._liveState.userStore[userId];
        if (user === undefined || user.kind === "bot") return false;

        if (userId === this.user.userId) return this._liveState.isDiamond;

        return user.diamond;
    }

    diamondExpiresIn(now: number, locale: string | null | undefined): string | undefined {
        if (this._liveState.diamondMembership !== undefined) {
            return formatRelativeTime(now, locale, this._liveState.diamondMembership.expiresAt);
        }
    }

    maxMediaSizes(): MaxMediaSizes {
        return this._liveState.isDiamond ? DIAMOND_MAX_SIZES : FREE_MAX_SIZES;
    }

    onCreatedUser(user: CreatedUser): void {
        if (this._identity === undefined) {
            throw new Error("onCreatedUser called before the user's identity has been established");
        }
        this._user = user;
        this.setDiamondMembership(user.diamondMembership);
        const id = this._identity;
        // TODO remove this once the principal migration can be done via the UI
        const principalMigrationNewPrincipal = localStorage.getItem(
            "openchat_principal_migration_new_principal"
        );
        if (principalMigrationNewPrincipal !== null) {
            console.log("Initializing user principal migration", principalMigrationNewPrincipal);
            this.sendRequest({ kind: "createUserClient", userId: user.userId });
            this.sendRequest({
                kind: "initUserPrincipalMigration",
                newPrincipal: principalMigrationNewPrincipal,
            });
            return;
        }

        if (user.canisterUpgradeStatus === "in_progress") {
            this.identityState.set("upgrading_user");
            window.setTimeout(() => this.loadUser(), UPGRADE_POLL_INTERVAL);
        } else {
            currentUserStore.set(user);
            this.sendRequest({ kind: "createUserClient", userId: user.userId });
            startMessagesReadTracker(this);
            this.startOnlinePoller();
            startSwCheckPoller();
            this.startSession(id).then(() => this.logout());
            new Poller(
                () => this.loadChats(),
                CHAT_UPDATE_INTERVAL,
                CHAT_UPDATE_IDLE_INTERVAL,
                true
            );
            new Poller(() => this.updateUsers(), USER_UPDATE_INTERVAL, USER_UPDATE_INTERVAL);
            initNotificationStores();
            this.sendRequest({ kind: "getUserStorageLimits" }).then(storageStore.set);
            this.identityState.set("logged_in");
            this.initWebRtc();

            if (this._botDetected && !this._user?.isSuspectedBot) {
                this.sendRequest({ kind: "markSuspectedBot" });
                console.log("markSuspectedBot");
            }
        }
    }

    private startOnlinePoller() {
        new Poller(
            () => this.sendRequest({ kind: "markAsOnline" }) ?? Promise.resolve(),
            MARK_ONLINE_INTERVAL,
            undefined,
            true
        );
    }

    logout(): Promise<void> {
        return this._authClient.then((c) => {
            return c.logout().then(() => window.location.replace("/"));
        });
    }

    get hasUser(): boolean {
        return this._user !== undefined;
    }

    get user(): CreatedUser {
        if (this._user === undefined) {
            throw new Error("OpenChat tried to access the current user before it has been set");
        }
        return this._user;
    }

    set user(user: CreatedUser) {
        this._user = user;
    }

    async showAuthProviders(): Promise<boolean> {
        const KEY_STORAGE_DELEGATION = "delegation";
        const ls = await lsAuthClientStore.get(KEY_STORAGE_DELEGATION);
        const idb = await idbAuthClientStore.get(KEY_STORAGE_DELEGATION);
        const noDelegation = ls == null && idb == null;
        return !this._liveState.userCreated && noDelegation;
    }

    unreadThreadMessageCount(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        latestMessageIndex: number
    ): number {
        return this.messagesRead.unreadThreadMessageCount(
            chatId,
            threadRootMessageIndex,
            latestMessageIndex
        );
    }

    unreadMessageCount(chatId: ChatIdentifier, latestMessageIndex: number | undefined): number {
        return this.messagesRead.unreadMessageCount(chatId, latestMessageIndex);
    }

    unreadPinned(chatId: MultiUserChatIdentifier, dateLastPinned: bigint | undefined): boolean {
        return this.messagesRead.unreadPinned(chatId, dateLastPinned);
    }

    markThreadRead(chatId: ChatIdentifier, threadRootMessageIndex: number, readUpTo: number): void {
        this.messagesRead.markThreadRead(chatId, threadRootMessageIndex, readUpTo);
    }

    markMessageRead(
        chatId: ChatIdentifier,
        messageIndex: number,
        messageId: bigint | undefined
    ): void {
        this.messagesRead.markMessageRead(chatId, messageIndex, messageId);
    }

    markPinnedMessagesRead(chatId: ChatIdentifier, dateLastPinned: bigint): void {
        this.messagesRead.markPinnedMessagesRead(chatId, dateLastPinned);
    }

    isMessageRead(
        chatId: ChatIdentifier,
        messageIndex: number,
        messageId: bigint | undefined
    ): boolean {
        return this.messagesRead.isRead(chatId, messageIndex, messageId);
    }

    private sendRtcMessage(userIds: string[], message: WebRtcMessage): void {
        rtcConnectionsManager.sendMessage(userIds, message);
    }

    private initWebRtc(): void {
        rtcConnectionsManager.init(this.user.userId, this.config.meteredApiKey).then((_) => {
            rtcConnectionsManager.subscribe((msg) =>
                this.handleWebRtcMessage(msg as WebRtcMessage)
            );
        });
    }

    previewChat(chatId: MultiUserChatIdentifier): Promise<boolean> {
        switch (chatId.kind) {
            case "group_chat":
                return this.sendRequest({ kind: "getPublicGroupSummary", chatId }).then(
                    (maybeChat) => {
                        if (maybeChat === undefined || maybeChat.frozen) {
                            return false;
                        }
                        addGroupPreview(maybeChat);
                        return true;
                    }
                );
            case "channel":
                return this.sendRequest({ kind: "getChannelSummary", chatId }).then((resp) => {
                    if (resp.kind === "failure") {
                        return false;
                    }
                    addGroupPreview(resp);
                    return true;
                });
        }
    }

    private async addMissingUsersFromMessage(message: EventWrapper<Message>): Promise<void> {
        const users = this.userIdsFromEvents([message]);
        await this.getMissingUsers(users);
    }

    toggleMuteNotifications(chatId: ChatIdentifier, muted: boolean): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { notificationsMuted: muted });
        return this.sendRequest({ kind: "toggleMuteNotifications", chatId, muted })
            .then((resp) => {
                if (resp !== "success") {
                    localChatSummaryUpdates.markUpdated(chatId, { notificationsMuted: undefined });
                }
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error toggling mute notifications", err);
                localChatSummaryUpdates.markUpdated(chatId, { notificationsMuted: undefined });
                return false;
            });
    }

    archiveChat(chatId: ChatIdentifier): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { archived: true });
        return this.sendRequest({ kind: "archiveChat", chatId })
            .then((resp) => {
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error archiving chat", err);
                localChatSummaryUpdates.markUpdated(chatId, { archived: undefined });
                return false;
            });
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { archived: false });
        return this.sendRequest({ kind: "unarchiveChat", chatId })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Error un-archiving chat", err);
                localChatSummaryUpdates.markUpdated(chatId, { archived: undefined });
                return false;
            });
    }

    private pinLocally(chatId: ChatIdentifier): void {
        pinnedChatsStore.pin(this._liveState.chatListScope.kind, chatId);
    }

    private unpinLocally(chatId: ChatIdentifier): void {
        pinnedChatsStore.unpin(this._liveState.chatListScope.kind, chatId);
    }

    pinChat(chatId: ChatIdentifier): Promise<boolean> {
        this.pinLocally(chatId);
        return this.sendRequest({ kind: "pinChat", chatId, communitiesEnabled })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Error pinning chat", err);
                this.unpinLocally(chatId);
                return false;
            });
    }

    unpinChat(chatId: ChatIdentifier): Promise<boolean> {
        this.unpinLocally(chatId);
        return this.sendRequest({ kind: "unpinChat", chatId, communitiesEnabled })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Error unpinning chat", err);
                this.pinLocally(chatId);
                return false;
            });
    }

    blockUserFromDirectChat(userId: string): Promise<boolean> {
        blockedUsers.add(userId);
        return this.sendRequest({ kind: "blockUserFromDirectChat", userId })
            .then((resp) => {
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error blocking user", err);
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
            .catch((err) => {
                this._logger.error("Error unblocking user", err);
                blockedUsers.add(userId);
                return false;
            });
    }

    setUserAvatar(data: Uint8Array): Promise<boolean> {
        this.user = {
            ...this.user,
            ...data,
        };

        const partialUser = this._liveState.userStore[this.user.userId];
        if (partialUser) {
            userStore.add({
                ...partialUser,
                ...data,
            });
        }

        return this.sendRequest({ kind: "setUserAvatar", data })
            .then((_resp) => true)
            .catch((err) => {
                this._logger.error("Failed to update user's avatar", err);
                return false;
            });
    }

    deleteGroup(chatId: MultiUserChatIdentifier): Promise<boolean> {
        // TODO we don't use the local updates mechnism here at the moment for some reason. Probably should.
        return this.sendRequest({ kind: "deleteGroup", chatId })
            .then((resp) => {
                if (resp === "success") {
                    this.removeChat(chatId);
                    return true;
                } else {
                    return false;
                }
            })
            .catch((err) => {
                this._logger.error("Unable to delete group", err);
                return false;
            });
    }

    leaveGroup(
        chatId: MultiUserChatIdentifier
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
            .catch((err) => {
                this._logger.error("Unable to leave group", err);
                return "failure";
            });
    }

    async joinGroup(
        chat: MultiUserChat
    ): Promise<"success" | "blocked" | "failure" | "gate_check_failed"> {
        return this.sendRequest({ kind: "joinGroup", chatId: chat.id })
            .then((resp) => {
                if (resp.kind === "success") {
                    localChatSummaryUpdates.markAdded(resp.group);
                    this.loadChatDetails(resp.group);
                    messagesRead.syncWithServer(
                        resp.group.id,
                        resp.group.membership?.readByMeUpTo,
                        [],
                        undefined
                    );
                } else {
                    if (resp.kind === "user_blocked") {
                        return "blocked";
                    } else if (resp.kind === "gate_check_failed") {
                        return "gate_check_failed";
                    }
                    return "failure";
                }
                return "success";
            })
            .then((resp) => {
                if (resp === "success" && this._liveState.groupPreviews.has(chat.id)) {
                    removeGroupPreview(chat.id);
                }
                return resp;
            })
            .catch((err) => {
                this._logger.error("Unable to join group", err);
                return "failure";
            });
    }

    updateGroupRules(
        chatId: MultiUserChatIdentifier,
        rules: AccessRules | undefined
    ): Promise<boolean> {
        return this.sendRequest({ kind: "updateGroup", chatId, rules })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Update group rules failed: ", err);
                return false;
            });
    }

    updateGroupPermissions(
        chatId: MultiUserChatIdentifier,
        originalPermissions: ChatPermissions,
        updatedPermissions: ChatPermissions
    ): Promise<boolean> {
        const optionalPermissions = this.mergeKeepingOnlyChanged(
            originalPermissions,
            updatedPermissions
        );

        return this.sendRequest({ kind: "updateGroup", chatId, permissions: optionalPermissions })
            .then((resp) => {
                if (resp !== "success") {
                    return false;
                }
                localChatSummaryUpdates.markUpdated(chatId, {
                    kind: "group_chat",
                    permissions: optionalPermissions,
                });
                return true;
            })
            .catch((err) => {
                this._logger.error("Update permissions failed: ", err);
                return false;
            });
    }

    /**
     * Wrap a bunch of pure utility functions
     */
    showTrace = showTrace;
    userAvatarUrl = userAvatarUrl;
    groupAvatarUrl = groupAvatarUrl;
    updateStorageLimit = updateStorageLimit;
    formatTokens = formatTokens;
    validateTokenInput = validateTokenInput;
    toShortTimeString = toShortTimeString;
    toMonthString = toMonthString;
    formatMessageDate = formatMessageDate;
    userIdsFromEvents = userIdsFromEvents;
    missingUserIds = missingUserIds;
    toRecord2 = toRecord2;
    toDatetimeString = toDatetimeString;
    getContentAsText = getContentAsText;
    groupBySender = groupBySender;
    groupBy = groupBy;
    getTypingString = getTypingString;

    communityAvatarUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
        return dataContent?.blobUrl ?? "/assets/wink.svg";
    }

    communityBannerUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
        return dataContent?.blobUrl ?? "/assets/landscape.png";
    }

    canBlockUsers(chatId: ChatIdentifier | CommunityIdentifier): boolean {
        switch (chatId.kind) {
            case "community":
                return this.communityPredicate(chatId, canBlockCommunityUsers);
            default:
                return this.chatPredicate(chatId, canBlockUsers);
        }
    }

    canCreatePolls(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canCreatePolls);
    }

    canDeleteOtherUsersMessages(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canDeleteOtherUsersMessages);
    }

    canPinMessages(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canPinMessages);
    }

    canReactToMessages(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canReactToMessages);
    }

    canReplyInThread(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, canReplyInThread);
    }

    canSendMessages(chatId: ChatIdentifier): boolean {
        return this.chatPredicate(chatId, (chat) =>
            canSendMessages(chat, this._liveState.userStore, this.config.proposalBotCanister)
        );
    }

    canChangeRoles(
        id: ChatIdentifier | CommunityIdentifier,
        currentRole: MemberRole,
        newRole: MemberRole
    ): boolean {
        switch (id.kind) {
            case "community":
                const found = communityRoles.find((r) => r === newRole);
                if (!found) return false;
                return this.communityPredicate(id, (community) =>
                    canChangeCommunityRoles(community, currentRole, newRole)
                );
            default:
                return this.chatPredicate(id, (chat) => canChangeRoles(chat, currentRole, newRole));
        }
    }

    canPromote(
        chatId: ChatIdentifier | CommunityIdentifier,
        currentRole: MemberRole,
        newRole: MemberRole
    ): boolean {
        return (
            compareRoles(newRole, currentRole) > 0 &&
            this.canChangeRoles(chatId, currentRole, newRole)
        );
    }

    canDemote(
        chatId: ChatIdentifier | CommunityIdentifier,
        currentRole: MemberRole,
        newRole: MemberRole
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

    canCreatePublicChannel(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canCreatePublicChannel);
    }

    canCreatePrivateChannel(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canCreatePrivateChannel);
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

    canMakePrivate = canMakePrivate;

    canMakeGroupPrivate(chatId: MultiUserChatIdentifier): boolean {
        return this.multiUserChatPredicate(chatId, canMakePrivate);
    }

    canConvertGroupToCommunity(chatId: GroupChatIdentifier): boolean {
        return this.multiUserChatPredicate(chatId, canConvertToCommunity);
    }

    canMakeCommunityPrivate(id: CommunityIdentifier): boolean {
        return this.communityPredicate(id, canMakePrivate);
    }

    canLeaveGroup(chatId: MultiUserChatIdentifier): boolean {
        return this.multiUserChatPredicate(chatId, canLeaveGroup);
    }

    isPreviewing(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.multiUserChatPredicate(chatId, isPreviewing);
    }

    isFrozen(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.multiUserChatPredicate(chatId, isFrozen);
    }

    isOpenChatBot(userId: string): boolean {
        return userId === OPENCHAT_BOT_USER_ID;
    }

    isReadOnly(): boolean {
        return (this._user?.suspensionDetails ?? undefined) != undefined;
    }

    isChatReadOnly(chatId: ChatIdentifier): boolean {
        if (chatId.kind === "direct_chat") return false;
        return this.isReadOnly() || this.isPreviewing(chatId);
    }

    private chatPredicate(
        chatId: ChatIdentifier,
        predicate: (chat: ChatSummary) => boolean
    ): boolean {
        const chat = this._liveState.chatSummaries.get(chatId);
        return chat !== undefined && predicate(chat);
    }

    private communityPredicate(
        communityId: CommunityIdentifier,
        predicate: (community: CommunitySummary) => boolean
    ): boolean {
        const community = this._liveState.communities.get(communityId);
        return community !== undefined && predicate(community);
    }

    private multiUserChatPredicate(
        chatId: MultiUserChatIdentifier,
        predicate: (chat: MultiUserChat) => boolean
    ): boolean {
        const chat = this._liveState.chatSummaries.get(chatId);
        return (
            chat !== undefined &&
            (chat.kind === "group_chat" || chat.kind === "channel") &&
            predicate(chat)
        );
    }

    isPlatformModerator(): boolean {
        return this.user.isPlatformModerator;
    }

    private createMessage = createMessage;
    private findMessageById = findMessageById;
    private getMessageContent = getMessageContent;
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
        type: "register" | "delete"
    ): Promise<boolean> {
        const userId = this.user.userId;

        localMessageUpdates.markPollVote(messageId, {
            answerIndex: answerIdx,
            type,
            userId,
        });

        return this.sendRequest({
            kind: "registerPollVote",
            chatId,
            messageIdx,
            answerIdx,
            voteType: type,
            threadRootMessageIndex,
        })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Poll vote failed: ", err);
                return false;
            });
    }

    deleteMessage(
        id: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        asPlatformModerator?: boolean
    ): Promise<boolean> {
        const chat = this._liveState.chatSummaries.get(id);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        localMessageUpdates.markDeleted(messageId, this.user.userId);

        const recipients = [...chatStateStore.getProp(id, "userIds")];
        const userId = this.user.userId;

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

        return this.sendRequest({
            kind: "deleteMessage",
            chatId: id,
            messageId,
            threadRootMessageIndex,
            asPlatformModerator,
        })
            .then((resp) => {
                const success = resp === "success";
                if (!success) {
                    _undelete();
                }
                return success;
            })
            .catch((err) => {
                _undelete();
                this._logger.error("Delete message failed: ", err);
                return false;
            });
    }

    undeleteMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        msg: Message
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
            .catch((err) => {
                this._logger.error("Undelete message failed: ", err);
                return false;
            })
            .finally(() => {
                undeletingMessagesStore.delete(msg.messageId);
            });
    }

    revealDeletedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex: number | undefined
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
            .catch((err) => {
                this._logger.error("Get deleted message failed: ", err);
                return false;
            });
    }

    private dispatchReactionSelected(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        kind: "add" | "remove"
    ): void {
        if (threadRootMessageIndex === undefined) {
            this.dispatchEvent(new ReactionSelected(messageId, kind));
        } else {
            this.dispatchEvent(new ThreadReactionSelected(messageId, kind));
        }
    }

    selectReaction(
        chatId: ChatIdentifier,
        userId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        reaction: string,
        username: string,
        kind: "add" | "remove"
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

        this.dispatchReactionSelected(threadRootMessageIndex, messageId, kind);

        const result = (
            kind == "add"
                ? this.sendRequest({
                      kind: "addReaction",
                      chatId,
                      messageId,
                      reaction,
                      username,
                      threadRootMessageIndex,
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
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootEvent: EventWrapper<Message>,
        initialLoad = false
    ): Promise<number | undefined> {
        if (threadRootEvent.event.thread === undefined) return undefined;

        const threadRootMessageIndex = threadRootEvent.event.messageIndex;

        const eventsResponse = await this.sendRequest({
            kind: "chatEventsWindow",
            eventIndexRange: [0, threadRootEvent.event.thread.latestEventIndex],
            chatId,
            messageIndex,
            latestClientMainEventIndex: threadRootEvent.event.thread?.latestEventIndex,
            threadRootMessageIndex: threadRootEvent.event.messageIndex,
        });

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return undefined;
        }

        this.clearThreadEvents();
        await this.handleThreadEventsResponse(chatId, threadRootMessageIndex, eventsResponse);

        this.dispatchEvent(new LoadedThreadMessageWindow(messageIndex, initialLoad));

        return messageIndex;
    }

    async loadEventWindow(
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootEvent?: EventWrapper<Message>,
        initialLoad = false
    ): Promise<number | undefined> {
        const clientChat = this._liveState.chatSummaries.get(chatId);
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        if (clientChat === undefined || this.isPrivatePreview(clientChat)) {
            return Promise.resolve(undefined);
        }

        if (messageIndex >= 0) {
            if (threadRootEvent !== undefined && threadRootEvent.event.thread !== undefined) {
                return this.loadThreadEventWindow(
                    chatId,
                    messageIndex,
                    threadRootEvent,
                    initialLoad
                );
            }

            const latestMessageIndex = clientChat.latestMessage?.event.messageIndex ?? 0;
            if (messageIndex > latestMessageIndex) {
                messageIndex = latestMessageIndex;
            }

            const range = indexRangeForChat(clientChat);
            const eventsPromise: Promise<EventsResponse<ChatEvent>> = this.sendRequest({
                kind: "chatEventsWindow",
                eventIndexRange: range,
                chatId,
                messageIndex,
                latestClientMainEventIndex: serverChat?.latestEventIndex,
                threadRootMessageIndex: undefined,
            });
            const eventsResponse = await eventsPromise;

            if (eventsResponse === undefined || eventsResponse === "events_failed") {
                return undefined;
            }

            await this.handleEventsResponse(clientChat, eventsResponse, false);

            this.dispatchEvent(new LoadedMessageWindow(messageIndex, initialLoad));

            return messageIndex;
        }
    }

    private async handleEventsResponse(
        chat: ChatSummary,
        resp: EventsResponse<ChatEvent>,
        keepCurrentEvents = true
    ): Promise<void> {
        if (resp === "events_failed") return;

        if (!keepCurrentEvents) {
            clearServerEvents(chat.id);
            chatStateStore.setProp(chat.id, "userGroupKeys", new Set<string>());
        } else if (!isContiguous(chat.id, resp.events)) {
            return;
        }

        const userIds = userIdsFromEvents(resp.events);
        await this.updateUserStore(chat.id, userIds);

        this.addServerEventsToStores(chat.id, resp.events, undefined);

        makeRtcConnections(
            this.user.userId,
            chat,
            resp.events,
            this._liveState.userStore,
            this.config.meteredApiKey
        );
    }

    private async updateUserStoreFromCommunityState(id: CommunityIdentifier): Promise<void> {
        const allUserIds = new Set<string>();
        communityStateStore.getProp(id, "members").forEach((m) => allUserIds.add(m.userId));
        communityStateStore.getProp(id, "blockedUsers").forEach((u) => allUserIds.add(u));
        communityStateStore.getProp(id, "invitedUsers").forEach((u) => allUserIds.add(u));
        await this.getMissingUsers(allUserIds);
    }

    private async updateUserStore(
        chatId: ChatIdentifier,
        userIdsFromEvents: Iterable<string>
    ): Promise<void> {
        const userId = this.user.userId;
        const allUserIds = new Set<string>();
        chatStateStore.getProp(chatId, "members").forEach((m) => allUserIds.add(m.userId));
        chatStateStore.getProp(chatId, "blockedUsers").forEach((u) => allUserIds.add(u));
        chatStateStore.getProp(chatId, "invitedUsers").forEach((u) => allUserIds.add(u));
        for (const u of userIdsFromEvents) {
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
    metricsEqual = metricsEqual;
    getMembersString = getMembersString;
    compareIsNotYouThenUsername = compareIsNotYouThenUsername;
    compareUsername = compareUsername;

    private blockUserLocally(chatId: ChatIdentifier, userId: string): void {
        chatStateStore.updateProp(chatId, "blockedUsers", (b) => new Set([...b, userId]));
        chatStateStore.updateProp(chatId, "members", (p) => p.filter((p) => p.userId !== userId));
    }

    private unblockUserLocally(
        chatId: ChatIdentifier,
        userId: string,
        addToMembers: boolean
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
                    username: this._liveState.userStore[userId]?.username ?? "unknown",
                },
            ]);
        }
    }

    blockUser(chatId: GroupChatIdentifier, userId: string): Promise<boolean> {
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
            .catch((err) => {
                this._logger.error("Error blocking user", err);
                this.unblockUserLocally(chatId, userId, true);
                return false;
            });
    }

    unblockUser(chatId: GroupChatIdentifier, userId: string): Promise<boolean> {
        this.unblockUserLocally(chatId, userId, false);
        return this.sendRequest({ kind: "unblockUserFromGroupChat", chatId, userId })
            .then((resp) => {
                if (resp !== "success") {
                    this.blockUserLocally(chatId, userId);
                    return false;
                }
                return true;
            })
            .catch((err) => {
                this._logger.error("Error blocking user", err);
                this.blockUserLocally(chatId, userId);
                return false;
            });
    }

    nullUser = nullUser;
    toTitleCase = toTitleCase;
    enableAllProposalFilters = enableAllProposalFilters;
    disableAllProposalFilters = disableAllProposalFilters;
    toggleProposalFilter = toggleProposalFilter;
    formatTimeRemaining = formatTimeRemaining;
    toDateString = toDateString;
    toLongDateString = toLongDateString;
    formatLastOnlineDate = formatLastOnlineDate;
    buildUserAvatarUrl = buildUserAvatarUrl;
    buildUsernameList = buildUsernameList;
    groupMessagesByDate = groupMessagesByDate;
    fillMessage = fillMessage;
    audioRecordingMimeType = audioRecordingMimeType;
    async createDirectChat(chatId: DirectChatIdentifier): Promise<boolean> {
        if (this._liveState.userStore[chatId.userId] === undefined) {
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
        threadMessageIndex?: number
    ): void {
        const clientChat = this._liveState.chatSummaries.get(chatId);
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        if (clientChat === undefined) {
            return;
        }

        setSelectedChat(this, clientChat, serverChat, messageIndex, threadMessageIndex);

        const { selectedChat, focusMessageIndex } = this._liveState;
        if (selectedChat !== undefined) {
            if (focusMessageIndex !== undefined) {
                this.loadEventWindow(chatId, focusMessageIndex, undefined, true).then(() => {
                    this.loadChatDetails(selectedChat);
                });
            } else {
                this.loadPreviousMessages(chatId, undefined, true).then(() => {
                    this.loadChatDetails(selectedChat);
                });
            }
            if (selectedChat.kind === "direct_chat") {
                const them = this._liveState.userStore[selectedChat.them.userId];
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

    openThread(threadRootEvent: EventWrapper<Message>, initiating: boolean): void {
        this.clearThreadEvents();
        selectedThreadRootEvent.set(threadRootEvent);
        if (!initiating && this._liveState.selectedChatId !== undefined) {
            if (this._liveState.focusThreadMessageIndex !== undefined) {
                this.loadEventWindow(
                    this._liveState.selectedChatId,
                    this._liveState.focusThreadMessageIndex,
                    threadRootEvent,
                    true
                );
            } else {
                this.loadPreviousMessages(this._liveState.selectedChatId, threadRootEvent, true);
            }
        }
        this.dispatchEvent(new ThreadSelected(threadRootEvent, initiating));
    }

    closeThread(): void {
        selectedThreadRootEvent.set(undefined);
        this.dispatchEvent(new ThreadClosed());
    }

    clearThreadEvents(): void {
        threadServerEventsStore.set([]);
    }

    async loadThreadMessages(
        chatId: ChatIdentifier,
        thread: ThreadSummary,
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number,
        clearEvents: boolean,
        initialLoad = false
    ): Promise<void> {
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return Promise.resolve();
        }

        const context = this._liveState.selectedMessageContext;

        if (context?.threadRootMessageIndex === undefined) return;

        const eventsResponse = await this.sendRequest({
            kind: "chatEvents",
            chatType: chat.kind,
            chatId,
            eventIndexRange: range,
            startIndex,
            ascending,
            threadRootMessageIndex,
            latestClientEventIndex: thread.latestEventIndex,
        });

        if (!messageContextsEqual(context, this._liveState.selectedMessageContext)) {
            // the selected thread has changed while we were loading the messages
            return;
        }

        if (eventsResponse !== undefined && eventsResponse !== "events_failed") {
            if (clearEvents) {
                threadServerEventsStore.set([]);
            }
            await this.handleThreadEventsResponse(chatId, threadRootMessageIndex, eventsResponse);

            makeRtcConnections(
                this.user.userId,
                chat,
                this._liveState.threadEvents,
                this._liveState.userStore,
                this.config.meteredApiKey
            );

            const isFollowedByMe =
                this._liveState.threadsFollowedByMe.get(chat.id)?.has(threadRootMessageIndex) ??
                false;
            if (isFollowedByMe) {
                const lastLoadedMessageIdx = this.lastMessageIndex(this._liveState.threadEvents);
                if (lastLoadedMessageIdx !== undefined) {
                    this.markThreadRead(chat.id, threadRootMessageIndex, lastLoadedMessageIdx);
                }
            }
            if (ascending) {
                this.dispatchEvent(new LoadedNewThreadMessages());
            } else {
                this.dispatchEvent(new LoadedPreviousThreadMessages(initialLoad));
            }
        }
    }

    private async handleThreadEventsResponse(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        resp: EventsResponse<ChatEvent>
    ): Promise<[EventWrapper<ChatEvent>[], Set<string>]> {
        if (resp === "events_failed") return [[], new Set()];

        // check that the thread has not changed
        if (threadRootMessageIndex !== this._liveState.selectedThreadRootMessageIndex)
            return [[], new Set()];

        const userIds = this.userIdsFromEvents(resp.events);
        await this.updateUserStore(chatId, userIds);

        const context = { chatId, threadRootMessageIndex };

        this.addServerEventsToStores(chatId, resp.events, threadRootMessageIndex);

        for (const event of resp.events) {
            if (event.event.kind === "message") {
                unconfirmed.delete(context, event.event.messageId);
            }
        }
        return [resp.events, userIds];
    }

    private lastMessageIndex(events: EventWrapper<ChatEvent>[]): number | undefined {
        for (let i = events.length - 1; i >= 0; i--) {
            const evt = events[i].event;
            if (evt.kind === "message") {
                return evt.messageIndex;
            }
        }
        return undefined;
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
        globalStateStore.update((state) => {
            state.communities.delete(id);
            return state;
        });
        if (this._liveState.communities.has(id)) {
            localCommunitySummaryUpdates.markRemoved(id);
        }
    }

    clearSelectedChat = clearSelectedChat;
    private mergeKeepingOnlyChanged = mergeKeepingOnlyChanged;
    messageContentFromFile(file: File): Promise<MessageContent> {
        return messageContentFromFile(file, this._liveState.isDiamond);
    }
    formatFileSize = formatFileSize;

    havePermissionsChanged(
        p1: ChatPermissions | CommunityPermissions,
        p2: ChatPermissions | CommunityPermissions
    ): boolean {
        const args = this.mergeKeepingOnlyChanged(p1, p2);
        return Object.keys(args).length > 0;
    }

    hasAccessGateChanged(current: AccessGate, original: AccessGate): boolean {
        if (current === original) return false;
        if (current.kind !== original.kind) return true;
        if (
            (current.kind === "openchat_gate" || current.kind === "sns1_gate") &&
            (original.kind === "openchat_gate" || original.kind === "sns1_gate")
        ) {
            return (
                current.minDissolveDelay !== original.minDissolveDelay ||
                current.minStakeE8s !== original.minStakeE8s
            );
        }
        return false;
    }

    getMinDissolveDelayDays(gate: AccessGate): number | undefined {
        if (gate.kind === "sns1_gate" || gate.kind === "openchat_gate") {
            return gate.minDissolveDelay
                ? gate.minDissolveDelay / (24 * 60 * 60 * 1000)
                : undefined;
        }
        return undefined;
    }

    getMinStakeInTokens(gate: AccessGate): number | undefined {
        if (gate.kind === "sns1_gate" || gate.kind === "openchat_gate") {
            return gate.minStakeE8s ? gate.minStakeE8s / E8S_PER_TOKEN : undefined;
        }
        return undefined;
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
        initialLoad = false
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
                thread,
                [0, thread.latestEventIndex],
                index,
                ascending,
                threadRootEvent.event.messageIndex,
                false,
                initialLoad
            );
        }

        const criteria = this.previousMessagesCriteria(serverChat);

        const eventsResponse = criteria
            ? await this.loadEvents(serverChat, criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return;
        }

        await this.handleEventsResponse(serverChat, eventsResponse);

        this.dispatchEvent(new LoadedPreviousMessages(initialLoad));
        return;
    }

    private loadEvents(
        serverChat: ChatSummary,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<ChatEvent>> {
        return this.sendRequest({
            kind: "chatEvents",
            chatType: serverChat.kind,
            chatId: serverChat.id,
            eventIndexRange: indexRangeForChat(serverChat),
            startIndex,
            ascending,
            threadRootMessageIndex: undefined,
            latestClientEventIndex: serverChat.latestEventIndex,
        });
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
        return chat.kind === "group_chat" ? chat.minVisibleEventIndex : 0;
    }

    private earliestLoadedIndex(chatId: ChatIdentifier): number | undefined {
        const confirmedLoaded = confirmedEventIndexesLoaded(chatId);
        return confirmedLoaded.length > 0 ? confirmedLoaded.index(0) : undefined;
    }

    async loadNewMessages(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>
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
                thread,
                [0, thread.latestEventIndex],
                index,
                ascending,
                threadRootEvent.event.messageIndex,
                false
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
                latestMessage as EventWrapper<Message>
            );
        }

        this.dispatchEvent(new LoadedNewMessages());
        return newLatestMessage;
    }

    morePreviousMessagesAvailable(
        chatId: ChatIdentifier,
        threadRootEvent?: EventWrapper<Message>
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
        threadRootEvent?: EventWrapper<Message>
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
        if (!communityStateStore.getProp(community.id, "detailsLoaded")) {
            const resp = await this.sendRequest({
                kind: "getCommunityDetails",
                id: community.id,
                lastUpdated: community.lastUpdated,
            });
            if (resp !== "failure") {
                communityStateStore.setProp(community.id, "detailsLoaded", true);
                communityStateStore.setProp(community.id, "members", resp.members);
                communityStateStore.setProp(community.id, "blockedUsers", resp.blockedUsers);
                communityStateStore.setProp(community.id, "invitedUsers", resp.invitedUsers);
                communityStateStore.setProp(community.id, "rules", resp.rules);
                communityStateStore.setProp(community.id, "lastUpdated", resp.lastUpdated);
            }
            await this.updateUserStoreFromCommunityState(community.id);
        } else {
            await this.updateCommunityDetails(community);
        }
    }

    private async updateCommunityDetails(community: CommunitySummary): Promise<void> {
        const lastUpdated = communityStateStore.getProp(community.id, "lastUpdated");
        if (lastUpdated !== undefined && lastUpdated < community.lastUpdated) {
            const gd = await this.sendRequest({
                kind: "getCommunityDetailsUpdates",
                id: community.id,
                previous: {
                    members: communityStateStore.getProp(community.id, "members"),
                    blockedUsers: communityStateStore.getProp(community.id, "blockedUsers"),
                    invitedUsers: communityStateStore.getProp(community.id, "invitedUsers"),
                    lastUpdated: communityStateStore.getProp(community.id, "lastUpdated"),
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    rules: communityStateStore.getProp(community.id, "rules")!,
                },
            });
            communityStateStore.setProp(community.id, "members", gd.members);
            communityStateStore.setProp(community.id, "blockedUsers", gd.blockedUsers);
            communityStateStore.setProp(community.id, "invitedUsers", gd.invitedUsers);
            communityStateStore.setProp(community.id, "rules", gd.rules);
            communityStateStore.setProp(community.id, "lastUpdated", gd.lastUpdated);
            await this.updateUserStoreFromCommunityState(community.id);
        }
    }

    private async loadChatDetails(clientChat: ChatSummary): Promise<void> {
        // currently this is only meaningful for group chats, but we'll set it up generically just in case
        if (clientChat.kind === "group_chat" || clientChat.kind === "channel") {
            if (!chatStateStore.getProp(clientChat.id, "detailsLoaded")) {
                const resp = await this.sendRequest({
                    kind: "getGroupDetails",
                    chatId: clientChat.id,
                    timestamp: clientChat.lastUpdated,
                });
                if (resp !== "failure") {
                    chatStateStore.setProp(clientChat.id, "detailsLoaded", true);
                    chatStateStore.setProp(clientChat.id, "members", resp.members);
                    chatStateStore.setProp(clientChat.id, "blockedUsers", resp.blockedUsers);
                    chatStateStore.setProp(clientChat.id, "invitedUsers", resp.invitedUsers);
                    chatStateStore.setProp(clientChat.id, "pinnedMessages", resp.pinnedMessages);
                    chatStateStore.setProp(clientChat.id, "rules", resp.rules);
                    chatStateStore.setProp(clientChat.id, "lastUpdated", resp.timestamp);
                }
                await this.updateUserStore(clientChat.id, []);
            } else {
                await this.updateChatDetails(clientChat);
            }
        }
    }

    private async updateChatDetails(clientChat: ChatSummary): Promise<void> {
        if (clientChat.kind === "group_chat" || clientChat.kind === "channel") {
            const timestamp = chatStateStore.getProp(clientChat.id, "lastUpdated");
            if (timestamp !== undefined && timestamp < clientChat.lastUpdated) {
                const gd = await this.sendRequest({
                    kind: "getGroupDetailsUpdates",
                    chatId: clientChat.id,
                    previous: {
                        members: chatStateStore.getProp(clientChat.id, "members"),
                        blockedUsers: chatStateStore.getProp(clientChat.id, "blockedUsers"),
                        invitedUsers: chatStateStore.getProp(clientChat.id, "invitedUsers"),
                        pinnedMessages: chatStateStore.getProp(clientChat.id, "pinnedMessages"),
                        timestamp: chatStateStore.getProp(clientChat.id, "lastUpdated"),
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        rules: chatStateStore.getProp(clientChat.id, "rules")!,
                    },
                });
                chatStateStore.setProp(clientChat.id, "members", gd.members);
                chatStateStore.setProp(clientChat.id, "blockedUsers", gd.blockedUsers);
                chatStateStore.setProp(clientChat.id, "invitedUsers", gd.invitedUsers);
                chatStateStore.setProp(clientChat.id, "pinnedMessages", gd.pinnedMessages);
                chatStateStore.setProp(clientChat.id, "rules", gd.rules);
                chatStateStore.setProp(clientChat.id, "lastUpdated", gd.timestamp);
                await this.updateUserStore(clientChat.id, []);
            }
        }
    }

    private buildBlobUrl(canisterId: string, blobId: bigint, blobType: "blobs" | "avatar"): string {
        return `${this.config.blobUrlPattern
            .replace("{canisterId}", canisterId)
            .replace("{blobType}", blobType)}${blobId}`;
    }

    // this is unavoidably duplicated from the agent
    private rehydrateDataContent<T extends DataContent>(
        dataContent: T,
        blobType: "blobs" | "avatar" = "blobs"
    ): T {
        const ref = dataContent.blobReference;
        return ref !== undefined
            ? {
                  ...dataContent,
                  blobData: undefined,
                  blobUrl: this.buildBlobUrl(ref.canisterId, ref.blobId, blobType),
              }
            : dataContent;
    }

    private async refreshUpdatedEvents(
        serverChat: ChatSummary,
        updatedEvents: UpdatedEvent[]
    ): Promise<void> {
        const confirmedLoaded = confirmedEventIndexesLoaded(serverChat.id);
        const confirmedThreadLoaded = this._liveState.confirmedThreadEventIndexesLoaded;
        const selectedThreadRootEvent = this._liveState.selectedThreadRootEvent;
        const selectedThreadRootMessageIndex = selectedThreadRootEvent?.event?.messageIndex;

        // Partition the updated events into those that belong to the currently selected thread and those that don't
        const [currentChatEvents, currentThreadEvents] = updatedEvents.reduce(
            ([chat, thread], e) => {
                if (e.threadRootMessageIndex !== undefined) {
                    if (
                        e.threadRootMessageIndex === selectedThreadRootMessageIndex &&
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
            [[], []] as [number[], number[]]
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
                            latestClientEventIndex: serverChat.latestEventIndex,
                        })
                      : this.sendRequest({
                            kind: "chatEventsByEventIndex",
                            chatId: serverChat.id,
                            eventIndexes: currentChatEvents,
                            threadRootMessageIndex: undefined,
                            latestClientEventIndex: serverChat.latestEventIndex,
                        })
                  ).then((resp) => this.handleEventsResponse(serverChat, resp));

        const threadEventPromise =
            currentThreadEvents.length === 0
                ? Promise.resolve()
                : this.sendRequest({
                      kind: "chatEventsByEventIndex",
                      chatId: serverChat.id,
                      eventIndexes: currentThreadEvents,
                      threadRootMessageIndex: selectedThreadRootMessageIndex,
                      latestClientEventIndex:
                          selectedThreadRootEvent?.event?.thread?.latestEventIndex,
                  }).then((resp) =>
                      this.handleThreadEventsResponse(
                          serverChat.id,
                          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                          selectedThreadRootMessageIndex!,
                          resp
                      )
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
            .catch((err) => {
                this._logger.error("Unpin message failed: ", err);
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
            .catch((err) => {
                this._logger.error("Pin message failed: ", err);
                this.removePinnedMessage(chatId, messageIndex);
                return false;
            });
    }

    private removeMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        userId: string,
        threadRootMessageIndex: number | undefined
    ): void {
        if (userId === this.user.userId) {
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
        if (threadRootMessageIndex === undefined) {
            messagesRead.removeUnconfirmedMessage(chatId, messageId);
        }
    }
    toggleProposalFilterMessageExpansion = toggleProposalFilterMessageExpansion;
    groupWhile = groupWhile;
    sameUser = sameUser;

    forwardMessage(chatId: ChatIdentifier, msg: Message): void {
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return;
        }

        // TODO check storage requirements

        const content = { ...msg.content };

        const [nextEventIndex, nextMessageIndex] = nextEventAndMessageIndexes();

        msg = {
            kind: "message",
            messageId: newMessageId(),
            messageIndex: nextMessageIndex,
            sender: this.user.userId,
            content,
            repliesTo: undefined,
            reactions: [],
            edited: false,
            forwarded: msg.content.kind !== "giphy_content",
            deleted: false,
        };
        const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

        this.sendRequest({
            kind: "sendMessage",
            chatType: chat.kind,
            chatId,
            user: this.user,
            mentioned: [],
            event,
        })
            .then(([resp, msg]) => {
                if (resp.kind === "success") {
                    this.onSendMessageSuccess(chatId, resp, msg, undefined);
                    trackEvent("forward_message");
                } else {
                    this.removeMessage(chatId, msg.messageId, this.user.userId, undefined);
                    failedMessagesStore.add({ chatId }, event);
                    this.dispatchEvent(
                        new SendMessageFailed(msg.content.kind === "crypto_content")
                    );
                }
            })
            .catch((err) => {
                this.removeMessage(chatId, event.event.messageId, this.user.userId, undefined);
                failedMessagesStore.add({ chatId }, event);
                this.dispatchEvent(new SendMessageFailed(msg.content.kind === "crypto_content"));
                this._logger.error("Exception forwarding message", err);
            });

        this.sendMessage(chat, event, undefined).then(() => {
            this.dispatchEvent(new SentMessage());
        });
    }

    private onSendMessageSuccess(
        chatId: ChatIdentifier,
        resp: SendMessageSuccess | TransferSuccess,
        msg: Message,
        threadRootMessageIndex: number | undefined
    ) {
        const event = mergeSendMessageResponse(msg, resp);
        this.addServerEventsToStores(chatId, [event], threadRootMessageIndex);
        if (threadRootMessageIndex === undefined) {
            updateSummaryWithConfirmedMessage(chatId, event);
        }
    }

    private addServerEventsToStores(
        chatId: ChatIdentifier,
        newEvents: EventWrapper<ChatEvent>[],
        threadRootMessageIndex: number | undefined
    ): void {
        if (newEvents.length === 0) {
            return;
        }

        if (threadRootMessageIndex === undefined && !isContiguous(chatId, newEvents)) {
            return;
        }

        if (threadRootMessageIndex !== undefined && !isContiguousInThread(newEvents)) {
            return;
        }

        const context = { chatId, threadRootMessageIndex };

        for (const event of newEvents) {
            if (event.event.kind === "message") {
                failedMessagesStore.delete(context, event.event.messageId);
                if (unconfirmed.delete(context, event.event.messageId)) {
                    if (threadRootMessageIndex === undefined) {
                        messagesRead.confirmMessage(
                            chatId,
                            event.event.messageIndex,
                            event.event.messageId
                        );
                    } else {
                        messagesRead.markThreadRead(
                            chatId,
                            threadRootMessageIndex,
                            event.event.messageIndex
                        );
                    }
                }
            }
        }

        if (threadRootMessageIndex === undefined) {
            chatStateStore.updateProp(chatId, "serverEvents", (events) =>
                mergeServerEvents(events, newEvents)
            );
        } else if (messageContextsEqual(context, this._liveState.selectedMessageContext)) {
            threadServerEventsStore.update((events) => mergeServerEvents(events, newEvents));
        }
    }

    private async sendMessage(
        clientChat: ChatSummary,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined
    ): Promise<void> {
        const context = { chatId: clientChat.id, threadRootMessageIndex };

        unconfirmed.add(context, messageEvent);
        failedMessagesStore.delete(context, messageEvent.event.messageId);

        rtcConnectionsManager.sendMessage([...chatStateStore.getProp(clientChat.id, "userIds")], {
            kind: "remote_user_sent_message",
            id: clientChat.id,
            messageEvent: serialiseMessageForRtc(messageEvent),
            userId: this.user.userId,
            threadRootMessageIndex,
        });

        if (threadRootMessageIndex === undefined) {
            // mark our own messages as read manually since we will not be observing them
            messagesRead.markMessageRead(
                clientChat.id,
                messageEvent.event.messageIndex,
                messageEvent.event.messageId
            );

            currentChatDraftMessage.clear(clientChat.id);
        }

        return;
    }

    deleteFailedMessage(
        chatId: ChatIdentifier,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
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
        chatId: ChatIdentifier,
        event: EventWrapper<Message>,
        currentEvents: EventWrapper<ChatEvent>[],
        threadRootMessageIndex?: number
    ): Promise<void> {
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return;
        }

        const context = { chatId, threadRootMessageIndex };

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

        const canRetry = this.canRetryMessage(retryEvent.event.content);

        // add the *new* event to unconfirmed
        unconfirmed.add(context, retryEvent);

        // TODO - what about mentions?
        this.sendRequest({
            kind: "sendMessage",
            chatType: chat.kind,
            chatId: chat.id,
            user: this.user,
            mentioned: [],
            event: retryEvent,
            threadRootMessageIndex,
        })
            .then(([resp, msg]) => {
                if (resp.kind === "success" || resp.kind === "transfer_success") {
                    this.onSendMessageSuccess(chatId, resp, msg, threadRootMessageIndex);
                    if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                        this.refreshAccountBalance(
                            msg.content.transfer.token,
                            this.user.cryptoAccount
                        );
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
                } else {
                    this.removeMessage(
                        chatId,
                        msg.messageId,
                        this.user.userId,
                        threadRootMessageIndex
                    );
                    failedMessagesStore.add(context, retryEvent);
                    this.dispatchEvent(new SendMessageFailed(!canRetry));
                }
            })
            .catch((err) => {
                this.removeMessage(
                    chatId,
                    event.event.messageId,
                    this.user.userId,
                    threadRootMessageIndex
                );
                failedMessagesStore.add(context, retryEvent);
                this._logger.error("Exception sending message", err);
                this.dispatchEvent(new SendMessageFailed(!canRetry));
            });
    }

    private canRetryMessage(content: MessageContent): boolean {
        return content.kind !== "poll_content";
    }

    sendMessageWithAttachment(
        chatId: ChatIdentifier,
        currentEvents: EventWrapper<ChatEvent>[],
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined,
        replyingTo: EnhancedReplyContext | undefined,
        threadRootMessageIndex: number | undefined
    ): void {
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return;
        }

        const context = { chatId, threadRootMessageIndex };

        if (textContent || fileToAttach) {
            const [nextEventIndex, nextMessageIndex] =
                threadRootMessageIndex !== undefined
                    ? nextEventAndMessageIndexesForThread(currentEvents)
                    : nextEventAndMessageIndexes();

            const msg = this.createMessage(
                this.user.userId,
                nextMessageIndex,
                textContent,
                replyingTo,
                fileToAttach
            );
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

            const canRetry = this.canRetryMessage(msg.content);

            this.sendRequest({
                kind: "sendMessage",
                chatType: chat.kind,
                chatId,
                user: this.user,
                mentioned,
                event,
                threadRootMessageIndex,
            })
                .then(([resp, msg]) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        this.onSendMessageSuccess(chatId, resp, msg, threadRootMessageIndex);
                        if (msg.kind === "message" && msg.content.kind === "crypto_content") {
                            const token = msg.content.transfer.token;
                            this.refreshAccountBalance(token, this.user.userId);
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
                    } else {
                        this.removeMessage(
                            chatId,
                            msg.messageId,
                            this.user.userId,
                            threadRootMessageIndex
                        );
                        if (canRetry) {
                            failedMessagesStore.add(context, event);
                        }
                        this.dispatchEvent(new SendMessageFailed(!canRetry));
                    }
                })
                .catch((err) => {
                    this.removeMessage(
                        chatId,
                        event.event.messageId,
                        this.user.userId,
                        threadRootMessageIndex
                    );
                    if (canRetry) {
                        failedMessagesStore.add(context, event);
                    }
                    this._logger.error("Exception sending message", err);
                    this.dispatchEvent(new SendMessageFailed(!canRetry));
                });

            if (threadRootMessageIndex !== undefined) {
                this.dispatchEvent(new SendingThreadMessage());
            } else {
                this.dispatchEvent(new SendingMessage());
            }

            // HACK - we need to defer this very slightly so that we can guarantee that we handle SendingMessage events
            // *before* the new message is added to the unconfirmed store. Is this nice? No it is not.
            window.setTimeout(() => {
                this.sendMessage(chat, event, threadRootMessageIndex).then(() => {
                    if (threadRootMessageIndex !== undefined) {
                        this.dispatchEvent(new SentThreadMessage(event));
                    } else {
                        this.dispatchEvent(new SentMessage());
                    }
                });
            }, 0);
        }
    }

    getFirstUnreadMention = getFirstUnreadMention;
    markAllRead = markAllRead;
    buildCryptoTransferText = buildCryptoTransferText;
    buildTransactionLink = buildTransactionLink;
    getDisplayDate = getDisplayDate;
    isSocialVideoLink = isSocialVideoLink;
    containsSocialVideoLink = containsSocialVideoLink;
    calculateMediaDimensions = calculateMediaDimensions;
    dataToBlobUrl = dataToBlobUrl;
    askForNotificationPermission = askForNotificationPermission;
    setSoftDisabled = setSoftDisabled;

    editMessageWithAttachment(
        chatId: ChatIdentifier,
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined,
        editingEvent: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<boolean> {
        const chat = this._liveState.chatSummaries.get(chatId);

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        if (textContent || fileToAttach) {
            const msg = {
                ...editingEvent.event,
                edited: true,
                content: this.getMessageContent(textContent ?? undefined, fileToAttach),
            };
            localMessageUpdates.markContentEdited(msg.messageId, msg.content);

            if (threadRootMessageIndex === undefined) {
                currentChatDraftMessage.clear(chatId);
            }

            return this.sendRequest({
                kind: "editMessage",
                chatId: chat.id,
                msg,
                threadRootMessageIndex,
            })
                .then((resp) => {
                    if (resp !== "success") {
                        localMessageUpdates.revertEditedContent(msg.messageId);
                        return false;
                    }
                    return true;
                })
                .catch((err) => {
                    this._logger.error("Exception sending message", err);
                    localMessageUpdates.revertEditedContent(msg.messageId);
                    return false;
                });
        }
        return Promise.resolve(false);
    }

    notificationReceived(notification: Notification): void {
        let chatId: ChatIdentifier;
        let threadRootMessageIndex: number | undefined = undefined;
        let message: EventWrapper<Message>;
        switch (notification.kind) {
            case "direct_notification": {
                chatId = notification.sender;
                threadRootMessageIndex = notification.threadRootMessageIndex;
                message = notification.message;
                break;
            }
            case "group_notification": {
                chatId = notification.chatId;
                threadRootMessageIndex = notification.threadRootMessageIndex;
                message = notification.message;
                break;
            }
            case "direct_reaction": {
                chatId = notification.them;
                message = notification.message;
                break;
            }
            case "group_reaction":
                chatId = notification.chatId;
                threadRootMessageIndex = notification.threadRootMessageIndex;
                message = notification.message;
                break;
            case "added_to_group_notification":
                return;
        }

        if (threadRootMessageIndex !== undefined) {
            // TODO fix this for thread messages
            return;
        }

        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        if (serverChat === undefined || serverChat.latestEventIndex >= message.index) {
            return;
        }

        this.sendRequest({
            kind: "setCachedMessageFromNotification",
            chatId,
            threadRootMessageIndex,
            message,
        });

        this.addMissingUsersFromMessage(message).then(() => {
            updateSummaryWithConfirmedMessage(chatId, message);
            this.handleConfirmedMessageSentByOther(serverChat, message, threadRootMessageIndex);
        });
    }

    private handleConfirmedMessageSentByOther(
        serverChat: ChatSummary,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined
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
            latestClientEventIndex: serverChat.latestEventIndex,
        }).then((m) => {
            this.handleEventsResponse(serverChat, {
                events: [m],
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
        message: RemoteUserToggledReaction
    ): void {
        const matchingMessage = this.findMessageById(message.messageId, events);
        const kind = message.added ? "add" : "remove";

        if (matchingMessage !== undefined) {
            this.dispatchReactionSelected(message.threadRootMessageIndex, message.messageId, kind);

            localMessageUpdates.markReaction(message.messageId, {
                reaction: message.reaction,
                kind: message.added ? "add" : "remove",
                userId: message.userId,
            });
        }
    }

    private handleWebRtcMessage(msg: WebRtcMessage): void {
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
                parsedMsg.threadRootMessageIndex
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
        threadRootMessageIndex: number | undefined
    ): void {
        switch (msg.kind) {
            case "remote_user_typing":
                typing.startTyping(
                    { chatId: fromChatId, threadRootMessageIndex: msg.threadRootMessageIndex },
                    msg.userId
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
        threadRootMessageIndex: number | undefined
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

        if (threadRootMessageIndex !== undefined) {
            this.dispatchEvent(new SendingThreadMessage());
        } else {
            this.dispatchEvent(new SendingMessage());
        }

        window.setTimeout(() => {
            unconfirmed.add(context, {
                ...message.messageEvent,
                index: eventIndex,
                event: {
                    ...message.messageEvent.event,
                    messageIndex,
                },
            });

            if (threadRootMessageIndex !== undefined) {
                this.dispatchEvent(new SentThreadMessage(message.messageEvent));
            } else {
                this.dispatchEvent(new SentMessage());
            }

            // since we will only get here if we actually have the thread open
            // we should mark read up to this message too
            if (threadRootMessageIndex !== undefined) {
                this.markThreadRead(chatId, threadRootMessageIndex, messageIndex);
            }
        }, 0);
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this.sendRequest({ kind: "checkUsername", username });
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this.sendRequest({ kind: "searchUsers", searchTerm, maxResults }).then((resp) => {
            userStore.addMany(resp);
            return resp;
        });
    }

    clearReferralCode(): void {
        localStorage.removeItem("openchat_referredby");
        this._referralCode = undefined;
    }

    captureReferralCode(): boolean {
        const qs = new URLSearchParams(window.location.search);
        const code = qs.get("ref") ?? undefined;
        let captured = false;
        if (code) {
            localStorage.setItem("openchat_referredby", code);
            captured = true;
        }
        this._referralCode = localStorage.getItem("openchat_referredby") ?? undefined;
        return captured;
    }

    registerUser(username: string): Promise<RegisterUserResponse> {
        return this.sendRequest({
            kind: "registerUser",
            username,
            referralCode: this._referralCode,
        }).then((res) => {
            if (res.kind === "success") {
                this.clearReferralCode();
            }
            return res;
        });
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.sendRequest({ kind: "getCurrentUser" }).then((response) => {
            if (response.kind === "created_user") {
                userCreatedStore.set(true);
                selectedAuthProviderStore.init(AuthProvider.II);
            }
            return response;
        });
    }

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.sendRequest({ kind: "subscriptionExists", p256dh_key });
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({ kind: "pushSubscription", subscription });
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({ kind: "removeSubscription", subscription });
    }

    private inviteUsersLocally(chatId: ChatIdentifier, userIds: string[]): void {
        chatStateStore.updateProp(chatId, "invitedUsers", (b) => new Set([...b, ...userIds]));
    }

    private uninviteUsersLocally(chatId: ChatIdentifier, userIds: string[]): void {
        chatStateStore.updateProp(chatId, "invitedUsers", (b) => {
            return new Set([...b].filter((u) => !userIds.includes(u)));
        });
    }

    inviteUsers(chatId: MultiUserChatIdentifier, userIds: string[]): Promise<InviteUsersResponse> {
        this.inviteUsersLocally(chatId, userIds);
        return this.sendRequest({ kind: "inviteUsers", chatId, userIds })
            .then((resp) => {
                if (resp !== "success") {
                    this.uninviteUsersLocally(chatId, userIds);
                }
                return resp;
            })
            .catch((err) => {
                this._logger.error("Error uninviting users", err);
                this.uninviteUsersLocally(chatId, userIds);
                return "failure";
            });
    }

    private inviteUsersToCommunityLocally(id: CommunityIdentifier, userIds: string[]): void {
        communityStateStore.updateProp(id, "invitedUsers", (b) => new Set([...b, ...userIds]));
    }

    private uninviteUsersToCommunityLocally(id: CommunityIdentifier, userIds: string[]): void {
        communityStateStore.updateProp(id, "invitedUsers", (b) => {
            return new Set([...b].filter((u) => !userIds.includes(u)));
        });
    }

    inviteUsersToCommunity(
        id: CommunityIdentifier,
        userIds: string[]
    ): Promise<InviteUsersResponse> {
        this.inviteUsersToCommunityLocally(id, userIds);
        return this.sendRequest({ kind: "inviteUsersToCommunity", id, userIds })
            .then((resp) => {
                if (resp !== "success") {
                    this.uninviteUsersToCommunityLocally(id, userIds);
                }
                return resp;
            })
            .catch((err) => {
                this._logger.error("Error inviting users to community", err);
                this.uninviteUsersToCommunityLocally(id, userIds);
                return "failure";
            });
    }

    removeMember(chatId: GroupChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        return this.sendRequest({ kind: "removeMember", chatId, userId });
    }

    changeCommunityRole(
        id: CommunityIdentifier,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole
    ): Promise<boolean> {
        if (newRole === oldRole) return Promise.resolve(true);

        // Update the local store
        communityStateStore.updateProp(id, "members", (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: newRole } : p))
        );
        return this.sendRequest({ kind: "changeCommunityRole", id, userId, newRole })
            .then((resp) => {
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error trying to change role: ", err);
                return false;
            })
            .then((success) => {
                if (!success) {
                    // Revert the local store
                    communityStateStore.updateProp(id, "members", (ps) =>
                        ps.map((p) => (p.userId === userId ? { ...p, role: oldRole } : p))
                    );
                }
                return success;
            });
    }

    changeRole(
        chatId: MultiUserChatIdentifier,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole
    ): Promise<boolean> {
        if (newRole === oldRole) return Promise.resolve(true);

        // Update the local store
        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: newRole } : p))
        );
        return this.sendRequest({ kind: "changeRole", chatId, userId, newRole })
            .then((resp) => {
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error trying to change role: ", err);
                return false;
            })
            .then((success) => {
                if (!success) {
                    // Revert the local store
                    chatStateStore.updateProp(chatId, "members", (ps) =>
                        ps.map((p) => (p.userId === userId ? { ...p, role: oldRole } : p))
                    );
                }
                return success;
            });
    }

    registerProposalVote(
        chatId: GroupChatIdentifier,
        messageIndex: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.sendRequest({ kind: "registerProposalVote", chatId, messageIndex, adopt });
    }

    getProposalVoteDetails(
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean
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
                .map((g) => chatIdentifierToString(g.id))
        );

        recommendedGroupExclusions.value().forEach((c) => exclusions.add(c));

        return this.sendRequest({ kind: "getRecommendedGroups", exclusions: [...exclusions] });
    }

    getGroupRules(chatId: MultiUserChatIdentifier): Promise<AccessRules | undefined> {
        return this.sendRequest({ kind: "getGroupRules", chatId });
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.sendRequest({ kind: "searchGroups", searchTerm, maxResults });
    }

    exploreCommunities(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        flags: number,
        languages: string[]
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
        pageSize: number
    ): Promise<ChannelMatch[]> {
        return this.sendRequest({ kind: "exploreChannels", id, searchTerm, pageIndex, pageSize });
    }

    dismissRecommendation(chatId: GroupChatIdentifier): Promise<void> {
        recommendedGroupExclusions.add(chatIdentifierToString(chatId));
        return this.sendRequest({ kind: "dismissRecommendation", chatId });
    }

    set groupInvite(value: GroupInvite) {
        this.sendRequest({
            kind: "groupInvite",
            value,
        });
    }

    searchChat(
        chatId: ChatIdentifier,
        searchTerm: string,
        userIds: string[],
        maxResults = 10
    ): Promise<SearchDirectChatResponse | SearchGroupChatResponse> {
        if (chatId.kind === "group_chat") {
            return this.sendRequest({
                kind: "searchGroupChat",
                chatId,
                searchTerm,
                userIds,
                maxResults,
            });
        } else if (chatId.kind === "direct_chat") {
            return this.sendRequest({
                kind: "searchDirectChat",
                chatId,
                searchTerm,
                maxResults,
            });
        } else {
            throw new Error("TODO - search chat not implemented for channels");
        }
    }

    refreshAccountBalance(crypto: Cryptocurrency, principal: string): Promise<Tokens> {
        return this.sendRequest({ kind: "refreshAccountBalance", crypto, principal }).then(
            (val) => {
                cryptoBalance.set(crypto, val);
                return val;
            }
        );
    }

    async threadPreviews(
        _chatId: ChatIdentifier | undefined,
        threadsByChat: ChatMap<ThreadSyncDetails[]>,
        serverChatSummaries: ChatMap<ChatSummary>
    ): Promise<ThreadPreview[]> {
        const request: ChatMap<[ThreadSyncDetails[], number | undefined]> = threadsByChat
            .entries()
            .reduce((map, [chatId, threads]) => {
                if (chatId.kind === "group_chat" || chatId.kind === "channel") {
                    const latestEventIndex = serverChatSummaries.get(chatId)?.latestEventIndex;
                    map.set(chatId, [threads, latestEventIndex]);
                }
                return map;
            }, new ChatMap<[ThreadSyncDetails[], number | undefined]>());

        return this.sendRequest({
            kind: "threadPreviews",
            threadsByChat: request.toMap(),
        }).then((threads) => {
            const events = threads.flatMap((t) => [t.rootMessage, ...t.latestReplies]);
            const userIds = this.userIdsFromEvents(events);
            this.getMissingUsers(userIds);
            return threads;
        });
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
            true
        );
    }

    getUsers(users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        const userGroups = users.userGroups
            .map((g) => ({ ...g, users: g.users.filter((u) => u !== undefined) }))
            .filter((g) => g.users.length > 0);

        if (userGroups.length === 0) {
            return Promise.resolve({
                users: [],
            });
        }

        return this.sendRequest({ kind: "getUsers", users: { userGroups }, allowStale }).then(
            (resp) => {
                userStore.addMany(resp.users);
                if (resp.serverTimestamp !== undefined) {
                    // If we went to the server, all users not returned are still up to date, so we mark them as such
                    const usersReturned = new Set<string>(resp.users.map((u) => u.userId));
                    const allOtherUsers = users.userGroups.flatMap((g) =>
                        g.users.filter((u) => !usersReturned.has(u))
                    );
                    userStore.setUpdated(allOtherUsers, resp.serverTimestamp);
                }
                return resp;
            }
        );
    }

    getUser(userId: string, allowStale = false): Promise<PartialUserSummary | undefined> {
        return this.sendRequest({ kind: "getUser", userId, allowStale }).then((resp) => {
            if (resp !== undefined) {
                userStore.add(resp);
            }
            return resp;
        });
    }

    getUserStatus(userId: string, now: number): Promise<UserStatus> {
        return this.getLastOnlineDate(userId, now).then((lastOnline) =>
            userStatus(lastOnline, Date.now())
        );
    }

    async getLastOnlineDate(userId: string, now: number): Promise<number | undefined> {
        const user = this._liveState.userStore[userId];
        if (user === undefined || user.kind === "bot") return undefined;

        if (userId === this.user.userId) return now;

        let lastOnline = lastOnlineDates.get(userId, now);
        if (lastOnline === undefined) {
            const response = await this.getLastOnlineDatesBatched([userId]);
            lastOnline = response[userId];
        }
        return lastOnline;
    }

    getPublicProfile(userId?: string): Promise<PublicProfile> {
        return this.sendRequest({ kind: "getPublicProfile", userId });
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.sendRequest({ kind: "setUsername", userId, username }).then((resp) => {
            if (resp === "success" && this._user !== undefined) {
                this._user = { ...this._user, username };
                this.overwriteUserInStore(userId, (user) => ({ ...user, username }));
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

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.sendRequest({ kind: "withdrawCryptocurrency", domain });
    }

    getGroupMessagesByMessageIndex(
        chatId: MultiUserChatIdentifier,
        messageIndexes: Set<number>
    ): Promise<EventsResponse<Message>> {
        const serverChat = this._liveState.serverChatSummaries.get(chatId);

        return this.sendRequest({
            kind: "getGroupMessagesByMessageIndex",
            chatId,
            messageIndexes,
            latestClientEventIndex: serverChat?.latestEventIndex,
        });
    }

    getInviteCode(chatId: GroupChatIdentifier): Promise<InviteCodeResponse> {
        return this.sendRequest({ kind: "getInviteCode", chatId });
    }

    enableInviteCode(chatId: GroupChatIdentifier): Promise<EnableInviteCodeResponse> {
        return this.sendRequest({ kind: "enableInviteCode", chatId });
    }

    disableInviteCode(chatId: GroupChatIdentifier): Promise<DisableInviteCodeResponse> {
        return this.sendRequest({ kind: "disableInviteCode", chatId });
    }

    resetInviteCode(chatId: GroupChatIdentifier): Promise<ResetInviteCodeResponse> {
        return this.sendRequest({ kind: "resetInviteCode", chatId });
    }

    updateGroup(
        chatId: MultiUserChatIdentifier,
        name?: string,
        desc?: string,
        rules?: AccessRules,
        permissions?: Partial<ChatPermissions>,
        avatar?: Uint8Array,
        gate?: AccessGate,
        isPublic?: boolean
    ): Promise<UpdateGroupResponse> {
        return this.sendRequest({
            kind: "updateGroup",
            chatId,
            name,
            desc,
            rules,
            permissions,
            avatar,
            gate,
            isPublic,
        }).then((resp) => {
            if (resp === "success") {
                localChatSummaryUpdates.markUpdated(chatId, {
                    kind: "group_chat",
                    name,
                    description: desc,
                    permissions,
                    gate,
                });
            }
            return resp;
        });
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

    markThreadSummaryUpdated(threadRootMessageId: bigint, summary: ThreadSummary): void {
        localMessageUpdates.markThreadSummaryUpdated(threadRootMessageId, summary);
    }

    broadcastMessageRead(chat: ChatSummary, messageId: bigint): void {
        if (chat.kind === "direct_chat") {
            const rtc: WebRtcMessage = {
                kind: "remote_user_read_message",
                messageId: messageId,
                id: chat.id,
                userId: this.user.userId,
            };
            this.sendRtcMessage([...this._liveState.currentChatUserIds], rtc);
        }
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
            .catch((err) => {
                this._logger.error("Unable to freeze group", err);
                return false;
            });
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
            .catch((err) => {
                this._logger.error("Unable to unfreeze group", err);
                return false;
            });
    }

    deleteFrozenGroup(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "deleteFrozenGroup", chatId })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to unfreeze group", err);
                return false;
            });
    }

    addHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "addHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to add hot group exclusion", err);
                return false;
            });
    }

    removeHotGroupExclusion(chatId: GroupChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "removeHotGroupExclusion", chatId })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to remove hot group exclusion", err);
                return false;
            });
    }

    suspendUser(userId: string, reason: string): Promise<boolean> {
        return this.sendRequest({ kind: "suspendUser", userId, reason })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to suspend user", err);
                return false;
            });
    }

    unsuspendUser(userId: string): Promise<boolean> {
        return this.sendRequest({ kind: "unsuspendUser", userId })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to un-suspend user", err);
                return false;
            });
    }

    setGroupUpgradeConcurrency(value: number): Promise<boolean> {
        return this.sendRequest({ kind: "setGroupUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to set group upgrade concurrency", err);
                return false;
            });
    }

    setUserUpgradeConcurrency(value: number): Promise<boolean> {
        return this.sendRequest({ kind: "setUserUpgradeConcurrency", value })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to set user upgrade concurrency", err);
                return false;
            });
    }

    private onChatFrozen(
        chatId: MultiUserChatIdentifier,
        event: EventWrapper<ChatFrozenEvent | ChatUnfrozenEvent>
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
            this.addServerEventsToStores(chatId, [event], undefined);
        }
    }

    // FIXME - this is duplicated
    private extractUserIdsFromMentions(text: string): string[] {
        return [...text.matchAll(/@UserId\(([\d\w-]+)\)/g)].map((m) => m[1]);
    }

    private userIdsFromChatSummaries(chats: ChatSummary[]): Set<string> {
        const userIds = new Set<string>();
        chats.forEach((chat) => {
            if (chat.kind === "direct_chat") {
                userIds.add(chat.them.userId);
            } else if (chat.latestMessage !== undefined) {
                userIds.add(chat.latestMessage.event.sender);
                this.extractUserIdsFromMentions(
                    getContentAsText((k) => k, chat.latestMessage.event.content)
                ).forEach((id) => userIds.add(id));
            }
        });
        return userIds;
    }

    private async updateUsers() {
        try {
            if (this.user === undefined) {
                console.log("Current user not set, cannot update users");
                return;
            }

            const allUsers = this._liveState.userStore;
            const usersToUpdate = new Set<string>([this.user.userId]);

            // Update all users we have direct chats with
            for (const chat of this._liveState.chatSummariesList) {
                if (chat.kind == "direct_chat") {
                    usersToUpdate.add(chat.them.userId);
                }
            }

            // Also update any users who haven't been updated for at least 24 hours
            const now = BigInt(Date.now());
            for (const user of Object.values(allUsers)) {
                if (now - user.updated > 24 * ONE_HOUR && user.kind === "user") {
                    usersToUpdate.add(user.userId);
                    if (usersToUpdate.size >= MAX_USERS_TO_UPDATE_PER_BATCH) {
                        break;
                    }
                }
            }

            console.log(`getting updates for ${usersToUpdate.size} user(s)`);
            const userGroups = groupBy<string, bigint>(usersToUpdate, (u) => {
                return allUsers[u]?.updated ?? BigInt(0);
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

    private updatePinnedChatStores(state: ChatStateFull): void {
        pinnedChatsStore.set({
            none: state.pinnedChats,
            group_chat: state.pinnedGroupChats,
            direct_chat: state.pinnedDirectChats,
            favourite: state.pinnedFavouriteChats,
            community: state.pinnedChannels,
        });
    }

    private async loadChats() {
        try {
            if (this.user === undefined) {
                console.log("Current user not set, cannot load chats");
                return;
            }
            const init = this._liveState.chatsInitialised;
            chatsLoading.set(!init);

            const chatsResponse = await this.sendRequest({
                kind: "getUpdates",
            });

            if (!init || chatsResponse.anyUpdates) {
                const updatedChats = (chatsResponse.state.directChats as ChatSummary[])
                    .concat(chatsResponse.state.groupChats)
                    .concat(chatsResponse.state.communities.flatMap((c) => c.channels));

                this.updateReadUpToStore(updatedChats);
                const chats = this._liveState.myServerChatSummaries.values();

                this._cachePrimer?.processChatUpdates(chats, updatedChats);

                const userIds = this.userIdsFromChatSummaries(updatedChats);
                if (!init) {
                    for (const userId of this.user.referrals) {
                        userIds.add(userId);
                    }
                }
                userIds.add(this.user.userId);
                await this.getMissingUsers(userIds);

                if (chatsResponse.state.blockedUsers !== undefined) {
                    blockedUsers.set(new Set(chatsResponse.state.blockedUsers));
                }

                this.updatePinnedChatStores(chatsResponse.state);

                setGlobalState(
                    chatsResponse.state.communities,
                    updatedChats,
                    chatsResponse.state.favouriteChats
                );

                if (this._liveState.uninitializedDirectChats.size > 0) {
                    for (const chat of updatedChats) {
                        if (this._liveState.uninitializedDirectChats.has(chat.id)) {
                            removeUninitializedDirectChat(chat.id);
                        }
                    }
                }

                const selectedChatId = this._liveState.selectedChatId;

                if (selectedChatId !== undefined) {
                    if (this._liveState.chatSummaries.get(selectedChatId) === undefined) {
                        clearSelectedChat();
                        this.dispatchEvent(new SelectedChatInvalid());
                    } else {
                        const updatedEvents = ChatMap.fromMap(chatsResponse.updatedEvents);
                        chatUpdatedStore.set({
                            chatId: selectedChatId,
                            updatedEvents: updatedEvents.get(selectedChatId) ?? [],
                        });
                    }
                }

                const avatarId = this._liveState.userStore[this.user.userId]?.blobReference?.blobId;
                if (chatsResponse.state.avatarId !== avatarId) {
                    const blobReference =
                        chatsResponse.state.avatarId === undefined
                            ? undefined
                            : {
                                  canisterId: this.user.userId,
                                  blobId: chatsResponse.state.avatarId,
                              };
                    const dataContent = {
                        blobReference,
                        blobData: undefined,
                        blobUrl: undefined,
                    };
                    const user = {
                        ...this._liveState.userStore[this.user.userId],
                        ...dataContent,
                    };
                    userStore.add(this.rehydrateDataContent(user, "avatar"));
                }

                // If the latest message in a chat is sent by the current user, then we know they must have read up to
                // that message, so we mark the chat as read up to that message if it isn't already. This happens when a
                // user sends a message on one device then looks at OpenChat on another.
                for (const chat of updatedChats) {
                    const latestMessage = chat.latestMessage?.event;
                    if (
                        latestMessage !== undefined &&
                        latestMessage.sender === this.user.userId &&
                        (chat.membership?.readByMeUpTo ?? -1) < latestMessage.messageIndex &&
                        !unconfirmed.contains({ chatId: chat.id }, latestMessage.messageId)
                    ) {
                        messagesRead.markReadUpTo(chat.id, latestMessage.messageIndex);
                    }
                }

                chatsInitialised.set(true);

                this.dispatchEvent(new ChatsUpdated());
            }
        } catch (err) {
            this.config.logger.error("Error loading chats", err as Error);
            throw err;
        } finally {
            chatsLoading.set(false);
        }
    }

    private async getLastOnlineDatesBatched(userIds: string[]): Promise<Record<string, number>> {
        userIds.forEach((u) => this._lastOnlineDatesPending.add(u));
        if (this._lastOnlineDatesPromise === undefined) {
            // Wait 50ms so that the last online dates can be retrieved in a single batch
            this._lastOnlineDatesPromise = new Promise((resolve) =>
                window.setTimeout(resolve, 50)
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
            const updates = userIds.reduce((updates, userId) => {
                updates[userId] = response[userId] ?? 0;
                return updates;
            }, {} as Record<string, number>);
            lastOnlineDates.set(Object.entries(updates), Date.now());
            return updates;
        } catch {
            return {};
        }
    }

    private updateReadUpToStore(chatSummaries: ChatSummary[]): void {
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
                    [] as ThreadRead[]
                );

                messagesRead.syncWithServer(
                    chat.id,
                    chat.membership?.readByMeUpTo,
                    threads,
                    chat.dateReadPinned
                );
            } else {
                messagesRead.syncWithServer(chat.id, chat.membership.readByMeUpTo, [], undefined);
            }
        }
    }

    claimPrize(chatId: GroupChatIdentifier, messageId: bigint): Promise<boolean> {
        return this.sendRequest({ kind: "claimPrize", chatId, messageId })
            .then((resp) => {
                if (resp.kind !== "success") {
                    return false;
                } else {
                    localMessageUpdates.markPrizeClaimed(messageId, this.user.userId);
                    return true;
                }
            })
            .catch((err) => {
                this._logger.error("Claiming prize failed", err);
                return false;
            });
    }

    private overwriteUserInStore(
        userId: string,
        updater: (user: PartialUserSummary) => PartialUserSummary | undefined
    ): void {
        const user = this._liveState.userStore[userId];
        if (user !== undefined) {
            const updated = updater(user);
            if (updated !== undefined) {
                userStore.add(updated);
            }
        }
    }

    private updateDiamondStatusInUserStore(now: number, details?: DiamondMembershipDetails): void {
        const diamond = details !== undefined && Number(details.expiresAt) > now;
        this.overwriteUserInStore(this.user.userId, (user) =>
            user.diamond !== diamond ? { ...user, diamond } : undefined
        );
    }

    private setDiamondMembership(details?: DiamondMembershipDetails): void {
        diamondMembership.set(details);
        const now = Date.now();
        this.updateDiamondStatusInUserStore(now, details);
        if (details !== undefined) {
            const expiry = Number(details.expiresAt);
            if (expiry > now) {
                if (this._membershipCheck !== undefined) {
                    window.clearTimeout(this._membershipCheck);
                }
                const interval = expiry - now;
                this._membershipCheck = window.setTimeout(() => {
                    this.sendRequest({ kind: "getCurrentUser" }).then((user) => {
                        if (user.kind === "created_user") {
                            this.setDiamondMembership(user.diamondMembership);
                        } else {
                            diamondMembership.set(undefined);
                        }
                    });
                    this._membershipCheck = undefined;
                }, Math.min(MAX_INT32, interval));
            }
        }
    }

    payForDiamondMembership(
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<boolean> {
        return this.sendRequest({
            kind: "payForDiamondMembership",
            userId: this.user.userId,
            token,
            duration,
            recurring,
            expectedPriceE8s,
        })
            .then((resp) => {
                if (resp.kind !== "success") {
                    return false;
                } else {
                    this._user = {
                        ...this.user,
                        diamondMembership: resp.details,
                    };
                    this.setDiamondMembership(resp.details);
                    return true;
                }
            })
            .catch((err) => {
                this._logger.error("Paying for diamond membership failed", err);
                return false;
            });
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number
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
            .catch((err) => {
                this._logger.error("Unable to set message reminder", err);
                return false;
            });
    }

    cancelMessageReminder(
        messageId: bigint,
        content: MessageReminderCreatedContent
    ): Promise<boolean> {
        localMessageUpdates.markCancelled(messageId, content);
        return this.sendRequest({
            kind: "cancelMessageReminder",
            reminderId: content.reminderId,
        }).catch((err) => {
            localMessageUpdates.revertCancelled(messageId);
            this._logger.error("Unable to cancel message reminder", err);
            return false;
        });
    }

    reportMessage(
        chatId: MultiUserChatIdentifier,
        eventIndex: number,
        reasonCode: number,
        notes: string | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<boolean> {
        return this.sendRequest({
            kind: "reportMessage",
            chatId,
            eventIndex,
            reasonCode,
            notes,
            threadRootMessageIndex,
        })
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Unable to set report message", err);
                return false;
            });
    }

    declineInvitation(chatId: MultiUserChatIdentifier): Promise<boolean> {
        return this.sendRequest({ kind: "declineInvitation", chatId })
            .then((res) => {
                return res === "success";
            })
            .catch((err) => {
                this._logger.error("Failed to decline invitation", err);
                return false;
            });
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs
    ): Promise<UpdateMarketMakerConfigResponse> {
        return this.sendRequest({ kind: "updateMarketMakerConfig", ...config });
    }

    getReferralLeaderboard(args?: ReferralLeaderboardRange): Promise<ReferralLeaderboardResponse> {
        return this.sendRequest({ kind: "getReferralLeaderboard", args });
    }

    usernameAndIcon(user?: PartialUserSummary): string {
        return user !== undefined
            ? `${user?.username}  ${user?.diamond ? "💎" : ""}`
            : this.config.i18nFormatter("unknownUser");
    }

    ledgerCanisterId(token: Cryptocurrency): string {
        switch (token) {
            case "chat":
                return this.config.ledgerCanisterCHAT;

            case "icp":
                return this.config.ledgerCanisterICP;

            case "ckbtc":
                return this.config.ledgerCanisterBTC;

            case "sns1":
                return this.config.ledgerCanisterSNS1;

            case "kinic":
                return this.config.ledgerCanisterKINIC;
        }
    }

    // **** Communities Stuff

    // TODO - this will almost certainly need to be more complicated
    async setSelectedCommunity(id: CommunityIdentifier, clearChat = true): Promise<boolean> {
        let community = this._liveState.communities.get(id);
        if (community === undefined) {
            // if we don't have the community it means we're not a member and we need to look it up
            const resp = await this.sendRequest({
                kind: "getCommunitySummary",
                communityId: id.communityId,
            });
            if ("id" in resp) {
                community = resp;
                globalStateStore.update((global) => {
                    global.communities.set(resp.id, resp);
                    return global;
                });
            } else {
                // if we get here it means we're not a member of the community and we can't look it up
                // it may be private and we may not be invited.
                return false;
            }
        }

        communityStateStore.clear(id);
        chatListScopeStore.set({ kind: "community", id });
        if (clearChat) {
            this.clearSelectedChat();
        }

        if (community !== undefined) {
            this.loadCommunityDetails(community);
        }
        return true;
    }

    joinCommunity(id: CommunityIdentifier): Promise<"success" | "failure" | "gate_check_failed"> {
        return this.sendRequest({ kind: "joinCommunity", id })
            .then((resp) => {
                if (resp.kind === "success") {
                    localCommunitySummaryUpdates.markAdded(resp.community);
                    this.loadCommunityDetails(resp.community);
                } else {
                    if (resp.kind === "gate_check_failed") {
                        return "gate_check_failed";
                    }
                    return "failure";
                }
                return "success";
            })
            .catch((err) => {
                this._logger.error("Unable to join community", err);
                return "failure";
            });
    }

    deleteCommunity(id: CommunityIdentifier): Promise<boolean> {
        localCommunitySummaryUpdates.markRemoved(id);
        return this.sendRequest({ kind: "deleteCommunity", id })
            .then((resp) => {
                if (resp !== "success") {
                    const community = this._liveState.communities.get(id);
                    if (community) {
                        localCommunitySummaryUpdates.markAdded(community);
                    }
                }
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error deleting community", err);
                return false;
            });
    }

    leaveCommunity(id: CommunityIdentifier): Promise<boolean> {
        localCommunitySummaryUpdates.markRemoved(id);
        return this.sendRequest({ kind: "leaveCommunity", id })
            .then((resp) => {
                if (resp !== "success") {
                    const community = this._liveState.communities.get(id);
                    if (community) {
                        localCommunitySummaryUpdates.markAdded(community);
                    }
                }
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error leaving community", err);
                return false;
            });
    }

    createCommunity(
        candidate: CommunitySummary,
        rules: AccessRules,
        defaultChannels: string[]
    ): Promise<CreateCommunityResponse> {
        return this.sendRequest({
            kind: "createCommunity",
            community: candidate,
            rules,
            defaultChannels,
        }).catch((err) => {
            this._logger.error("Error creating community", err);
            return { kind: "failure" };
        });
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
            .catch((err) => {
                this.removeFromFavouritesLocally(chatId);
                this._logger.error("Error adding chat to favourites", err);
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
            .catch((err) => {
                this.addToFavouritesLocally(chatId);
                this._logger.error("Error removing chat from favourites", err);
                return false;
            });
    }

    saveCommunity(
        community: CommunitySummary,
        name: string | undefined,
        description: string | undefined,
        rules: AccessRules | undefined,
        permissions: CommunityPermissions | undefined,
        avatar: Uint8Array | undefined,
        banner: Uint8Array | undefined,
        gate: AccessGate | undefined,
        isPublic: boolean | undefined,
        primaryLanguage: string | undefined
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
            gate,
            isPublic,
            primaryLanguage,
        })
            .then((resp) => {
                if (resp.kind === "success") {
                    globalStateStore.update((g) => {
                        g.communities.set(community.id, community);
                        return g;
                    });
                    if (rules) {
                        communityStateStore.setProp(community.id, "rules", rules);
                    }
                    return true;
                }
                return false;
            })
            .catch((err) => {
                this._logger.error("Error creating community", err);
                return false;
            });
    }

    convertGroupToCommunity(
        group: GroupChatSummary,
        rules: AccessRules
    ): Promise<ChannelIdentifier | undefined> {
        return this.sendRequest({
            kind: "convertGroupToCommunity",
            chatId: group.id,
            historyVisible: group.historyVisible,
            rules,
        })
            .then((resp) => (resp.kind === "success" ? resp.id : undefined))
            .catch((err) => {
                this._logger.error("Error converting group to community", err);
                return undefined;
            });
    }

    setChatListScope(scope: ChatListScope): void {
        chatListScopeStore.set(scope);
    }

    // **** End of Communities stuff

    diamondDurationToMs = diamondDurationToMs;

    /**
     * Reactive state provided in the form of svelte stores
     */
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
    currentChatBlockedUsers = currentChatBlockedUsers;
    currentChatInvitedUsers = currentChatInvitedUsers;
    chatStateStore = chatStateStore;
    unconfirmed = unconfirmed;
    failedMessagesStore = failedMessagesStore;
    lastCryptoSent = lastCryptoSent;
    draftThreadMessages = draftThreadMessages;
    translationStore = translationStore;
    eventsStore = eventsStore;
    selectedChatStore = selectedChatStore;
    currentChatPinnedMessages = currentChatPinnedMessages;
    currentChatRules = currentChatRules;
    proposalTopicsStore = proposalTopicsStore;
    filteredProposalsStore = filteredProposalsStore;
    cryptoBalance = cryptoBalance;
    selectedServerChatStore = selectedServerChatStore;
    pinnedChatsStore = pinnedChatsStore;
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
    currentChatFileToAttach = currentChatFileToAttach;
    currentChatTextContent = currentChatTextContent;
    numberOfThreadsStore = numberOfThreadsStore;
    notificationStatus = notificationStatus;
    userMetrics = userMetrics;
    threadEvents = threadEvents;
    isDiamond = isDiamond;
    canExtendDiamond = canExtendDiamond;
    diamondMembership = diamondMembership;
    selectedThreadRootEvent = selectedThreadRootEvent;
    selectedThreadRootMessageIndex = selectedThreadRootMessageIndex;
    selectedMessageContext = selectedMessageContext;

    // current community stores
    chatListScope = chatListScopeStore;
    selectedCommunity = selectedCommunity;
    communities = communities;
    communitiesList = communitiesList;
    currentCommunityMembers = currentCommunityMembers;
    currentCommunityRules = currentCommunityRules;
    currentCommunityBlockedUsers = currentCommunityBlockedUsers;
    currentCommunityInvitedUsers = currentCommunityInvitedUsers;
    communityStateStore = communityStateStore;
    favouritesStore = favouritesStore;
    globalStateStore = globalStateStore;
    unreadGroupChats = unreadGroupChats;
    unreadDirectChats = unreadDirectChats;
    unreadFavouriteChats = unreadFavouriteChats;
    unreadCommunityChannels = unreadCommunityChannels;
    globalUnreadCount = globalUnreadCount;
    staleThreadsCount = staleThreadsCount;
}
