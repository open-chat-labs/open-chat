/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, type CommunityService } from "./candid/idl";
import { CandidService } from "../candidService";
import { apiOptionUpdate, identity } from "../../utils/mapping";
import type { AgentConfig } from "../../config";
import {
    addMembersToChannelResponse,
    blockUserResponse,
    localUserIndexResponse,
    messagesByMessageIndexResponse,
    removeMemberResponse,
    removeMemberFromChannelResponse,
    sendMessageResponse,
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
import { Principal } from "@dfinity/principal";
import {
    apiGroupPermissions,
    apiMaybeAccessGate,
    apiOptional,
    apiMessageContent,
    apiUser,
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
} from "../common/chatMappers";
import type {
    AccessGate,
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    CandidateChannel,
    ChangeCommunityRoleResponse,
    CommunityPermissions,
    EventWrapper,
    EventsResponse,
    GroupChatEvent,
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
} from "openchat-shared";
import { textToCode, DestinationInvalidError } from "openchat-shared";
import {
    apiOptionalGroupPermissions,
    apiUpdatedRules,
    getMessagesByMessageIndexResponse,
} from "../group/mappers";
import { DataClient } from "../data/data.client";
import { MAX_EVENTS, MAX_MESSAGES, MAX_MISSING } from "../../constants";
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

export class CommunityClient extends CandidService {
    private service: CommunityService;

    private constructor(
        private communityId: string,
        identity: Identity,
        private config: AgentConfig,
        private db: Database,
        private inviteCode: string | undefined,
    ) {
        super(identity);

        this.service = this.createServiceClient<CommunityService>(idlFactory, communityId, config);
    }

    static create(
        communityId: string,
        identity: Identity,
        config: AgentConfig,
        db: Database,
        inviteCode: string | undefined,
    ): CommunityClient {
        return new CommunityClient(communityId, identity, config, db, inviteCode);
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
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.service.add_reaction({
                channel_id: BigInt(chatId.channelId),
                username,
                display_name: apiOptional(identity, displayName),
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                reaction,
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
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.service.delete_messages({
                channel_id: BigInt(chatId.channelId),
                message_ids: messageIds,
                as_platform_moderator: apiOptional(identity, asPlatformModerator),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
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
    ): Promise<EditMessageResponse> {
        return DataClient.create(this.identity, this.config)
            .uploadData(message.content, [chatId.communityId])
            .then((content) => {
                return this.handleResponse(
                    this.service.edit_message({
                        channel_id: BigInt(chatId.channelId),
                        thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                        content: apiMessageContent(content ?? message.content),
                        message_id: message.messageId,
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
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<GroupChatEvent>(
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
            ).then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex));
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
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
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
    ): Promise<EventsResponse<GroupChatEvent>> {
        return getCachedEventsByIndex<GroupChatEvent>(this.db, eventIndexes, {
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
    ): Promise<EventsResponse<GroupChatEvent>> {
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
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing, totalMiss] =
            await getCachedEventsWindowByMessageIndex<GroupChatEvent>(
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
            ).then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                undefined,
                latestKnownUpdate,
            );
        }
    }

    private async eventsWindowFromBackend(
        chatId: ChannelIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.service.events_window(args),
            (res) => {
                return getEventsResponse(this.principal, res, chatId, latestKnownUpdate);
            },
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
        [cachedEvents, missing]: [EventsSuccessResult<GroupChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
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
        return this.handleResponse(this.service.local_user_index({}), localUserIndexResponse);
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
            if (fromCache.lastUpdated >= communityLastUpdated || !navigator.onLine) {
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
        const fromCache = await getCachedGroupDetails(this.db, chatId.channelId);
        if (fromCache !== undefined) {
            if (fromCache.timestamp >= chatLastUpdated || !navigator.onLine) {
                return fromCache;
            } else {
                return this.getChannelDetailsUpdates(chatId, fromCache);
            }
        }

        const response = await this.getChannelDetailsFromBackend(chatId);
        if (response !== "failure") {
            await setCachedGroupDetails(this.db, chatId.channelId, response);
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
        previous: GroupChatDetails,
    ): Promise<GroupChatDetails> {
        const response = await this.getChannelDetailsUpdatesFromBackend(chatId, previous);
        if (response.timestamp > previous.timestamp) {
            await setCachedGroupDetails(this.db, chatId.channelId, response);
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
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = DataClient.create(this.identity, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [chatId.communityId])
            : dataClient.uploadData(event.event.content, [chatId.communityId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const args = {
                channel_id: BigInt(chatId.channelId),
                content: apiMessageContent(newContent),
                message_id: event.event.messageId,
                sender_name: senderName,
                sender_display_name: apiOptional(identity, senderDisplayName),
                community_rules_accepted: apiOptional(identity, communityRulesAccepted),
                channel_rules_accepted: apiOptional(identity, channelRulesAccepted),
                replies_to: apiOptional(
                    (replyContext) => ({
                        event_index: replyContext.eventIndex,
                    }),
                    event.event.repliesTo,
                ),
                mentioned: mentioned.map(apiUser),
                forwarding: event.event.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            };
            return this.handleResponse(this.service.send_message(args), sendMessageResponse)
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
        threadRootMessageIndex?: number,
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.service.register_poll_vote({
                channel_id: BigInt(chatId.channelId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
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
        chatId: ChannelIdentifier,
        mute: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        return this.handleResponse(
            this.service.toggle_mute_notifications({
                channel_id: [BigInt(chatId.channelId)],
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
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.service.update_channel({
                channel_id: BigInt(chatId.channelId),
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
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

    setMemberDisplayName(displayName: string | undefined): Promise<SetMemberDisplayNameResponse> {
        return this.handleResponse(
            this.service.set_member_display_name({
                display_name: apiOptional(identity, displayName),
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
}
