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
    DismissAdminResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    TransferOwnershipResponse,
    DeleteGroupResponse,
} from "../../domain/chat/chat";
import type { IGroupClient } from "./group.client.interface";
import type { IDBPDatabase } from "idb";
import {
    ChatSchema,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    setCachedEvents, setCachedMessage,
} from "../../utils/caching";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
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
            this.client
                .chatEventsByIndex(eventIndexes)
                .then(setCachedEvents(this.db, this.chatId))
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

    addParticipants(userIds: string[], myUsername: string, allowBlocked: boolean): Promise<AddParticipantsResponse> {
        return this.client.addParticipants(userIds, myUsername, allowBlocked);
    }

    sendMessage(senderName: string, message: Message): Promise<SendMessageResponse> {
        return this.client
            .sendMessage(senderName, message)
            .then(setCachedMessage(this.db, this.chatId, message));
    }

    editMessage(message: Message): Promise<EditMessageResponse> {
        return this.client.editMessage(message);
    }

    makeAdmin(userId: string): Promise<MakeAdminResponse> {
        return this.client.makeAdmin(userId);
    }

    dismissAsAdmin(userId: string): Promise<DismissAdminResponse> {
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

    transferOwnership(userId: string): Promise<TransferOwnershipResponse> {
        return this.client.transferOwnership(userId);
    }

    deleteGroup(): Promise<DeleteGroupResponse> {
        return this.client.deleteGroup();
    }
}
