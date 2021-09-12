import type {
    EventsResponse,
    UpdateArgs,
    CreateGroupResponse,
    CandidateGroupChat,
    DirectChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
    DirectMessage,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
} from "../../domain/chat/chat";

export interface IUserClient {
    getUpdates(chatSummaries: ChatSummary[], args: UpdateArgs): Promise<MergedUpdatesResponse>;
    chatEvents(
        userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<DirectChatEvent>>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
    sendMessage(
        recipientId: string,
        senderName: string,
        message: DirectMessage
    ): Promise<SendMessageResponse>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    leaveGroup(chatId: string): Promise<LeaveGroupResponse>;
}
