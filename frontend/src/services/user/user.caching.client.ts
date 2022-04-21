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
    PendingICPWithdrawal,
    WithdrawCryptocurrencyResponse,
    EventsSuccessResult,
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
import { indexRangeForChat, MAX_MISSING, updateArgsFromChats } from "../../domain/chat/chat.utils";
import type { BlobReference } from "../../domain/data/data";
import type { SetBioResponse, UserSummary } from "../../domain/user/user";
import type {
    SearchDirectChatResponse,
    SearchAllMessagesResponse,
} from "../../domain/search/search";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";
import { profile } from "../common/profiling";
import { toRecord } from "../../utils/list";
import { GroupClient } from "services/group/group.client";
import type { Identity } from "@dfinity/agent";

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
        private client: IUserClient
    ) {}

    private handleMissingEvents(
        userId: string,
        [cachedEvents, missing]: [EventsSuccessResult<DirectChatEvent>, Set<number>]
    ): Promise<EventsResponse<DirectChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.client
                .chatEventsByIndex([...missing], userId)
                .then(setCachedEvents(this.db, userId))
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
        userId: string
    ): Promise<EventsResponse<DirectChatEvent>> {
        return getCachedEventsByIndex<DirectChatEvent>(this.db, eventIndexes, userId).then((res) =>
            this.handleMissingEvents(userId, res)
        );
    }

    @profile("userCachingClient")
    async chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        const [cachedEvents, missing] = await getCachedEventsWindow<DirectChatEvent>(
            this.db,
            eventIndexRange,
            userId,
            messageIndex
        );
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.client
                .chatEventsWindow(eventIndexRange, userId, messageIndex)
                .then(setCachedEvents(this.db, userId));
        } else {
            return this.handleMissingEvents(userId, [cachedEvents, missing]);
        }
    }

    @profile("userCachingClient")
    async chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<DirectChatEvent>(
            this.db,
            eventIndexRange,
            userId,
            startIndex,
            ascending
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.client
                .chatEvents(eventIndexRange, userId, startIndex, ascending)
                .then(setCachedEvents(this.db, userId));
        } else {
            return this.handleMissingEvents(userId, [cachedEvents, missing]);
        }
    }

    private primeCaches(
        cachedResponse: MergedUpdatesResponse | undefined,
        nextResponse: MergedUpdatesResponse,
        selectedChatId?: string
    ): MergedUpdatesResponse {
        // TODO - we need to make sure that we don't do anything special for _the selected_ chat,
        // otherwise we will end up in a race

        const cachedChats =
            cachedResponse === undefined
                ? {}
                : toRecord(cachedResponse.chatSummaries, (c) => c.chatId);
        const nextChats = nextResponse.chatSummaries;
        nextChats.forEach((chat) => {
            // there is no need to do anything for the selected chat
            if (chat.chatId !== selectedChatId) {
                const cachedChat = cachedChats[chat.chatId];
                if (
                    cachedChat === undefined ||
                    chat.latestEventIndex > cachedChat.latestEventIndex
                ) {
                    console.log(`Chat ${chat.chatId} is not up to date`);
                    // if the difference is < a page then this is easy
                    // if the difference is > a page then what we do depends on the user's preferences

                    // fire and forget an events request that will prime the cache
                    if (chat.kind === "group_chat") {
                        // this is a bit gross, but I don't want this to leak outside of the caching layer
                        const groupClient = GroupClient.create(chat.chatId, this.identity, this.db);
                        groupClient.chatEvents(
                            indexRangeForChat(chat),
                            chat.latestEventIndex,
                            false
                        );
                    } else {
                        this.chatEvents(
                            indexRangeForChat(chat),
                            this.userId,
                            chat.latestEventIndex,
                            false
                        );
                    }
                }
            }
        });
        return nextResponse;
    }

    @profile("userCachingClient")
    async getInitialState(selectedChatId?: string): Promise<MergedUpdatesResponse> {
        const cachedChats = await getCachedChats(this.db, this.userId);
        // if we have cached chats we will rebuild the UpdateArgs from that cached data
        if (cachedChats) {
            return this.client
                .getUpdates(
                    cachedChats.chatSummaries,
                    updateArgsFromChats(cachedChats.timestamp, cachedChats.chatSummaries)
                )
                .then((resp) => {
                    resp.wasUpdated = true;
                    return resp;
                })
                .then((resp) => this.primeCaches(cachedChats, resp, selectedChatId))
                .then(setCachedChats(this.db, this.userId));
        } else {
            return this.client
                .getInitialState()
                .then((resp) => this.primeCaches(cachedChats, resp, selectedChatId))
                .then(setCachedChats(this.db, this.userId));
        }
    }

    @profile("userCachingClient")
    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs,
        selectedChatId?: string
    ): Promise<MergedUpdatesResponse> {
        const cachedChats = await getCachedChats(this.db, this.userId);
        return this.client
            .getUpdates(chatSummaries, args)
            .then((resp) => this.primeCaches(cachedChats, resp, selectedChatId))
            .then(setCachedChats(this.db, this.userId));
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.client.createGroup(group);
    }

    editMessage(recipientId: string, message: Message): Promise<EditMessageResponse> {
        return this.client.editMessage(recipientId, message);
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
        replyingToChatId?: string
    ): Promise<SendMessageResponse> {
        return this.client
            .sendMessage(recipientId, sender, message, replyingToChatId)
            .then(setCachedMessageFromSendResponse(this.db, this.userId, message));
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    async leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        await removeCachedChat(this.db, this.userId, chatId);
        return this.client.leaveGroup(chatId);
    }

    joinGroup(chatId: string): Promise<JoinGroupResponse> {
        return this.client.joinGroup(chatId);
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
        reaction: string
    ): Promise<ToggleReactionResponse> {
        return this.client.toggleReaction(otherUserId, messageId, reaction);
    }

    deleteMessage(otherUserId: string, messageId: bigint): Promise<DeleteMessageResponse> {
        return this.client.deleteMessage(otherUserId, messageId);
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

    setBio(bio: string): Promise<SetBioResponse> {
        return this.client.setBio(bio);
    }

    registerPollVote(
        otherUser: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse> {
        return this.client.registerPollVote(otherUser, messageIdx, answerIdx, voteType);
    }

    withdrawICP(domain: PendingICPWithdrawal): Promise<WithdrawCryptocurrencyResponse> {
        return this.client.withdrawICP(domain);
    }
}
