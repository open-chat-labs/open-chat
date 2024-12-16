import type { HttpAgent, Identity } from "@dfinity/agent";
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
    AccessGateConfig,
    SlashCommandPermissions,
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
    convertToCommunityResponse,
    apiUpdatedRules,
    followThreadResponse,
    reportMessageResponse,
} from "./mappersV2";
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
import {
    acceptP2PSwapResponse,
    addBotResponse,
    addRemoveReactionResponse,
    apiAccessGateConfig,
    apiChatPermission,
    apiCommunityPermission,
    apiMessageContent,
    apiMessagePermission,
    apiUser as apiUserV2,
    apiVideoCallPresence,
    cancelP2PSwapResponse,
    changeRoleResponse,
    claimPrizeResponse,
    declineInvitationResponse,
    deleteMessageResponse,
    deletedMessageResponse,
    disableInviteCodeResponse,
    editMessageResponse,
    enableOrResetInviteCodeResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    inviteCodeResponse,
    joinVideoCallResponse,
    pinMessageResponse,
    registerPollVoteResponse,
    registerProposalVoteResponse,
    removeBotResponse,
    searchGroupChatResponse,
    setVideoCallPresence,
    threadPreviewsResponse,
    undeleteMessageResponse,
    unpinMessageResponse,
    updateBotResponse,
    updateGroupResponse,
    videoCallParticipantsResponse,
} from "../common/chatMappersV2";
import { DataClient } from "../data/data.client";
import { mergeGroupChatDetails } from "../../utils/chat";
import { publicSummaryResponse } from "../common/publicSummaryMapperV2";
import {
    apiOptionUpdateV2,
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import { generateUint64 } from "../../utils/rng";
import type { AgentConfig } from "../../config";
import { setCachedMessageFromSendResponse } from "../../utils/caching";
import { toggleNotificationsResponse } from "../notifications/mappers";
import type { CancelP2PSwapResponse } from "openchat-shared";
import { ResponseTooLargeError } from "openchat-shared";
import {
    chunkedChatEventsFromBackend,
    chunkedChatEventsWindowFromBackend,
} from "../common/chunked";
import {
    Empty as TEmpty,
    GroupAcceptP2pSwapArgs,
    GroupAcceptP2pSwapResponse,
    GroupAddReactionArgs,
    GroupAddReactionResponse,
    GroupBlockUserArgs,
    GroupBlockUserResponse,
    GroupCancelInvitesArgs,
    GroupCancelInvitesResponse,
    GroupCancelP2pSwapArgs,
    GroupCancelP2pSwapResponse,
    GroupChangeRoleArgs,
    GroupChangeRoleResponse,
    GroupClaimPrizeArgs,
    GroupClaimPrizeResponse,
    GroupConvertIntoCommunityArgs,
    GroupConvertIntoCommunityResponse,
    GroupDeclineInvitiationResponse,
    GroupDeletedMessageArgs,
    GroupDeletedMessageResponse,
    GroupDeleteMessagesArgs,
    GroupDeleteMessagesResponse,
    GroupDisableInviteCodeArgs,
    GroupDisableInviteCodeResponse,
    GroupEditMessageArgs,
    GroupEditMessageResponse,
    GroupEnableInviteCodeArgs,
    GroupEnableInviteCodeResponse,
    GroupEventsArgs,
    GroupEventsByIndexArgs,
    GroupEventsResponse,
    GroupEventsWindowArgs,
    GroupFollowThreadArgs,
    GroupFollowThreadResponse,
    GroupInviteCodeResponse,
    GroupJoinVideoCallArgs,
    GroupLocalUserIndexResponse,
    GroupMessagesByMessageIndexArgs,
    GroupMessagesByMessageIndexResponse,
    GroupPinMessageArgs,
    GroupPinMessageResponse,
    GroupPublicSummaryArgs,
    GroupPublicSummaryResponse,
    GroupRegisterPollVoteArgs,
    GroupRegisterPollVoteResponse,
    GroupRegisterProposalVoteArgs,
    GroupRegisterProposalVoteResponse,
    GroupRegisterProposalVoteV2Args,
    GroupRegisterProposalVoteV2Response,
    GroupRemoveParticipantArgs,
    GroupRemoveParticipantResponse,
    GroupRemoveReactionArgs,
    GroupRemoveReactionResponse,
    GroupReportMessageArgs,
    GroupReportMessageResponse,
    GroupSearchMessagesArgs,
    GroupSearchMessagesResponse,
    GroupSelectedInitialResponse,
    GroupSelectedUpdatesArgs,
    GroupSelectedUpdatesResponse,
    GroupSendMessageArgs,
    GroupSendMessageResponse,
    GroupSetVideoCallPresenceArgs,
    GroupSetVideoCallPresenceResponse,
    GroupSummaryResponse,
    GroupSummaryUpdatesArgs,
    GroupSummaryUpdatesResponse,
    GroupThreadPreviewsArgs,
    GroupThreadPreviewsResponse,
    GroupToggleMuteNotificationsArgs,
    GroupToggleMuteNotificationsResponse,
    GroupUnblockUserArgs,
    GroupUnblockUserResponse,
    GroupUndeleteMessagesArgs,
    GroupUndeleteMessagesResponse,
    GroupUnpinMessageArgs,
    GroupUnpinMessageResponse,
    GroupUpdateGroupArgs,
    GroupUpdateGroupResponse,
    GroupVideoCallParticipantsArgs,
    GroupVideoCallParticipantsResponse,
    GroupAddBotArgs,
    GroupAddBotResponse,
    GroupUpdateBotArgs,
    GroupUpdateBotResponse,
    GroupRemoveBotArgs,
    GroupRemoveBotResponse,
} from "../../typebox";

export class GroupClient extends CandidService {
    constructor(
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private chatId: GroupChatIdentifier,
        private db: Database,
        private inviteCode: string | undefined,
    ) {
        super(identity, agent, chatId.groupId);
    }

    summary(): Promise<GroupCanisterSummaryResponse> {
        return this.executeMsgpackQuery(
            "summary",
            {},
            summaryResponse,
            TEmpty,
            GroupSummaryResponse,
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

        return this.executeMsgpackQuery(
            "summary_updates",
            args,
            summaryUpdatesResponse,
            GroupSummaryUpdatesArgs,
            GroupSummaryUpdatesResponse,
        );
    }

    getCachedEventsByIndex(eventIndexes: number[], threadRootMessageIndex: number | undefined) {
        return getCachedEventsByIndex(this.db, eventIndexes, {
            chatId: this.chatId,
            threadRootMessageIndex,
        });
    }

    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.getCachedEventsByIndex(eventIndexes, threadRootMessageIndex).then((res) =>
            this.handleMissingEvents(res, threadRootMessageIndex, latestKnownUpdate),
        );
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
            thread_root_message_index: threadRootMessageIndex,
            events: eventIndexes,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "events_by_index",
            args,
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            GroupEventsByIndexArgs,
            GroupEventsResponse,
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
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "events_window",
            args,
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            GroupEventsWindowArgs,
            GroupEventsResponse,
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
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            ascending,
            start_index: startIndex,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "events",
            args,
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            GroupEventsArgs,
            GroupEventsResponse,
        );
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        const new_role = apiRole(newRole);
        if (new_role === undefined) {
            throw new Error(`Cannot change user's role to: ${newRole}`);
        }
        return this.executeMsgpackUpdate(
            "change_role",
            {
                user_id: principalStringToBytes(userId),
                new_role,
                correlation_id: generateUint64(),
            },
            changeRoleResponse,
            GroupChangeRoleArgs,
            GroupChangeRoleResponse,
        );
    }

    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.executeMsgpackUpdate(
            "remove_participant",
            {
                user_id: principalStringToBytes(userId),
                correlation_id: generateUint64(),
            },
            removeMemberResponse,
            GroupRemoveParticipantArgs,
            GroupRemoveParticipantResponse,
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
                const args = {
                    thread_root_message_index: threadRootMessageIndex,
                    content: apiMessageContent(content ?? message.content),
                    message_id: message.messageId,
                    block_level_markdown: blockLevelMarkdown,
                    correlation_id: generateUint64(),
                    new_achievement: newAchievement,
                };
                return this.executeMsgpackUpdate(
                    "edit_message_v2",
                    args,
                    editMessageResponse,
                    GroupEditMessageArgs,
                    GroupEditMessageResponse,
                );
            });
    }

    claimPrize(messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.executeMsgpackUpdate(
            "claim_prize",
            {
                correlation_id: generateUint64(),
                message_id: messageId,
            },
            claimPrizeResponse,
            GroupClaimPrizeArgs,
            GroupClaimPrizeResponse,
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
                correlation_id: generateUint64(),
                block_level_markdown: newEvent.event.blockLevelMarkdown,
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
                    const retVal: [SendMessageResponse, Message] = [resp, newEvent.event];
                    setCachedMessageFromSendResponse(
                        this.db,
                        this.chatId,
                        newEvent,
                        threadRootMessageIndex,
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, this.chatId, newEvent, threadRootMessageIndex);
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
        gateConfig?: AccessGateConfig,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
    ): Promise<UpdateGroupResponse> {
        return this.executeMsgpackUpdate(
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
                                  id: DataClient.newBlobId(),
                                  mime_type: "image/jpg",
                                  data: avatar,
                              },
                          },
                permissions_v2: mapOptional(permissions, apiOptionalGroupPermissions),
                rules: mapOptional(rules, apiUpdatedRules),
                events_ttl: apiOptionUpdateV2(identity, eventsTimeToLiveMs),
                correlation_id: generateUint64(),
                gate_config:
                    gateConfig === undefined
                        ? "NoChange"
                        : gateConfig.gate.kind === "no_gate"
                          ? "SetToNone"
                          : { SetToSome: apiAccessGateConfig(gateConfig) },
                messages_visible_to_non_members: messagesVisibleToNonMembers,
            },
            updateGroupResponse,
            GroupUpdateGroupArgs,
            GroupUpdateGroupResponse,
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
        return this.executeMsgpackUpdate(
            "add_reaction",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
                username,
                display_name: displayName,
                correlation_id: generateUint64(),
                new_achievement: newAchievement,
            },
            addRemoveReactionResponse,
            GroupAddReactionArgs,
            GroupAddReactionResponse,
        );
    }

    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.executeMsgpackUpdate(
            "remove_reaction",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            },
            addRemoveReactionResponse,
            GroupRemoveReactionArgs,
            GroupRemoveReactionResponse,
        );
    }

    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        return this.executeMsgpackUpdate(
            "delete_messages",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
                correlation_id: generateUint64(),
                as_platform_moderator: asPlatformModerator,
                new_achievement: newAchievement,
            },
            deleteMessageResponse,
            GroupDeleteMessagesArgs,
            GroupDeleteMessagesResponse,
        );
    }

    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.executeMsgpackUpdate(
            "undelete_messages",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
                correlation_id: generateUint64(),
            },
            undeleteMessageResponse,
            GroupUndeleteMessagesArgs,
            GroupUndeleteMessagesResponse,
        );
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.executeMsgpackUpdate(
            "block_user",
            {
                user_id: principalStringToBytes(userId),
                correlation_id: generateUint64(),
            },
            blockUserResponse,
            GroupBlockUserArgs,
            GroupBlockUserResponse,
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.executeMsgpackUpdate(
            "unblock_user",
            {
                user_id: principalStringToBytes(userId),
                correlation_id: generateUint64(),
            },
            unblockUserResponse,
            GroupUnblockUserArgs,
            GroupUnblockUserResponse,
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
        return this.executeMsgpackQuery(
            "selected_initial",
            {},
            groupDetailsResponse,
            TEmpty,
            GroupSelectedInitialResponse,
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
        const updatesResponse = await this.executeMsgpackQuery(
            "selected_updates_v2",
            args,
            groupDetailsUpdatesResponse,
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

    getPublicSummary(): Promise<PublicGroupSummaryResponse> {
        const args = { invite_code: mapOptional(this.inviteCode, textToCode) };
        return this.executeMsgpackQuery(
            "public_summary",
            args,
            publicSummaryResponse,
            GroupPublicSummaryArgs,
            GroupPublicSummaryResponse,
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
                [...fromCache.missing],
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
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const args = {
            thread_root_message_index: undefined,
            messages: messageIndexes,
            invite_code: undefined,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "messages_by_message_index",
            args,
            (resp) =>
                getMessagesByMessageIndexResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    latestKnownUpdate,
                ),
            GroupMessagesByMessageIndexArgs,
            GroupMessagesByMessageIndexResponse,
        );
    }

    getDeletedMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        return this.executeMsgpackUpdate(
            "deleted_message",
            {
                message_id: messageId,
                thread_root_message_index: threadRootMessageIndex,
            },
            deletedMessageResponse,
            GroupDeletedMessageArgs,
            GroupDeletedMessageResponse,
        );
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.executeMsgpackUpdate(
            "pin_message_v2",
            {
                message_index: messageIndex,
                correlation_id: generateUint64(),
            },
            pinMessageResponse,
            GroupPinMessageArgs,
            GroupPinMessageResponse,
        );
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.executeMsgpackUpdate(
            "unpin_message",
            {
                message_index: messageIndex,
                correlation_id: generateUint64(),
            },
            unpinMessageResponse,
            GroupUnpinMessageArgs,
            GroupUnpinMessageResponse,
        );
    }

    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<RegisterPollVoteResponse> {
        return this.executeMsgpackUpdate(
            "register_poll_vote",
            {
                thread_root_message_index: threadRootMessageIndex,
                poll_option: answerIdx,
                operation: voteType === "register" ? "RegisterVote" : "DeleteVote",
                message_index: messageIdx,
                new_achievement: newAchievement,
                correlation_id: generateUint64(),
            },
            registerPollVoteResponse,
            GroupRegisterPollVoteArgs,
            GroupRegisterPollVoteResponse,
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
            users: userIds.map(principalStringToBytes),
        };
        return this.executeMsgpackQuery(
            "search_messages",
            args,
            (res) => searchGroupChatResponse(res, this.chatId),
            GroupSearchMessagesArgs,
            GroupSearchMessagesResponse,
        );
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.executeMsgpackQuery(
            "invite_code",
            {},
            inviteCodeResponse,
            TEmpty,
            GroupInviteCodeResponse,
        );
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.executeMsgpackUpdate(
            "enable_invite_code",
            {
                correlation_id: generateUint64(),
            },
            enableOrResetInviteCodeResponse,
            GroupEnableInviteCodeArgs,
            GroupEnableInviteCodeResponse,
        );
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.executeMsgpackUpdate(
            "disable_invite_code",
            {
                correlation_id: generateUint64(),
            },
            disableInviteCodeResponse,
            GroupDisableInviteCodeArgs,
            GroupDisableInviteCodeResponse,
        );
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.executeMsgpackUpdate(
            "reset_invite_code",
            {
                correlation_id: generateUint64(),
            },
            enableOrResetInviteCodeResponse,
            GroupEnableInviteCodeArgs,
            GroupEnableInviteCodeResponse,
        );
    }

    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined,
    ): Promise<ThreadPreviewsResponse> {
        return this.executeMsgpackQuery(
            "thread_previews",
            {
                threads: threadRootMessageIndexes,
                latest_client_thread_update: latestClientThreadUpdate,
            },
            (resp) => threadPreviewsResponse(resp, this.chatId, latestClientThreadUpdate),
            GroupThreadPreviewsArgs,
            GroupThreadPreviewsResponse,
        );
    }

    registerProposalVote(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.executeMsgpackUpdate(
            "register_proposal_vote",
            {
                adopt,
                message_index: messageIdx,
            },
            registerProposalVoteResponse,
            GroupRegisterProposalVoteArgs,
            GroupRegisterProposalVoteResponse,
        );
    }

    registerProposalVoteV2(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.executeMsgpackUpdate(
            "register_proposal_vote_v2",
            {
                adopt,
                message_index: messageIdx,
            },
            registerProposalVoteResponse,
            GroupRegisterProposalVoteV2Args,
            GroupRegisterProposalVoteV2Response,
        );
    }

    localUserIndex(): Promise<string> {
        return this.executeMsgpackQuery(
            "local_user_index",
            {},
            (resp) => principalBytesToString(resp.Success),
            TEmpty,
            GroupLocalUserIndexResponse,
        );
    }

    declineInvitation(): Promise<DeclineInvitationResponse> {
        return this.executeMsgpackUpdate(
            "decline_invitation",
            {},
            declineInvitationResponse,
            TEmpty,
            GroupDeclineInvitiationResponse,
        );
    }

    toggleMuteNotifications(mute: boolean): Promise<ToggleMuteNotificationResponse> {
        return this.executeMsgpackUpdate(
            "toggle_mute_notifications",
            { mute },
            toggleNotificationsResponse,
            GroupToggleMuteNotificationsArgs,
            GroupToggleMuteNotificationsResponse,
        );
    }

    convertToCommunity(historyVisible: boolean, rules: Rules): Promise<ConvertToCommunityResponse> {
        return this.executeMsgpackUpdate(
            "convert_into_community",
            {
                history_visible_to_new_joiners: historyVisible,
                primary_language: undefined,
                permissions: undefined,
                rules,
            },
            convertToCommunityResponse,
            GroupConvertIntoCommunityArgs,
            GroupConvertIntoCommunityResponse,
        );
    }

    followThread(
        threadRootMessageIndex: number,
        follow: boolean,
        newAchievement: boolean,
    ): Promise<FollowThreadResponse> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            new_achievement: newAchievement,
        };
        return this.executeMsgpackUpdate(
            follow ? "follow_thread" : "unfollow_thread",
            args,
            followThreadResponse,
            GroupFollowThreadArgs,
            GroupFollowThreadResponse,
        );
    }

    reportMessage(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "report_message",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                delete: deleteMessage,
            },
            reportMessageResponse,
            GroupReportMessageArgs,
            GroupReportMessageResponse,
        );
    }

    acceptP2PSwap(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
    ): Promise<AcceptP2PSwapResponse> {
        return this.executeMsgpackUpdate(
            "accept_p2p_swap",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                pin,
                new_achievement: newAchievement,
            },
            acceptP2PSwapResponse,
            GroupAcceptP2pSwapArgs,
            GroupAcceptP2pSwapResponse,
        );
    }

    cancelP2PSwap(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        return this.executeMsgpackUpdate(
            "cancel_p2p_swap",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
            },
            cancelP2PSwapResponse,
            GroupCancelP2pSwapArgs,
            GroupCancelP2pSwapResponse,
        );
    }

    joinVideoCall(messageId: bigint, newAchievement: boolean): Promise<JoinVideoCallResponse> {
        return this.executeMsgpackUpdate(
            "join_video_call",
            {
                message_id: messageId,
                new_achievement: newAchievement,
            },
            joinVideoCallResponse,
            GroupJoinVideoCallArgs,
            GroupSetVideoCallPresenceResponse,
        );
    }

    setVideoCallPresence(
        messageId: bigint,
        presence: VideoCallPresence,
        newAchievement: boolean,
    ): Promise<SetVideoCallPresenceResponse> {
        return this.executeMsgpackUpdate(
            "set_video_call_presence",
            {
                message_id: messageId,
                presence: apiVideoCallPresence(presence),
                new_achievement: newAchievement,
            },
            setVideoCallPresence,
            GroupSetVideoCallPresenceArgs,
            GroupSetVideoCallPresenceResponse,
        );
    }

    videoCallParticipants(
        messageId: bigint,
        updatesSince?: bigint,
    ): Promise<VideoCallParticipantsResponse> {
        return this.executeMsgpackQuery(
            "video_call_participants",
            {
                message_id: messageId,
                updated_since: updatesSince,
            },
            videoCallParticipantsResponse,
            GroupVideoCallParticipantsArgs,
            GroupVideoCallParticipantsResponse,
        );
    }

    cancelInvites(userIds: string[]): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "cancel_invites",
            {
                user_ids: userIds.map(principalStringToBytes),
            },
            (value) => value === "Success",
            GroupCancelInvitesArgs,
            GroupCancelInvitesResponse,
        );
    }

    addBot(botId: string, grantedPermissions: SlashCommandPermissions): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "add_bot",
            {
                bot_id: principalStringToBytes(botId),
                granted_permissions: {
                    chat: grantedPermissions.chatPermissions.map(apiChatPermission),
                    community: grantedPermissions.communityPermissions.map(apiCommunityPermission),
                    message: grantedPermissions.messagePermissions.map(apiMessagePermission),
                    thread: grantedPermissions.messagePermissions.map(apiMessagePermission),
                },
            },
            addBotResponse,
            GroupAddBotArgs,
            GroupAddBotResponse,
        );
    }

    updateBot(botId: string, grantedPermissions: SlashCommandPermissions): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "update_bot",
            {
                bot_id: principalStringToBytes(botId),
                granted_permissions: {
                    chat: grantedPermissions.chatPermissions.map(apiChatPermission),
                    community: grantedPermissions.communityPermissions.map(apiCommunityPermission),
                    message: grantedPermissions.messagePermissions.map(apiMessagePermission),
                    thread: grantedPermissions.messagePermissions.map(apiMessagePermission),
                },
            },
            updateBotResponse,
            GroupUpdateBotArgs,
            GroupUpdateBotResponse,
        );
    }

    removeBot(botId: string): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "remove_bot",
            {
                bot_id: principalStringToBytes(botId),
            },
            removeBotResponse,
            GroupRemoveBotArgs,
            GroupRemoveBotResponse,
        );
    }
}
