import {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DeleteGroupResponse,
    DirectChatEvent,
    MergedUpdatesResponse,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    Message,
    IndexRange,
    AddRemoveReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    GroupChatSummary,
    WithdrawCryptocurrencyResponse,
    EventsSuccessResult,
    ChatEvent,
    PendingCryptocurrencyWithdrawal,
    CurrentChatState,
    ArchiveChatResponse,
    BlobReference,
    CreatedUser,
    GroupInvite,
    MigrateUserPrincipalResponse,
    missingUserIds,
    PinChatResponse,
    PublicProfile,
    SearchAllMessagesResponse,
    SearchDirectChatResponse,
    SetBioResponse,
    ToggleMuteNotificationResponse,
    UnpinChatResponse,
    UserLookup,
    userIdsFromEvents,
    indexRangeForChat,
    MessagesReadFromServer,
    UsersLoaded,
    compareChats,
} from "openchat-shared";
import type { IUserClient } from "./user.client.interface";
import {
    Database,
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
import {
    getFirstUnreadMessageIndex,
    threadsReadFromChat,
    updateArgsFromChats,
} from "../../utils/chat";
import { MAX_MISSING } from "../../constants";
import { profile } from "../common/profiling";
import { chunk, toRecord } from "../../utils/list";
import { GroupClient } from "../../services/group/group.client";
import type { Identity } from "@dfinity/agent";
import { UserIndexClient } from "../userIndex/userIndex.client";
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
        private groupInvite: GroupInvite | undefined
    ) {
        super();
    }

    private get principal(): Principal {
        return this.identity.getPrincipal();
    }

    private setCachedChats(resp: MergedUpdatesResponse): MergedUpdatesResponse {
        setCachedChats(this.db, this.principal, resp).catch((err) =>
            this.config.logger.error("Error setting cached chats", err)
        );
        return resp;
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

    private async primeCaches(
        cachedResponse: MergedUpdatesResponse | undefined,
        nextResponse: MergedUpdatesResponse,
        selectedChatId: string | undefined,
        userStore: UserLookup
    ): Promise<void> {
        const cachedChats =
            cachedResponse === undefined
                ? {}
                : toRecord(cachedResponse.chatSummaries, (c) => c.chatId);

        // FIXME - can't access localstorage in a worker
        // const limitTo = Number(localStorage.getItem(configKeys.primeCacheLimit) || "50");
        // const batchSize = Number(localStorage.getItem(configKeys.primeCacheBatchSize) || "5");

        const limitTo = 50;
        const batchSize = 5;

        const orderedChats = nextResponse.chatSummaries
            .filter(
                ({ chatId, latestEventIndex }) =>
                    chatId !== selectedChatId &&
                    latestEventIndex >= 0 &&
                    (cachedChats[chatId] === undefined ||
                        latestEventIndex > cachedChats[chatId].latestEventIndex)
            )
            .sort(compareChats)
            .slice(0, limitTo);

        for (const batch of chunk(orderedChats, batchSize)) {
            const eventsPromises = batch.map((chat) => {
                // horrible having to do this but if we don't the message read tracker will not be in the right state

                this.dispatchEvent(
                    new MessagesReadFromServer(
                        chat.chatId,
                        chat.readByMeUpTo,
                        threadsReadFromChat(chat)
                    )
                );

                const targetMessageIndex = getFirstUnreadMessageIndex(chat);
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
                        this.config,
                        this.db,
                        inviteCode
                    );

                    return targetMessageIndex !== undefined
                        ? groupClient.chatEventsWindow(
                              range,
                              targetMessageIndex,
                              chat.latestEventIndex
                          )
                        : groupClient.chatEvents(
                              range,
                              chat.latestEventIndex,
                              false,
                              undefined,
                              chat.latestEventIndex
                          );
                } else {
                    return targetMessageIndex !== undefined
                        ? this.chatEventsWindow(
                              range,
                              chat.chatId,
                              targetMessageIndex,
                              chat.latestEventIndex
                          )
                        : this.chatEvents(
                              range,
                              chat.chatId,
                              chat.latestEventIndex,
                              false,
                              undefined,
                              chat.latestEventIndex
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

                    const missing = missingUserIds(userStore, userIds);
                    if (missing.length > 0) {
                        return UserIndexClient.create(this.identity, this.config)
                            .getUsers(
                                {
                                    userGroups: [
                                        {
                                            users: missing,
                                            updatedSince: BigInt(0),
                                        },
                                    ],
                                },
                                true
                            )
                            .then((val) => {
                                // update the in-scope user lookup just so we don't do more lookups than we need to
                                val.users.forEach((user) => {
                                    userStore[user.userId] = user;
                                });

                                // also dispatch an event with the users so that they make it into the client store
                                this.dispatchEvent(new UsersLoaded(val.users));
                                return val;
                            });
                    }
                });
            }
        }
    }

    @profile("userCachingClient")
    async getInitialState(
        userStore: UserLookup,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse> {
        const cachedChats = await getCachedChats(this.db, this.principal);
        // if we have cached chats we will rebuild the UpdateArgs from that cached data
        if (cachedChats) {
            return this.client
                .getUpdates(
                    cachedChats,
                    updateArgsFromChats(cachedChats.timestamp, cachedChats.chatSummaries),
                    userStore,
                    selectedChatId // WARNING: This was left undefined previously - is this correct now
                )
                .then((resp) => {
                    resp.wasUpdated = true;
                    this.primeCaches(cachedChats, resp, selectedChatId, userStore);
                    return resp;
                })
                .then((resp) => this.setCachedChats(resp));
        } else {
            return this.client
                .getInitialState(userStore, selectedChatId)
                .then((resp) => {
                    this.primeCaches(cachedChats, resp, selectedChatId, userStore);
                    return resp;
                })
                .then((resp) => this.setCachedChats(resp));
        }
    }

    @profile("userCachingClient")
    async getUpdates(
        currentState: CurrentChatState,
        args: UpdateArgs,
        userStore: UserLookup,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse> {
        const cachedChats = await getCachedChats(this.db, this.principal);
        return this.client
            .getUpdates(currentState, args, userStore, selectedChatId) // WARNING: This was left undefined previously - is this correct now
            .then((resp) => {
                this.primeCaches(cachedChats, resp, selectedChatId, userStore);
                return resp;
            })
            .then((resp) => this.setCachedChats(resp));
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

    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse> {
        return this.client.joinGroup(chatId, inviteCode);
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

    getRecommendedGroups(): Promise<GroupChatSummary[]> {
        return this.client.getRecommendedGroups();
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
