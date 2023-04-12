import type {
    EventsResponse,
    CandidateGroupChat,
    CreateGroupResponse,
    DeleteGroupResponse,
    DirectChatEvent,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    Message,
    IndexRange,
    AddRemoveReactionResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    MarkReadRequest,
    WithdrawCryptocurrencyResponse,
    EventsSuccessResult,
    ChatEvent,
    PendingCryptocurrencyWithdrawal,
    ArchiveChatResponse,
    BlobReference,
    CreatedUser,
    MigrateUserPrincipalResponse,
    PinChatResponse,
    PublicProfile,
    SearchDirectChatResponse,
    SetBioResponse,
    ToggleMuteNotificationResponse,
    UnpinChatResponse,
    InitialStateResponse,
    UpdatesResponse,
    DeletedDirectMessageResponse,
    EventWrapper,
    SetMessageReminderResponse,
} from "openchat-shared";
import type { IUserClient } from "./user.client.interface";
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
import { MAX_MISSING } from "../../constants";
import { profile } from "../common/profiling";
import type { AgentConfig } from "../../config";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient extends EventTarget implements IUserClient {
    public get userId(): string {
        return this.client.userId;
    }

    constructor(private db: Database, private config: AgentConfig, private client: IUserClient) {
        super();
    }

    private setCachedEvents<T extends ChatEvent>(
        userId: string,
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number
    ): EventsResponse<T> {
        setCachedEvents(this.db, userId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err)
        );
        return resp;
    }

    private handleMissingEvents(
        userId: string,
        [cachedEvents, missing]: [EventsSuccessResult<DirectChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.client
                .chatEventsByIndex(
                    [...missing],
                    userId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                )
                .then((resp) => this.setCachedEvents(userId, resp, threadRootMessageIndex))
                .then((resp) => {
                    if (resp !== "events_failed") {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    getInitialState(): Promise<InitialStateResponse> {
        return this.client.getInitialState();
    }

    getUpdates(updatesSince: bigint): Promise<UpdatesResponse> {
        return this.client.getUpdates(updatesSince);
    }

    @profile("userCachingClient")
    async chatEventsByIndex(
        eventIndexes: number[],
        userId: string,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return getCachedEventsByIndex<DirectChatEvent>(
            this.db,
            eventIndexes,
            userId,
            threadRootMessageIndex
        ).then((res) =>
            this.handleMissingEvents(userId, res, threadRootMessageIndex, latestClientEventIndex)
        );
    }

    @profile("userCachingClient")
    async chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow<DirectChatEvent>(
            this.db,
            eventIndexRange,
            userId,
            messageIndex
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss
            );
            return this.client
                .chatEventsWindow(eventIndexRange, userId, messageIndex, latestClientEventIndex)
                .then((resp) => this.setCachedEvents(userId, resp));
        } else {
            return this.handleMissingEvents(
                userId,
                [cachedEvents, missing],
                undefined,
                latestClientEventIndex
            );
        }
    }

    @profile("userCachingClient")
    async chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<DirectChatEvent>(
            this.db,
            eventIndexRange,
            userId,
            startIndex,
            ascending,
            threadRootMessageIndex
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.client
                .chatEvents(
                    eventIndexRange,
                    userId,
                    startIndex,
                    ascending,
                    threadRootMessageIndex,
                    latestClientEventIndex
                )
                .then((resp) => this.setCachedEvents(userId, resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                userId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestClientEventIndex
            );
        }
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.client.createGroup(group);
    }

    deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.client.deleteGroup(chatId);
    }

    editMessage(
        recipientId: string,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        return this.client.editMessage(recipientId, message, threadRootMessageIndex);
    }

    @profile("userCachingClient")
    sendGroupICPTransfer(
        groupId: string,
        recipientId: string,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.userId, event.event.messageId, threadRootMessageIndex);
        return this.client
            .sendGroupICPTransfer(groupId, recipientId, sender, event, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, groupId, event, threadRootMessageIndex))
            .catch((err) => {
                recordFailedMessage(this.db, groupId, event);
                throw err;
            });
    }

    @profile("userCachingClient")
    sendMessage(
        recipientId: string,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        replyingToChatId?: string,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.userId, event.event.messageId, threadRootMessageIndex);
        return this.client
            .sendMessage(recipientId, sender, event, replyingToChatId, threadRootMessageIndex)
            .then(
                setCachedMessageFromSendResponse(
                    this.db,
                    this.userId,
                    event,
                    threadRootMessageIndex
                )
            )
            .catch((err) => {
                recordFailedMessage(this.db, this.userId, event, threadRootMessageIndex);
                throw err;
            });
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.client.leaveGroup(chatId);
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.client.markMessagesRead(request);
    }

    setAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.client.setAvatar(data);
    }

    addReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.client.addReaction(
            otherUserId,
            messageId,
            reaction,
            username,
            threadRootMessageIndex
        );
    }

    removeReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.client.removeReaction(otherUserId, messageId, reaction, threadRootMessageIndex);
    }

    deleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.client.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    undeleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.client.undeleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults: number
    ): Promise<SearchDirectChatResponse> {
        return this.client.searchDirectChat(userId, searchTerm, maxResults);
    }

    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse> {
        return this.client.toggleMuteNotifications(chatId, muted);
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.client.dismissRecommendation(chatId);
    }

    getBio(): Promise<string> {
        return this.client.getBio();
    }

    getPublicProfile(): Promise<PublicProfile> {
        return this.client.getPublicProfile();
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.client.setBio(bio);
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.client.withdrawCryptocurrency(domain);
    }

    pinChat(chatId: string): Promise<PinChatResponse> {
        return this.client.pinChat(chatId);
    }

    unpinChat(chatId: string): Promise<UnpinChatResponse> {
        return this.client.unpinChat(chatId);
    }

    archiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.client.archiveChat(chatId);
    }

    unarchiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.client.unarchiveChat(chatId);
    }

    initUserPrincipalMigration(newPrincipal: string): Promise<void> {
        return this.client.initUserPrincipalMigration(newPrincipal);
    }

    migrateUserPrincipal(): Promise<MigrateUserPrincipalResponse> {
        return this.client.migrateUserPrincipal();
    }

    getDeletedMessage(userId: string, messageId: bigint): Promise<DeletedDirectMessageResponse> {
        return this.client.getDeletedMessage(userId, messageId);
    }

    setMessageReminder(
        chatId: string,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number
    ): Promise<SetMessageReminderResponse> {
        return this.client.setMessageReminder(
            chatId,
            eventIndex,
            remindAt,
            notes,
            threadRootMessageIndex
        );
    }
}
