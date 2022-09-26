import type {
    EventsResponse,
    UpdateArgs,
    CreateGroupResponse,
    DeleteGroupResponse,
    CandidateGroupChat,
    DirectChatEvent,
    MergedUpdatesResponse,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    Message,
    IndexRange,
    AddRemoveReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    GroupChatSummary,
    PendingCryptocurrencyWithdrawal,
    WithdrawCryptocurrencyResponse,
    CurrentChatState,
} from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";
import type {
    SearchDirectChatResponse,
    SearchAllMessagesResponse,
} from "../../domain/search/search";
import type {
    ArchiveChatResponse,
    CreatedUser,
    MigrateUserPrincipalResponse,
    PinChatResponse,
    PublicProfile,
    SetBioResponse,
    UnpinChatResponse,
    UserSummary,
} from "../../domain/user/user";
import type { ServiceRetryInterrupt } from "services/candidService";

export interface IUserClient {
    userId: string;
    getUpdates(
        currentState: CurrentChatState,
        args: UpdateArgs,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse>;
    getInitialState(selectedChatId: string | undefined): Promise<MergedUpdatesResponse>;
    chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number,
        latestClientEventIndex: number | undefined,
        interrupt?: ServiceRetryInterrupt
    ): Promise<EventsResponse<DirectChatEvent>>;
    chatEventsByIndex(
        eventIndexes: number[],
        userId: string,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>>;
    chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined,
        interrupt?: ServiceRetryInterrupt
    ): Promise<EventsResponse<DirectChatEvent>>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
    deleteGroup(chatId: string): Promise<DeleteGroupResponse>;
    editMessage(
        recipientId: string,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse>;
    sendMessage(
        recipientId: string,
        sender: CreatedUser,
        message: Message,
        replyingToChatId?: string,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]>;
    sendGroupICPTransfer(
        groupId: string,
        recipientId: string,
        sender: CreatedUser,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    leaveGroup(chatId: string): Promise<LeaveGroupResponse>;
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse>;
    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse>;
    setAvatar(data: Uint8Array): Promise<BlobReference>;
    addReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse>;
    removeReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse>;
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
    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse>;
    pinChat(chatId: string): Promise<PinChatResponse>;
    unpinChat(chatId: string): Promise<UnpinChatResponse>;
    archiveChat(chatId: string): Promise<ArchiveChatResponse>;
    unarchiveChat(chatId: string): Promise<ArchiveChatResponse>;
    initUserPrincipalMigration(newPrincipal: string): Promise<void>;
    migrateUserPrincipal(): Promise<MigrateUserPrincipalResponse>;
}
