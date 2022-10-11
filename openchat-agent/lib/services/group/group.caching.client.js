var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { getCachedEvents, getCachedEventsByIndex, getCachedEventsWindow, getCachedGroupDetails, loadMessagesByMessageIndex, mergeSuccessResponses, setCachedEvents, setCachedGroupDetails, setCachedMessageFromSendResponse, } from "../../utils/caching";
import { profile } from "../common/profiling";
import { MAX_MISSING } from "../../domain/chat/chat.utils";
import { rollbar } from "../../utils/logging";
/**
 * This exists to decorate the group client so that we can provide a write through cache to
 * indexDB for holding chat events
 */
export class CachingGroupClient {
    constructor(db, chatId, client) {
        this.db = db;
        this.chatId = chatId;
        this.client = client;
    }
    setCachedEvents(resp, threadRootMessageIndex) {
        setCachedEvents(this.db, this.chatId, resp, threadRootMessageIndex).catch((err) => rollbar.error("Error writing cached group events", err));
        return resp;
    }
    handleMissingEvents([cachedEvents, missing], threadRootMessageIndex, latestClientEventIndex) {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        }
        else {
            return this.client
                .chatEventsByIndex([...missing], threadRootMessageIndex, latestClientEventIndex)
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .then((resp) => {
                if (resp !== "events_failed") {
                    return mergeSuccessResponses(cachedEvents, resp);
                }
                return resp;
            });
        }
    }
    chatEventsByIndex(eventIndexes, threadRootMessageIndex, latestClientEventIndex) {
        return getCachedEventsByIndex(this.db, eventIndexes, this.chatId, threadRootMessageIndex).then((res) => this.handleMissingEvents(res, threadRootMessageIndex, latestClientEventIndex));
    }
    async chatEventsWindow(eventIndexRange, messageIndex, latestClientEventIndex, interrupt) {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow(this.db, eventIndexRange, this.chatId, messageIndex);
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api", missing.size, totalMiss);
            return this.client
                .chatEventsWindow(eventIndexRange, messageIndex, latestClientEventIndex, interrupt)
                .then((resp) => this.setCachedEvents(resp));
        }
        else {
            return this.handleMissingEvents([cachedEvents, missing], undefined, latestClientEventIndex);
        }
    }
    async chatEvents(eventIndexRange, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex, interrupt) {
        const [cachedEvents, missing] = await getCachedEvents(this.db, eventIndexRange, this.chatId, startIndex, ascending, threadRootMessageIndex);
        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.client
                .chatEvents(eventIndexRange, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex, interrupt)
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
        }
        else {
            return this.handleMissingEvents([cachedEvents, missing], threadRootMessageIndex, latestClientEventIndex);
        }
    }
    addMembers(userIds, myUsername, allowBlocked) {
        return this.client.addMembers(userIds, myUsername, allowBlocked);
    }
    sendMessage(senderName, mentioned, message, threadRootMessageIndex) {
        return this.client
            .sendMessage(senderName, mentioned, message, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, this.chatId, threadRootMessageIndex));
    }
    editMessage(message, threadRootMessageIndex) {
        return this.client.editMessage(message, threadRootMessageIndex);
    }
    changeRole(userId, newRole) {
        return this.client.changeRole(userId, newRole);
    }
    removeMember(userId) {
        return this.client.removeMember(userId);
    }
    updateGroup(name, description, rules, permissions, avatar) {
        return this.client.updateGroup(name, description, rules, permissions, avatar);
    }
    addReaction(messageId, reaction, username, threadRootMessageIndex) {
        return this.client.addReaction(messageId, reaction, username, threadRootMessageIndex);
    }
    removeReaction(messageId, reaction, threadRootMessageIndex) {
        return this.client.removeReaction(messageId, reaction, threadRootMessageIndex);
    }
    deleteMessage(messageId, threadRootMessageIndex) {
        return this.client.deleteMessage(messageId, threadRootMessageIndex);
    }
    blockUser(userId) {
        return this.client.blockUser(userId);
    }
    unblockUser(userId) {
        return this.client.unblockUser(userId);
    }
    async getGroupDetails(latestEventIndex) {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId);
        if (fromCache !== undefined) {
            if (fromCache.latestEventIndex >= latestEventIndex) {
                return fromCache;
            }
            else {
                return this.getGroupDetailsUpdates(fromCache);
            }
        }
        const response = await this.client.getGroupDetails(latestEventIndex);
        if (response !== "caller_not_in_group") {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }
    async getGroupDetailsUpdates(previous) {
        const response = await this.client.getGroupDetailsUpdates(previous);
        if (response.latestEventIndex > previous.latestEventIndex) {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }
    makeGroupPrivate() {
        return this.client.makeGroupPrivate();
    }
    getPublicSummary() {
        return this.client.getPublicSummary();
    }
    getRules() {
        return this.client.getRules();
    }
    /**
     * This is only called to populate pinned messages which is why we don't need to care about threadRootMessageIndex
     */
    async getMessagesByMessageIndex(messageIndexes, latestClientEventIndex) {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);
            const resp = await this.client
                .getMessagesByMessageIndex(fromCache.missing, latestClientEventIndex)
                .then((resp) => this.setCachedEvents(resp));
            return resp === "events_failed"
                ? resp
                : {
                    events: [...resp.events],
                    affectedEvents: resp.affectedEvents,
                    latestEventIndex: resp.latestEventIndex,
                };
        }
        return {
            events: fromCache.messageEvents,
            affectedEvents: [],
            latestEventIndex: undefined,
        };
    }
    pinMessage(messageIndex) {
        return this.client.pinMessage(messageIndex);
    }
    unpinMessage(messageIndex) {
        return this.client.unpinMessage(messageIndex);
    }
    registerPollVote(messageIdx, answerIdx, voteType, threadRootMessageIndex) {
        return this.client.registerPollVote(messageIdx, answerIdx, voteType, threadRootMessageIndex);
    }
    searchGroupChat(searchTerm, maxResults) {
        return this.client.searchGroupChat(searchTerm, maxResults);
    }
    getInviteCode() {
        return this.client.getInviteCode();
    }
    enableInviteCode() {
        return this.client.enableInviteCode();
    }
    disableInviteCode() {
        return this.client.disableInviteCode();
    }
    resetInviteCode() {
        return this.client.resetInviteCode();
    }
    threadPreviews(threadRootMessageIndexes, latestClientThreadUpdate) {
        return this.client.threadPreviews(threadRootMessageIndexes, latestClientThreadUpdate);
    }
    registerProposalVote(messageIdx, adopt) {
        return this.client.registerProposalVote(messageIdx, adopt);
    }
}
__decorate([
    profile("groupCachingClient")
], CachingGroupClient.prototype, "chatEventsByIndex", null);
__decorate([
    profile("groupCachingClient")
], CachingGroupClient.prototype, "chatEventsWindow", null);
__decorate([
    profile("groupCachingClient")
], CachingGroupClient.prototype, "chatEvents", null);
__decorate([
    profile("groupCachingClient")
], CachingGroupClient.prototype, "getGroupDetails", null);
__decorate([
    profile("groupCachingClient")
], CachingGroupClient.prototype, "getGroupDetailsUpdates", null);
__decorate([
    profile("groupCachingClient")
], CachingGroupClient.prototype, "getMessagesByMessageIndex", null);
//# sourceMappingURL=group.caching.client.js.map