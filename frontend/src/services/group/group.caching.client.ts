import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    Message,
    SendMessageResponse,
    RemoveParticipantResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    IndexRange,
    DeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    ChangeRoleResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    DeleteGroupResponse,
    GroupChatSummary,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
} from "../../domain/chat/chat";
import type { User } from "../../domain/user/user";
import type { IGroupClient } from "./group.client.interface";
import type { IDBPDatabase } from "idb";
import {
    ChatSchema,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    setCachedEvents,
    setCachedGroupDetails,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import type { SearchGroupChatResponse } from "../../domain/search/search";

/**
 * This exists to decorate the group client so that we can provide a write through cache to
 * indexDB for holding chat events
 */
export class CachingGroupClient implements IGroupClient {
    constructor(
        private db: Promise<IDBPDatabase<ChatSchema>>,
        private chatId: string,
        private client: IGroupClient
    ) {}

    async chatEventsByIndex(eventIndexes: number[]): Promise<EventsResponse<GroupChatEvent>> {
        const cachedEvents = await getCachedEventsByIndex<GroupChatEvent>(
            this.db,
            eventIndexes,
            this.chatId
        );
        return (
            cachedEvents ??
            this.client.chatEventsByIndex(eventIndexes).then(setCachedEvents(this.db, this.chatId))
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        const cachedEvents = await getCachedEventsWindow<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            messageIndex
        );
        return (
            cachedEvents ??
            this.client
                .chatEventsWindow(eventIndexRange, messageIndex)
                .then(setCachedEvents(this.db, this.chatId))
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<GroupChatEvent>> {
        const cachedEvents = await getCachedEvents<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            startIndex,
            ascending
        );
        return (
            cachedEvents ??
            this.client
                .chatEvents(eventIndexRange, startIndex, ascending)
                .then(setCachedEvents(this.db, this.chatId))
        );
    }

    addParticipants(
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddParticipantsResponse> {
        return this.client.addParticipants(userIds, myUsername, allowBlocked);
    }

    sendMessage(
        senderName: string,
        mentioned: User[],
        message: Message
    ): Promise<SendMessageResponse> {
        return this.client
            .sendMessage(senderName, mentioned, message)
            .then(setCachedMessageFromSendResponse(this.db, this.chatId, message));
    }

    editMessage(message: Message): Promise<EditMessageResponse> {
        return this.client.editMessage(message);
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        return this.client.changeRole(userId, newRole);
    }

    removeParticipant(userId: string): Promise<RemoveParticipantResponse> {
        return this.client.removeParticipant(userId);
    }

    updateGroup(
        name: string,
        desc: string,
        avatar?: Uint8Array,
        permissions?: GroupPermissions
    ): Promise<UpdateGroupResponse> {
        return this.client.updateGroup(name, desc, avatar, permissions);
    }

    toggleReaction(messageId: bigint, reaction: string): Promise<ToggleReactionResponse> {
        return this.client.toggleReaction(messageId, reaction);
    }

    deleteMessage(messageId: bigint): Promise<DeleteMessageResponse> {
        return this.client.deleteMessage(messageId);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    async getGroupDetails(): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId);
        if (fromCache !== undefined) {
            return this.getGroupDetailsUpdates(fromCache);
        }

        const response = await this.client.getGroupDetails();
        if (response !== "caller_not_in_group") {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.client.getGroupDetailsUpdates(previous);
        if (response.latestEventIndex > previous.latestEventIndex) {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    deleteGroup(): Promise<DeleteGroupResponse> {
        return this.client.deleteGroup();
    }

    getPublicSummary(): Promise<GroupChatSummary | undefined> {
        return this.client.getPublicSummary();
    }

    async getMessagesByMessageIndex(messageIndexes: Set<number>): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.client
                .getMessagesByMessageIndex(fromCache.missing)
                .then(setCachedEvents(this.db, this.chatId));

            return resp === "events_failed"
                ? "events_failed"
                : {
                      events: [...resp.events],
                      affectedEvents: resp.affectedEvents,
                  };
        }
        return {
            events: fromCache.messageEvents,
            affectedEvents: [],
        };
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
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse> {
        return this.client.registerPollVote(messageIdx, answerIdx, voteType);
    }

    searchGroupChat(searchTerm: string, maxResults: number): Promise<SearchGroupChatResponse> {
        return this.client.searchGroupChat(searchTerm, maxResults);
    }
}
