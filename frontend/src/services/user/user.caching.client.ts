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
} from "../../domain/chat/chat";
import type { IUserClient } from "./user.client.interface";
import {
    ChatSchema,
    getCachedChats,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    removeCachedChat,
    setCachedChats,
    setCachedEvents,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import type { IDBPDatabase } from "idb";
import { updateArgsFromChats } from "../../domain/chat/chat.utils";
import type { BlobReference } from "../../domain/data/data";
import type { SetBioResponse, UserSummary } from "../../domain/user/user";
import type {
    SearchDirectChatResponse,
    SearchAllMessagesResponse,
} from "../../domain/search/search";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient implements IUserClient {
    public get userId(): string {
        return this.client.userId;
    }

    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserClient) {}

    async chatEventsByIndex(
        eventIndexes: number[],
        userId: string
    ): Promise<EventsResponse<DirectChatEvent>> {
        const cachedEvents = await getCachedEventsByIndex<DirectChatEvent>(
            this.db,
            eventIndexes,
            userId
        );
        return (
            cachedEvents ??
            this.client
                .chatEventsByIndex(eventIndexes, userId)
                .then(setCachedEvents(this.db, userId))
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        const cachedEvents = await getCachedEventsWindow<DirectChatEvent>(
            this.db,
            eventIndexRange,
            userId,
            messageIndex
        );
        return (
            cachedEvents ??
            this.client
                .chatEventsWindow(eventIndexRange, userId, messageIndex)
                .then(setCachedEvents(this.db, userId))
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        const cachedEvents = await getCachedEvents<DirectChatEvent>(
            this.db,
            eventIndexRange,
            userId,
            startIndex,
            ascending
        );
        return (
            cachedEvents ??
            this.client
                .chatEvents(eventIndexRange, userId, startIndex, ascending)
                .then(setCachedEvents(this.db, userId))
        );
    }

    async getInitialState(): Promise<MergedUpdatesResponse> {
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
                .then(setCachedChats(this.db, this.userId));
        } else {
            return this.client.getInitialState().then(setCachedChats(this.db, this.userId));
        }
    }

    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs
    ): Promise<MergedUpdatesResponse> {
        return this.client
            .getUpdates(chatSummaries, args)
            .then(setCachedChats(this.db, this.userId));
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.client.createGroup(group);
    }

    editMessage(recipientId: string, message: Message): Promise<EditMessageResponse> {
        return this.client.editMessage(recipientId, message);
    }

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
