import type {
    UpdatesResponse,
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
} from "../../domain/chat/chat";
import type { IUserClient } from "./user.client.interface";
import { ChatSchema, getCachedMessages, setCachedMessages } from "../../utils/caching";
import type { IDBPDatabase } from "idb";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient implements IUserClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserClient) {}

    async chatEvents(userId: string, fromIndex: number, toIndex: number): Promise<EventsResponse> {
        const cachedMsgs = await getCachedMessages(this.db, userId, fromIndex, toIndex);
        return (
            cachedMsgs ??
            this.client
                .chatEvents(userId, fromIndex, toIndex)
                .then(setCachedMessages(this.db, userId))
        );
    }

    chatEventsByIndex(userId: string, indexes: Set<number>): Promise<EventsResponse> {
        return this.client.chatEventsByIndex(userId, indexes);
    }

    getUpdates(userId: string, args: UpdateArgs): Promise<UpdatesResponse> {
        return this.client.getUpdates(userId, args);
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.client.createGroup(group);
    }
}
