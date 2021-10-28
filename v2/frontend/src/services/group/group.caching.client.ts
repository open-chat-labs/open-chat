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
    MakeAdminResponse,
    RemoveAdminResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
} from "../../domain/chat/chat";
import type { IGroupClient } from "./group.client.interface";
import type { IDBPDatabase } from "idb";
import {
    ChatSchema,
    getCachedMessages,
    getCachedMessagesByIndex,
    getCachedMessagesWindow,
    setCachedMessages,
} from "../../utils/caching";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingGroupClient implements IGroupClient {
    constructor(
        private db: Promise<IDBPDatabase<ChatSchema>>,
        private chatId: string,
        private client: IGroupClient
    ) {}

    async chatEventsByIndex(eventIndexes: number[]): Promise<EventsResponse<GroupChatEvent>> {
        const cachedMsgs = await getCachedMessagesByIndex<GroupChatEvent>(
            this.db,
            eventIndexes,
            this.chatId
        );
        return (
            cachedMsgs ??
            this.client
                .chatEventsByIndex(eventIndexes)
                .then(setCachedMessages(this.db, this.chatId))
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        const cachedMsgs = await getCachedMessagesWindow<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            messageIndex
        );
        return (
            cachedMsgs ??
            this.client
                .chatEventsWindow(eventIndexRange, messageIndex)
                .then(setCachedMessages(this.db, this.chatId))
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<GroupChatEvent>> {
        const cachedMsgs = await getCachedMessages<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            startIndex,
            ascending
        );
        return (
            cachedMsgs ??
            this.client
                .chatEvents(eventIndexRange, startIndex, ascending)
                .then(setCachedMessages(this.db, this.chatId))
        );
    }

    addParticipants(userIds: string[], allowBlocked: boolean): Promise<AddParticipantsResponse> {
        return this.client.addParticipants(userIds, allowBlocked);
    }

    sendMessage(senderName: string, message: Message): Promise<SendMessageResponse> {
        return this.client.sendMessage(senderName, message);
    }

    editMessage(message: Message): Promise<EditMessageResponse> {
        return this.client.editMessage(message);
    }

    makeAdmin(userId: string): Promise<MakeAdminResponse> {
        return this.client.makeAdmin(userId);
    }

    dismissAsAdmin(userId: string): Promise<RemoveAdminResponse> {
        return this.client.dismissAsAdmin(userId);
    }

    removeParticipant(userId: string): Promise<RemoveParticipantResponse> {
        return this.client.removeParticipant(userId);
    }

    updateGroup(name: string, desc: string, avatar?: Uint8Array): Promise<UpdateGroupResponse> {
        return this.client.updateGroup(name, desc, avatar);
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

    getGroupDetails(): Promise<GroupChatDetailsResponse> {
        // FIXME - need to check the cache here ideally
        return this.client.getGroupDetails();
    }

    getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        return this.client.getGroupDetailsUpdates(previous);
    }
}
