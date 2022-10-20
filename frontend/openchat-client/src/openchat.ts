/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { writable } from "svelte/store";
import type {
    ChatEvent,
    ChatSummary,
    EventWrapper,
    Message,
    MessageContent,
    ThreadSyncDetails,
    Notification,
    GroupChatSummary,
    MemberRole,
    GroupRules,
    GroupPermissions,
    ThreadSummary,
    EventsResponse,
    EnhancedReplyContext,
} from "./domain";
import { AuthProvider } from "./domain";
import {
    buildCryptoTransferText,
    buildTransactionLink,
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
    getContentAsText,
    getDisplayDate,
    getFirstUnreadMention,
    getMembersString,
    getMessageContent,
    getStorageRequiredForMessage,
    getTypingString,
    groupBySender,
    groupChatFromCandidate,
    groupEvents,
    groupMessagesByDate,
    makeRtcConnections,
    markAllRead,
    mergeEventsAndLocalUpdates,
    mergeSendMessageResponse,
    mergeServerEvents,
    messageIsReadByThem,
    metricsEqual,
    newMessageId,
    sameUser,
    serialiseMessageForRtc,
    startTyping,
    stopTyping,
    userIdsFromEvents,
} from "./domain/chat/chat.utils";
import { isPreviewing } from "./domain/chat/chat.utils.shared";
import type { CreatedUser, IdentityState, User } from "./domain/user/user";
import {
    buildUsernameList,
    compareIsNotYouThenUsername,
    compareUsername,
    formatLastOnlineDate,
    getUserStatus,
    groupAvatarUrl,
    missingUserIds,
    nullUser,
    phoneNumberToString,
    userAvatarUrl,
    userStatus,
} from "./domain/user/user.utils";
import { rtcConnectionsManager } from "./domain/webrtc/RtcConnectionsManager";
import type {
    RemoteUserSentMessage,
    RemoteUserToggledReaction,
    WebRtcMessage,
} from "./domain/webrtc/webrtc";
import {
    blockUser,
    deleteMessage,
    editMessage,
    forwardMessage,
    handleMessageSentByOther,
    loadDetails,
    loadEventWindow,
    loadNewMessages,
    loadPreviousMessages,
    moreNewMessagesAvailable,
    morePreviousMessagesAvailable,
    pinMessage,
    refreshAffectedEvents,
    registerPollVote,
    removeMessage,
    selectReaction,
    sendMessageWithAttachment,
    unpinMessage,
    updateDetails,
    updateUserStore,
} from "./services/common/chatThread";
import { showTrace } from "./services/common/profiling";
import { Poller } from "./services/poller";
import { ServiceContainer } from "./services/serviceContainer";
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
    currentChatUserIds,
    currentUserStore,
    eventsStore,
    focusMessageIndex,
    isProposalGroup,
    nextEventAndMessageIndexes,
    numberOfThreadsStore,
    proposalTopicsStore,
    removeChat,
    selectedChatId,
    selectedChatStore,
    selectedServerChatStore,
    serverChatSummariesStore,
    setSelectedChat,
    startChatPoller,
    threadsByChatStore,
    threadsFollowedByMeStore,
    updateSummaryWithConfirmedMessage,
    userGroupKeys,
    threadServerEventsStore,
    threadEvents,
    selectedThreadKey,
    nextEventAndMessageIndexesForThread,
    selectedThreadRootMessageIndex,
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
import { localMessageUpdates, startPruningLocalUpdates } from "./stores/localMessageUpdates";
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
    remainingStorage,
    storageInGb,
    storageStore,
    updateStorageLimit,
} from "./stores/storage";
import { archivedChatsStore, mutedChatsStore } from "./stores/tempChatsStore";
import { translationStore } from "./stores/translation";
import { byThread, isTyping, typing, byChat as typingByChat } from "./stores/typing";
import { unconfirmed, unconfirmedReadByThem } from "./stores/unconfirmed";
import {
    openChatBotUser,
    OPENCHAT_BOT_USER_ID,
    proposalsBotUser,
    specialUsers,
    startUserUpdatePoller,
    userStore,
} from "./stores/user";
import { userCreatedStore } from "./stores/userCreated";
import { dataToBlobUrl } from "./utils/blob";
import { setCachedMessageFromNotification } from "./utils/caching";
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
import { groupWhile, toRecord2 } from "./utils/list";
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
import { getTimeUntilSessionExpiryMs } from "./utils/session";
import {
    ChatUpdated,
    LoadedMessageWindow,
    LoadedNewMessages,
    LoadedPreviousMessages,
    SentMessage,
    SentThreadMessage,
    ThreadClosed,
    ThreadMessagesLoaded,
    ThreadSelected,
    UpgradeRequired,
} from "./events";
import { LiveState } from "./liveState";
import { rollbar } from "./utils/logging";

const UPGRADE_POLL_INTERVAL = 1000;
const MARK_ONLINE_INTERVAL = 61 * 1000;
const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const ONE_MINUTE_MILLIS = 60 * 1000;
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1;

type PinChatResponse =
    | { kind: "success" }
    | { kind: "limit_exceeded"; limit: number }
    | { kind: "failure" };

export class OpenChat extends EventTarget {
    private _authClient: Promise<AuthClient>;
    private _api: ServiceContainer | undefined;
    private _identity: Identity | undefined;
    private _user: CreatedUser | undefined;
    private _liveState: LiveState;
    identityState = writable<IdentityState>("loading_user");

    constructor(private config: OpenChatConfig) {
        super();

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
            this.loadUser(id);
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

    private loadUser(id: Identity) {
        this._api = new ServiceContainer(id, this.config);
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
            window.setTimeout(() => this.loadUser(id), UPGRADE_POLL_INTERVAL);
        } else {
            currentUserStore.set(user);
            this.api.createUserClient(user.userId);
            startMessagesReadTracker(this.api);
            this.startOnlinePoller();
            startSwCheckPoller();
            this.startSession(id).then(() => this.logout());
            startChatPoller(this.api);
            startUserUpdatePoller(this.api);
            startPruningLocalUpdates();
            initNotificationStores();
            this.api.getUserStorageLimits();
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

    // FIXME - find a way to automatically proxy openChat.doStuff to openChat.api.doStuff without having to write a bunch of code
    // so that we don't have to type client.api.doStuff in the calling code
    get api(): ServiceContainer {
        if (this._api === undefined)
            throw new Error("OpenChat tried to make an api call before the api was available");
        return this._api;
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

    staleThreadsCount(threads: Record<string, ThreadSyncDetails[]>): number {
        return this.messagesRead.staleThreadsCount(threads);
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

    sendRtcMessage(userIds: string[], message: WebRtcMessage): void {
        rtcConnectionsManager.sendMessage(userIds, message);
    }

    initWebRtc(): void {
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
            this.addOrReplaceChat(maybeChat);
            return true;
        });
    }

    addOrReplaceChat(chat: ChatSummary): void {
        serverChatSummariesStore.update((summaries) => {
            return {
                ...summaries,
                [chat.chatId]: chat,
            };
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
        mutedChatsStore.set(chatId, mute);
        return this.api
            .toggleMuteNotifications(chatId, mute)
            .then((resp) => {
                if (resp !== "success") {
                    mutedChatsStore.set(chatId, !mute);
                }
                return resp === "success";
            })
            .catch((err) => {
                rollbar.error("Error toggling mute notifications", err);
                mutedChatsStore.set(chatId, !mute);
                return false;
            });
    }

    archiveChat(chatId: string): Promise<boolean> {
        archivedChatsStore.set(chatId, true);
        return this.api
            .archiveChat(chatId)
            .then((resp) => {
                return resp === "success";
            })
            .catch((err) => {
                rollbar.error("Error archiving chat", err);
                archivedChatsStore.set(chatId, false);
                return false;
            });
    }

    unarchiveChat(chatId: string): Promise<boolean> {
        archivedChatsStore.set(chatId, false);
        return this.api
            .unarchiveChat(chatId)
            .then((resp) => resp === "success")
            .catch((err) => {
                rollbar.error("Error un-archiving chat", err);
                archivedChatsStore.set(chatId, true);
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
                rollbar.error("Error pinning chat", err);
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
                rollbar.error("Error unpinning chat", err);
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
                rollbar.error("Error blocking user", err);
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
                rollbar.error("Error unblocking user", err);
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
                rollbar.error("Failed to update user's avatar", err);
                return false;
            });
    }

    makeGroupPrivate(chatId: string): Promise<boolean> {
        return this.api
            .makeGroupPrivate(chatId)
            .then((resp) => {
                if (resp === "success") {
                    serverChatSummariesStore.update((summaries) => {
                        const summary = summaries[chatId];
                        if (summary === undefined || summary.kind !== "group_chat") {
                            return summaries;
                        }

                        return {
                            ...summaries,
                            [chatId]: {
                                ...summary,
                                public: false,
                            },
                        };
                    });
                    return true;
                } else {
                    return false;
                }
            })
            .catch((err) => {
                rollbar.error("Error making group private", err);
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
                    rollbar.warn("Unable to delete group", resp);
                    return false;
                }
            })
            .catch((err) => {
                rollbar.error("Unable to delete group", err);
                return false;
            });
    }

    leaveGroup(chatId: string): Promise<"success" | "failure" | "owner_cannot_leave"> {
        return this.api
            .leaveGroup(chatId)
            .then((resp) => {
                if (resp === "success" || resp === "not_in_group" || resp === "group_not_found") {
                    this.removeChat(chatId);
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
                rollbar.error("Unable to leave group", err);
                return "failure";
            });
    }

    async joinGroup(group: GroupChatSummary): Promise<"success" | "blocked" | "failure"> {
        return this.api
            .joinGroup(group.chatId)
            .then((resp) => {
                if (resp.kind === "group_chat") {
                    this.addOrReplaceChat(resp);
                    return "success";
                } else if (resp.kind === "already_in_group") {
                    this.addOrReplaceChat({
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
                rollbar.error("Unable to join group", err);
                return "failure";
            });
    }

    updateGroupRules(chatId: string, rules: GroupRules | undefined): Promise<boolean> {
        return this.api
            .updateGroup(chatId, undefined, undefined, rules, undefined, undefined)
            .then((resp) => resp === "success")
            .catch((err) => {
                rollbar.error("Update group rules failed: ", err);
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
            .then((resp) => resp === "success")
            .catch((err) => {
                rollbar.error("Update permissions failed: ", err);
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
    canBlockUsers = canBlockUsers;
    canCreatePolls = canCreatePolls;
    canDeleteOtherUsersMessages = canDeleteOtherUsersMessages;
    canPinMessages = canPinMessages;
    canReactToMessages = canReactToMessages;
    canReplyInThread = canReplyInThread;
    containsReaction = containsReaction;
    createMessage = createMessage;
    findMessageById = findMessageById;
    getMessageContent = getMessageContent;
    getStorageRequiredForMessage = getStorageRequiredForMessage;
    groupEvents = groupEvents;
    makeRtcConnections = makeRtcConnections;
    mergeSendMessageResponse = mergeSendMessageResponse;
    mergeServerEvents = mergeServerEvents;
    serialiseMessageForRtc = serialiseMessageForRtc;
    startTyping = startTyping;
    stopTyping = stopTyping;
    mergeEventsAndLocalUpdates = mergeEventsAndLocalUpdates;
    isPreviewing = isPreviewing;
    deleteMessage(
        chat: ChatSummary,
        threadRootMessageIndex: number | undefined,
        messageId: bigint
    ): Promise<boolean> {
        return deleteMessage(this.api, this.user.userId, chat, threadRootMessageIndex, messageId);
    }
    registerPollVote(
        chatId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        messageIndex: number,
        answerIndex: number,
        type: "register" | "delete"
    ): void {
        return registerPollVote(
            this.api,
            this.user.userId,
            chatId,
            threadRootMessageIndex,
            messageId,
            messageIndex,
            answerIndex,
            type
        );
    }
    selectReaction(
        chat: ChatSummary,
        userId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        reaction: string,
        username: string,
        kind: "add" | "remove"
    ): Promise<boolean> {
        const result = selectReaction(
            this.api,
            chat,
            userId,
            threadRootMessageIndex,
            messageId,
            reaction,
            username,
            kind
        );
        this.sendRtcMessage([...this._liveState.currentChatUserIds], {
            kind: "remote_user_toggled_reaction",
            chatType: chat.kind,
            chatId: chat.chatId,
            messageId: messageId,
            reaction,
            userId,
            added: kind === "add",
            threadRootMessageIndex,
        });
        return result;
    }
    updateUserStore = updateUserStore;
    isTyping = isTyping;
    trackEvent = trackEvent;
    twitterLinkRegex = twitterLinkRegex;
    youtubeRegex = youtubeRegex;
    metricsEqual = metricsEqual;
    getMembersString = getMembersString;
    compareIsNotYouThenUsername = compareIsNotYouThenUsername;
    compareUsername = compareUsername;
    blockUser(chatId: string, userId: string): Promise<void> {
        return blockUser(this.api, chatId, userId);
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
    private setCachedMessageFromNotification = (
        chatId: string,
        threadRootMessageIndex: number | undefined,
        message: EventWrapper<Message>
    ): void => {
        if (this.config.enableClientCaching) {
            setCachedMessageFromNotification(chatId, threadRootMessageIndex, message);
        }
    };
    filterWebRtcMessage = filterWebRtcMessage;
    parseWebRtcMessage = parseWebRtcMessage;
    createDirectChat = createDirectChat;
    setSelectedChat(chat: ChatSummary, messageIndex?: number): void {
        setSelectedChat(this.api, chat, messageIndex);

        const { selectedChat, selectedServerChat, focusMessageIndex, events } = this._liveState;
        if (selectedChat !== undefined && selectedServerChat !== undefined) {
            if (focusMessageIndex !== undefined) {
                this.loadEventWindow(selectedServerChat, selectedChat, focusMessageIndex).then(
                    () => {
                        this.loadDetails(chat, events);
                    }
                );
            } else {
                this.loadPreviousMessages(selectedServerChat, selectedChat).then(() => {
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
        chat: ChatSummary,
        rootEvent: EventWrapper<Message>,
        thread: ThreadSummary,
        range: [number, number],
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number,
        clearEvents: boolean
    ): Promise<void> {
        const { selectedThreadKey } = this._liveState;
        if (selectedThreadKey === undefined) return;

        const chatId = chat.chatId;
        const eventsResponse = await this.api.chatEvents(
            chat,
            range,
            startIndex,
            ascending,
            threadRootMessageIndex,
            thread.latestEventIndex
        );
        if (chatId !== chat.chatId) {
            // the chat has changed while we were loading the messages
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

            threadServerEventsStore.update((events) => this.mergeServerEvents(events, newEvents));
            this.makeRtcConnections(
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
        await this.updateUserStore(this.api, chatId, this.user.userId, userIds);

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
    clearSelectedChat = clearSelectedChat;
    removeChat = removeChat;
    canSendMessages = canSendMessages;
    canChangeRoles = canChangeRoles;
    canUnblockUsers = canUnblockUsers;
    canRemoveMembers = canRemoveMembers;
    mergeKeepingOnlyChanged = mergeKeepingOnlyChanged;
    canEditGroupDetails = canEditGroupDetails;
    canChangePermissions = canChangePermissions;
    canInviteUsers = canInviteUsers;
    canDeleteGroup = canDeleteGroup;
    canMakeGroupPrivate = canMakeGroupPrivate;
    messageContentFromFile = messageContentFromFile;
    formatFileSize = formatFileSize;
    morePreviousMessagesAvailable = morePreviousMessagesAvailable;
    moreNewMessagesAvailable = moreNewMessagesAvailable;
    loadEventWindow(
        serverChat: ChatSummary,
        chat: ChatSummary,
        messageIndex: number
    ): Promise<number | undefined> {
        return loadEventWindow(this.api, this.user, serverChat, chat, messageIndex).then((idx) => {
            if (idx !== undefined) {
                this.dispatchEvent(new LoadedMessageWindow(idx));
            }
            return idx;
        });
    }
    loadPreviousMessages(serverChat: ChatSummary, clientChat: ChatSummary): Promise<void> {
        return loadPreviousMessages(this.api, this.user, serverChat, clientChat).then(() => {
            this.dispatchEvent(new LoadedPreviousMessages());
            return;
        });
    }
    loadNewMessages(serverChat: ChatSummary, clientChat: ChatSummary): Promise<boolean> {
        return loadNewMessages(this.api, this.user, serverChat, clientChat).then((res) => {
            this.dispatchEvent(new LoadedNewMessages(res));
            return res;
        });
    }
    handleMessageSentByOther(
        clientChat: ChatSummary,
        messageEvent: EventWrapper<Message>
    ): Promise<void> {
        return handleMessageSentByOther(this.api, this.user, clientChat, messageEvent);
    }
    refreshAffectedEvents(clientChat: ChatSummary, affectedEventIndexes: number[]): Promise<void> {
        return refreshAffectedEvents(this.api, this.user, clientChat, affectedEventIndexes);
    }
    updateDetails(
        clientChat: ChatSummary,
        currentEvents: EventWrapper<ChatEvent>[]
    ): Promise<void> {
        return updateDetails(this.api, this.user, clientChat, currentEvents);
    }
    loadDetails(clientChat: ChatSummary, currentEvents: EventWrapper<ChatEvent>[]): Promise<void> {
        return loadDetails(this.api, this.user, clientChat, currentEvents);
    }
    messageIsReadByThem = messageIsReadByThem;
    pinMessage(clientChat: ChatSummary, messageIndex: number): void {
        return pinMessage(this.api, clientChat, messageIndex);
    }
    unpinMessage(clientChat: ChatSummary, messageIndex: number): void {
        return unpinMessage(this.api, clientChat, messageIndex);
    }
    toggleProposalFilterMessageExpansion = toggleProposalFilterMessageExpansion;
    groupWhile = groupWhile;
    sameUser = sameUser;
    nextEventAndMessageIndexes = nextEventAndMessageIndexes;
    nextEventAndMessageIndexesForThread = nextEventAndMessageIndexesForThread;

    forwardMessage(
        serverChat: ChatSummary,
        clientChat: ChatSummary,
        currentEvents: EventWrapper<ChatEvent>[],
        msg: Message
    ): Promise<number | undefined> {
        // TODO check storage requirements

        // Only forward the primary content not the caption
        const content = { ...msg.content };
        if ("caption" in content) {
            content.caption = "";
        }

        const [nextEventIndex, nextMessageIndex] = this.nextEventAndMessageIndexes();

        msg = {
            kind: "message",
            messageId: this.newMessageId(),
            messageIndex: nextMessageIndex,
            sender: this.user.userId,
            content,
            repliesTo: undefined,
            reactions: [],
            edited: false,
            forwarded: msg.content.kind !== "giphy_content",
        };
        const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

        return forwardMessage(
            this.api,
            this.user,
            serverChat,
            clientChat,
            currentEvents,
            event
        ).then((jumpTo) => {
            this.dispatchEvent(new SentMessage(jumpTo));
            return jumpTo;
        });
    }

    sendMessageWithAttachment(
        serverChat: ChatSummary,
        clientChat: ChatSummary,
        currentEvents: EventWrapper<ChatEvent>[],
        textContent: string | undefined,
        mentioned: User[],
        fileToAttach: MessageContent | undefined,
        replyingTo: EnhancedReplyContext | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<number | undefined> {
        if (textContent || fileToAttach) {
            const storageRequired = this.getStorageRequiredForMessage(fileToAttach);
            if (this._liveState.remainingStorage < storageRequired) {
                this.dispatchEvent(new UpgradeRequired("explain"));
                return Promise.resolve(undefined);
            }

            const [nextEventIndex, nextMessageIndex] =
                threadRootMessageIndex !== undefined
                    ? this.nextEventAndMessageIndexesForThread(currentEvents)
                    : this.nextEventAndMessageIndexes();

            const msg = this.createMessage(
                this.user.userId,
                nextMessageIndex,
                textContent,
                replyingTo,
                fileToAttach
            );
            const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };

            return sendMessageWithAttachment(
                this.api,
                this.user,
                serverChat,
                clientChat,
                currentEvents,
                event,
                mentioned,
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
        return Promise.resolve(undefined);
    }
    canForward = canForward;
    newMessageId = newMessageId;
    removeMessage = removeMessage;
    canLeaveGroup = canLeaveGroup;
    canAddMembers = canAddMembers;
    getFirstUnreadMention = getFirstUnreadMention;
    markAllRead = markAllRead;
    buildCryptoTransferText = buildCryptoTransferText;
    buildTransactionLink = buildTransactionLink;
    getDisplayDate = getDisplayDate;
    isSocialVideoLink = isSocialVideoLink;
    containsSocialVideoLink = containsSocialVideoLink;
    calculateMediaDimensions = calculateMediaDimensions;
    dataToBlobUrl = dataToBlobUrl;
    groupChatFromCandidate = groupChatFromCandidate;
    askForNotificationPermission = askForNotificationPermission;
    setSoftDisabled = setSoftDisabled;

    editMessageWithAttachment(
        chat: ChatSummary,
        textContent: string | undefined,
        fileToAttach: MessageContent | undefined,
        editingEvent: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): void {
        if (textContent || fileToAttach) {
            const msg = {
                ...editingEvent.event,
                edited: true,
                content: this.getMessageContent(textContent ?? undefined, fileToAttach),
            };
            editMessage(this.api, chat, msg, threadRootMessageIndex);
        }
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

        const chat = this._liveState.serverChatSummaries[chatId];
        if (chat === undefined || chat.latestEventIndex >= message.index) {
            return;
        }

        this.setCachedMessageFromNotification(chatId, threadRootMessageIndex, message);

        const chatType = chat.kind === "direct_chat" ? "direct" : "group";
        Promise.all([
            this.api.rehydrateMessage(chatType, chatId, message, undefined, chat.latestEventIndex),
            this.addMissingUsersFromMessage(message),
        ]).then(([m, _]) => {
            updateSummaryWithConfirmedMessage(chatId, m);

            if (this._liveState.selectedChatId === chatId) {
                this.handleMessageSentByOther(chat, m);
            }
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
        const fromChatId = this.filterWebRtcMessage(msg);
        if (fromChatId === undefined) return;

        // this means we have a selected chat but it doesn't mean it's the same as this message
        const parsedMsg = this.parseWebRtcMessage(fromChatId, msg);
        const { selectedChat, threadEvents, events } = this._liveState;

        if (
            parsedMsg.threadRootMessageIndex !== undefined &&
            parsedMsg.threadRootMessageIndex === this._liveState.selectedThreadRootMessageIndex &&
            selectedChat !== undefined &&
            fromChatId === selectedChat.chatId
        ) {
            // this is a webrtc message relating to the selected thread
            this.handleWebRtcMessageInternal(
                fromChatId,
                parsedMsg,
                selectedChat,
                threadEvents,
                parsedMsg.threadRootMessageIndex
            );
        } else {
            if (selectedChat !== undefined && fromChatId === selectedChat.chatId) {
                // this is a webrtc message relating to the selected chat
                this.handleWebRtcMessageInternal(
                    fromChatId,
                    parsedMsg,
                    selectedChat,
                    events,
                    undefined
                );
            } else {
                if (parsedMsg.kind === "remote_user_sent_message") {
                    unconfirmed.add(fromChatId, parsedMsg.messageEvent);
                }
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
                this.removeMessage(
                    this.user.userId,
                    chat,
                    msg.messageId,
                    msg.userId,
                    threadRootMessageIndex
                );
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
                ? this.nextEventAndMessageIndexesForThread(events)
                : this.nextEventAndMessageIndexes();

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

    /**
     * Reactive state provided in the form of svelte stores
     */
    profileStore = profileStore;
    percentageStorageRemaining = percentageStorageRemaining;
    percentageStorageUsed = percentageStorageUsed;
    storageStore = storageStore;
    storageInGb = storageInGb;
    remainingStorage = remainingStorage;
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
    currentChatUserIds = currentChatUserIds;
    selectedChatId = selectedChatId;
    currentChatMembers = currentChatMembers;
    currentChatBlockedUsers = currentChatBlockedUsers;
    chatStateStore = chatStateStore;
    unconfirmed = unconfirmed;
    localMessageUpdates = localMessageUpdates;
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
