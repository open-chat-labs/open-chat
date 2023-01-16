import type {
    EventsResponse,
    CreateGroupResponse,
    DeleteGroupResponse,
    CandidateGroupChat,
    DirectChatEvent,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    Message,
    IndexRange,
    AddRemoveReactionResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    MarkReadRequest,
    PendingCryptocurrencyWithdrawal,
    WithdrawCryptocurrencyResponse,
    ArchiveChatResponse,
    BlobReference,
    CreatedUser,
    MigrateUserPrincipalResponse,
    PinChatResponse,
    PublicProfile,
    SearchDirectChatResponse,
    SetBioResponse,
    ToggleMuteNotificationResponse,
    UnpinChatResponse,
    InitialStateV2Response,
    UpdatesV2Response,
} from "openchat-shared";

export interface IUserClient {
    userId: string;
    getInitialStateV2(): Promise<InitialStateV2Response>;
    getUpdatesV2(updatesSince: bigint): Promise<UpdatesV2Response>;
    chatEventsWindow(
        eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number,
        latestClientEventIndex: number | undefined
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
        latestClientEventIndex: number | undefined
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
    undeleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse>;
    searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults: number
    ): Promise<SearchDirectChatResponse>;
    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse>;
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
