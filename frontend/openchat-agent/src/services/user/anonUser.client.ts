import type {
    AcceptP2PSwapResponse,
    AddRemoveReactionResponse,
    ApproveTransferResponse,
    ArchiveChatResponse,
    BlobReference,
    BlockUserResponse,
    CancelP2PSwapResponse,
    CandidateGroupChat,
    ChannelIdentifier,
    ChatEvent,
    ChatIdentifier,
    ChitEventsRequest,
    ChitEventsResponse,
    ClaimDailyChitResponse,
    CommunityIdentifier,
    CommunitySummary,
    CreateCommunityResponse,
    CreatedUser,
    CreateGroupResponse,
    CryptocurrencyDetails,
    DeleteCommunityResponse,
    DeletedDirectMessageResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DirectChatIdentifier,
    EditMessageResponse,
    EventsResponse,
    EventWrapper,
    ExchangeTokenSwapArgs,
    GrantedBotPermissions,
    GroupChatIdentifier,
    IndexRange,
    InitialStateResponse,
    JoinVideoCallResponse,
    LeaveCommunityResponse,
    LeaveGroupResponse,
    ManageFavouritesResponse,
    MarkReadRequest,
    MarkReadResponse,
    Message,
    MessageActivityFeedResponse,
    MessageContext,
    NamedAccount,
    OptionUpdate,
    PayForStreakInsuranceResponse,
    PendingCryptocurrencyTransfer,
    PendingCryptocurrencyWithdrawal,
    PinChatResponse,
    PublicProfile,
    Rules,
    SaveCryptoAccountResponse,
    SearchDirectChatResponse,
    SendMessageResponse,
    SetBioResponse,
    SetMessageReminderResponse,
    SetPinNumberResponse,
    SetVideoCallPresenceResponse,
    SwapTokensResponse,
    TipMessageResponse,
    ToggleMuteNotificationResponse,
    TokenSwapStatusResponse,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnpinChatResponse,
    UpdatesResponse,
    Verification,
    VideoCallPresence,
    WalletConfig,
    WithdrawBtcResponse,
    WithdrawCryptocurrencyResponse,
} from "openchat-shared";
import { ANON_USER_ID, AnonymousOperationError, CommonResponses } from "openchat-shared";

export class AnonUserClient {
    public get userId(): string {
        return ANON_USER_ID;
    }

    static create(): AnonUserClient {
        console.debug("ANON: creating anonymous user client");
        return new AnonUserClient();
    }

    manageFavouriteChats(
        _toAdd: ChatIdentifier[],
        _toRemove: ChatIdentifier[],
    ): Promise<ManageFavouritesResponse> {
        return Promise.resolve(CommonResponses.success());
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
            maxStreak: 0,
            nextDailyClaim: 0n,
            chitBalance: 0,
            totalChitEarned: 0,
            referrals: [],
            walletConfig: { kind: "auto_wallet", minDollarValue: 1 },
            messageActivitySummary: {
                readUpToTimestamp: 0n,
                latestTimestamp: 0n,
                unreadCount: 0,
            },
            bots: new Map(),
            bitcoinAddress: undefined,
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

    getCachedEventsByIndex(
        _eventIndexes: number[],
        _chatId: DirectChatIdentifier,
        _threadRootMessageIndex: number | undefined,
    ): Promise<[EventsResponse<ChatEvent>, Set<number>]> {
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

    claimDailyChit(_utcOffsetMins: number | undefined): Promise<ClaimDailyChitResponse> {
        throw new AnonymousOperationError();
    }

    configureWallet(_walletConfig: WalletConfig): Promise<void> {
        throw new AnonymousOperationError();
    }

    markActivityFeedRead(_timestamp: bigint): Promise<void> {
        throw new AnonymousOperationError();
    }

    messageActivityFeed(_since: bigint): Promise<MessageActivityFeedResponse> {
        throw new AnonymousOperationError();
    }

    updateInstalledBot(
        _botId: string,
        _grantedPermissions: GrantedBotPermissions,
    ): Promise<boolean> {
        throw new AnonymousOperationError();
    }

    generateBtcAddress(): Promise<string> {
        throw new AnonymousOperationError();
    }

    updateBtcBalance(): Promise<boolean> {
        throw new AnonymousOperationError();
    }

    withdrawBtc(
        _address: string,
        _amount: bigint,
        _pin: string | undefined,
    ): Promise<WithdrawBtcResponse> {
        throw new AnonymousOperationError();
    }

    payForStreakInsurance(
        _additionalDays: number,
        _expectedPrice: bigint,
        _pin: string | undefined,
    ): Promise<PayForStreakInsuranceResponse> {
        throw new AnonymousOperationError();
    }

    updateChatSettings(
        _userId: string,
        _eventsTtl: OptionUpdate<bigint>
    ): Promise<boolean> {
        throw new AnonymousOperationError();
    }
}
