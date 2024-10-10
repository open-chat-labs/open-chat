import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type GroupService } from "./candid/idl";
import type {
    EventsResponse,
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
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadPreviewsResponse,
    RegisterProposalVoteResponse,
    Rules,
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
    GroupChatIdentifier,
    ConvertToCommunityResponse,
    PublicGroupSummaryResponse,
    UpdatedRules,
    FollowThreadResponse,
    OptionalChatPermissions,
    ToggleMuteNotificationResponse,
    AcceptP2PSwapResponse,
    JoinVideoCallResponse,
    SetVideoCallPresenceResponse,
    VideoCallPresence,
    VideoCallParticipantsResponse,
} from "openchat-shared";
import {
    DestinationInvalidError,
    offline,
    textToCode,
    MAX_EVENTS,
    MAX_MESSAGES,
    MAX_MISSING,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    apiRole,
    getEventsResponse,
    removeMemberResponse,
    blockUserResponse,
    unblockUserResponse,
    getMessagesByMessageIndexResponse,
    apiOptionalGroupPermissions,
    summaryResponse,
    summaryUpdatesResponse,
    convertToCommunityReponse,
    apiUpdatedRules,
    followThreadResponse,
    reportMessageResponse,
} from "./mappers";
import { sendMessageResponse } from "./mappersV2";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedGroupDetails,
} from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import {
    addRemoveReactionResponse,
    apiAccessGate,
    inviteCodeResponse,
    searchGroupChatResponse,
    declineInvitationResponse,
    threadPreviewsResponse,
    apiMessageContent,
    changeRoleResponse,
    undeleteMessageResponse,
    editMessageResponse,
    deleteMessageResponse,
    apiOptional,
    deletedMessageResponse,
    updateGroupResponse,
    registerPollVoteResponse,
    enableInviteCodeResponse,
    disableInviteCodeResponse,
    resetInviteCodeResponse,
    pinMessageResponse,
    unpinMessageResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    registerProposalVoteResponse,
    claimPrizeResponse,
    acceptP2PSwapResponse,
    cancelP2PSwapResponse,
    joinVideoCallResponse,
    apiVideoCallPresence,
    setVideoCallPresence,
    videoCallParticipantsResponse,
    apiAccessGateConfig,
} from "../common/chatMappers";
import {
    apiMessageContent as apiMessageContentV2,
    apiUser as apiUserV2,
} from "../common/chatMappersV2";
import { DataClient } from "../data/data.client";
import { mergeGroupChatDetails } from "../../utils/chat";
import { publicSummaryResponse } from "../common/publicSummaryMapper";
import { apiOptionUpdate, identity, mapOptional } from "../../utils/mapping";
import { generateUint64 } from "../../utils/rng";
import type { AgentConfig } from "../../config";
import { setCachedMessageFromSendResponse } from "../../utils/caching";
import { muteNotificationsResponse } from "../notifications/mappers";
import type { CancelP2PSwapResponse } from "openchat-shared";
import type { EditMessageV2Args } from "./candid/types";
import { ResponseTooLargeError } from "openchat-shared";
import {
    chunkedChatEventsFromBackend,
    chunkedChatEventsWindowFromBackend,
} from "../common/chunked";
import { GroupSendMessageArgs, GroupSendMessageResponse } from "../../typebox";

export class GroupClient extends CandidService {
    private groupService: GroupService;

    constructor(
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private chatId: GroupChatIdentifier,
        private db: Database,
        private inviteCode: string | undefined,
    ) {
        super(identity, agent, chatId.groupId);
        this.groupService = this.createServiceClient<GroupService>(idlFactory);
    }

    summary(): Promise<GroupCanisterSummaryResponse> {
        return this.handleQueryResponse(
            () => this.groupService.summary({}),
            summaryResponse,
            {},
        ).catch((err) => {
            if (err instanceof DestinationInvalidError) {
                return { kind: "canister_not_found" };
            } else {
                throw err;
            }
        });
    }

    summaryUpdates(updatesSince: bigint): Promise<GroupCanisterSummaryUpdatesResponse> {
        const args = { updates_since: updatesSince };

        return this.handleQueryResponse(
            () => this.groupService.summary_updates(args),
            summaryUpdatesResponse,
            args,
        );
    }

    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return getCachedEventsByIndex(this.db, eventIndexes, {
            chatId: this.chatId,
            threadRootMessageIndex,
        }).then((res) => this.handleMissingEvents(res, threadRootMessageIndex, latestKnownUpdate));
    }

    private setCachedEvents<T extends ChatEvent>(
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number,
    ): EventsResponse<T> {
        setCachedEvents(this.db, this.chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err),
        );
        return resp;
    }

    private handleMissingEvents(
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                [...missing],
                threadRootMessageIndex,
                latestKnownUpdate,
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
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.events_by_index(args),
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            args,
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindowByMessageIndex(
            this.db,
            eventIndexRange,
            { chatId: this.chatId, threadRootMessageIndex },
            messageIndex,
            maxEvents,
        );

        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss,
            );
            return this.chatEventsWindowFromBackend(
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
                maxEvents,
            )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the window request into a a few chunks",
                        );
                        return chunkedChatEventsWindowFromBackend(
                            (index: number, ascending: boolean, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            (index: number, chunkSize: number) =>
                                this.chatEventsWindowFromBackend(
                                    index,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            messageIndex,
                        ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private async chatEventsWindowFromBackend(
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.events_window(args),
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            args,
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents(
            this.db,
            eventIndexRange,
            { chatId: this.chatId, threadRootMessageIndex },
            startIndex,
            ascending,
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api", missing.size);
            return this.chatEventsFromBackend(
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the payload into a a few chunks",
                        );
                        return chunkedChatEventsFromBackend(
                            (index: number, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            startIndex,
                            ascending,
                        ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private chatEventsFromBackend(
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            ascending,
            start_index: startIndex,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.events(args),
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            args,
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
            changeRoleResponse,
        );
    }

    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            removeMemberResponse,
        );
    }

    editMessage(
        message: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        return new DataClient(this.identity, this.agent, this.config)
            .uploadData(message.content, [this.chatId.groupId])
            .then((content) => {
                const args: EditMessageV2Args = {
                    thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                    content: apiMessageContent(content ?? message.content),
                    message_id: message.messageId,
                    block_level_markdown:
                        blockLevelMarkdown === undefined ? [] : [blockLevelMarkdown],
                    correlation_id: generateUint64(),
                    new_achievement: newAchievement,
                };
                return this.handleResponse(
                    this.groupService.edit_message_v2(args),
                    editMessageResponse,
                );
            });
    }

    claimPrize(messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.handleResponse(
            this.groupService.claim_prize({
                correlation_id: generateUint64(),
                message_id: messageId,
            }),
            claimPrizeResponse,
        );
    }

    sendMessage(
        senderName: string,
        senderDisplayName: string | undefined,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        newAchievement: boolean,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = new DataClient(this.identity, this.agent, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.chatId.groupId])
            : dataClient.uploadData(event.event.content, [this.chatId.groupId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const args = {
                content: apiMessageContentV2(newContent),
                message_id: event.event.messageId,
                sender_name: senderName,
                sender_display_name: senderDisplayName,
                rules_accepted: rulesAccepted,
                replies_to: mapOptional(event.event.repliesTo, (replyContext) => ({
                    event_index: replyContext.eventIndex,
                })),
                mentioned: mentioned.map(apiUserV2),
                forwarding: event.event.forwarded,
                thread_root_message_index: threadRootMessageIndex,
                message_filter_failed: messageFilterFailed,
                correlation_id: generateUint64(),
                block_level_markdown: event.event.blockLevelMarkdown,
                new_achievement: newAchievement,
            };

            return this.executeMsgpackUpdate(
                "send_message_v2",
                args,
                sendMessageResponse,
                GroupSendMessageArgs,
                GroupSendMessageResponse,
                onRequestAccepted,
            )
                .then((resp) => {
                    const retVal: [SendMessageResponse, Message] = [
                        resp,
                        { ...event.event, content: newContent },
                    ];
                    setCachedMessageFromSendResponse(
                        this.db,
                        this.chatId,
                        event,
                        threadRootMessageIndex,
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
        rules?: UpdatedRules,
        permissions?: OptionalChatPermissions,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>,
        gate?: AccessGate,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.groupService.update_group_v2({
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                public: apiOptional(identity, isPublic),
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
                permissions_v2: apiOptional(apiOptionalGroupPermissions, permissions),
                rules: apiOptional(apiUpdatedRules, rules),
                events_ttl: apiOptionUpdate(identity, eventsTimeToLiveMs),
                correlation_id: generateUint64(),
                gate:
                    gate === undefined
                        ? { NoChange: null }
                        : gate.kind === "no_gate"
                          ? { SetToNone: null }
                          : { SetToSome: apiAccessGate(gate) },
                gate_config:
                    gate === undefined
                        ? { NoChange: null }
                        : gate.kind === "no_gate"
                          ? { SetToNone: null }
                          : {
                                SetToSome: apiAccessGateConfig({
                                    gate,
                                    expiry: undefined,
                                }),
                            },
                messages_visible_to_non_members: apiOptional(identity, messagesVisibleToNonMembers),
            }),
            updateGroupResponse,
        );
    }

    addReaction(
        messageId: bigint,
        reaction: string,
        username: string,
        displayName: string | undefined,
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.add_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                username,
                display_name: apiOptional(identity, displayName),
                correlation_id: generateUint64(),
                new_achievement: newAchievement,
            }),
            addRemoveReactionResponse,
        );
    }

    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.remove_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse,
        );
    }

    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.delete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
                as_platform_moderator: apiOptional(identity, asPlatformModerator),
                new_achievement: newAchievement,
            }),
            deleteMessageResponse,
        );
    }

    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.undelete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            undeleteMessageResponse,
        );
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.groupService.block_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            blockUserResponse,
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.groupService.unblock_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            unblockUserResponse,
        );
    }

    async getGroupDetails(chatLastUpdated: bigint): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId.groupId);
        if (fromCache !== undefined) {
            if (fromCache.timestamp >= chatLastUpdated || offline()) {
                return fromCache;
            } else {
                return this.getGroupDetailsUpdates(fromCache);
            }
        }

        const response = await this.getGroupDetailsFromBackend();
        if (response !== "failure") {
            await setCachedGroupDetails(this.db, this.chatId.groupId, response);
        }
        return response;
    }

    private getGroupDetailsFromBackend(): Promise<GroupChatDetailsResponse> {
        return this.handleQueryResponse(
            () => this.groupService.selected_initial({}),
            groupDetailsResponse,
        );
    }

    private async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.getGroupDetailsUpdatesFromBackend(previous);
        if (response.timestamp > previous.timestamp) {
            await setCachedGroupDetails(this.db, this.chatId.groupId, response);
        }
        return response;
    }

    private async getGroupDetailsUpdatesFromBackend(
        previous: GroupChatDetails,
    ): Promise<GroupChatDetails> {
        const args = {
            updates_since: previous.timestamp,
        };
        const updatesResponse = await this.handleQueryResponse(
            () => this.groupService.selected_updates_v2(args),
            groupDetailsUpdatesResponse,
            args,
        );

        if (updatesResponse.kind === "failure") {
            return previous;
        }

        if (updatesResponse.kind === "success_no_updates") {
            return {
                ...previous,
                timestamp: updatesResponse.timestamp,
            };
        }

        return mergeGroupChatDetails(previous, updatesResponse);
    }

    getPublicSummary(): Promise<PublicGroupSummaryResponse> {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(
            () => this.groupService.public_summary(args),
            publicSummaryResponse,
            args,
        );
    }

    async getMessagesByMessageIndex(
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.getMessagesByMessageIndexFromBackend(
                fromCache.missing,
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(resp));

            return resp === "events_failed"
                ? resp
                : {
                      events: [...fromCache.messageEvents, ...resp.events],
                      expiredEventRanges: [],
                      expiredMessageRanges: [],
                      latestEventIndex: resp.latestEventIndex,
                  };
        }
        return {
            events: fromCache.messageEvents,
            expiredEventRanges: [],
            expiredMessageRanges: [],
            latestEventIndex: undefined,
        };
    }

    private getMessagesByMessageIndexFromBackend(
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const thread_root_message_index: [] = [];
        const invite_code: [] = [];
        const args = {
            thread_root_message_index,
            messages: new Uint32Array(messageIndexes),
            invite_code,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.messages_by_message_index(args),
            (resp) =>
                getMessagesByMessageIndexResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    latestKnownUpdate,
                ),
            args,
        );
    }

    getDeletedMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        return this.handleResponse(
            this.groupService.deleted_message({
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            deletedMessageResponse,
        );
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.groupService.pin_message_v2({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            pinMessageResponse,
        );
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.groupService.unpin_message({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            unpinMessageResponse,
        );
    }

    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.groupService.register_poll_vote({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
                new_achievement: newAchievement,
                correlation_id: generateUint64(),
            }),
            registerPollVoteResponse,
        );
    }

    searchGroupChat(
        searchTerm: string,
        userIds: string[],
        maxResults: number,
    ): Promise<SearchGroupChatResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
            users: apiOptional(
                identity,
                userIds.map((u) => Principal.fromText(u)),
            ),
        };
        return this.handleQueryResponse(
            () => this.groupService.search_messages(args),
            (res) => searchGroupChatResponse(res, this.chatId),
            args,
        );
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.invite_code({}),
            inviteCodeResponse,
        );
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.enable_invite_code({
                correlation_id: generateUint64(),
            }),
            enableInviteCodeResponse,
        );
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.disable_invite_code({
                correlation_id: generateUint64(),
            }),
            disableInviteCodeResponse,
        );
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.reset_invite_code({
                correlation_id: generateUint64(),
            }),
            resetInviteCodeResponse,
        );
    }

    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined,
    ): Promise<ThreadPreviewsResponse> {
        return this.handleQueryResponse(
            () =>
                this.groupService.thread_previews({
                    threads: new Uint32Array(threadRootMessageIndexes),
                    latest_client_thread_update: apiOptional(identity, latestClientThreadUpdate),
                }),
            (resp) => threadPreviewsResponse(resp, this.chatId, latestClientThreadUpdate),
        );
    }

    registerProposalVote(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.groupService.register_proposal_vote({
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse,
        );
    }

    registerProposalVoteV2(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.groupService.register_proposal_vote_v2({
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse,
        );
    }

    localUserIndex(): Promise<string> {
        return this.handleQueryResponse(
            () => this.groupService.local_user_index({}),
            (resp) => resp.Success.toString(),
        );
    }

    declineInvitation(): Promise<DeclineInvitationResponse> {
        return this.handleResponse(
            this.groupService.decline_invitation({}),
            declineInvitationResponse,
        );
    }

    toggleMuteNotifications(mute: boolean): Promise<ToggleMuteNotificationResponse> {
        return this.handleResponse(
            this.groupService.toggle_mute_notifications({ mute }),
            muteNotificationsResponse,
        );
    }

    convertToCommunity(historyVisible: boolean, rules: Rules): Promise<ConvertToCommunityResponse> {
        return this.handleResponse(
            this.groupService.convert_into_community({
                history_visible_to_new_joiners: historyVisible,
                primary_language: [],
                permissions: [],
                rules,
            }),
            convertToCommunityReponse,
        );
    }

    followThread(threadRootMessageIndex: number, follow: boolean): Promise<FollowThreadResponse> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
        };
        return this.handleResponse(
            follow
                ? this.groupService.follow_thread(args)
                : this.groupService.unfollow_thread(args),
            followThreadResponse,
        );
    }

    reportMessage(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.handleResponse(
            this.groupService.report_message({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                delete: deleteMessage,
            }),
            reportMessageResponse,
        );
    }

    acceptP2PSwap(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
    ): Promise<AcceptP2PSwapResponse> {
        return this.handleResponse(
            this.groupService.accept_p2p_swap({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                pin: apiOptional(identity, pin),
                new_achievement: newAchievement,
            }),
            acceptP2PSwapResponse,
        );
    }

    cancelP2PSwap(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        return this.handleResponse(
            this.groupService.cancel_p2p_swap({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
            }),
            cancelP2PSwapResponse,
        );
    }

    joinVideoCall(messageId: bigint, newAchievement: boolean): Promise<JoinVideoCallResponse> {
        return this.handleResponse(
            this.groupService.join_video_call({
                message_id: messageId,
                new_achievement: newAchievement,
            }),
            joinVideoCallResponse,
        );
    }

    setVideoCallPresence(
        messageId: bigint,
        presence: VideoCallPresence,
        newAchievement: boolean,
    ): Promise<SetVideoCallPresenceResponse> {
        return this.handleResponse(
            this.groupService.set_video_call_presence({
                message_id: messageId,
                presence: apiVideoCallPresence(presence),
                new_achievement: newAchievement,
            }),
            setVideoCallPresence,
        );
    }

    videoCallParticipants(
        messageId: bigint,
        updatesSince?: bigint,
    ): Promise<VideoCallParticipantsResponse> {
        return this.handleQueryResponse(
            () =>
                this.groupService.video_call_participants({
                    message_id: messageId,
                    updated_since: apiOptional(identity, updatesSince),
                }),
            videoCallParticipantsResponse,
        );
    }

    cancelInvites(userIds: string[]): Promise<boolean> {
        return this.handleResponse(
            this.groupService.cancel_invites({
                user_ids: userIds.map((u) => Principal.fromText(u)),
            }),
            (candid) => "Success" in candid,
        );
    }
}
