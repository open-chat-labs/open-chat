import { initDb } from "../utils/caching";
import { getAllUsers } from "../utils/userCache";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";
import { UnsupportedValueError } from "../utils/error";
import { messagesRead } from "../stores/markRead";
import { NotificationsClient } from "./notifications/notifications.client";
import { OnlineClient } from "./online/online.client";
import { DataClient } from "./data/data.client";
import { storageStore } from "../stores/storage";
import { LedgerClient } from "./ledger/ledger.client";
import { cryptoBalance } from "../stores/crypto";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import { userStore } from "../stores/user";
import { toRecord } from "../utils/list";
import { measure } from "./common/profiling";
import { buildBlobUrl, buildUserAvatarUrl, threadsReadFromChat } from "../domain/chat/chat.utils";
import { SnsGovernanceClient } from "./snsGovernance/sns.governance.client";
import { snsFunctions } from "../stores/snsFunctions";
import { userCreatedStore } from "../stores/settings";
import { selectedAuthProviderStore } from "../stores/authProviders";
import { AuthProvider } from "../domain/auth";
import { rollbar } from "../utils/logging";
export const apiKey = Symbol();
export class ServiceContainer {
    constructor(identity) {
        this.identity = identity;
        this.db = initDb(identity.getPrincipal().toString());
        this._onlineClient = OnlineClient.create(identity);
        this._userIndexClient = UserIndexClient.create(identity);
        this._groupIndexClient = GroupIndexClient.create(identity);
        this._notificationClient = NotificationsClient.create(identity);
        this._ledgerClients = {
            icp: LedgerClient.create(identity, "process.env.LEDGER_CANISTER_ICP"),
            btc: LedgerClient.create(identity, "process.env.LEDGER_CANISTER_BTC"),
            chat: LedgerClient.create(identity, "process.env.LEDGER_CANISTER_CHAT"),
        };
        this._groupClients = {};
        if (this.db) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            measure("getAllUsers", () => getAllUsers()).then((users) => {
                const lookup = toRecord(users.map((user) => this.rehydrateUserSummary(user)), (u) => u.userId);
                userStore.set(lookup);
            });
        }
    }
    set groupInvite(value) {
        this._groupInvite = value;
    }
    createUserClient(userId) {
        this._userClient = UserClient.create(userId, this.identity, this.db, this._groupInvite);
        return this;
    }
    getGroupClient(chatId) {
        if (!this._groupClients[chatId]) {
            const inviteCode = this.getProvidedInviteCode(chatId);
            this._groupClients[chatId] = GroupClient.create(chatId, this.identity, this.db, inviteCode);
        }
        return this._groupClients[chatId];
    }
    get userClient() {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }
    getProvidedInviteCode(chatId) {
        var _a;
        return ((_a = this._groupInvite) === null || _a === void 0 ? void 0 : _a.chatId) === chatId ? this._groupInvite.code : undefined;
    }
    editMessage(chat, msg, threadRootMessageIndex) {
        if (chat.kind === "group_chat") {
            return this.editGroupMessage(chat.chatId, msg, threadRootMessageIndex);
        }
        if (chat.kind === "direct_chat") {
            return this.editDirectMessage(chat.them, msg, threadRootMessageIndex);
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }
    sendMessage(chat, user, mentioned, msg, threadRootMessageIndex) {
        if (chat.kind === "group_chat") {
            if (msg.content.kind === "crypto_content") {
                return this.userClient.sendGroupICPTransfer(chat.chatId, msg.content.transfer.recipient, user, msg, threadRootMessageIndex);
            }
            return this.sendGroupMessage(chat.chatId, user.username, mentioned, msg, threadRootMessageIndex);
        }
        if (chat.kind === "direct_chat") {
            const replyingToChatId = msg.repliesTo &&
                msg.repliesTo.kind === "rehydrated_reply_context" &&
                chat.chatId !== msg.repliesTo.chatId
                ? msg.repliesTo.chatId
                : undefined;
            return this.sendDirectMessage(chat.them, user, msg, replyingToChatId, threadRootMessageIndex);
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }
    sendGroupMessage(chatId, senderName, mentioned, message, threadRootMessageIndex) {
        return this.getGroupClient(chatId).sendMessage(senderName, mentioned, message, threadRootMessageIndex);
    }
    editGroupMessage(chatId, message, threadRootMessageIndex) {
        return this.getGroupClient(chatId).editMessage(message, threadRootMessageIndex);
    }
    sendDirectMessage(recipientId, sender, message, replyingToChatId, threadRootMessageIndex) {
        return this.userClient.sendMessage(recipientId, sender, message, replyingToChatId, threadRootMessageIndex);
    }
    editDirectMessage(recipientId, message, threadRootMessageIndex) {
        return this.userClient.editMessage(recipientId, message, threadRootMessageIndex);
    }
    createGroupChat(candidate) {
        return this.userClient.createGroup(candidate);
    }
    updateGroup(chatId, name, desc, rules, permissions, avatar) {
        return this.getGroupClient(chatId).updateGroup(name, desc, rules, permissions, avatar);
    }
    addMembers(chatId, userIds, myUsername, allowBlocked) {
        if (!userIds.length) {
            return Promise.resolve({ kind: "add_members_success" });
        }
        return this.getGroupClient(chatId).addMembers(userIds, myUsername, allowBlocked);
    }
    directChatEventsWindow(eventIndexRange, theirUserId, messageIndex, latestClientMainEventIndex) {
        return this.rehydrateEventResponse("direct", theirUserId, this.userClient.chatEventsWindow(eventIndexRange, theirUserId, messageIndex, latestClientMainEventIndex), undefined, latestClientMainEventIndex);
    }
    chatEvents(chat, eventIndexRange, startIndex, ascending, threadRootMessageIndex, 
    // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
    latestClientEventIndex) {
        return chat.kind === "group_chat"
            ? this.groupChatEvents(eventIndexRange, chat.chatId, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex)
            : this.directChatEvents(eventIndexRange, chat.them, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex);
    }
    directChatEvents(eventIndexRange, theirUserId, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex) {
        return this.rehydrateEventResponse("direct", theirUserId, this.userClient.chatEvents(eventIndexRange, theirUserId, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex), threadRootMessageIndex, latestClientEventIndex);
    }
    directChatEventsByEventIndex(theirUserId, eventIndexes, threadRootMessageIndex, 
    // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
    latestClientEventIndex) {
        return this.rehydrateEventResponse("direct", theirUserId, this.userClient.chatEventsByIndex(eventIndexes, theirUserId, threadRootMessageIndex, latestClientEventIndex), threadRootMessageIndex, latestClientEventIndex);
    }
    groupChatEventsWindow(eventIndexRange, chatId, messageIndex, latestClientMainEventIndex) {
        return this.rehydrateEventResponse("group", chatId, this.getGroupClient(chatId).chatEventsWindow(eventIndexRange, messageIndex, latestClientMainEventIndex), undefined, latestClientMainEventIndex);
    }
    groupChatEvents(eventIndexRange, chatId, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex) {
        return this.rehydrateEventResponse("group", chatId, this.getGroupClient(chatId).chatEvents(eventIndexRange, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex), threadRootMessageIndex, latestClientEventIndex);
    }
    groupChatEventsByEventIndex(chatId, eventIndexes, threadRootMessageIndex, 
    // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
    latestClientEventIndex) {
        return this.rehydrateEventResponse("group", chatId, this.getGroupClient(chatId).chatEventsByIndex(eventIndexes, threadRootMessageIndex, latestClientEventIndex), threadRootMessageIndex, latestClientEventIndex);
    }
    rehydrateMessageContent(content) {
        if ((content.kind === "file_content" ||
            content.kind === "image_content" ||
            content.kind === "audio_content") &&
            content.blobReference !== undefined) {
            content = this.rehydrateDataContent(content);
        }
        if (content.kind === "video_content") {
            return Object.assign(Object.assign({}, content), { videoData: this.rehydrateDataContent(content.videoData), imageData: this.rehydrateDataContent(content.imageData) });
        }
        return content;
    }
    rehydrateEventList(events) {
        return events.map((e) => {
            if (e.event.kind === "message") {
                const original = e.event.content;
                const rehydrated = this.rehydrateMessageContent(original);
                if (original !== rehydrated) {
                    return Object.assign(Object.assign({}, e), { event: Object.assign(Object.assign({}, e.event), { content: rehydrated }) });
                }
            }
            return e;
        });
    }
    /**
     * Given a list of events, identify all eventIndexes which we may need to look up
     * In practice this means the event indexes of embedded reply contexts
     */
    findMissingEventIndexesByChat(defaultChatId, events) {
        return events.reduce((result, ev) => {
            var _a;
            if (ev.event.kind === "message" &&
                ev.event.repliesTo &&
                ev.event.repliesTo.kind === "raw_reply_context") {
                const chatId = (_a = ev.event.repliesTo.chatIdIfOther) !== null && _a !== void 0 ? _a : defaultChatId;
                if (result[chatId] === undefined) {
                    result[chatId] = [];
                }
                result[chatId].push(ev.event.repliesTo.eventIndex);
            }
            return result;
        }, {});
    }
    messagesFromEventsResponse(chatId, resp) {
        if (resp !== "events_failed") {
            return [
                chatId,
                resp.events.reduce((msgs, ev) => {
                    if (ev.event.kind === "message") {
                        msgs.push(ev);
                    }
                    return msgs;
                }, []),
            ];
        }
        else {
            return [chatId, []];
        }
    }
    async resolveMissingIndexes(chatType, currentChatId, events, threadRootMessageIndex, latestClientEventIndex) {
        const missing = this.findMissingEventIndexesByChat(currentChatId, events);
        const missingMessages = [];
        // this looks horrendous but remember these things will *usually* come straight from the cache
        Object.entries(missing).forEach(([chatId, idxs]) => {
            if (chatId === currentChatId && chatType === "direct") {
                missingMessages.push(this.userClient
                    .chatEventsByIndex(idxs, currentChatId, threadRootMessageIndex, latestClientEventIndex)
                    .then((resp) => this.messagesFromEventsResponse(chatId, resp)));
            }
            else {
                // it must be a group chat
                const client = this.getGroupClient(chatId);
                missingMessages.push(client
                    .chatEventsByIndex(idxs, threadRootMessageIndex, latestClientEventIndex)
                    .then((resp) => this.messagesFromEventsResponse(chatId, resp)));
            }
        });
        const result = await Promise.all(missingMessages);
        return result.reduce((res, [chatId, messages]) => {
            if (!res[chatId]) {
                res[chatId] = [];
            }
            res[chatId] = res[chatId].concat(messages);
            return res;
        }, {});
    }
    rehydrateMissingReplies(defaultChatId, events, missing) {
        return events.map((ev) => {
            var _a, _b;
            if (ev.event.kind === "message" &&
                ev.event.repliesTo &&
                ev.event.repliesTo.kind === "raw_reply_context") {
                const chatId = (_a = ev.event.repliesTo.chatIdIfOther) !== null && _a !== void 0 ? _a : defaultChatId;
                const messageEvents = missing[chatId];
                const idx = ev.event.repliesTo.eventIndex;
                const msg = (_b = messageEvents.find((me) => me.index === idx)) === null || _b === void 0 ? void 0 : _b.event;
                if (msg) {
                    return Object.assign(Object.assign({}, ev), { event: Object.assign(Object.assign({}, ev.event), { repliesTo: {
                                kind: "rehydrated_reply_context",
                                content: this.rehydrateMessageContent(msg.content),
                                senderId: msg.sender,
                                messageId: msg.messageId,
                                messageIndex: msg.messageIndex,
                                eventIndex: idx,
                                chatId,
                                edited: msg.edited,
                            } }) });
                }
                else {
                    console.error("Reply context not found, this should never happen", defaultChatId, chatId);
                    rollbar.error("Reply context not found, this should never happen", defaultChatId, chatId);
                }
                return ev;
            }
            return ev;
        });
    }
    async rehydrateEventResponse(chatType, currentChatId, eventsPromise, threadRootMessageIndex, latestClientEventIndex) {
        const resp = await eventsPromise;
        if (resp === "events_failed") {
            return resp;
        }
        const missing = await this.resolveMissingIndexes(chatType, currentChatId, resp.events.concat(resp.affectedEvents), threadRootMessageIndex, latestClientEventIndex);
        resp.events = this.rehydrateMissingReplies(currentChatId, resp.events, missing);
        resp.events = this.rehydrateEventList(resp.events);
        resp.affectedEvents = this.rehydrateMissingReplies(currentChatId, resp.affectedEvents, missing);
        resp.affectedEvents = this.rehydrateEventList(resp.affectedEvents);
        return resp;
    }
    rehydrateUserSummary(userSummary) {
        var _a;
        const ref = userSummary.blobReference;
        return Object.assign(Object.assign({}, userSummary), { blobData: undefined, blobUrl: buildUserAvatarUrl(userSummary.userId, (_a = ref === null || ref === void 0 ? void 0 : ref.blobId) !== null && _a !== void 0 ? _a : undefined) });
    }
    rehydrateDataContent(dataContent, blobType = "blobs") {
        const ref = dataContent.blobReference;
        return ref !== undefined
            ? Object.assign(Object.assign({}, dataContent), { blobData: undefined, blobUrl: buildBlobUrl(ref.canisterId, ref.blobId, blobType) }) : dataContent;
    }
    async rehydrateMessage(chatType, currentChatId, message, threadRootMessageIndex, latestClientEventIndex) {
        const missing = await this.resolveMissingIndexes(chatType, currentChatId, [message], threadRootMessageIndex, latestClientEventIndex);
        [message] = this.rehydrateMissingReplies(currentChatId, [message], missing);
        [message] = this.rehydrateEventList([message]);
        return message;
    }
    searchUsers(searchTerm, maxResults = 20) {
        return this._userIndexClient
            .searchUsers(searchTerm, maxResults)
            .then((users) => users.map((u) => this.rehydrateUserSummary(u)));
    }
    searchGroups(searchTerm, maxResults = 10) {
        return this._groupIndexClient.search(searchTerm, maxResults).then((res) => {
            if (res.kind === "success") {
                return Object.assign(Object.assign({}, res), { matches: res.matches.map((match) => this.rehydrateDataContent(match, "avatar")) });
            }
            return res;
        });
    }
    searchAllMessages(searchTerm, maxResults = 10) {
        return this.userClient.searchAllMessages(searchTerm, maxResults);
    }
    searchGroupChat(chatId, searchTerm, maxResults = 10) {
        return this.getGroupClient(chatId).searchGroupChat(searchTerm, maxResults);
    }
    searchDirectChat(userId, searchTerm, maxResults = 10) {
        return this.userClient.searchDirectChat(userId, searchTerm, maxResults);
    }
    async getUser(userId, allowStale = false) {
        const response = await this.getUsers({
            userGroups: [
                {
                    users: [userId],
                    updatedSince: BigInt(0),
                },
            ],
        }, allowStale);
        if (response.users.length == 0) {
            return undefined;
        }
        return response.users[0];
    }
    getUsers(users, allowStale = false) {
        return this._userIndexClient.getUsers(users, allowStale).then((resp) => (Object.assign(Object.assign({}, resp), { users: resp.users.map((u) => this.rehydrateUserSummary(u)) })));
    }
    async handleMergedUpdatesResponse(resp, rehydrateLastMessage = true) {
        const chatSummaries = await Promise.all(resp.chatSummaries.map(async (chat) => {
            messagesRead.syncWithServer(chat.chatId, chat.readByMeUpTo, threadsReadFromChat(chat));
            if (chat.latestMessage !== undefined && rehydrateLastMessage) {
                const chatType = chat.kind === "direct_chat" ? "direct" : "group";
                const latestMessage = await this.rehydrateMessage(chatType, chat.chatId, chat.latestMessage, undefined, chat.latestEventIndex);
                chat = Object.assign(Object.assign({}, chat), { latestMessage });
            }
            return chat.kind === "direct_chat"
                ? chat
                : this.rehydrateDataContent(chat, "avatar");
        }));
        return Object.assign(Object.assign({}, resp), { chatSummaries });
    }
    getInitialState(selectedChatId) {
        return this.userClient.getInitialState(selectedChatId).then((resp) => {
            return this.handleMergedUpdatesResponse(resp, false);
        });
    }
    getUpdates(currentState, args, selectedChatId) {
        return this.userClient.getUpdates(currentState, args, selectedChatId).then((resp) => {
            return this.handleMergedUpdatesResponse(resp);
        });
    }
    getCurrentUser() {
        return this._userIndexClient.getCurrentUser().then((response) => {
            if (response.kind === "created_user") {
                userCreatedStore.set(true);
                selectedAuthProviderStore.init(AuthProvider.II);
            }
            return response;
        });
    }
    submitPhoneNumber(phoneNumber) {
        return this._userIndexClient.submitPhoneNumber(phoneNumber);
    }
    resendRegistrationCode() {
        return this._userIndexClient.resendRegistrationCode();
    }
    confirmPhoneNumber(code) {
        return this._userIndexClient.confirmPhoneNumber(code);
    }
    checkUsername(username) {
        return this._userIndexClient.checkUsername(username);
    }
    setUsername(userId, username) {
        return this._userIndexClient.setUsername(userId, username);
    }
    changeRole(chatId, userId, newRole) {
        return this.getGroupClient(chatId).changeRole(userId, newRole);
    }
    deleteGroup(chatId) {
        return this.userClient.deleteGroup(chatId);
    }
    makeGroupPrivate(chatId) {
        return this.getGroupClient(chatId).makeGroupPrivate();
    }
    removeMember(chatId, userId) {
        return this.getGroupClient(chatId).removeMember(userId);
    }
    blockUserFromDirectChat(userId) {
        return this.userClient.blockUser(userId);
    }
    blockUserFromGroupChat(chatId, userId) {
        return this.getGroupClient(chatId).blockUser(userId);
    }
    unblockUserFromGroupChat(chatId, userId) {
        return this.getGroupClient(chatId).unblockUser(userId);
    }
    unblockUserFromDirectChat(userId) {
        return this.userClient.unblockUser(userId);
    }
    leaveGroup(chatId) {
        var _a;
        if (((_a = this._groupInvite) === null || _a === void 0 ? void 0 : _a.chatId) === chatId) {
            this._groupInvite = undefined;
        }
        return this.userClient.leaveGroup(chatId);
    }
    joinGroup(chatId) {
        const inviteCode = this.getProvidedInviteCode(chatId);
        return this.userClient.joinGroup(chatId, inviteCode);
    }
    markMessagesRead(request) {
        return this.userClient.markMessagesRead(request);
    }
    setUserAvatar(data) {
        return this.userClient.setAvatar(data);
    }
    addGroupChatReaction(chatId, messageId, reaction, username, threadRootMessageIndex) {
        return this.getGroupClient(chatId).addReaction(messageId, reaction, username, threadRootMessageIndex);
    }
    removeGroupChatReaction(chatId, messageId, reaction, threadRootMessageIndex) {
        return this.getGroupClient(chatId).removeReaction(messageId, reaction, threadRootMessageIndex);
    }
    addDirectChatReaction(otherUserId, messageId, reaction, username, threadRootMessageIndex) {
        return this.userClient.addReaction(otherUserId, messageId, reaction, username, threadRootMessageIndex);
    }
    removeDirectChatReaction(otherUserId, messageId, reaction, threadRootMessageIndex) {
        return this.userClient.removeReaction(otherUserId, messageId, reaction, threadRootMessageIndex);
    }
    deleteMessage(chat, messageId, threadRootMessageIndex) {
        return chat.kind === "group_chat"
            ? this.deleteGroupMessage(chat.chatId, messageId, threadRootMessageIndex)
            : this.deleteDirectMessage(chat.them, messageId, threadRootMessageIndex);
    }
    deleteGroupMessage(chatId, messageId, threadRootMessageIndex) {
        return this.getGroupClient(chatId).deleteMessage(messageId, threadRootMessageIndex);
    }
    deleteDirectMessage(otherUserId, messageId, threadRootMessageIndex) {
        return this.userClient.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }
    markAsOnline() {
        return this._onlineClient.markAsOnline();
    }
    subscriptionExists(p256dh_key) {
        return this._notificationClient.subscriptionExists(p256dh_key);
    }
    pushSubscription(subscription) {
        return this._notificationClient.pushSubscription(subscription);
    }
    removeSubscription(subscription) {
        return this._notificationClient.removeSubscription(subscription);
    }
    toggleMuteNotifications(chatId, muted) {
        return this.userClient.toggleMuteNotifications(chatId, muted);
    }
    getGroupDetails(chatId, latestEventIndex) {
        return this.getGroupClient(chatId).getGroupDetails(latestEventIndex);
    }
    async getGroupDetailsUpdates(chatId, previous) {
        return this.getGroupClient(chatId).getGroupDetailsUpdates(previous);
    }
    getPublicGroupSummary(chatId) {
        return this.getGroupClient(chatId).getPublicSummary();
    }
    getGroupRules(chatId) {
        return this.getGroupClient(chatId).getRules();
    }
    getRecommendedGroups(interrupt) {
        return this.userClient
            .getRecommendedGroups(interrupt)
            .then((groups) => groups.map((g) => this.rehydrateDataContent(g, "avatar")));
    }
    dismissRecommendation(chatId) {
        return this.userClient.dismissRecommendation(chatId);
    }
    getBio(userId) {
        const userClient = userId
            ? UserClient.create(userId, this.identity, this.db, undefined)
            : this.userClient;
        return userClient.getBio();
    }
    getPublicProfile(userId) {
        const userClient = userId
            ? UserClient.create(userId, this.identity, this.db, undefined)
            : this.userClient;
        return userClient.getPublicProfile();
    }
    setBio(bio) {
        return this.userClient.setBio(bio);
    }
    createChallenge() {
        return this._userIndexClient.createChallenge();
    }
    registerUser(username, challengeAttempt, referredBy) {
        return this._userIndexClient.registerUser(username, challengeAttempt, referredBy);
    }
    getUserStorageLimits() {
        // do we need to do something if this fails? Not sure there's much we can do
        return DataClient.create(this.identity).storageStatus().then(storageStore.set);
    }
    upgradeStorage(newLimitBytes) {
        return this._userIndexClient.upgradeStorage(newLimitBytes);
    }
    refreshAccountBalance(crypto, account) {
        return this._ledgerClients[crypto].accountBalance(account).then((val) => {
            cryptoBalance.set(crypto, val);
            return val;
        });
    }
    getGroupMessagesByMessageIndex(chatId, messageIndexes, latestClientEventIndex) {
        return this.rehydrateEventResponse("group", chatId, this.getGroupClient(chatId).getMessagesByMessageIndex(messageIndexes, latestClientEventIndex), undefined, latestClientEventIndex);
    }
    pinMessage(chatId, messageIndex) {
        return this.getGroupClient(chatId).pinMessage(messageIndex);
    }
    unpinMessage(chatId, messageIndex) {
        return this.getGroupClient(chatId).unpinMessage(messageIndex);
    }
    registerPollVote(chatId, messageIdx, answerIdx, voteType, threadRootMessageIndex) {
        return this.getGroupClient(chatId).registerPollVote(messageIdx, answerIdx, voteType, threadRootMessageIndex);
    }
    withdrawCryptocurrency(domain) {
        return this.userClient.withdrawCryptocurrency(domain);
    }
    getInviteCode(chatId) {
        return this.getGroupClient(chatId).getInviteCode();
    }
    enableInviteCode(chatId) {
        return this.getGroupClient(chatId).enableInviteCode();
    }
    disableInviteCode(chatId) {
        return this.getGroupClient(chatId).disableInviteCode();
    }
    resetInviteCode(chatId) {
        return this.getGroupClient(chatId).resetInviteCode();
    }
    pinChat(chatId) {
        return this.userClient.pinChat(chatId);
    }
    unpinChat(chatId) {
        return this.userClient.unpinChat(chatId);
    }
    archiveChat(chatId) {
        return this.userClient.archiveChat(chatId);
    }
    unarchiveChat(chatId) {
        return this.userClient.unarchiveChat(chatId);
    }
    registerProposalVote(chatId, messageIndex, adopt) {
        return this.getGroupClient(chatId).registerProposalVote(messageIndex, adopt);
    }
    initUserPrincipalMigration(newPrincipal) {
        return this.userClient.initUserPrincipalMigration(newPrincipal);
    }
    migrateUserPrincipal(userId) {
        const userClient = UserClient.create(userId, this.identity, this.db, undefined);
        return userClient.migrateUserPrincipal();
    }
    listNervousSystemFunctions(snsGovernanceCanisterId) {
        return SnsGovernanceClient.create(this.identity, snsGovernanceCanisterId)
            .listNervousSystemFunctions()
            .then((val) => {
            snsFunctions.set(snsGovernanceCanisterId, val.functions);
            return val;
        });
    }
    async threadPreviews(threadsByChat) {
        function latestMessageTimestamp(messages) {
            var _a, _b;
            return (_b = (_a = messages[messages.length - 1]) === null || _a === void 0 ? void 0 : _a.timestamp) !== null && _b !== void 0 ? _b : BigInt(0);
        }
        return Promise.all(Object.entries(threadsByChat).map(([chatId, [threadSyncs, latestClientMainEventIndex]]) => {
            const latestClientThreadUpdate = threadSyncs.reduce((curr, next) => (next.lastUpdated > curr ? next.lastUpdated : curr), BigInt(0));
            return this.getGroupClient(chatId)
                .threadPreviews(threadSyncs.map((t) => t.threadRootMessageIndex), latestClientThreadUpdate)
                .then((response) => [response, latestClientMainEventIndex]);
        })).then((responses) => Promise.all(responses.map(([r, latestClientMainEventIndex]) => {
            return r.kind === "thread_previews_success"
                ? Promise.all(r.threads.map((t) => this.rehydrateThreadPreview(t, latestClientMainEventIndex)))
                : [];
        })).then((threads) => threads
            .flat()
            .sort((a, b) => Number(latestMessageTimestamp(b.latestReplies) -
            latestMessageTimestamp(a.latestReplies)))));
    }
    async rehydrateThreadPreview(thread, latestClientMainEventIndex) {
        var _a;
        const threadMissing = await this.resolveMissingIndexes("group", thread.chatId, thread.latestReplies, thread.rootMessage.event.messageIndex, (_a = thread.rootMessage.event.thread) === null || _a === void 0 ? void 0 : _a.latestEventIndex);
        const rootMissing = await this.resolveMissingIndexes("group", thread.chatId, [thread.rootMessage], undefined, latestClientMainEventIndex);
        const replies = this.rehydrateEventList(this.rehydrateMissingReplies(thread.chatId, thread.latestReplies, threadMissing));
        const [rootMsg] = this.rehydrateEventList(this.rehydrateMissingReplies(thread.chatId, [thread.rootMessage], rootMissing));
        return Object.assign(Object.assign({}, thread), { rootMessage: Object.assign(Object.assign({}, rootMsg), { event: Object.assign(Object.assign({}, rootMsg.event), { content: this.rehydrateMessageContent(rootMsg.event.content) }) }), latestReplies: replies.map((r) => (Object.assign(Object.assign({}, r), { event: Object.assign(Object.assign({}, r.event), { content: this.rehydrateMessageContent(r.event.content) }) }))) });
    }
}
//# sourceMappingURL=serviceContainer.js.map