import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type {
    ApiChannelMessagesRead,
    ApiChat,
    ApiChatInList,
    ApiChatMessagesRead,
    ApiMarkReadArgs,
    ApiSendMessageWithTransferToChannelArgs,
    ApiSendMessageWithTransferToGroupArgs,
    UserService,
} from "./candid/idl";
import { idlFactory } from "./candid/idl";
import type {
    InitialStateResponse,
    UpdatesResponse,
    EventsResponse,
    CandidateGroupChat,
    CreateGroupResponse,
    DeleteGroupResponse,
    Message,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    IndexRange,
    AddRemoveReactionResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    MarkReadRequest,
    WithdrawCryptocurrencyResponse,
    PendingCryptocurrencyWithdrawal,
    ArchiveChatResponse,
    BlobReference,
    CreatedUser,
    PinChatResponse,
    PublicProfile,
    SearchDirectChatResponse,
    SetBioResponse,
    ToggleMuteNotificationResponse,
    UnpinChatResponse,
    DeletedDirectMessageResponse,
    EventWrapper,
    SetMessageReminderResponse,
    ChatEvent,
    EventsSuccessResult,
    CommunitySummary,
    CreateCommunityResponse,
    ChatIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
    ThreadRead,
    ManageFavouritesResponse,
    CommunityIdentifier,
    LeaveCommunityResponse,
    DeleteCommunityResponse,
    ChannelIdentifier,
    Rules,
    TipMessageResponse,
    NamedAccount,
    SaveCryptoAccountResponse,
    CandidateProposal,
    SubmitProposalResponse,
    CryptocurrencyDetails,
    ExchangeTokenSwapArgs,
    SwapTokensResponse,
    TokenSwapStatusResponse,
    ApproveTransferResponse,
    MessageContext,
    PendingCryptocurrencyTransfer,
    AcceptP2PSwapResponse,
    CancelP2PSwapResponse,
    JoinVideoCallResponse,
    ChitEventsRequest,
    ChitEventsResponse,
    ClaimDailyChitResponse,
    WalletConfig,
    Verification,
    MessageActivityFeedResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    blockResponse,
    deleteMessageResponse,
    undeleteMessageResponse,
    getEventsResponse,
    getUpdatesResponse,
    initialStateResponse,
    markReadResponse,
    searchDirectChatResponse,
    setAvatarResponse,
    setBioResponse,
    unblockResponse,
    withdrawCryptoResponse,
    sendMessageWithTransferToChannelResponse,
    sendMessageWithTransferToGroupResponse,
    publicProfileResponse,
    pinChatResponse,
    unpinChatResponse,
    archiveChatResponse,
    deletedMessageResponse,
    setMessageReminderResponse,
    createCommunityResponse,
    manageFavouritesResponse,
    leaveCommunityResponse,
    deleteCommunityResponse,
    tipMessageResponse,
    savedCryptoAccountsResponse,
    saveCryptoAccountResponse,
    proposalToSubmit,
    submitProposalResponse,
    reportMessageResponse,
    swapTokensResponse,
    tokenSwapStatusResponse,
    approveTransferResponse,
    apiExchangeArgs,
    chitEventsResponse,
    claimDailyChitResponse,
    apiWalletConfig,
    apiVerification,
    messageActivityFeedResponse,
} from "./mappers";
import { sendMessageResponse } from "./mappersV2";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import {
    apiCommunityPermissions,
    apiGroupPermissions,
    apiMaybeAccessGate,
    apiMessageContent,
    editMessageResponse,
    apiOptional,
    apiPendingCryptocurrencyWithdrawal,
    apiReplyContextArgs,
    addRemoveReactionResponse,
    createGroupResponse,
    leaveGroupResponse,
    deleteGroupResponse,
    apiChatIdentifier,
    apiToken,
    acceptP2PSwapResponse,
    cancelP2PSwapResponse,
    joinVideoCallResponse,
    setPinNumberResponse,
    apiMaybeAccessGateConfig,
} from "../common/chatMappers";
import {
    apiMessageContent as apiMessageContentV2,
    apiReplyContextArgs as apiReplyContextArgsV2,
} from "../common/chatMappersV2";
import { DataClient } from "../data/data.client";
import { muteNotificationsResponse } from "../notifications/mappers";
import { identity, mapOptional, principalStringToBytes, toVoid } from "../../utils/mapping";
import { generateUint64 } from "../../utils/rng";
import type { AgentConfig } from "../../config";
import { MAX_EVENTS, MAX_MESSAGES, MAX_MISSING, ResponseTooLargeError } from "openchat-shared";
import type { EditMessageV2Args } from "./candid/types";
import {
    chunkedChatEventsFromBackend,
    chunkedChatEventsWindowFromBackend,
} from "../common/chunked";
import type { SetPinNumberResponse } from "openchat-shared";
import { setChitInfoInCache } from "../../utils/userCache";
import { UserSendMessageArgs, UserSendMessageResponse } from "../../typebox";

export class UserClient extends CandidService {
    private userService: UserService;
    userId: string;
    private chatId: DirectChatIdentifier;

    constructor(
        userId: string,
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private db: Database,
    ) {
        super(identity, agent, userId);
        this.userId = userId;
        this.chatId = { kind: "direct_chat", userId: userId };
        this.userService = this.createServiceClient<UserService>(idlFactory);
    }

    private setCachedEvents(
        chatId: ChatIdentifier,
        resp: EventsResponse<ChatEvent>,
        threadRootMessageIndex?: number,
    ): EventsResponse<ChatEvent> {
        setCachedEvents(this.db, chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err),
        );
        return resp;
    }

    private handleMissingEvents(
        chatId: DirectChatIdentifier,
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                [...missing],
                chatId,
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

    addToFavourites(chatId: ChatIdentifier): Promise<ManageFavouritesResponse> {
        return this.handleResponse(
            this.userService.manage_favourite_chats({
                to_add: [apiChatIdentifier(chatId)],
                to_remove: [],
            }),
            manageFavouritesResponse,
        );
    }

    removeFromFavourites(chatId: ChatIdentifier): Promise<ManageFavouritesResponse> {
        return this.handleResponse(
            this.userService.manage_favourite_chats({
                to_add: [],
                to_remove: [apiChatIdentifier(chatId)],
            }),
            manageFavouritesResponse,
        );
    }

    getInitialState(): Promise<InitialStateResponse> {
        const args = {
            disable_cache: apiOptional(identity, true),
        };
        return this.handleQueryResponse(
            () => this.userService.initial_state(args),
            initialStateResponse,
            args,
        );
    }

    getUpdates(updatesSince: bigint): Promise<UpdatesResponse> {
        const args = {
            updates_since: updatesSince,
        };
        return this.handleQueryResponse(
            () => this.userService.updates(args),
            getUpdatesResponse,
            args,
        );
    }

    createCommunity(
        community: CommunitySummary,
        rules: Rules,
        defaultChannels: string[],
        defaultChannelRules: Rules,
    ): Promise<CreateCommunityResponse> {
        return this.handleResponse(
            this.userService.create_community({
                is_public: community.public,
                name: community.name,
                description: community.description,
                history_visible_to_new_joiners: community.historyVisible,
                avatar: apiOptional(
                    (data) => {
                        return {
                            id: DataClient.newBlobId(),
                            data,
                            mime_type: "image/jpg",
                        };
                    },
                    community.avatar?.blobData,
                ),
                banner: apiOptional(
                    (data) => {
                        return {
                            id: DataClient.newBlobId(),
                            data,
                            mime_type: "image/jpg",
                        };
                    },
                    community.banner?.blobData,
                ),
                permissions: [apiCommunityPermissions(community.permissions)],
                rules,
                gate_config: apiMaybeAccessGateConfig(community.gateConfig),
                gate: apiMaybeAccessGate(community.gateConfig.gate),
                default_channels: defaultChannels,
                default_channel_rules: [defaultChannelRules],
                primary_language: community.primaryLanguage,
            }),
            createCommunityResponse,
        );
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.handleResponse(
            this.userService.create_group({
                is_public: group.public,
                name: group.name,
                description: group.description,
                history_visible_to_new_joiners: group.historyVisible,
                avatar: apiOptional(
                    (data) => {
                        return {
                            id: DataClient.newBlobId(),
                            data,
                            mime_type: "image/jpg",
                        };
                    },
                    group.avatar?.blobData,
                ),
                permissions_v2: [apiGroupPermissions(group.permissions)],
                rules: group.rules,
                gate: apiMaybeAccessGate(group.gateConfig.gate),
                gate_config: apiMaybeAccessGateConfig(group.gateConfig),
                events_ttl: apiOptional(identity, group.eventsTTL),
                messages_visible_to_non_members: apiOptional(
                    identity,
                    group.messagesVisibleToNonMembers,
                ),
            }),
            (resp) => createGroupResponse(resp, group.id),
        );
    }

    deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.handleResponse(
            this.userService.delete_group({
                chat_id: Principal.fromText(chatId),
            }),
            deleteGroupResponse,
        );
    }

    deleteCommunity(id: CommunityIdentifier): Promise<DeleteCommunityResponse> {
        return this.handleResponse(
            this.userService.delete_community({
                community_id: Principal.fromText(id.communityId),
            }),
            deleteCommunityResponse,
        );
    }

    chatEventsByIndex(
        eventIndexes: number[],
        chatId: DirectChatIdentifier,
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

    private chatEventsByIndexFromBackend(
        eventIndexes: number[],
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            user_id: Principal.fromText(chatId.userId),
            events: new Uint32Array(eventIndexes),
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.userService.events_by_index(args),
            (resp) => getEventsResponse(this.principal, resp, chatId, latestKnownUpdate),
            args,
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindowByMessageIndex(
            this.db,
            eventIndexRange,
            { chatId },
            messageIndex,
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss,
            );
            return this.chatEventsWindowFromBackend(chatId, messageIndex, latestKnownUpdate)
                .then((resp) => this.setCachedEvents(chatId, resp))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the window request into a a few chunks",
                        );
                        return chunkedChatEventsWindowFromBackend(
                            (index: number, ascending: boolean, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    chatId,
                                    index,
                                    ascending,
                                    undefined,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            (index: number, chunkSize: number) =>
                                this.chatEventsWindowFromBackend(
                                    chatId,
                                    index,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            messageIndex,
                        ).then((resp) => this.setCachedEvents(chatId, resp));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                undefined,
                latestKnownUpdate,
            );
        }
    }

    private async chatEventsWindowFromBackend(
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const thread_root_message_index: [] = [];
        const args = {
            thread_root_message_index,
            user_id: Principal.fromText(chatId.userId),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.userService.events_window(args),
            (resp) => getEventsResponse(this.principal, resp, chatId, latestKnownUpdate),
            args,
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
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
            return this.chatEventsFromBackend(
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
                                this.chatEventsFromBackend(
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

    private chatEventsFromBackend(
        chatId: DirectChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            user_id: Principal.fromText(chatId.userId),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            start_index: startIndex,
            ascending: ascending,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };

        return this.handleQueryResponse(
            () => this.userService.events(args),
            (resp) => getEventsResponse(this.principal, resp, chatId, latestKnownUpdate),
            args,
        );
    }

    setAvatar(bytes: Uint8Array): Promise<BlobReference> {
        const blobId = DataClient.newBlobId();
        return this.handleResponse(
            this.userService.set_avatar({
                avatar: apiOptional(identity, {
                    id: blobId,
                    data: bytes,
                    mime_type: "image/jpg",
                }),
            }),
            setAvatarResponse,
        ).then((resp) => {
            if (resp === "success") {
                return {
                    blobId,
                    canisterId: this.userId,
                };
            }
            throw new Error("Unable to set avatar");
        });
    }

    editMessage(
        recipientId: string,
        message: Message,
        threadRootMessageIndex?: number,
        blockLevelMarkdown?: boolean,
    ): Promise<EditMessageResponse> {
        return new DataClient(this.identity, this.agent, this.config)
            .uploadData(message.content, [this.userId, recipientId])
            .then((content) => {
                const req: EditMessageV2Args = {
                    content: apiMessageContent(content ?? message.content),
                    user_id: Principal.fromText(recipientId),
                    thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                    message_id: message.messageId,
                    correlation_id: generateUint64(),
                    block_level_markdown:
                        blockLevelMarkdown === undefined ? [] : [blockLevelMarkdown],
                };
                return this.handleResponse(
                    this.userService.edit_message_v2(req),
                    editMessageResponse,
                );
            });
    }

    sendMessage(
        chatId: DirectChatIdentifier,
        event: EventWrapper<Message>,
        messageFilterFailed: bigint | undefined,
        threadRootMessageIndex: number | undefined,
        pin: string | undefined,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);
        return this.sendMessageToBackend(
            chatId,
            event,
            messageFilterFailed,
            threadRootMessageIndex,
            pin,
            onRequestAccepted,
        )
            .then(
                setCachedMessageFromSendResponse(
                    this.db,
                    this.chatId,
                    event,
                    threadRootMessageIndex,
                ),
            )
            .catch((err) => {
                recordFailedMessage(this.db, this.chatId, event, threadRootMessageIndex);
                throw err;
            });
    }

    sendMessageToBackend(
        chatId: DirectChatIdentifier,
        event: EventWrapper<Message>,
        messageFilterFailed: bigint | undefined,
        threadRootMessageIndex: number | undefined,
        pin: string | undefined,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        const dataClient = new DataClient(this.identity, this.agent, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.userId, chatId.userId])
            : dataClient.uploadData(event.event.content, [this.userId, chatId.userId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const req = {
                content: apiMessageContentV2(newContent),
                recipient: principalStringToBytes(chatId.userId),
                message_id: event.event.messageId,
                replies_to: mapOptional(event.event.repliesTo, (replyContext) =>
                    apiReplyContextArgsV2(chatId, replyContext),
                ),
                forwarding: event.event.forwarded,
                thread_root_message_index: threadRootMessageIndex,
                message_filter_failed: messageFilterFailed,
                pin,
                correlation_id: generateUint64(),
                block_level_markdown: event.event.blockLevelMarkdown,
            };
            return this.executeMsgpackUpdate(
                "send_message_v2",
                req,
                (resp) => sendMessageResponse(resp, event.event.sender, chatId.userId),
                UserSendMessageArgs,
                UserSendMessageResponse,
                onRequestAccepted,
            ).then((resp) => [resp, { ...event.event, content: newContent }]);
        });
    }

    sendMessageWithTransferToGroup(
        groupId: GroupChatIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);
        return this.sendMessageWithTransferToGroupToBackend(
            groupId,
            recipientId,
            sender,
            event,
            threadRootMessageIndex,
            rulesAccepted,
            messageFilterFailed,
            pin,
        )
            .then(setCachedMessageFromSendResponse(this.db, groupId, event, threadRootMessageIndex))
            .catch((err) => {
                recordFailedMessage(this.db, groupId, event);
                throw err;
            });
    }

    private sendMessageWithTransferToGroupToBackend(
        groupId: GroupChatIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        const content = apiMessageContent(event.event.content);

        const req: ApiSendMessageWithTransferToGroupArgs = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            content,
            sender_name: sender.username,
            sender_display_name: apiOptional(identity, sender.displayName),
            rules_accepted: apiOptional(identity, rulesAccepted),
            mentioned: [],
            message_id: event.event.messageId,
            group_id: Principal.fromText(groupId.groupId),
            replies_to: apiOptional(
                (replyContext) => apiReplyContextArgs(groupId, replyContext),
                event.event.repliesTo,
            ),
            block_level_markdown: true,
            message_filter_failed: apiOptional(identity, messageFilterFailed),
            pin: apiOptional(identity, pin),
            correlation_id: generateUint64(),
        };
        return this.handleResponse(
            this.userService.send_message_with_transfer_to_group(req),
            (resp) => sendMessageWithTransferToGroupResponse(resp, event.event.sender, recipientId),
        ).then((resp) => [resp, event.event]);
    }

    loadSavedCryptoAccounts(): Promise<NamedAccount[]> {
        return this.handleQueryResponse(
            () => this.userService.saved_crypto_accounts({}),
            savedCryptoAccountsResponse,
        );
    }

    saveCryptoAccount({ name, account }: NamedAccount): Promise<SaveCryptoAccountResponse> {
        return this.handleResponse(
            this.userService.save_crypto_account({
                name,
                account,
            }),
            saveCryptoAccountResponse,
        );
    }

    sendMessageWithTransferToChannel(
        id: ChannelIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        communityRulesAccepted: number | undefined,
        channelRulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);
        return this.sendMessageWithTransferToChannelToBackend(
            id,
            recipientId,
            sender,
            event,
            threadRootMessageIndex,
            communityRulesAccepted,
            channelRulesAccepted,
            messageFilterFailed,
            pin,
        )
            .then(setCachedMessageFromSendResponse(this.db, id, event, threadRootMessageIndex))
            .catch((err) => {
                recordFailedMessage(this.db, id, event);
                throw err;
            });
    }

    private sendMessageWithTransferToChannelToBackend(
        id: ChannelIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        communityRulesAccepted: number | undefined,
        channelRulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        const content = apiMessageContent(event.event.content);

        const req: ApiSendMessageWithTransferToChannelArgs = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            content,
            sender_name: sender.username,
            sender_display_name: apiOptional(identity, sender.displayName),
            mentioned: [],
            message_id: event.event.messageId,
            community_id: Principal.fromText(id.communityId),
            channel_id: BigInt(id.channelId),
            replies_to: apiOptional(
                (replyContext) => apiReplyContextArgs(id, replyContext),
                event.event.repliesTo,
            ),
            block_level_markdown: true,
            community_rules_accepted: apiOptional(identity, communityRulesAccepted),
            channel_rules_accepted: apiOptional(identity, channelRulesAccepted),
            message_filter_failed: apiOptional(identity, messageFilterFailed),
            pin: apiOptional(identity, pin),
        };
        return this.handleResponse(
            this.userService.send_message_with_transfer_to_channel(req),
            (resp) =>
                sendMessageWithTransferToChannelResponse(resp, event.event.sender, recipientId),
        ).then((resp) => [resp, event.event]);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.userService.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockResponse,
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.userService.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockResponse,
        );
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.handleResponse(
            this.userService.leave_group({
                chat_id: Principal.fromText(chatId),
                correlation_id: generateUint64(),
            }),
            leaveGroupResponse,
        );
    }

    leaveCommunity(id: CommunityIdentifier): Promise<LeaveCommunityResponse> {
        return this.handleResponse(
            this.userService.leave_community({
                community_id: Principal.fromText(id.communityId),
            }),
            leaveCommunityResponse,
        );
    }

    private markMessageArg(
        chatId: string,
        readUpTo: number | undefined,
        threads: ThreadRead[],
        dateReadPinned: bigint | undefined,
    ) {
        return {
            chat_id: Principal.fromText(chatId),
            read_up_to: apiOptional(identity, readUpTo),
            threads: threads.map((t) => ({
                root_message_index: t.threadRootMessageIndex,
                read_up_to: t.readUpTo,
            })),
            date_read_pinned: apiOptional(identity, dateReadPinned),
        };
    }

    private markChannelMessageArg(
        channelId: string,
        readUpTo: number | undefined,
        threads: ThreadRead[],
        dateReadPinned: bigint | undefined,
    ) {
        return {
            channel_id: BigInt(channelId),
            read_up_to: apiOptional(identity, readUpTo),
            threads: threads.map((t) => ({
                root_message_index: t.threadRootMessageIndex,
                read_up_to: t.readUpTo,
            })),
            date_read_pinned: apiOptional(identity, dateReadPinned),
        };
    }

    private markMessageArgs(req: MarkReadRequest): ApiMarkReadArgs {
        const community: Record<string, ApiChannelMessagesRead[]> = {};
        const chat: ApiChatMessagesRead[] = [];

        req.forEach(({ chatId, readUpTo, threads, dateReadPinned }) => {
            if (chatId.kind === "direct_chat") {
                chat.push(this.markMessageArg(chatId.userId, readUpTo, threads, dateReadPinned));
            }
            if (chatId.kind === "group_chat") {
                chat.push(this.markMessageArg(chatId.groupId, readUpTo, threads, dateReadPinned));
            }
            if (chatId.kind === "channel") {
                if (community[chatId.communityId] === undefined) {
                    community[chatId.communityId] = [];
                }
                community[chatId.communityId].push(
                    this.markChannelMessageArg(chatId.channelId, readUpTo, threads, dateReadPinned),
                );
            }
        });

        return {
            messages_read: chat,
            community_messages_read: Object.entries(community).map(([communityId, read]) => ({
                community_id: Principal.fromText(communityId),
                channels_read: read,
            })),
        };
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.handleResponse(
            this.userService.mark_read(this.markMessageArgs(request)),
            markReadResponse,
        );
    }

    tipMessage(
        messageContext: MessageContext,
        messageId: bigint,
        transfer: PendingCryptocurrencyTransfer,
        decimals: number,
        pin: string | undefined,
    ): Promise<TipMessageResponse> {
        return this.handleResponse(
            this.userService.tip_message({
                chat: apiChatIdentifier(messageContext.chatId),
                message_id: messageId,
                fee: transfer.feeE8s ?? 0n,
                decimals,
                token: apiToken(transfer.token),
                recipient: Principal.fromText(transfer.recipient),
                ledger: Principal.fromText(transfer.ledger),
                amount: transfer.amountE8s,
                thread_root_message_index: apiOptional(
                    identity,
                    messageContext.threadRootMessageIndex,
                ),
                pin: apiOptional(identity, pin),
            }),
            tipMessageResponse,
        );
    }

    addReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.userService.add_reaction({
                user_id: Principal.fromText(otherUserId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse,
            newAchievement,
        );
    }

    removeReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.userService.remove_reaction({
                user_id: Principal.fromText(otherUserId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse,
        );
    }

    deleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.userService.delete_messages({
                user_id: Principal.fromText(otherUserId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            deleteMessageResponse,
        );
    }

    undeleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.handleResponse(
            this.userService.undelete_messages({
                user_id: Principal.fromText(otherUserId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            undeleteMessageResponse,
        );
    }

    searchDirectChat(
        chatId: DirectChatIdentifier,
        searchTerm: string,
        maxResults: number,
    ): Promise<SearchDirectChatResponse> {
        const args = {
            user_id: Principal.fromText(chatId.userId),
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.userService.search_messages(args),
            (res) => searchDirectChatResponse(res, chatId),
            args,
        );
    }

    toggleMuteNotifications(
        chatId: string,
        muted: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        if (muted) {
            return this.handleResponse(
                this.userService.mute_notifications({
                    chat_id: Principal.fromText(chatId),
                }),
                muteNotificationsResponse,
            );
        } else {
            return this.handleResponse(
                this.userService.unmute_notifications({
                    chat_id: Principal.fromText(chatId),
                }),
                muteNotificationsResponse,
            );
        }
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.handleResponse(
            this.userService.add_hot_group_exclusions({
                duration: [],
                groups: [Principal.fromText(chatId)],
            }),
            toVoid,
        );
    }

    getBio(): Promise<string> {
        return this.handleQueryResponse(
            () => this.userService.bio({}),
            (candid) => candid.Success,
        );
    }

    getPublicProfile(): Promise<PublicProfile> {
        return this.handleQueryResponse(
            () => this.userService.public_profile({}),
            publicProfileResponse,
        );
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.handleResponse(this.userService.set_bio({ text: bio }), setBioResponse);
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
        pin: string | undefined,
    ): Promise<WithdrawCryptocurrencyResponse> {
        const req = apiPendingCryptocurrencyWithdrawal(domain, pin);
        return this.handleResponse(
            this.userService.withdraw_crypto_v2(req),
            withdrawCryptoResponse,
        );
    }

    private toChat(chatId: ChatIdentifier): ApiChat {
        switch (chatId.kind) {
            case "direct_chat":
                return { Direct: Principal.fromText(chatId.userId) };
            case "group_chat":
                return { Group: Principal.fromText(chatId.groupId) };
            case "channel":
                return {
                    Channel: [Principal.fromText(chatId.communityId), BigInt(chatId.channelId)],
                };
        }
    }

    private toChatInList(chatId: ChatIdentifier, favourite: boolean): ApiChatInList {
        if (favourite) {
            return {
                Favourite: this.toChat(chatId),
            };
        } else {
            switch (chatId.kind) {
                case "direct_chat":
                    return { Direct: Principal.fromText(chatId.userId) };
                case "group_chat":
                    return { Group: Principal.fromText(chatId.groupId) };
                case "channel":
                    return {
                        Community: [
                            Principal.fromText(chatId.communityId),
                            BigInt(chatId.channelId),
                        ],
                    };
            }
        }
    }

    pinChat(chatId: ChatIdentifier, favourite: boolean): Promise<PinChatResponse> {
        return this.handleResponse(
            this.userService.pin_chat_v2({
                chat: this.toChatInList(chatId, favourite),
            }),

            pinChatResponse,
        );
    }

    unpinChat(chatId: ChatIdentifier, favourite: boolean): Promise<UnpinChatResponse> {
        return this.handleResponse(
            this.userService.unpin_chat_v2({
                chat: this.toChatInList(chatId, favourite),
            }),
            unpinChatResponse,
        );
    }

    archiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        return this.handleResponse(
            this.userService.archive_unarchive_chats({
                to_archive: [apiChatIdentifier(chatId)],
                to_unarchive: [],
            }),
            archiveChatResponse,
        );
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        return this.handleResponse(
            this.userService.archive_unarchive_chats({
                to_unarchive: [apiChatIdentifier(chatId)],
                to_archive: [],
            }),
            archiveChatResponse,
        );
    }

    getDeletedMessage(userId: string, messageId: bigint): Promise<DeletedDirectMessageResponse> {
        return this.handleResponse(
            this.userService.deleted_message({
                user_id: Principal.fromText(userId),
                message_id: messageId,
            }),
            deletedMessageResponse,
        );
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number,
    ): Promise<SetMessageReminderResponse> {
        return this.handleResponse(
            this.userService.set_message_reminder_v2({
                chat: apiChatIdentifier(chatId),
                notes: apiOptional(identity, notes),
                remind_at: BigInt(remindAt),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                event_index: eventIndex,
            }),
            setMessageReminderResponse,
        );
    }

    cancelMessageReminder(reminderId: bigint): Promise<boolean> {
        return this.handleResponse(
            this.userService.cancel_message_reminder({
                reminder_id: reminderId,
            }),
            (_) => true,
        );
    }

    setCommunityIndexes(communityIndexes: Record<string, number>): Promise<boolean> {
        const indexes: [Principal, number][] = Object.entries(communityIndexes).map(([id, idx]) => [
            Principal.fromText(id),
            idx,
        ]);
        return this.handleResponse(
            this.userService.set_community_indexes({ indexes }),
            (_) => true,
        );
    }

    submitProposal(
        governanceCanisterId: string,
        proposal: CandidateProposal,
        ledger: string,
        token: string,
        proposalRejectionFee: bigint,
        transactionFee: bigint,
    ): Promise<SubmitProposalResponse> {
        return this.handleResponse(
            this.userService.submit_proposal({
                governance_canister_id: Principal.fromText(governanceCanisterId),
                proposal: proposalToSubmit(proposal),
                ledger: Principal.fromText(ledger),
                token: apiToken(token),
                proposal_rejection_fee: proposalRejectionFee,
                transaction_fee: transactionFee,
            }),
            submitProposalResponse,
        );
    }

    reportMessage(
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.handleResponse(
            this.userService.report_message({
                them: Principal.fromText(chatId.userId),
                message_id: messageId,
                delete: deleteMessage,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            reportMessageResponse,
        );
    }

    swapTokens(
        swapId: bigint,
        inputToken: CryptocurrencyDetails,
        outputToken: CryptocurrencyDetails,
        amountIn: bigint,
        minAmountOut: bigint,
        exchangeArgs: ExchangeTokenSwapArgs,
        pin: string | undefined,
    ): Promise<SwapTokensResponse> {
        return this.handleResponse(
            this.userService.swap_tokens({
                swap_id: swapId,
                input_token: {
                    token: apiToken(inputToken.symbol),
                    ledger: Principal.fromText(inputToken.ledger),
                    decimals: inputToken.decimals,
                    fee: inputToken.transferFee,
                },
                output_token: {
                    token: apiToken(outputToken.symbol),
                    ledger: Principal.fromText(outputToken.ledger),
                    decimals: outputToken.decimals,
                    fee: outputToken.transferFee,
                },
                input_amount: amountIn,
                exchange_args: apiExchangeArgs(exchangeArgs),
                min_output_amount: minAmountOut,
                pin: apiOptional(identity, pin),
            }),
            swapTokensResponse,
        );
    }

    tokenSwapStatus(swapId: bigint): Promise<TokenSwapStatusResponse> {
        const args = {
            swap_id: swapId,
        };
        return this.handleQueryResponse(
            () => this.userService.token_swap_status(args),
            tokenSwapStatusResponse,
            args,
        );
    }

    approveTransfer(
        spender: string,
        ledger: string,
        amount: bigint,
        expiresIn: bigint | undefined,
        pin: string | undefined,
    ): Promise<ApproveTransferResponse> {
        return this.handleResponse(
            this.userService.approve_transfer({
                spender: {
                    owner: Principal.fromText(spender),
                    subaccount: [],
                },
                ledger_canister_id: Principal.fromText(ledger),
                amount,
                expires_in: apiOptional(identity, expiresIn),
                pin: apiOptional(identity, pin),
            }),
            approveTransferResponse,
        );
    }

    deleteDirectChat(userId: string, blockUser: boolean): Promise<boolean> {
        return this.handleResponse(
            this.userService.delete_direct_chat({
                user_id: Principal.fromText(userId),
                block_user: blockUser,
            }),
            (resp) => "Success" in resp,
        );
    }

    acceptP2PSwap(
        userId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
    ): Promise<AcceptP2PSwapResponse> {
        return this.handleResponse(
            this.userService.accept_p2p_swap({
                user_id: Principal.fromText(userId),
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                pin: apiOptional(identity, pin),
            }),
            acceptP2PSwapResponse,
        );
    }

    cancelP2PSwap(userId: string, messageId: bigint): Promise<CancelP2PSwapResponse> {
        return this.handleResponse(
            this.userService.cancel_p2p_swap({
                user_id: Principal.fromText(userId),
                message_id: messageId,
            }),
            cancelP2PSwapResponse,
        );
    }

    joinVideoCall(userId: string, messageId: bigint): Promise<JoinVideoCallResponse> {
        return this.handleResponse(
            this.userService.join_video_call({
                user_id: Principal.fromText(userId),
                message_id: messageId,
            }),
            joinVideoCallResponse,
        );
    }

    localUserIndex(): Promise<string> {
        return this.handleQueryResponse(
            () => this.userService.local_user_index({}),
            (resp) => resp.Success.toString(),
        );
    }

    setPinNumber(
        verification: Verification,
        newPin: string | undefined,
    ): Promise<SetPinNumberResponse> {
        return this.handleResponse(
            this.userService.set_pin_number({
                verification: apiVerification(verification),
                new: apiOptional(identity, newPin),
            }),
            setPinNumberResponse,
        );
    }

    chitEvents({ from, to, max, ascending }: ChitEventsRequest): Promise<ChitEventsResponse> {
        return this.handleQueryResponse(
            () =>
                this.userService.chit_events({
                    from: apiOptional(identity, from),
                    to: apiOptional(identity, to),
                    max,
                    ascending,
                    skip: [],
                }),
            chitEventsResponse,
        );
    }

    markAchievementsSeen(lastSeen: bigint): Promise<void> {
        return this.handleResponse(
            this.userService.mark_achievements_seen({
                last_seen: lastSeen,
            }),
            (res) => {
                console.log("Set Achievements Last seen", lastSeen, res);
            },
        );
    }

    claimDailyChit(): Promise<ClaimDailyChitResponse> {
        return this.handleQueryResponse(
            () => this.userService.claim_daily_chit({}),
            claimDailyChitResponse,
        ).then((res) => {
            if (res.kind === "success") {
                // Note this only updates the users db, the chats db will be updated by the updates loop
                setChitInfoInCache(this.userId, res.chitBalance, res.streak);
            }
            return res;
        });
    }

    configureWallet(walletConfig: WalletConfig): Promise<void> {
        return this.handleResponse(
            this.userService.configure_wallet({
                config: apiWalletConfig(walletConfig),
            }),
            toVoid,
        );
    }

    markActivityFeedRead(timestamp: bigint): Promise<void> {
        return this.handleResponse(
            this.userService.mark_message_activity_feed_read({
                read_up_to: timestamp,
            }),
            toVoid,
        );
    }

    messageActivityFeed(since: bigint): Promise<MessageActivityFeedResponse> {
        return this.handleQueryResponse(
            () =>
                this.userService.message_activity_feed({
                    since,
                }),
            messageActivityFeedResponse,
        );
    }
}
