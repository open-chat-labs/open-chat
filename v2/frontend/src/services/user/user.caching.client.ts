import type { UpdatesResponse, MessagesResponse, UpdateArgs } from "../../domain/chat/chat";
import type { IUserClient } from "./user.client.interface";
import { ChatSchema, getCachedMessages, setCachedMessages } from "../../utils/caching";
import type { IDBPDatabase } from "idb";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient implements IUserClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserClient) {}

    async chatMessages(
        userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<MessagesResponse> {
        const cachedMsgs = await getCachedMessages(this.db, userId, fromIndex, toIndex);
        return (
            cachedMsgs ??
            this.client
                .chatMessages(userId, fromIndex, toIndex)
                .then(setCachedMessages(this.db, userId))
        );
    }

    chatMessagesByIndex(userId: string, indexes: Set<number>): Promise<MessagesResponse> {
        return this.client.chatMessagesByIndex(userId, indexes);
    }

    getUpdates(userId: string, args: UpdateArgs): Promise<UpdatesResponse> {
        return this.client.getUpdates(userId, args);
    }
}
