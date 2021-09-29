import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    Message,
    ChangeAdminResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
    MessageIndexRange,
    MarkReadResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    IndexRange,
    DeleteMessageResponse,
    EditMessageResponse,
} from "../../domain/chat/chat";
import type { IGroupClient } from "./group.client.interface";
import type { IDBPDatabase } from "idb";
import { ChatSchema, getCachedMessages, setCachedMessages } from "../../utils/caching";

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

    addParticipants(userIds: string[]): Promise<AddParticipantsResponse> {
        return this.client.addParticipants(userIds);
    }

    sendMessage(senderName: string, message: Message): Promise<SendMessageResponse> {
        return this.client.sendMessage(senderName, message);
    }

    editMessage(message: Message): Promise<EditMessageResponse> {
        return this.client.editMessage(message);
    }

    makeAdmin(userId: string): Promise<ChangeAdminResponse> {
        return this.client.makeAdmin(userId);
    }

    dismissAsAdmin(userId: string): Promise<ChangeAdminResponse> {
        return this.client.dismissAsAdmin(userId);
    }

    removeParticipant(userId: string): Promise<RemoveParticipantResponse> {
        return this.client.removeParticipant(userId);
    }

    markMessagesRead(ranges: MessageIndexRange[]): Promise<MarkReadResponse> {
        return this.client.markMessagesRead(ranges);
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
}
