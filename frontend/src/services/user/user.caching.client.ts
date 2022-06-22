import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    Message,
    IndexRange,
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    GroupChatSummary,
    RegisterPollVoteResponse,
    WithdrawCryptocurrencyResponse,
    EventsSuccessResult,
    ChatEvent,
    PendingCryptocurrencyWithdrawal,
} from "../../domain/chat/chat";
import type { IUserClient } from "./user.client.interface";
import {
    ChatSchema,
    getCachedChats,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    mergeSuccessResponses,
    removeCachedChat,
    setCachedChats,
    setCachedEvents,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import type { IDBPDatabase } from "idb";
import {
    compareChats,
    getFirstUnreadMention,
    getFirstUnreadMessageIndex,
    indexRangeForChat,
    MAX_MISSING,
    updateArgsFromChats,
    userIdsFromEvents,
} from "../../domain/chat/chat.utils";
import type { BlobReference } from "../../domain/data/data";
import type { PublicProfile, SetBioResponse, UserSummary } from "../../domain/user/user";
import type {
    SearchDirectChatResponse,
    SearchAllMessagesResponse,
} from "../../domain/search/search";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";
import { profile } from "../common/profiling";
import { chunk, toRecord } from "../../utils/list";
import { GroupClient } from "../../services/group/group.client";
import type { Identity } from "@dfinity/agent";
import { scrollStrategy } from "../../stores/settings";
import { get } from "svelte/store";
import type { IMessageReadTracker } from "../../stores/markRead";
import { missingUserIds } from "../../domain/user/user.utils";
import { userStore } from "stores/user";
import { UserIndexClient } from "services/userIndex/userIndex.client";
import { rollbar } from "../../utils/logging";
import type { GroupInvite } from "../../services/serviceContainer";
import type { ServiceRetryInterrupt } from "services/candidService";
import { configKeys } from "../../utils/config";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient implements IUserClient {
    public get userId(): string {
        return this.client.userId;
    }

    constructor(
        private db: Promise<IDBPDatabase<ChatSchema>>,
        private identity: Identity,
        private client: IUserClient,
        private groupInvite: GroupInvite | undefined
    ) {}

    private setCachedChats(resp: MergedUpdatesResponse): MergedUpdatesResponse {
        setCachedChats(this.db, this.userId, resp).catch((err) =>
            rollbar.error("Error setting cached chats", err)
        );
        return resp;
    }

    private setCachedEvents<T extends ChatEvent>(
        userId: string,
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number
    ): EventsResponse<T> {
        setCachedEvents(this.db, userId, resp, threadRootMessageIndex).catch((err) =>
            rollbar.error("Error writing cached group events", err)
        );
        return resp;
    }

    private handleMissingEvents(
        userId: string,
        [cachedEvents, missing]: [EventsSuccessResult<DirectChatEvent>, Set<number>],
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.client
                .chatEventsByIndex([...missing], userId, threadRootMessageIndex)
                .then((resp) => this.setCachedEvents(userId, resp, threadRootMessageIndex))
                .then((resp) => {
                    if (resp !== "events_failed") {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    @profile("userCachingClient")
    async chatEventsByIndex(
        eventIndexes: number[],
        userId: string,
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return getCachedEventsByIndex<DirectChatEvent>(
            this.db,
            eventIndexes,
            userId,
            threadRootMessageIndex
        ).then((res) => this.handleMissingEvents(userId, res, threadRootMessageIndex));
    }

    @profile("userCachingClient")
    async chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number,
        interrupt?: ServiceRetryInterrupt
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
                .chatEventsWindow(eventIndexRange, userId, messageIndex, interrupt)
                .then((resp) => this.setCachedEvents(userId, resp));
        } else {
            return this.handleMissingEvents(userId, [cachedEvents, missing]);
        }
    }

    @profile("userCachingClient")
    async chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex?: number,
        interrupt?: ServiceRetryInterrupt
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
                    interrupt
                )
                .then((resp) => this.setCachedEvents(userId, resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                userId,
                [cachedEvents, missing],
                threadRootMessageIndex
            );
        }
    }

    private async primeCaches(
        cachedResponse: MergedUpdatesResponse | undefined,
        nextResponse: MergedUpdatesResponse,
        messagesRead: IMessageReadTracker,
        selectedChatId: string | undefined
    ): Promise<void> {
        const cachedChats =
            cachedResponse === undefined
                ? {}
                : toRecord(cachedResponse.chatSummaries, (c) => c.chatId);

        const limitTo = Number(localStorage.getItem(configKeys.primeCacheLimit) || "50");
        const batchSize = Number(localStorage.getItem(configKeys.primeCacheBatchSize) || "5");
        const currentScrollStrategy = get(scrollStrategy);

        const orderedChats = nextResponse.chatSummaries
            .filter(
                ({ chatId, latestEventIndex }) =>
                    chatId !== selectedChatId &&
                    (cachedChats[chatId] === undefined ||
                        latestEventIndex > cachedChats[chatId].latestEventIndex)
            )
            .sort(compareChats)
            .slice(0, limitTo);

        for (const batch of chunk(orderedChats, batchSize)) {
            const eventsPromises = batch.map((chat) => {
                let targetMessageIndex: number | undefined = undefined;

                if (currentScrollStrategy !== "latestMessage") {
                    // horrible having to do this but if we don't the message read tracker will not be in the right state
                    messagesRead.syncWithServer(chat.chatId, chat.readByMe);
                }

                if (currentScrollStrategy === "firstMention") {
                    targetMessageIndex =
                        getFirstUnreadMention(messagesRead, chat)?.messageIndex ??
                        getFirstUnreadMessageIndex(messagesRead, chat);
                }
                if (currentScrollStrategy === "firstMessage") {
                    targetMessageIndex = getFirstUnreadMessageIndex(messagesRead, chat);
                }

                const range = indexRangeForChat(chat);

                // fire and forget an events request that will prime the cache
                if (chat.kind === "group_chat") {
                    // this is a bit gross, but I don't want this to leak outside of the caching layer
                    const inviteCode =
                        this.groupInvite?.chatId === chat.chatId
                            ? this.groupInvite.code
                            : undefined;
                    const groupClient = GroupClient.create(
                        chat.chatId,
                        this.identity,
                        this.db,
                        inviteCode
                    );

                    return targetMessageIndex !== undefined
                        ? groupClient.chatEventsWindow(range, targetMessageIndex, () => true)
                        : groupClient.chatEvents(
                              range,
                              chat.latestEventIndex,
                              false,
                              undefined,
                              () => true
                          );
                } else {
                    return targetMessageIndex !== undefined
                        ? this.chatEventsWindow(range, chat.chatId, targetMessageIndex, () => true)
                        : this.chatEvents(
                              range,
                              chat.chatId,
                              chat.latestEventIndex,
                              false,
                              undefined,
                              () => true
                          );
                }
            });

            if (eventsPromises.length > 0) {
                await Promise.all(eventsPromises).then((responses) => {
                    const userIds = responses.reduce((result, next) => {
                        if (next !== "events_failed") {
                            for (const userId of userIdsFromEvents(next.events)) {
                                result.add(userId);
                            }
                        }
                        return result;
                    }, new Set<string>());

                    const missing = missingUserIds(get(userStore), userIds);
                    if (missing.length > 0) {
                        return UserIndexClient.create(this.identity, this.db).getUsers(
                            {
                                userGroups: [
                                    {
                                        users: missing,
                                        updatedSince: BigInt(0),
                                    },
                                ],
                            },
                            true,
                            () => true
                        );
                    }
                });
            }
        }
    }

    @profile("userCachingClient")
    async getInitialState(
        messagesRead: IMessageReadTracker,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse> {
        const cachedChats = await getCachedChats(this.db, this.userId);
        // if we have cached chats we will rebuild the UpdateArgs from that cached data
        if (cachedChats) {
            return this.client
                .getUpdates(
                    cachedChats.chatSummaries,
                    updateArgsFromChats(cachedChats.timestamp, cachedChats.chatSummaries),
                    messagesRead,
                    selectedChatId // WARNING: This was left undefined previously - is this correct now
                )
                .then((resp) => {
                    resp.wasUpdated = true;
                    this.primeCaches(cachedChats, resp, messagesRead, selectedChatId);
                    return resp;
                })
                .then((resp) => this.setCachedChats(resp));
        } else {
            return this.client
                .getInitialState(messagesRead, selectedChatId)
                .then((resp) => {
                    this.primeCaches(cachedChats, resp, messagesRead, selectedChatId);
                    return resp;
                })
                .then((resp) => this.setCachedChats(resp));
        }
    }

    @profile("userCachingClient")
    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs,
        messagesRead: IMessageReadTracker,

        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse> {
        const cachedChats = await getCachedChats(this.db, this.userId);
        return this.client
            .getUpdates(chatSummaries, args, messagesRead, selectedChatId) // WARNING: This was left undefined previously - is this correct now
            .then((resp) => {
                this.primeCaches(cachedChats, resp, messagesRead, selectedChatId);
                return resp;
            })
            .then((resp) => this.setCachedChats(resp));
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.client.createGroup(group);
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
        sender: UserSummary,
        message: Message
    ): Promise<SendMessageResponse> {
        return this.client
            .sendGroupICPTransfer(groupId, recipientId, sender, message)
            .then(setCachedMessageFromSendResponse(this.db, groupId, message));
    }

    @profile("userCachingClient")
    sendMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string,
        threadRootMessageIndex?: number
    ): Promise<SendMessageResponse> {
        return this.client
            .sendMessage(recipientId, sender, message, replyingToChatId, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, this.userId, message));
    }

    @profile("userCachingClient")
    forwardMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<SendMessageResponse> {
        return this.client
            .forwardMessage(recipientId, sender, message, threadRootMessageIndex)
            .then(setCachedMessageFromSendResponse(this.db, this.userId, message));
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        removeCachedChat(this.db, this.userId, chatId).catch((err) =>
            rollbar.error("Failed to remove chat from cache", err)
        );
        return this.client.leaveGroup(chatId);
    }

    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse> {
        return this.client.joinGroup(chatId, inviteCode);
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.client.markMessagesRead(request);
    }

    setAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.client.setAvatar(data);
    }

    toggleReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<ToggleReactionResponse> {
        return this.client.toggleReaction(otherUserId, messageId, reaction, threadRootMessageIndex);
    }

    deleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.client.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    searchAllMessages(searchTerm: string, maxResults: number): Promise<SearchAllMessagesResponse> {
        return this.client.searchAllMessages(searchTerm, maxResults);
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

    getRecommendedGroups(interrupt: ServiceRetryInterrupt): Promise<GroupChatSummary[]> {
        return this.client.getRecommendedGroups(interrupt);
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

    registerPollVote(
        otherUser: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.client.registerPollVote(
            otherUser,
            messageIdx,
            answerIdx,
            voteType,
            threadRootMessageIndex
        );
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.client.withdrawCryptocurrency(domain);
    }
}
