import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
} from "../../domain/chat/chat";
import type { IUserClient } from "./user.client.interface";
import {
    ChatSchema,
    getCachedChats,
    getCachedMessages,
    setCachedChats,
    setCachedMessages,
} from "../../utils/caching";
import type { IDBPDatabase } from "idb";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient implements IUserClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserClient) {}

    async chatEvents(
        userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        const cachedMsgs = await getCachedMessages<DirectChatEvent>(
            this.db,
            userId,
            fromIndex,
            toIndex
        );
        return (
            cachedMsgs ??
            this.client
                .chatEvents(userId, fromIndex, toIndex)
                .then(setCachedMessages(this.db, userId))
        );
    }

    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs
    ): Promise<MergedUpdatesResponse> {
        if (!args.updatesSince) {
            const cachedChats = await getCachedChats(this.db);
            return (
                cachedChats ??
                this.client.getUpdates(chatSummaries, args).then(setCachedChats(this.db))
            );
        }
        return this.client.getUpdates(chatSummaries, args).then(setCachedChats(this.db));
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.client.createGroup(group);
    }
}
