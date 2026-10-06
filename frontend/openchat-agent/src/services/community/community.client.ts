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
    ExploreChannelsResponse,
    FollowThreadResponse,
    FullWebhookDetails,
    GrantedBotPermissions,
    GroupChatDetailsResponse,
    GroupChatIdentifier,
    ImportGroupResponse,
    InviteCodeResponse,
    JoinVideoCallResponse,
    LeaveGroupResponse,
    MemberRole,
    Message,
    PendingCryptocurrencyTransfer,
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
    TipMessageResponse,
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
    LookupMembersResponse,
} from "@shared";
import {
    CanisterMethodNotFoundError,
    isCanisterGoneError,
    MAX_EVENTS,
    MAX_MESSAGES,
    MEMBERS_PAGE_SIZE,
    random32,
    toBigInt32,
} from "@shared";
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
    CommunityRegisterProposalVoteV2Args,
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
    CommunityTipMessageArgs,
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
    CommunityLookupMembersArgs,
    CommunityLookupMembersResponse,
    CommunitySearchMembersArgs,
    CommunitySearchMembersResponse,
    CommunityLookupChannelMembersArgs,
    CommunityLookupChannelMembersResponse,
} from "../../typebox";
import { type ChatsDb } from "../../utils/chatsDb";
import {
    addMembersToCachedCommunityDetails,
    addMembersToCachedGroupDetails,
    loadCommunityDetails,
    loadGroupDetails,
} from "../../utils/details";
import {
    apiOptionUpdateV2,
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import { MultiCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import type { IChatEventsReader } from "../common/chatEvents";
import {
    acceptP2PSwapSuccess,
    addressToIcrcAccount,
    apiAccessGateConfig,
    apiExternalBotPermissions,
    apiGroupPermissions,
    apiMaybeAccessGateConfig,
    apiMessageContent,
    apiOgPreview,
    apiPendingTransaction,
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
    lookupGroupMembersSuccess,
    inviteCodeSuccess,
    isSuccess,
    mapResult,
    throwIfReplicaNotUpToDate,
    proposalTallies,
    pushEventSuccess,
    searchGroupChatResponse,
    sendMessageSuccess,
    transferFrom,
    transferRecipient,
    threadPreviewsSuccess,
    undeleteMessageSuccess,
    unitResult,
    updateGroupSuccess,
    videoCallParticipantsSuccess,
    webhookDetails,
} from "../common/chatMappersV2";
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
    lookupCommunityMembersResponse,
    createUserGroupSuccess,
    exploreChannelsResponse,
    importGroupSuccess,
    summaryResponse,
    summaryUpdatesResponse,
    updateCommunitySuccess,
} from "./mappersV2";

export class CommunityClient
    extends MultiCanisterMsgpackAgent
    implements IChatEventsReader<ChannelIdentifier>
{
    private readonly _inviteCodes: Map<string, bigint> = new Map();

    constructor(
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private readonly chatsDb: ChatsDb,
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
                        og_previews: message.ogPreviews.map(apiOgPreview),
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

    async chatEvents(
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
            (resp) =>
                throwIfReplicaNotUpToDate(
                    mapResult(resp, (value) => getEventsSuccess(value, chatId, this.chatsDb)),
                    latestKnownUpdate,
                ),
            CommunityEventsArgs,
            CommunityEventsResponse,
        );
    }

    chatEventsByIndex(
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
            (resp) =>
                throwIfReplicaNotUpToDate(
                    mapResult(resp, (value) => getEventsSuccess(value, chatId, this.chatsDb)),
                    latestKnownUpdate,
                ),
            CommunityEventsByIndexArgs,
            CommunityEventsResponse,
        );
    }

    async chatEventsWindow(
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
            (resp) =>
                throwIfReplicaNotUpToDate(
                    mapResult(resp, (value) => getEventsSuccess(value, chatId, this.chatsDb)),
                    latestKnownUpdate,
                ),
            CommunityEventsWindowArgs,
            CommunityEventsResponse,
        );
    }

    async messagesByMessageIndex(
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
            (resp) =>
                throwIfReplicaNotUpToDate(
                    mapResult(resp, (value) => getMessagesSuccess(value, chatId, this.chatsDb)),
                    latestKnownUpdate,
                ),
            CommunityMessagesByMessageIndexArgs,
            CommunityMessagesByMessageIndexResponse,
        );
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

    // A caller which already holds the details passes the time up to which they are known to be up
    // to date as `detailsSyncedUpTo`, and is told only that they still are, unless they have changed
    getCommunityDetails(
        communityId: string,
        detailsLastUpdated: bigint,
        detailsSyncedUpTo?: bigint,
    ): Promise<CommunityDetailsResponse> {
        return loadCommunityDetails(
            this.chatsDb,
            communityId,
            detailsLastUpdated,
            detailsSyncedUpTo,
            () =>
                this.query(
                    communityId,
                    "selected_initial",
                    {
                        invite_code: this.inviteCode(communityId),
                        // The rest of the members are only loaded when they are needed
                        max_members: MEMBERS_PAGE_SIZE,
                    },
                    communityDetailsResponse,
                    CommunitySelectedInitialArgs,
                    CommunitySelectedInitialResponse,
                ),
            (since) =>
                this.query(
                    communityId,
                    "selected_updates_v2",
                    {
                        updates_since: since,
                        invite_code: this.inviteCode(communityId),
                        // As for `selected_initial`, if the details are returned in full
                        max_members: MEMBERS_PAGE_SIZE,
                    },
                    communityDetailsUpdatesResponse,
                    CommunitySelectedUpdatesArgs,
                    CommunitySelectedUpdatesResponse,
                ),
        );
    }

    // As for `getCommunityDetails`, a caller which already holds the details passes
    // `detailsSyncedUpTo`
    getChannelDetails(
        chatId: ChannelIdentifier,
        detailsLastUpdated: bigint,
        detailsSyncedUpTo?: bigint,
    ): Promise<GroupChatDetailsResponse> {
        return loadGroupDetails(
            this.chatsDb,
            channelDetailsCacheKey(chatId),
            detailsLastUpdated,
            detailsSyncedUpTo,
            () =>
                this.query(
                    chatId.communityId,
                    "selected_channel_initial",
                    {
                        channel_id: toBigInt32(chatId.channelId),
                        // The rest of the members are only loaded when they are needed
                        max_members: MEMBERS_PAGE_SIZE,
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
                ),
            (since) =>
                this.query(
                    chatId.communityId,
                    "selected_channel_updates_v2",
                    {
                        channel_id: toBigInt32(chatId.channelId),
                        updates_since: since,
                        // As for `selected_channel_initial`, if the details are returned in full
                        max_members: MEMBERS_PAGE_SIZE,
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
                ),
        );
    }

    // Those of the users who are members, who are added to the cached details.
    // `latestKnownUpdate` is the time up to which the details held are known to be up to date.
    async lookupMembers(
        communityId: string,
        userIds: string[],
        latestKnownUpdate: bigint,
    ): Promise<LookupMembersResponse> {
        const response = await this.query(
            communityId,
            "lookup_members",
            {
                invite_code: this.inviteCode(communityId),
                user_ids: userIds.map(principalStringToBytes),
                latest_known_update: latestKnownUpdate,
            },
            lookupCommunityMembersResponse,
            CommunityLookupMembersArgs,
            CommunityLookupMembersResponse,
        );
        if (response.kind === "success") {
            await addMembersToCachedCommunityDetails(
                this.chatsDb,
                communityId,
                response.members,
                latestKnownUpdate,
            );
        }
        return response;
    }

    // The members whose display names in the community match the search term, who are added to the
    // cached details. `latestKnownUpdate` is as for `lookupMembers`.
    async searchMembers(
        communityId: string,
        searchTerm: string,
        maxResults: number,
        latestKnownUpdate: bigint,
    ): Promise<LookupMembersResponse> {
        const response = await this.query(
            communityId,
            "search_members",
            {
                invite_code: this.inviteCode(communityId),
                search_term: searchTerm,
                max_results: maxResults,
                latest_known_update: latestKnownUpdate,
            },
            lookupCommunityMembersResponse,
            CommunitySearchMembersArgs,
            CommunitySearchMembersResponse,
        ).catch((err) => {
            // A Community canister which hasn't yet been upgraded to have `search_members` finds
            // nobody, rather than failing every search
            if (err instanceof CanisterMethodNotFoundError) {
                return { kind: "success" as const, members: [] };
            }
            throw err;
        });
        if (response.kind === "success" && response.members.length > 0) {
            await addMembersToCachedCommunityDetails(
                this.chatsDb,
                communityId,
                response.members,
                latestKnownUpdate,
            );
        }
        return response;
    }

    // As for `lookupMembers`, but of the members of a channel
    async lookupChannelMembers(
        chatId: ChannelIdentifier,
        userIds: string[],
        latestKnownUpdate: bigint,
    ): Promise<LookupMembersResponse> {
        const response = await this.query(
            chatId.communityId,
            "lookup_channel_members",
            {
                channel_id: toBigInt32(chatId.channelId),
                user_ids: userIds.map(principalStringToBytes),
                latest_known_update: latestKnownUpdate,
            },
            (resp) => mapResult(resp, lookupGroupMembersSuccess),
            CommunityLookupChannelMembersArgs,
            CommunityLookupChannelMembersResponse,
        );
        if (response.kind === "success") {
            await addMembersToCachedGroupDetails(
                this.chatsDb,
                channelDetailsCacheKey(chatId),
                response.members,
                latestKnownUpdate,
            );
        }
        return response;
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
        // The account the community pulls the message's transfer from, if it holds one
        fromAccount?: string,
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        this.chatsDb.removeFailedMessage(chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = new DataClient(this.identity, this.agent, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [chatId.communityId])
            : dataClient.uploadData(event.event.content, [chatId.communityId]);

        return uploadContentPromise.then((content) => {
            const newEvent =
                content !== undefined ? { ...event, event: { ...event.event, content } } : event;
            const toSend =
                fromAccount === undefined
                    ? newEvent.event.content
                    : transferFrom(newEvent.event.content, fromAccount);
            const args = {
                channel_id: toBigInt32(chatId.channelId),
                content: apiMessageContent(toSend),
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
                og_previews: newEvent.event.ogPreviews.map(apiOgPreview),
            };
            return this.update(
                chatId.communityId,
                "send_message",
                args,
                (resp) =>
                    mapResult(resp, (value) =>
                        sendMessageSuccess(
                            value,
                            newEvent.event.sender,
                            transferRecipient(newEvent.event.content),
                        ),
                    ),
                CommunitySendMessageArgs,
                CommunitySendMessageResponse,
                onRequestAccepted,
            )
                .then((resp) =>
                    // Returns the message as it was sent, a prize or swap offer in place of the
                    // content it was made from
                    this.chatsDb.setCachedMessageFromSendResponse(
                        chatId,
                        newEvent,
                        threadRootMessageIndex,
                    )([resp, newEvent.event]),
                )
                .catch((err) => {
                    this.chatsDb.recordFailedMessage(chatId, newEvent, threadRootMessageIndex);
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
            if (isCanisterGoneError(err)) {
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
        ).catch((err) => {
            // The community has been deleted: a stale link or cached reference, not a defect.
            // channelSummary maps the same rejection the same way.
            if (isCanisterGoneError(err)) {
                return { kind: "failure" } as CommunitySummaryResponse;
            }
            throw err;
        });
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

    registerProposalVoteV2(
        chatId: ChannelIdentifier,
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.update(
            chatId.communityId,
            "register_proposal_vote_v2",
            {
                channel_id: toBigInt32(chatId.channelId),
                adopt,
                message_index: messageIdx,
            },
            unitResult,
            CommunityRegisterProposalVoteV2Args,
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
        csam: boolean,
    ): Promise<boolean> {
        return this.update(
            chatId.communityId,
            "report_message",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                delete: deleteMessage,
                csam,
            },
            (resp) => resp === "Success",
            CommunityReportMessageArgs,
            UnitResult,
        );
    }

    // Tips a message with a transfer the community pulls from the account `transfer` names, which
    // must have approved the community to, into the wallet of the message's sender
    tipMessage(
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        transfer: PendingCryptocurrencyTransfer,
        decimals: number,
        username: string,
        displayName: string | undefined,
        newAchievement: boolean,
    ): Promise<TipMessageResponse> {
        return this.update(
            chatId.communityId,
            "tip_message",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                transfer: apiPendingTransaction(transfer),
                decimals,
                username,
                display_name: displayName,
                new_achievement: newAchievement,
            },
            unitResult,
            CommunityTipMessageArgs,
            UnitResult,
        );
    }

    acceptP2PSwap(
        chatId: ChannelIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
        fromAccount: string | undefined,
    ): Promise<AcceptP2PSwapResponse> {
        return this.update(
            chatId.communityId,
            "accept_p2p_swap",
            {
                channel_id: toBigInt32(chatId.channelId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                from_account: mapOptional(fromAccount, addressToIcrcAccount),
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

// The key under which the details of a channel are cached
function channelDetailsCacheKey(chatId: ChannelIdentifier): string {
    return `${chatId.communityId}_${chatId.channelId}`;
}
