var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Principal } from "@dfinity/principal";
import { idlFactory, } from "./candid/idl";
import { CandidService } from "../candidService";
import { blockResponse, createGroupResponse, deleteGroupResponse, deleteMessageResponse, editMessageResponse, getEventsResponse, getUpdatesResponse, initialStateResponse, joinGroupResponse, leaveGroupResponse, markReadResponse, recommendedGroupsResponse, searchDirectChatResponse, searchAllMessagesResponse, sendMessageResponse, setAvatarResponse, setBioResponse, addRemoveReactionResponse, unblockResponse, withdrawCryptoResponse, transferWithinGroupResponse, publicProfileResponse, pinChatResponse, unpinChatResponse, migrateUserPrincipal, archiveChatResponse, } from "./mappers";
import { compareChats, mergeChatUpdates } from "../../domain/chat/chat.utils";
import { MAX_EVENTS } from "../../domain/chat/chat.utils.shared";
import { cachingLocallyDisabled } from "../../utils/caching";
import { CachingUserClient } from "./user.caching.client";
import { apiGroupPermissions, apiMessageContent, apiOptional, apiPendingCryptoContent, apiPendingCryptocurrencyWithdrawal, apiReplyContextArgs, } from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { muteNotificationsResponse } from "../notifications/mappers";
import { identity, toVoid } from "../../utils/mapping";
import { getChatEventsInLoop } from "../common/chatEvents";
import { profile } from "../common/profiling";
import { textToCode } from "../../domain/inviteCodes";
import { apiGroupRules } from "../group/mappers";
import { generateUint64 } from "../../utils/rng";
export class UserClient extends CandidService {
    constructor(identity, userId) {
        super(identity);
        this.userId = userId;
        this.userService = this.createServiceClient(idlFactory, userId);
    }
    static create(userId, identity, db, groupInvite) {
        return db && process.env.CLIENT_CACHING && !cachingLocallyDisabled()
            ? new CachingUserClient(db, identity, new UserClient(identity, userId), groupInvite)
            : new UserClient(identity, userId);
    }
    createGroup(group) {
        var _a;
        return this.handleResponse(this.userService.create_group({
            is_public: group.isPublic,
            name: group.name,
            description: group.description,
            history_visible_to_new_joiners: group.historyVisible,
            avatar: apiOptional((data) => {
                return {
                    id: DataClient.newBlobId(),
                    data,
                    mime_type: "image/jpg",
                };
            }, (_a = group.avatar) === null || _a === void 0 ? void 0 : _a.blobData),
            permissions: [apiGroupPermissions(group.permissions)],
            rules: apiGroupRules(group.rules),
        }), createGroupResponse);
    }
    deleteGroup(chatId) {
        return this.handleResponse(this.userService.delete_group({
            chat_id: Principal.fromText(chatId),
        }), deleteGroupResponse);
    }
    chatEventsByIndex(eventIndexes, userId, threadRootMessageIndex, latestClientEventIndex) {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            user_id: Principal.fromText(userId),
            events: new Uint32Array(eventIndexes),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(() => this.userService.events_by_index(args), (resp) => getEventsResponse(resp, userId, latestClientEventIndex), args);
    }
    async chatEventsWindow(_eventIndexRange, userId, messageIndex, latestClientEventIndex, interrupt) {
        const thread_root_message_index = [];
        const args = {
            thread_root_message_index,
            user_id: Principal.fromText(userId),
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(() => this.userService.events_window(args), (resp) => getEventsResponse(resp, userId, latestClientEventIndex), args, interrupt);
    }
    chatEvents(eventIndexRange, userId, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex) {
        const getChatEventsFunc = (index, asc) => {
            const args = {
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                user_id: Principal.fromText(userId),
                max_events: MAX_EVENTS,
                start_index: index,
                ascending: asc,
                latest_client_event_index: apiOptional(identity, latestClientEventIndex),
            };
            return this.handleQueryResponse(() => this.userService.events(args), (resp) => getEventsResponse(resp, userId, latestClientEventIndex), args);
        };
        return getChatEventsInLoop(getChatEventsFunc, eventIndexRange, startIndex, ascending);
    }
    async getInitialState(_selectedChatId) {
        const disableCache = localStorage.getItem("openchat_disable_initial_state_cache") === "true";
        const resp = await this.handleQueryResponse(() => this.userService.initial_state({ disable_cache: [disableCache] }), initialStateResponse);
        return {
            wasUpdated: true,
            chatSummaries: resp.chats.sort(compareChats),
            timestamp: resp.timestamp,
            blockedUsers: resp.blockedUsers,
            pinnedChats: resp.pinnedChats,
            avatarIdUpdate: undefined,
            affectedEvents: {},
        };
    }
    async getUpdates(currentState, args, _selectedChatId) {
        var _a, _b;
        const updatesResponse = await this.handleQueryResponse(() => this.userService.updates({
            updates_since: {
                timestamp: args.updatesSince.timestamp,
                group_chats: args.updatesSince.groupChats.map((g) => ({
                    chat_id: Principal.fromText(g.chatId),
                    updates_since: g.lastUpdated,
                })),
            },
        }), getUpdatesResponse, args);
        const anyUpdates = updatesResponse.blockedUsers !== undefined ||
            updatesResponse.pinnedChats !== undefined ||
            updatesResponse.chatsUpdated.length > 0 ||
            updatesResponse.chatsAdded.length > 0 ||
            updatesResponse.chatsRemoved.size > 0 ||
            updatesResponse.avatarIdUpdate !== undefined ||
            updatesResponse.cyclesBalance !== undefined ||
            updatesResponse.transactions.length > 0;
        return {
            wasUpdated: anyUpdates,
            chatSummaries: anyUpdates
                ? mergeChatUpdates(currentState.chatSummaries, updatesResponse)
                : currentState.chatSummaries,
            timestamp: updatesResponse.timestamp,
            blockedUsers: (_a = updatesResponse.blockedUsers) !== null && _a !== void 0 ? _a : currentState.blockedUsers,
            pinnedChats: (_b = updatesResponse.pinnedChats) !== null && _b !== void 0 ? _b : currentState.pinnedChats,
            avatarIdUpdate: updatesResponse.avatarIdUpdate,
            affectedEvents: updatesResponse.chatsUpdated.reduce((result, chatSummary) => {
                if (chatSummary.affectedEvents.length > 0) {
                    result[chatSummary.chatId] = chatSummary.affectedEvents;
                }
                return result;
            }, {}),
        };
    }
    setAvatar(bytes) {
        const blobId = DataClient.newBlobId();
        return this.handleResponse(this.userService.set_avatar({
            avatar: apiOptional(identity, {
                id: blobId,
                data: bytes,
                mime_type: "image/jpg",
            }),
        }), setAvatarResponse).then((resp) => {
            if (resp === "success") {
                return {
                    blobId,
                    canisterId: this.userId,
                };
            }
            throw new Error("Unable to set avatar");
        });
    }
    editMessage(recipientId, message, threadRootMessageIndex) {
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.userId, recipientId])
            .then((content) => {
            const req = {
                content: apiMessageContent(content !== null && content !== void 0 ? content : message.content),
                user_id: Principal.fromText(recipientId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: message.messageId,
                correlation_id: generateUint64(),
            };
            return this.handleResponse(this.userService.edit_message(req), editMessageResponse);
        });
    }
    sendMessage(recipientId, sender, message, replyingToChatId, threadRootMessageIndex) {
        const dataClient = DataClient.create(this.identity);
        const uploadContentPromise = message.forwarded
            ? dataClient.forwardData(message.content, [this.userId, recipientId])
            : dataClient.uploadData(message.content, [this.userId, recipientId]);
        return uploadContentPromise.then((content) => {
            const newContent = content !== null && content !== void 0 ? content : message.content;
            const req = {
                content: apiMessageContent(newContent),
                recipient: Principal.fromText(recipientId),
                sender_name: sender.username,
                message_id: message.messageId,
                replies_to: apiOptional((replyContext) => apiReplyContextArgs(replyContext, replyingToChatId), message.repliesTo),
                forwarding: message.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                correlation_id: generateUint64(),
            };
            return this.handleResponse(this.userService.send_message(req), (resp) => sendMessageResponse(resp, message.sender, recipientId)).then((resp) => [resp, Object.assign(Object.assign({}, message), { content: newContent })]);
        });
    }
    sendGroupICPTransfer(groupId, recipientId, sender, message, threadRootMessageIndex) {
        const content = apiPendingCryptoContent(message.content);
        const req = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            content,
            recipient: content.recipient,
            sender_name: sender.username,
            mentioned: [],
            message_id: message.messageId,
            group_id: Principal.fromText(groupId),
            replies_to: apiOptional((replyContext) => apiReplyContextArgs(replyContext), message.repliesTo),
            correlation_id: generateUint64(),
        };
        return this.handleResponse(this.userService.transfer_crypto_within_group_v2(req), (resp) => transferWithinGroupResponse(resp, message.sender, recipientId)).then((resp) => [resp, message]);
    }
    blockUser(userId) {
        return this.handleResponse(this.userService.block_user({
            user_id: Principal.fromText(userId),
        }), blockResponse);
    }
    unblockUser(userId) {
        return this.handleResponse(this.userService.unblock_user({
            user_id: Principal.fromText(userId),
        }), unblockResponse);
    }
    leaveGroup(chatId) {
        return this.handleResponse(this.userService.leave_group({
            chat_id: Principal.fromText(chatId),
            correlation_id: generateUint64(),
        }), leaveGroupResponse);
    }
    joinGroup(chatId, inviteCode) {
        return this.handleResponse(this.userService.join_group_v2({
            as_super_admin: false,
            chat_id: Principal.fromText(chatId),
            invite_code: apiOptional(textToCode, inviteCode),
            correlation_id: generateUint64(),
        }), joinGroupResponse);
    }
    markMessagesRead(request) {
        return this.handleResponse(this.userService.mark_read_v2({
            messages_read: request.map(({ chatId, readUpTo, threads }) => ({
                chat_id: Principal.fromText(chatId),
                read_up_to: apiOptional(identity, readUpTo),
                threads: threads.map((t) => ({
                    root_message_index: t.threadRootMessageIndex,
                    read_up_to: t.readUpTo,
                })),
            })),
        }), markReadResponse);
    }
    addReaction(otherUserId, messageId, reaction, username, threadRootMessageIndex) {
        return this.handleResponse(this.userService.add_reaction({
            user_id: Principal.fromText(otherUserId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            message_id: messageId,
            reaction,
            username,
            correlation_id: generateUint64(),
        }), addRemoveReactionResponse);
    }
    removeReaction(otherUserId, messageId, reaction, threadRootMessageIndex) {
        return this.handleResponse(this.userService.remove_reaction({
            user_id: Principal.fromText(otherUserId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            message_id: messageId,
            reaction,
            correlation_id: generateUint64(),
        }), addRemoveReactionResponse);
    }
    deleteMessage(otherUserId, messageId, threadRootMessageIndex) {
        return this.handleResponse(this.userService.delete_messages({
            user_id: Principal.fromText(otherUserId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            message_ids: [messageId],
            correlation_id: generateUint64(),
        }), deleteMessageResponse);
    }
    searchAllMessages(searchTerm, maxResults = 10) {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(() => this.userService.search_all_messages(args), searchAllMessagesResponse, args);
    }
    searchDirectChat(userId, searchTerm, maxResults) {
        const args = {
            user_id: Principal.fromText(userId),
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(() => this.userService.search_messages(args), searchDirectChatResponse, args);
    }
    toggleMuteNotifications(chatId, muted) {
        if (muted) {
            return this.handleResponse(this.userService.mute_notifications({
                chat_id: Principal.fromText(chatId),
            }), muteNotificationsResponse);
        }
        else {
            return this.handleResponse(this.userService.unmute_notifications({
                chat_id: Principal.fromText(chatId),
            }), muteNotificationsResponse);
        }
    }
    getRecommendedGroups(interrupt) {
        const args = {
            count: 20,
        };
        return this.handleQueryResponse(() => this.userService.recommended_groups(args), recommendedGroupsResponse, args, interrupt);
    }
    dismissRecommendation(chatId) {
        return this.handleResponse(this.userService.add_recommended_group_exclusions({
            duration: [],
            groups: [Principal.fromText(chatId)],
        }), toVoid);
    }
    getBio() {
        return this.handleQueryResponse(() => this.userService.bio({}), (candid) => candid.Success);
    }
    getPublicProfile() {
        return this.handleQueryResponse(() => this.userService.public_profile({}), publicProfileResponse);
    }
    setBio(bio) {
        return this.handleResponse(this.userService.set_bio({ text: bio }), setBioResponse);
    }
    withdrawCryptocurrency(domain) {
        const req = {
            withdrawal: {
                NNS: apiPendingCryptocurrencyWithdrawal(domain),
            },
        };
        return this.handleResponse(this.userService.withdraw_crypto_v2(req), withdrawCryptoResponse);
    }
    pinChat(chatId) {
        return this.handleResponse(this.userService.pin_chat({
            chat_id: Principal.fromText(chatId),
        }), pinChatResponse);
    }
    unpinChat(chatId) {
        return this.handleResponse(this.userService.unpin_chat({
            chat_id: Principal.fromText(chatId),
        }), unpinChatResponse);
    }
    archiveChat(chatId) {
        return this.handleResponse(this.userService.archive_chat({
            chat_id: Principal.fromText(chatId),
        }), archiveChatResponse);
    }
    unarchiveChat(chatId) {
        return this.handleResponse(this.userService.unarchive_chat({
            chat_id: Principal.fromText(chatId),
        }), archiveChatResponse);
    }
    initUserPrincipalMigration(newPrincipal) {
        return this.handleResponse(this.userService.init_user_principal_migration({
            new_principal: Principal.fromText(newPrincipal),
        }), toVoid);
    }
    migrateUserPrincipal() {
        return this.handleResponse(this.userService.migrate_user_principal({}), migrateUserPrincipal);
    }
}
__decorate([
    profile("userClient")
], UserClient.prototype, "createGroup", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "deleteGroup", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "chatEventsByIndex", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "chatEventsWindow", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "chatEvents", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "getInitialState", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "getUpdates", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "setAvatar", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "editMessage", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "sendMessage", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "sendGroupICPTransfer", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "blockUser", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "unblockUser", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "leaveGroup", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "joinGroup", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "markMessagesRead", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "addReaction", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "removeReaction", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "deleteMessage", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "searchAllMessages", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "searchDirectChat", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "toggleMuteNotifications", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "getRecommendedGroups", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "dismissRecommendation", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "getBio", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "getPublicProfile", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "setBio", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "withdrawCryptocurrency", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "pinChat", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "unpinChat", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "archiveChat", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "unarchiveChat", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "initUserPrincipalMigration", null);
__decorate([
    profile("userClient")
], UserClient.prototype, "migrateUserPrincipal", null);
//# sourceMappingURL=user.client.js.map