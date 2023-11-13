import {
    type InitialStateResponse,
    type UpdatesResponse,
    type EventsResponse,
    type CandidateGroupChat,
    type CreateGroupResponse,
    type DeleteGroupResponse,
    type DirectChatEvent,
    type Message,
    type SendMessageResponse,
    type BlockUserResponse,
    type UnblockUserResponse,
    type LeaveGroupResponse,
    type MarkReadResponse,
    type IndexRange,
    type AddRemoveReactionResponse,
    type DeleteMessageResponse,
    type UndeleteMessageResponse,
    type EditMessageResponse,
    type MarkReadRequest,
    type WithdrawCryptocurrencyResponse,
    type PendingCryptocurrencyWithdrawal,
    type ArchiveChatResponse,
    type BlobReference,
    type CreatedUser,
    type MigrateUserPrincipalResponse,
    type PinChatResponse,
    type PublicProfile,
    type SearchDirectChatResponse,
    type SetBioResponse,
    type ToggleMuteNotificationResponse,
    type UnpinChatResponse,
    type DeletedDirectMessageResponse,
    type EventWrapper,
    type SetMessageReminderResponse,
    type CommunitySummary,
    type CreateCommunityResponse,
    type ChatIdentifier,
    type DirectChatIdentifier,
    type GroupChatIdentifier,
    type ManageFavouritesResponse,
    type CommunityIdentifier,
    type LeaveCommunityResponse,
    type DeleteCommunityResponse,
    type ChannelIdentifier,
    type Rules,
    type TipMessageResponse,
    type NamedAccount,
    type SaveCryptoAccountResponse,
    type CandidateProposal,
    type SubmitProposalResponse,
    type MessageContext,
    type PendingCryptocurrencyTransfer,
    AnonymousOperationError,
} from "openchat-shared";

export class AnonUserClient {
    static create(): AnonUserClient {
        console.debug("ANON: creating anonymous user client");
        return new AnonUserClient();
    }

    addToFavourites(_chatId: ChatIdentifier): Promise<ManageFavouritesResponse> {
        return Promise.resolve("success");
    }

    removeFromFavourites(_chatId: ChatIdentifier): Promise<ManageFavouritesResponse> {
        return Promise.resolve("success");
    }

    getInitialState(): Promise<InitialStateResponse> {
        return Promise.resolve({
            blockedUsers: [],
            communities: {
                summaries: [],
            },
            groupChats: {
                summaries: [],
                pinned: [],
                cached: undefined,
            },
            avatarId: undefined,
            directChats: {
                summaries: [],
                pinned: [],
            },
            favouriteChats: {
                chats: [],
                pinned: [],
            },
            timestamp: BigInt(Date.now()),
        });
    }

    getUpdates(_updatesSince: bigint): Promise<UpdatesResponse> {
        return Promise.resolve({
            kind: "success_no_updates",
        });
    }

    createCommunity(
        _community: CommunitySummary,
        _rules: Rules,
        _defaultChannels: string[],
        _defaultChannelRules: Rules,
    ): Promise<CreateCommunityResponse> {
        throw new AnonymousOperationError();
    }

    createGroup(_group: CandidateGroupChat): Promise<CreateGroupResponse> {
        throw new AnonymousOperationError();
    }

    deleteGroup(_chatId: string): Promise<DeleteGroupResponse> {
        throw new AnonymousOperationError();
    }

    deleteCommunity(_id: CommunityIdentifier): Promise<DeleteCommunityResponse> {
        throw new AnonymousOperationError();
    }

    chatEventsByIndex(
        _eventIndexes: number[],
        _chatId: DirectChatIdentifier,
        _threadRootMessageIndex: number | undefined,
        _latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<DirectChatEvent>> {
        throw new AnonymousOperationError();
    }

    async chatEventsWindow(
        _eventIndexRange: IndexRange,
        _chatId: DirectChatIdentifier,
        _messageIndex: number,
        _latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<DirectChatEvent>> {
        throw new AnonymousOperationError();
    }

    async chatEvents(
        _eventIndexRange: IndexRange,
        _chatId: DirectChatIdentifier,
        _startIndex: number,
        _ascending: boolean,
        _threadRootMessageIndex: number | undefined,
        _latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<DirectChatEvent>> {
        throw new AnonymousOperationError();
    }

    setAvatar(_bytes: Uint8Array): Promise<BlobReference> {
        throw new AnonymousOperationError();
    }

    editMessage(
        _recipientId: string,
        _message: Message,
        _threadRootMessageIndex?: number,
    ): Promise<EditMessageResponse> {
        throw new AnonymousOperationError();
    }

    sendMessage(
        _chatId: DirectChatIdentifier,
        _event: EventWrapper<Message>,
        _threadRootMessageIndex?: number,
    ): Promise<[SendMessageResponse, Message]> {
        throw new AnonymousOperationError();
    }

    sendMessageToBackend(
        _chatId: DirectChatIdentifier,
        _event: EventWrapper<Message>,
        _threadRootMessageIndex?: number,
    ): Promise<[SendMessageResponse, Message]> {
        throw new AnonymousOperationError();
    }

    sendMessageWithTransferToGroup(
        _groupId: GroupChatIdentifier,
        _recipientId: string,
        _sender: CreatedUser,
        _event: EventWrapper<Message>,
        _threadRootMessageIndex: number | undefined,
        _rulesAccepted: number | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        throw new AnonymousOperationError();
    }

    loadSavedCryptoAccounts(): Promise<NamedAccount[]> {
        return Promise.resolve([]);
    }

    saveCryptoAccount(_: NamedAccount): Promise<SaveCryptoAccountResponse> {
        throw new AnonymousOperationError();
    }

    sendMessageWithTransferToChannel(
        _id: ChannelIdentifier,
        _recipientId: string,
        _sender: CreatedUser,
        _event: EventWrapper<Message>,
        _threadRootMessageIndex: number | undefined,
        _communityRulesAccepted: number | undefined,
        _channelRulesAccepted: number | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        throw new AnonymousOperationError();
    }

    blockUser(_userId: string): Promise<BlockUserResponse> {
        throw new AnonymousOperationError();
    }

    unblockUser(_userId: string): Promise<UnblockUserResponse> {
        throw new AnonymousOperationError();
    }

    leaveGroup(_chatId: string): Promise<LeaveGroupResponse> {
        throw new AnonymousOperationError();
    }

    leaveCommunity(_id: CommunityIdentifier): Promise<LeaveCommunityResponse> {
        throw new AnonymousOperationError();
    }

    markMessagesRead(_request: MarkReadRequest): Promise<MarkReadResponse> {
        throw new AnonymousOperationError();
    }

    tipMessage(
        _messageContext: MessageContext,
        _messageId: bigint,
        _transfer: PendingCryptocurrencyTransfer,
    ): Promise<TipMessageResponse> {
        throw new AnonymousOperationError();
    }

    addReaction(
        _otherUserId: string,
        _messageId: bigint,
        _reaction: string,
        _threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        throw new AnonymousOperationError();
    }

    removeReaction(
        _otherUserId: string,
        _messageId: bigint,
        _reaction: string,
        _threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        throw new AnonymousOperationError();
    }

    deleteMessage(
        _otherUserId: string,
        _messageId: bigint,
        _threadRootMessageIndex?: number,
    ): Promise<DeleteMessageResponse> {
        throw new AnonymousOperationError();
    }

    undeleteMessage(
        _otherUserId: string,
        _messageId: bigint,
        _threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        throw new AnonymousOperationError();
    }

    searchDirectChat(
        _chatId: DirectChatIdentifier,
        _searchTerm: string,
        _maxResults: number,
    ): Promise<SearchDirectChatResponse> {
        throw new AnonymousOperationError();
    }

    toggleMuteNotifications(
        _chatId: string,
        _muted: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        throw new AnonymousOperationError();
    }

    dismissRecommendation(_chatId: string): Promise<void> {
        throw new AnonymousOperationError();
    }

    getBio(): Promise<string> {
        throw new AnonymousOperationError();
    }

    getPublicProfile(): Promise<PublicProfile> {
        throw new AnonymousOperationError();
    }

    setBio(_bio: string): Promise<SetBioResponse> {
        throw new AnonymousOperationError();
    }

    withdrawCryptocurrency(
        _domain: PendingCryptocurrencyWithdrawal,
    ): Promise<WithdrawCryptocurrencyResponse> {
        throw new AnonymousOperationError();
    }

    pinChat(_chatId: ChatIdentifier, _favourite: boolean): Promise<PinChatResponse> {
        throw new AnonymousOperationError();
    }

    unpinChat(_chatId: ChatIdentifier, _favourite: boolean): Promise<UnpinChatResponse> {
        throw new AnonymousOperationError();
    }

    archiveChat(_chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        throw new AnonymousOperationError();
    }

    unarchiveChat(_chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        throw new AnonymousOperationError();
    }

    initUserPrincipalMigration(_newPrincipal: string): Promise<void> {
        throw new AnonymousOperationError();
    }

    migrateUserPrincipal(): Promise<MigrateUserPrincipalResponse> {
        throw new AnonymousOperationError();
    }

    getDeletedMessage(_userId: string, _messageId: bigint): Promise<DeletedDirectMessageResponse> {
        throw new AnonymousOperationError();
    }

    setMessageReminder(
        _chatId: ChatIdentifier,
        _eventIndex: number,
        _remindAt: number,
        _notes?: string,
        _threadRootMessageIndex?: number,
    ): Promise<SetMessageReminderResponse> {
        throw new AnonymousOperationError();
    }

    cancelMessageReminder(_reminderId: bigint): Promise<boolean> {
        throw new AnonymousOperationError();
    }

    setCommunityIndexes(_communityIndexes: Record<string, number>): Promise<boolean> {
        throw new AnonymousOperationError();
    }

    submitProposal(
        _governanceCanisterId: string,
        _proposal: CandidateProposal,
        _ledger: string,
        _token: string,
        _proposalRejectionFee: bigint,
        _transactionFee: bigint,
    ): Promise<SubmitProposalResponse> {
        throw new AnonymousOperationError();
    }

    reportMessage(
        _chatId: DirectChatIdentifier,
        _messageId: bigint, 
        _deleteMessage: boolean
    ): Promise<boolean> {
        throw new AnonymousOperationError();
    }
}
