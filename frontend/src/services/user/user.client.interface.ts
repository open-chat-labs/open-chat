import type { IMessageReadTracker } from "../../stores/markRead";
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
        messagesRead: IMessageReadTracker,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse>;
    getInitialState(
        messagesRead: IMessageReadTracker,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse>;
    chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number,
        interrupt?: ServiceRetryInterrupt
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
        interrupt?: ServiceRetryInterrupt
    ): Promise<EventsResponse<DirectChatEvent>>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
    editMessage(recipientId: string, message: Message): Promise<EditMessageResponse>;
    sendMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse>;
    forwardMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message
    ): Promise<SendMessageResponse>;
    sendGroupICPTransfer(
        groupId: string,
        recipientId: string,
        sender: UserSummary,
        message: Message
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
        reaction: string
    ): Promise<ToggleReactionResponse>;
    deleteMessage(otherUserId: string, messageId: bigint): Promise<DeleteMessageResponse>;
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
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse>;
    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse>;
}
