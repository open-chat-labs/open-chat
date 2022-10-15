/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { get, writable } from "svelte/store";
import type { ThreadSyncDetails } from "./domain";
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
    mergeChatMetrics,
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
import { emptyChatMetrics, isPreviewing } from "./domain/chat/chat.utils.shared";
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
    userStatus,
} from "./domain/user/user.utils";
import { rtcConnectionsManager } from "./domain/webrtc/RtcConnectionsManager";
import type { WebRtcMessage } from "./domain/webrtc/webrtc";
import { login, startSession } from "./services/auth";
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
    focusThreadMessageIndex,
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
import { startUserUpdatePoller, userStore } from "./stores/user";
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
import { delegateToChatComponent, filterWebRtcMessage, parseWebRtcMessage } from "./utils/rtc";
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

    set user(user: CreatedUser) {
        this._user = user;
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
        rtcConnectionsManager.init(this.user.userId);
    }

    subscribeToWebRtc(onMessage: (message: unknown) => void): void {
        rtcConnectionsManager.subscribe(onMessage);
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
    setCachedMessageFromNotification = setCachedMessageFromNotification;
    delegateToChatComponent = delegateToChatComponent;
    filterWebRtcMessage = filterWebRtcMessage;
    parseWebRtcMessage = parseWebRtcMessage;
    startPruningLocalUpdates = startPruningLocalUpdates;
    mergeChatMetrics = mergeChatMetrics;
    emptyChatMetrics = emptyChatMetrics;
    createDirectChat = createDirectChat;
    setSelectedChat = setSelectedChat;
    clearSelectedChat = clearSelectedChat;
    updateSummaryWithConfirmedMessage = updateSummaryWithConfirmedMessage;
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
    loadEventWindow = loadEventWindow;
    loadPreviousMessages = loadPreviousMessages;
    loadNewMessages = loadNewMessages;
    handleMessageSentByOther = handleMessageSentByOther;
    refreshAffectedEvents = refreshAffectedEvents;
    updateDetails = updateDetails;
    loadDetails = loadDetails;
    messageIsReadByThem = messageIsReadByThem;
    pinMessage = pinMessage;
    unpinMessage = unpinMessage;
    toggleProposalFilterMessageExpansion = toggleProposalFilterMessageExpansion;
    groupWhile = groupWhile;
    sameUser = sameUser;
    nextEventAndMessageIndexes = nextEventAndMessageIndexes;
    sendMessageWithAttachment = sendMessageWithAttachment;
    canForward = canForward;
    newMessageId = newMessageId;
    forwardMessage = forwardMessage;
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
    archivedChatsStore = archivedChatsStore;
    mutedChatsStore = mutedChatsStore;
    pinnedChatsStore = pinnedChatsStore;
    chatSummariesListStore = chatSummariesListStore;
    chatsLoading = chatsLoading;
    chatsInitialised = chatsInitialised;
    currentChatDraftMessage = currentChatDraftMessage;
    blockedUsers = blockedUsers;
    focusMessageIndex = focusMessageIndex;
    userGroupKeys = userGroupKeys;
    chatUpdatedStore = chatUpdatedStore;
    unconfirmedReadByThem = unconfirmedReadByThem;
    currentChatReplyingTo = currentChatReplyingTo;
    currentChatEditingEvent = currentChatEditingEvent;
    isProposalGroup = isProposalGroup;
    typingByChat = typingByChat;
    currentChatFileToAttach = currentChatFileToAttach;
    currentChatTextContent = currentChatTextContent;
    numberOfThreadsStore = numberOfThreadsStore;
}
