import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import {
    ApiChannelMessagesRead,
    ApiChatInList,
    ApiChatMessagesRead,
    ApiMarkReadArgs,
    ApiSendMessageArgs,
    ApiSendMessageWithTransferToGroupArgs,
    idlFactory,
    UserService,
} from "./candid/idl";
import {
    type InitialStateResponse,
    type UpdatesResponse,
    type EventsResponse,
    type CandidateGroupChat,
    type CreateGroupResponse,
    type DeleteGroupResponse,
    type DirectChatEvent,
    type Message,
    type SendMessageResponse,
    type BlockUserResponse,
    type UnblockUserResponse,
    type LeaveGroupResponse,
    type MarkReadResponse,
    type IndexRange,
    type AddRemoveReactionResponse,
    type DeleteMessageResponse,
    type UndeleteMessageResponse,
    type EditMessageResponse,
    type MarkReadRequest,
    type WithdrawCryptocurrencyResponse,
    type CryptocurrencyContent,
    type PendingCryptocurrencyWithdrawal,
    type ArchiveChatResponse,
    type BlobReference,
    type CreatedUser,
    type MigrateUserPrincipalResponse,
    type PinChatResponse,
    type PublicProfile,
    type SearchDirectChatResponse,
    type SetBioResponse,
    type ToggleMuteNotificationResponse,
    type UnpinChatResponse,
    type DeletedDirectMessageResponse,
    type EventWrapper,
    type SetMessageReminderResponse,
    type ChatEvent,
    type EventsSuccessResult,
    type CommunitySummary,
    type CreateCommunityResponse,
    type AccessRules,
    type ChatIdentifier,
    type DirectChatIdentifier,
    type GroupChatIdentifier,
    type ThreadRead,
    type ManageFavouritesResponse,
    chatIdentifierToString,
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
    sendMessageResponse,
    setAvatarResponse,
    setBioResponse,
    unblockResponse,
    withdrawCryptoResponse,
    sendMessageWithTransferToGroupResponse,
    publicProfileResponse,
    pinChatResponse,
    unpinChatResponse,
    migrateUserPrincipal,
    archiveChatResponse,
    deletedMessageResponse,
    setMessageReminderResponse,
    createCommunityResponse,
    manageFavouritesResponse,
} from "./mappers";
import { MAX_EVENTS, MAX_MESSAGES, MAX_MISSING } from "../../constants";
import {
    Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
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
    apiPendingCryptoContent,
    apiPendingCryptocurrencyWithdrawal,
    apiReplyContextArgs,
    addRemoveReactionResponse,
    createGroupResponse,
    leaveGroupResponse,
    deleteGroupResponse,
    apiChatIdentifier,
} from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { muteNotificationsResponse } from "../notifications/mappers";
import { identity, toVoid } from "../../utils/mapping";
import { apiGroupRules } from "../group/mappers";
import { generateUint64 } from "../../utils/rng";
import type { AgentConfig } from "../../config";

export class UserClient extends CandidService {
    private userService: UserService;
    userId: string;
    private chatId: DirectChatIdentifier;

    constructor(
        identity: Identity,
        userId: string,
        private config: AgentConfig,
        private db: Database
    ) {
        super(identity);
        this.userId = userId;
        this.chatId = { kind: "direct_chat", userId: userId };
        this.userService = this.createServiceClient<UserService>(idlFactory, userId, config);
    }

    static create(
        userId: string,
        identity: Identity,
        config: AgentConfig,
        db: Database
    ): UserClient {
        return new UserClient(identity, userId, config, db);
    }

    private setCachedEvents<T extends ChatEvent>(
        chatId: ChatIdentifier,
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number
    ): EventsResponse<T> {
        setCachedEvents(this.db, chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err)
        );
        return resp;
    }

    private handleMissingEvents(
        chatId: DirectChatIdentifier,
        [cachedEvents, missing]: [EventsSuccessResult<DirectChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                [...missing],
                chatId,
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

    addToFavourites(chatId: ChatIdentifier): Promise<ManageFavouritesResponse> {
        return this.handleResponse(
            this.userService.manage_favourite_chats({
                to_add: [apiChatIdentifier(chatId)],
                to_remove: [],
            }),
            manageFavouritesResponse
        );
    }

    removeFromFavourites(chatId: ChatIdentifier): Promise<ManageFavouritesResponse> {
        return this.handleResponse(
            this.userService.manage_favourite_chats({
                to_add: [],
                to_remove: [apiChatIdentifier(chatId)],
            }),
            manageFavouritesResponse
        );
    }

    getInitialState(): Promise<InitialStateResponse> {
        const args = {
            disable_cache: apiOptional(identity, false),
        };
        return this.handleQueryResponse(
            () => this.userService.initial_state(args),
            initialStateResponse,
            args
        );
    }

    getUpdates(updatesSince: bigint): Promise<UpdatesResponse> {
        const args = {
            updates_since: updatesSince,
        };
        return this.handleQueryResponse(
            () => this.userService.updates(args),
            getUpdatesResponse,
            args
        );
    }

    createCommunity(
        community: CommunitySummary,
        rules: AccessRules,
        defaultChannels: string[]
    ): Promise<CreateCommunityResponse> {
        return this.handleResponse(
            this.userService.create_community({
                is_public: community.public,
                name: community.name,
                description: community.description,
                history_visible_to_new_joiners: community.historyVisible,
                avatar: apiOptional((data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }, community.avatar?.blobData),
                banner: apiOptional((data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }, community.banner?.blobData),
                permissions: [apiCommunityPermissions(community.permissions)],
                rules: apiGroupRules(rules),
                gate: apiMaybeAccessGate(community.gate),
                default_channels: defaultChannels,
            }),
            createCommunityResponse
        );
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.handleResponse(
            this.userService.create_group({
                is_public: group.public,
                name: group.name,
                description: group.description,
                history_visible_to_new_joiners: group.historyVisible,
                avatar: apiOptional((data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }, group.avatar?.blobData),
                permissions: [apiGroupPermissions(group.permissions)],
                rules: apiGroupRules(group.rules),
                gate: apiMaybeAccessGate(group.gate),
            }),
            (resp) => createGroupResponse(resp, group.id)
        );
    }

    deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.handleResponse(
            this.userService.delete_group({
                chat_id: Principal.fromText(chatId),
            }),
            deleteGroupResponse
        );
    }

    chatEventsByIndex(
        eventIndexes: number[],
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return getCachedEventsByIndex<DirectChatEvent>(
            this.db,
            eventIndexes,
            chatId,
            threadRootMessageIndex
        ).then((res) =>
            this.handleMissingEvents(chatId, res, threadRootMessageIndex, latestClientEventIndex)
        );
    }

    private chatEventsByIndexFromBackend(
        eventIndexes: number[],
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            user_id: Principal.fromText(chatId.userId),
            events: new Uint32Array(eventIndexes),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.userService.events_by_index(args),
            (resp) => getEventsResponse(this.principal, resp, chatId, latestClientEventIndex),
            args
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow<DirectChatEvent>(
            this.db,
            eventIndexRange,
            chatId,
            messageIndex
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss
            );
            return this.chatEventsWindowFromBackend(
                chatId,
                messageIndex,
                latestClientEventIndex
            ).then((resp) => this.setCachedEvents(chatId, resp));
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                undefined,
                latestClientEventIndex
            );
        }
    }

    private async chatEventsWindowFromBackend(
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        const thread_root_message_index: [] = [];
        const args = {
            thread_root_message_index,
            user_id: Principal.fromText(chatId.userId),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.userService.events_window(args),
            (resp) => getEventsResponse(this.principal, resp, chatId, latestClientEventIndex),
            args
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<DirectChatEvent>(
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
            return this.chatEventsFromBackend(
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

    private chatEventsFromBackend(
        chatId: DirectChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            user_id: Principal.fromText(chatId.userId),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            start_index: startIndex,
            ascending: ascending,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };

        return this.handleQueryResponse(
            () => this.userService.events(args),
            (resp) => getEventsResponse(this.principal, resp, chatId, latestClientEventIndex),
            args
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
            setAvatarResponse
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
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        return DataClient.create(this.identity, this.config)
            .uploadData(message.content, [this.userId, recipientId])
            .then((content) => {
                const req = {
                    content: apiMessageContent(content ?? message.content),
                    user_id: Principal.fromText(recipientId),
                    thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                    message_id: message.messageId,
                    correlation_id: generateUint64(),
                };
                return this.handleResponse(
                    this.userService.edit_message_v2(req),
                    editMessageResponse
                );
            });
    }

    sendMessage(
        chatId: DirectChatIdentifier,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);
        return this.sendMessageToBackend(chatId, sender, event, threadRootMessageIndex)
            .then(
                setCachedMessageFromSendResponse(
                    this.db,
                    this.chatId,
                    event,
                    threadRootMessageIndex
                )
            )
            .catch((err) => {
                recordFailedMessage(this.db, this.chatId, event, threadRootMessageIndex);
                throw err;
            });
    }

    sendMessageToBackend(
        chatId: DirectChatIdentifier,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        const dataClient = DataClient.create(this.identity, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.userId, chatId.userId])
            : dataClient.uploadData(event.event.content, [this.userId, chatId.userId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const req: ApiSendMessageArgs = {
                content: apiMessageContent(newContent),
                recipient: Principal.fromText(chatId.userId),
                sender_name: sender.username,
                message_id: event.event.messageId,
                replies_to: apiOptional(
                    (replyContext) => apiReplyContextArgs(chatId, replyContext),
                    event.event.repliesTo
                ),
                forwarding: event.event.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                correlation_id: generateUint64(),
            };
            return this.handleResponse(this.userService.send_message_v2(req), (resp) =>
                sendMessageResponse(resp, event.event.sender, chatId.userId)
            ).then((resp) => [resp, { ...event.event, content: newContent }]);
        });
    }

    sendMessageWithTransferToGroup(
        groupId: GroupChatIdentifier,
        recipientId: string,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);
        return this.sendMessageWithTransferToGroupToBackend(
            groupId,
            recipientId,
            sender,
            event,
            threadRootMessageIndex
        )
            .then(setCachedMessageFromSendResponse(this.db, groupId, event, threadRootMessageIndex))
            .catch((err) => {
                recordFailedMessage(this.db, groupId, event);
                throw err;
            });
    }

    sendMessageWithTransferToGroupToBackend(
        groupId: GroupChatIdentifier,
        recipientId: string,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        const content = apiPendingCryptoContent(event.event.content as CryptocurrencyContent);

        const req: ApiSendMessageWithTransferToGroupArgs = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            content: {
                Crypto: content,
            },
            sender_name: sender.username,
            mentioned: [],
            message_id: event.event.messageId,
            group_id: Principal.fromText(groupId.groupId),
            replies_to: apiOptional(
                (replyContext) => apiReplyContextArgs(groupId, replyContext),
                event.event.repliesTo
            ),
            correlation_id: generateUint64(),
        };
        return this.handleResponse(
            this.userService.send_message_with_transfer_to_group(req),
            (resp) => sendMessageWithTransferToGroupResponse(resp, event.event.sender, recipientId)
        ).then((resp) => [resp, event.event]);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.userService.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockResponse
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.userService.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockResponse
        );
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.handleResponse(
            this.userService.leave_group({
                chat_id: Principal.fromText(chatId),
                correlation_id: generateUint64(),
            }),
            leaveGroupResponse
        );
    }

    private markMessageArg(
        chatId: string,
        readUpTo: number | undefined,
        threads: ThreadRead[],
        dateReadPinned: bigint | undefined
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
        dateReadPinned: bigint | undefined
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
                    this.markChannelMessageArg(chatId.channelId, readUpTo, threads, dateReadPinned)
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
            markReadResponse
        );
    }

    addReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.userService.add_reaction({
                user_id: Principal.fromText(otherUserId),
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
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.userService.remove_reaction({
                user_id: Principal.fromText(otherUserId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse
        );
    }

    deleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.userService.delete_messages({
                user_id: Principal.fromText(otherUserId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            deleteMessageResponse
        );
    }

    undeleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.handleResponse(
            this.userService.undelete_messages({
                user_id: Principal.fromText(otherUserId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            undeleteMessageResponse
        );
    }

    searchDirectChat(
        chatId: DirectChatIdentifier,
        searchTerm: string,
        maxResults: number
    ): Promise<SearchDirectChatResponse> {
        const args = {
            user_id: Principal.fromText(chatId.userId),
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.userService.search_messages(args),
            (res) => searchDirectChatResponse(res, chatId),
            args
        );
    }

    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse> {
        if (muted) {
            return this.handleResponse(
                this.userService.mute_notifications({
                    chat_id: Principal.fromText(chatId),
                }),
                muteNotificationsResponse
            );
        } else {
            return this.handleResponse(
                this.userService.unmute_notifications({
                    chat_id: Principal.fromText(chatId),
                }),
                muteNotificationsResponse
            );
        }
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.handleResponse(
            this.userService.add_hot_group_exclusions({
                duration: [],
                groups: [Principal.fromText(chatId)],
            }),
            toVoid
        );
    }

    getBio(): Promise<string> {
        return this.handleQueryResponse(
            () => this.userService.bio({}),
            (candid) => candid.Success
        );
    }

    getPublicProfile(): Promise<PublicProfile> {
        return this.handleQueryResponse(
            () => this.userService.public_profile({}),
            publicProfileResponse
        );
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.handleResponse(this.userService.set_bio({ text: bio }), setBioResponse);
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        const req = apiPendingCryptocurrencyWithdrawal(domain);
        return this.handleResponse(
            this.userService.withdraw_crypto_v2(req),
            withdrawCryptoResponse
        );
    }

    private toChatInList(chatId: ChatIdentifier): ApiChatInList {
        switch (chatId.kind) {
            case "direct_chat":
                return { Direct: Principal.fromText(chatId.userId) };
            case "group_chat":
                return { Group: Principal.fromText(chatId.groupId) };
            case "channel":
                return {
                    Community: [Principal.fromText(chatId.communityId), BigInt(chatId.channelId)],
                };
        }
    }

    pinChat(chatId: ChatIdentifier, communitiesEnabled: boolean): Promise<PinChatResponse> {
        if (communitiesEnabled) {
            return this.handleResponse(
                this.userService.pin_chat_v2({
                    chat: this.toChatInList(chatId),
                }),

                pinChatResponse
            );
        } else {
            return this.handleResponse(
                this.userService.pin_chat({
                    chat_id: Principal.fromText(chatIdentifierToString(chatId)),
                }),

                pinChatResponse
            );
        }
    }

    unpinChat(chatId: ChatIdentifier, communitiesEnabled: boolean): Promise<UnpinChatResponse> {
        if (communitiesEnabled) {
            return this.handleResponse(
                this.userService.unpin_chat_v2({
                    chat: this.toChatInList(chatId),
                }),
                unpinChatResponse
            );
        } else {
            return this.handleResponse(
                this.userService.unpin_chat({
                    chat_id: Principal.fromText(chatIdentifierToString(chatId)),
                }),

                pinChatResponse
            );
        }
    }

    archiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.handleResponse(
            this.userService.archive_chat({
                chat_id: Principal.fromText(chatId),
            }),
            archiveChatResponse
        );
    }

    unarchiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.handleResponse(
            this.userService.unarchive_chat({
                chat_id: Principal.fromText(chatId),
            }),
            archiveChatResponse
        );
    }

    initUserPrincipalMigration(newPrincipal: string): Promise<void> {
        return this.handleResponse(
            this.userService.init_user_principal_migration({
                new_principal: Principal.fromText(newPrincipal),
            }),
            toVoid
        );
    }

    migrateUserPrincipal(): Promise<MigrateUserPrincipalResponse> {
        return this.handleResponse(
            this.userService.migrate_user_principal({}),
            migrateUserPrincipal
        );
    }

    getDeletedMessage(userId: string, messageId: bigint): Promise<DeletedDirectMessageResponse> {
        return this.handleResponse(
            this.userService.deleted_message({
                user_id: Principal.fromText(userId),
                message_id: messageId,
            }),
            deletedMessageResponse
        );
    }

    setMessageReminder(
        chatId: string,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number
    ): Promise<SetMessageReminderResponse> {
        return this.handleResponse(
            this.userService.set_message_reminder({
                notes: apiOptional(identity, notes),
                remind_at: BigInt(remindAt),
                chat_id: Principal.fromText(chatId),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                event_index: eventIndex,
            }),
            setMessageReminderResponse
        );
    }

    cancelMessageReminder(reminderId: bigint): Promise<boolean> {
        return this.handleResponse(
            this.userService.cancel_message_reminder({
                reminder_id: reminderId,
            }),
            (_) => true
        );
    }
}
