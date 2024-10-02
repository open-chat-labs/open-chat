/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type CommunityService } from "./candid/idl";
import { CandidService } from "../candidService";
import { apiOptionUpdate, identity, mapOptional } from "../../utils/mapping";
import type { AgentConfig } from "../../config";
import {
    addMembersToChannelResponse,
    blockUserResponse,
    messagesByMessageIndexResponse,
    removeMemberResponse,
    removeMemberFromChannelResponse,
    summaryResponse,
    summaryUpdatesResponse,
    toggleMuteNotificationsResponse,
    unblockUserResponse,
    updateCommunityResponse,
    apiMemberRole,
    apiCommunityRole,
    apiOptionalCommunityPermissions,
    exploreChannelsResponse,
    communityDetailsResponse,
    communityDetailsUpdatesResponse,
    changeRoleResponse,
    communityChannelSummaryResponse,
    importGroupResponse,
    createUserGroupResponse,
    updateUserGroupResponse,
    deleteUserGroupsResponse,
    setMemberDisplayNameResponse,
    followThreadResponse,
    reportMessageResponse,
} from "./mappers";
import { sendMessageResponse as sendMessageResponseV2 } from "./mappersV2";
import { Principal } from "@dfinity/principal";
import {
    apiGroupPermissions,
    apiMaybeAccessGate,
    apiOptional,
    apiMessageContent,
    apiAccessGate,
    addRemoveReactionResponse,
    pinMessageResponse,
    updateGroupResponse,
    createGroupResponse,
    declineInvitationResponse,
    deleteMessageResponse,
    editMessageResponse,
    inviteCodeResponse,
    deleteGroupResponse,
    unpinMessageResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    leaveGroupResponse,
    deletedMessageResponse,
    undeleteMessageResponse,
    threadPreviewsResponse,
    changeRoleResponse as changeChannelRoleResponse,
    registerPollVoteResponse,
    searchGroupChatResponse,
    disableInviteCodeResponse,
    enableInviteCodeResponse,
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
import type {
    AccessGate,
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    CandidateChannel,
    ChangeCommunityRoleResponse,
    CommunityPermissions,
    EventWrapper,
    EventsResponse,
    MemberRole,
    Message,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UpdateCommunityResponse,
    User,
    ChannelIdentifier,
    AddRemoveReactionResponse,
    CommunitySummaryResponse,
    CommunitySummaryUpdatesResponse,
    SendMessageResponse,
    UpdateGroupResponse,
    CreateGroupResponse,
    DeleteGroupResponse,
    PinMessageResponse,
    UnpinMessageResponse,
    GroupChatDetailsResponse,
    GroupChatDetails,
    IndexRange,
    ChatEvent,
    EventsSuccessResult,
    EditMessageResponse,
    DeclineInvitationResponse,
    CommunityIdentifier,
    CommunityDetailsResponse,
    CommunityDetails,
    LeaveGroupResponse,
    DeleteMessageResponse,
    DeletedGroupMessageResponse,
    UndeleteMessageResponse,
    ThreadPreviewsResponse,
    ChangeRoleResponse,
    ChannelSummaryResponse,
    RegisterPollVoteResponse,
    ToggleMuteNotificationResponse,
    ExploreChannelsResponse,
    GroupChatIdentifier,
    ImportGroupResponse,
    RemoveMemberResponse,
    SearchGroupChatResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    RegisterProposalVoteResponse,
    CreateUserGroupResponse,
    UpdateUserGroupResponse,
    DeleteUserGroupsResponse,
    SetMemberDisplayNameResponse,
    UpdatedRules,
    FollowThreadResponse,
    OptionUpdate,
    ClaimPrizeResponse,
    OptionalChatPermissions,
    AcceptP2PSwapResponse,
    JoinVideoCallResponse,
    VideoCallPresence,
    SetVideoCallPresenceResponse,
    VideoCallParticipantsResponse,
} from "openchat-shared";
import {
    textToCode,
    DestinationInvalidError,
    offline,
    MAX_EVENTS,
    MAX_MESSAGES,
    MAX_MISSING,
    ResponseTooLargeError,
} from "openchat-shared";
import {
    apiOptionalGroupPermissions,
    apiUpdatedRules,
    getMessagesByMessageIndexResponse,
} from "../group/mappers";
import { DataClient } from "../data/data.client";
import { getEventsResponse } from "../group/mappers";
import {
    type Database,
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
} from "../../utils/caching";
import { mergeCommunityDetails, mergeGroupChatDetails } from "../../utils/chat";
import { muteNotificationsResponse } from "../notifications/mappers";
import type { CancelP2PSwapResponse } from "openchat-shared";
import {
    chunkedChatEventsFromBackend,
    chunkedChatEventsWindowFromBackend,
} from "../common/chunked";
import { CommunitySendMessageArgs, CommunitySendMessageResponse } from "../../typebox";

export class CommunityClient extends CandidService {
    private service: CommunityService;

    constructor(
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private communityId: string,
        private db: Database,
        private inviteCode: string | undefined,
    ) {
        super(identity, agent, communityId);

        this.service = this.createServiceClient<CommunityService>(idlFactory);
    }

    claimPrize(channelId: string, messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.handleResponse(
            this.service.claim_prize({
                channel_id: BigInt(channelId),
                message_id: messageId,
            }),
            claimPrizeResponse,
        );
    }

    addMembersToChannel(
        chatId: ChannelIdentifier,
        userIds: string[],
        username: string,
        displayName: string | undefined,
    ): Promise<AddMembersToChannelResponse> {
        return this.handleResponse(
            this.service.add_members_to_channel({
                channel_id: BigInt(chatId.channelId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
                added_by_name: username,
                added_by_display_name: apiOptional(identity, displayName),
            }),
            addMembersToChannelResponse,
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
        return this.handleResponse(
            this.service.add_reaction({
                channel_id: BigInt(chatId.channelId),
                username,
                display_name: apiOptional(identity, displayName),
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                reaction,
                new_achievement: newAchievement,
            }),
            addRemoveReactionResponse,
        );
    }

    blockUser(userId: string): Promise<BlockCommunityUserResponse> {
        return this.handleResponse(
            this.service.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockUserResponse,
        );
    }

    changeChannelRole(
        chatId: ChannelIdentifier,
        userId: string,
        newRole: MemberRole,
    ): Promise<ChangeRoleResponse> {
        return this.handleResponse(
            this.service.change_channel_role({
                channel_id: BigInt(chatId.channelId),
                user_id: Principal.fromText(userId),
                new_role: apiMemberRole(newRole),
            }),
            changeChannelRoleResponse,
        );
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeCommunityRoleResponse> {
        return this.handleResponse(
            this.service.change_role({
                user_id: Principal.fromText(userId),
                new_role: apiCommunityRole(newRole),
            }),
            changeRoleResponse,
        );
    }

    createChannel(channel: CandidateChannel): Promise<CreateGroupResponse> {
        return this.handleResponse(
            this.service.create_channel({
                is_public: channel.public,
                name: channel.name,
                subtype: [],
                events_ttl: apiOptional(identity, channel.eventsTTL),
                description: channel.description,
                external_url: apiOptional(identity, channel.externalUrl),
                history_visible_to_new_joiners: channel.historyVisible,
                avatar: apiOptional(
                    (data) => {
                        return {
                            id: DataClient.newBlobId(),
                            data,
                            mime_type: "image/jpg",
                        };
                    },
                    channel.avatar?.blobData,
                ),
                permissions_v2: [apiGroupPermissions(channel.permissions)],
                rules: channel.rules,
                gate: apiMaybeAccessGate(channel.gate),
                messages_visible_to_non_members: apiOptional(
                    identity,
                    channel.messagesVisibleToNonMembers,
                ),
            }),
            (resp) => createGroupResponse(resp, channel.id),
        );
    }

    declineInvitation(chatId: ChannelIdentifier): Promise<DeclineInvitationResponse> {
        return this.handleResponse(
            this.service.decline_invitation({
                channel_id: [BigInt(chatId.channelId)],
            }),
            declineInvitationResponse,
        );
    }

    deleteChannel(chatId: ChannelIdentifier): Promise<DeleteGroupResponse> {
        return this.handleResponse(
            this.service.delete_channel({
                channel_id: BigInt(chatId.channelId),
            }),
            deleteGroupResponse,
        );
    }

    getDeletedMessage(
        chatId: ChannelIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        return this.handleResponse(
            this.service.deleted_message({
                channel_id: BigInt(chatId.channelId),
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            deletedMessageResponse,
        );
    }

    deleteMessages(
        chatId: ChannelIdentifier,
        messageIds: bigint[],
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.service.delete_messages({
                channel_id: BigInt(chatId.channelId),
                message_ids: messageIds,
                as_platform_moderator: apiOptional(identity, asPlatformModerator),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                new_achievement: newAchievement,
            }),
            deleteMessageResponse,
        );
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.handleResponse(this.service.disable_invite_code({}), disableInviteCodeResponse);
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
                return this.handleResponse(
                    this.service.edit_message({
                        channel_id: BigInt(chatId.channelId),
                        thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                        content: apiMessageContent(content ?? message.content),
                        message_id: message.messageId,
                        block_level_markdown:
                            blockLevelMarkdown === undefined ? [] : [blockLevelMarkdown],
                        new_achievement: newAchievement,
                    }),
                    editMessageResponse,
                );
            });
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.handleResponse(this.service.enable_invite_code({}), enableInviteCodeResponse);
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
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            start_index: startIndex,
            ascending: ascending,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.service.events(args),
            (res) => {
                return getEventsResponse(this.principal, res, chatId, latestKnownUpdate);
            },
        );
    }

    eventsByIndex(
        chatId: ChannelIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return getCachedEventsByIndex(this.db, eventIndexes, {
            chatId,
            threadRootMessageIndex,
        }).then((res) =>
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
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.service.events_by_index(args),
            (res) => {
                return getEventsResponse(this.principal, res, chatId, latestKnownUpdate);
            },
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
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.service.events_window(args),
            (res) => getEventsResponse(this.principal, res, chatId, latestKnownUpdate),
        );
    }

    async getMessagesByMessageIndex(
        chatId: ChannelIdentifier,
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.getMessagesByMessageIndexFromBackend(
                chatId,
                fromCache.missing,
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(chatId, resp));

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
        chatId: ChannelIdentifier,
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const thread_root_message_index: [] = [];
        const args = {
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index,
            messages: new Uint32Array(messageIndexes),
            invite_code: apiOptional(textToCode, this.inviteCode),
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.service.messages_by_message_index(args),
            (resp) =>
                getMessagesByMessageIndexResponse(this.principal, resp, chatId, latestKnownUpdate),
            args,
        );
    }

    private handleMissingEvents(
        chatId: ChannelIdentifier,
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0) {
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
                    if (resp !== "events_failed") {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    private setCachedEvents<T extends ChatEvent>(
        chatId: ChannelIdentifier,
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number,
    ): EventsResponse<T> {
        setCachedEvents(this.db, chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached channel events", err),
        );
        return resp;
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.handleResponse(this.service.invite_code({}), inviteCodeResponse);
    }

    leaveChannel(chatId: ChannelIdentifier): Promise<LeaveGroupResponse> {
        return this.handleResponse(
            this.service.leave_channel({
                channel_id: BigInt(chatId.channelId),
            }),
            leaveGroupResponse,
        );
    }

    localUserIndex(): Promise<string> {
        return this.handleResponse(this.service.local_user_index({}), (resp) =>
            resp.Success.toString(),
        );
    }

    messagesByMessageIndex(
        chatId: ChannelIdentifier,
        messageIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const args = {
            channel_id: BigInt(chatId.channelId),
            messages: messageIndexes,
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.service.messages_by_message_index(args),
            (res) => messagesByMessageIndexResponse(this.principal, res, chatId, latestKnownUpdate),
        );
    }

    unpinMessage(chatId: ChannelIdentifier, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.service.unpin_message({
                channel_id: BigInt(chatId.channelId),
                message_index: messageIndex,
            }),
            unpinMessageResponse,
        );
    }

    pinMessage(chatId: ChannelIdentifier, messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.service.pin_message({
                channel_id: BigInt(chatId.channelId),
                message_index: messageIndex,
            }),
            pinMessageResponse,
        );
    }

    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.handleResponse(
            this.service.remove_member({
                user_id: Principal.fromText(userId),
            }),
            removeMemberResponse,
        );
    }

    removeMemberFromChannel(
        chatId: ChannelIdentifier,
        userId: string,
    ): Promise<RemoveMemberResponse> {
        return this.handleResponse(
            this.service.remove_member_from_channel({
                channel_id: BigInt(chatId.channelId),
                user_id: Principal.fromText(userId),
            }),
            removeMemberFromChannelResponse,
        );
    }

    removeReaction(
        chatId: ChannelIdentifier,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined,
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.service.remove_reaction({
                channel_id: BigInt(chatId.channelId),
                message_id: messageId,
                reaction,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            addRemoveReactionResponse,
        );
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.handleResponse(this.service.reset_invite_code({}), enableInviteCodeResponse);
    }

    searchChannel(
        chatId: ChannelIdentifier,
        maxResults: number,
        users: string[],
        searchTerm: string,
    ): Promise<SearchGroupChatResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.search_channel({
                    channel_id: BigInt(chatId.channelId),
                    max_results: maxResults,
                    users: users.length > 0 ? [users.map((u) => Principal.fromText(u))] : [],
                    search_term: searchTerm,
                }),
            (resp) => searchGroupChatResponse(resp, chatId),
        );
    }

    async getCommunityDetails(
        id: CommunityIdentifier,
        communityLastUpdated: bigint,
    ): Promise<CommunityDetailsResponse> {
        const fromCache = await getCachedCommunityDetails(this.db, id.communityId);
        if (fromCache !== undefined) {
            if (fromCache.lastUpdated >= communityLastUpdated || offline()) {
                return fromCache;
            } else {
                return this.getCommunityDetailsUpdates(id, fromCache);
            }
        }

        const response = await this.getCommunityDetailsFromBackend();
        if (response !== "failure") {
            await setCachedCommunityDetails(this.db, id.communityId, response);
        }
        return response;
    }

    private getCommunityDetailsFromBackend(): Promise<CommunityDetailsResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.selected_initial({
                    invite_code: apiOptional(textToCode, this.inviteCode),
                }),
            communityDetailsResponse,
        );
    }

    private async getCommunityDetailsUpdates(
        id: CommunityIdentifier,
        previous: CommunityDetails,
    ): Promise<CommunityDetails> {
        const response = await this.getCommunityDetailsUpdatesFromBackend(previous);
        if (response.lastUpdated > previous.lastUpdated) {
            await setCachedCommunityDetails(this.db, id.communityId, response);
        }
        return response;
    }

    private async getCommunityDetailsUpdatesFromBackend(
        previous: CommunityDetails,
    ): Promise<CommunityDetails> {
        const updatesResponse = await this.handleQueryResponse(
            () =>
                this.service.selected_updates_v2({
                    updates_since: previous.lastUpdated,
                    invite_code: apiOptional(textToCode, this.inviteCode),
                }),
            communityDetailsUpdatesResponse,
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
        if (response !== "failure") {
            await setCachedGroupDetails(this.db, cacheKey, response);
        }
        return response;
    }

    private getChannelDetailsFromBackend(
        chatId: ChannelIdentifier,
    ): Promise<GroupChatDetailsResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.selected_channel_initial({
                    channel_id: BigInt(chatId.channelId),
                }),
            groupDetailsResponse,
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
        const updatesResponse = await this.handleQueryResponse(
            () =>
                this.service.selected_channel_updates_v2({
                    channel_id: BigInt(chatId.channelId),
                    updates_since: previous.timestamp,
                }),
            groupDetailsUpdatesResponse,
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
            const newContent = content ?? event.event.content;
            const args = {
                channel_id: BigInt(chatId.channelId),
                content: apiMessageContentV2(newContent),
                message_id: event.event.messageId,
                sender_name: senderName,
                sender_display_name: senderDisplayName,
                community_rules_accepted: communityRulesAccepted,
                channel_rules_accepted: channelRulesAccepted,
                replies_to: mapOptional(event.event.repliesTo, (replyContext) => ({
                    event_index: replyContext.eventIndex,
                })),
                mentioned: mentioned.map(apiUserV2),
                forwarding: event.event.forwarded,
                thread_root_message_index: threadRootMessageIndex,
                message_filter_failed: messageFilterFailed,
                block_level_markdown: event.event.blockLevelMarkdown,
                new_achievement: newAchievement,
            };
            return this.executeMsgpackUpdate(
                "send_message",
                args,
                sendMessageResponseV2,
                CommunitySendMessageArgs,
                CommunitySendMessageResponse,
                onRequestAccepted,
            )
                .then((resp) => {
                    const retVal: [SendMessageResponse, Message] = [
                        resp,
                        { ...event.event, content: newContent },
                    ];
                    setCachedMessageFromSendResponse(
                        this.db,
                        chatId,
                        event,
                        threadRootMessageIndex,
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, chatId, event, threadRootMessageIndex);
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
        return this.handleResponse(
            this.service.register_poll_vote({
                channel_id: BigInt(chatId.channelId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
                new_achievement: newAchievement,
            }),
            registerPollVoteResponse,
        );
    }

    channelSummary(chatId: ChannelIdentifier): Promise<ChannelSummaryResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.channel_summary({
                    channel_id: BigInt(chatId.channelId),
                    invite_code: apiOptional(textToCode, this.inviteCode),
                }),
            (resp) => communityChannelSummaryResponse(resp, this.communityId),
        ).catch((err) => {
            if (err instanceof DestinationInvalidError) {
                return { kind: "canister_not_found" };
            } else {
                throw err;
            }
        });
    }

    importGroup(id: GroupChatIdentifier): Promise<ImportGroupResponse> {
        return this.handleResponse(
            this.service.import_group({
                group_id: Principal.fromText(id.groupId),
            }),
            (resp) => importGroupResponse(this.communityId, resp),
        );
    }

    summary(): Promise<CommunitySummaryResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.summary({
                    invite_code: apiOptional(textToCode, this.inviteCode),
                }),
            summaryResponse,
        );
    }

    exploreChannels(
        searchTerm: string | undefined,
        pageSize: number,
        pageIndex: number,
    ): Promise<ExploreChannelsResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.explore_channels({
                    page_size: pageSize,
                    page_index: pageIndex,
                    search_term: apiOptional(identity, searchTerm),
                    invite_code: apiOptional(textToCode, this.inviteCode),
                }),
            (resp) => exploreChannelsResponse(resp, this.communityId),
        );
    }

    summaryUpdates(updatesSince: bigint): Promise<CommunitySummaryUpdatesResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.summary_updates({
                    updates_since: updatesSince,
                    invite_code: apiOptional(textToCode, this.inviteCode),
                }),
            summaryUpdatesResponse,
        );
    }

    toggleMuteChannelNotifications(
        chatId: ChannelIdentifier | undefined,
        mute: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        return this.handleResponse(
            this.service.toggle_mute_notifications({
                channel_id: chatId ? [BigInt(chatId.channelId)] : [],
                mute,
            }),
            muteNotificationsResponse,
        );
    }

    toggleMuteNotifications(mute: boolean): Promise<ToggleMuteCommunityNotificationsResponse> {
        return this.handleResponse(
            this.service.toggle_mute_notifications({
                channel_id: [],
                mute,
            }),
            toggleMuteNotificationsResponse,
        );
    }

    unblockUser(userId: string): Promise<UnblockCommunityUserResponse> {
        return this.handleResponse(
            this.service.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockUserResponse,
        );
    }

    undeleteMessage(
        chatId: ChannelIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.handleResponse(
            this.service.undelete_messages({
                channel_id: BigInt(chatId.channelId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
            }),
            undeleteMessageResponse,
        );
    }

    threadPreviews(
        chatId: ChannelIdentifier,
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined,
    ): Promise<ThreadPreviewsResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.thread_previews({
                    channel_id: BigInt(chatId.channelId),
                    threads: new Uint32Array(threadRootMessageIndexes),
                    latest_client_thread_update: apiOptional(identity, latestClientThreadUpdate),
                }),
            (resp) => threadPreviewsResponse(resp, chatId, latestClientThreadUpdate),
        );
    }

    registerProposalVote(
        channelId: string,
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.service.register_proposal_vote({
                channel_id: BigInt(channelId),
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse,
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
        gate?: AccessGate,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
        externalUrl?: string,
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.service.update_channel({
                channel_id: BigInt(chatId.channelId),
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                external_url:
                    externalUrl === undefined ? { NoChange: null } : { SetToSome: externalUrl },
                permissions_v2: apiOptional(apiOptionalGroupPermissions, permissions),
                rules: apiOptional(apiUpdatedRules, rules),
                public: apiOptional(identity, isPublic),
                events_ttl: apiOptionUpdate(identity, eventsTimeToLiveMs),
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
                messages_visible_to_non_members: apiOptional(identity, messagesVisibleToNonMembers),
            }),
            updateGroupResponse,
        );
    }

    updateCommunity(
        name?: string,
        description?: string,
        rules?: UpdatedRules,
        permissions?: Partial<CommunityPermissions>,
        avatar?: Uint8Array,
        banner?: Uint8Array,
        gate?: AccessGate,
        isPublic?: boolean,
        primaryLanguage?: string,
    ): Promise<UpdateCommunityResponse> {
        return this.handleResponse(
            this.service.update_community({
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                permissions: apiOptional(apiOptionalCommunityPermissions, permissions),
                rules: apiOptional(apiUpdatedRules, rules),
                public: apiOptional(identity, isPublic),
                primary_language: apiOptional(identity, primaryLanguage),
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
                banner:
                    banner === undefined
                        ? { NoChange: null }
                        : {
                              SetToSome: {
                                  id: DataClient.newBlobId(),
                                  mime_type: "image/jpg",
                                  data: banner,
                              },
                          },
            }),
            updateCommunityResponse,
        );
    }

    createUserGroup(name: string, users: string[]): Promise<CreateUserGroupResponse> {
        return this.handleResponse(
            this.service.create_user_group({
                name,
                user_ids: users.map((u) => Principal.fromText(u)),
            }),
            createUserGroupResponse,
        );
    }

    updateUserGroup(
        userGroupId: number,
        name: string | undefined,
        usersToAdd: string[],
        usersToRemove: string[],
    ): Promise<UpdateUserGroupResponse> {
        return this.handleResponse(
            this.service.update_user_group({
                user_group_id: userGroupId,
                name: apiOptional(identity, name),
                users_to_add: usersToAdd.map((u) => Principal.fromText(u)),
                users_to_remove: usersToRemove.map((u) => Principal.fromText(u)),
            }),
            updateUserGroupResponse,
        );
    }

    setMemberDisplayName(
        displayName: string | undefined,
        newAchievement: boolean,
    ): Promise<SetMemberDisplayNameResponse> {
        return this.handleResponse(
            this.service.set_member_display_name({
                display_name: apiOptional(identity, displayName),
                new_achievement: newAchievement,
            }),
            setMemberDisplayNameResponse,
        );
    }

    deleteUserGroups(userGroupIds: number[]): Promise<DeleteUserGroupsResponse> {
        return this.handleResponse(
            this.service.delete_user_groups({
                user_group_ids: userGroupIds,
            }),
            deleteUserGroupsResponse,
        );
    }

    followThread(
        channelId: string,
        threadRootMessageIndex: number,
        follow: boolean,
    ): Promise<FollowThreadResponse> {
        const args = {
            channel_id: BigInt(channelId),
            thread_root_message_index: threadRootMessageIndex,
        };
        return this.handleResponse(
            follow ? this.service.follow_thread(args) : this.service.unfollow_thread(args),
            followThreadResponse,
        );
    }

    reportMessage(
        channelId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.handleResponse(
            this.service.report_message({
                channel_id: BigInt(channelId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                delete: deleteMessage,
            }),
            reportMessageResponse,
        );
    }

    acceptP2PSwap(
        channelId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
    ): Promise<AcceptP2PSwapResponse> {
        return this.handleResponse(
            this.service.accept_p2p_swap({
                channel_id: BigInt(channelId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                pin: apiOptional(identity, pin),
                new_achievement: newAchievement,
            }),
            acceptP2PSwapResponse,
        );
    }

    cancelP2PSwap(
        channelId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        return this.handleResponse(
            this.service.cancel_p2p_swap({
                channel_id: BigInt(channelId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
            }),
            cancelP2PSwapResponse,
        );
    }

    joinVideoCall(
        channelId: string,
        messageId: bigint,
        newAchievement: boolean,
    ): Promise<JoinVideoCallResponse> {
        return this.handleResponse(
            this.service.join_video_call({
                message_id: messageId,
                channel_id: BigInt(channelId),
                new_achievement: newAchievement,
            }),
            joinVideoCallResponse,
        );
    }

    setVideoCallPresence(
        channelId: string,
        messageId: bigint,
        presence: VideoCallPresence,
        newAchievement: boolean,
    ): Promise<SetVideoCallPresenceResponse> {
        return this.handleResponse(
            this.service.set_video_call_presence({
                channel_id: BigInt(channelId),
                message_id: messageId,
                presence: apiVideoCallPresence(presence),
                new_achievement: newAchievement,
            }),
            setVideoCallPresence,
        );
    }

    videoCallParticipants(
        channelId: string,
        messageId: bigint,
        updatesSince?: bigint,
    ): Promise<VideoCallParticipantsResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.video_call_participants({
                    channel_id: BigInt(channelId),
                    message_id: messageId,
                    updated_since: apiOptional(identity, updatesSince),
                }),
            videoCallParticipantsResponse,
        );
    }

    cancelInvites(channelId: string | undefined, userIds: string[]): Promise<boolean> {
        return this.handleResponse(
            this.service.cancel_invites({
                channel_id: apiOptional((cid) => BigInt(cid), channelId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
            }),
            (candid) => "Success" in candid,
        );
    }
}
