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
    InitialStateV2Response,
    UpdatesV2Response,
} from "openchat-shared";
import type { IUserClient } from "./user.client.interface";
import {
    Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    mergeSuccessResponses,
    removeCachedChat,
    setCachedEvents,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import { MAX_MISSING } from "../../constants";
import { profile } from "../common/profiling";
import type { Identity } from "@dfinity/agent";
import type { AgentConfig } from "../../config";
import type { Principal } from "@dfinity/principal";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient extends EventTarget implements IUserClient {
    public get userId(): string {
        return this.client.userId;
    }

    constructor(
        private db: Database,
        private identity: Identity,
        private config: AgentConfig,
        private client: IUserClient,
    ) {
        super();
    }

    private get principal(): Principal {
        return this.identity.getPrincipal();
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

    getInitialStateV2(): Promise<InitialStateV2Response> {
        return this.client.getInitialStateV2();
    }

    getUpdatesV2(updatesSince: bigint): Promise<UpdatesV2Response> {
        return this.client.getUpdatesV2(updatesSince);
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
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.client
            .sendGroupICPTransfer(groupId, recipientId, sender, message, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, groupId, threadRootMessageIndex));
    }

    @profile("userCachingClient")
    sendMessage(
        recipientId: string,
        sender: CreatedUser,
        message: Message,
        replyingToChatId?: string,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.client
            .sendMessage(recipientId, sender, message, replyingToChatId, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, this.userId, threadRootMessageIndex));
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        removeCachedChat(this.db, this.principal, chatId).catch((err) =>
            this.config.logger.error("Failed to remove chat from cache", err)
        );
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
}
