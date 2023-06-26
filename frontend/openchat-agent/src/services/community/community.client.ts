/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, CommunityService } from "./candid/idl";
import { CandidService } from "../candidService";
import { identity } from "../../utils/mapping";
import type { AgentConfig } from "../../config";
import {
    addMembersToChannelResponse,
    blockUserResponse,
    changeChannelRoleResponse,
    changeRoleResponse,
    declineInvitationResponse,
    deleteMessagesResponse,
    deleteMessageResponse,
    disableInviteCodeResponse,
    enableInviteCodeResponse,
    inviteCodeResponse,
    joinChannelResponse,
    leaveChannelResponse,
    localUserIndexResponse,
    makeChannelPrivateResponse,
    makeCommunityPrivateResponse,
    messagesByMessageIndexResponse,
    removeMemberResponse,
    removeMemberFromChannelResponse,
    searchChannelResponse,
    sendMessageResponse,
    summaryResponse,
    summaryUpdatesResponse,
    toggleMuteChannelNotificationsResponse,
    toggleMuteNotificationsResponse,
    unblockUserResponse,
    undeleteMessagesResponse,
    updateCommunityResponse,
    apiMemberRole,
    apiCommunityRole,
    apiOptionalCommunityPermissions,
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
    editMessageResponse,
    deleteGroupResponse,
    unpinMessageResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
} from "../common/chatMappers";
import type {
    AccessGate,
    AccessRules,
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    CandidateChannel,
    ChangeChannelRoleResponse,
    ChangeCommunityRoleResponse,
    CommunityInviteCodeResponse,
    CommunityPermissions,
    DeclineChannelInvitationResponse,
    DeleteChannelMessageResponse,
    DeleteChannelMessagesResponse,
    DisableCommunityInviteCodeResponse,
    EnableCommunityInviteCodeResponse,
    EventWrapper,
    EventsResponse,
    GroupChatEvent,
    ChatPermissions,
    JoinChannelResponse,
    LeaveChannelResponse,
    MakeChannelPrivateResponse,
    MakeCommunityPrivateResponse,
    MemberRole,
    Message,
    RemoveChannelMemberResponse,
    RemoveCommunityMemberResponse,
    SearchChannelResponse,
    ToggleMuteChannelNotificationsResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UndeleteChannelMessagesResponse,
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
} from "openchat-shared";
import { apiGroupRules, apiOptionalGroupPermissions } from "../group/mappers";
import { DataClient } from "../data/data.client";
import { MAX_EVENTS, MAX_MESSAGES, MAX_MISSING } from "../../constants";
import { getEventsResponse } from "../group/mappers";
import {
    Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    getCachedGroupDetails,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedGroupDetails,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import { mergeGroupChatDetails } from "../../utils/chat";

export class CommunityClient extends CandidService {
    private service: CommunityService;

    private constructor(
        communityId: string,
        identity: Identity,
        private config: AgentConfig,
        private db: Database
    ) {
        super(identity);

        this.service = this.createServiceClient<CommunityService>(idlFactory, communityId, config);
    }

    static create(
        communityId: string,
        identity: Identity,
        config: AgentConfig,
        db: Database
    ): CommunityClient {
        return new CommunityClient(communityId, identity, config, db);
    }

    addMembersToChannel(
        chatId: ChannelIdentifier,
        userIds: string[],
        username: string
    ): Promise<AddMembersToChannelResponse> {
        return this.handleResponse(
            this.service.add_members_to_channel({
                channel_id: BigInt(chatId.channelId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
                added_by_name: username,
            }),
            addMembersToChannelResponse
        );
    }

    addReaction(
        chatId: ChannelIdentifier,
        username: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.service.add_reaction({
                channel_id: BigInt(chatId.channelId),
                username,
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                reaction,
            }),
            addRemoveReactionResponse
        );
    }

    blockUser(userId: string): Promise<BlockCommunityUserResponse> {
        return this.handleResponse(
            this.service.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockUserResponse
        );
    }

    changeChannelRole(
        chatId: ChannelIdentifier,
        userId: string,
        newRole: MemberRole
    ): Promise<ChangeChannelRoleResponse> {
        return this.handleResponse(
            this.service.change_channel_role({
                channel_id: BigInt(chatId.channelId),
                user_id: Principal.fromText(userId),
                new_role: apiMemberRole(newRole),
            }),
            changeChannelRoleResponse
        );
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeCommunityRoleResponse> {
        return this.handleResponse(
            this.service.change_role({
                user_id: Principal.fromText(userId),
                new_role: apiCommunityRole(newRole),
            }),
            changeRoleResponse
        );
    }

    createChannel(channel: CandidateChannel): Promise<CreateGroupResponse> {
        return this.handleResponse(
            this.service.create_channel({
                is_public: channel.public,
                name: channel.name,
                subtype: [],
                events_ttl: [], // TODO - not sure what this is for
                description: channel.description,
                history_visible_to_new_joiners: channel.historyVisible,
                avatar: apiOptional((data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }, channel.avatar?.blobData),
                permissions: [apiGroupPermissions(channel.permissions)],
                rules: apiGroupRules(channel.rules),
                gate: apiMaybeAccessGate(channel.gate),
            }),
            (resp) => createGroupResponse(resp, channel.id)
        );
    }

    declineInvitation(chatId: ChannelIdentifier): Promise<DeclineChannelInvitationResponse> {
        return this.handleResponse(
            this.service.decline_invitation({
                channel_id: [BigInt(chatId.channelId)],
            }),
            declineInvitationResponse
        );
    }

    deleteChannel(chatId: ChannelIdentifier): Promise<DeleteGroupResponse> {
        return this.handleResponse(
            this.service.delete_channel({
                channel_id: BigInt(chatId.channelId),
            }),
            deleteGroupResponse
        );
    }

    deleteMessages(
        chatId: ChannelIdentifier,
        messageIds: bigint[],
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined
    ): Promise<DeleteChannelMessagesResponse> {
        return this.handleResponse(
            this.service.delete_messages({
                channel_id: BigInt(chatId.channelId),
                message_ids: messageIds,
                as_platform_moderator: apiOptional(identity, asPlatformModerator),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            deleteMessagesResponse
        );
    }

    deleteMessage(
        chatId: ChannelIdentifier,
        messageId: bigint,
        sender: string,
        threadRootMessageIndex: number | undefined
    ): Promise<DeleteChannelMessageResponse> {
        return this.handleResponse(
            this.service.deleted_message({
                channel_id: BigInt(chatId.channelId),
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            (res) => deleteMessageResponse(res, sender)
        );
    }

    disableInviteCode(): Promise<DisableCommunityInviteCodeResponse> {
        return this.handleResponse(this.service.disable_invite_code({}), disableInviteCodeResponse);
    }

    editMessage(
        chatId: ChannelIdentifier,
        message: Message,
        threadRootMessageIndex: number | undefined
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
                    editMessageResponse
                );
            });
    }

    enableInviteCode(): Promise<EnableCommunityInviteCodeResponse> {
        return this.handleResponse(this.service.enable_invite_code({}), enableInviteCodeResponse);
    }

    async events(
        chatId: ChannelIdentifier,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<GroupChatEvent>(
            this.db,
            eventIndexRange,
            chatId,
            startIndex,
            ascending,
            threadRootMessageIndex
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
                latestClientEventIndex
            ).then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestClientEventIndex
            );
        }
    }

    eventsFromBackend(
        chatId: ChannelIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            start_index: startIndex,
            ascending: ascending,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.service.events(args),
            (res) => {
                return getEventsResponse(
                    this.principal,
                    res,
                    chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            }
        );
    }

    eventsByIndex(
        chatId: ChannelIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return getCachedEventsByIndex<GroupChatEvent>(
            this.db,
            eventIndexes,
            chatId,
            threadRootMessageIndex
        ).then((res) =>
            this.handleMissingEvents(chatId, res, threadRootMessageIndex, latestClientEventIndex)
        );
    }

    private eventsByIndexFromBackend(
        chatId: ChannelIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.service.events_by_index(args),
            (res) => {
                return getEventsResponse(
                    this.principal,
                    res,
                    chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            }
        );
    }

    async eventsWindow(
        chatId: ChannelIdentifier,
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow<GroupChatEvent>(
            this.db,
            eventIndexRange,
            chatId,
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
            return this.eventsWindowFromBackend(
                chatId,
                messageIndex,
                threadRootMessageIndex,
                latestClientEventIndex
            ).then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                undefined,
                latestClientEventIndex
            );
        }
    }

    private async eventsWindowFromBackend(
        chatId: ChannelIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(chatId.channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.service.events_window(args),
            (res) => {
                return getEventsResponse(
                    this.principal,
                    res,
                    chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            }
        );
    }

    private handleMissingEvents(
        chatId: ChannelIdentifier,
        [cachedEvents, missing]: [EventsSuccessResult<GroupChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.eventsByIndexFromBackend(
                chatId,
                [...missing],
                threadRootMessageIndex,
                latestClientEventIndex
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
        threadRootMessageIndex?: number
    ): EventsResponse<T> {
        setCachedEvents(this.db, chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached channel events", err)
        );
        return resp;
    }

    inviteCode(): Promise<CommunityInviteCodeResponse> {
        return this.handleResponse(this.service.invite_code({}), inviteCodeResponse);
    }

    joinChannel(chatId: ChannelIdentifier): Promise<JoinChannelResponse> {
        return this.handleResponse(
            this.service.join_channel({
                channel_id: BigInt(chatId.channelId),
            }),
            (resp) => joinChannelResponse(resp, chatId.communityId)
        );
    }

    leaveChannel(chatId: ChannelIdentifier): Promise<LeaveChannelResponse> {
        return this.handleResponse(
            this.service.leave_channel({
                channel_id: BigInt(chatId.channelId),
            }),
            leaveChannelResponse
        );
    }

    localUserIndex(): Promise<string> {
        return this.handleResponse(this.service.local_user_index({}), localUserIndexResponse);
    }

    makeChannelPrivate(chatId: ChannelIdentifier): Promise<MakeChannelPrivateResponse> {
        return this.handleResponse(
            this.service.make_channel_private({
                channel_id: BigInt(chatId.channelId),
            }),
            makeChannelPrivateResponse
        );
    }

    makePrivate(): Promise<MakeCommunityPrivateResponse> {
        return this.handleResponse(this.service.make_private({}), makeCommunityPrivateResponse);
    }

    messagesByMessageIndex(
        chatId: ChannelIdentifier,
        messageIndexes: number[],
        latestClientEventIndex: number | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        const args = {
            channel_id: BigInt(chatId.channelId),
            messages: messageIndexes,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
        };
        return this.handleQueryResponse(
            () => this.service.messages_by_message_index(args),
            (res) =>
                messagesByMessageIndexResponse(
                    this.principal,
                    res,
                    chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                )
        );
    }

    unpinMessage(chatId: ChannelIdentifier, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.service.unpin_message({
                channel_id: BigInt(chatId.channelId),
                message_index: messageIndex,
            }),
            unpinMessageResponse
        );
    }

    pinMessage(chatId: ChannelIdentifier, messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.service.pin_message({
                channel_id: BigInt(chatId.channelId),
                message_index: messageIndex,
            }),
            pinMessageResponse
        );
    }

    removeMember(userId: string): Promise<RemoveCommunityMemberResponse> {
        return this.handleResponse(
            this.service.remove_member({
                user_id: Principal.fromText(userId),
            }),
            removeMemberResponse
        );
    }

    removeMemberFromChannel(
        chatId: ChannelIdentifier,
        userId: string
    ): Promise<RemoveChannelMemberResponse> {
        return this.handleResponse(
            this.service.remove_member_from_channel({
                channel_id: BigInt(chatId.channelId),
                user_id: Principal.fromText(userId),
            }),
            removeMemberFromChannelResponse
        );
    }

    removeReaction(
        chatId: ChannelIdentifier,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.service.remove_reaction({
                channel_id: BigInt(chatId.channelId),
                message_id: messageId,
                reaction,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            addRemoveReactionResponse
        );
    }

    resetInviteCode(): Promise<EnableCommunityInviteCodeResponse> {
        return this.handleResponse(this.service.reset_invite_code({}), enableInviteCodeResponse);
    }

    searchChannel(
        chatId: ChannelIdentifier,
        maxResults: number,
        users: string[],
        searchTerm: string
    ): Promise<SearchChannelResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.search_channel({
                    channel_id: BigInt(chatId.channelId),
                    max_results: maxResults,
                    users: users.length > 0 ? [users.map((u) => Principal.fromText(u))] : [],
                    search_term: searchTerm,
                }),
            searchChannelResponse
        );
    }

    async getChannelDetails(
        chatId: ChannelIdentifier,
        timestamp: bigint
    ): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, chatId.channelId);
        if (fromCache !== undefined) {
            if (fromCache.timestamp >= timestamp) {
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
        chatId: ChannelIdentifier
    ): Promise<GroupChatDetailsResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.selected_channel_initial({
                    channel_id: BigInt(chatId.channelId),
                }),
            groupDetailsResponse
        );
    }

    async getChannelDetailsUpdates(
        chatId: ChannelIdentifier,
        previous: GroupChatDetails
    ): Promise<GroupChatDetails> {
        const response = await this.getChannelDetailsUpdatesFromBackend(chatId, previous);
        if (response.timestamp > previous.timestamp) {
            await setCachedGroupDetails(this.db, chatId.channelId, response);
        }
        return response;
    }

    private async getChannelDetailsUpdatesFromBackend(
        chatId: ChannelIdentifier,
        previous: GroupChatDetails
    ): Promise<GroupChatDetails> {
        const updatesResponse = await this.handleQueryResponse(
            () =>
                this.service.selected_channel_updates({
                    channel_id: BigInt(chatId.channelId),
                    updates_since: previous.timestamp,
                }),
            groupDetailsUpdatesResponse
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
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
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
                replies_to: apiOptional(
                    (replyContext) => ({
                        event_index: replyContext.eventIndex,
                    }),
                    event.event.repliesTo
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
                        threadRootMessageIndex
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, chatId, event, threadRootMessageIndex);
                    throw err;
                });
        });
    }

    summary(): Promise<CommunitySummaryResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.summary({
                    invite_code: [], // TODO: add invite code
                }),
            summaryResponse
        );
    }

    summaryUpdates(updatesSince: bigint): Promise<CommunitySummaryUpdatesResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.summary_updates({
                    updates_since: updatesSince,
                }),
            summaryUpdatesResponse
        );
    }

    toggleMuteChannelNotifications(
        chatId: ChannelIdentifier,
        mute: boolean
    ): Promise<ToggleMuteChannelNotificationsResponse> {
        return this.handleResponse(
            this.service.toggle_mute_channel_notifications({
                channel_id: BigInt(chatId.channelId),
                mute,
            }),
            toggleMuteChannelNotificationsResponse
        );
    }

    toggleMuteNotifications(mute: boolean): Promise<ToggleMuteCommunityNotificationsResponse> {
        return this.handleResponse(
            this.service.toggle_mute_notifications({
                mute,
            }),
            toggleMuteNotificationsResponse
        );
    }

    unblockUser(userId: string): Promise<UnblockCommunityUserResponse> {
        return this.handleResponse(
            this.service.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockUserResponse
        );
    }

    undeleteMessages(
        chatId: ChannelIdentifier,
        messageIds: bigint[],
        threadRootMessageIndex: number | undefined
    ): Promise<UndeleteChannelMessagesResponse> {
        return this.handleResponse(
            this.service.undelete_messages({
                channel_id: BigInt(chatId.channelId),
                message_ids: messageIds,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            undeleteMessagesResponse
        );
    }

    updateChannel(
        chatId: ChannelIdentifier,
        name?: string,
        description?: string,
        rules?: AccessRules,
        permissions?: Partial<ChatPermissions>,
        avatar?: Uint8Array,
        gate?: AccessGate
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.service.update_channel({
                channel_id: BigInt(chatId.channelId),
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                permissions: apiOptional(apiOptionalGroupPermissions, permissions),
                rules: apiOptional(apiGroupRules, rules),
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
            updateGroupResponse
        );
    }

    updateCommunity(
        name?: string,
        description?: string,
        rules?: AccessRules,
        permissions?: Partial<CommunityPermissions>,
        avatar?: Uint8Array,
        banner?: Uint8Array,
        gate?: AccessGate
    ): Promise<UpdateCommunityResponse> {
        return this.handleResponse(
            this.service.update_community({
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                permissions: apiOptional(apiOptionalCommunityPermissions, permissions),
                rules: apiOptional(apiGroupRules, rules),
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
            updateCommunityResponse
        );
    }
}
