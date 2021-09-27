import type {
    EventsResponse,
    UpdateArgs,
    CreateGroupResponse,
    CandidateGroupChat,
    DirectChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    MessageIndexRange,
    Message,
    IndexRange,
    EventWrapper,
    ToggleReactionResponse,
} from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import type { UserSummary } from "../../domain/user/user";

export interface IUserClient {
    getUpdates(chatSummaries: ChatSummary[], args: UpdateArgs): Promise<MergedUpdatesResponse>;
    chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean,
        previouslyLoadedEvents?: EventWrapper<DirectChatEvent>[],
        iterations?: number
    ): Promise<EventsResponse<DirectChatEvent>>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
    sendMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    leaveGroup(chatId: string): Promise<LeaveGroupResponse>;
    markMessagesRead(userId: string, ranges: MessageIndexRange[]): Promise<MarkReadResponse>;
    setAvatar(data: Uint8Array): Promise<BlobReference>;
    toggleReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string
    ): Promise<ToggleReactionResponse>;
}
