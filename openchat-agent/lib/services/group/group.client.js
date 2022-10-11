var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { idlFactory } from "./candid/idl";
import { CandidService } from "../candidService";
import { apiRole, addMembersResponse, getEventsResponse, changeRoleResponse, sendMessageResponse, removeMemberResponse, updateGroupResponse, addRemoveReactionResponse, deleteMessageResponse, editMessageResponse, blockUserResponse, groupDetailsResponse, groupDetailsUpdatesResponse, unblockUserResponse, getMessagesByMessageIndexResponse, pinMessageResponse, unpinMessageResponse, searchGroupChatResponse, makeGroupPrivateResponse, inviteCodeResponse, enableInviteCodeResponse, disableInviteCodeResponse, resetInviteCodeResponse, threadPreviewsResponse, registerPollVoteResponse, registerProposalVoteResponse, apiOptionalGroupPermissions, apiGroupRules, rulesResponse, } from "./mappers";
import { CachingGroupClient } from "./group.caching.client";
import { cachingLocallyDisabled } from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import { apiMessageContent, apiOptional, apiUser } from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { identity, mergeGroupChatDetails } from "../../domain/chat/chat.utils";
import { MAX_EVENTS } from "../../domain/chat/chat.utils.shared";
import { getChatEventsInLoop } from "../common/chatEvents";
import { profile } from "../common/profiling";
import { textToCode } from "../../domain/inviteCodes";
import { publicSummaryResponse } from "../common/publicSummaryMapper";
import { generateUint64 } from "../../utils/rng";
export class GroupClient extends CandidService {
    constructor(identity, chatId, inviteCode) {
        super(identity);
        this.chatId = chatId;
        this.inviteCode = inviteCode;
        this.groupService = this.createServiceClient(idlFactory, chatId);
    }
    static create(chatId, identity, db, inviteCode) {
        return db !== undefined && process.env.CLIENT_CACHING && !cachingLocallyDisabled()
            ? new CachingGroupClient(db, chatId, new GroupClient(identity, chatId, inviteCode))
            : new GroupClient(identity, chatId, inviteCode);
    }
    chatEventsByIndex(eventIndexes, threadRootMessageIndex, latestClientEventIndex) {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            invite_code: apiOptional(textToCode, this.inviteCode),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(() => this.groupService.events_by_index(args), (resp) => getEventsResponse(resp, this.chatId, threadRootMessageIndex, latestClientEventIndex), args);
    }
    async chatEventsWindow(_eventIndexRange, messageIndex, latestClientEventIndex, interrupt) {
        const thread_root_message_index = [];
        const args = {
            thread_root_message_index,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            invite_code: apiOptional(textToCode, this.inviteCode),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(() => this.groupService.events_window(args), (resp) => getEventsResponse(resp, this.chatId, undefined, latestClientEventIndex), args, interrupt);
    }
    chatEvents(eventIndexRange, startIndex, ascending, threadRootMessageIndex, latestClientEventIndex, interrupt) {
        const getChatEventsFunc = (index, asc) => {
            const args = {
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                max_events: MAX_EVENTS,
                ascending: asc,
                start_index: index,
                invite_code: apiOptional(textToCode, this.inviteCode),
                latest_client_event_index: apiOptional(identity, latestClientEventIndex),
            };
            return this.handleQueryResponse(() => this.groupService.events(args), (resp) => getEventsResponse(resp, this.chatId, threadRootMessageIndex, latestClientEventIndex), args, interrupt);
        };
        return getChatEventsInLoop(getChatEventsFunc, eventIndexRange, startIndex, ascending);
    }
    addMembers(userIds, myUsername, allowBlocked) {
        return this.handleResponse(this.groupService.add_participants({
            user_ids: userIds.map((u) => Principal.fromText(u)),
            added_by_name: myUsername,
            allow_blocked_users: allowBlocked,
            correlation_id: generateUint64()
        }), addMembersResponse);
    }
    changeRole(userId, newRole) {
        const new_role = apiRole(newRole);
        if (new_role === undefined) {
            throw new Error(`Cannot change user's role to: ${newRole}`);
        }
        return this.handleResponse(this.groupService.change_role({
            user_id: Principal.fromText(userId),
            new_role,
            correlation_id: generateUint64()
        }), changeRoleResponse);
    }
    removeMember(userId) {
        return this.handleResponse(this.groupService.remove_participant({
            user_id: Principal.fromText(userId),
            correlation_id: generateUint64()
        }), removeMemberResponse);
    }
    editMessage(message, threadRootMessageIndex) {
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.chatId])
            .then((content) => {
            return this.handleResponse(this.groupService.edit_message({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                content: apiMessageContent(content !== null && content !== void 0 ? content : message.content),
                message_id: message.messageId,
                correlation_id: generateUint64()
            }), editMessageResponse);
        });
    }
    sendMessage(senderName, mentioned, message, threadRootMessageIndex) {
        const dataClient = DataClient.create(this.identity);
        const uploadContentPromise = message.forwarded
            ? dataClient.forwardData(message.content, [this.chatId])
            : dataClient.uploadData(message.content, [this.chatId]);
        return uploadContentPromise.then((content) => {
            const newContent = content !== null && content !== void 0 ? content : message.content;
            const args = {
                content: apiMessageContent(newContent),
                message_id: message.messageId,
                sender_name: senderName,
                replies_to: apiOptional((replyContext) => ({
                    event_index: replyContext.eventIndex,
                }), message.repliesTo),
                mentioned: mentioned.map(apiUser),
                forwarding: message.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                correlation_id: generateUint64()
            };
            return this.handleResponse(this.groupService.send_message(args), sendMessageResponse).then((resp) => [resp, Object.assign(Object.assign({}, message), { content: newContent })]);
        });
    }
    updateGroup(name, description, rules, permissions, avatar) {
        return this.handleResponse(this.groupService.update_group_v2({
            name: apiOptional(identity, name),
            description: apiOptional(identity, description),
            avatar: avatar === undefined
                ? { NoChange: null }
                : {
                    SetToSome: {
                        id: DataClient.newBlobId(),
                        mime_type: "image/jpg",
                        data: avatar,
                    },
                },
            permissions: apiOptional(apiOptionalGroupPermissions, permissions),
            rules: apiOptional(apiGroupRules, rules),
            correlation_id: generateUint64()
        }), updateGroupResponse);
    }
    addReaction(messageId, reaction, username, threadRootMessageIndex) {
        return this.handleResponse(this.groupService.add_reaction({
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            message_id: messageId,
            reaction,
            username,
            correlation_id: generateUint64()
        }), addRemoveReactionResponse);
    }
    removeReaction(messageId, reaction, threadRootMessageIndex) {
        return this.handleResponse(this.groupService.remove_reaction({
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            message_id: messageId,
            reaction,
            correlation_id: generateUint64()
        }), addRemoveReactionResponse);
    }
    deleteMessage(messageId, threadRootMessageIndex) {
        return this.handleResponse(this.groupService.delete_messages({
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            message_ids: [messageId],
            correlation_id: generateUint64()
        }), deleteMessageResponse);
    }
    blockUser(userId) {
        return this.handleResponse(this.groupService.block_user({
            user_id: Principal.fromText(userId),
            correlation_id: generateUint64()
        }), blockUserResponse);
    }
    unblockUser(userId) {
        return this.handleResponse(this.groupService.unblock_user({
            user_id: Principal.fromText(userId),
            correlation_id: generateUint64()
        }), unblockUserResponse);
    }
    getGroupDetails(_latestEventIndex) {
        return this.handleQueryResponse(() => this.groupService.selected_initial({}), groupDetailsResponse);
    }
    async getGroupDetailsUpdates(previous) {
        const args = {
            updates_since: previous.latestEventIndex,
        };
        const updatesResponse = await this.handleQueryResponse(() => this.groupService.selected_updates(args), groupDetailsUpdatesResponse, args);
        if (updatesResponse === "caller_not_in_group") {
            return previous;
        }
        if (updatesResponse.kind === "success_no_updates") {
            return Object.assign(Object.assign({}, previous), { latestEventIndex: updatesResponse.latestEventIndex });
        }
        return mergeGroupChatDetails(previous, updatesResponse);
    }
    makeGroupPrivate() {
        return this.handleResponse(this.groupService.make_private({
            correlation_id: generateUint64()
        }), makeGroupPrivateResponse);
    }
    getPublicSummary() {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(() => this.groupService.public_summary(args), publicSummaryResponse, args).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the group
            return undefined;
        });
    }
    getRules() {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(() => this.groupService.rules(args), rulesResponse, args).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the rules
            return undefined;
        });
    }
    getMessagesByMessageIndex(messageIndexes, latestClientEventIndex) {
        const thread_root_message_index = [];
        const invite_code = [];
        const args = {
            thread_root_message_index,
            messages: new Uint32Array(messageIndexes),
            invite_code,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(() => this.groupService.messages_by_message_index(args), (resp) => getMessagesByMessageIndexResponse(resp, this.chatId, undefined, latestClientEventIndex), args);
    }
    pinMessage(messageIndex) {
        return this.handleResponse(this.groupService.pin_message({
            message_index: messageIndex,
            correlation_id: generateUint64()
        }), pinMessageResponse);
    }
    unpinMessage(messageIndex) {
        return this.handleResponse(this.groupService.unpin_message({
            message_index: messageIndex,
            correlation_id: generateUint64()
        }), unpinMessageResponse);
    }
    registerPollVote(messageIdx, answerIdx, voteType, threadRootMessageIndex) {
        return this.handleResponse(this.groupService.register_poll_vote({
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            poll_option: answerIdx,
            operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
            message_index: messageIdx,
            correlation_id: generateUint64()
        }), registerPollVoteResponse);
    }
    searchGroupChat(searchTerm, maxResults) {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(() => this.groupService.search_messages(args), searchGroupChatResponse, args);
    }
    getInviteCode() {
        return this.handleQueryResponse(() => this.groupService.invite_code({}), inviteCodeResponse);
    }
    enableInviteCode() {
        return this.handleResponse(this.groupService.enable_invite_code({
            correlation_id: generateUint64()
        }), enableInviteCodeResponse);
    }
    disableInviteCode() {
        return this.handleResponse(this.groupService.disable_invite_code({
            correlation_id: generateUint64()
        }), disableInviteCodeResponse);
    }
    resetInviteCode() {
        return this.handleResponse(this.groupService.reset_invite_code({
            correlation_id: generateUint64()
        }), resetInviteCodeResponse);
    }
    threadPreviews(threadRootMessageIndexes, latestClientThreadUpdate) {
        return this.handleQueryResponse(() => this.groupService.thread_previews({
            threads: new Uint32Array(threadRootMessageIndexes),
            latest_client_thread_update: apiOptional(identity, latestClientThreadUpdate),
        }), (resp) => threadPreviewsResponse(resp, this.chatId, latestClientThreadUpdate));
    }
    registerProposalVote(messageIdx, adopt) {
        return this.handleResponse(this.groupService.register_proposal_vote({
            adopt,
            message_index: messageIdx,
        }), registerProposalVoteResponse);
    }
}
__decorate([
    profile("groupClient")
], GroupClient.prototype, "chatEventsByIndex", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "chatEventsWindow", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "chatEvents", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "addMembers", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "changeRole", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "removeMember", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "editMessage", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "sendMessage", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "updateGroup", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "addReaction", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "removeReaction", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "deleteMessage", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "blockUser", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "unblockUser", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "getGroupDetails", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "getGroupDetailsUpdates", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "makeGroupPrivate", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "getPublicSummary", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "getRules", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "getMessagesByMessageIndex", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "pinMessage", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "unpinMessage", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "registerPollVote", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "searchGroupChat", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "getInviteCode", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "enableInviteCode", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "disableInviteCode", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "resetInviteCode", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "threadPreviews", null);
__decorate([
    profile("groupClient")
], GroupClient.prototype, "registerProposalVote", null);
//# sourceMappingURL=group.client.js.map