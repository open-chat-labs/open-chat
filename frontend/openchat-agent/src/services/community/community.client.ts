import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    AcceptP2PSwapResponse,
    AccessGateConfig,
    AddMembersToChannelResponse,
    AddRemoveReactionResponse,
    BlockCommunityUserResponse,
    CancelP2PSwapResponse,
    CandidateChannel,
    ChangeCommunityRoleResponse,
    ChangeRoleResponse,
    ChannelIdentifier,
    ChannelSummaryResponse,
    ChatEvent,
    CommunityDetails,
    CommunityDetailsResponse,
    CommunityIdentifier,
    CommunityPermissions,
    CommunitySummaryResponse,
    CommunitySummaryUpdatesResponse,
    CreateGroupResponse,
    CreateUserGroupResponse,
    DeclineInvitationResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DeleteUserGroupsResponse,
    DeletedGroupMessageResponse,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventWrapper,
    EventsResponse,
    EventsSuccessResult,
    ExploreChannelsResponse,
    FollowThreadResponse,
    FullWebhookDetails,
    GrantedBotPermissions,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatIdentifier,
    ImportGroupResponse,
    IndexRange,
    InviteCodeResponse,
    JoinVideoCallResponse,
    LeaveGroupResponse,
    MemberRole,
    Message,
    OCError,
    OptionUpdate,
    OptionalChatPermissions,
    PinMessageResponse,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RemoveMemberResponse,
    ResetInviteCodeResponse,
    SearchGroupChatResponse,
    SendMessageResponse,
    SetMemberDisplayNameResponse,
    SetVideoCallPresenceResponse,
    Tally,
    ThreadPreviewsResponse,
    ToggleMuteNotificationResponse,
    UnblockCommunityUserResponse,
    UndeleteMessageResponse,
    UnpinMessageResponse,
    UpdateCommunityResponse,
    UpdateGroupResponse,
    UpdateUserGroupResponse,
    UpdatedRules,
    User,
    VideoCallParticipantsResponse,
    VideoCallPresence,
} from "openchat-shared";
import {
    DestinationInvalidError,
    MAX_EVENTS,
    MAX_MESSAGES,
    MAX_MISSING,
    ResponseTooLargeError,
    isSuccessfulEventsResponse,
    offline,
    random32,
    toBigInt32,
} from "openchat-shared";
import type { AgentConfig } from "../../config";
import {
    ActiveProposalTalliesResponse,
    CommunityAcceptP2pSwapArgs,
    CommunityAcceptP2pSwapResponse,
    CommunityActiveProposalTalliesArgs,
    CommunityAddMembersToChannelArgs,
    CommunityAddMembersToChannelResponse,
    CommunityAddReactionArgs,
    CommunityBlockUserArgs,
    CommunityCancelInvitesArgs,
    CommunityCancelP2pSwapArgs,
    CommunityChangeChannelRoleArgs,
    CommunityChangeRoleArgs,
    CommunityChannelSummaryArgs,
    CommunityChannelSummaryResponse,
    CommunityCreateChannelArgs,
    CommunityCreateChannelResponse,
    CommunityCreateUserGroupArgs,
    CommunityCreateUserGroupResponse,
    CommunityDeclineInvitationArgs,
    CommunityDeleteChannelArgs,
    CommunityDeleteMessagesArgs,
    CommunityDeleteUserGroupsArgs,
    CommunityDeleteWebhookArgs,
    CommunityDeletedMessageArgs,
    CommunityDeletedMessageResponse,
    CommunityEditMessageArgs,
    CommunityEnableInviteCodeResponse,
    CommunityEventsArgs,
    CommunityEventsByIndexArgs,
    CommunityEventsResponse,
    CommunityEventsWindowArgs,
    CommunityExploreChannelsArgs,
    CommunityExploreChannelsResponse,
    CommunityFollowThreadArgs,
    CommunityImportGroupArgs,
    CommunityImportGroupResponse,
    CommunityInviteCodeResponse,
    CommunityJoinVideoCallArgs,
    CommunityLeaveChannelArgs,
    CommunityLocalUserIndexResponse,
    CommunityMessagesByMessageIndexArgs,
    CommunityMessagesByMessageIndexResponse,
    CommunityPinMessageArgs,
    CommunityPinMessageResponse,
    CommunityRegenerateWebhookArgs,
    CommunityRegenerateWebhookResponse,
    CommunityRegisterPollVoteArgs,
    CommunityRegisterPollVoteResponse,
    CommunityRegisterProposalVoteArgs,
    CommunityRegisterWebhookArgs,
    CommunityRegisterWebhookResponse,
    CommunityRemoveMemberArgs,
    CommunityRemoveMemberFromChannelArgs,
    CommunityRemoveReactionArgs,
    CommunityReportMessageArgs,
    CommunitySearchChannelArgs,
    CommunitySearchChannelResponse,
    CommunitySelectedChannelInitialArgs,
    CommunitySelectedChannelInitialResponse,
    CommunitySelectedChannelUpdatesArgs,
    CommunitySelectedChannelUpdatesResponse,
    CommunitySelectedInitialArgs,
    CommunitySelectedInitialResponse,
    CommunitySelectedUpdatesArgs,
    CommunitySelectedUpdatesResponse,
    CommunitySendMessageArgs,
    CommunitySendMessageResponse,
    CommunitySetMemberDisplayNameArgs,
    CommunitySetVideoCallPresenceArgs,
    CommunitySummaryArgs,
    CommunitySummaryUpdatesArgs,
    CommunityThreadPreviewsArgs,
    CommunityThreadPreviewsResponse,
    CommunityToggleMuteNotificationsArgs,
    CommunityUnblockUserArgs,
    CommunityUndeleteMessagesArgs,
    CommunityUndeleteMessagesResponse,
    CommunityUpdateBotArgs,
    CommunityUpdateChannelArgs,
    CommunityUpdateChannelResponse,
    CommunityUpdateCommunityArgs,
    CommunityUpdateCommunityResponse,
    CommunityUpdateUserGroupArgs,
    CommunityUpdateWebhookArgs,
    CommunityVideoCallParticipantsArgs,
    CommunityVideoCallParticipantsResponse,
    CommunityWebhookArgs,
    CommunityWebhookResponse,
    CommunitySummaryResponse as TCommunitySummaryResponse,
    CommunitySummaryUpdatesResponse as TCommunitySummaryUpdatesResponse,
    Empty as TEmpty,
    UnitResult,
} from "../../typebox";
import {
    getCachedCommunityDetails,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedCommunityDetails,
    setCachedEvents,
    setCachedGroupDetails,
    setCachedMessageFromSendResponse,
    type Database,
} from "../../utils/caching";
import { mergeCommunityDetails, mergeGroupChatDetails } from "../../utils/chat";
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
    apiGroupPermissions,
    apiMaybeAccessGateConfig,
    apiMessageContent,
    apiUser as apiUserV2,
    apiVideoCallPresence,
    changeRoleResult,
    createGroupSuccess,
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
import { DataClient } from "../data/data.client";
import { apiOptionalGroupPermissions, apiUpdatedRules } from "../group/mappersV2";
import {
    addMembersToChannelResponse,
    apiCommunityRole,
    apiMemberRole,
    apiOptionalCommunityPermissions,
    communityChannelSummaryResponse,
    communityDetailsResponse,
    communityDetailsUpdatesResponse,
    createUserGroupSuccess,
    exploreChannelsResponse,
    importGroupSuccess,
    summaryResponse,
    summaryUpdatesResponse,
    updateCommunitySuccess,
} from "./mappersV2";

export class CommunityClient extends MultiCanisterMsgpackAgent {
    private readonly _inviteCodes: Map<string, bigint> = new Map();

    constructor(
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private db: Database,
    ) {
        super(identity, agent, "Community");
    }

    setInviteCode(communityId: string, inviteCode: bigint) {
        this._inviteCodes.set(communityId, inviteCode);
    }

    inviteCode(communityId: string): bigint | undefined {
        return this._inviteCodes.get(communityId);
    }

    addMembersToChannel(
        chatId: ChannelIdentifier,
        userIds: string[],
        username: string,
        displayName: string | undefined,
    ): Promise<AddMembersToChannelResponse> {
        return this.update(
            chatId.communityId,
            "add_members_to_channel",
            {
                channel_id: toBigInt32(chatId.channelId),
                user_ids: userIds.map(principalStringToBytes),
                added_by_name: username,
                added_by_display_name: displayName,
            },
            addMembersToChannelResponse,
            CommunityAddMembersToChannelArgs,
            CommunityAddMembersToChannelResponse,
        );
    }

    addReaction(
        chatId: ChannelIdentifier,
        username: string,
        displayName: string | undefined,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<AddRemoveReactionResponse> {
        return this.update(
            chatId.communityId,
            "add_reaction",
            {
                channel_id: toBigInt32(chatId.channelId),
                username,
                display_name: displayName,
                message_id: messageId,
                thread_root_message_index: threadRootMessageIndex,
                reaction,
                new_achievement: newAchievement,
            },
            unitResult,
            CommunityAddReactionArgs,
            UnitResult,
        );
    }

    blockUser(communityId: string, userId: string): Promise<BlockCommunityUserResponse> {
        return this.update(
            communityId,
            "block_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            CommunityBlockUserArgs,
            UnitResult,
        );
    }

    changeChannelRole(
        chatId: ChannelIdentifier,
        userId: string,
        newRole: MemberRole,
    ): Promise<ChangeRoleResponse> {
        const user_id = principalStringToBytes(userId);
        return this.update(
            chatId.communityId,
            "change_channel_role",
            {
                channel_id: toBigInt32(chatId.channelId),
                user_id,
                user_ids: [user_id],
                new_role: apiMemberRole(newRole),
            },
            changeRoleResult,
            CommunityChangeChannelRoleArgs,
            UnitResult,
        );
    }

    changeRole(
        communityId: string,
        userId: string,
        newRole: MemberRole,
    ): Promise<ChangeCommunityRoleResponse> {
        const user_id = principalStringToBytes(userId);
        return this.update(
            communityId,
            "change_role",
            {
                user_id,
                user_ids: [user_id],
                new_role: apiCommunityRole(newRole),
            },
            changeRoleResult,
            CommunityChangeRoleArgs,
            UnitResult,
        );
    }

    createChannel(communityId: string, channel: CandidateChannel): Promise<CreateGroupResponse> {
        return this.update(
            communityId,
            "create_channel",
            {
                is_public: channel.public,
                name: channel.name,
                events_ttl: channel.eventsTTL,
                description: channel.description,
                external_url: channel.externalUrl,
                history_visible_to_new_joiners: channel.historyVisible,
                avatar: mapOptional(channel.avatar?.blobData, (data) => {
                    return {
                        id: BigInt(random32()),
                        data,
                        mime_type: "image/jpg",
                    };
                }),
                permissions_v2: apiGroupPermissions(channel.permissions),
                rules: channel.rules,
                gate_config: apiMaybeAccessGateConfig(channel.gateConfig),
                messages_visible_to_non_members: channel.messagesVisibleToNonMembers,
            },
            (resp) => mapResult(resp, (value) => createGroupSuccess(value, channel.id)),
            CommunityCreateChannelArgs,
            CommunityCreateChannelResponse,
        );
    }

    declineInvitation(chatId: ChannelIdentifier): Promise<DeclineInvitationResponse> {
        return this.update(
            chatId.communityId,
            "decline_invitation",
            {
                channel_id: toBigInt32(chatId.channelId),
            },
            unitResult,
            CommunityDeclineInvitationArgs,
            UnitResult,
        );
    }

    deleteChannel(chatId: ChannelIdentifier): Promise<DeleteGroupResponse> {
        return this.update(
            chatId.communityId,
            "delete_channel",
            {
                channel_id: toBigInt32(chatId.channelId),
            },
            unitResult,
            CommunityDeleteChannelArgs,
            UnitResult,
        );
    }

    getDeletedMessage(
        chatId: ChannelIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        return this.query(
            chatId.communityId,
            "deleted_message",
            {
                channel_id: toBigInt32(chatId.channelId),
                message_id: messageId,
                thread_root_message_index: threadRootMessageIndex,
            },
            (resp) => mapResult(resp, deletedMessageSuccess),
            CommunityDeletedMessageArgs,
            CommunityDeletedMessageResponse,
        );
    }

    deleteMessages(
        chatId: ChannelIdentifier,
        messageIds: bigint[],
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        return this.update(
            chatId.communityId,
            "delete_messages",
            {
                channel_id: toBigInt32(chatId.channelId),
                message_ids: messageIds,
                as_platform_moderator: asPlatformModerator,
                thread_root_message_index: threadRootMessageIndex,
                new_achievement: newAchievement,
            },
            unitResult,
            CommunityDeleteMessagesArgs,
            UnitResult,
        );
    }

    disableInviteCode(communityId: string): Promise<DisableInviteCodeResponse> {
        return this.update(communityId, "disable_invite_code", {}, unitResult, TEmpty, UnitResult);
    }

    editMessage(
        chatId: ChannelIdentifier,
        message: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        return new DataClient(this.identity, this.agent, this.config)
            .uploadData(message.content, [chatId.communityId])
            .then((content) => {
                return this.update(
                    chatId.communityId,
                    "edit_message",
                    {
                        channel_id: toBigInt32(chatId.channelId),
                        thread_root_message_index: threadRootMessageIndex,
                        content: apiMessageContent(content ?? message.content),
                        message_id: message.messageId,
                        block_level_markdown: blockLevelMarkdown,
                        new_achievement: newAchievement,
                    },
                    unitResult,
                    CommunityEditMessageArgs,
                    UnitResult,
                );
            });
    }

    enableInviteCode(communityId: string): Promise<EnableInviteCodeResponse> {
        return this.update(
            communityId,
            "enable_invite_code",
            {},
            (resp) => mapResult(resp, enableOrResetInviteCodeSuccess),
            TEmpty,
            CommunityEnableInviteCodeResponse,
        );
    }

    async events(
        chatId: ChannelIdentifier,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents(
            this.db,
            eventIndexRange,
            { chatId, threadRootMessageIndex },
            startIndex,
            ascending,
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.eventsFromBackend(
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the payload into a a few chunks",
                        );
                        return chunkedChatEventsFromBackend(
                            (index: number, chunkSize: number) =>
                                this.eventsFromBackend(
                                    chatId,
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            startIndex,
                            ascending,
                        ).then((resp) =>
                            this.setCachedEvents(chatId, resp, threadRootMessageIndex),
                        );
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    eventsFromBackend(
        chatId: ChannelIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            channel_id: toBigInt32(chatId.channelId),
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            start_index: startIndex,
            ascending: ascending,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.query(
            chatId.communityId,
            "events",
            args,
            (resp) => mapResult(resp, (value) => getEventsSuccess(value, this.principal, chatId)),
            CommunityEventsArgs,
            CommunityEventsResponse,
        );
    }

    getCachedEventsByIndex(
        chatId: ChannelIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
    ) {
        return getCachedEventsByIndex(this.db, eventIndexes, {
            chatId,
            threadRootMessageIndex,
        });
    }

    eventsByIndex(
        chatId: ChannelIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.getCachedEventsByIndex(chatId, eventIndexes, threadRootMessageIndex).then(
            (res) =>
                this.handleMissingEvents(chatId, res, threadRootMessageIndex, latestKnownUpdate),
        );
    }

    private eventsByIndexFromBackend(
        chatId: ChannelIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            channel_id: toBigInt32(chatId.channelId),
            thread_root_message_index: threadRootMessageIndex,
            events: eventIndexes,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: [] as [] | [number],
        };
        return this.query(
            chatId.communityId,
            "events_by_index",
            args,
            (resp) => mapResult(resp, (value) => getEventsSuccess(value, this.principal, chatId)),
            CommunityEventsByIndexArgs,
            CommunityEventsResponse,
        );
    }

    async eventsWindow(
        chatId: ChannelIdentifier,
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindowByMessageIndex(
            this.db,
            eventIndexRange,
            { chatId, threadRootMessageIndex },
            messageIndex,
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss,
            );
            return this.eventsWindowFromBackend(
                chatId,
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the window request into a a few chunks",
                        );
                        return chunkedChatEventsWindowFromBackend(
                            (index: number, ascending: boolean, chunkSize: number) =>
                                this.eventsFromBackend(
                                    chatId,
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            (index: number, chunkSize: number) =>
                                this.eventsWindowFromBackend(
                                    chatId,
                                    index,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            messageIndex,
                        ).then((resp) =>
                            this.setCachedEvents(chatId, resp, threadRootMessageIndex),
                        );
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private async eventsWindowFromBackend(
        chatId: ChannelIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            channel_id: toBigInt32(chatId.channelId),
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.query(
            chatId.communityId,
            "events_window",
            args,
            (resp) => mapResult(resp, (value) => getEventsSuccess(value, this.principal, chatId)),
            CommunityEventsWindowArgs,
            CommunityEventsResponse,
        );
    }

    async getMessagesByMessageIndex(
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number | undefined,
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(
            this.db,
            chatId,
            threadRootMessageIndex,
            messageIndexes,
        );
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.getMessagesByMessageIndexFromBackend(
                chatId,
                threadRootMessageIndex,
                [...fromCache.missing],
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex));

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
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number | undefined,
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const args = {
            channel_id: toBigInt32(chatId.channelId),
            thread_root_message_index: threadRootMessageIndex,
            messages: messageIndexes,
            invite_code: this.inviteCode(chatId.communityId),
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.query(
            chatId.communityId,
            "messages_by_message_index",
            args,
            (resp) => mapResult(resp, (value) => getMessagesSuccess(value, this.principal, chatId)),
            CommunityMessagesByMessageIndexArgs,
            CommunityMessagesByMessageIndexResponse,
        );
    }

    private handleMissingEvents(
        chatId: ChannelIdentifier,
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0 || offline()) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.eventsByIndexFromBackend(
                chatId,
                [...missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex))
                .then((resp) => {
                    if (isSuccessfulEventsResponse(resp)) {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    private setCachedEvents<T extends ChatEvent>(
        chatId: ChannelIdentifier,
        resp: EventsResponse<T>,
        threadRootMessageIndex: number | undefined,
    ): EventsResponse<T> {
        setCachedEvents(this.db, chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached channel events", err),
        );
        return resp;
    }

    getInviteCode(communityId: string): Promise<InviteCodeResponse> {
        return this.query(
            communityId,
            "invite_code",
            {},
            (resp) => mapResult(resp, inviteCodeSuccess),
            TEmpty,
            CommunityInviteCodeResponse,
        );
    }

    leaveChannel(chatId: ChannelIdentifier): Promise<LeaveGroupResponse> {
        return this.update(
            chatId.communityId,
            "leave_channel",
            {
                channel_id: toBigInt32(chatId.channelId),
            },
            unitResult,
            CommunityLeaveChannelArgs,
            UnitResult,
        );
    }

    localUserIndex(communityId: string): Promise<string> {
        return this.query(
            communityId,
            "local_user_index",
            {},
            (resp) => principalBytesToString(resp.Success),
            TEmpty,
            CommunityLocalUserIndexResponse,
        );
    }

    unpinMessage(chatId: ChannelIdentifier, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.update(
            chatId.communityId,
            "unpin_message",
            {
                channel_id: toBigInt32(chatId.channelId),
                message_index: messageIndex,
            },
            (resp) => mapResult(resp, pushEventSuccess),
            CommunityPinMessageArgs,
            CommunityPinMessageResponse,
        );
    }

    pinMessage(chatId: ChannelIdentifier, messageIndex: number): Promise<PinMessageResponse> {
        return this.update(
            chatId.communityId,
            "pin_message",
            {
                channel_id: toBigInt32(chatId.channelId),
                message_index: messageIndex,
            },
            (resp) => mapResult(resp, pushEventSuccess),
            CommunityPinMessageArgs,
            CommunityPinMessageResponse,
        );
    }

    removeMember(communityId: string, userId: string): Promise<RemoveMemberResponse> {
        return this.update(
            communityId,
            "remove_member",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            CommunityRemoveMemberArgs,
            UnitResult,
        );
    }

    removeMemberFromChannel(
        chatId: ChannelIdentifier,
        userId: string,
    ): Promise<RemoveMemberResponse> {
        return this.update(
            chatId.communityId,
            "remove_member_from_channel",
            {
                channel_id: toBigInt32(chatId.channelId),
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            CommunityRemoveMemberFromChannelArgs,
            UnitResult,
        );
    }

    removeReaction(
        chatId: ChannelIdentifier,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined,
    ): Promise<AddRemoveReactionResponse> {
        return this.update(
            chatId.communityId,
            "remove_reaction",
            {
                channel_id: toBigInt32(chatId.channelId),
                message_id: messageId,
                reaction,
                thread_root_message_index: threadRootMessageIndex,
            },
            unitResult,
            CommunityRemoveReactionArgs,
            UnitResult,
        );
    }

    resetInviteCode(communityId: string): Promise<ResetInviteCodeResponse> {
        return this.update(
            communityId,
            "reset_invite_code",
            {},
            (resp) => mapResult(resp, enableOrResetInviteCodeSuccess),
            TEmpty,
            CommunityEnableInviteCodeResponse,
        );
    }

    searchChannel(
        chatId: ChannelIdentifier,
        maxResults: number,
        users: string[],
        searchTerm: string,
    ): Promise<SearchGroupChatResponse> {
        return this.query(
            chatId.communityId,
            "search_channel",
            {
                channel_id: toBigInt32(chatId.channelId),
                max_results: maxResults,
                users: users.map(principalStringToBytes),
                search_term: searchTerm,
            },
            (resp) => searchGroupChatResponse(resp, chatId),
            CommunitySearchChannelArgs,
            CommunitySearchChannelResponse,
        );
    }

    async getCommunityDetails(
        communityId: string,
        communityLastUpdated: bigint,
    ): Promise<CommunityDetailsResponse> {
        const fromCache = await getCachedCommunityDetails(this.db, communityId);
        if (fromCache != null) {
            if (fromCache.lastUpdated >= communityLastUpdated || offline()) {
                return fromCache;
            } else {
                return await this.getCommunityDetailsUpdates(communityId, fromCache);
            }
        }

        const response = await this.getCommunityDetailsFromBackend(communityId);
        if (response.kind === "success") {
            await setCachedCommunityDetails(this.db, communityId, response);
        }
        return response;
    }

    private getCommunityDetailsFromBackend(communityId: string): Promise<CommunityDetailsResponse> {
        return this.query(
            communityId,
            "selected_initial",
            {
                invite_code: this.inviteCode(communityId),
            },
            communityDetailsResponse,
            CommunitySelectedInitialArgs,
            CommunitySelectedInitialResponse,
        );
    }

    private async getCommunityDetailsUpdates(
        communityId: string,
        previous: CommunityDetails,
    ): Promise<CommunityDetails> {
        const details = await this.getCommunityDetailsUpdatesFromBackend(communityId, previous);
        if (details.lastUpdated > previous.lastUpdated) {
            await setCachedCommunityDetails(this.db, communityId, details);
        }
        return details;
    }

    private async getCommunityDetailsUpdatesFromBackend(
        communityId: string,
        previous: CommunityDetails,
    ): Promise<CommunityDetails> {
        const updatesResponse = await this.query(
            communityId,
            "selected_updates_v2",
            {
                updates_since: previous.lastUpdated,
                invite_code: this.inviteCode(communityId),
            },
            communityDetailsUpdatesResponse,
            CommunitySelectedUpdatesArgs,
            CommunitySelectedUpdatesResponse,
        );

        if (updatesResponse.kind === "failure") {
            return previous;
        }

        if (updatesResponse.kind === "success_no_updates") {
            return {
                ...previous,
                lastUpdated: updatesResponse.lastUpdated,
            };
        }

        return mergeCommunityDetails(previous, updatesResponse);
    }

    async getChannelDetails(
        chatId: ChannelIdentifier,
        chatLastUpdated: bigint,
    ): Promise<GroupChatDetailsResponse> {
        const cacheKey = `${chatId.communityId}_${chatId.channelId}`;
        const fromCache = await getCachedGroupDetails(this.db, cacheKey);
        if (fromCache !== undefined) {
            if (fromCache.timestamp >= chatLastUpdated || offline()) {
                return fromCache;
            } else {
                return this.getChannelDetailsUpdates(chatId, cacheKey, fromCache);
            }
        }

        const response = await this.getChannelDetailsFromBackend(chatId);
        if (typeof response === "object" && "members" in response) {
            await setCachedGroupDetails(this.db, cacheKey, response);
        }
        return response;
    }

    private getChannelDetailsFromBackend(
        chatId: ChannelIdentifier,
    ): Promise<GroupChatDetailsResponse> {
        return this.query(
            chatId.communityId,
            "selected_channel_initial",
            {
                channel_id: toBigInt32(chatId.channelId),
            },
            (resp) =>
                mapResult(resp, (value) =>
                    groupDetailsSuccess(
                        value,
                        this.config.blobUrlPattern,
                        chatId.communityId,
                        chatId.channelId,
                    ),
                ),
            CommunitySelectedChannelInitialArgs,
            CommunitySelectedChannelInitialResponse,
        );
    }

    private async getChannelDetailsUpdates(
        chatId: ChannelIdentifier,
        cacheKey: string,
        previous: GroupChatDetails,
    ): Promise<GroupChatDetails> {
        const response = await this.getChannelDetailsUpdatesFromBackend(chatId, previous);
        if (response.timestamp > previous.timestamp) {
            await setCachedGroupDetails(this.db, cacheKey, response);
        }
        return response;
    }

    private async getChannelDetailsUpdatesFromBackend(
        chatId: ChannelIdentifier,
        previous: GroupChatDetails,
    ): Promise<GroupChatDetails> {
        const updatesResponse = await this.query(
            chatId.communityId,
            "selected_channel_updates_v2",
            {
                channel_id: toBigInt32(chatId.channelId),
                updates_since: previous.timestamp,
            },
            (value) =>
                groupDetailsUpdatesResponse(
                    value,
                    this.config.blobUrlPattern,
                    chatId.communityId,
                    chatId.channelId,
                ),
            CommunitySelectedChannelUpdatesArgs,
            CommunitySelectedChannelUpdatesResponse,
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

    sendMessage(
        chatId: ChannelIdentifier,
        senderName: string,
        senderDisplayName: string | undefined,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        communityRulesAccepted: number | undefined,
        channelRulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        newAchievement: boolean,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = new DataClient(this.identity, this.agent, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [chatId.communityId])
            : dataClient.uploadData(event.event.content, [chatId.communityId]);

        return uploadContentPromise.then((content) => {
            const newEvent =
                content !== undefined ? { ...event, event: { ...event.event, content } } : event;
            const args = {
                channel_id: toBigInt32(chatId.channelId),
                content: apiMessageContent(newEvent.event.content),
                message_id: newEvent.event.messageId,
                sender_name: senderName,
                sender_display_name: senderDisplayName,
                community_rules_accepted: communityRulesAccepted,
                channel_rules_accepted: channelRulesAccepted,
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
                chatId.communityId,
                "send_message",
                args,
                (resp) => mapResult(resp, sendMessageSuccess),
                CommunitySendMessageArgs,
                CommunitySendMessageResponse,
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

    registerPollVote(
        chatId: ChannelIdentifier,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<RegisterPollVoteResponse> {
        return this.update(
            chatId.communityId,
            "register_poll_vote",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                poll_option: answerIdx,
                operation: voteType === "register" ? "RegisterVote" : "DeleteVote",
                message_index: messageIdx,
                new_achievement: newAchievement,
            },
            unitResult,
            CommunityRegisterPollVoteArgs,
            CommunityRegisterPollVoteResponse,
        );
    }

    channelSummary(chatId: ChannelIdentifier): Promise<ChannelSummaryResponse> {
        return this.query(
            chatId.communityId,
            "channel_summary",
            {
                channel_id: toBigInt32(chatId.channelId),
                invite_code: this.inviteCode(chatId.communityId),
            },
            (resp) => communityChannelSummaryResponse(resp, chatId.communityId),
            CommunityChannelSummaryArgs,
            CommunityChannelSummaryResponse,
        ).catch((err) => {
            if (err instanceof DestinationInvalidError) {
                return { kind: "canister_not_found" };
            } else {
                throw err;
            }
        });
    }

    importGroup(communityId: string, id: GroupChatIdentifier): Promise<ImportGroupResponse> {
        return this.update(
            communityId,
            "import_group",
            {
                group_id: principalStringToBytes(id.groupId),
            },
            (resp) => mapResult(resp, (value) => importGroupSuccess(value, communityId)),
            CommunityImportGroupArgs,
            CommunityImportGroupResponse,
        );
    }

    summary(communityId: string): Promise<CommunitySummaryResponse> {
        return this.query(
            communityId,
            "summary",
            {
                invite_code: this.inviteCode(communityId),
            },
            summaryResponse,
            CommunitySummaryArgs,
            TCommunitySummaryResponse,
        );
    }

    exploreChannels(
        communityId: string,
        searchTerm: string | undefined,
        pageSize: number,
        pageIndex: number,
    ): Promise<ExploreChannelsResponse> {
        return this.query(
            communityId,
            "explore_channels",
            {
                page_size: pageSize,
                page_index: pageIndex,
                search_term: searchTerm,
                invite_code: this.inviteCode(communityId),
            },
            (resp) => exploreChannelsResponse(resp, communityId),
            CommunityExploreChannelsArgs,
            CommunityExploreChannelsResponse,
        );
    }

    summaryUpdates(
        communityId: string,
        updatesSince: bigint,
    ): Promise<CommunitySummaryUpdatesResponse> {
        return this.query(
            communityId,
            "summary_updates",
            {
                updates_since: updatesSince,
                invite_code: this.inviteCode(communityId),
            },
            summaryUpdatesResponse,
            CommunitySummaryUpdatesArgs,
            TCommunitySummaryUpdatesResponse,
        );
    }

    toggleMuteChannelNotifications(
        chatId: CommunityIdentifier | ChannelIdentifier,
        mute: boolean | undefined,
        muteAtEveryone: boolean | undefined,
    ): Promise<ToggleMuteNotificationResponse> {
        return this.update(
            chatId.communityId,
            "toggle_mute_notifications",
            {
                channel_id: chatId.kind === "channel" ? toBigInt32(chatId.channelId) : undefined,
                mute,
                mute_at_everyone: muteAtEveryone,
            },
            unitResult,
            CommunityToggleMuteNotificationsArgs,
            UnitResult,
        );
    }

    unblockUser(communityId: string, userId: string): Promise<UnblockCommunityUserResponse> {
        return this.update(
            communityId,
            "unblock_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            CommunityUnblockUserArgs,
            UnitResult,
        );
    }

    undeleteMessage(
        chatId: ChannelIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.update(
            chatId.communityId,
            "undelete_messages",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
            },
            (resp) => mapResult(resp, undeleteMessageSuccess),
            CommunityUndeleteMessagesArgs,
            CommunityUndeleteMessagesResponse,
        );
    }

    threadPreviews(
        chatId: ChannelIdentifier,
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined,
    ): Promise<ThreadPreviewsResponse> {
        return this.query(
            chatId.communityId,
            "thread_previews",
            {
                channel_id: toBigInt32(chatId.channelId),
                threads: threadRootMessageIndexes,
                latest_client_thread_update: latestClientThreadUpdate,
            },
            (resp) => mapResult(resp, (value) => threadPreviewsSuccess(value, chatId)),
            CommunityThreadPreviewsArgs,
            CommunityThreadPreviewsResponse,
        );
    }

    registerProposalVote(
        chatId: ChannelIdentifier,
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.update(
            chatId.communityId,
            "register_proposal_vote",
            {
                channel_id: toBigInt32(chatId.channelId),
                adopt,
                message_index: messageIdx,
            },
            unitResult,
            CommunityRegisterProposalVoteArgs,
            UnitResult,
        );
    }

    updateChannel(
        chatId: ChannelIdentifier,
        name?: string,
        description?: string,
        rules?: UpdatedRules,
        permissions?: OptionalChatPermissions,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>,
        gateConfig?: AccessGateConfig,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
        externalUrl?: string,
    ): Promise<UpdateGroupResponse> {
        return this.update(
            chatId.communityId,
            "update_channel",
            {
                channel_id: toBigInt32(chatId.channelId),
                name: name,
                description,
                external_url: externalUrl === undefined ? "NoChange" : { SetToSome: externalUrl },
                permissions_v2: mapOptional(permissions, apiOptionalGroupPermissions),
                rules: mapOptional(rules, apiUpdatedRules),
                public: isPublic,
                events_ttl: apiOptionUpdateV2(identity, eventsTimeToLiveMs),
                gate_config:
                    gateConfig === undefined
                        ? "NoChange"
                        : gateConfig.gate.kind === "no_gate"
                        ? "SetToNone"
                        : {
                              SetToSome: apiAccessGateConfig(gateConfig),
                          },
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
                messages_visible_to_non_members: messagesVisibleToNonMembers,
            },
            (resp) => mapResult(resp, updateGroupSuccess),
            CommunityUpdateChannelArgs,
            CommunityUpdateChannelResponse,
        );
    }

    updateCommunity(
        communityId: string,
        name?: string,
        description?: string,
        rules?: UpdatedRules,
        permissions?: Partial<CommunityPermissions>,
        avatar?: Uint8Array,
        banner?: Uint8Array,
        gateConfig?: AccessGateConfig,
        isPublic?: boolean,
        primaryLanguage?: string,
    ): Promise<UpdateCommunityResponse> {
        return this.update(
            communityId,
            "update_community",
            {
                name,
                description,
                permissions: mapOptional(permissions, apiOptionalCommunityPermissions),
                rules: mapOptional(rules, apiUpdatedRules),
                public: isPublic,
                primary_language: primaryLanguage,
                gate_config:
                    gateConfig === undefined
                        ? "NoChange"
                        : gateConfig.gate.kind === "no_gate"
                        ? "SetToNone"
                        : {
                              SetToSome: apiAccessGateConfig(gateConfig),
                          },
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
                banner:
                    banner === undefined
                        ? "NoChange"
                        : {
                              SetToSome: {
                                  id: BigInt(random32()),
                                  mime_type: "image/jpg",
                                  data: banner,
                              },
                          },
            },
            (resp) => mapResult(resp, updateCommunitySuccess),
            CommunityUpdateCommunityArgs,
            CommunityUpdateCommunityResponse,
        );
    }

    createUserGroup(
        communityId: string,
        name: string,
        users: string[],
    ): Promise<CreateUserGroupResponse> {
        return this.update(
            communityId,
            "create_user_group",
            {
                name,
                user_ids: users.map(principalStringToBytes),
            },
            (resp) => mapResult(resp, createUserGroupSuccess),
            CommunityCreateUserGroupArgs,
            CommunityCreateUserGroupResponse,
        );
    }

    updateUserGroup(
        communityId: string,
        userGroupId: number,
        name: string | undefined,
        usersToAdd: string[],
        usersToRemove: string[],
    ): Promise<UpdateUserGroupResponse> {
        return this.update(
            communityId,
            "update_user_group",
            {
                user_group_id: userGroupId,
                name,
                users_to_add: usersToAdd.map(principalStringToBytes),
                users_to_remove: usersToRemove.map(principalStringToBytes),
            },
            unitResult,
            CommunityUpdateUserGroupArgs,
            UnitResult,
        );
    }

    setMemberDisplayName(
        communityId: string,
        displayName: string | undefined,
        newAchievement: boolean,
    ): Promise<SetMemberDisplayNameResponse> {
        return this.update(
            communityId,
            "set_member_display_name",
            {
                display_name: displayName,
                new_achievement: newAchievement,
            },
            unitResult,
            CommunitySetMemberDisplayNameArgs,
            UnitResult,
        );
    }

    deleteUserGroups(
        communityId: string,
        userGroupIds: number[],
    ): Promise<DeleteUserGroupsResponse> {
        return this.update(
            communityId,
            "delete_user_groups",
            {
                user_group_ids: userGroupIds,
            },
            unitResult,
            CommunityDeleteUserGroupsArgs,
            UnitResult,
        );
    }

    followThread(
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number,
        follow: boolean,
        newAchievement: boolean,
    ): Promise<FollowThreadResponse> {
        const args = {
            channel_id: toBigInt32(chatId.channelId),
            thread_root_message_index: threadRootMessageIndex,
            new_achievement: newAchievement,
        };
        return this.update(
            chatId.communityId,
            follow ? "follow_thread" : "unfollow_thread",
            args,
            unitResult,
            CommunityFollowThreadArgs,
            UnitResult,
        );
    }

    reportMessage(
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.update(
            chatId.communityId,
            "report_message",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                delete: deleteMessage,
            },
            (resp) => resp === "Success",
            CommunityReportMessageArgs,
            UnitResult,
        );
    }

    acceptP2PSwap(
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
    ): Promise<AcceptP2PSwapResponse> {
        return this.update(
            chatId.communityId,
            "accept_p2p_swap",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                pin,
                new_achievement: newAchievement,
            },
            (resp) => mapResult(resp, acceptP2PSwapSuccess),
            CommunityAcceptP2pSwapArgs,
            CommunityAcceptP2pSwapResponse,
        );
    }

    cancelP2PSwap(
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        return this.update(
            chatId.communityId,
            "cancel_p2p_swap",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
            },
            unitResult,
            CommunityCancelP2pSwapArgs,
            UnitResult,
        );
    }

    joinVideoCall(
        chatId: ChannelIdentifier,
        messageId: bigint,
        newAchievement: boolean,
    ): Promise<JoinVideoCallResponse> {
        return this.update(
            chatId.communityId,
            "join_video_call",
            {
                message_id: messageId,
                channel_id: toBigInt32(chatId.channelId),
                new_achievement: newAchievement,
            },
            unitResult,
            CommunityJoinVideoCallArgs,
            UnitResult,
        );
    }

    setVideoCallPresence(
        chatId: ChannelIdentifier,
        messageId: bigint,
        presence: VideoCallPresence,
        newAchievement: boolean,
    ): Promise<SetVideoCallPresenceResponse> {
        return this.update(
            chatId.communityId,
            "set_video_call_presence",
            {
                channel_id: toBigInt32(chatId.channelId),
                message_id: messageId,
                presence: apiVideoCallPresence(presence),
                new_achievement: newAchievement,
            },
            unitResult,
            CommunitySetVideoCallPresenceArgs,
            UnitResult,
        );
    }

    videoCallParticipants(
        chatId: ChannelIdentifier,
        messageId: bigint,
        updatesSince?: bigint,
    ): Promise<VideoCallParticipantsResponse> {
        return this.query(
            chatId.communityId,
            "video_call_participants",
            {
                channel_id: toBigInt32(chatId.channelId),
                message_id: messageId,
                updated_since: updatesSince,
            },
            (resp) => mapResult(resp, videoCallParticipantsSuccess),
            CommunityVideoCallParticipantsArgs,
            CommunityVideoCallParticipantsResponse,
        );
    }

    cancelInvites(
        chatId: CommunityIdentifier | ChannelIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        return this.update(
            chatId.communityId,
            "cancel_invites",
            {
                channel_id: chatId.kind === "channel" ? toBigInt32(chatId.channelId) : undefined,
                user_ids: userIds.map(principalStringToBytes),
            },
            (resp) => resp === "Success",
            CommunityCancelInvitesArgs,
            UnitResult,
        );
    }

    updateInstalledBot(
        communityId: string,
        botId: string,
        grantedPermissions: GrantedBotPermissions,
    ): Promise<boolean> {
        return this.update(
            communityId,
            "update_bot",
            {
                bot_id: principalStringToBytes(botId),
                granted_permissions: apiExternalBotPermissions(grantedPermissions.command),
                granted_autonomous_permissions: mapOptional(
                    grantedPermissions.autonomous,
                    apiExternalBotPermissions,
                ),
            },
            (resp) => resp === "Success",
            CommunityUpdateBotArgs,
            UnitResult,
        );
    }

    registerWebhook(
        chatId: ChannelIdentifier,
        name: string,
        avatar: string | undefined,
    ): Promise<FullWebhookDetails | undefined> {
        return this.update(
            chatId.communityId,
            "register_webhook",
            {
                channel_id: toBigInt32(chatId.channelId),
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
                        chatId.communityId,
                        chatId.channelId,
                    );

                    return {
                        ...result,
                        secret: resp.Success.secret,
                    };
                }
                return undefined;
            },
            CommunityRegisterWebhookArgs,
            CommunityRegisterWebhookResponse,
        );
    }

    updateWebhook(
        chatId: ChannelIdentifier,
        id: string,
        name: string | undefined,
        avatar: OptionUpdate<string>,
    ): Promise<boolean> {
        return this.update(
            chatId.communityId,
            "update_webhook",
            {
                channel_id: toBigInt32(chatId.channelId),
                id: principalStringToBytes(id),
                name,
                avatar: apiOptionUpdateV2(identity, avatar),
            },
            isSuccess,
            CommunityUpdateWebhookArgs,
            UnitResult,
        );
    }

    regenerateWebhook(chatId: ChannelIdentifier, id: string): Promise<string | undefined> {
        return this.update(
            chatId.communityId,
            "regenerate_webhook",
            {
                channel_id: toBigInt32(chatId.channelId),
                id: principalStringToBytes(id),
            },
            (resp) => {
                return typeof resp === "object" && "Success" in resp
                    ? resp.Success.secret
                    : undefined;
            },
            CommunityRegenerateWebhookArgs,
            CommunityRegenerateWebhookResponse,
        );
    }

    deleteWebhook(chatId: ChannelIdentifier, id: string): Promise<boolean> {
        return this.update(
            chatId.communityId,
            "delete_webhook",
            {
                channel_id: toBigInt32(chatId.channelId),
                id: principalStringToBytes(id),
            },
            isSuccess,
            CommunityDeleteWebhookArgs,
            UnitResult,
        );
    }

    getWebhook(chatId: ChannelIdentifier, id: string): Promise<string | undefined> {
        return this.query(
            chatId.communityId,
            "webhook",
            {
                channel_id: toBigInt32(chatId.channelId),
                id: principalStringToBytes(id),
            },
            (resp) => {
                if (typeof resp === "object" && "Success" in resp) {
                    return resp.Success.secret;
                }
                console.log("Failed to get community webhook: ", id, resp);
                return undefined;
            },
            CommunityWebhookArgs,
            CommunityWebhookResponse,
        );
    }

    activeProposalTallies(chatId: ChannelIdentifier): Promise<[number, Tally][] | OCError> {
        return this.query(
            chatId.communityId,
            "active_proposal_tallies",
            {
                channel_id: toBigInt32(chatId.channelId),
                invite_code: this.inviteCode(chatId.communityId),
            },
            (resp) => mapResult(resp, (value) => proposalTallies(value.tallies)),
            CommunityActiveProposalTalliesArgs,
            ActiveProposalTalliesResponse,
        );
    }
}
