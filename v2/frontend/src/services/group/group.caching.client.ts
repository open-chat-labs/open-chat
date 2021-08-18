import type { EventsResponse } from "../../domain/chat/chat";
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

    async chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse> {
        const cachedMsgs = await getCachedMessages(this.db, this.chatId, fromIndex, toIndex);
        return (
            cachedMsgs ??
            this.client.chatEvents(fromIndex, toIndex).then(setCachedMessages(this.db, this.chatId))
        );
    }
}
