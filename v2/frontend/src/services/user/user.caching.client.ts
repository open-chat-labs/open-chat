import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MessageIndexRange,
    MarkReadResponse,
    Message,
    IndexRange,
    ToggleReactionResponse,
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
import type { UserSummary } from "../../domain/user/user";

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingUserClient implements IUserClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserClient) {}

    async chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        const cachedMsgs = await getCachedMessages<DirectChatEvent>(
            this.db,
            eventIndexRange,
            userId,
            startIndex,
            ascending
        );
        return (
            cachedMsgs ??
            this.client
                .chatEvents(eventIndexRange, userId, startIndex, ascending)
                .then(setCachedMessages(this.db, userId))
        );
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
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse> {
        return this.client.sendMessage(recipientId, sender, message, replyingToChatId);
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

    toggleReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string
    ): Promise<ToggleReactionResponse> {
        return this.client.toggleReaction(otherUserId, messageId, reaction);
    }
}
