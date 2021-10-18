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
    Message,
    IndexRange,
    EventWrapper,
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
} from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";
import type { SearchAllMessagesResponse } from "../../domain/search/search";
import type { UserSummary } from "../../domain/user/user";

export interface IUserClient {
    userId: string;
    getUpdates(chatSummaries: ChatSummary[], args: UpdateArgs): Promise<MergedUpdatesResponse>;
    chatEventsWindow(
        userId: string,
        messageIndex: number
    ): Promise<EventsResponse<DirectChatEvent>>;
    chatEventsByIndex(
        eventIndexes: number[],
        userId: string
    ): Promise<EventsResponse<DirectChatEvent>>;
    chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean,
        previouslyLoadedEvents?: EventWrapper<DirectChatEvent>[],
        iterations?: number
    ): Promise<EventsResponse<DirectChatEvent>>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
    editMessage(recipientId: string, message: Message): Promise<EditMessageResponse>;
    sendMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    leaveGroup(chatId: string): Promise<LeaveGroupResponse>;
    joinGroup(chatId: string): Promise<JoinGroupResponse>;
    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse>;
    setAvatar(data: Uint8Array): Promise<BlobReference>;
    toggleReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string
    ): Promise<ToggleReactionResponse>;
    deleteMessage(otherUserId: string, messageId: bigint): Promise<DeleteMessageResponse>;
    searchAllMessages(searchTerm: string, maxResults: number): Promise<SearchAllMessagesResponse>;
    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse>;
}
