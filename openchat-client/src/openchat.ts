/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { get, writable } from "svelte/store";
import type { ThreadSyncDetails } from "./domain";
import {
    buildUserAvatarUrl,
    canBlockUsers,
    canCreatePolls,
    canDeleteOtherUsersMessages,
    canPinMessages,
    canReactToMessages,
    canReplyInThread,
    containsReaction,
    createMessage,
    findMessageById,
    getContentAsText,
    getMembersString,
    getMessageContent,
    getStorageRequiredForMessage,
    getTypingString,
    groupBySender,
    groupEvents,
    groupMessagesByDate,
    makeRtcConnections,
    mergeEventsAndLocalUpdates,
    mergeSendMessageResponse,
    mergeServerEvents,
    metricsEqual,
    serialiseMessageForRtc,
    startTyping,
    stopTyping,
    userIdsFromEvents,
} from "./domain/chat/chat.utils";
import { isPreviewing } from "./domain/chat/chat.utils.shared";
import type { CreatedUser, IdentityState } from "./domain/user/user";
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
} from "./domain/user/user.utils";
import { rtcConnectionsManager } from "./domain/webrtc/RtcConnectionsManager";
import type { WebRtcMessage } from "./domain/webrtc/webrtc";
import { login, startSession } from "./services/auth";
import {
    blockUser,
    deleteMessage,
    editMessage,
    registerPollVote,
    selectReaction,
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
import {
    chatStateStore,
    chatSummariesStore,
    currentChatBlockedUsers,
    currentChatMembers,
    currentChatPinnedMessages,
    currentChatRules,
    currentChatUserIds,
    currentUserStore,
    eventsStore,
    focusThreadMessageIndex,
    proposalTopicsStore,
    selectedChatId,
    selectedChatStore,
    selectedServerChatStore,
    serverChatSummariesStore,
    startChatPoller,
    threadsByChatStore,
    threadsFollowedByMeStore,
} from "./stores/chat";
import { cryptoBalance, lastCryptoSent } from "./stores/crypto";
import { draftThreadMessages } from "./stores/draftThreadMessages";
import {
    disableAllProposalFilters,
    enableAllProposalFilters,
    filteredProposalsStore,
    toggleProposalFilter,
} from "./stores/filteredProposals";
import { localMessageUpdates } from "./stores/localMessageUpdates";
import { messagesRead, startMessagesReadTracker } from "./stores/markRead";
import { profileStore } from "./stores/profiling";
import {
    percentageStorageRemaining,
    percentageStorageUsed,
    remainingStorage,
    storageInGb,
    storageStore,
    updateStorageLimit,
} from "./stores/storage";
import { translationStore } from "./stores/translation";
import { byThread, isTyping, typing } from "./stores/typing";
import { unconfirmed } from "./stores/unconfirmed";
import { startUserUpdatePoller, userStore } from "./stores/user";
import { userCreatedStore } from "./stores/userCreated";
import { formatTokens, validateTokenInput } from "./utils/cryptoFormatter";
import {
    formatMessageDate,
    toDateString,
    toDatetimeString,
    toLongDateString,
    toShortTimeString,
} from "./utils/date";
import { toRecord2 } from "./utils/list";
import { audioRecordingMimeType, fillMessage, twitterLinkRegex, youtubeRegex } from "./utils/media";
import { toTitleCase } from "./utils/string";
import { formatTimeRemaining } from "./utils/time";
import { initialiseTracking, trackEvent } from "./utils/tracking";
import { startSwCheckPoller } from "./utils/updateSw";

const UPGRADE_POLL_INTERVAL = 1000;
const MARK_ONLINE_INTERVAL = 61 * 1000;

export class OpenChat extends EventTarget {
    private _authClient: Promise<AuthClient>;
    private _api: ServiceContainer | undefined;
    private _identity: Identity | undefined;
    private _user: CreatedUser | undefined;

    identityState = writable<IdentityState>("loading_user");

    constructor() {
        super();

        localStorage.removeItem("ic-delegation");
        localStorage.removeItem("ic-identity");
        this._authClient = AuthClient.create({
            idleOptions: {
                disableIdle: true,
            },
            storage: idbAuthClientStore,
        });
        initialiseTracking();

        this._authClient.then((c) => c.getIdentity()).then((id) => this.loadedIdentity(id));
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
        login(get(selectedAuthProviderStore)).then((id) => this.loadedIdentity(id));
    }

    private loadUser(id: Identity) {
        this._api = new ServiceContainer(id);
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
            startSession(id).then(() => this.logout());
            startChatPoller(this.api);
            startUserUpdatePoller(this.api);
            this.api.getUserStorageLimits();
            this.identityState.set("logged_in");

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

    async showAuthProviders(): Promise<boolean> {
        const KEY_STORAGE_DELEGATION = "delegation";
        const ls = await lsAuthClientStore.get(KEY_STORAGE_DELEGATION);
        const idb = await idbAuthClientStore.get(KEY_STORAGE_DELEGATION);
        const noDelegation = ls == null && idb == null;
        return !get(userCreatedStore) && noDelegation;
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

    staleThreadsCount(threads: Record<string, ThreadSyncDetails[]>): number {
        return this.messagesRead.staleThreadsCount(threads);
    }

    markThreadRead(chatId: string, threadRootMessageIndex: number, readUpTo: number): void {
        return this.messagesRead.markThreadRead(chatId, threadRootMessageIndex, readUpTo);
    }

    sendRtcMessage(userIds: string[], message: WebRtcMessage): void {
        rtcConnectionsManager.sendMessage(userIds, message);
    }

    /**
     * Wrap a bunch of pure utility functions
     */
    showTrace = showTrace;
    userAvatarUrl = userAvatarUrl;
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
    deleteMessage = deleteMessage;
    editMessage = editMessage;
    registerPollVote = registerPollVote;
    selectReaction = selectReaction;
    updateUserStore = updateUserStore;
    isTyping = isTyping;
    trackEvent = trackEvent;
    twitterLinkRegex = twitterLinkRegex;
    youtubeRegex = youtubeRegex;
    metricsEqual = metricsEqual;
    getMembersString = getMembersString;
    compareIsNotYouThenUsername = compareIsNotYouThenUsername;
    compareUsername = compareUsername;
    blockUser = blockUser;
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
    focusThreadMessageIndex = focusThreadMessageIndex;
    proposalTopicsStore = proposalTopicsStore;
    filteredProposalsStore = filteredProposalsStore;
    cryptoBalance = cryptoBalance;
    selectedServerChatStore = selectedServerChatStore;
}
