import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    AcceptP2PSwapResponse,
    AccessGateConfig,
    AddRemoveReactionResponse,
    BlockUserResponse,
    CancelP2PSwapResponse,
    ChangeRoleResponse,
    ChatEvent,
    ConvertToCommunityResponse,
    DeclineInvitationResponse,
    DeletedGroupMessageResponse,
    DeleteMessageResponse,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    FollowThreadResponse,
    FullWebhookDetails,
    GrantedBotPermissions,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatIdentifier,
    IndexRange,
    InviteCodeResponse,
    JoinVideoCallResponse,
    MemberRole,
    Message,
    OCError,
    OptionalChatPermissions,
    OptionUpdate,
    PinMessageResponse,
    PublicGroupSummaryResponse,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RemoveMemberResponse,
    ResetInviteCodeResponse,
    Rules,
    SearchGroupChatResponse,
    SendMessageResponse,
    SetVideoCallPresenceResponse,
    Tally,
    ThreadPreviewsResponse,
    ToggleMuteNotificationResponse,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnpinMessageResponse,
    UpdatedRules,
    UpdateGroupResponse,
    User,
    VideoCallParticipantsResponse,
    VideoCallPresence,
} from "openchat-shared";
import {
    isSuccessfulEventsResponse,
    MAX_EVENTS,
    MAX_MESSAGES,
    MAX_MISSING,
    offline,
    random32,
    ResponseTooLargeError,
} from "openchat-shared";
import type { AgentConfig } from "../../config";
import {
    ActiveProposalTalliesResponse,
    GroupAcceptP2pSwapArgs,
    GroupAcceptP2pSwapResponse,
    GroupActiveProposalTalliesArgs,
    GroupAddReactionArgs,
    GroupBlockUserArgs,
    GroupCancelInvitesArgs,
    GroupCancelP2pSwapArgs,
    GroupChangeRoleArgs,
    GroupConvertIntoCommunityArgs,
    GroupConvertIntoCommunityResponse,
    GroupDeletedMessageArgs,
    GroupDeletedMessageResponse,
    GroupDeleteMessagesArgs,
    GroupDeleteWebhookArgs,
    GroupEditMessageArgs,
    GroupEnableInviteCodeResponse,
    GroupEventsArgs,
    GroupEventsByIndexArgs,
    GroupEventsResponse,
    GroupEventsWindowArgs,
    GroupFollowThreadArgs,
    GroupInviteCodeResponse,
    GroupJoinVideoCallArgs,
    GroupLocalUserIndexResponse,
    GroupMessagesByMessageIndexArgs,
    GroupMessagesByMessageIndexResponse,
    GroupPinMessageArgs,
    GroupPinMessageResponse,
    GroupPublicSummaryArgs,
    GroupPublicSummaryResponse,
    GroupRegenerateWebhookArgs,
    GroupRegenerateWebhookResponse,
    GroupRegisterPollVoteArgs,
    GroupRegisterPollVoteResponse,
    GroupRegisterProposalVoteArgs,
    GroupRegisterProposalVoteV2Args,
    GroupRegisterWebhookArgs,
    GroupRegisterWebhookResponse,
    GroupRemoveParticipantArgs,
    GroupRemoveReactionArgs,
    GroupReportMessageArgs,
    GroupSearchMessagesArgs,
    GroupSearchMessagesResponse,
    GroupSelectedInitialResponse,
    GroupSelectedUpdatesArgs,
    GroupSelectedUpdatesResponse,
    GroupSendMessageArgs,
    GroupSendMessageResponse,
    GroupSetVideoCallPresenceArgs,
    GroupThreadPreviewsArgs,
    GroupThreadPreviewsResponse,
    GroupToggleMuteNotificationsArgs,
    GroupUnblockUserArgs,
    GroupUndeleteMessagesArgs,
    GroupUndeleteMessagesResponse,
    GroupUnpinMessageArgs,
    GroupUnpinMessageResponse,
    GroupUpdateBotArgs,
    GroupUpdateGroupArgs,
    GroupUpdateGroupResponse,
    GroupUpdateWebhookArgs,
    GroupVideoCallParticipantsArgs,
    GroupVideoCallParticipantsResponse,
    GroupWebhookArgs,
    GroupWebhookResponse,
    Empty as TEmpty,
    UnitResult,
} from "../../typebox";
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
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import { mergeGroupChatDetails } from "../../utils/chat";
import {
    apiOptionUpdateV2,
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import { MultiCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import {
    acceptP2PSwapSuccess,
    apiAccessGateConfig,
    apiExternalBotPermissions,
    apiMessageContent,
    apiUser as apiUserV2,
    apiVideoCallPresence,
    changeRoleResult,
    deletedMessageSuccess,
    enableOrResetInviteCodeSuccess,
    getEventsSuccess,
    getMessagesSuccess,
    groupDetailsSuccess,
    groupDetailsUpdatesResponse,
    inviteCodeSuccess,
    isSuccess,
    mapResult,
    proposalTallies,
    pushEventSuccess,
    searchGroupChatResponse,
    sendMessageSuccess,
    threadPreviewsSuccess,
    undeleteMessageSuccess,
    unitResult,
    updateGroupSuccess,
    videoCallParticipantsSuccess,
    webhookDetails,
} from "../common/chatMappersV2";
import {
    chunkedChatEventsFromBackend,
    chunkedChatEventsWindowFromBackend,
} from "../common/chunked";
import { publicSummarySuccess } from "../common/publicSummaryMapperV2";
import { DataClient } from "../data/data.client";
import {
    apiOptionalGroupPermissions,
    apiRole,
    apiUpdatedRules,
    convertToCommunitySuccess,
} from "./mappersV2";

export class GroupClient extends MultiCanisterMsgpackAgent {
    private readonly _inviteCodes: Map<string, bigint> = new Map();

    constructor(
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private db: Database,
    ) {
        super(identity, agent, "Group");
    }

    setInviteCode(groupId: string, inviteCode: bigint) {
        this._inviteCodes.set(groupId, inviteCode);
    }

    inviteCode(groupId: string): bigint | undefined {
        return this._inviteCodes.get(groupId);
    }

    getCachedEventsByIndex(groupId: string, eventIndexes: number[], threadRootMessageIndex: number | undefined) {
        return getCachedEventsByIndex(this.db, eventIndexes, {
            chatId: this.groupIdToChatId(groupId),
            threadRootMessageIndex,
        });
    }

    chatEventsByIndex(
        groupId: string,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.getCachedEventsByIndex(groupId, eventIndexes, threadRootMessageIndex).then((res) =>
            this.handleMissingEvents(groupId, res, threadRootMessageIndex, latestKnownUpdate),
        );
    }

    private setCachedEvents<T extends ChatEvent>(
        groupId: string,
        resp: EventsResponse<T>,
        threadRootMessageIndex: number | undefined,
    ): EventsResponse<T> {
        setCachedEvents(this.db, this.groupIdToChatId(groupId), resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err),
        );
        return resp;
    }

    private handleMissingEvents(
        groupId: string,
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0 || offline()) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                groupId,
                [...missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(groupId, resp, threadRootMessageIndex))
                .then((resp) => {
                    if (isSuccessfulEventsResponse(resp)) {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    chatEventsByIndexFromBackend(
        groupId: string,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            events: eventIndexes,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.query(
            groupId,
            "events_by_index",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.groupIdToChatId(groupId))),
            GroupEventsByIndexArgs,
            GroupEventsResponse,
        );
    }

    async chatEventsWindow(
        groupId: string,
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindowByMessageIndex(
            this.db,
            eventIndexRange,
            { chatId: this.groupIdToChatId(groupId), threadRootMessageIndex },
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
                groupId,
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
                maxEvents,
            )
                .then((resp) => this.setCachedEvents(groupId, resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the window request into a a few chunks",
                        );
                        return chunkedChatEventsWindowFromBackend(
                            (index: number, ascending: boolean, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    groupId,
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            (index: number, chunkSize: number) =>
                                this.chatEventsWindowFromBackend(
                                    groupId,
                                    index,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            messageIndex,
                        ).then((resp) => this.setCachedEvents(groupId, resp, threadRootMessageIndex));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                groupId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private async chatEventsWindowFromBackend(
        groupId: string,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.query(
            groupId,
            "events_window",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.groupIdToChatId(groupId))),
            GroupEventsWindowArgs,
            GroupEventsResponse,
        );
    }

    async chatEvents(
        groupId: string,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents(
            this.db,
            eventIndexRange,
            { chatId: this.groupIdToChatId(groupId), threadRootMessageIndex },
            startIndex,
            ascending,
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api", missing.size);
            return this.chatEventsFromBackend(
                groupId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(groupId, resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the payload into a a few chunks",
                        );
                        return chunkedChatEventsFromBackend(
                            (index: number, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    groupId,
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            startIndex,
                            ascending,
                        ).then((resp) => this.setCachedEvents(groupId, resp, threadRootMessageIndex));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                groupId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private chatEventsFromBackend(
        groupId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            ascending,
            start_index: startIndex,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.query(
            groupId,
            "events",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.groupIdToChatId(groupId))),
            GroupEventsArgs,
            GroupEventsResponse,
        );
    }

    changeRole(groupId: string, userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        const new_role = apiRole(newRole);
        if (new_role === undefined) {
            throw new Error(`Cannot change user's role to: ${newRole}`);
        }
        const user_id = principalStringToBytes(userId);
        return this.update(
            groupId,
            "change_role",
            {
                user_id,
                user_ids: [user_id],
                new_role,
            },
            changeRoleResult,
            GroupChangeRoleArgs,
            UnitResult,
        );
    }

    removeMember(groupId: string, userId: string): Promise<RemoveMemberResponse> {
        return this.update(
            groupId,
            "remove_participant",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            GroupRemoveParticipantArgs,
            UnitResult,
        );
    }

    editMessage(
        groupId: string,
        message: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        return new DataClient(this.identity, this.agent, this.config)
            .uploadData(message.content, [groupId])
            .then((content) => {
                const args = {
                    thread_root_message_index: threadRootMessageIndex,
                    content: apiMessageContent(content ?? message.content),
                    message_id: message.messageId,
                    block_level_markdown: blockLevelMarkdown,
                    new_achievement: newAchievement,
                };
                return this.update(
                    groupId,
                    "edit_message_v2",
                    args,
                    unitResult,
                    GroupEditMessageArgs,
                    UnitResult,
                );
            });
    }

    sendMessage(
        groupId: string,
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
        const chatId = this.groupIdToChatId(groupId);

        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = new DataClient(this.identity, this.agent, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [groupId])
            : dataClient.uploadData(event.event.content, [groupId]);

        return uploadContentPromise.then((content) => {
            const newEvent =
                content !== undefined ? { ...event, event: { ...event.event, content } } : event;
            const args = {
                content: apiMessageContent(newEvent.event.content),
                message_id: newEvent.event.messageId,
                sender_name: senderName,
                sender_display_name: senderDisplayName,
                rules_accepted: rulesAccepted,
                replies_to: mapOptional(newEvent.event.repliesTo, (replyContext) => ({
                    event_index: replyContext.eventIndex,
                })),
                mentioned: mentioned.map(apiUserV2),
                forwarding: newEvent.event.forwarded,
                thread_root_message_index: threadRootMessageIndex,
                message_filter_failed: messageFilterFailed,
                block_level_markdown: newEvent.event.blockLevelMarkdown,
                new_achievement: newAchievement,
            };

            return this.update(
                groupId,
                "send_message_v2",
                args,
                (resp) => mapResult(resp, sendMessageSuccess),
                GroupSendMessageArgs,
                GroupSendMessageResponse,
                onRequestAccepted,
            )
                .then((resp) => {
                    const retVal: [SendMessageResponse, Message] = [resp, newEvent.event];
                    setCachedMessageFromSendResponse(
                        this.db,
                        chatId,
                        newEvent,
                        threadRootMessageIndex,
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, chatId, newEvent, threadRootMessageIndex);
                    throw err;
                });
        });
    }

    updateGroup(
        groupId: string,
        name?: string,
        description?: string,
        rules?: UpdatedRules,
        permissions?: OptionalChatPermissions,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>,
        gateConfig?: AccessGateConfig,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
    ): Promise<UpdateGroupResponse> {
        return this.update(
            groupId,
            "update_group_v2",
            {
                name,
                description,
                public: isPublic,
                avatar:
                    avatar === undefined
                        ? "NoChange"
                        : {
                              SetToSome: {
                                  id: BigInt(random32()),
                                  mime_type: "image/jpg",
                                  data: avatar,
                              },
                          },
                permissions_v2: mapOptional(permissions, apiOptionalGroupPermissions),
                rules: mapOptional(rules, apiUpdatedRules),
                events_ttl: apiOptionUpdateV2(identity, eventsTimeToLiveMs),
                gate_config:
                    gateConfig === undefined
                        ? "NoChange"
                        : gateConfig.gate.kind === "no_gate"
                        ? "SetToNone"
                        : { SetToSome: apiAccessGateConfig(gateConfig) },
                messages_visible_to_non_members: messagesVisibleToNonMembers,
            },
            (resp) => mapResult(resp, updateGroupSuccess),
            GroupUpdateGroupArgs,
            GroupUpdateGroupResponse,
        );
    }

    addReaction(
        groupId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        displayName: string | undefined,
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<AddRemoveReactionResponse> {
        return this.update(
            groupId,
            "add_reaction",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
                username,
                display_name: displayName,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupAddReactionArgs,
            UnitResult,
        );
    }

    removeReaction(
        groupId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.update(
            groupId,
            "remove_reaction",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
            },
            unitResult,
            GroupRemoveReactionArgs,
            UnitResult,
        );
    }

    deleteMessage(
        groupId: string,
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        return this.update(
            groupId,
            "delete_messages",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
                as_platform_moderator: asPlatformModerator,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupDeleteMessagesArgs,
            UnitResult,
        );
    }

    undeleteMessage(
        groupId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.update(
            groupId,
            "undelete_messages",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
            },
            (resp) => mapResult(resp, undeleteMessageSuccess),
            GroupUndeleteMessagesArgs,
            GroupUndeleteMessagesResponse,
        );
    }

    blockUser(groupId: string, userId: string): Promise<BlockUserResponse> {
        return this.update(
            groupId,
            "block_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            GroupBlockUserArgs,
            UnitResult,
        );
    }

    unblockUser(groupId: string, userId: string): Promise<UnblockUserResponse> {
        return this.update(
            groupId,
            "unblock_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            GroupUnblockUserArgs,
            UnitResult,
        );
    }

    async getGroupDetails(groupId: string, chatLastUpdated: bigint): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, groupId);
        if (fromCache !== undefined) {
            if (fromCache.timestamp >= chatLastUpdated || offline()) {
                return fromCache;
            } else {
                return this.getGroupDetailsUpdates(groupId, fromCache);
            }
        }

        const response = await this.getGroupDetailsFromBackend(groupId);
        if (typeof response === "object" && "members" in response) {
            await setCachedGroupDetails(this.db, groupId, response);
        }
        return response;
    }

    private getGroupDetailsFromBackend(groupId: string): Promise<GroupChatDetailsResponse> {
        return this.query(
            groupId,
            "selected_initial",
            {},
            (resp) =>
                mapResult(resp, (value) =>
                    groupDetailsSuccess(value, this.config.blobUrlPattern, groupId),
                ),
            TEmpty,
            GroupSelectedInitialResponse,
        );
    }

    private async getGroupDetailsUpdates(groupId: string, previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.getGroupDetailsUpdatesFromBackend(groupId, previous);
        if (response.timestamp > previous.timestamp) {
            await setCachedGroupDetails(this.db, groupId, response);
        }
        return response;
    }

    private async getGroupDetailsUpdatesFromBackend(
        groupId: string,
        previous: GroupChatDetails,
    ): Promise<GroupChatDetails> {
        const args = {
            updates_since: previous.timestamp,
        };
        const updatesResponse = await this.query(
            groupId,
            "selected_updates_v2",
            args,
            (value) =>
                groupDetailsUpdatesResponse(value, this.config.blobUrlPattern, groupId),
            GroupSelectedUpdatesArgs,
            GroupSelectedUpdatesResponse,
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

    getPublicSummary(groupId: string): Promise<PublicGroupSummaryResponse> {
        const args = { invite_code: this.inviteCode(groupId) };
        return this.query(
            groupId,
            "public_summary",
            args,
            (resp) => mapResult(resp, publicSummarySuccess),
            GroupPublicSummaryArgs,
            GroupPublicSummaryResponse,
        );
    }

    async getMessagesByMessageIndex(
        groupId: string,
        threadRootMessageIndex: number | undefined,
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(
            this.db,
            this.groupIdToChatId(groupId),
            threadRootMessageIndex,
            messageIndexes,
        );
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.getMessagesByMessageIndexFromBackend(
                groupId,
                threadRootMessageIndex,
                [...fromCache.missing],
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(groupId, resp, threadRootMessageIndex));

            return isSuccessfulEventsResponse(resp)
                ? {
                      events: [...fromCache.messageEvents, ...resp.events],
                      expiredEventRanges: [],
                      expiredMessageRanges: [],
                      latestEventIndex: resp.latestEventIndex,
                  }
                : resp;
        }
        return {
            events: fromCache.messageEvents,
            expiredEventRanges: [],
            expiredMessageRanges: [],
            latestEventIndex: undefined,
        };
    }

    private getMessagesByMessageIndexFromBackend(
        groupId: string,
        threadRootMessageIndex: number | undefined,
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        console.log("group.client.ts, threadRootMessageIndex: ", threadRootMessageIndex);
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            messages: messageIndexes,
            latest_known_update: latestKnownUpdate,
        };
        return this.query(
            groupId,
            "messages_by_message_index",
            args,
            (resp) =>
                mapResult(resp, (value) => getMessagesSuccess(value, this.principal, this.groupIdToChatId(groupId))),
            GroupMessagesByMessageIndexArgs,
            GroupMessagesByMessageIndexResponse,
        );
    }

    getDeletedMessage(
        groupId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        return this.update(
            groupId,
            "deleted_message",
            {
                message_id: messageId,
                thread_root_message_index: threadRootMessageIndex,
            },
            (resp) => mapResult(resp, deletedMessageSuccess),
            GroupDeletedMessageArgs,
            GroupDeletedMessageResponse,
        );
    }

    pinMessage(groupId: string, messageIndex: number): Promise<PinMessageResponse> {
        return this.update(
            groupId,
            "pin_message_v2",
            {
                message_index: messageIndex,
            },
            (resp) => mapResult(resp, pushEventSuccess),
            GroupPinMessageArgs,
            GroupPinMessageResponse,
        );
    }

    unpinMessage(groupId: string, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.update(
            groupId,
            "unpin_message",
            {
                message_index: messageIndex,
            },
            (resp) => mapResult(resp, pushEventSuccess),
            GroupUnpinMessageArgs,
            GroupUnpinMessageResponse,
        );
    }

    registerPollVote(
        groupId: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<RegisterPollVoteResponse> {
        return this.update(
            groupId,
            "register_poll_vote",
            {
                thread_root_message_index: threadRootMessageIndex,
                poll_option: answerIdx,
                operation: voteType === "register" ? "RegisterVote" : "DeleteVote",
                message_index: messageIdx,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupRegisterPollVoteArgs,
            GroupRegisterPollVoteResponse,
        );
    }

    searchGroupChat(
        groupId: string,
        searchTerm: string,
        userIds: string[],
        maxResults: number,
    ): Promise<SearchGroupChatResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
            users: userIds.map(principalStringToBytes),
        };
        return this.query(
            groupId,
            "search_messages",
            args,
            (res) => searchGroupChatResponse(res, this.groupIdToChatId(groupId)),
            GroupSearchMessagesArgs,
            GroupSearchMessagesResponse,
        );
    }

    getInviteCode(groupId: string): Promise<InviteCodeResponse> {
        return this.query(
            groupId,
            "invite_code",
            {},
            (resp) => mapResult(resp, inviteCodeSuccess),
            TEmpty,
            GroupInviteCodeResponse,
        );
    }

    enableInviteCode(groupId: string): Promise<EnableInviteCodeResponse> {
        return this.update(
            groupId,
            "enable_invite_code",
            {},
            (resp) => mapResult(resp, enableOrResetInviteCodeSuccess),
            TEmpty,
            GroupEnableInviteCodeResponse,
        );
    }

    disableInviteCode(groupId: string): Promise<DisableInviteCodeResponse> {
        return this.update(groupId, "disable_invite_code", {}, unitResult, TEmpty, UnitResult);
    }

    resetInviteCode(groupId: string): Promise<ResetInviteCodeResponse> {
        return this.update(
            groupId,
            "reset_invite_code",
            {},
            (resp) => mapResult(resp, enableOrResetInviteCodeSuccess),
            TEmpty,
            GroupEnableInviteCodeResponse,
        );
    }

    threadPreviews(
        groupId: string,
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined,
    ): Promise<ThreadPreviewsResponse> {
        return this.query(
            groupId,
            "thread_previews",
            {
                threads: threadRootMessageIndexes,
                latest_client_thread_update: latestClientThreadUpdate,
            },
            (resp) => mapResult(resp, (value) => threadPreviewsSuccess(value, this.groupIdToChatId(groupId))),
            GroupThreadPreviewsArgs,
            GroupThreadPreviewsResponse,
        );
    }

    registerProposalVote(
        groupId: string,
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.update(
            groupId,
            "register_proposal_vote",
            {
                adopt,
                message_index: messageIdx,
            },
            unitResult,
            GroupRegisterProposalVoteArgs,
            UnitResult,
        );
    }

    registerProposalVoteV2(
        groupId: string,
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.update(
            groupId,
            "register_proposal_vote_v2",
            {
                adopt,
                message_index: messageIdx,
            },
            unitResult,
            GroupRegisterProposalVoteV2Args,
            UnitResult,
        );
    }

    localUserIndex(groupId: string): Promise<string> {
        return this.query(
            groupId,
            "local_user_index",
            {},
            (resp) => principalBytesToString(resp.Success),
            TEmpty,
            GroupLocalUserIndexResponse,
        );
    }

    declineInvitation(groupId: string): Promise<DeclineInvitationResponse> {
        return this.update(groupId, "decline_invitation", {}, unitResult, TEmpty, UnitResult);
    }

    toggleMuteNotifications(
        groupId: string,
        mute: boolean | undefined,
        muteAtEveryone: boolean | undefined,
    ): Promise<ToggleMuteNotificationResponse> {
        return this.update(
            groupId,
            "toggle_mute_notifications",
            { mute, mute_at_everyone: muteAtEveryone },
            unitResult,
            GroupToggleMuteNotificationsArgs,
            UnitResult,
        );
    }

    convertToCommunity(groupId: string, historyVisible: boolean, rules: Rules): Promise<ConvertToCommunityResponse> {
        return this.update(
            groupId,
            "convert_into_community",
            {
                history_visible_to_new_joiners: historyVisible,
                primary_language: undefined,
                permissions: undefined,
                rules,
            },
            (resp) => mapResult(resp, convertToCommunitySuccess),
            GroupConvertIntoCommunityArgs,
            GroupConvertIntoCommunityResponse,
        );
    }

    followThread(
        groupId: string,
        threadRootMessageIndex: number,
        follow: boolean,
        newAchievement: boolean,
    ): Promise<FollowThreadResponse> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            new_achievement: newAchievement,
        };
        return this.update(
            groupId,
            follow ? "follow_thread" : "unfollow_thread",
            args,
            unitResult,
            GroupFollowThreadArgs,
            UnitResult,
        );
    }

    reportMessage(
        groupId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.update(
            groupId,
            "report_message",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                delete: deleteMessage,
            },
            isSuccess,
            GroupReportMessageArgs,
            UnitResult,
        );
    }

    acceptP2PSwap(
        groupId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
    ): Promise<AcceptP2PSwapResponse> {
        return this.update(
            groupId,
            "accept_p2p_swap",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                pin,
                new_achievement: newAchievement,
            },
            (resp) => mapResult(resp, acceptP2PSwapSuccess),
            GroupAcceptP2pSwapArgs,
            GroupAcceptP2pSwapResponse,
        );
    }

    cancelP2PSwap(
        groupId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        return this.update(
            groupId,
            "cancel_p2p_swap",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
            },
            unitResult,
            GroupCancelP2pSwapArgs,
            UnitResult,
        );
    }

    joinVideoCall(groupId: string, messageId: bigint, newAchievement: boolean): Promise<JoinVideoCallResponse> {
        return this.update(
            groupId,
            "join_video_call",
            {
                message_id: messageId,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupJoinVideoCallArgs,
            UnitResult,
        );
    }

    setVideoCallPresence(
        groupId: string,
        messageId: bigint,
        presence: VideoCallPresence,
        newAchievement: boolean,
    ): Promise<SetVideoCallPresenceResponse> {
        return this.update(
            groupId,
            "set_video_call_presence",
            {
                message_id: messageId,
                presence: apiVideoCallPresence(presence),
                new_achievement: newAchievement,
            },
            unitResult,
            GroupSetVideoCallPresenceArgs,
            UnitResult,
        );
    }

    videoCallParticipants(
        groupId: string,
        messageId: bigint,
        updatesSince?: bigint,
    ): Promise<VideoCallParticipantsResponse> {
        return this.query(
            groupId,
            "video_call_participants",
            {
                message_id: messageId,
                updated_since: updatesSince,
            },
            (resp) => mapResult(resp, videoCallParticipantsSuccess),
            GroupVideoCallParticipantsArgs,
            GroupVideoCallParticipantsResponse,
        );
    }

    cancelInvites(groupId: string, userIds: string[]): Promise<boolean> {
        return this.update(
            groupId,
            "cancel_invites",
            {
                user_ids: userIds.map(principalStringToBytes),
            },
            isSuccess,
            GroupCancelInvitesArgs,
            UnitResult,
        );
    }

    updateInstalledBot(groupId: string, botId: string, grantedPermissions: GrantedBotPermissions): Promise<boolean> {
        return this.update(
            groupId,
            "update_bot",
            {
                bot_id: principalStringToBytes(botId),
                granted_permissions: apiExternalBotPermissions(grantedPermissions.command),
                granted_autonomous_permissions: mapOptional(
                    grantedPermissions.autonomous,
                    apiExternalBotPermissions,
                ),
            },
            isSuccess,
            GroupUpdateBotArgs,
            UnitResult,
        );
    }

    registerWebhook(
        groupId: string,
        name: string,
        avatar: string | undefined,
    ): Promise<FullWebhookDetails | undefined> {
        return this.update(
            groupId,
            "register_webhook",
            {
                name,
                avatar,
            },
            (resp) => {
                if (typeof resp === "object" && "Success" in resp) {
                    const result = webhookDetails(
                        {
                            id: resp.Success.id,
                            name,
                            avatar_id: resp.Success.avatar_id,
                        },
                        this.config.blobUrlPattern,
                        groupId,
                    );

                    return {
                        ...result,
                        secret: resp.Success.secret,
                    };
                }
                return undefined;
            },
            GroupRegisterWebhookArgs,
            GroupRegisterWebhookResponse,
        );
    }

    updateWebhook(
        groupId: string,
        id: string,
        name: string | undefined,
        avatar: OptionUpdate<string>,
    ): Promise<boolean> {
        return this.update(
            groupId,
            "update_webhook",
            {
                id: principalStringToBytes(id),
                name,
                avatar: apiOptionUpdateV2(identity, avatar),
            },
            isSuccess,
            GroupUpdateWebhookArgs,
            UnitResult,
        );
    }

    regenerateWebhook(groupId: string, id: string): Promise<string | undefined> {
        return this.update(
            groupId,
            "regenerate_webhook",
            {
                id: principalStringToBytes(id),
            },
            (resp) => {
                return typeof resp === "object" && "Success" in resp
                    ? resp.Success.secret
                    : undefined;
            },
            GroupRegenerateWebhookArgs,
            GroupRegenerateWebhookResponse,
        );
    }

    deleteWebhook(groupId: string, id: string): Promise<boolean> {
        return this.update(
            groupId,
            "delete_webhook",
            {
                id: principalStringToBytes(id),
            },
            isSuccess,
            GroupDeleteWebhookArgs,
            UnitResult,
        );
    }

    getWebhook(groupId: string, id: string): Promise<string | undefined> {
        return this.query(
            groupId,
            "webhook",
            {
                id: principalStringToBytes(id),
            },
            (resp) => {
                if (typeof resp === "object" && "Success" in resp) {
                    return resp.Success.secret;
                }
                console.log("Failed to get group webhook: ", id, resp);
                return undefined;
            },
            GroupWebhookArgs,
            GroupWebhookResponse,
        );
    }

    activeProposalTallies(groupId: string): Promise<[number, Tally][] | OCError> {
        return this.query(
            groupId,
            "active_proposal_tallies",
            {
                invite_code: this.inviteCode(groupId),
            },
            (resp) => mapResult(resp, (value) => proposalTallies(value.tallies)),
            GroupActiveProposalTalliesArgs,
            ActiveProposalTalliesResponse,
        );
    }

    private groupIdToChatId(groupId: string): GroupChatIdentifier {
        return {
            kind: "group_chat",
            groupId,
        }
    }
}
