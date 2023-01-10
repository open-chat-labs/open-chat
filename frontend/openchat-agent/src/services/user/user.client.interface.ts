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
    UndeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    GroupChatSummary,
    PendingCryptocurrencyWithdrawal,
    WithdrawCryptocurrencyResponse,
    CurrentChatState,
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
    UserLookup,
    InitialStateV2Response,
    UpdatesV2Response,
} from "openchat-shared";

export interface IUserClient {
    userId: string;
    getInitialState(
        userStore: UserLookup,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse>;
    getUpdates(
        currentState: CurrentChatState,
        args: UpdateArgs,
        userStore: UserLookup,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse>;
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
    getRecommendedGroups(): Promise<GroupChatSummary[]>;
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
