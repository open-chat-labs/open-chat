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
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    GroupChatSummary,
    RegisterPollVoteResponse,
    PendingCryptocurrencyWithdrawal,
    WithdrawCryptocurrencyResponse,
} from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";
import type {
    SearchDirectChatResponse,
    SearchAllMessagesResponse,
} from "../../domain/search/search";
import type { PublicProfile, SetBioResponse, UserSummary } from "../../domain/user/user";
import type { ServiceRetryInterrupt } from "services/candidService";

export interface IUserClient {
    userId: string;
    getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse>;
    getInitialState(selectedChatId: string | undefined): Promise<MergedUpdatesResponse>;
    chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number,
        interrupt?: ServiceRetryInterrupt
    ): Promise<EventsResponse<DirectChatEvent>>;
    chatEventsByIndex(
        eventIndexes: number[],
        userId: string,
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<DirectChatEvent>>;
    chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex?: number,
        interrupt?: ServiceRetryInterrupt
    ): Promise<EventsResponse<DirectChatEvent>>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
    editMessage(
        recipientId: string,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse>;
    sendMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string,
        threadRootMessageIndex?: number
    ): Promise<SendMessageResponse>;
    sendGroupICPTransfer(
        groupId: string,
        recipientId: string,
        sender: UserSummary,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<SendMessageResponse>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    leaveGroup(chatId: string): Promise<LeaveGroupResponse>;
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse>;
    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse>;
    setAvatar(data: Uint8Array): Promise<BlobReference>;
    toggleReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<ToggleReactionResponse>;
    deleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse>;
    searchAllMessages(searchTerm: string, maxResults: number): Promise<SearchAllMessagesResponse>;
    searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults: number
    ): Promise<SearchDirectChatResponse>;
    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse>;
    getRecommendedGroups(interrupt: ServiceRetryInterrupt): Promise<GroupChatSummary[]>;
    dismissRecommendation(chatId: string): Promise<void>;
    getBio(): Promise<string>;
    getPublicProfile(): Promise<PublicProfile>;
    setBio(bio: string): Promise<SetBioResponse>;
    registerPollVote(
        otherUser: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse>;
    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse>;
}
