import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
    DirectMessage,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MessageIndexRange,
    MarkReadResponse,
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
import { updateArgsFromChats } from "../../domain/chat/chat.utils";
import type { BlobReference } from "../../domain/data/data";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient implements IUserClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserClient) {}

    async chatEvents(
        userId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        // todo - come back and sort out caching
        // const cachedMsgs = await getCachedMessages<DirectChatEvent>(
        //     this.db,
        //     userId,
        //     fromIndex,
        //     toIndex
        // );
        // return (
        //     cachedMsgs ??
        //     this.client
        //         .chatEvents(userId, fromIndex, toIndex)
        //         .then(setCachedMessages(this.db, userId))
        // );
        return this.client.chatEvents(userId, startIndex, ascending);
    }

    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs
    ): Promise<MergedUpdatesResponse> {
        if (!args.updatesSince) {
            const cachedChats = await getCachedChats(this.db);
            // if we have cached chats we will rebuild the UpdateArgs from that cached data
            if (cachedChats) {
                return this.client
                    .getUpdates(
                        cachedChats.chatSummaries,
                        updateArgsFromChats(cachedChats.timestamp, cachedChats.chatSummaries)
                    )
                    .then(setCachedChats(this.db));
            }
        }
        return this.client.getUpdates(chatSummaries, args).then(setCachedChats(this.db));
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.client.createGroup(group);
    }

    sendMessage(
        recipientId: string,
        senderName: string,
        message: DirectMessage
    ): Promise<SendMessageResponse> {
        return this.client.sendMessage(recipientId, senderName, message);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.client.leaveGroup(chatId);
    }

    markMessagesRead(userId: string, ranges: MessageIndexRange[]): Promise<MarkReadResponse> {
        return this.client.markMessagesRead(userId, ranges);
    }

    setAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.client.setAvatar(data);
    }
}
