import type {
    AddMembersResponse,
    EventsResponse,
    GroupChatEvent,
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
    GroupChatSummary,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
    EventsSuccessResult,
    MakeGroupPrivateResponse,
    ChatEvent,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadPreviewsResponse,
    RegisterProposalVoteResponse,
    GroupRules,
    User,
    SearchGroupChatResponse,
    Logger,
    DeletedGroupMessageResponse,
    EventWrapper,
    OptionUpdate,
    ClaimPrizeResponse,
} from "openchat-shared";
import type { IGroupClient } from "./group.client.interface";
import type { IDBPDatabase } from "idb";
import {
    ChatSchema,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedGroupDetails,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import { profile } from "../common/profiling";
import { MAX_MISSING } from "../../constants";

/**
 * This exists to decorate the group client so that we can provide a write through cache to
 * indexDB for holding chat events
 */
export class CachingGroupClient implements IGroupClient {
    constructor(
        private db: Promise<IDBPDatabase<ChatSchema>>,
        private chatId: string,
        private client: IGroupClient,
        private logger: Logger
    ) {}

    private setCachedEvents<T extends ChatEvent>(
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number
    ): EventsResponse<T> {
        setCachedEvents(this.db, this.chatId, resp, threadRootMessageIndex).catch((err) =>
            this.logger.error("Error writing cached group events", err)
        );
        return resp;
    }

    private handleMissingEvents(
        [cachedEvents, missing]: [EventsSuccessResult<GroupChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.client
                .chatEventsByIndex([...missing], threadRootMessageIndex, latestClientEventIndex)
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .then((resp) => {
                    if (resp !== "events_failed") {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    claimPrize(messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.client.claimPrize(messageId);
    }

    summary(): Promise<GroupCanisterSummaryResponse> {
        return this.client.summary();
    }

    summaryUpdates(updatesSince: bigint): Promise<GroupCanisterSummaryUpdatesResponse> {
        return this.client.summaryUpdates(updatesSince);
    }

    @profile("groupCachingClient")
    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return getCachedEventsByIndex<GroupChatEvent>(
            this.db,
            eventIndexes,
            this.chatId,
            threadRootMessageIndex
        ).then((res) =>
            this.handleMissingEvents(res, threadRootMessageIndex, latestClientEventIndex)
        );
    }

    @profile("groupCachingClient")
    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
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
            return this.client
                .chatEventsWindow(
                    eventIndexRange,
                    messageIndex,
                    threadRootMessageIndex,
                    latestClientEventIndex
                )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                undefined,
                latestClientEventIndex
            );
        }
    }

    @profile("groupCachingClient")
    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
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
                    startIndex,
                    ascending,
                    threadRootMessageIndex,
                    latestClientEventIndex
                )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestClientEventIndex
            );
        }
    }

    addMembers(
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddMembersResponse> {
        return this.client.addMembers(userIds, myUsername, allowBlocked);
    }

    sendMessage(
        senderName: string,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);

        return this.client
            .sendMessage(senderName, mentioned, event, threadRootMessageIndex)
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

    editMessage(message: Message, threadRootMessageIndex?: number): Promise<EditMessageResponse> {
        return this.client.editMessage(message, threadRootMessageIndex);
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        return this.client.changeRole(userId, newRole);
    }

    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.client.removeMember(userId);
    }

    updateGroup(
        name?: string,
        description?: string,
        rules?: GroupRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>
    ): Promise<UpdateGroupResponse> {
        return this.client.updateGroup(
            name,
            description,
            rules,
            permissions,
            avatar,
            eventsTimeToLiveMs
        );
    }

    addReaction(
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.client.addReaction(messageId, reaction, username, threadRootMessageIndex);
    }

    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.client.removeReaction(messageId, reaction, threadRootMessageIndex);
    }

    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.client.deleteMessage(messageId, threadRootMessageIndex);
    }

    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.client.undeleteMessage(messageId, threadRootMessageIndex);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    @profile("groupCachingClient")
    async getGroupDetails(latestEventIndex: number): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId);
        if (fromCache !== undefined) {
            if (fromCache.latestEventIndex >= latestEventIndex) {
                return fromCache;
            } else {
                return this.getGroupDetailsUpdates(fromCache);
            }
        }

        const response = await this.client.getGroupDetails(latestEventIndex);
        if (response !== "caller_not_in_group") {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    @profile("groupCachingClient")
    async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.client.getGroupDetailsUpdates(previous);
        if (response.latestEventIndex > previous.latestEventIndex) {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    makeGroupPrivate(): Promise<MakeGroupPrivateResponse> {
        return this.client.makeGroupPrivate();
    }

    getPublicSummary(): Promise<GroupChatSummary | undefined> {
        return this.client.getPublicSummary();
    }

    getRules(): Promise<GroupRules | undefined> {
        return this.client.getRules();
    }

    /**
     * This is only called to populate pinned messages which is why we don't need to care about threadRootMessageIndex
     */
    @profile("groupCachingClient")
    async getMessagesByMessageIndex(
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.client
                .getMessagesByMessageIndex(fromCache.missing, latestClientEventIndex)
                .then((resp) => this.setCachedEvents(resp));

            return resp === "events_failed"
                ? resp
                : {
                      events: [...fromCache.messageEvents, ...resp.events],
                      latestEventIndex: resp.latestEventIndex,
                  };
        }
        return {
            events: fromCache.messageEvents,
            latestEventIndex: undefined,
        };
    }

    getDeletedMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeletedGroupMessageResponse> {
        return this.client.getDeletedMessage(messageId, threadRootMessageIndex);
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.client.pinMessage(messageIndex);
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.client.unpinMessage(messageIndex);
    }

    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.client.registerPollVote(
            messageIdx,
            answerIdx,
            voteType,
            threadRootMessageIndex
        );
    }

    searchGroupChat(
        searchTerm: string,
        userIds: string[],
        maxResults: number
    ): Promise<SearchGroupChatResponse> {
        return this.client.searchGroupChat(searchTerm, userIds, maxResults);
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.client.getInviteCode();
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.client.enableInviteCode();
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.client.disableInviteCode();
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.client.resetInviteCode();
    }

    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined
    ): Promise<ThreadPreviewsResponse> {
        return this.client.threadPreviews(threadRootMessageIndexes, latestClientThreadUpdate);
    }

    registerProposalVote(
        messageIdx: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.client.registerProposalVote(messageIdx, adopt);
    }

    localUserIndex(): Promise<string> {
        return this.client.localUserIndex();
    }
}
