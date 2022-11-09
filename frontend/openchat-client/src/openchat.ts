/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import DRange from "drange";
import { AuthClient } from "@dfinity/auth-client";
import { writable } from "svelte/store";
import {
    buildUserAvatarUrl,
    canAddMembers,
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
    canMakeGroupPrivate,
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
    getStorageRequiredForMessage,
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
    isPreviewing,
    buildTransactionLink,
    buildCryptoTransferText,
    mergeSendMessageResponse,
    upToDate,
    serialiseMessageForRtc,
} from "./utils/chat";
import {
    buildUsernameList,
    compareIsNotYouThenUsername,
    compareUsername,
    formatLastOnlineDate,
    groupAvatarUrl,
    nullUser,
    phoneNumberToString,
    userAvatarUrl,
} from "./utils/user";
import { rtcConnectionsManager } from "./utils/rtcConnectionsManager";
import { showTrace } from "./utils/profiling";
import { Poller } from "./utils/poller";
import {
    idbAuthClientStore,
    lsAuthClientStore,
    selectedAuthProviderStore,
} from "./stores/authProviders";
import { blockedUsers } from "./stores/blockedUsers";
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
    isProposalGroup,
    nextEventAndMessageIndexes,
    numberOfThreadsStore,
    proposalTopicsStore,
    selectedChatId,
    selectedChatStore,
    selectedServerChatStore,
    myServerChatSummariesStore,
    serverChatSummariesStore,
    setSelectedChat,
    threadsByChatStore,
    threadsFollowedByMeStore,
    updateSummaryWithConfirmedMessage,
    userGroupKeys,
    threadServerEventsStore,
    threadEvents,
    selectedThreadKey,
    nextEventAndMessageIndexesForThread,
    selectedThreadRootMessageIndex,
    clearServerEvents,
    confirmedEventIndexesLoaded,
    addServerEventsToStores,
    addGroupPreview,
    removeGroupPreview,
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
import { localChatSummaryUpdates, startPruningLocalChatSummaryUpdates } from "./stores/localChatSummaryUpdates";
import { localMessageUpdates, startPruningLocalMessageUpdates } from "./stores/localMessageUpdates";
import { messagesRead, startMessagesReadTracker } from "./stores/markRead";
import {
    askForNotificationPermission,
    initNotificationStores,
    notificationStatus,
    setSoftDisabled,
} from "./stores/notifications";
import { pinnedChatsStore } from "./stores/pinnedChats";
import { profileStore } from "./stores/profiling";
import {
    percentageStorageRemaining,
    percentageStorageUsed,
    storageInGb,
    storageStore,
    updateStorageLimit,
} from "./stores/storage";
import { translationStore } from "./stores/translation";
import { byThread, isTyping, typing, byChat as typingByChat } from "./stores/typing";
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
} from "./utils/date";
import formatFileSize from "./utils/fileSize";
import { calculateMediaDimensions } from "./utils/layout";
import { chunk, findLast, groupBy, groupWhile, toRecord2 } from "./utils/list";
import {
    audioRecordingMimeType,
    containsSocialVideoLink,
    fillMessage,
    isSocialVideoLink,
    messageContentFromFile,
    twitterLinkRegex,
    youtubeRegex,
} from "./utils/media";
import { mergeKeepingOnlyChanged } from "./utils/object";
import { filterWebRtcMessage, parseWebRtcMessage } from "./utils/rtc";
import { toTitleCase } from "./utils/string";
import { formatTimeRemaining } from "./utils/time";
import { initialiseTracking, startTrackingSession, trackEvent } from "./utils/tracking";
import { startSwCheckPoller } from "./utils/updateSw";
import type { OpenChatConfig } from "./config";
import {
    ChatUpdated,
    LoadedMessageWindow,
    LoadedNewMessages,
    LoadedPreviousMessages,
    SendMessageFailed,
    SentMessage,
    SentThreadMessage,
    ThreadClosed,
    ThreadMessagesLoaded,
    ThreadSelected,
    UpgradeRequired,
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
    type GroupRules,
    type GroupPermissions,
    userStatus,
    getUserStatus,
    missingUserIds,
    type EventsResponse,
    type ChatEvent,
    type EventsSuccessResult,
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
    type ChallengeAttempt,
    type RegisterUserResponse,
    type CreateChallengeResponse,
    type CurrentUserResponse,
    type AddMembersResponse,
    type RemoveMemberResponse,
    type ChangeRoleResponse,
    type RegisterProposalVoteResponse,
    type SearchAllMessagesResponse,
    type GroupSearchResponse,
    type GroupInvite,
    type SearchDirectChatResponse,
    type SearchGroupChatResponse,
    type Cryptocurrency,
    type Tokens,
    type ConfirmPhoneNumberResponse,
    type PhoneNumber,
    type SubmitPhoneNumberResponse,
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
    type UpdateArgs,
    type CurrentChatState,
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
} from "openchat-shared";

const UPGRADE_POLL_INTERVAL = 1000;
const MARK_ONLINE_INTERVAL = 61 * 1000;
const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const ONE_MINUTE_MILLIS = 60 * 1000;
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE_MILLIS;
const USER_UPDATE_INTERVAL = ONE_MINUTE_MILLIS;
const ONE_HOUR = 60 * ONE_MINUTE_MILLIS;
const MAX_USERS_TO_UPDATE_PER_BATCH = 100;

type PinChatResponse =
    | { kind: "success" }
    | { kind: "limit_exceeded"; limit: number }
    | { kind: "failure" };

export class OpenChat extends EventTarget {
    private _authClient: Promise<AuthClient>;
    private _workerApi: OpenChatAgentWorker | undefined;
    private _identity: Identity | undefined;
    private _user: CreatedUser | undefined;
    private _liveState: LiveState;
    identityState = writable<IdentityState>("loading_user");
    private _logger: Logger;
    private _chatUpdatesSince: bigint | undefined = undefined;

    constructor(private config: OpenChatConfig) {
        super();

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
            },
            storage: idbAuthClientStore,
        });
        initialiseTracking(config);

        this._authClient.then((c) => c.getIdentity()).then((id) => this.loadedIdentity(id));

        chatUpdatedStore.subscribe((val) => {
            if (val !== undefined) {
                const aff = val.affectedEvents;
                this.chatUpdated(aff);
                chatUpdatedStore.set(undefined);
            }
        });
    }

    private chatUpdated(affectedEvents: number[]): void {
        const chat = this._liveState.selectedChat;
        if (chat === undefined) return;
        // The chat summary has been updated which means the latest message may be new
        const latestMessage = chat.latestMessage;
        if (latestMessage !== undefined && latestMessage.event.sender !== this.user.userId) {
            this.handleMessageSentByOther(chat, latestMessage);
        }

        this.refreshAffectedEvents(chat, affectedEvents);
        this.updateDetails(chat, this._liveState.events);
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
                self.logout().then(resolve);
            }
            if (durationUntilLogoutMs <= 5 * ONE_MINUTE_MILLIS) {
                timeout();
            } else {
                setTimeout(timeout, Math.min(MAX_TIMEOUT_MS, durationUntilLogoutMs));
            }
        });
    }

    private handleAgentEvent(ev: Event): void {
        if (ev instanceof MessagesReadFromServer) {
            messagesRead.syncWithServer(
                ev.detail.chatId,
                ev.detail.readByMeUpTo,
                ev.detail.threadsRead
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
        this._workerApi = new OpenChatAgentWorker(this.config);
        this._workerApi.addEventListener("openchat_event", (ev) => this.handleAgentEvent(ev));
        await this._workerApi.ready;
        this.api
            .getCurrentUser()
            .then((user) => {
                switch (user.kind) {
                    case "unknown_user":
                        // TODO remove this once the principal migration can be done via the UI
                        const principalMigrationUserId = localStorage.getItem(
                            "openchat_principal_migration_user_id"
                        );
                        if (principalMigrationUserId !== null) {
                            console.log("Migrating user principal", principalMigrationUserId);
                            this.api.migrateUserPrincipal(principalMigrationUserId);
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
        this.api.getAllCachedUsers().then((users) => userStore.set(users));
    }

    onCreatedUser(user: CreatedUser): void {
        if (this._identity === undefined) {
            throw new Error("onCreatedUser called before the user's identity has been established");
        }
        this._user = user;
        const id = this._identity;
        // TODO remove this once the principal migration can be done via the UI
        const principalMigrationNewPrincipal = localStorage.getItem(
            "openchat_principal_migration_new_principal"
        );
        if (principalMigrationNewPrincipal !== null) {
            console.log("Initializing user principal migration", principalMigrationNewPrincipal);
            this.api.createUserClient(user.userId);
            this.api.initUserPrincipalMigration(principalMigrationNewPrincipal);
            return;
        }

        if (user.canisterUpgradeStatus === "in_progress") {
            this.identityState.set("upgrading_user");
            window.setTimeout(() => this.loadUser(), UPGRADE_POLL_INTERVAL);
        } else {
            currentUserStore.set(user);
            this.api.createUserClient(user.userId);
            startMessagesReadTracker(this.api);
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
            startPruningLocalChatSummaryUpdates();
            startPruningLocalMessageUpdates();
            initNotificationStores();
            this.api.getUserStorageLimits().then(storageStore.set);
            this.identityState.set("logged_in");
            this.initWebRtc();

            // FIXME - not sure what to do about this
            // if (isCanisterUrl) {
            //     unsubscribeNotifications(api);
            // }
        }
    }

    private startOnlinePoller() {
        new Poller(
            () => this.api.markAsOnline() ?? Promise.resolve(),
            MARK_ONLINE_INTERVAL,
            undefined,
            true
        );
    }

    logout(): Promise<void> {
        return this._authClient.then((c) => {
            return c.logout().then(() => window.location.reload());
        });
    }

    private get api(): OpenChatAgentWorker {
        if (this._workerApi === undefined)
            throw new Error(
                "OpenChat tried to make a worker api call before the api was available"
            );
        return this._workerApi;
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
        chatId: string,
        threadRootMessageIndex: number,
        latestMessageIndex: number
    ): number {
        return this.messagesRead.unreadThreadMessageCount(
            chatId,
            threadRootMessageIndex,
            latestMessageIndex
        );
    }

    unreadMessageCount(chatId: string, latestMessageIndex: number | undefined): number {
        return this.messagesRead.unreadMessageCount(chatId, latestMessageIndex);
    }

    staleThreadsCount(): number {
        return this.messagesRead.staleThreadsCount(this._liveState.threadsByChat);
    }

    markThreadRead(chatId: string, threadRootMessageIndex: number, readUpTo: number): void {
        return this.messagesRead.markThreadRead(chatId, threadRootMessageIndex, readUpTo);
    }

    markMessageRead(chatId: string, messageIndex: number, messageId: bigint): void {
        return this.messagesRead.markMessageRead(chatId, messageIndex, messageId);
    }

    isMessageRead(chatId: string, messageIndex: number, messageId: bigint): boolean {
        return this.messagesRead.isRead(chatId, messageIndex, messageId);
    }

    private sendRtcMessage(userIds: string[], message: WebRtcMessage): void {
        rtcConnectionsManager.sendMessage(userIds, message);
    }

    private initWebRtc(): void {
        rtcConnectionsManager.init(this.user.userId).then((_) => {
            rtcConnectionsManager.subscribe((msg) =>
                this.handleWebRtcMessage(msg as WebRtcMessage)
            );
        });
    }

    previewChat(chatId: string): Promise<boolean> {
        return this.api.getPublicGroupSummary(chatId).then((maybeChat) => {
            if (maybeChat === undefined) {
                return false;
            }
            addGroupPreview(maybeChat);
            return true;
        });
    }

    private async addMissingUsersFromMessage(message: EventWrapper<Message>): Promise<void> {
        const users = this.userIdsFromEvents([message]);
        const missingUsers = this.missingUserIds(this._liveState.userStore, users);
        if (missingUsers.length > 0) {
            const usersResp = await this.api.getUsers(
                {
                    userGroups: [
                        {
                            users: missingUsers,
                            updatedSince: BigInt(0),
                        },
                    ],
                },
                true
            );
            userStore.addMany(usersResp.users);
        }
    }

    toggleMuteNotifications(chatId: string, mute: boolean): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { notificationsMuted: mute });
        return this.api
            .toggleMuteNotifications(chatId, mute)
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

    archiveChat(chatId: string): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { archived: true });
        return this.api
            .archiveChat(chatId)
            .then((resp) => {
                return resp === "success";
            })
            .catch((err) => {
                this._logger.error("Error archiving chat", err);
                localChatSummaryUpdates.markUpdated(chatId, { archived: undefined });
                return false;
            });
    }

    unarchiveChat(chatId: string): Promise<boolean> {
        localChatSummaryUpdates.markUpdated(chatId, { archived: false });
        return this.api
            .unarchiveChat(chatId)
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Error un-archiving chat", err);
                localChatSummaryUpdates.markUpdated(chatId, { archived: undefined });
                return false;
            });
    }

    pinChat(chatId: string): Promise<PinChatResponse> {
        const pinnedChatLimit = 5;
        if (this._liveState.pinnedChats.length >= pinnedChatLimit) {
            return Promise.resolve({ kind: "limit_exceeded", limit: pinnedChatLimit });
        }

        pinnedChatsStore.pin(chatId);
        return this.api
            .pinChat(chatId)
            .then((resp) => {
                if (resp.kind === "pinned_limit_reached") {
                    pinnedChatsStore.unpin(chatId);
                    return { kind: "limit_exceeded", limit: resp.limit } as PinChatResponse;
                }
                return { kind: "success" } as PinChatResponse;
            })
            .catch((err) => {
                this._logger.error("Error pinning chat", err);
                pinnedChatsStore.unpin(chatId);
                return { kind: "failure" };
            });
    }

    unpinChat(chatId: string): Promise<boolean> {
        pinnedChatsStore.unpin(chatId);
        return this.api
            .unpinChat(chatId)
            .then((_) => true)
            .catch((err) => {
                this._logger.error("Error unpinning chat", err);
                pinnedChatsStore.pin(chatId);
                return false;
            });
    }

    blockUserFromDirectChat(userId: string): Promise<boolean> {
        blockedUsers.add(userId);
        return this.api
            .blockUserFromDirectChat(userId)
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
        return this.api
            .unblockUserFromDirectChat(userId)
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

        return this.api
            .setUserAvatar(data)
            .then((_resp) => true)
            .catch((err) => {
                this._logger.error("Failed to update user's avatar", err);
                return false;
            });
    }

    makeGroupPrivate(chatId: string): Promise<boolean> {
        return this.api
            .makeGroupPrivate(chatId)
            .then((resp) => {
                if (resp === "success") {
                    localChatSummaryUpdates.markUpdated(chatId, {
                        kind: "group_chat",
                        public: false
                    });
                    return true;
                } else {
                    return false;
                }
            })
            .catch((err) => {
                this._logger.error("Error making group private", err);
                return false;
            });
    }

    deleteGroup(chatId: string): Promise<boolean> {
        return this.api
            .deleteGroup(chatId)
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

    leaveGroup(chatId: string): Promise<"success" | "failure" | "owner_cannot_leave"> {
        return this.api
            .leaveGroup(chatId)
            .then((resp) => {
                if (resp === "success" || resp === "not_in_group" || resp === "group_not_found") {
                    localChatSummaryUpdates.markRemoved(chatId);
                    return "success";
                } else {
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

    async joinGroup(group: GroupChatSummary): Promise<"success" | "blocked" | "failure"> {
        return this.api
            .joinGroup(group.chatId)
            .then((resp) => {
                if (resp.kind === "group_chat") {
                    localChatSummaryUpdates.markAdded(resp);
                    return "success";
                } else if (resp.kind === "already_in_group") {
                    localChatSummaryUpdates.markAdded({
                        ...group,
                        myRole: "participant" as MemberRole,
                    });
                    return "success";
                } else {
                    if (resp.kind === "blocked") {
                        return "blocked";
                    }
                    return "failure";
                }
            })
            .catch((err) => {
                this._logger.error("Unable to join group", err);
                return "failure";
            });
    }

    updateGroupRules(chatId: string, rules: GroupRules | undefined): Promise<boolean> {
        return this.api
            .updateGroup(chatId, undefined, undefined, rules, undefined, undefined)
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Update group rules failed: ", err);
                return false;
            });
    }

    updateGroupPermissions(
        chatId: string,
        originalPermissions: GroupPermissions,
        updatedPermissions: GroupPermissions
    ): Promise<boolean> {
        const optionalPermissions = this.mergeKeepingOnlyChanged(
            originalPermissions,
            updatedPermissions
        );

        return this.api
            .updateGroup(chatId, undefined, undefined, undefined, optionalPermissions, undefined)
            .then((resp) => {
                if (resp !== "success") {
                    return false;
                }
                localChatSummaryUpdates.markUpdated(chatId, {
                    kind: "group_chat",
                    permissions: optionalPermissions
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
    userStatus = userStatus;
    groupAvatarUrl = groupAvatarUrl;
    getUserStatus = getUserStatus;
    phoneNumberToString = phoneNumberToString;
    updateStorageLimit = updateStorageLimit;
    formatTokens = formatTokens;
    validateTokenInput = validateTokenInput;
    toShortTimeString = toShortTimeString;
    formatMessageDate = formatMessageDate;
    userIdsFromEvents = userIdsFromEvents;
    missingUserIds = missingUserIds;
    toRecord2 = toRecord2;
    toDatetimeString = toDatetimeString;
    getContentAsText = getContentAsText;
    groupBySender = groupBySender;
    getTypingString = getTypingString;

    canBlockUsers(chatId: string): boolean {
        return this.chatPredicate(chatId, canBlockUsers);
    }

    canCreatePolls(chatId: string): boolean {
        return this.chatPredicate(chatId, canCreatePolls);
    }

    canDeleteOtherUsersMessages(chatId: string): boolean {
        return this.chatPredicate(chatId, canDeleteOtherUsersMessages);
    }

    canPinMessages(chatId: string): boolean {
        return this.chatPredicate(chatId, canPinMessages);
    }

    canReactToMessages(chatId: string): boolean {
        return this.chatPredicate(chatId, canReactToMessages);
    }

    canReplyInThread(chatId: string): boolean {
        return this.chatPredicate(chatId, canReplyInThread);
    }

    canSendMessages(chatId: string): boolean {
        return this.chatPredicate(chatId, (chat) => canSendMessages(
            chat,
            this._liveState.userStore,
            this.config.proposalBotCanister));
    }

    canChangeRoles(chatId: string, currentRole: MemberRole, newRole: MemberRole): boolean {
        return this.chatPredicate(chatId, (chat) => canChangeRoles(chat, currentRole, newRole));
    }

    canUnblockUsers(chatId: string): boolean {
        return this.chatPredicate(chatId, canUnblockUsers);
    }

    canRemoveMembers(chatId: string): boolean {
        return this.chatPredicate(chatId, canRemoveMembers);
    }

    canEditGroupDetails(chatId: string): boolean {
        return this.chatPredicate(chatId, canEditGroupDetails);
    }

    canChangePermissions(chatId: string): boolean {
        return this.chatPredicate(chatId, canChangePermissions);
    }

    canInviteUsers(chatId: string): boolean {
        return this.chatPredicate(chatId, canInviteUsers);
    }

    canDeleteGroup(chatId: string): boolean {
        return this.chatPredicate(chatId, canDeleteGroup);
    }

    canMakeGroupPrivate(chatId: string): boolean {
        return this.chatPredicate(chatId, canMakeGroupPrivate);
    }

    canLeaveGroup(chatId: string): boolean {
        return this.chatPredicate(chatId, canLeaveGroup);
    }

    canAddMembers(chatId: string): boolean {
        return this.chatPredicate(chatId, canAddMembers);
    }

    isPreviewing(chatId: string): boolean {
        return this.chatPredicate(chatId, isPreviewing);
    }

    private chatPredicate(chatId: string, predicate: (chat: ChatSummary) => boolean): boolean {
        const chat = this._liveState.chatSummaries[chatId];
        return chat !== undefined && predicate(chat);
    }

    canForward = canForward;
    containsReaction = containsReaction;
    createMessage = createMessage;
    findMessageById = findMessageById;
    getMessageContent = getMessageContent;
    getStorageRequiredForMessage = getStorageRequiredForMessage;
    groupEvents = groupEvents;
    startTyping = startTyping;
    stopTyping = stopTyping;

    registerPollVote(
        chatId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        messageIndex: number,
        answerIndex: number,
        type: "register" | "delete"
    ): Promise<boolean> {
        const userId = this.user.userId;

        localMessageUpdates.markPollVote(messageId.toString(), {
            answerIndex,
            type,
            userId,
        });

        return this.api
            .registerPollVote(chatId, messageIndex, answerIndex, type, threadRootMessageIndex)
            .then((resp) => resp === "success")
            .catch((err) => {
                this._logger.error("Poll vote failed: ", err);
                return false;
            });
    }

    deleteMessage(
        chatId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint
    ): Promise<boolean> {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        const messageIdString = messageId.toString();

        localMessageUpdates.markDeleted(messageIdString, this.user.userId);

        const recipients = [...chatStateStore.getProp(chatId, "userIds")];
        const chatType = chat.kind;
        const userId = this.user.userId;

        rtcConnectionsManager.sendMessage(recipients, {
            kind: "remote_user_deleted_message",
            chatType,
            chatId,
            messageId,
            userId,
            threadRootMessageIndex,
        });

        function undelete() {
            rtcConnectionsManager.sendMessage(recipients, {
                kind: "remote_user_undeleted_message",
                chatType,
                chatId,
                messageId,
                userId,
                threadRootMessageIndex,
            });
            localMessageUpdates.markUndeleted(messageIdString);
        }

        return this.api
            .deleteMessage(chatType, chatId, messageId, threadRootMessageIndex)
            .then((resp) => {
                const success = resp === "success";
                if (!success) {
                    undelete();
                }
                return success;
            })
            .catch((_) => {
                undelete();
                return false;
            });
    }

    selectReaction(
        chatId: string,
        userId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        reaction: string,
        username: string,
        kind: "add" | "remove"
    ): Promise<boolean> {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        localMessageUpdates.markReaction(messageId.toString(), {
            reaction,
            kind,
            userId,
        });

        function undoLocally() {
            localMessageUpdates.markReaction(messageId.toString(), {
                reaction,
                kind: kind === "add" ? "remove" : "add",
                userId,
            });
        }

        const result = (
            chat.kind === "direct_chat"
                ? kind == "add"
                    ? this.api.addDirectChatReaction(
                          chatId,
                          messageId,
                          reaction,
                          username,
                          threadRootMessageIndex
                      )
                    : this.api.removeDirectChatReaction(
                          chatId,
                          messageId,
                          reaction,
                          threadRootMessageIndex
                      )
                : kind === "add"
                ? this.api.addGroupChatReaction(
                      chatId,
                      messageId,
                      reaction,
                      username,
                      threadRootMessageIndex
                  )
                : this.api.removeGroupChatReaction(
                      chatId,
                      messageId,
                      reaction,
                      threadRootMessageIndex
                  )
        )
            .then((resp) => {
                if (resp !== "success" && resp !== "no_change") {
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
            chatType: chat.kind,
            chatId,
            messageId: messageId,
            reaction,
            userId,
            added: kind === "add",
            threadRootMessageIndex,
        });
        return result;
    }

    async loadEventWindow(
        chatId: string,
        messageIndex: number
    ): Promise<number | undefined> {
        const clientChat = this._liveState.chatSummaries[chatId];
        const serverChat = this._liveState.serverChatSummaries[chatId];

        if (clientChat === undefined) {
            return Promise.resolve(undefined);
        }

        if (messageIndex >= 0) {
            const range = indexRangeForChat(clientChat);
            const eventsPromise: Promise<EventsResponse<ChatEvent>> =
                clientChat.kind === "direct_chat"
                    ? this.api.directChatEventsWindow(
                          range,
                          chatId,
                          messageIndex,
                          serverChat?.latestEventIndex
                      )
                    : this.api.groupChatEventsWindow(
                          range,
                          chatId,
                          messageIndex,
                          serverChat?.latestEventIndex
                      );
            const eventsResponse = await eventsPromise;

            if (eventsResponse === undefined || eventsResponse === "events_failed") {
                return undefined;
            }

            await this.handleEventsResponse(clientChat, eventsResponse, false);

            this.dispatchEvent(new LoadedMessageWindow(messageIndex));

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
            clearServerEvents(chat.chatId);
            chatStateStore.setProp(chat.chatId, "userGroupKeys", new Set<string>());
        } else if (!this.isContiguous(chat.chatId, resp)) {
            return;
        }

        // Only include affected events that overlap with already loaded events
        const confirmedLoaded = confirmedEventIndexesLoaded(chat.chatId);
        const events = resp.events.concat(
            resp.affectedEvents.filter((e) => indexIsInRanges(e.index, confirmedLoaded))
        );

        const userIds = userIdsFromEvents(events);
        await this.updateUserStore(chat.chatId, userIds);

        addServerEventsToStores(chat.chatId, events, undefined);

        makeRtcConnections(this.user.userId, chat, events, this._liveState.userStore);
    }

    private isContiguous(chatId: string, response: EventsSuccessResult<ChatEvent>): boolean {
        const confirmedLoaded = confirmedEventIndexesLoaded(chatId);

        if (confirmedLoaded.length === 0 || response.events.length === 0) return true;

        const firstIndex = response.events[0].index;
        const lastIndex = response.events[response.events.length - 1].index;
        const contiguousCheck = new DRange(firstIndex - 1, lastIndex + 1);

        const isContiguous = confirmedLoaded.clone().intersect(contiguousCheck).length > 0;

        if (!isContiguous) {
            console.log(
                "Events in response are not contiguous with the loaded events",
                confirmedLoaded,
                firstIndex,
                lastIndex
            );
        }

        return isContiguous;
    }

    private async updateUserStore(chatId: string, userIdsFromEvents: Set<string>): Promise<void> {
        const userId = this.user.userId;
        const allUserIds = new Set<string>();
        chatStateStore.getProp(chatId, "members").forEach((m) => allUserIds.add(m.userId));
        chatStateStore.getProp(chatId, "blockedUsers").forEach((u) => allUserIds.add(u));
        userIdsFromEvents.forEach((u) => allUserIds.add(u));

        chatStateStore.updateProp(chatId, "userIds", (userIds) => {
            allUserIds.forEach((u) => {
                if (u !== userId) {
                    userIds.add(u);
                }
            });
            return userIds;
        });

        const resp = await this.api.getUsers(
            {
                userGroups: [
                    {
                        users: missingUserIds(
                            this._liveState.userStore,
                            new Set<string>(allUserIds)
                        ),
                        updatedSince: BigInt(0),
                    },
                ],
            },
            true
        );

        userStore.addMany(resp.users);
    }
    isTyping = isTyping;
    trackEvent = trackEvent;
    twitterLinkRegex = twitterLinkRegex;
    youtubeRegex = youtubeRegex;
    metricsEqual = metricsEqual;
    getMembersString = getMembersString;
    compareIsNotYouThenUsername = compareIsNotYouThenUsername;
    compareUsername = compareUsername;

    private blockUserLocally(chatId: string, userId: string): void {
        chatStateStore.updateProp(chatId, "blockedUsers", (b) => b.add(userId));
        chatStateStore.updateProp(chatId, "members", (p) => p.filter((p) => p.userId !== userId));
    }

    private unblockUserLocally(chatId: string, userId: string): void {
        chatStateStore.updateProp(chatId, "blockedUsers", (b) => {
            b.delete(userId);
            return b;
        });
        chatStateStore.updateProp(chatId, "members", (p) => [
            ...p,
            {
                role: "participant",
                userId,
                username: this._liveState.userStore[userId]?.username ?? "unknown",
            },
        ]);
    }

    blockUser(chatId: string, userId: string): Promise<boolean> {
        this.blockUserLocally(chatId, userId);
        return this.api
            .blockUserFromGroupChat(chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    this.unblockUserLocally(chatId, userId);
                    return false;
                }
                return true;
            })
            .catch((err) => {
                this._logger.error("Error blocking user", err);
                this.unblockUserLocally(chatId, userId);
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
    setCachedMessageFromNotification(
        chatId: string,
        threadRootMessageIndex: number | undefined,
        message: EventWrapper<Message>
    ): Promise<void> {
        return this.api.setCachedMessageFromNotification(chatId, threadRootMessageIndex, message);
    }
    createDirectChat = createDirectChat;
    setSelectedChat(chatId: string, messageIndex?: number): void {
        const clientChat = this._liveState.chatSummaries[chatId];
        const serverChat = this._liveState.serverChatSummaries[chatId];

        if (clientChat === undefined) {
            return;
        }

        setSelectedChat(this.api, clientChat, serverChat, messageIndex);

        const { selectedChat, focusMessageIndex, events } = this._liveState;
        if (selectedChat !== undefined) {
            if (focusMessageIndex !== undefined) {
                this.loadEventWindow(chatId, focusMessageIndex).then(
                    () => {
                        this.loadDetails(selectedChat, events);
                    }
                );
            } else {
                this.loadPreviousMessages(chatId).then(() => {
                    this.loadDetails(selectedChat, events);
                });
            }
        }
    }

    openThread(
        threadRootMessageId: bigint,
        threadRootMessageIndex: number,
        initiating: boolean
    ): void {
        selectedThreadRootMessageIndex.set(threadRootMessageIndex);
        this.dispatchEvent(
            new ThreadSelected(threadRootMessageId, threadRootMessageIndex, initiating)
        );
    }

    closeThread(): void {
        selectedThreadRootMessageIndex.set(undefined);
        this.dispatchEvent(new ThreadClosed());
    }

    clearThreadEvents(): void {
        threadServerEventsStore.set([]);
    }

    async loadThreadMessages(
        chatId: string,
        rootEvent: EventWrapper<Message>,
        thread: ThreadSummary,
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number,
        clearEvents: boolean
    ): Promise<void> {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat === undefined) {
            return Promise.resolve();
        }

        const { selectedThreadKey } = this._liveState;
        if (selectedThreadKey === undefined) return;

        const eventsResponse = await this.api.chatEvents(
            chat.kind,
            chatId,
            range,
            startIndex,
            ascending,
            threadRootMessageIndex,
            thread.latestEventIndex
        );

        if (selectedThreadKey !== this._liveState.selectedThreadKey) {
            // the selected thread has changed while we were loading the messages
            return;
        }

        if (eventsResponse !== undefined && eventsResponse !== "events_failed") {
            if (clearEvents) {
                threadServerEventsStore.set([]);
            }
            const [newEvents, _] = await this.handleThreadEventsResponse(
                chatId,
                rootEvent,
                eventsResponse
            );

            for (const event of newEvents) {
                if (event.event.kind === "message") {
                    unconfirmed.delete(selectedThreadKey, event.event.messageId);
                }
            }

            threadServerEventsStore.update((events) => mergeServerEvents(events, newEvents));
            makeRtcConnections(
                this.user.userId,
                chat,
                this._liveState.threadEvents,
                this._liveState.userStore
            );

            const isFollowedByMe =
                this._liveState.threadsFollowedByMe[chat.chatId]?.has(threadRootMessageIndex) ??
                false;
            if (isFollowedByMe) {
                const lastLoadedMessageIdx = this.lastMessageIndex(this._liveState.threadEvents);
                if (lastLoadedMessageIdx !== undefined) {
                    this.markThreadRead(chat.chatId, threadRootMessageIndex, lastLoadedMessageIdx);
                }
            }
            this.dispatchEvent(new ThreadMessagesLoaded(ascending));
        }
    }

    private async handleThreadEventsResponse(
        chatId: string,
        rootEvent: EventWrapper<Message>,
        resp: EventsResponse<ChatEvent>
    ): Promise<[EventWrapper<ChatEvent>[], Set<string>]> {
        if (resp === "events_failed") return [[], new Set()];

        const events = resp.events.concat(resp.affectedEvents);

        const userIds = this.userIdsFromEvents(events);
        userIds.add(rootEvent.event.sender);
        await this.updateUserStore(chatId, userIds);

        return [events, userIds];
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

    removeChat(chatId: string): void {
        if (this._liveState.groupPreviews[chatId] !== undefined) {
            removeGroupPreview(chatId);
        }
        if (this._liveState.chatSummaries[chatId] !== undefined) {
            localChatSummaryUpdates.markRemoved(chatId);
        }
    }

    clearSelectedChat = clearSelectedChat;
    mergeKeepingOnlyChanged = mergeKeepingOnlyChanged;
    messageContentFromFile = messageContentFromFile;
    formatFileSize = formatFileSize;

    async loadPreviousMessages(chatId: string): Promise<void> {
        const serverChat = this._liveState.serverChatSummaries[chatId];

        if (serverChat === undefined) {
            return Promise.resolve();
        }

        const criteria = this.previousMessagesCriteria(serverChat);

        const eventsResponse = criteria
            ? await this.loadEvents(serverChat, criteria[0], criteria[1])
            : undefined;

        if (eventsResponse === undefined || eventsResponse === "events_failed") {
            return;
        }

        await this.handleEventsResponse(serverChat, eventsResponse);

        this.dispatchEvent(new LoadedPreviousMessages());
        return;
    }

    private loadEvents(
        serverChat: ChatSummary,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<ChatEvent>> {
        return this.api.chatEvents(
            serverChat.kind,
            serverChat.chatId,
            indexRangeForChat(serverChat),
            startIndex,
            ascending,
            undefined,
            serverChat.latestEventIndex
        );
    }

    private previousMessagesCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
        if (serverChat.latestEventIndex < 0) {
            return undefined;
        }

        const minLoadedEventIndex = this.earliestLoadedIndex(serverChat.chatId);
        if (minLoadedEventIndex === undefined) {
            return [serverChat.latestEventIndex, false];
        }
        const minVisibleEventIndex = this.earliestAvailableEventIndex(serverChat);
        return minLoadedEventIndex !== undefined && minLoadedEventIndex > minVisibleEventIndex
            ? [minLoadedEventIndex - 1, false]
            : undefined;
    }

    private earliestAvailableEventIndex(chat: ChatSummary): number {
        return chat.kind === "group_chat" ? chat.minVisibleEventIndex : 0;
    }

    private earliestLoadedIndex(chatId: string): number | undefined {
        const confirmedLoaded = confirmedEventIndexesLoaded(chatId);
        return confirmedLoaded.length > 0 ? confirmedLoaded.index(0) : undefined;
    }

    async loadNewMessages(chatId: string): Promise<boolean> {
        const serverChat = this._liveState.serverChatSummaries[chatId];

        if (serverChat === undefined) {
            return Promise.resolve(false);
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
                serverChat.chatId,
                latestMessage as EventWrapper<Message>
            );
        }

        this.dispatchEvent(new LoadedNewMessages(newLatestMessage));
        return newLatestMessage;
    }

    morePreviousMessagesAvailable(chatId: string): boolean {
        const chat = this._liveState.chatSummaries[chatId];

        return (
            chat !== undefined &&
            chat.latestEventIndex >= 0 &&
            (this.earliestLoadedIndex(chatId) ?? Number.MAX_VALUE) >
                this.earliestAvailableEventIndex(chat)
        );
    }

    moreNewMessagesAvailable(chatId: string): boolean {
        const serverChat = this._liveState.serverChatSummaries[chatId];

        return (
            serverChat !== undefined &&
            (this.confirmedUpToEventIndex(serverChat.chatId) ?? -1) < serverChat.latestEventIndex
        );
    }

    private async loadDetails(
        clientChat: ChatSummary,
        currentEvents: EventWrapper<ChatEvent>[]
    ): Promise<void> {
        // currently this is only meaningful for group chats, but we'll set it up generically just in case
        if (clientChat.kind === "group_chat") {
            if (!chatStateStore.getProp(clientChat.chatId, "detailsLoaded")) {
                const resp = await this.api.getGroupDetails(
                    clientChat.chatId,
                    clientChat.latestEventIndex
                );
                if (resp !== "caller_not_in_group") {
                    chatStateStore.setProp(clientChat.chatId, "detailsLoaded", true);
                    chatStateStore.setProp(
                        clientChat.chatId,
                        "latestEventIndex",
                        resp.latestEventIndex
                    );
                    chatStateStore.setProp(clientChat.chatId, "members", resp.members);
                    chatStateStore.setProp(clientChat.chatId, "blockedUsers", resp.blockedUsers);
                    chatStateStore.setProp(
                        clientChat.chatId,
                        "pinnedMessages",
                        resp.pinnedMessages
                    );
                    chatStateStore.setProp(clientChat.chatId, "rules", resp.rules);
                }
                await this.updateUserStore(clientChat.chatId, userIdsFromEvents(currentEvents));
            } else {
                await this.updateDetails(clientChat, currentEvents);
            }
        }
    }

    private async updateDetails(
        clientChat: ChatSummary,
        currentEvents: EventWrapper<ChatEvent>[]
    ): Promise<void> {
        if (clientChat.kind === "group_chat") {
            const latestEventIndex = chatStateStore.getProp(clientChat.chatId, "latestEventIndex");
            if (latestEventIndex !== undefined && latestEventIndex < clientChat.latestEventIndex) {
                const gd = await this.api.getGroupDetailsUpdates(clientChat.chatId, {
                    members: chatStateStore.getProp(clientChat.chatId, "members"),
                    blockedUsers: chatStateStore.getProp(clientChat.chatId, "blockedUsers"),
                    pinnedMessages: chatStateStore.getProp(clientChat.chatId, "pinnedMessages"),
                    latestEventIndex,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    rules: chatStateStore.getProp(clientChat.chatId, "rules")!,
                });
                chatStateStore.setProp(clientChat.chatId, "members", gd.members);
                chatStateStore.setProp(clientChat.chatId, "blockedUsers", gd.blockedUsers);
                chatStateStore.setProp(clientChat.chatId, "pinnedMessages", gd.pinnedMessages);
                chatStateStore.setProp(clientChat.chatId, "rules", gd.rules);
                await this.updateUserStore(clientChat.chatId, userIdsFromEvents(currentEvents));
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

    private refreshAffectedEvents(
        serverChat: ChatSummary,
        affectedEventIndexes: number[]
    ): Promise<void> {
        const confirmedLoaded = confirmedEventIndexesLoaded(serverChat.chatId);
        const filtered = affectedEventIndexes.filter((e) => indexIsInRanges(e, confirmedLoaded));
        if (filtered.length === 0) {
            return Promise.resolve();
        }

        const eventsPromise =
            serverChat.kind === "direct_chat"
                ? this.api.directChatEventsByEventIndex(
                      serverChat.them,
                      filtered,
                      undefined,
                      serverChat.latestEventIndex
                  )
                : this.api.groupChatEventsByEventIndex(
                      serverChat.chatId,
                      filtered,
                      undefined,
                      serverChat.latestEventIndex
                  );

        return eventsPromise.then((resp) => this.handleEventsResponse(serverChat, resp));
    }

    private newMessageCriteria(serverChat: ChatSummary): [number, boolean] | undefined {
        if (serverChat.latestEventIndex < 0) {
            return undefined;
        }

        const loadedUpTo = this.confirmedUpToEventIndex(serverChat.chatId);

        if (loadedUpTo === undefined) {
            return [serverChat.latestEventIndex, false];
        }

        return loadedUpTo < serverChat.latestEventIndex ? [loadedUpTo + 1, true] : undefined;
    }
    private confirmedUpToEventIndex(chatId: string): number | undefined {
        const ranges = confirmedEventIndexesLoaded(chatId).subranges();
        if (ranges.length > 0) {
            return ranges[0].high;
        }
        return undefined;
    }

    messageIsReadByThem(chatId: string, messageIndex: number): boolean {
        const chat = this._liveState.chatSummaries[chatId];
        return chat !== undefined && messageIsReadByThem(chat, messageIndex);
    }

    private addPinnedMessage(chatId: string, messageIndex: number): void {
        chatStateStore.updateProp(chatId, "pinnedMessages", (s) => {
            s.add(messageIndex);
            return new Set(s);
        });
    }

    private removePinnedMessage(chatId: string, messageIndex: number): void {
        chatStateStore.updateProp(chatId, "pinnedMessages", (s) => {
            s.delete(messageIndex);
            return new Set(s);
        });
    }

    unpinMessage(chatId: string, messageIndex: number): Promise<boolean> {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat?.kind === "group_chat") {
            this.removePinnedMessage(chatId, messageIndex);
            return this.api
                .unpinMessage(chatId, messageIndex)
                .then((resp) => {
                    if (resp !== "success" && resp !== "no_change") {
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
        return Promise.resolve(false);
    }

    pinMessage(chatId: string, messageIndex: number): Promise<boolean> {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat?.kind === "group_chat") {
            this.addPinnedMessage(chatId, messageIndex);
            return this.api
                .pinMessage(chatId, messageIndex)
                .then((resp) => {
                    if (resp !== "success" && resp !== "no_change") {
                        this.removePinnedMessage(chatId, messageIndex);
                        return false;
                    }
                    return true;
                })
                .catch((err) => {
                    this._logger.error("Pin message failed: ", err);
                    this.removePinnedMessage(chatId, messageIndex);
                    return false;
                });
        }
        return Promise.resolve(false);
    }

    private removeMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        messageId: bigint,
        userId: string,
        threadRootMessageIndex: number | undefined
    ): void {
        if (userId === this.user.userId) {
            const userIds = chatStateStore.getProp(chatId, "userIds");
            rtcConnectionsManager.sendMessage([...userIds], {
                kind: "remote_user_removed_message",
                chatType,
                chatId,
                messageId: messageId,
                userId: userId,
                threadRootMessageIndex,
            });
        }
        const key =
            threadRootMessageIndex === undefined
                ? chatId
                : `${chatId}_${threadRootMessageIndex}`;
        unconfirmed.delete(key, messageId);
        if (threadRootMessageIndex === undefined) {
            messagesRead.removeUnconfirmedMessage(chatId, messageId);
        }
    }
    toggleProposalFilterMessageExpansion = toggleProposalFilterMessageExpansion;
    groupWhile = groupWhile;
    sameUser = sameUser;

    forwardMessage(
        chatId: string,
        msg: Message
    ): void {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat === undefined) {
            return;
        }

        const currentEvents = this._liveState.events;

        // TODO check storage requirements

        // Only forward the primary content not the caption
        const content = { ...msg.content };
        if ("caption" in content) {
            content.caption = "";
        }

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
        };
        const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

        this.api
            .sendMessage(chat.kind, chatId, this.user, [], event.event)
            .then(([resp, msg]) => {
                if (resp.kind === "success") {
                    this.onSendMessageSuccess(chatId, resp, msg, undefined);
                    trackEvent("forward_message");
                } else {
                    this.removeMessage(chat.kind, chatId, msg.messageId, this.user.userId, undefined);
                    this.dispatchEvent(new SendMessageFailed());
                }
            })
            .catch((err) => {
                this.removeMessage(chat.kind, chatId, event.event.messageId, this.user.userId, undefined);
                this.dispatchEvent(new SendMessageFailed());
                this._logger.error("Exception forwarding message", err);
            });

        this.sendMessage(chat, currentEvents, event, undefined).then((jumpTo) => {
            this.dispatchEvent(new SentMessage(jumpTo));
            return jumpTo;
        });
    }

    private onSendMessageSuccess(
        chatId: string,
        resp: SendMessageSuccess | TransferSuccess,
        msg: Message,
        threadRootMessageIndex: number | undefined
    ) {
        const event = mergeSendMessageResponse(msg, resp);
        addServerEventsToStores(chatId, [event], threadRootMessageIndex);
        if (threadRootMessageIndex === undefined) {
            updateSummaryWithConfirmedMessage(chatId, event);
        }
    }

    private async sendMessage(
        clientChat: ChatSummary,
        currentEvents: EventWrapper<ChatEvent>[],
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined
    ): Promise<number | undefined> {
        let jumpingTo: number | undefined = undefined;
        const key =
            threadRootMessageIndex === undefined
                ? clientChat.chatId
                : `${clientChat.chatId}_${threadRootMessageIndex}`;

        if (threadRootMessageIndex === undefined) {
            if (!upToDate(clientChat, currentEvents)) {
                jumpingTo = await this.loadEventWindow(
                    clientChat.chatId,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    clientChat.latestMessage!.event.messageIndex
                );
            }
        }

        unconfirmed.add(key, messageEvent);

        rtcConnectionsManager.sendMessage(
            [...chatStateStore.getProp(clientChat.chatId, "userIds")],
            {
                kind: "remote_user_sent_message",
                chatType: clientChat.kind,
                chatId: clientChat.chatId,
                messageEvent: serialiseMessageForRtc(messageEvent),
                userId: this.user.userId,
                threadRootMessageIndex,
            }
        );

        if (threadRootMessageIndex === undefined) {
            // mark our own messages as read manually since we will not be observing them
            messagesRead.markMessageRead(
                clientChat.chatId,
                messageEvent.event.messageIndex,
                messageEvent.event.messageId
            );

            currentChatDraftMessage.clear(clientChat.chatId);
        }

        return jumpingTo;
    }

    sendMessageWithAttachment(
        chatId: string,
        currentEvents: EventWrapper<ChatEvent>[],
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined,
        replyingTo: EnhancedReplyContext | undefined,
        threadRootMessageIndex: number | undefined
    ): void {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat === undefined) {
            return;
        }

        if (textContent || fileToAttach) {
            const storageRequired = this.getStorageRequiredForMessage(fileToAttach);
            if (this._liveState.remainingStorage < storageRequired) {
                this.dispatchEvent(new UpgradeRequired("explain"));
                return;
            }

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

            this.api
                .sendMessage(chat.kind, chatId, this.user, mentioned, event.event, threadRootMessageIndex)
                .then(([resp, msg]) => {
                    if (resp.kind === "success" || resp.kind === "transfer_success") {
                        this.onSendMessageSuccess(
                            chatId,
                            resp,
                            msg,
                            threadRootMessageIndex
                        );
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
                            chat.kind,
                            chatId,
                            msg.messageId,
                            this.user.userId,
                            threadRootMessageIndex
                        );
                        this.dispatchEvent(new SendMessageFailed());
                    }
                })
                .catch((err) => {
                    this.removeMessage(
                        chat.kind,
                        chatId,
                        event.event.messageId,
                        this.user.userId,
                        threadRootMessageIndex
                    );
                    this._logger.error("Exception sending message", err);
                    this.dispatchEvent(new SendMessageFailed());
                });

            this.sendMessage(
                chat,
                currentEvents,
                event,
                threadRootMessageIndex
            ).then((jumpTo) => {
                if (threadRootMessageIndex !== undefined) {
                    this.dispatchEvent(new SentThreadMessage(event));
                } else {
                    this.dispatchEvent(new SentMessage(jumpTo));
                }
                return jumpTo;
            });
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
        chatId: string,
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined,
        editingEvent: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<boolean> {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat === undefined) {
            return Promise.resolve(false);
        }

        if (textContent || fileToAttach) {
            const msg = {
                ...editingEvent.event,
                edited: true,
                content: this.getMessageContent(textContent ?? undefined, fileToAttach),
            };
            localMessageUpdates.markContentEdited(msg.messageId.toString(), msg.content);

            if (threadRootMessageIndex === undefined) {
                currentChatDraftMessage.clear(chatId);
            }

            return this.api
                .editMessage(chat.kind, chat.chatId, msg, threadRootMessageIndex)
                .then((resp) => {
                    if (resp !== "success") {
                        localMessageUpdates.revertEditedContent(msg.messageId.toString());
                        return false;
                    }
                    return true;
                })
                .catch((err) => {
                    this._logger.error("Exception sending message", err);
                    localMessageUpdates.revertEditedContent(msg.messageId.toString());
                    return false;
                });
        }
        return Promise.resolve(false);
    }

    notificationReceived(notification: Notification): void {
        let chatId: string;
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

        const serverChat = this._liveState.serverChatSummaries[chatId];

        if (serverChat === undefined || serverChat.latestEventIndex >= message.index) {
            return;
        }

        this.setCachedMessageFromNotification(chatId, threadRootMessageIndex, message);

        Promise.all([
            this.api.rehydrateMessage(serverChat.kind, chatId, message, undefined, serverChat.latestEventIndex),
            this.addMissingUsersFromMessage(message),
        ]).then(([m, _]) => {
            updateSummaryWithConfirmedMessage(chatId, m);

            if (this._liveState.selectedChatId === chatId) {
                this.handleMessageSentByOther(serverChat, m);
            }
        });
    }

    private async handleMessageSentByOther(
        clientChat: ChatSummary,
        messageEvent: EventWrapper<Message>
    ): Promise<void> {
        const confirmedLoaded = confirmedEventIndexesLoaded(clientChat.chatId);

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

        await this.handleEventsResponse(clientChat, {
            events: [messageEvent],
            affectedEvents: [],
            latestEventIndex: undefined,
        });
    }

    setFocusMessageIndex(chatId: string, messageIndex: number | undefined): void {
        chatStateStore.setProp(chatId, "focusMessageIndex", messageIndex);
    }

    remoteUserToggledReaction(
        events: EventWrapper<ChatEvent>[],
        message: RemoteUserToggledReaction
    ): void {
        const matchingMessage = this.findMessageById(message.messageId, events);

        if (matchingMessage !== undefined) {
            localMessageUpdates.markReaction(message.messageId.toString(), {
                reaction: message.reaction,
                kind: message.added ? "add" : "remove",
                userId: message.userId,
            });
        }
    }

    handleWebRtcMessage(msg: WebRtcMessage): void {
        const fromChatId = filterWebRtcMessage(msg);
        if (fromChatId === undefined) return;

        // this means we have a selected chat but it doesn't mean it's the same as this message
        const parsedMsg = parseWebRtcMessage(fromChatId, msg);
        const { selectedChat, threadEvents, events } = this._liveState;

        if (
            selectedChat !== undefined &&
            fromChatId === selectedChat.chatId &&
            parsedMsg.threadRootMessageIndex === this._liveState.selectedThreadRootMessageIndex
        ) {
            this.handleWebRtcMessageInternal(
                fromChatId,
                parsedMsg,
                selectedChat,
                parsedMsg.threadRootMessageIndex === undefined ? events : threadEvents,
                parsedMsg.threadRootMessageIndex
            );
        } else {
            if (
                parsedMsg.kind === "remote_user_sent_message" &&
                parsedMsg.threadRootMessageIndex === undefined
            ) {
                unconfirmed.add(fromChatId, parsedMsg.messageEvent);
            }
        }
    }

    private handleWebRtcMessageInternal(
        fromChatId: string,
        msg: WebRtcMessage,
        chat: ChatSummary,
        events: EventWrapper<ChatEvent>[],
        threadRootMessageIndex: number | undefined
    ): void {
        switch (msg.kind) {
            case "remote_user_typing":
                typing.startTyping(fromChatId, msg.userId, msg.threadRootMessageIndex);
                break;
            case "remote_user_stopped_typing":
                typing.stopTyping(msg.userId);
                break;
            case "remote_user_toggled_reaction":
                this.remoteUserToggledReaction(events, msg);
                break;
            case "remote_user_deleted_message":
                localMessageUpdates.markDeleted(msg.messageId.toString(), msg.userId);
                break;
            case "remote_user_removed_message":
                this.removeMessage(chat.kind, fromChatId, msg.messageId, msg.userId, threadRootMessageIndex);
                break;
            case "remote_user_undeleted_message":
                localMessageUpdates.markUndeleted(msg.messageId.toString());
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
        chatId: string,
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

        const key =
            threadRootMessageIndex === undefined ? chatId : `${chatId}_${threadRootMessageIndex}`;

        unconfirmed.add(key, {
            ...message.messageEvent,
            index: eventIndex,
            event: {
                ...message.messageEvent.event,
                messageIndex,
            },
        });

        // since we will only get here if we actually have the thread open
        // we should mark read up to this message too
        if (threadRootMessageIndex !== undefined) {
            this.markThreadRead(chatId, threadRootMessageIndex, messageIndex);
        }
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this.api.checkUsername(username);
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this.api.searchUsers(searchTerm, maxResults);
    }

    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): Promise<RegisterUserResponse> {
        return this.api.registerUser(username, challengeAttempt, referredBy);
    }

    createChallenge(): Promise<CreateChallengeResponse> {
        return this.api.createChallenge();
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.api.getCurrentUser().then((response) => {
            if (response.kind === "created_user") {
                userCreatedStore.set(true);
                selectedAuthProviderStore.init(AuthProvider.II);
            }
            return response;
        });
    }

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.api.subscriptionExists(p256dh_key);
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.api.pushSubscription(subscription);
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.api.removeSubscription(subscription);
    }

    addMembers(
        chatId: string,
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddMembersResponse> {
        return this.api.addMembers(chatId, userIds, myUsername, allowBlocked);
    }

    removeMember(chatId: string, userId: string): Promise<RemoveMemberResponse> {
        return this.api.removeMember(chatId, userId);
    }

    changeRole(chatId: string, userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        return this.api.changeRole(chatId, userId, newRole);
    }

    registerProposalVote(
        chatId: string,
        messageIndex: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.api.registerProposalVote(chatId, messageIndex, adopt);
    }

    getRecommendedGroups(): Promise<GroupChatSummary[]> {
        return this.api.getRecommendedGroups();
    }

    getGroupRules(chatId: string): Promise<GroupRules | undefined> {
        return this.api.getGroupRules(chatId);
    }

    searchAllMessages(searchTerm: string, maxResults = 10): Promise<SearchAllMessagesResponse> {
        return this.api.searchAllMessages(searchTerm, maxResults);
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.api.searchGroups(searchTerm, maxResults);
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.api.dismissRecommendation(chatId);
    }

    set groupInvite(value: GroupInvite) {
        this.api.groupInvite = value;
    }

    searchChat(
        chatId: string,
        searchTerm: string,
        maxResults = 10
    ): Promise<SearchDirectChatResponse | SearchGroupChatResponse> {
        const chat = this._liveState.chatSummaries[chatId];

        if (chat === undefined) {
            return Promise.resolve({ kind: "chat_not_found" });
        } else if (chat.kind === "group_chat") {
            return this.api.searchGroupChat(chat.chatId, searchTerm, maxResults);
        } else {
            return this.api.searchDirectChat(chat.chatId, searchTerm, maxResults);
        }
    }

    refreshAccountBalance(crypto: Cryptocurrency, account: string): Promise<Tokens> {
        return this.api.refreshAccountBalance(crypto, account).then((val) => {
            cryptoBalance.set(crypto, val);
            return val;
        });
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.api.confirmPhoneNumber(code);
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this.api.submitPhoneNumber(phoneNumber);
    }

    upgradeStorage(newLimitBytes: number): Promise<boolean> {
        return this.api
            .upgradeStorage(newLimitBytes)
            .then((resp) => {
                const success = resp.kind === "success" || resp.kind === "success_no_change";
                if (!success) {
                    this.updateStorageLimit(newLimitBytes);
                    this._logger.error("Unable to upgrade storage", resp);
                }
                return success;
            })
            .catch((err) => {
                this._logger.error("Unable to upgrade storage", err);
                return false;
            });
    }

    async threadPreviews(
        threadsByChat: Record<string, [ThreadSyncDetails[], number | undefined]>
    ): Promise<ThreadPreview[]> {
        return this.api.threadPreviews(threadsByChat);
    }

    getUsers(users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        return this.api.getUsers(users, allowStale);
    }

    getUser(userId: string, allowStale = false): Promise<PartialUserSummary | undefined> {
        return this.api.getUser(userId, allowStale);
    }

    getPublicProfile(userId?: string): Promise<PublicProfile> {
        return this.api.getPublicProfile(userId);
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.api.setUsername(userId, username);
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.api.setBio(bio);
    }

    getBio(userId?: string): Promise<string> {
        return this.api.getBio(userId);
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.api.withdrawCryptocurrency(domain);
    }

    getGroupMessagesByMessageIndex(
        chatId: string,
        messageIndexes: Set<number>,
    ): Promise<EventsResponse<Message>> {
        const serverChat = this._liveState.serverChatSummaries[chatId];

        return this.api.getGroupMessagesByMessageIndex(
            chatId,
            messageIndexes,
            serverChat?.latestEventIndex
        );
    }

    getInviteCode(chatId: string): Promise<InviteCodeResponse> {
        return this.api.getInviteCode(chatId);
    }

    enableInviteCode(chatId: string): Promise<EnableInviteCodeResponse> {
        return this.api.enableInviteCode(chatId);
    }

    disableInviteCode(chatId: string): Promise<DisableInviteCodeResponse> {
        return this.api.disableInviteCode(chatId);
    }

    resetInviteCode(chatId: string): Promise<ResetInviteCodeResponse> {
        return this.resetInviteCode(chatId);
    }

    updateGroup(
        chatId: string,
        name?: string,
        description?: string,
        rules?: GroupRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array
    ): Promise<UpdateGroupResponse> {
        return this.api.updateGroup(chatId, name, description, rules, permissions, avatar)
            .then((resp) => {
                if (resp === "success") {
                    localChatSummaryUpdates.markUpdated(chatId, {
                        kind: "group_chat",
                        name,
                        description,
                        permissions,
                    });
                }
                return resp;
            });
    }

    createGroupChat(currentUser: string, candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.api
            .createGroupChat(candidate)
            .then((resp) => {
                if (resp.kind === "success") {
                    const group = groupChatFromCandidate(currentUser, resp.canisterId, candidate);
                    localChatSummaryUpdates.markAdded(group);
                }
                return resp;
            });
    }

    markThreadSummaryUpdated(threadRootMessageId: string, summary: ThreadSummary): void {
        localMessageUpdates.markThreadSummaryUpdated(threadRootMessageId, summary);
    }

    broadcastMessageRead(chat: ChatSummary, messageId: bigint): void {
        if (chat.kind === "direct_chat") {
            const rtc: WebRtcMessage = {
                kind: "remote_user_read_message",
                chatType: chat.kind,
                messageId: messageId,
                chatId: chat.chatId,
                userId: this.user.userId,
            };
            this.sendRtcMessage([...this._liveState.currentChatUserIds], rtc);
        }
    }

    private updateArgsFromChats(timestamp: bigint, chatSummaries: ChatSummary[]): UpdateArgs {
        return {
            updatesSince: {
                timestamp,
                groupChats: chatSummaries
                    .filter((c) => c.kind === "group_chat" && c.myRole !== "previewer")
                    .map((g) => ({
                        chatId: g.chatId,
                        lastUpdated: (g as GroupChatSummary).lastUpdated,
                    })),
            },
        };
    }

    // FIXME - this is duplicated
    private extractUserIdsFromMentions(text: string): string[] {
        return [...text.matchAll(/@UserId\(([\d\w-]+)\)/g)].map((m) => m[1]);
    }

    private userIdsFromChatSummaries(chats: ChatSummary[]): Set<string> {
        const userIds = new Set<string>();
        chats.forEach((chat) => {
            if (chat.kind === "direct_chat") {
                userIds.add(chat.them);
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
                    usersToUpdate.add(chat.them);
                }
            }

            // Also update any users who haven't been updated for at least an hour
            const now = BigInt(Date.now());
            for (const user of Object.values(allUsers)) {
                if (now - user.updated > ONE_HOUR && user.kind === "user") {
                    usersToUpdate.add(user.userId);
                }
            }

            console.log(`getting updates for ${usersToUpdate.size} user(s)`);
            for (const batch of chunk(Array.from(usersToUpdate), MAX_USERS_TO_UPDATE_PER_BATCH)) {
                const userGroups = groupBy<string, bigint>(batch, (u) => {
                    return allUsers[u]?.updated ?? BigInt(0);
                });

                const usersResp = await this.api.getUsers({
                    userGroups: Array.from(userGroups).map(([updatedSince, users]) => ({
                        users,
                        updatedSince,
                    })),
                });
                userStore.addMany(usersResp.users);
                if (usersResp.serverTimestamp !== undefined) {
                    userStore.setUpdated(batch, usersResp.serverTimestamp);
                }
            }
        } catch (err) {
            this._logger.error("Error updating users", err as Error);
        }
    }

    private async loadChats() {
        try {
            if (this.user === undefined) {
                console.log("Current user not set, cannot load chats");
                return;
            }
            const init = this._liveState.chatsInitialised;
            chatsLoading.set(!init);

            const chats = Object.values(this._liveState.serverChatSummaries);
            const selectedChat = this._liveState.selectedChat;
            const userLookup = this._liveState.userStore;
            const currentState: CurrentChatState = {
                chatSummaries: chats,
                blockedUsers: this._liveState.blockedUsers,
                pinnedChats: this._liveState.pinnedChats,
            };
            const chatsResponse =
                this._chatUpdatesSince === undefined
                    ? await this.api.getInitialState(userLookup, selectedChat?.chatId)
                    : await this.api.getUpdates(
                          currentState,
                          this.updateArgsFromChats(this._chatUpdatesSince, chats),
                          userLookup,
                          selectedChat?.chatId
                      );

            this._chatUpdatesSince = chatsResponse.timestamp;

            if (chatsResponse.wasUpdated) {
                const userIds = this.userIdsFromChatSummaries(chatsResponse.chatSummaries);
                if (!init) {
                    for (const userId of this.user.referrals) {
                        userIds.add(userId);
                    }
                }
                userIds.add(this.user.userId);
                const usersResponse = await this.api.getUsers(
                    {
                        userGroups: [
                            {
                                users: missingUserIds(this._liveState.userStore, userIds),
                                updatedSince: BigInt(0),
                            },
                        ],
                    },
                    true
                );

                userStore.addMany(usersResponse.users);

                if (chatsResponse.blockedUsers !== undefined) {
                    blockedUsers.set(chatsResponse.blockedUsers);
                }

                if (chatsResponse.pinnedChats !== undefined) {
                    pinnedChatsStore.set(chatsResponse.pinnedChats);
                }

                const selectedChat = this._liveState.selectedChat;
                let selectedChatInvalid = true;

                myServerChatSummariesStore.set(
                    chatsResponse.chatSummaries.reduce<Record<string, ChatSummary>>((rec, chat) => {
                        rec[chat.chatId] = chat;
                        if (selectedChat !== undefined && selectedChat.chatId === chat.chatId) {
                            selectedChatInvalid = false;
                        }
                        return rec;
                    }, {})
                );

                if (selectedChatInvalid) {
                    clearSelectedChat();
                } else if (selectedChat !== undefined) {
                    chatUpdatedStore.set({
                        affectedEvents: chatsResponse.affectedEvents[selectedChat.chatId] ?? [],
                    });
                }

                if (chatsResponse.avatarIdUpdate !== undefined) {
                    const blobReference =
                        chatsResponse.avatarIdUpdate === "set_to_none"
                            ? undefined
                            : {
                                  canisterId: this.user.userId,
                                  blobId: chatsResponse.avatarIdUpdate.value,
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
                for (const chat of chatsResponse.chatSummaries) {
                    const latestMessage = chat.latestMessage?.event;
                    if (
                        latestMessage !== undefined &&
                        latestMessage.sender === this.user.userId &&
                        (chat.readByMeUpTo ?? -1) < latestMessage.messageIndex &&
                        !unconfirmed.contains(chat.chatId, latestMessage.messageId)
                    ) {
                        messagesRead.markReadUpTo(chat.chatId, latestMessage.messageIndex);
                    }
                }

                chatsInitialised.set(true);
            }
        } catch (err) {
            this.config.logger.error("Error loading chats", err as Error);
            throw err;
        } finally {
            chatsLoading.set(false);
        }
    }

    get OPENCHAT_BOT_USER_ID(): string {
        return OPENCHAT_BOT_USER_ID;
    }

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
    typersByThread = byThread;
    typing = typing;
    selectedChatId = selectedChatId;
    currentChatMembers = currentChatMembers;
    currentChatBlockedUsers = currentChatBlockedUsers;
    chatStateStore = chatStateStore;
    unconfirmed = unconfirmed;
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
    focusMessageIndex = focusMessageIndex;
    userGroupKeys = userGroupKeys;
    unconfirmedReadByThem = unconfirmedReadByThem;
    currentChatReplyingTo = currentChatReplyingTo;
    currentChatEditingEvent = currentChatEditingEvent;
    isProposalGroup = isProposalGroup;
    typingByChat = typingByChat;
    currentChatFileToAttach = currentChatFileToAttach;
    currentChatTextContent = currentChatTextContent;
    numberOfThreadsStore = numberOfThreadsStore;
    notificationStatus = notificationStatus;
    userMetrics = userMetrics;
    threadEvents = threadEvents;
    selectedThreadKey = selectedThreadKey;
}
