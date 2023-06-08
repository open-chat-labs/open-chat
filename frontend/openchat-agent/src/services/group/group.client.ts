import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupService } from "./candid/idl";
import type {
    EventsResponse,
    GroupChatEvent,
    Message,
    SendMessageResponse,
    RemoveMemberResponse,
    UpdateGroupResponse,
    AddRemoveReactionResponse,
    IndexRange,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    ChangeRoleResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    GroupChatSummary,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
    MakeGroupPrivateResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadPreviewsResponse,
    RegisterProposalVoteResponse,
    AccessRules,
    SearchGroupChatResponse,
    User,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    DeletedGroupMessageResponse,
    EventWrapper,
    OptionUpdate,
    ClaimPrizeResponse,
    AccessGate,
    DeclineInvitationResponse,
    EventsSuccessResult,
    ChatEvent,
} from "openchat-shared";
import { textToCode } from "openchat-shared";
import { CandidService } from "../candidService";
import {
    apiRole,
    getEventsResponse,
    changeRoleResponse,
    sendMessageResponse,
    removeMemberResponse,
    updateGroupResponse,
    addRemoveReactionResponse,
    deleteMessageResponse,
    undeleteMessageResponse,
    editMessageResponse,
    blockUserResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    unblockUserResponse,
    getMessagesByMessageIndexResponse,
    pinMessageResponse,
    unpinMessageResponse,
    searchGroupChatResponse,
    makeGroupPrivateResponse,
    inviteCodeResponse,
    enableInviteCodeResponse,
    disableInviteCodeResponse,
    resetInviteCodeResponse,
    threadPreviewsResponse,
    registerPollVoteResponse,
    registerProposalVoteResponse,
    apiOptionalGroupPermissions,
    apiGroupRules,
    rulesResponse,
    summaryResponse,
    summaryUpdatesResponse,
    deletedMessageResponse,
    claimPrizeResponse,
    declineInvitationResponse,
} from "./mappers";
import {
    Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedGroupDetails,
} from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import { apiGroupGate, apiMessageContent, apiOptional, apiUser } from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { identity, mergeGroupChatDetails } from "../../utils/chat";
import { MAX_EVENTS, MAX_MESSAGES, MAX_MISSING } from "../../constants";
import { publicSummaryResponse } from "../common/publicSummaryMapper";
import { apiOptionUpdate } from "../../utils/mapping";
import { generateUint64 } from "../../utils/rng";
import type { AgentConfig } from "../../config";
import { setCachedMessageFromSendResponse } from "../../utils/caching";

export class GroupClient extends CandidService {
    private groupService: GroupService;

    constructor(
        identity: Identity,
        private config: AgentConfig,
        private chatId: string,
        private db: Database,
        private inviteCode: string | undefined
    ) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, chatId, config);
    }

    static create(
        chatId: string,
        identity: Identity,
        config: AgentConfig,
        db: Database,
        inviteCode: string | undefined
    ): GroupClient {
        return new GroupClient(identity, config, chatId, db, inviteCode);
    }

    summary(): Promise<GroupCanisterSummaryResponse> {
        return this.handleQueryResponse(() => this.groupService.summary({}), summaryResponse, {});
    }

    summaryUpdates(updatesSince: bigint): Promise<GroupCanisterSummaryUpdatesResponse> {
        const args = { updates_since: updatesSince };

        return this.handleQueryResponse(
            () => this.groupService.summary_updates(args),
            summaryUpdatesResponse,
            args
        );
    }

    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return getCachedEventsByIndex<GroupChatEvent>(
            this.db,
            eventIndexes,
            this.chatId,
            threadRootMessageIndex
        ).then((res) =>
            this.handleMissingEvents(res, threadRootMessageIndex, latestClientEventIndex)
        );
    }

    private setCachedEvents<T extends ChatEvent>(
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number
    ): EventsResponse<T> {
        setCachedEvents(this.db, this.chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err)
        );
        return resp;
    }

    private handleMissingEvents(
        [cachedEvents, missing]: [EventsSuccessResult<GroupChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                [...missing],
                threadRootMessageIndex,
                latestClientEventIndex
            )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .then((resp) => {
                    if (resp !== "events_failed") {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    chatEventsByIndexFromBackend(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.events_by_index(args),
            (resp) =>
                getEventsResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                ),
            args
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            messageIndex,
            threadRootMessageIndex
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss
            );
            return this.chatEventsWindowFromBackend(
                eventIndexRange,
                messageIndex,
                threadRootMessageIndex,
                latestClientEventIndex
            ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                undefined,
                latestClientEventIndex
            );
        }
    }

    private async chatEventsWindowFromBackend(
        _eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.events_window(args),
            (resp) =>
                getEventsResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                ),
            args
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            startIndex,
            ascending,
            threadRootMessageIndex
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.chatEventsFromBackend(
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex
            ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestClientEventIndex
            );
        }
    }

    private chatEventsFromBackend(
        _eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            ascending,
            start_index: startIndex,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.events(args),
            (resp) =>
                getEventsResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                ),
            args
        );
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        const new_role = apiRole(newRole);
        if (new_role === undefined) {
            throw new Error(`Cannot change user's role to: ${newRole}`);
        }
        return this.handleResponse(
            this.groupService.change_role({
                user_id: Principal.fromText(userId),
                new_role,
                correlation_id: generateUint64(),
            }),
            changeRoleResponse
        );
    }

    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            removeMemberResponse
        );
    }

    editMessage(message: Message, threadRootMessageIndex?: number): Promise<EditMessageResponse> {
        return DataClient.create(this.identity, this.config)
            .uploadData(message.content, [this.chatId])
            .then((content) => {
                return this.handleResponse(
                    this.groupService.edit_message_v2({
                        thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                        content: apiMessageContent(content ?? message.content),
                        message_id: message.messageId,
                        correlation_id: generateUint64(),
                    }),
                    editMessageResponse
                );
            });
    }

    claimPrize(messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.handleResponse(
            this.groupService.claim_prize({
                correlation_id: generateUint64(),
                message_id: messageId,
            }),
            claimPrizeResponse
        );
    }

    sendMessage(
        senderName: string,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = DataClient.create(this.identity, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.chatId])
            : dataClient.uploadData(event.event.content, [this.chatId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const args = {
                content: apiMessageContent(newContent),
                message_id: event.event.messageId,
                sender_name: senderName,
                replies_to: apiOptional(
                    (replyContext) => ({
                        event_index: replyContext.eventIndex,
                    }),
                    event.event.repliesTo
                ),
                mentioned: mentioned.map(apiUser),
                forwarding: event.event.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                correlation_id: generateUint64(),
            };
            return this.handleResponse(this.groupService.send_message_v2(args), sendMessageResponse)
                .then((resp) => {
                    const retVal: [SendMessageResponse, Message] = [
                        resp,
                        { ...event.event, content: newContent },
                    ];
                    setCachedMessageFromSendResponse(
                        this.db,
                        this.chatId,
                        event,
                        threadRootMessageIndex
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, this.chatId, event, threadRootMessageIndex);
                    throw err;
                });
        });
    }

    updateGroup(
        name?: string,
        description?: string,
        rules?: AccessRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>,
        gate?: AccessGate
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.groupService.update_group_v2({
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                avatar:
                    avatar === undefined
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
                events_ttl: apiOptionUpdate(identity, eventsTimeToLiveMs),
                correlation_id: generateUint64(),
                gate:
                    gate === undefined
                        ? { NoChange: null }
                        : gate.kind === "no_gate"
                        ? { SetToNone: null }
                        : { SetToSome: apiGroupGate(gate) },
            }),
            updateGroupResponse
        );
    }

    addReaction(
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.add_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                username,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse
        );
    }

    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.remove_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse
        );
    }

    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.delete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
                as_platform_moderator: apiOptional(identity, asPlatformModerator),
            }),
            deleteMessageResponse
        );
    }

    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.undelete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            undeleteMessageResponse
        );
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.groupService.block_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            blockUserResponse
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.groupService.unblock_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            unblockUserResponse
        );
    }

    async getGroupDetails(latestEventIndex: number): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId);
        if (fromCache !== undefined) {
            if (fromCache.latestEventIndex >= latestEventIndex) {
                return fromCache;
            } else {
                return this.getGroupDetailsUpdates(fromCache);
            }
        }

        const response = await this.getGroupDetailsFromBackend(latestEventIndex);
        if (response !== "caller_not_in_group") {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    private getGroupDetailsFromBackend(
        _latestEventIndex: number
    ): Promise<GroupChatDetailsResponse> {
        return this.handleQueryResponse(
            () => this.groupService.selected_initial({}),
            groupDetailsResponse
        );
    }

    async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.getGroupDetailsUpdatesFromBackend(previous);
        if (response.latestEventIndex > previous.latestEventIndex) {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    private async getGroupDetailsUpdatesFromBackend(
        previous: GroupChatDetails
    ): Promise<GroupChatDetails> {
        const args = {
            updates_since: previous.latestEventIndex,
        };
        const updatesResponse = await this.handleQueryResponse(
            () => this.groupService.selected_updates(args),
            groupDetailsUpdatesResponse,
            args
        );

        if (updatesResponse === "caller_not_in_group") {
            return previous;
        }

        if (updatesResponse.kind === "success_no_updates") {
            return {
                ...previous,
                latestEventIndex: updatesResponse.latestEventIndex,
            };
        }

        return mergeGroupChatDetails(previous, updatesResponse);
    }

    makeGroupPrivate(): Promise<MakeGroupPrivateResponse> {
        return this.handleResponse(
            this.groupService.make_private({
                correlation_id: generateUint64(),
            }),
            makeGroupPrivateResponse
        );
    }

    getPublicSummary(): Promise<GroupChatSummary | undefined> {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(
            () => this.groupService.public_summary(args),
            publicSummaryResponse,
            args
        ).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the group
            return undefined;
        });
    }

    getRules(): Promise<AccessRules | undefined> {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(
            () => this.groupService.rules(args),
            rulesResponse,
            args
        ).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the rules
            return undefined;
        });
    }

    async getMessagesByMessageIndex(
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.getMessagesByMessageIndexFromBackend(
                fromCache.missing,
                latestClientEventIndex
            ).then((resp) => this.setCachedEvents(resp));

            return resp === "events_failed"
                ? resp
                : {
                      events: [...fromCache.messageEvents, ...resp.events],
                      latestEventIndex: resp.latestEventIndex,
                  };
        }
        return {
            events: fromCache.messageEvents,
            latestEventIndex: undefined,
        };
    }

    private getMessagesByMessageIndexFromBackend(
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        const thread_root_message_index: [] = [];
        const invite_code: [] = [];
        const args = {
            thread_root_message_index,
            messages: new Uint32Array(messageIndexes),
            invite_code,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.messages_by_message_index(args),
            (resp) =>
                getMessagesByMessageIndexResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    undefined,
                    latestClientEventIndex
                ),
            args
        );
    }

    getDeletedMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeletedGroupMessageResponse> {
        return this.handleResponse(
            this.groupService.deleted_message({
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            deletedMessageResponse
        );
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.groupService.pin_message_v2({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            pinMessageResponse
        );
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.groupService.unpin_message({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            unpinMessageResponse
        );
    }

    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.groupService.register_poll_vote({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
                correlation_id: generateUint64(),
            }),
            registerPollVoteResponse
        );
    }

    searchGroupChat(
        searchTerm: string,
        userIds: string[],
        maxResults: number
    ): Promise<SearchGroupChatResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
            users: apiOptional(
                identity,
                userIds.map((u) => Principal.fromText(u))
            ),
        };
        return this.handleQueryResponse(
            () => this.groupService.search_messages(args),
            (res) => searchGroupChatResponse(res, this.chatId),
            args
        );
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.invite_code({}),
            inviteCodeResponse
        );
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.enable_invite_code({
                correlation_id: generateUint64(),
            }),
            enableInviteCodeResponse
        );
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.disable_invite_code({
                correlation_id: generateUint64(),
            }),
            disableInviteCodeResponse
        );
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.reset_invite_code({
                correlation_id: generateUint64(),
            }),
            resetInviteCodeResponse
        );
    }

    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined
    ): Promise<ThreadPreviewsResponse> {
        return this.handleQueryResponse(
            () =>
                this.groupService.thread_previews({
                    threads: new Uint32Array(threadRootMessageIndexes),
                    latest_client_thread_update: apiOptional(identity, latestClientThreadUpdate),
                }),
            (resp) => threadPreviewsResponse(resp, this.chatId, latestClientThreadUpdate)
        );
    }

    registerProposalVote(
        messageIdx: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.groupService.register_proposal_vote({
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse
        );
    }

    registerProposalVoteV2(
        messageIdx: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.groupService.register_proposal_vote_v2({
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse
        );
    }

    localUserIndex(): Promise<string> {
        return this.handleQueryResponse(
            () => this.groupService.local_user_index({}),
            (resp) => resp.Success.toString()
        );
    }

    declineInvitation(): Promise<DeclineInvitationResponse> {
        return this.handleResponse(
            this.groupService.decline_invitation({}),
            declineInvitationResponse
        );
    }

    toggleMuteNotifications(mute: boolean): Promise<undefined> {
        return this.handleResponse(
            this.groupService.toggle_mute_notifications({ mute }),
            (_) => undefined
        );
    }
}
