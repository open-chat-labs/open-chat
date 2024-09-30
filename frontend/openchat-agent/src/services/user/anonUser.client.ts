import type {
    CancelP2PSwapResponse,
    ChitEventsRequest,
    ChitEventsResponse,
    ClaimDailyChitResponse,
    JoinVideoCallResponse,
    SetPinNumberResponse,
    SetVideoCallPresenceResponse,
    Verification,
    VideoCallPresence,
    WalletConfig,
} from "openchat-shared";
import type { AcceptP2PSwapResponse } from "openchat-shared";
import type {
    InitialStateResponse,
    UpdatesResponse,
    EventsResponse,
    CandidateGroupChat,
    CreateGroupResponse,
    DeleteGroupResponse,
    ChatEvent,
    Message,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    IndexRange,
    AddRemoveReactionResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    MarkReadRequest,
    WithdrawCryptocurrencyResponse,
    PendingCryptocurrencyWithdrawal,
    ArchiveChatResponse,
    BlobReference,
    CreatedUser,
    PinChatResponse,
    PublicProfile,
    SearchDirectChatResponse,
    SetBioResponse,
    ToggleMuteNotificationResponse,
    UnpinChatResponse,
    DeletedDirectMessageResponse,
    EventWrapper,
    SetMessageReminderResponse,
    CommunitySummary,
    CreateCommunityResponse,
    ChatIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
    ManageFavouritesResponse,
    CommunityIdentifier,
    LeaveCommunityResponse,
    DeleteCommunityResponse,
    ChannelIdentifier,
    Rules,
    TipMessageResponse,
    NamedAccount,
    SaveCryptoAccountResponse,
    CandidateProposal,
    SubmitProposalResponse,
    MessageContext,
    PendingCryptocurrencyTransfer,
    CryptocurrencyDetails,
    ExchangeTokenSwapArgs,
    SwapTokensResponse,
    TokenSwapStatusResponse,
    ApproveTransferResponse,
} from "openchat-shared";
import { ANON_USER_ID } from "openchat-shared";
import { AnonymousOperationError } from "openchat-shared";

export class AnonUserClient {
    public get userId(): string {
        return ANON_USER_ID;
    }

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
            suspended: false,
            pinNumberSettings: undefined,
            localUserIndex: "",
            achievements: [],
            achievementsLastSeen: 0n,
            streakEnds: 0n,
            streak: 0,
            nextDailyClaim: 0n,
            chitBalance: 0,
            totalChitEarned: 0,
            referrals: [],
            walletConfig: { kind: "auto_wallet", minDollarValue: 1 },
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
    ): Promise<EventsResponse<ChatEvent>> {
        throw new AnonymousOperationError();
    }

    async chatEventsWindow(
        _eventIndexRange: IndexRange,
        _chatId: DirectChatIdentifier,
        _messageIndex: number,
        _latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        throw new AnonymousOperationError();
    }

    async chatEvents(
        _eventIndexRange: IndexRange,
        _chatId: DirectChatIdentifier,
        _startIndex: number,
        _ascending: boolean,
        _threadRootMessageIndex: number | undefined,
        _latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
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
        _messageFilterFailed: bigint | undefined,
        _threadRootMessageIndex: number | undefined,
        _pin: string | undefined,
        _onRequestAccepted: () => void,
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
        _recipientId: string | undefined,
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
        _recipientId: string | undefined,
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
        _decimals: number,
        _pin: string | undefined,
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
        _threadRootMessageIndex: number | undefined,
        _messageId: bigint,
        _deleteMessage: boolean,
    ): Promise<boolean> {
        throw new AnonymousOperationError();
    }

    swapTokens(
        _swapId: bigint,
        _inputToken: CryptocurrencyDetails,
        _outputToken: CryptocurrencyDetails,
        _amountIn: bigint,
        _minAmountOut: bigint,
        _exchangeArgs: ExchangeTokenSwapArgs,
    ): Promise<SwapTokensResponse> {
        throw new AnonymousOperationError();
    }

    tokenSwapStatus(_swapId: bigint): Promise<TokenSwapStatusResponse> {
        throw new AnonymousOperationError();
    }

    approveTransfer(
        _spender: string,
        _ledger: string,
        _amount: bigint,
        _expiresIn: bigint | undefined,
    ): Promise<ApproveTransferResponse> {
        throw new AnonymousOperationError();
    }

    deleteDirectChat(_userId: string, _blockUser: boolean): Promise<boolean> {
        throw new AnonymousOperationError();
    }

    acceptP2PSwap(
        _userId: string,
        _threadRootMessageIndex: number | undefined,
        _messageId: bigint,
        _pin: string | undefined,
    ): Promise<AcceptP2PSwapResponse> {
        throw new AnonymousOperationError();
    }

    cancelP2PSwap(_userId: string, _messageId: bigint): Promise<CancelP2PSwapResponse> {
        throw new AnonymousOperationError();
    }

    joinVideoCall(_userId: string, _messageId: bigint): Promise<JoinVideoCallResponse> {
        throw new AnonymousOperationError();
    }

    setVideoCallPresence(
        _messageId: bigint,
        _presence: VideoCallPresence,
    ): Promise<SetVideoCallPresenceResponse> {
        throw new AnonymousOperationError();
    }

    localUserIndex(): Promise<string> {
        throw new AnonymousOperationError();
    }

    setPinNumber(
        _verification: Verification,
        _newPin: string | undefined,
    ): Promise<SetPinNumberResponse> {
        throw new AnonymousOperationError();
    }

    chitEvents(_req: ChitEventsRequest): Promise<ChitEventsResponse> {
        throw new AnonymousOperationError();
    }

    markAchievementsSeen(_lastSeen: bigint): Promise<void> {
        throw new AnonymousOperationError();
    }

    claimDailyChit(): Promise<ClaimDailyChitResponse> {
        throw new AnonymousOperationError();
    }

    configureWallet(_walletConfig: WalletConfig): Promise<void> {
        throw new AnonymousOperationError();
    }
}
