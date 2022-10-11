var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { getCachedChats, getCachedEvents, getCachedEventsByIndex, getCachedEventsWindow, mergeSuccessResponses, removeCachedChat, setCachedChats, setCachedEvents, setCachedMessageFromSendResponse, } from "../../utils/caching";
import { compareChats, getFirstUnreadMessageIndex, indexRangeForChat, MAX_MISSING, threadsReadFromChat, updateArgsFromChats, userIdsFromEvents, } from "../../domain/chat/chat.utils";
import { profile } from "../common/profiling";
import { chunk, toRecord } from "../../utils/list";
import { GroupClient } from "../../services/group/group.client";
import { get } from "svelte/store";
import { messagesRead } from "../../stores/markRead";
import { missingUserIds } from "../../domain/user/user.utils";
import { userStore } from "stores/user";
import { UserIndexClient } from "services/userIndex/userIndex.client";
import { rollbar } from "../../utils/logging";
import { configKeys } from "../../utils/config";
/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient {
    constructor(db, identity, client, groupInvite) {
        this.db = db;
        this.identity = identity;
        this.client = client;
        this.groupInvite = groupInvite;
    }
    get userId() {
        return this.client.userId;
    }
    setCachedChats(resp) {
        setCachedChats(this.db, this.userId, resp).catch((err) => rollbar.error("Error setting cached chats", err));
        return resp;
    }
    setCachedEvents(userId, resp, threadRootMessageIndex) {
        setCachedEvents(this.db, userId, resp, threadRootMessageIndex).catch((err) => rollbar.error("Error writing cached group events", err));
        return resp;
    }
    handleMissingEvents(userId, [cachedEvents, missing], threadRootMessageIndex, latestClientEventIndex) {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        }
        else {
            return this.client
                .chatEventsByIndex([...missing], userId, threadRootMessageIndex, latestClientEventIndex)
                .then((resp) => this.setCachedEvents(userId, resp, threadRootMessageIndex))
                .then((resp) => {
                if (resp !== "events_failed") {
                    return mergeSuccessResponses(cachedEvents, resp);
                }
                return resp;
            });
        }
    }
    async chatEventsByIndex(eventIndexes, userId, threadRootMessageIndex, latestClientEventIndex) {
        return getCachedEventsByIndex(this.db, eventIndexes, userId, threadRootMessageIndex).then((res) => this.handleMissingEvents(userId, res, threadRootMessageIndex, latestClientEventIndex));
    }
    async chatEventsWindow(eventIndexRange, userId, messageIndex, latestClientEventIndex, interrupt) {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow(this.db, eventIndexRange, userId, messageIndex);
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api", missing.size, totalMiss);
            return this.client
                .chatEventsWindow(eventIndexRange, userId, messageIndex, latestClientEventIndex, interrupt)
                .then((resp) => this.setCachedEvents(userId, resp));
        }
        else {
            return this.handleMissingEvents(userId, [cachedEvents, missing], undefined, latestClientEventIndex);
        }
    }
    async chatEvents(eventIndexRange, userId, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex, interrupt) {
        const [cachedEvents, missing] = await getCachedEvents(this.db, eventIndexRange, userId, startIndex, ascending, threadRootMessageIndex);
        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.client
                .chatEvents(eventIndexRange, userId, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex, interrupt)
                .then((resp) => this.setCachedEvents(userId, resp, threadRootMessageIndex));
        }
        else {
            return this.handleMissingEvents(userId, [cachedEvents, missing], threadRootMessageIndex, latestClientEventIndex);
        }
    }
    async primeCaches(cachedResponse, nextResponse, selectedChatId) {
        const cachedChats = cachedResponse === undefined
            ? {}
            : toRecord(cachedResponse.chatSummaries, (c) => c.chatId);
        const limitTo = Number(localStorage.getItem(configKeys.primeCacheLimit) || "50");
        const batchSize = Number(localStorage.getItem(configKeys.primeCacheBatchSize) || "5");
        const orderedChats = nextResponse.chatSummaries
            .filter(({ chatId, latestEventIndex }) => chatId !== selectedChatId &&
            (cachedChats[chatId] === undefined ||
                latestEventIndex > cachedChats[chatId].latestEventIndex))
            .sort(compareChats)
            .slice(0, limitTo);
        for (const batch of chunk(orderedChats, batchSize)) {
            const eventsPromises = batch.map((chat) => {
                var _a;
                // horrible having to do this but if we don't the message read tracker will not be in the right state
                messagesRead.syncWithServer(chat.chatId, chat.readByMeUpTo, threadsReadFromChat(chat));
                const targetMessageIndex = getFirstUnreadMessageIndex(chat);
                const range = indexRangeForChat(chat);
                // fire and forget an events request that will prime the cache
                if (chat.kind === "group_chat") {
                    // this is a bit gross, but I don't want this to leak outside of the caching layer
                    const inviteCode = ((_a = this.groupInvite) === null || _a === void 0 ? void 0 : _a.chatId) === chat.chatId
                        ? this.groupInvite.code
                        : undefined;
                    const groupClient = GroupClient.create(chat.chatId, this.identity, this.db, inviteCode);
                    return targetMessageIndex !== undefined
                        ? groupClient.chatEventsWindow(range, targetMessageIndex, chat.latestEventIndex, () => true)
                        : groupClient.chatEvents(range, chat.latestEventIndex, false, undefined, chat.latestEventIndex, () => true);
                }
                else {
                    return targetMessageIndex !== undefined
                        ? this.chatEventsWindow(range, chat.chatId, targetMessageIndex, chat.latestEventIndex, () => true)
                        : this.chatEvents(range, chat.chatId, chat.latestEventIndex, false, undefined, chat.latestEventIndex, () => true);
                }
            });
            if (eventsPromises.length > 0) {
                await Promise.all(eventsPromises).then((responses) => {
                    const userIds = responses.reduce((result, next) => {
                        if (next !== "events_failed") {
                            for (const userId of userIdsFromEvents(next.events)) {
                                result.add(userId);
                            }
                        }
                        return result;
                    }, new Set());
                    const missing = missingUserIds(get(userStore), userIds);
                    if (missing.length > 0) {
                        return UserIndexClient.create(this.identity).getUsers({
                            userGroups: [
                                {
                                    users: missing,
                                    updatedSince: BigInt(0),
                                },
                            ],
                        }, true, () => true);
                    }
                });
            }
        }
    }
    async getInitialState(selectedChatId) {
        const cachedChats = await getCachedChats(this.db, this.userId);
        // if we have cached chats we will rebuild the UpdateArgs from that cached data
        if (cachedChats) {
            return this.client
                .getUpdates(cachedChats, updateArgsFromChats(cachedChats.timestamp, cachedChats.chatSummaries), selectedChatId // WARNING: This was left undefined previously - is this correct now
            )
                .then((resp) => {
                resp.wasUpdated = true;
                this.primeCaches(cachedChats, resp, selectedChatId);
                return resp;
            })
                .then((resp) => this.setCachedChats(resp));
        }
        else {
            return this.client
                .getInitialState(selectedChatId)
                .then((resp) => {
                this.primeCaches(cachedChats, resp, selectedChatId);
                return resp;
            })
                .then((resp) => this.setCachedChats(resp));
        }
    }
    async getUpdates(currentState, args, selectedChatId) {
        const cachedChats = await getCachedChats(this.db, this.userId);
        return this.client
            .getUpdates(currentState, args, selectedChatId) // WARNING: This was left undefined previously - is this correct now
            .then((resp) => {
            this.primeCaches(cachedChats, resp, selectedChatId);
            return resp;
        })
            .then((resp) => this.setCachedChats(resp));
    }
    createGroup(group) {
        return this.client.createGroup(group);
    }
    deleteGroup(chatId) {
        return this.client.deleteGroup(chatId);
    }
    editMessage(recipientId, message, threadRootMessageIndex) {
        return this.client.editMessage(recipientId, message, threadRootMessageIndex);
    }
    sendGroupICPTransfer(groupId, recipientId, sender, message, threadRootMessageIndex) {
        return this.client
            .sendGroupICPTransfer(groupId, recipientId, sender, message, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, groupId, threadRootMessageIndex));
    }
    sendMessage(recipientId, sender, message, replyingToChatId, threadRootMessageIndex) {
        return this.client
            .sendMessage(recipientId, sender, message, replyingToChatId, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, this.userId, threadRootMessageIndex));
    }
    blockUser(userId) {
        return this.client.blockUser(userId);
    }
    unblockUser(userId) {
        return this.client.unblockUser(userId);
    }
    leaveGroup(chatId) {
        removeCachedChat(this.db, this.userId, chatId).catch((err) => rollbar.error("Failed to remove chat from cache", err));
        return this.client.leaveGroup(chatId);
    }
    joinGroup(chatId, inviteCode) {
        return this.client.joinGroup(chatId, inviteCode);
    }
    markMessagesRead(request) {
        return this.client.markMessagesRead(request);
    }
    setAvatar(data) {
        return this.client.setAvatar(data);
    }
    addReaction(otherUserId, messageId, reaction, username, threadRootMessageIndex) {
        return this.client.addReaction(otherUserId, messageId, reaction, username, threadRootMessageIndex);
    }
    removeReaction(otherUserId, messageId, reaction, threadRootMessageIndex) {
        return this.client.removeReaction(otherUserId, messageId, reaction, threadRootMessageIndex);
    }
    deleteMessage(otherUserId, messageId, threadRootMessageIndex) {
        return this.client.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }
    searchAllMessages(searchTerm, maxResults) {
        return this.client.searchAllMessages(searchTerm, maxResults);
    }
    searchDirectChat(userId, searchTerm, maxResults) {
        return this.client.searchDirectChat(userId, searchTerm, maxResults);
    }
    toggleMuteNotifications(chatId, muted) {
        return this.client.toggleMuteNotifications(chatId, muted);
    }
    getRecommendedGroups(interrupt) {
        return this.client.getRecommendedGroups(interrupt);
    }
    dismissRecommendation(chatId) {
        return this.client.dismissRecommendation(chatId);
    }
    getBio() {
        return this.client.getBio();
    }
    getPublicProfile() {
        return this.client.getPublicProfile();
    }
    setBio(bio) {
        return this.client.setBio(bio);
    }
    withdrawCryptocurrency(domain) {
        return this.client.withdrawCryptocurrency(domain);
    }
    pinChat(chatId) {
        return this.client.pinChat(chatId);
    }
    unpinChat(chatId) {
        return this.client.unpinChat(chatId);
    }
    archiveChat(chatId) {
        return this.client.archiveChat(chatId);
    }
    unarchiveChat(chatId) {
        return this.client.unarchiveChat(chatId);
    }
    initUserPrincipalMigration(newPrincipal) {
        return this.client.initUserPrincipalMigration(newPrincipal);
    }
    migrateUserPrincipal() {
        return this.client.migrateUserPrincipal();
    }
}
__decorate([
    profile("userCachingClient")
], CachingUserClient.prototype, "chatEventsByIndex", null);
__decorate([
    profile("userCachingClient")
], CachingUserClient.prototype, "chatEventsWindow", null);
__decorate([
    profile("userCachingClient")
], CachingUserClient.prototype, "chatEvents", null);
__decorate([
    profile("userCachingClient")
], CachingUserClient.prototype, "getInitialState", null);
__decorate([
    profile("userCachingClient")
], CachingUserClient.prototype, "getUpdates", null);
__decorate([
    profile("userCachingClient")
], CachingUserClient.prototype, "sendGroupICPTransfer", null);
__decorate([
    profile("userCachingClient")
], CachingUserClient.prototype, "sendMessage", null);
//# sourceMappingURL=user.caching.client.js.map