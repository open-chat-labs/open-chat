import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    GroupMessage,
    ChangeAdminResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
    MessageIndexRange,
    MarkReadResponse,
} from "../../domain/chat/chat";
import type { IGroupClient } from "./group.client.interface";
import type { IDBPDatabase } from "idb";
import { ChatSchema, getCachedMessages, setCachedMessages } from "../../utils/caching";
import type { BlobReference } from "../../domain/data/data";

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
    async chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse<GroupChatEvent>> {
        const cachedMsgs = await getCachedMessages<GroupChatEvent>(
            this.db,
            this.chatId,
            fromIndex,
            toIndex
        );
        return (
            cachedMsgs ??
            this.client.chatEvents(fromIndex, toIndex).then(setCachedMessages(this.db, this.chatId))
        );
    }

    addParticipants(userIds: string[]): Promise<AddParticipantsResponse> {
        return this.client.addParticipants(userIds);
    }

    sendMessage(senderName: string, message: GroupMessage): Promise<SendMessageResponse> {
        return this.client.sendMessage(senderName, message);
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

    setAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.client.setAvatar(data);
    }
}
