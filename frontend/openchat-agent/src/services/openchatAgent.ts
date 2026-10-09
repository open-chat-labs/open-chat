/* eslint-disable no-case-declarations */
import { CanisterStatus, HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import type {
    ModerationConfig,
    VaultLogResponse,
    AcceptP2PSwapResponse,
    AcceptedRules,
    AccessGateConfig,
    AccessTokenType,
    AccountTransactionResult,
    AddHotGroupExclusionResponse,
    AddRemoveReactionResponse,
    ApproveTransferResponse,
    ArchiveChatResponse,
    AuthenticationPrincipalsResponse,
    BlobReference,
    BlockUserResponse,
    BotCommandResponse,
    BotDefinition,
    BotInstallationLocation,
    BotsResponse,
    CancelP2PSwapResponse,
    CandidateGroupChat,
    CandidateProposal,
    ChangeRoleResponse,
    ChannelIdentifier,
    ChannelSummaryResponse,
    ChatEvent,
    ChatIdentifier,
    ChatStateFull,
    ChatSummary,
    CheckUsernameResponse,
    ChitEvent,
    ChitEventsRequest,
    ChitEventsResponse,
    ChitLeaderboardResponse,
    ChitState,
    CkbtcMinterDepositInfo,
    CkbtcMinterWithdrawalInfo,
    ClaimDailyChitResponse,
    ClaimPrizeResponse,
    CommunityCanisterCommunitySummaryUpdates,
    CommunityIdentifier,
    CommunityInvite,
    CommunitySummary,
    CommunitySummaryResponse,
    ConvertToCommunityResponse,
    CreateGroupResponse,
    CreateUserGroupResponse,
    CreatedUser,
    CryptocurrencyDetails,
    CurrentUserResponse,
    DataContent,
    DeclineInvitationResponse,
    DeleteFrozenGroupResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DeleteUserGroupsResponse,
    DeletedDirectMessageResponse,
    DeletedGroupMessageResponse,
    DexId,
    DexSwapResult,
    DiamondMembershipDuration,
    DiamondMembershipFees,
    DirectChatIdentifier,
    DirectChatSummary,
    DirectChatSummaryUpdates,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventWrapper,
    EventsResponse,
    EvmChain,
    ExchangeTokenSwapArgs,
    ExploreBotsResponse,
    ExploreChannelsResponse,
    ExploreCommunitiesResponse,
    ExternalAchievement,
    ExternalAchievementsSuccess,
    ExternalBot,
    FollowThreadResponse,
    FreezeCommunityResponse,
    FreezeGroupResponse,
    FullWebhookDetails,
    GenerateMagicLinkResponse,
    GetDelegationResponse,
    GrantedBotPermissions,
    GroupAndCommunitySummaryUpdatesArgs,
    GroupAndCommunitySummaryUpdatesResponseBatch,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    GroupChatDetailsResponse,
    GroupChatIdentifier,
    GroupChatSummary,
    GroupInvite,
    GroupSearchResponse,
    IcrcAccount,
    IndexRange,
    InviteCodeResponse,
    JoinCommunityResponse,
    JoinGroupResponse,
    JoinVideoCallResponse,
    LeaveGroupResponse,
    ListNervousSystemFunctionsResponse,
    Logger,
    MarkReadRequest,
    MarkReadResponse,
    MemberRole,
    Message,
    MessageActivityEvent,
    MessageActivityFeedResponse,
    MessageActivitySummary,
    MessageContent,
    MessageContext,
    MinutesOnline,
    MultiUserChatIdentifier,
    OneSecForwardingStatus,
    OneSecTransferFees,
    OptionUpdate,
    OptionalChatPermissions,
    PayForDiamondMembershipResponse,
    PayForPremiumItemResponse,
    PayForStreakInsuranceResponse,
    PendingCryptocurrencyTransfer,
    PendingCryptocurrencyWithdrawal,
    PinChatResponse,
    PinMessageResponse,
    PinNumberSettings,
    PremiumItem,
    PrepareDelegationResponse,
    ProposalVoteDetails,
    PublicGroupSummaryResponse,
    PublicProfile,
    Referral,
    MessagePreview,
    RehydratedMessagePreview,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    ManageNeuronResponse,
    RegisterUserResponse,
    RegistryValue,
    RemoveHotGroupExclusionResponse,
    RemoveMemberResponse,
    ResetInviteCodeResponse,
    Rules,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    SendMessageResponse,
    SetBioResponse,
    ModerationVerdict,
    NcaPriority,
    NcaReporterContact,
    AuthorityReportTokenResponse,
    SetCommunityModerationFlagsResponse,
    SetGroupModerationFlagsResponse,
    SetDisplayNameResponse,
    SetGroupUpgradeConcurrencyResponse,
    SetMemberDisplayNameResponse,
    SetMessageReminderResponse,
    SetPinNumberResponse,
    SetUserUpgradeConcurrencyResponse,
    CreateMultiUserCanisterResponse,
    MigrateUsersResponse,
    UserMigrationResponse,
    UsersToMigrate,
    FundsInPreviousWallet,
    MoveFundsFromOldCanisterResponse,
    MoveFundsOutcome,
    MoveFundsResult,
    SetUsernameResponse,
    SetVideoCallPresenceResponse,
    SiwePrepareLoginResponse,
    SiwsPrepareLoginResponse,
    StakeNeuronForSubmittingProposalsResponse,
    StorageStatus,
    StreakInsurance,
    SubmitProofOfUniquePersonhoodResponse,
    SubmitProposalResponse,
    SuspendUserResponse,
    SwapTokensResponse,
    ThreadPreview,
    ThreadPreviewsResponse,
    ThreadSyncDetails,
    TipMessageResponse,
    ToggleMuteNotificationResponse,
    TokenExchangeRates,
    TokenInfo,
    TokenSwapPool,
    TokenSwapStatusResponse,
    TopUpNeuronResponse,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnfinishedTokenSwap,
    UnfreezeCommunityResponse,
    UnfreezeGroupResponse,
    UnpinChatResponse,
    UnpinMessageResponse,
    UnsuspendUserResponse,
    UpdateGroupResponse,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
    UpdateUserGroupResponse,
    UpdatedRules,
    UpdatesResult,
    UpdatesSuccessResponse,
    User,
    UserCanisterCommunitySummary,
    UserCanisterCommunitySummaryUpdates,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
    UserSummary,
    UsersArgs,
    UsersResponse,
    Verification,
    VerifiedCredentialArgs,
    VideoCallParticipantsResponse,
    VideoCallPresence,
    WaitAllResult,
    WalletConfig,
    WithdrawBtcResponse,
    WithdrawCryptocurrencyResponse,
    VaultFileChunkResponse,
    VaultFileInfoResponse,
    ProposedProtectedAction,
    Success,
    OCError,
    DailyPuzzleConfig,
    DailyPuzzleFetchResult,
    DailyPuzzleHintResponse,
    DailyPuzzleResult,
    DailyPuzzleStartResponse,
    DailyPuzzleSubmitResponse,
    PublicDailyPuzzle,
    SyncSinceResponse,
    LookupMembersResponse,
} from "@shared";
import {
    ANON_USER_ID,
    APPROVAL_VALIDITY_MS,
    ChatMap,
    CommonResponses,
    ErrorCode,
    isCanisterGoneError,
    LEDGER_CANISTER_CHAT,
    Lazy,
    MAX_ACTIVITY_EVENTS,
    ONE_MINUTE_MILLIS,
    Stream,
    SyncHeadMoved,
    UnsupportedValueError,
    applyOptionUpdate,
    buildBlobUrl,
    chatIdentifiersEqual,
    emptyEventsResponse,
    encodeIcrcAccount,
    isCanisterId,
    isError,
    isMultiUserCanisterUser,
    isSuccessfulEventsResponse,
    memberSpenderAccount,
    mergeEventStreamResponses,
    messageContextToString,
    messageContextsEqual,
    offline,
    textToCode,
    userCanisterSpenderAccount,
    userWalletAccount,
    waitAll,
} from "@shared";
import type { AgentConfig } from "../config";
import { CachePrimer } from "../utils/cachePrimer";
import {
    buildUserAvatarUrl,
    getUpdatedEvents,
    isExpired,
    mergeDirectChatUpdates,
    mergeGroupChatUpdates,
    mergeGroupChats,
} from "../utils/chat";
import { ChatsDb } from "../utils/chatsDb";
import { mergeWaitAllResults, summaryUpdatesArgsByLocalUserIndex } from "../utils/summaryUpdates";
import { CacheWriteQueue } from "../utils/cacheWriteQueue";
import { applyRefresh, refreshArgs, refreshTarget } from "../utils/refreshChat";
import {
    emptySyncStamps,
    emptyUpdatesResult,
    snapshotOf,
    touchedFields,
    updatesSince,
} from "../utils/sync";
import {
    isSuccessfulCommunitySummaryResponse,
    mergeCommunities,
    mergeCommunityUpdates,
} from "../utils/community";
import { createHttpAgentSync } from "../utils/httpAgent";
import { icNowNanos } from "../utils/icTime";
import { chunk, distinctBy, toRecord, toRecord2 } from "../utils/list";
import { bytesToHexString, mapOptional } from "../utils/mapping";
import { withLatestUserIds } from "../utils/latestUserIds";
import { findMovedDirectChats } from "../utils/movedDirectChats";
import { mergeAccountTransactions } from "../utils/accountTransactions";
import { mean } from "../utils/maths";
import { extractMessagePreviews } from "@shared";
import { AsyncMessageContextMap } from "../utils/messageContext";
// import { isMainnet } from "../utils/network";
import {
    clearReferralCache,
    deleteCommunityReferral,
    getCommunityReferral,
    setCommunityReferral,
} from "../utils/referralCache";
import { RegistryDb } from "../utils/registryDb";
import { Updatable, UpdatableOption } from "../utils/updatable";
import { UserDb } from "../utils/userCache";
import { BitcoinClient } from "./bitcoin/bitcoin.client";
import { CkbtcMinterClient } from "./ckbtcMinter/ckbtcMinter.client";
import { CachedChatEventsReader } from "./common/chatEvents";
import { measure } from "./common/profiling";
import { CommunityClient } from "./community/community.client";
import { DataClient } from "./data/data.client";
import { DexesAgent } from "./dexes";
import { TACO_TREASURY_CANISTER_ID } from "./dexes/taco/index/mappers";
import { IcpSwapPoolClient } from "./dexes/icpSwap/pool/icpSwap.pool.client";
import { callBotCommandEndpoint } from "./externalBot/externalBot";
import { GroupClient } from "./group/group.client";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import { IcpLedgerIndexClient } from "./icpLedgerIndex/icpLedgerIndex.client";
import { IcpSwapClient } from "./icpSwap/icpSwapClient";
import { IcpCoinsClient } from "./icpcoins/icpCoinsClient";
import { IdentityClient } from "./identity/identity.client";
import { LedgerClient } from "./ledger/ledger.client";
import { LedgerIndexClient } from "./ledgerIndex/ledgerIndex.client";
import type { Wallets } from "./ledgerIndex/mappers";
import { LocalUserIndexClient } from "./localUserIndex/localUserIndex.client";
import { MarketMakerClient } from "./marketMaker/marketMaker.client";
import { NnsGovernanceClient } from "./nnsGovernance/nns.governance.client";
import { NotificationsClient } from "./notifications/notifications.client";
import { OneSecForwarderClient } from "./oneSecForwarder/oneSecForwarder.client";
import { OneSecMinterClient } from "./oneSecMinter/oneSecMinter.client";
import { OnlineClient } from "./online/online.client";
import { DailyPuzzleClient } from "./dailyPuzzle/dailyPuzzle.client";
import { ProposalsBotClient } from "./proposalsBot/proposalsBot.client";
import { RegistryClient } from "./registry/registry.client";
import { SignInWithEmailClient } from "./signInWithEmail/signInWithEmail.client";
import { SignInWithEthereumClient } from "./signInWithEthereum/signInWithEthereum.client";
import { SignInWithSolanaClient } from "./signInWithSolana/signInWithSolana.client";
import { SnsGovernanceClient } from "./snsGovernance/sns.governance.client";
import { TranslationsClient } from "./translations/translations.client";
import { AnonUserClient } from "./user/anonUser.client";
import { UserClient } from "./user/user.client";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { StorageBucketClient } from "./storageBucket/storageBucket.client";

type ResolvedMessagePreviews = {
    messages: AsyncMessageContextMap<EventWrapper<Message>>;
    previews: Map<bigint, MessagePreview[]>;
};

function emptyResolvedMessagePreviews(): ResolvedMessagePreviews {
    return { messages: new AsyncMessageContextMap(), previews: new Map() };
}

const NNS_ERROR_TYPE_NEURON_ALREADY_VOTED = 19;
const MAX_CONCURRENT_PREVIOUS_WALLET_BALANCE_CHECKS = 10;
// The most ledgers the LocalUserIndex moves funds from in one call
const MAX_LEDGERS_PER_FUNDS_MOVE = 20;
const MAX_FUNDS_MOVE_RETRIES = 3;
const FUNDS_MOVE_RETRY_INTERVAL_MS = 10_000;
const MARK_TOKEN_SWAP_COMPLETED_ATTEMPTS = 3;

export class OpenChatAgent extends EventTarget {
    private _agent: HttpAgent;
    private _userIndexClient: UserIndexClient;
    private _storageBucketClients: Map<string, StorageBucketClient> = new Map();
    private _onlineClient: OnlineClient;
    private _dailyPuzzleClient: Lazy<DailyPuzzleClient>;
    private _groupIndexClient: GroupIndexClient;
    private _userClient: UserClient | AnonUserClient;
    // The current user's id, and the ids they had before being migrated to a MultiUser canister, as
    // last returned by `getCurrentUser`
    private _ownUserIds: { userId: string; previousUserIds: string[] } | undefined;
    // Each of the user's ids other than the one this session is under, mapped to that one
    private _ownLatestUserIds: ReadonlyMap<string, string> = new Map();
    private _notificationClient: NotificationsClient;
    private _registryClient: RegistryClient;
    private _identityClient: IdentityClient;
    private _dataClient: DataClient;
    private _localUserIndexClient: LocalUserIndexClient;
    private _ledgerClient: LedgerClient;
    private _ledgerIndexClient: LedgerIndexClient;
    private _groupClient: GroupClient;
    private _communityClient: CommunityClient;
    private _exchangeRateClients: ExchangeRateClient[];
    private _groupInvite: GroupInvite | undefined;
    private _registryValue: RegistryValue | undefined;
    private _logger: Logger;
    private _cachePrimer: CachePrimer | undefined = undefined;
    #cacheWrites = new CacheWriteQueue();
    #queuedRefreshes: Map<string, Promise<boolean>> = new Map();
    private _chatEventsReader: CachedChatEventsReader;
    private _chatsDb: ChatsDb;
    private _userDb: UserDb;
    private _registryDb: RegistryDb;

    // Lazy loaded clients which may never end up being used
    private _bitcoinClient: Lazy<BitcoinClient>;
    private _ckbtcMinterClient: Lazy<CkbtcMinterClient>;
    private _dexesAgent: Lazy<DexesAgent>;
    private _marketMakerClient: Lazy<MarketMakerClient>;
    private _proposalsBotClient: Lazy<ProposalsBotClient>;
    private _signInWithEmailClient: Lazy<SignInWithEmailClient>;
    private _signInWithEthereumClient: Lazy<SignInWithEthereumClient>;
    private _signInWithSolanaClient: Lazy<SignInWithSolanaClient>;
    private _translationsClient: Lazy<TranslationsClient>;
    private _oneSecForwarderClient: Lazy<OneSecForwarderClient>;
    private _oneSecMinterClient: Lazy<OneSecMinterClient>;

    constructor(
        private identity: Identity,
        private authPrincipal: string,
        private config: AgentConfig,
    ) {
        super();
        this._logger = config.logger;
        console.log("url", config.icUrl);
        this._agent = createHttpAgentSync(identity, config.icUrl);
        this._chatsDb = new ChatsDb(this.principal);
        this._userDb = new UserDb();
        this._registryDb = new RegistryDb();
        this._onlineClient = new OnlineClient(identity, this._agent, config.onlineCanister);
        this._userClient = AnonUserClient.create();
        this._userIndexClient = new UserIndexClient(
            identity,
            this._agent,
            config.userIndexCanister,
            config.blobUrlPattern,
            this._chatsDb,
            this._userDb,
        );
        this._groupIndexClient = new GroupIndexClient(
            identity,
            this._agent,
            config.groupIndexCanister,
        );
        this._notificationClient = new NotificationsClient(
            identity,
            this._agent,
            config.notificationsCanister,
        );
        this._registryClient = new RegistryClient(
            identity,
            this._agent,
            config.registryCanister,
            config.blobUrlPattern,
        );
        this._identityClient = new IdentityClient(identity, this._agent, config.identityCanister);
        this._dataClient = new DataClient(identity, this._agent, config);
        this._exchangeRateClients = [
            new IcpCoinsClient(identity, this._agent),
            new IcpSwapClient(),
        ];
        this._localUserIndexClient = new LocalUserIndexClient(identity, this._agent, this._chatsDb);
        this._ledgerClient = new LedgerClient(identity, this._agent);
        this._ledgerIndexClient = new LedgerIndexClient(identity, this._agent);
        this._groupClient = new GroupClient(identity, this._agent, config, this._chatsDb);
        this._communityClient = new CommunityClient(identity, this._agent, config, this._chatsDb);

        if (config.groupInvite !== undefined) {
            this.groupInvite = config.groupInvite;
        }

        this._chatEventsReader = new CachedChatEventsReader(
            this._userClient,
            this._groupClient,
            this._communityClient,
            this._chatsDb,
        );

        this._bitcoinClient = new Lazy(
            () => new BitcoinClient(this.identity, this._agent, this.config.bitcoinMainnetEnabled),
        );
        this._ckbtcMinterClient = new Lazy(
            () =>
                new CkbtcMinterClient(
                    this.identity,
                    this._agent,
                    this.config.bitcoinMainnetEnabled,
                ),
        );
        this._dexesAgent = new Lazy(() => new DexesAgent(this._agent));
        this._marketMakerClient = new Lazy(
            () => new MarketMakerClient(identity, this._agent, config.marketMakerCanister),
        );
        this._proposalsBotClient = new Lazy(
            () => new ProposalsBotClient(identity, this._agent, config.proposalBotCanister),
        );
        this._signInWithEmailClient = new Lazy(
            () => new SignInWithEmailClient(identity, this._agent, config.signInWithEmailCanister),
        );
        this._signInWithEthereumClient = new Lazy(
            () =>
                new SignInWithEthereumClient(
                    identity,
                    this._agent,
                    config.signInWithEthereumCanister,
                ),
        );
        this._signInWithSolanaClient = new Lazy(
            () =>
                new SignInWithSolanaClient(identity, this._agent, config.signInWithSolanaCanister),
        );
        this._translationsClient = new Lazy(
            () => new TranslationsClient(identity, this._agent, config.translationsCanister),
        );
        this._oneSecForwarderClient = new Lazy(
            () => new OneSecForwarderClient(identity, this._agent, config.oneSecForwarderCanister),
        );
        this._oneSecMinterClient = new Lazy(
            () => new OneSecMinterClient(identity, this._agent, config.oneSecMinterCanister),
        );
        this._dailyPuzzleClient = new Lazy(
            () => new DailyPuzzleClient(identity, this._agent, config.dailyPuzzleCanister),
        );
    }

    private get principal(): Principal {
        return this.identity.getPrincipal();
    }

    // A client for another user's canister. Throws if `userId` isn't a principal, since the canister
    // to call is derived from it.
    private otherUserClient(userId: string): UserClient {
        return new UserClient(
            userId,
            this.identity,
            this._agent,
            this.config,
            this._chatsDb,
            this._userDb,
        );
    }

    // The ledger account holding the funds of `userId`. That is the principal's account for anyone
    // but a user alone in their canister, and only the current user's principal is known here, so
    // for anyone else `userId` has to be a canister, such as a User canister or the translations
    // canister.
    private walletAccount(userId: string): IcrcAccount {
        if (userId !== this._userClient.userId && !isCanisterId(Principal.fromText(userId))) {
            throw new Error(`Only the current user's wallet is known, not ${userId}'s`);
        }
        return userWalletAccount(userId, () => this.principal.toText());
    }

    // Whether the user holds their own funds, in the account of the principal they sign in with,
    // rather than their canister holding them, as it does for a user alone in it. A canister can
    // only pull a payment from such a user's wallet once they have approved it as spender.
    private holdsOwnFunds(): boolean {
        return isMultiUserCanisterUser(this._userClient.userId);
    }

    // Approves `spender` to pull a payment from the user's wallet, as the user, returning the error
    // to report if it couldn't be, or undefined once it has been.
    //
    // `pin` is the PIN the payment is made with, if the user has set one, which their canister
    // checks before anything is approved, so that a payment with the wrong PIN is refused before
    // the user pays for its approval. Where the spender is the user's canister it checks the PIN
    // again as it pulls the payment, but a group, community or other canister has no way to, so
    // nothing is approved unless the PIN has been checked here.
    //
    // `amount` is all that the payment takes from the wallet, so includes the fee of each transfer
    // the spender makes, and `fee` is what the ledger charges for the approval itself. Without
    // knowing that, there is no telling whether the wallet can afford both, so nothing is approved.
    // `validityMs` is how long the spender has to pull the payment, by default long enough for one
    // pulled at once.
    //
    // The approval is made, and paid for, before the spender has checked anything, so a payment it
    // then refuses still costs the approval's fee, and leaves the spender approved for the payment
    // until the approval lapses.
    private async approveToPull(
        spender: IcrcAccount,
        ledger: string,
        amount: bigint,
        fee: bigint | undefined,
        pin: string | undefined,
        validityMs: number = APPROVAL_VALIDITY_MS,
    ): Promise<OCError | undefined> {
        if (fee === undefined) {
            return { kind: "error", code: ErrorCode.ApprovalFailed, message: undefined };
        }

        if (pin !== undefined) {
            const checked = await this.userClient
                .checkPinNumber(pin)
                .catch((err: unknown): OCError => {
                    console.warn("Failed to check the PIN ahead of approving a payment", err);
                    return { kind: "error", code: ErrorCode.ApprovalFailed, message: undefined };
                });
            if (checked.kind === "error") {
                return checked;
            }
        }

        const response = await this._ledgerClient
            .approveSpending(ledger, spender, amount, fee, validityMs)
            .catch((err) => {
                console.warn("Failed to approve a payment being pulled from the wallet", err);
                return "failure" as const;
            });

        switch (response) {
            case "success":
                return undefined;
            case "insufficient_funds":
                return { kind: "error", code: ErrorCode.InsufficientFunds, message: undefined };
            case "failure":
                return { kind: "error", code: ErrorCode.ApprovalFailed, message: undefined };
        }
    }

    // Approves the user's canister to pull a payment from the user's wallet, just before each
    // payment it will pull, if the user holds their own funds. A user alone in their canister needs
    // no approval, since the canister holds their funds itself, and neither does a payment from
    // another account (`fromAccount`), whose owner has approved it already. `pin` is checked before
    // the approval (see `approveToPull`).
    private approveUserCanisterToPull(
        ledger: string,
        amount: bigint,
        fee: bigint | undefined,
        fromAccount: string | undefined,
        pin: string | undefined,
    ): Promise<OCError | undefined> {
        if (fromAccount !== undefined || !this.holdsOwnFunds()) {
            return Promise.resolve(undefined);
        }
        const userId = this._userClient.userId;
        const spender = userCanisterSpenderAccount(userId, () => this.principal.toText());
        return this.approveToPull(spender, ledger, amount, fee, pin);
    }

    // The account a group or community spends as when it pulls a payment from one of its members
    // (see `memberSpenderAccount`)
    private chatSpenderAccount(chatId: GroupChatIdentifier | ChannelIdentifier): IcrcAccount {
        return this.memberSpenderAccount(
            chatId.kind === "channel" ? chatId.communityId : chatId.groupId,
        );
    }

    private memberSpenderAccount(canisterId: string): IcrcAccount {
        return memberSpenderAccount(canisterId, () => this.principal.toText());
    }

    // What a message takes from its sender's wallet: the crypto it sends or the prize it offers,
    // with the transfer's fee, or the token0 of the swap it offers, which is deposited in the escrow
    // canister along with the fee for paying it out, so costs two fees.
    private paymentInMessage(
        content: MessageContent,
    ):
        | { ledger: string; amount: bigint; fee: bigint; fromAccount: string | undefined }
        | undefined {
        if (
            (content.kind === "crypto_content" || content.kind === "prize_content_initial") &&
            content.transfer.kind === "pending"
        ) {
            const { ledger, amountE8s, feeE8s = 0n, fromAccount } = content.transfer;
            return { ledger, amount: amountE8s + feeE8s, fee: feeE8s, fromAccount };
        }
        if (content.kind === "p2p_swap_content_initial") {
            const { ledger, fee } = content.token0;
            return {
                ledger,
                amount: content.token0Amount + 2n * fee,
                fee,
                fromAccount: content.fromAccount,
            };
        }
        return undefined;
    }

    // The message with the crypto it sends or the prize it offers stamped with the time on the IC
    // (see `icNowNanos`). A swap offer carries no stamp, its deposit being stamped by the canister
    // which makes it.
    private async stampTransferWithIcTime(
        event: EventWrapper<Message>,
    ): Promise<EventWrapper<Message>> {
        const content = event.event.content;
        if (
            (content.kind !== "crypto_content" && content.kind !== "prize_content_initial") ||
            content.transfer.kind !== "pending"
        ) {
            return event;
        }
        const createdAtNanos = await icNowNanos(this._agent, content.transfer.ledger);
        const stamped = {
            ...content,
            transfer: { ...content.transfer, createdAtNanos },
        } as MessageContent;
        return { ...event, event: { ...event.event, content: stamped } };
    }

    // The fee the ledger charges for a transfer or an approval, if the token is a registered one
    private ledgerFee(ledger: string): bigint | undefined {
        return this._registryValue?.tokenDetails.find((t) => t.ledger === ledger)?.transferFee;
    }

    getAllCachedUsers(): Promise<UserSummary[]> {
        return measure("getAllUsers", () =>
            this._userDb
                .getAllUsers()
                .then((users) => users.map((u) => this.rehydrateUserSummary(u))),
        );
    }

    logError(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.error(message, optionalParams);
    }

    public set groupInvite(value: GroupInvite) {
        this._groupClient.setInviteCode(value.chatId.groupId, textToCode(value.code));
    }

    public set communityInvite(value: CommunityInvite) {
        this._communityClient.setInviteCode(value.id.communityId, textToCode(value.code));
    }

    createUserClient(userId: string): OpenChatAgent {
        const userClient =
            userId === ANON_USER_ID
                ? AnonUserClient.create()
                : new UserClient(
                      userId,
                      this.identity,
                      this._agent,
                      this.config,
                      this._chatsDb,
                      this._userDb,
                  );

        this._userClient = userClient;
        this._chatEventsReader.setUserClient(userClient);
        this.updateOwnLatestUserIds();
        return this;
    }

    // Maps each of the user's ids to the one this session is under. That's their latest id, unless the
    // session carries on under an earlier one, which the client does if it can't restart under the
    // latest, in which case whatever they did under either still shows as their own. An id the
    // session doesn't recognise as one of the user's, eg. a new account on the same principal, maps
    // nothing onto it.
    private updateOwnLatestUserIds() {
        const own = this._ownUserIds;
        if (own === undefined) {
            this._ownLatestUserIds = new Map();
            return;
        }
        const ids = [...own.previousUserIds, own.userId];
        const sessionUserId = this._userClient.userId;
        const target = ids.includes(sessionUserId) ? sessionUserId : own.userId;
        this._ownLatestUserIds = new Map(
            ids.filter((id) => id !== target).map((id) => [id, target]),
        );
    }

    get communityClient(): CommunityClient {
        return this._communityClient;
    }

    get groupClient(): GroupClient {
        return this._groupClient;
    }

    get userClient(): UserClient | AnonUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    private getCommunityReferral(communityId: string): Promise<string | undefined> {
        return getCommunityReferral(communityId, Date.now());
    }

    setCommunityReferral(communityId: string, referredBy: string): Promise<void> {
        return setCommunityReferral(communityId, referredBy, Date.now());
    }

    translationsClient(): TranslationsClient {
        return this._translationsClient.get();
    }

    editMessage(
        chatId: ChatIdentifier,
        msg: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "direct_chat":
                return this.editDirectMessage(
                    chatId,
                    msg,
                    threadRootMessageIndex,
                    blockLevelMarkdown,
                );
            case "group_chat":
                return this.editGroupMessage(
                    chatId,
                    msg,
                    threadRootMessageIndex,
                    blockLevelMarkdown,
                    newAchievement,
                );
            case "channel":
                return this.editChannelMessage(
                    chatId,
                    msg,
                    threadRootMessageIndex,
                    blockLevelMarkdown,
                    newAchievement,
                );
        }
    }

    sendMessage(
        messageContext: MessageContext,
        user: CreatedUser,
        mentioned: User[],
        event: EventWrapper<Message>,
        acceptedRules: AcceptedRules | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
        newAchievement: boolean,
    ): Stream<"accepted" | [SendMessageResponse, Message]> {
        return new Stream(async (resolve, reject) => {
            const onRequestAccepted = () => resolve("accepted", false);
            const { chatId, threadRootMessageIndex } = messageContext;

            if (offline()) {
                this._chatsDb.recordFailedMessage(chatId, event, threadRootMessageIndex);
                return resolve([CommonResponses.offline(), event.event], true);
            }

            event = await this.stampTransferWithIcTime(event);

            // A user who holds their own funds can't have their canister make a transfer for them
            if (
                chatId.kind !== "direct_chat" &&
                this.holdsOwnFunds() &&
                (event.event.content.kind === "crypto_content" ||
                    event.event.content.kind === "prize_content_initial" ||
                    event.event.content.kind === "p2p_swap_content_initial")
            ) {
                return resolve(
                    await this.sendMessageWithTransferDirectly(
                        chatId,
                        user,
                        mentioned,
                        event,
                        threadRootMessageIndex,
                        acceptedRules,
                        messageFilterFailed,
                        pin,
                        newAchievement,
                        onRequestAccepted,
                    ),
                    true,
                );
            }

            if (chatId.kind === "channel") {
                if (
                    event.event.content.kind === "crypto_content" ||
                    event.event.content.kind === "prize_content_initial" ||
                    event.event.content.kind === "p2p_swap_content_initial"
                ) {
                    return resolve(
                        await this.userClient.sendMessageWithTransferToChannel(
                            chatId,
                            event.event.content.kind !== "p2p_swap_content_initial"
                                ? event.event.content.transfer.recipient
                                : undefined,
                            user,
                            event,
                            threadRootMessageIndex,
                            acceptedRules?.community,
                            acceptedRules?.chat,
                            messageFilterFailed,
                            pin,
                        ),
                        true,
                    );
                }
                return resolve(
                    await this.sendChannelMessage(
                        chatId,
                        user.username,
                        user.displayName,
                        mentioned,
                        event,
                        threadRootMessageIndex,
                        acceptedRules?.community,
                        acceptedRules?.chat,
                        messageFilterFailed,
                        newAchievement,
                        onRequestAccepted,
                    ),
                    true,
                );
            }
            if (chatId.kind === "group_chat") {
                if (
                    event.event.content.kind === "crypto_content" ||
                    event.event.content.kind === "prize_content_initial" ||
                    event.event.content.kind === "p2p_swap_content_initial"
                ) {
                    return resolve(
                        await this.userClient.sendMessageWithTransferToGroup(
                            chatId,
                            event.event.content.kind !== "p2p_swap_content_initial"
                                ? event.event.content.transfer.recipient
                                : undefined,
                            user,
                            event,
                            threadRootMessageIndex,
                            acceptedRules?.chat,
                            messageFilterFailed,
                            pin,
                        ),
                        true,
                    );
                }
                return resolve(
                    await this.sendGroupMessage(
                        chatId,
                        user.username,
                        user.displayName,
                        mentioned,
                        event,
                        threadRootMessageIndex,
                        acceptedRules?.chat,
                        messageFilterFailed,
                        newAchievement,
                        onRequestAccepted,
                    ),
                    true,
                );
            }
            if (chatId.kind === "direct_chat") {
                return resolve(
                    await this.sendDirectMessage(
                        chatId,
                        event,
                        messageFilterFailed,
                        threadRootMessageIndex,
                        pin,
                        onRequestAccepted,
                    ),
                    true,
                );
            }
            reject(new UnsupportedValueError("Unexpect chat type", chatId));
        });
    }

    private sendChannelMessage(
        chatId: ChannelIdentifier,
        senderName: string,
        senderDisplayName: string | undefined,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        communityRulesAccepted: number | undefined,
        channelRulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        newAchievement: boolean,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        return this._communityClient.sendMessage(
            chatId,
            senderName,
            senderDisplayName,
            mentioned,
            event,
            threadRootMessageIndex,
            communityRulesAccepted,
            channelRulesAccepted,
            messageFilterFailed,
            newAchievement,
            onRequestAccepted,
        );
    }

    private sendGroupMessage(
        chatId: GroupChatIdentifier,
        senderName: string,
        senderDisplayName: string | undefined,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        newAchievement: boolean,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        return this._groupClient.sendMessage(
            chatId.groupId,
            senderName,
            senderDisplayName,
            mentioned,
            event,
            threadRootMessageIndex,
            rulesAccepted,
            messageFilterFailed,
            newAchievement,
            onRequestAccepted,
        );
    }

    private editGroupMessage(
        chatId: GroupChatIdentifier,
        message: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        return this._groupClient.editMessage(
            chatId.groupId,
            message,
            threadRootMessageIndex,
            blockLevelMarkdown,
            newAchievement,
        );
    }

    private editChannelMessage(
        chatId: ChannelIdentifier,
        message: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        return this._communityClient.editMessage(
            chatId,
            message,
            threadRootMessageIndex,
            blockLevelMarkdown,
            newAchievement,
        );
    }

    // Approves the user's canister to pull whatever a message in a direct chat takes from the
    // user's wallet
    private approveTransferInMessage(
        content: MessageContent,
        pin: string | undefined,
    ): Promise<OCError | undefined> {
        const payment = this.paymentInMessage(content);
        return payment === undefined
            ? Promise.resolve(undefined)
            : this.approveUserCanisterToPull(
                  payment.ledger,
                  payment.amount,
                  payment.fee,
                  payment.fromAccount,
                  pin,
              );
    }

    // Sends a message holding a transfer straight to its group or community, which pulls the
    // transfer from the sender's wallet, once approved to, into the wallet it knows the recipient
    // by. This is how a user who holds their own funds sends one, since their canister can't make
    // the transfer for them. A transfer from another account is pulled from that instead, which
    // its owner has to have approved the group or community to spend from (see
    // `paymentSpenderAccount`).
    private async sendMessageWithTransferDirectly(
        chatId: GroupChatIdentifier | ChannelIdentifier,
        user: CreatedUser,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        acceptedRules: AcceptedRules | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
        newAchievement: boolean,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        const payment = this.paymentInMessage(event.event.content);
        if (payment !== undefined && payment.fromAccount === undefined) {
            const error = await this.approveToPull(
                this.chatSpenderAccount(chatId),
                payment.ledger,
                payment.amount,
                payment.fee,
                pin,
            );
            if (error !== undefined) {
                return [error, event.event];
            }
        }

        const wallet = encodeIcrcAccount(this.walletAccount(this._userClient.userId));
        return chatId.kind === "channel"
            ? this._communityClient.sendMessage(
                  chatId,
                  user.username,
                  user.displayName,
                  mentioned,
                  event,
                  threadRootMessageIndex,
                  acceptedRules?.community,
                  acceptedRules?.chat,
                  messageFilterFailed,
                  newAchievement,
                  onRequestAccepted,
                  wallet,
              )
            : this._groupClient.sendMessage(
                  chatId.groupId,
                  user.username,
                  user.displayName,
                  mentioned,
                  event,
                  threadRootMessageIndex,
                  acceptedRules?.chat,
                  messageFilterFailed,
                  newAchievement,
                  onRequestAccepted,
                  wallet,
              );
    }

    private async sendDirectMessage(
        chatId: DirectChatIdentifier,
        event: EventWrapper<Message>,
        messageFilterFailed: bigint | undefined,
        threadRootMessageIndex: number | undefined,
        pin: string | undefined,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        const error = await this.approveTransferInMessage(event.event.content, pin);
        if (error !== undefined) {
            return [error, event.event];
        }

        return this.userClient.sendMessage(
            chatId,
            event,
            messageFilterFailed,
            threadRootMessageIndex,
            pin,
            onRequestAccepted,
        );
    }

    private editDirectMessage(
        recipientId: DirectChatIdentifier,
        message: Message,
        threadRootMessageIndex?: number,
        blockLevelMarkdown?: boolean,
    ): Promise<EditMessageResponse> {
        return this.userClient.editMessage(
            recipientId.userId,
            message,
            threadRootMessageIndex,
            blockLevelMarkdown,
        );
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        if (candidate.id.kind === "channel") {
            return this._communityClient.createChannel(candidate.id.communityId, candidate);
        } else {
            return this.userClient.createGroup(candidate);
        }
    }

    updateGroup(
        chatId: MultiUserChatIdentifier,
        name?: string,
        desc?: string,
        rules?: UpdatedRules,
        permissions?: OptionalChatPermissions,
        avatar?: Uint8Array,
        eventsTimeToLive?: OptionUpdate<bigint>,
        gateConfig?: AccessGateConfig,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
        externalUrl?: string,
    ): Promise<UpdateGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.updateGroup(
                    chatId.groupId,
                    name,
                    desc,
                    rules,
                    permissions,
                    avatar,
                    eventsTimeToLive,
                    gateConfig,
                    isPublic,
                    messagesVisibleToNonMembers,
                );
            case "channel":
                return this._communityClient.updateChannel(
                    chatId,
                    name,
                    desc,
                    rules,
                    permissions,
                    avatar,
                    eventsTimeToLive,
                    gateConfig,
                    isPublic,
                    messagesVisibleToNonMembers,
                    externalUrl,
                );
        }
    }

    async inviteUsers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        if (!userIds.length) {
            return Promise.resolve(true);
        }

        if (offline()) return Promise.resolve(false);

        switch (id.kind) {
            case "community": {
                const localUserIndex = await this._communityClient.localUserIndex(id.communityId);
                return this._localUserIndexClient.inviteUsersToCommunity(
                    localUserIndex,
                    id.communityId,
                    userIds,
                );
            }
            case "group_chat": {
                const localUserIndex = await this._groupClient.localUserIndex(id.groupId);
                return this._localUserIndexClient.inviteUsersToGroup(
                    localUserIndex,
                    id.groupId,
                    userIds,
                );
            }
            case "channel": {
                const localUserIndex = await this._communityClient.localUserIndex(id.communityId);
                return this._localUserIndexClient.inviteUsersToChannel(
                    localUserIndex,
                    id.communityId,
                    id.channelId,
                    userIds,
                );
            }
        }
    }

    chatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Stream<EventsResponse<ChatEvent>> {
        return this._chatEventsReader
            .chatEventsWindow(
                chatId,
                eventIndexRange,
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
            .aggregate(mergeEventStreamResponses, emptyEventsResponse())
            .mapAsync((resp) =>
                this.rehydrateEventResponse(
                    chatId,
                    resp,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                ),
            );
    }

    chatEvents(
        chatId: ChatIdentifier,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Stream<EventsResponse<ChatEvent>> {
        return this._chatEventsReader
            .chatEvents(
                chatId,
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
            .aggregate(mergeEventStreamResponses, emptyEventsResponse())
            .mapAsync((resp) =>
                this.rehydrateEventResponse(
                    chatId,
                    resp,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                ),
            );
    }

    chatEventsByEventIndex(
        chatId: ChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Stream<EventsResponse<ChatEvent>> {
        return this._chatEventsReader
            .chatEventsByIndex(chatId, eventIndexes, threadRootMessageIndex, latestKnownUpdate)
            .aggregate(mergeEventStreamResponses, emptyEventsResponse())
            .mapAsync((resp) =>
                this.rehydrateEventResponse(
                    chatId,
                    resp,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                ),
            );
    }

    async getDeletedGroupMessage(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        switch (chatId.kind) {
            case "group_chat":
                const groupResp = await this._groupClient.getDeletedMessage(
                    chatId.groupId,
                    messageId,
                    threadRootMessageIndex,
                );
                if (groupResp.kind === "success") {
                    groupResp.content = withLatestUserIds(
                        this.rehydrateMessageContent(groupResp.content),
                        this._ownLatestUserIds,
                    );
                }
                return groupResp;
            case "channel":
                const channelResp = await this._communityClient.getDeletedMessage(
                    chatId,
                    messageId,
                    threadRootMessageIndex,
                );
                if (channelResp.kind === "success") {
                    channelResp.content = withLatestUserIds(
                        this.rehydrateMessageContent(channelResp.content),
                        this._ownLatestUserIds,
                    );
                }
                return channelResp;
        }
    }

    async getDeletedDirectMessage(
        userId: string,
        messageId: bigint,
    ): Promise<DeletedDirectMessageResponse> {
        const response = await this.userClient.getDeletedMessage(userId, messageId);
        if (response.kind === "success") {
            response.content = withLatestUserIds(
                this.rehydrateMessageContent(response.content),
                this._ownLatestUserIds,
            );
        }
        return response;
    }

    private rehydrateMessageContent(content: MessageContent): MessageContent {
        if (
            (content.kind === "file_content" ||
                content.kind === "image_content" ||
                content.kind === "audio_content") &&
            content.blobReference !== undefined
        ) {
            content = this.rehydrateDataContent(content);
        }
        if (content.kind === "video_content") {
            return {
                ...content,
                videoData: this.rehydrateDataContent(content.videoData),
                imageData: this.rehydrateDataContent(content.imageData),
            };
        }
        return content;
    }

    /**
     * Given a list of events, identify all eventIndexes which we may need to look up
     * In practice this means the event indexes of embedded reply contexts
     */
    private findMissingEventIndexesByChat<T extends ChatEvent>(
        defaultChatId: ChatIdentifier,
        events: EventWrapper<T>[],
        threadRootMessageIndex: number | undefined,
    ): AsyncMessageContextMap<number> {
        return events.reduce<AsyncMessageContextMap<number>>((result, ev) => {
            if (
                ev.event.kind === "message" &&
                ev.event.repliesTo &&
                ev.event.repliesTo.kind === "raw_reply_context"
            ) {
                result.insert(
                    ev.event.repliesTo.sourceContext ?? {
                        chatId: { ...defaultChatId },
                        threadRootMessageIndex,
                    },
                    ev.event.repliesTo.eventIndex,
                );
            }
            return result;
        }, new AsyncMessageContextMap());
    }

    private messagesFromEventsResponse<T extends ChatEvent>(
        context: MessageContext,
        resp: EventsResponse<T>,
    ): [MessageContext, EventWrapper<Message>[]] {
        if (isSuccessfulEventsResponse(resp)) {
            return [
                context,
                resp.events.reduce((msgs, ev) => {
                    if (ev.event.kind === "message") {
                        msgs.push(ev as EventWrapper<Message>);
                    }
                    return msgs;
                }, [] as EventWrapper<Message>[]),
            ];
        } else {
            return [context, []];
        }
    }

    private async resolveMissingIndexes<T extends ChatEvent>(
        currentChatId: ChatIdentifier,
        events: EventWrapper<T>[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<AsyncMessageContextMap<EventWrapper<Message>>> {
        const contextMap = this.findMissingEventIndexesByChat(
            currentChatId,
            events,
            threadRootMessageIndex,
        );

        if (contextMap.length === 0) return Promise.resolve(new AsyncMessageContextMap());

        const mapped = await contextMap.asyncMap((ctx, idxs) => {
            const chatId = ctx.chatId;

            // Note that the latestKnownUpdate relates to the *currentChat*, not necessarily the chat for this messageContext
            // So only include it if the context matches the current chat
            // And yes - this is probably trying to tell us something
            const latestUpdate = chatIdentifiersEqual(chatId, currentChatId)
                ? latestKnownUpdate
                : undefined;

            return this._chatEventsReader
                .chatEventsByIndex(chatId, idxs, ctx.threadRootMessageIndex, latestUpdate)
                .aggregate(mergeEventStreamResponses, emptyEventsResponse())
                .toPromise()
                .then((resp) => this.messagesFromEventsResponse(ctx, resp));
        });

        return mapped;
    }

    // Extracts message previews once per text message (keyed by messageId) and builds the
    // per-chat map of message indexes to fetch, so rehydrateEvent doesn't re-parse the text.
    private findMissingMessagePreviewsByChat<T extends ChatEvent>(
        events: EventWrapper<T>[],
    ): [AsyncMessageContextMap<number>, Map<bigint, MessagePreview[]>] {
        const previews = new Map<bigint, MessagePreview[]>();
        const contextMap = events.reduce<AsyncMessageContextMap<number>>((result, ev) => {
            if (ev.event.kind === "message" && ev.event.content.kind === "text_content") {
                const extracted = extractMessagePreviews(ev.event.content.text);
                if (extracted.length > 0) {
                    previews.set(ev.event.messageId, extracted);
                }
                for (const preview of extracted) {
                    result.insert(
                        {
                            chatId: preview.chatId,
                            threadRootMessageIndex: preview.threadRootMessageIndex,
                        },
                        preview.messageIndex,
                    );
                }
            }
            return result;
        }, new AsyncMessageContextMap());
        return [contextMap, previews];
    }

    private async resolveMissingMessagePreviews<T extends ChatEvent>(
        events: EventWrapper<T>[],
    ): Promise<ResolvedMessagePreviews> {
        const [contextMap, previews] = this.findMissingMessagePreviewsByChat(events);

        if (contextMap.length === 0) return emptyResolvedMessagePreviews();

        const messages = await contextMap.asyncMap((ctx, idxs) => {
            const uniqueIdxs = [...new Set(idxs)];
            return this._chatEventsReader
                .messagesByMessageIndex(
                    ctx.chatId,
                    ctx.threadRootMessageIndex,
                    uniqueIdxs,
                    undefined,
                )
                .aggregate(mergeEventStreamResponses, emptyEventsResponse())
                .toPromise()
                .then((resp) => this.messagesFromEventsResponse(ctx, resp));
        });

        return { messages, previews };
    }

    // Rehydrates the event's content and reply context, and refers to the user by their current id
    // wherever it was from before they were migrated to a MultiUser canister. Events read from the
    // cache or a canister pass through here. Those which don't, ie. the messages returned by
    // `updateProposalTallies`, failed messages, and the content of deleted and undeleted messages,
    // are mapped where they are returned.
    private rehydrateEvent<T extends ChatEvent>(
        ev: EventWrapper<T>,
        defaultChatId: ChatIdentifier,
        missingReplies: AsyncMessageContextMap<EventWrapper<Message>>,
        missingMessagePreviews: ResolvedMessagePreviews,
        threadRootMessageIndex: number | undefined,
    ): EventWrapper<T> {
        return withLatestUserIds(
            this.rehydrateEventContent(
                ev,
                defaultChatId,
                missingReplies,
                missingMessagePreviews,
                threadRootMessageIndex,
            ),
            this._ownLatestUserIds,
        );
    }

    private rehydrateEventContent<T extends ChatEvent>(
        ev: EventWrapper<T>,
        defaultChatId: ChatIdentifier,
        missingReplies: AsyncMessageContextMap<EventWrapper<Message>>,
        missingMessagePreviews: ResolvedMessagePreviews,
        threadRootMessageIndex: number | undefined,
    ): EventWrapper<T> {
        if (ev.event.kind === "message") {
            const messagePreviews: RehydratedMessagePreview[] = [];
            const originalContent = ev.event.content;
            const rehydratedContent = this.rehydrateMessageContent(originalContent);

            const originalReplyContext = ev.event.repliesTo;
            let rehydratedReplyContext = undefined;
            if (ev.event.repliesTo && ev.event.repliesTo.kind === "raw_reply_context") {
                const messageContext = ev.event.repliesTo.sourceContext ?? {
                    chatId: { ...defaultChatId },
                    threadRootMessageIndex,
                };
                const messageEvents = missingReplies.lookup(messageContext);
                const idx = ev.event.repliesTo.eventIndex;
                const msg = messageEvents.find((me) => me.index === idx)?.event;
                if (msg) {
                    rehydratedReplyContext = {
                        kind: "rehydrated_reply_context",
                        content: structuredClone(this.rehydrateMessageContent(msg.content)),
                        senderId: msg.sender,
                        messageId: msg.messageId,
                        messageIndex: msg.messageIndex,
                        eventIndex: idx,
                        edited: msg.edited,
                        isThreadRoot: msg.thread !== undefined,
                        sourceContext: messageContext,
                        moderationFlags: msg.moderationFlags,
                    };
                } else {
                    this._logger.log(
                        "Reply context not found, this should only happen if we failed to load the reply context message",
                        {
                            chatId: { ...defaultChatId },
                            messageContext,
                            messageEvents,
                            repliesTo: ev.event.repliesTo,
                        },
                    );
                }
            }

            if (ev.event.content.kind === "text_content") {
                for (const preview of missingMessagePreviews.previews.get(ev.event.messageId) ??
                    []) {
                    const context = {
                        chatId: preview.chatId,
                        threadRootMessageIndex: preview.threadRootMessageIndex,
                    };
                    const messages = missingMessagePreviews.messages.lookup(context);
                    const msg = messages.find(
                        (me) => me.event.messageIndex === preview.messageIndex,
                    )?.event;
                    if (msg) {
                        messagePreviews.push({
                            url: preview.url,
                            chatId: preview.chatId,
                            threadRootMessageIndex: preview.threadRootMessageIndex,
                            message: {
                                ...msg,
                                content: structuredClone(this.rehydrateMessageContent(msg.content)),
                            },
                        });
                    }
                }
            }

            if (
                originalContent !== rehydratedContent ||
                rehydratedReplyContext !== undefined ||
                messagePreviews.length > 0
            ) {
                return {
                    ...ev,
                    event: {
                        ...ev.event,
                        content: rehydratedContent,
                        repliesTo: rehydratedReplyContext ?? originalReplyContext,
                        messagePreviews,
                    },
                };
            }
        }
        return ev;
    }

    private async rehydrateEventResponse<T extends ChatEvent>(
        currentChatId: ChatIdentifier,
        resp: EventsResponse<T>,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<T>> {
        if (!isSuccessfulEventsResponse(resp)) {
            return resp;
        }

        const [missing, missingPreviews] = await Promise.all([
            this.resolveMissingIndexes(
                currentChatId,
                resp.events,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            this.resolveMissingMessagePreviews(resp.events),
        ]);

        resp.events = resp.events.map((e) =>
            this.rehydrateEvent(e, currentChatId, missing, missingPreviews, threadRootMessageIndex),
        );
        return resp;
    }

    rehydrateUserSummary<T extends UserSummary>(userSummary: T): T {
        const ref = userSummary.blobReference;
        if (userSummary.kind === "bot") {
            return {
                ...userSummary,
                blobData: undefined,
                blobUrl:
                    ref?.blobId === undefined
                        ? "/assets/bot_avatar.svg"
                        : buildBlobUrl(
                              this.config.blobUrlPattern,
                              this.config.userIndexCanister,
                              ref.blobId,
                              "avatar",
                              { botId: userSummary.userId },
                          ),
            };
        }
        return userSummary.blobUrl
            ? userSummary
            : {
                  ...userSummary,
                  blobData: undefined,
                  blobUrl: buildUserAvatarUrl(
                      this.config.blobUrlPattern,
                      userSummary.userId,
                      ref?.blobId ?? undefined,
                  ),
              };
    }

    callBotCommandEndpoint(endpoint: string, token: string): Promise<BotCommandResponse> {
        return callBotCommandEndpoint(endpoint, token).then((resp) => {
            if (resp.kind === "success" && resp.message !== undefined) {
                return {
                    ...resp,
                    message: {
                        ...resp.message,
                        messageContent: this.rehydrateMessageContent(resp.message.messageContent),
                    },
                };
            }
            return resp;
        });
    }

    private rehydrateDataContent<T extends DataContent>(
        dataContent: T,
        blobType: "blobs" | "avatar" | "banner" = "blobs",
        channelId?: ChannelIdentifier,
    ): T {
        const ref = dataContent.blobReference;
        return ref !== undefined
            ? {
                  ...dataContent,
                  blobData: undefined,
                  blobUrl: buildBlobUrl(
                      this.config.blobUrlPattern,
                      ref.canisterId,
                      ref.blobId,
                      blobType,
                      { channelId: channelId?.channelId },
                  ),
              }
            : dataContent;
    }

    async rehydrateMessage(
        chatId: ChatIdentifier,
        message: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventWrapper<Message>> {
        const [missing, missingPreviews] = await Promise.all([
            this.resolveMissingIndexes(
                chatId,
                [message],
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            this.resolveMissingMessagePreviews([message]),
        ]);
        return this.rehydrateEvent(
            message,
            chatId,
            missing,
            missingPreviews,
            threadRootMessageIndex,
        );
    }

    searchUsers(searchTerm: string, maxResults = 20, pageIndex?: number): Promise<UserSummary[]> {
        if (offline()) return Promise.resolve([]);

        return this._userIndexClient
            .searchUsers(searchTerm, maxResults, pageIndex)
            .then((users) => users.map((u) => this.rehydrateUserSummary(u)));
    }

    exploreChannels(
        id: CommunityIdentifier,
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize = 10,
    ): Promise<ExploreChannelsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._communityClient
            .exploreChannels(id.communityId, searchTerm, pageIndex, pageSize)
            .then((res) => {
                if (res.kind === "success") {
                    return {
                        ...res,
                        matches: res.matches.map((match) => ({
                            ...match,
                            avatar: this.rehydrateDataContent(match.avatar, "avatar", match.id),
                        })),
                    };
                }
                return res;
            });
    }

    exploreCommunities(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize = 10,
        flags: number,
        languages: string[],
    ): Promise<ExploreCommunitiesResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._groupIndexClient
            .exploreCommunities(searchTerm, pageIndex, pageSize, flags, languages)
            .then((res) => {
                if (res.kind === "success") {
                    return {
                        ...res,
                        matches: res.matches.map((match) => ({
                            ...match,
                            avatar: this.rehydrateDataContent(match.avatar, "avatar"),
                            banner: this.rehydrateDataContent(match.banner, "banner"),
                        })),
                    };
                }
                return res;
            });
    }

    searchGroups(searchTerm: string, flags: number, maxResults = 10): Promise<GroupSearchResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._groupIndexClient.searchGroups(searchTerm, flags, maxResults).then((res) => {
            if (res.kind === "success") {
                return {
                    ...res,
                    matches: res.matches.map((match) => this.rehydrateDataContent(match, "avatar")),
                };
            }
            return res;
        });
    }

    searchGroupChat(
        chatId: MultiUserChatIdentifier,
        searchTerm: string,
        userIds: string[],
        maxResults = 10,
    ): Promise<SearchGroupChatResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.searchGroupChat(
                    chatId.groupId,
                    searchTerm,
                    userIds,
                    maxResults,
                );
            case "channel":
                return this._communityClient.searchChannel(chatId, maxResults, userIds, searchTerm);
        }
    }

    searchDirectChat(
        chatId: DirectChatIdentifier,
        searchTerm: string,
        maxResults = 10,
    ): Promise<SearchDirectChatResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.searchDirectChat(chatId, searchTerm, maxResults);
    }

    async getUser(userId: string, allowStale = false): Promise<UserSummary | undefined> {
        const response = await this.getUsers(
            {
                userGroups: [
                    {
                        users: [userId],
                        updatedSince: BigInt(0),
                    },
                ],
            },
            allowStale,
        );

        if (response.users.length == 0) {
            return undefined;
        }

        return response.users[0];
    }

    getUsers(users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        return this._userIndexClient.getUsers(users, allowStale).then((resp) => ({
            ...resp,
            users: resp.users.map((u) => this.rehydrateUserSummary(u)),
        }));
    }

    // The direct chats among those the User canister removed which were moved onto the other user's
    // new id, after they were migrated to a MultiUser canister, rather than deleted, each mapped to
    // that id (see `findMovedDirectChats`). The users are looked up by the ids the chats were under,
    // for which the UserIndex returns their latest ids. Throws if they can't be.
    #movedDirectChats(
        removed: string[],
        added: DirectChatSummary[],
        cached: DirectChatSummary[],
    ): Promise<Map<string, string>> {
        return findMovedDirectChats(removed, added, cached, (users) =>
            this._userIndexClient
                .getUsers({ userGroups: [{ users, updatedSince: BigInt(0) }] }, false)
                .then((resp) => resp.migratedUserIds ?? new Map()),
        ).catch((err) => {
            this._logger.error("Failed to look up the users of removed direct chats", err);
            throw err;
        });
    }

    private applyPinnedChannelUpdates(
        pinnedChannels: Updatable<ChannelIdentifier[]>,
        userResponse: UpdatesSuccessResponse,
    ) {
        const communitiesUpdated: Set<string> = new Set();
        const updates: ChannelIdentifier[] = [];

        userResponse.communities.added.forEach((c) => {
            if (c.pinned.length > 0) {
                communitiesUpdated.add(c.id.communityId);
                updates.push(...c.pinned);
            }
        });
        userResponse.communities.updated.forEach((c) => {
            if (c.pinned !== undefined) {
                communitiesUpdated.add(c.id.communityId);
                if (c.pinned.length > 0) {
                    updates.push(...c.pinned);
                }
            }
        });

        if (communitiesUpdated.size > 0) {
            pinnedChannels.value = pinnedChannels.value
                .filter((c) => !communitiesUpdated.has(c.communityId))
                .concat(...updates);
        }
    }

    // Fetches the updates since `current`, writes the new state to the cache and returns it
    // (undefined when nothing changed). The UI learns of the changes by pulling from the cache.
    private async _getUpdates(
        current: ChatStateFull | undefined,
        initialLoad: boolean,
    ): Promise<ChatStateFull | undefined> {
        const start = performance.now();
        let totalQueryCount = 0;

        let userCanisterLocalUserIndex: string;
        let currentDirectChats: DirectChatSummary[] = [];
        let directChatsAdded: DirectChatSummary[] = [];
        let directChatUpdates: DirectChatSummaryUpdates[] = [];
        let directChatsRemoved: string[] = [];
        let directChatsMoved = new Map<string, string>();
        let directChats: DirectChatSummary[] = [];

        let currentGroups: GroupChatSummary[] = [];
        let groupsAdded: UserCanisterGroupChatSummary[] = [];
        let groupsRemoved: string[] = [];
        let userCanisterGroupUpdates: UserCanisterGroupChatSummaryUpdates[] = [];

        let currentCommunities: CommunitySummary[] = [];
        let communitiesAdded: UserCanisterCommunitySummary[] = [];
        let communitiesRemoved: string[] = [];
        let userCanisterCommunityUpdates: UserCanisterCommunitySummaryUpdates[] = [];

        let avatarId: UpdatableOption<bigint>;
        let blockedUsers: Updatable<string[]>;
        let pinnedChats: Updatable<ChatIdentifier[]>;
        let pinnedFavouriteChats: Updatable<ChatIdentifier[]>;
        let pinnedChannels: Updatable<ChannelIdentifier[]>;
        let favouriteChats: Updatable<ChatIdentifier[]>;
        let pinNumberSettings: UpdatableOption<PinNumberSettings>;
        let achievements: Updatable<Set<string>>;
        let newAchievements: Updatable<ChitEvent[]>;
        let achievementsLastSeen: bigint;
        let chitState: Updatable<ChitState>;
        let referrals: Updatable<Referral[]>;
        let walletConfig: Updatable<WalletConfig>;
        let messageActivitySummary: Updatable<MessageActivitySummary>;
        let installedBots: Updatable<Map<string, GrantedBotPermissions>>;
        let bitcoinAddress: Updatable<string | undefined>;
        let oneSecAddress: Updatable<string | undefined>;
        let streakInsurance: UpdatableOption<StreakInsurance>;
        let premiumItems: Updatable<Set<PremiumItem>>;

        let suspensionChanged: boolean | undefined = undefined;
        let latestUserCanisterUpdates: bigint;
        let anyUpdates = false;

        const processAchievementsResponse = (achievementsResponse: ChitEvent[]) => {
            if (achievementsResponse.length > 0) {
                achievementsResponse.forEach((a) => {
                    if (a.timestamp > achievementsLastSeen) {
                        newAchievements.mutate((na) => na.push(a));
                    }
                    const name =
                        a.reason.kind === "achievement_unlocked"
                            ? a.reason.type
                            : a.reason.kind === "external_achievement_unlocked"
                              ? a.reason.name
                              : undefined;

                    if (name !== undefined) {
                        achievements.mutate((ac) => ac.add(name));
                    }
                });
            }
        };

        const previousUpdatesTimestamp = mapOptional(current?.latestUserCanisterUpdates, Number);
        // Summary updates for the groups and communities already cached, started before the User
        // canister call rather than after it: they only need what is cached, and waiting for the
        // User canister first put a whole extra round trip in front of every pass. Chats the User
        // canister reports as added are fetched once it has answered.
        let cachedSummaryUpdates:
            | Promise<WaitAllResult<GroupAndCommunitySummaryUpdatesResponseBatch>>
            | undefined = undefined;

        // `== null`: a corrupt IndexedDB has been seen returning null rather than undefined
        if (current == null) {
            totalQueryCount++;
            const userResponse = await this.userClient.getInitialState();
            anyUpdates = true;
            userCanisterLocalUserIndex = userResponse.localUserIndex;
            latestUserCanisterUpdates = userResponse.timestamp;

            directChats = directChatsAdded = userResponse.directChats.summaries;
            groupsAdded = userResponse.groupChats.summaries;
            communitiesAdded = userResponse.communities.summaries;

            avatarId = new UpdatableOption(userResponse.avatarId, true);
            blockedUsers = new Updatable(userResponse.blockedUsers, true);
            pinnedChats = new Updatable(userResponse.pinnedChats, true);
            pinnedFavouriteChats = new Updatable(userResponse.favouriteChats.pinned, true);
            pinnedChannels = new Updatable(
                userResponse.communities.summaries.flatMap((c) => c.pinned),
                true,
            );
            favouriteChats = new Updatable(userResponse.favouriteChats.chats, true);
            pinNumberSettings = new UpdatableOption(userResponse.pinNumberSettings, true);
            achievementsLastSeen = userResponse.achievementsLastSeen;
            achievements = new Updatable(new Set(), true);
            newAchievements = new Updatable([], true);
            processAchievementsResponse(userResponse.achievements);
            chitState = new Updatable(
                {
                    streakEnds: userResponse.streakEnds,
                    streak: userResponse.streak,
                    maxStreak: userResponse.maxStreak,
                    chitBalance: userResponse.chitBalance,
                    nextDailyChitClaim: userResponse.nextDailyClaim,
                    totalChitEarned: userResponse.totalChitEarned,
                },
                true,
            );
            referrals = new Updatable(userResponse.referrals, true);
            walletConfig = new Updatable(userResponse.walletConfig, true);
            messageActivitySummary = new Updatable(userResponse.messageActivitySummary, true);
            installedBots = new Updatable(userResponse.bots, true);
            bitcoinAddress = new Updatable(userResponse.bitcoinAddress, true);
            oneSecAddress = new Updatable(userResponse.oneSecAddress, true);
            streakInsurance = new UpdatableOption(userResponse.streakInsurance, true);
            premiumItems = new Updatable(userResponse.premiumItems, true);
        } else {
            userCanisterLocalUserIndex = current.userCanisterLocalUserIndex;
            latestUserCanisterUpdates = current.latestUserCanisterUpdates;

            currentDirectChats = current.directChats;
            currentGroups = current.groupChats;
            currentCommunities = current.communities;

            avatarId = new UpdatableOption(current.avatarId);
            blockedUsers = new Updatable(current.blockedUsers);
            pinnedChats = new Updatable(current.pinnedChats);
            pinnedFavouriteChats = new Updatable(current.pinnedFavouriteChats);
            pinnedChannels = new Updatable(current.pinnedChannels);
            favouriteChats = new Updatable(current.favouriteChats);
            pinNumberSettings = new UpdatableOption(current.pinNumberSettings);
            achievements = new Updatable(current.achievements);
            newAchievements = new Updatable([]);
            achievementsLastSeen = current.achievementsLastSeen;
            chitState = new Updatable(current.chitState);
            referrals = new Updatable(current.referrals);
            walletConfig = new Updatable(current.walletConfig);
            messageActivitySummary = new Updatable(current.messageActivitySummary);
            installedBots = new Updatable(current.installedBots);
            bitcoinAddress = new Updatable(current.bitcoinAddress);
            oneSecAddress = new Updatable(current.oneSecAddress);
            streakInsurance = new UpdatableOption(current.streakInsurance);
            premiumItems = new Updatable(current.premiumItems);

            // A chat the User canister goes on to report as removed is queried for nothing, as it
            // was before; the removal filter below drops whatever comes back for it
            cachedSummaryUpdates = this.#getSummaryUpdatesFromLocalUserIndexes(
                summaryUpdatesArgsByLocalUserIndex(currentGroups, currentCommunities),
                previousUpdatesTimestamp,
            );
            // Nothing awaits this until the User canister has answered, so a rejection meanwhile
            // would be reported as unhandled, and would stay unhandled if this pass threw before
            // reaching the await. The await below still sees the rejection.
            cachedSummaryUpdates.catch(() => undefined);

            try {
                totalQueryCount++;
                const userResponse = await this.userClient.getUpdates(
                    current.latestUserCanisterUpdates,
                );
                // Found before anything is taken from the answer, so that if the users can't be
                // looked up, the answer is dropped, as if the User canister hadn't given one, and
                // is fetched again on the next pass, rather than a move being taken for a deletion
                const moved =
                    userResponse.kind === "success"
                        ? await this.#movedDirectChats(
                              userResponse.directChats.removed,
                              userResponse.directChats.added,
                              currentDirectChats,
                          )
                        : new Map<string, string>();

                if (userResponse.kind === "success") {
                    anyUpdates = true;
                    latestUserCanisterUpdates = userResponse.timestamp;

                    directChatsAdded = userResponse.directChats.added;
                    directChatUpdates = userResponse.directChats.updated;
                    directChatsRemoved = userResponse.directChats.removed;
                    directChatsMoved = moved;
                    // A moved chat's events move with it when the cache is written
                    directChatsRemoved.forEach((id) => {
                        if (!directChatsMoved.has(id)) {
                            this._chatsDb.deleteEventsForChatOrCommunity(id);
                        }
                    });

                    groupsAdded = userResponse.groupChats.added;
                    groupsRemoved = userResponse.groupChats.removed;
                    groupsRemoved.forEach((id) => {
                        this._chatsDb.deleteEventsForChatOrCommunity(id);
                    });
                    userCanisterGroupUpdates = userResponse.groupChats.updated;

                    communitiesAdded = userResponse.communities.added;
                    communitiesRemoved = userResponse.communities.removed;
                    communitiesRemoved.forEach((id) => {
                        this._chatsDb.deleteEventsForChatOrCommunity(id);
                    });
                    userCanisterCommunityUpdates = userResponse.communities.updated;

                    avatarId.applyOptionUpdate(userResponse.avatarId);
                    blockedUsers.updateIfNotUndefined(userResponse.blockedUsers);
                    pinnedChats.updateIfNotUndefined(userResponse.pinnedChats);
                    pinnedFavouriteChats.updateIfNotUndefined(userResponse.favouriteChats.pinned);
                    this.applyPinnedChannelUpdates(pinnedChannels, userResponse);
                    favouriteChats.updateIfNotUndefined(userResponse.favouriteChats.chats);
                    suspensionChanged = userResponse.suspended;
                    pinNumberSettings.applyOptionUpdate(userResponse.pinNumberSettings);
                    achievementsLastSeen =
                        userResponse.achievementsLastSeen ?? achievementsLastSeen;
                    processAchievementsResponse(userResponse.achievements);
                    if (
                        userResponse.totalChitEarned !== chitState.value.totalChitEarned ||
                        // A debit (daily puzzle entry or hint) moves the balance without
                        // touching the total earned, so the balance must be compared too
                        userResponse.chitBalance !== chitState.value.chitBalance ||
                        userResponse.streakEnds !== chitState.value.streakEnds
                    ) {
                        chitState.value = {
                            streakEnds: userResponse.streakEnds,
                            streak: userResponse.streak,
                            maxStreak: userResponse.maxStreak,
                            chitBalance: userResponse.chitBalance,
                            nextDailyChitClaim: userResponse.nextDailyClaim,
                            totalChitEarned: userResponse.totalChitEarned,
                        };
                    }
                    if (userResponse.referrals.length > 0) {
                        referrals.value = referrals.value
                            .filter(
                                (prev) =>
                                    !userResponse.referrals.find(
                                        (latest) => latest.userId === prev.userId,
                                    ),
                            )
                            .concat(userResponse.referrals);
                    }
                    if (
                        userResponse.botsAddedOrUpdated.length > 0 ||
                        userResponse.botsRemoved.length > 0
                    ) {
                        installedBots.mutate((map) => {
                            userResponse.botsAddedOrUpdated.forEach((b) =>
                                map.set(b.id, b.permissions),
                            );
                            userResponse.botsRemoved.forEach((b) => {
                                map.delete(b);
                            });
                        });
                    }
                    walletConfig.updateIfNotUndefined(userResponse.walletConfig);
                    messageActivitySummary.updateIfNotUndefined(
                        userResponse.messageActivitySummary,
                    );
                    bitcoinAddress.updateIfNotUndefined(userResponse.bitcoinAddress);
                    oneSecAddress.updateIfNotUndefined(userResponse.oneSecAddress);
                    streakInsurance.applyOptionUpdate(userResponse.streakInsurance);
                    premiumItems.updateIfNotUndefined(userResponse.premiumItems);
                }
            } catch (error) {
                console.error("Failed to get updates from User canister", error);
            }

            directChats = directChatsAdded.concat(
                mergeDirectChatUpdates(currentDirectChats, directChatUpdates, directChatsRemoved),
            );
        }

        const addedSummaryUpdates =
            groupsAdded.length > 0 || communitiesAdded.length > 0
                ? this.#getSummaryUpdatesFromLocalUserIndexes(
                      summaryUpdatesArgsByLocalUserIndex(groupsAdded, communitiesAdded),
                      previousUpdatesTimestamp,
                  )
                : undefined;

        if (initialLoad) {
            // Set up the cache primer on the first iteration but don't process anything until the
            // next iteration. This is because we want OC's initialization to be as fast as
            // possible, so don't want resources going to the CachePrimer until it is complete.
            this.#initializeCachePrimer(userCanisterLocalUserIndex);
        }

        const summaryUpdatesResponses = mergeWaitAllResults(
            await Promise.all([cachedSummaryUpdates, addedSummaryUpdates]),
        );

        totalQueryCount += summaryUpdatesResponses.success.length;
        totalQueryCount += summaryUpdatesResponses.errors.length;

        for (const error of summaryUpdatesResponses.errors) {
            this._logger.error("Summary updates error", error);
        }

        const groupCanisterGroupSummaries: GroupCanisterGroupChatSummary[] = [];
        const communityCanisterCommunitySummaries: CommunitySummary[] = [];
        const groupUpdates: GroupCanisterGroupChatSummaryUpdates[] = [];
        const communityUpdates: CommunityCanisterCommunitySummaryUpdates[] = [];
        const notFoundTimestamps = new Map<string, bigint>();

        for (const response of summaryUpdatesResponses.success) {
            for (const result of response.updates) {
                switch (result.kind) {
                    case "group": {
                        groupCanisterGroupSummaries.push(result.value);
                        break;
                    }
                    case "group_updates": {
                        groupUpdates.push(result.value);
                        break;
                    }
                    case "community": {
                        communityCanisterCommunitySummaries.push(result.value);
                        break;
                    }
                    case "community_updates": {
                        communityUpdates.push(result.value);
                        break;
                    }
                }
            }
            for (const canisterId of response.notFound) {
                notFoundTimestamps.set(canisterId, response.timestamp);
            }
        }

        if (groupUpdates.length > 0 || communityUpdates.length > 0) {
            anyUpdates = true;
        }

        const cachePrimer = this._cachePrimer;
        if (!anyUpdates) {
            if (!initialLoad && cachePrimer?.isFirstIteration) {
                cachePrimer.processUpdates(currentDirectChats, currentGroups, currentCommunities);
            }

            const duration = performance.now() - start;
            console.debug(
                `GetUpdates completed with no updates in ${duration}ms. Number of queries: ${totalQueryCount}`,
            );
            return undefined;
        }

        const isGroupCommunityDeleted = (canisterId: string, joined: bigint, removed: string[]) => {
            if (removed.includes(canisterId)) return true;
            // This is needed in case we hit a replica which is lagging and
            // isn't aware the group/community has been created yet
            const notFoundTimestamp = notFoundTimestamps.get(canisterId);
            return notFoundTimestamp !== undefined && notFoundTimestamp > joined;
        };

        const groupChats = mergeGroupChats(groupsAdded, groupCanisterGroupSummaries)
            .concat(mergeGroupChatUpdates(currentGroups, userCanisterGroupUpdates, groupUpdates))
            .filter(
                (g) => !isGroupCommunityDeleted(g.id.groupId, g.membership.joined, groupsRemoved),
            );

        const communities = mergeCommunities(communitiesAdded, communityCanisterCommunitySummaries)
            .concat(
                mergeCommunityUpdates(
                    currentCommunities,
                    userCanisterCommunityUpdates,
                    communityUpdates,
                ),
            )
            .filter(
                (c) =>
                    !isGroupCommunityDeleted(
                        c.id.communityId,
                        c.membership.joined,
                        communitiesRemoved,
                    ),
            );

        // The chats cache only rewrites the chats it is told were touched, so the chats it
        // changes in place are counted as touched below. expiresAt is an epoch-millis
        // timestamp, so compare against wall-clock time rather than `start`, which is a
        // performance.now() reading used only for timing
        const now = Date.now();
        const expiredDirectChats = this.removeExpiredLatestMessages(directChats, now);
        const expiredGroupChats = this.removeExpiredLatestMessages(groupChats, now);
        const expiredCommunities = communities.filter(
            (c) => this.removeExpiredLatestMessages(c.channels, now).length > 0,
        );

        const state = {
            userCanisterLocalUserIndex,
            latestUserCanisterUpdates,
            directChats,
            groupChats,
            communities,
            avatarId: avatarId.value,
            blockedUsers: blockedUsers.value,
            pinnedChats: pinnedChats.value,
            pinnedFavouriteChats: pinnedFavouriteChats.value,
            pinnedChannels: pinnedChannels.value,
            favouriteChats: favouriteChats.value,
            pinNumberSettings: pinNumberSettings.value,
            achievementsLastSeen,
            achievements: achievements.value,
            chitState: chitState.value,
            referrals: referrals.value,
            walletConfig: walletConfig.value,
            messageActivitySummary: messageActivitySummary.value,
            installedBots: installedBots.value,
            bitcoinAddress: bitcoinAddress.value,
            oneSecAddress: oneSecAddress.value,
            streakInsurance: streakInsurance.value,
            premiumItems: premiumItems.value,
        };

        const updatedEvents = getUpdatedEvents(directChatUpdates, groupUpdates, communityUpdates);

        const directChatsAddedUpdatedIds = new Set([
            ...directChatsAdded.map((c) => c.id.userId),
            ...directChatUpdates.map((c) => c.id.userId),
            ...expiredDirectChats.map((c) => c.id.userId),
        ]);
        const groupsAddedUpdatedIds = new Set([
            ...groupsAdded.map((g) => g.id.groupId),
            ...groupUpdates.map((g) => g.id.groupId),
            ...userCanisterGroupUpdates.map((g) => g.id.groupId),
            ...expiredGroupChats.map((g) => g.id.groupId),
        ]);
        const communitiesAddedUpdatedIds = new Set([
            ...communitiesAdded.map((c) => c.id.communityId),
            ...communityUpdates.map((c) => c.id.communityId),
            ...userCanisterCommunityUpdates.map((c) => c.id.communityId),
            ...expiredCommunities.map((c) => c.id.communityId),
        ]);

        if (this.userClient.userId !== ANON_USER_ID) {
            try {
                await this._chatsDb.setCachedChats(state, {
                    directChats: directChatsAddedUpdatedIds,
                    movedDirectChats: directChatsMoved,
                    groupChats: groupsAddedUpdatedIds,
                    communities: communitiesAddedUpdatedIds,
                    fields: touchedFields({
                        avatarId,
                        blockedUsers,
                        pinnedChats,
                        pinnedFavouriteChats,
                        pinnedChannels,
                        favouriteChats,
                        pinNumberSettings,
                        achievements,
                        chitState,
                        referrals,
                        walletConfig,
                        messageActivitySummary,
                        installedBots,
                        bitcoinAddress,
                        oneSecAddress,
                        streakInsurance,
                        premiumItems,
                    }),
                    updatedEvents,
                    chitEvents: newAchievements.value,
                    suspensionChanged: suspensionChanged !== undefined,
                });
            } catch (err) {
                // The cache still holds the previous state, so the next pass fetches these updates
                // again and gets another go at writing them
                this._logger.error("Failed to write the chats cache", err);
            }
        }

        if (!initialLoad && cachePrimer !== undefined) {
            if (cachePrimer.isFirstIteration) {
                cachePrimer.processUpdates(directChats, groupChats, communities, updatedEvents);
            } else {
                cachePrimer.processUpdates(
                    directChats.filter((c) => directChatsAddedUpdatedIds.has(c.id.userId)),
                    groupChats.filter((g) => groupsAddedUpdatedIds.has(g.id.groupId)),
                    communities.filter((c) => communitiesAddedUpdatedIds.has(c.id.communityId)),
                    updatedEvents,
                    directChatsRemoved,
                    groupsRemoved,
                    communitiesRemoved,
                );
            }
        }

        const duration = performance.now() - start;
        console.debug(
            `GetUpdates completed in ${duration}ms. Number of queries: ${totalQueryCount}`,
        );

        return state;
    }

    // Called when this agent instance is replaced or discarded so that background timers do not keep it alive
    dispose() {
        this._cachePrimer?.stop();
    }

    #initializeCachePrimer(userCanisterLocalUserIndex: string): Promise<CachePrimer> {
        return this._chatsDb.getCachePrimerEventIndexes().then((idx) => {
            return (this._cachePrimer = new CachePrimer(
                userCanisterLocalUserIndex,
                idx,
                (localUserIndex, requests) =>
                    this._localUserIndexClient.chatEvents(localUserIndex, requests, true),
                (localUserIndex, proposalChatIds) =>
                    this.#updateCachedProposalTallies(localUserIndex, proposalChatIds),
                (userIds) => this._userIndexClient.populateUserCache(userIds),
                (indexes) => this._chatsDb.setCachePrimerEventIndexes(indexes),
            ));
        });
    }

    async #getSummaryUpdatesFromLocalUserIndexes(
        requestsByLocalUserIndex: Map<string, GroupAndCommunitySummaryUpdatesArgs[]>,
        previousUpdatesTimestamp: number | undefined,
        maxC2cCalls: number = 50,
    ): Promise<WaitAllResult<GroupAndCommunitySummaryUpdatesResponseBatch>> {
        const durationSincePreviousUpdates = Date.now() - (previousUpdatesTimestamp ?? 0);

        // The shorter the duration since the previous updates were fetched, the larger we can make the batch size,
        // since a smaller portion of canisters within the batch will have had any updates, so fewer c2c calls will be
        // required.
        const batchSize =
            previousUpdatesTimestamp === undefined
                ? maxC2cCalls
                : durationSincePreviousUpdates < 10 * ONE_MINUTE_MILLIS
                  ? maxC2cCalls * 4
                  : maxC2cCalls * 20;

        const promises: Promise<WaitAllResult<GroupAndCommunitySummaryUpdatesResponseBatch>>[] = [];
        for (const [localUserIndex, requests] of requestsByLocalUserIndex) {
            promises.push(
                this.#getSummaryUpdatesFromLocalUserIndex(
                    localUserIndex,
                    requests,
                    batchSize,
                    maxC2cCalls,
                ),
            );
        }

        return mergeWaitAllResults(await Promise.all(promises));
    }

    async #getSummaryUpdatesFromLocalUserIndex(
        localUserIndex: string,
        requests: GroupAndCommunitySummaryUpdatesArgs[],
        batchSize: number,
        maxC2cCalls: number,
    ): Promise<WaitAllResult<GroupAndCommunitySummaryUpdatesResponseBatch>> {
        const promises = chunk(requests, batchSize).map((batch) =>
            this._localUserIndexClient.groupAndCommunitySummaryUpdates(
                localUserIndex,
                batch,
                maxC2cCalls,
            ),
        );
        const responses = await waitAll(promises);

        const { success, errors } = responses;
        const excessUpdates = new Set<string>();

        for (const response of responses.success) {
            response.excessUpdates.forEach((c) => excessUpdates.add(c));
        }

        if (excessUpdates.size > 0) {
            const filteredRequests = requests.filter((r) => excessUpdates.has(r.canisterId));
            const excessPromises = chunk(filteredRequests, maxC2cCalls).map((batch) =>
                this._localUserIndexClient.groupAndCommunitySummaryUpdates(
                    localUserIndex,
                    batch,
                    maxC2cCalls,
                ),
            );
            const excessResponses = await waitAll(excessPromises);
            success.push(...excessResponses.success);
            errors.push(...excessResponses.errors);
        }

        return { success, errors };
    }

    getUpdates(initialLoad: boolean): Stream<SyncSinceResponse | undefined> {
        return new Stream(async (resolve, reject) => {
            const userId = this.userClient.userId;

            if (userId === ANON_USER_ID) {
                // The anonymous user's state never reaches the cache (the cache may belong to a
                // signed-in identity), so it never announces a head and can never be pulled.
                // Every pass therefore resolves the whole state it just fetched: that snapshot is
                // the anonymous session's only channel, so it cannot be limited to the first load.
                try {
                    const state = await this._getUpdates(undefined, initialLoad);
                    resolve(
                        state === undefined ? undefined : this.#snapshot(userId, 0, state),
                        true,
                    );
                } catch (err) {
                    reject(err);
                }
                return;
            }

            // Queued behind any other pass or single-chat refresh: each reads the cache, fetches
            // and writes the result back, so one running across another would undo its write
            await this.#cacheWrites.run(async () => {
                // The head is read before the rows so the snapshot's version never overstates it
                const head = await this.#syncHeadOrZero();
                const cachedState = await this._chatsDb.getCachedChats();
                const isOffline = offline();
                let snapshotSent = false;
                if (cachedState && initialLoad) {
                    resolve(this.#snapshot(userId, head, cachedState), isOffline);
                    snapshotSent = true;
                }
                if (!isOffline) {
                    let error: unknown = undefined;
                    let passState: ChatStateFull | undefined = undefined;
                    try {
                        passState = await this._getUpdates(cachedState, initialLoad);
                    } catch (err) {
                        error = err;
                    }
                    // Announced after failed passes too: the head says nothing about reachability
                    await this.#announceSyncHead();
                    if (error !== undefined) {
                        reject(error);
                    } else if (initialLoad && !snapshotSent) {
                        resolve(await this.#coldSnapshot(userId, head, passState), true);
                    } else {
                        resolve(undefined, true);
                    }
                }
            });
        });
    }

    /**
     * Brings one cached group, or the community holding a channel, up to date with a single
     * summary-updates query, and writes just that chat back to the cache. Much cheaper than a full
     * updates pass, which also asks the User canister and every other group and community.
     *
     * Resolves false when this can't be done on its own and a full pass is needed instead: the
     * chat isn't cached, the cache is empty, or the answer is one only a full pass handles (the
     * canister not found, an error, a full summary). Never rejects.
     *
     * Refreshes of the same chat that are waiting their turn share one query.
     */
    refreshChat(chatId: GroupChatIdentifier | ChannelIdentifier): Promise<boolean> {
        if (this.userClient.userId === ANON_USER_ID) return Promise.resolve(false);
        // Canister ids, so a group's and a community's never collide
        const key = chatId.kind === "group_chat" ? chatId.groupId : chatId.communityId;
        const queued = this.#queuedRefreshes.get(key);
        if (queued !== undefined) return queued;
        const refresh = this.#cacheWrites.run(() => {
            // From here on a new request must queue again: this one may already have read
            this.#queuedRefreshes.delete(key);
            return this.#refreshChat(chatId);
        });
        this.#queuedRefreshes.set(key, refresh);
        return refresh;
    }

    async #refreshChat(chatId: GroupChatIdentifier | ChannelIdentifier): Promise<boolean> {
        try {
            const state = await this._chatsDb.getCachedChats();
            // `== null`: a corrupt IndexedDB has been seen returning null rather than undefined
            if (state == null) return false;
            const target = refreshTarget(state, chatId);
            if (target === undefined) return false;

            const batch = await this._localUserIndexClient.groupAndCommunitySummaryUpdates(
                target.chat.localUserIndex,
                [refreshArgs(target)],
                1,
            );
            const result = applyRefresh(state, target, batch);
            if (result.kind === "needs_full_pass") return false;
            if (result.kind === "unchanged") return true;

            const version = await this._chatsDb.setCachedChats(result.state, result.touched);
            await this.#announceSyncHead(version);

            const cachePrimer = this._cachePrimer;
            if (cachePrimer !== undefined && !cachePrimer.isFirstIteration) {
                cachePrimer.processUpdates(
                    [],
                    result.chat.kind === "group" ? [result.chat.chat] : [],
                    result.chat.kind === "community" ? [result.chat.chat] : [],
                    result.touched.updatedEvents,
                );
            }
            return true;
        } catch (err) {
            this._logger.error("Failed to refresh a single chat", err);
            return false;
        }
    }

    // Never throws, for the reason `getCachedChats` never does: this runs inside a `Stream`
    // initialiser, where a rejection reaches neither onResult nor onError and the load would hang.
    // Zero is the safe answer for a head that cannot be read. A snapshot seeded at zero leaves the
    // cursor behind everything, so the first pull carries the lot again - a duplicate, which the
    // fold absorbs, where too high a version would be a hole.
    async #syncHeadOrZero(): Promise<number> {
        try {
            return await this._chatsDb.getSyncHead();
        } catch (err) {
            this._logger.error("Failed to read the sync head, seeding from zero", err);
            return 0;
        }
    }

    #snapshot(userId: string, version: number, state: ChatStateFull): SyncSinceResponse {
        return { userId, version, updates: this.#hydrateUpdates(snapshotOf(state)) };
    }

    /**
     * The boot snapshot for a load that found nothing cached: whatever the pass just wrote, read
     * back as a pull since `since` (the head read before the pass started).
     *
     * A pull rather than `snapshotOf` because the pass also stamps things that are not part of the
     * state - the chit events behind the achievement toasts, and a suspension change. `snapshotOf`
     * reports none of those, and they are stamped at exactly the version the snapshot seeds the
     * cursor with, so no later pull would carry them either and they would be lost.
     */
    async #coldSnapshot(
        userId: string,
        since: number,
        passState: ChatStateFull | undefined,
    ): Promise<SyncSinceResponse | undefined> {
        try {
            const { head, chats, stamps } = await this._chatsDb.getChatsForSync(since);
            if (chats !== undefined) {
                return {
                    userId,
                    version: head,
                    updates: this.#hydrateUpdates(
                        updatesSince(chats, stamps ?? emptySyncStamps(), since),
                    ),
                };
            }
        } catch (err) {
            this._logger.error("Failed to read the chats cache back after a cold load", err);
        }
        // Nothing to read back, or the read failed, means the cache write failed (`_getUpdates`
        // logs and continues) or the cache is unreadable. Fall back to the state the pass fetched
        // so the app still boots - without this the UI never marks the chats initialised and
        // sits on the loading screen for as long as the cache stays unusable. Version 0 so the
        // first head announcement after a successful write pulls everything.
        return passState === undefined ? undefined : this.#snapshot(userId, 0, passState);
    }

    #hydrateUpdates(updates: UpdatesResult): UpdatesResult {
        return {
            ...updates,
            directChatsAddedUpdated: this.hydrateChatSummaries(updates.directChatsAddedUpdated),
            groupsAddedUpdated: this.hydrateChatSummaries(updates.groupsAddedUpdated),
            communitiesAddedUpdated: updates.communitiesAddedUpdated.map((c) =>
                this.hydrateCommunity(c),
            ),
        };
    }

    /**
     * Everything stamped in the cache after `since`, with the version it was read at. Answers
     * come from the cache alone: a `sync_head` says only that there may be something past the
     * UI's cursor.
     */
    async syncSince(since: number): Promise<SyncSinceResponse> {
        const userId = this.userClient.userId;
        if (userId === ANON_USER_ID) {
            return { userId, version: 0, updates: emptyUpdatesResult() };
        }
        const { head, chats, stamps } = await this._chatsDb.getChatsForSync(since);
        if (chats === undefined) {
            // Nothing to answer from, which is not the same as nothing having changed: a cache
            // found unusable has its globals cleared with its rows left in place, so that the
            // full load which follows can tombstone what has gone. Answering at `head` would carry the
            // UI's cursor past everything stamped since `since` with none of it delivered. The
            // cursor stays where it is instead, and the write that refills the cache announces
            // a head the UI then pulls to from here.
            return { userId, version: Math.min(since, head), updates: emptyUpdatesResult() };
        }
        const updates = updatesSince(chats, stamps ?? emptySyncStamps(), since);
        return { userId, version: head, updates: this.#hydrateUpdates(updates) };
    }

    // Tells the UI where the cache's version counter is so it can pull what it has not seen.
    // Called after every updates pass and by any request that moved the head.
    async #announceSyncHead(version?: number): Promise<void> {
        try {
            const head = version ?? (await this._chatsDb.getSyncHead());
            this.dispatchEvent(new SyncHeadMoved(this.userClient.userId, head));
        } catch (err) {
            console.warn("Unable to announce the sync head", err);
        }
    }

    // Returns the chats it changed
    private removeExpiredLatestMessages<
        T extends { latestMessage?: EventWrapper<Message>; latestMessageIndex: number | undefined },
    >(chats: T[], now: number): T[] {
        const changed: T[] = [];
        for (const chat of chats) {
            if (
                chat.latestMessage !== undefined &&
                (chat.latestMessage.event.messageIndex !== chat.latestMessageIndex ||
                    isExpired(chat.latestMessage, now))
            ) {
                chat.latestMessage = undefined;
                changed.push(chat);
            }
        }
        return changed;
    }

    async getCommunitySummary(communityId: string): Promise<CommunitySummaryResponse> {
        const resp = await this._communityClient.summary(communityId);
        if (isSuccessfulCommunitySummaryResponse(resp)) {
            return this.hydrateCommunity(resp);
        }
        return resp;
    }

    hydrateCommunity(community: CommunitySummary): CommunitySummary {
        return {
            ...community,
            channels: community.channels.map((c) => this.hydrateChatSummary(c)),
            avatar: {
                ...this.rehydrateDataContent(community.avatar, "avatar"),
            },
            banner: {
                ...this.rehydrateDataContent(community.banner, "banner"),
            },
        };
    }

    hydrateChatSummaries<T extends ChatSummary>(chats: T[]): T[] {
        return chats.map((c) => this.hydrateChatSummary(c));
    }

    hydrateChatSummary<T extends ChatSummary>(chat: T): T {
        // The latest message may be from before the user was migrated to a MultiUser canister
        const latestMessage = withLatestUserIds(chat.latestMessage, this._ownLatestUserIds);
        if (latestMessage !== chat.latestMessage) {
            chat = { ...chat, latestMessage };
        }
        switch (chat.kind) {
            case "direct_chat":
                return chat;
            case "group_chat":
                return this.rehydrateDataContent(chat, "avatar") as T;
            case "channel":
                return this.rehydrateDataContent(chat, "avatar", chat.id) as T;
        }
    }

    getCurrentUser(): Stream<CurrentUserResponse> {
        return this._userIndexClient.getCurrentUser().map((user) => {
            // Taken from each result, the cached user then the live one. The client creates the user
            // client from the first, and restarts the session if the live one's id differs.
            if (user.kind === "created_user") {
                this._ownUserIds = {
                    userId: user.userId,
                    previousUserIds: user.previousUserIds ?? [],
                };
                this.updateOwnLatestUserIds();
            }
            return user;
        });
    }

    acceptTerms(version: number): Promise<boolean> {
        return this._userIndexClient.acceptTerms(version);
    }

    proposeSetVaultLegalHold(
        reportIndex: bigint,
        legalHold: boolean,
        reference: string,
    ): Promise<ProposedProtectedAction | undefined> {
        if (offline()) return Promise.resolve(undefined);

        return this._userIndexClient.proposeSetVaultLegalHold(reportIndex, legalHold, reference);
    }

    proposeSetVaultReviewers(userIds: string[]): Promise<ProposedProtectedAction | undefined> {
        if (offline()) return Promise.resolve(undefined);

        return this._userIndexClient.proposeSetVaultReviewers(userIds);
    }

    proposeSetMediaScanConfig(
        enabled: boolean,
        scanners: string[],
    ): Promise<ProposedProtectedAction | undefined> {
        if (offline()) return Promise.resolve(undefined);

        return this._userIndexClient.proposeSetMediaScanConfig(enabled, scanners);
    }

    proposeSetAuthorityReporter(
        principal: string | undefined,
    ): Promise<ProposedProtectedAction | undefined> {
        return this._userIndexClient.proposeSetAuthorityReporter(principal);
    }

    confirmProtectedAction(actionId: bigint): Promise<Success | OCError> {
        if (offline()) return Promise.resolve({ kind: "error", code: -1, message: undefined });

        return this._userIndexClient.confirmProtectedAction(actionId);
    }

    cancelProtectedAction(actionId: bigint): Promise<Success | OCError> {
        if (offline()) return Promise.resolve({ kind: "error", code: -1, message: undefined });

        return this._userIndexClient.cancelProtectedAction(actionId);
    }

    protectedActions(): Promise<string> {
        return this._userIndexClient.protectedActions();
    }

    setVaultLegalHold(
        reportIndex: bigint,
        legalHold: boolean,
        reference: string,
    ): Promise<boolean> {
        return this._userIndexClient.setVaultLegalHold(reportIndex, legalHold, reference);
    }

    proposeDestroyVaultEvidence(
        reportIndex: bigint,
        leRequestRef: string,
    ): Promise<ProposedProtectedAction | undefined> {
        if (offline()) return Promise.resolve(undefined);

        return this._userIndexClient.proposeDestroyVaultEvidence(reportIndex, leRequestRef);
    }

    setModerationReferralConfig(
        config: { categories: { category: number; scoreThreshold: number }[] } | undefined,
    ): Promise<boolean> {
        return this._userIndexClient.setModerationReferralConfig(config);
    }

    proposeSetOpenAIApiKey(
        apiKey: string | undefined,
    ): Promise<ProposedProtectedAction | undefined> {
        if (offline()) return Promise.resolve(undefined);

        return this._userIndexClient.proposeSetOpenAIApiKey(apiKey);
    }

    proposeSetInternalModerationChannel(
        channel: { communityId: string; channelId: number } | undefined,
    ): Promise<ProposedProtectedAction | undefined> {
        if (offline()) return Promise.resolve(undefined);

        return this._userIndexClient.proposeSetInternalModerationChannel(channel);
    }

    resolveModerationReport(
        reportIndex: bigint,
        verdict: ModerationVerdict,
        urgent: boolean | undefined,
    ): Promise<Success | OCError> {
        if (offline()) return Promise.resolve({ kind: "error", code: -1, message: undefined });

        return this._userIndexClient.resolveModerationReport(reportIndex, verdict, urgent);
    }

    contestModerationSanction(): Promise<boolean> {
        if (offline()) return Promise.resolve(false);

        return this._userIndexClient.contestModerationSanction();
    }

    vaultBuckets(): Promise<string[]> {
        return this._dataClient.vaultBuckets();
    }

    vaultLog(
        bucketCanisterId: string,
        start: bigint,
        max: number,
        fileId: bigint | undefined,
    ): Promise<VaultLogResponse> {
        let bucketClient = this._storageBucketClients.get(bucketCanisterId);
        if (bucketClient === undefined) {
            bucketClient = new StorageBucketClient(this.identity, this._agent, bucketCanisterId);
            this._storageBucketClients.set(bucketCanisterId, bucketClient);
        }
        return bucketClient.vaultLog(start, max, fileId);
    }

    moderationConfig(): Promise<ModerationConfig | undefined> {
        return this._userIndexClient.moderationConfig();
    }

    authorityReports(): Promise<string | undefined> {
        return this._userIndexClient.authorityReports();
    }

    recordAuthorityReportFiled(
        reportIndex: bigint,
        portalReference: string,
        urgent: boolean,
        unverified: boolean,
    ): Promise<boolean> {
        return this._userIndexClient.recordAuthorityReportFiled(
            reportIndex,
            portalReference,
            urgent,
            unverified,
        );
    }

    clearAuthorityReportAttempt(reportIndex: bigint): Promise<boolean> {
        return this._userIndexClient.clearAuthorityReportAttempt(reportIndex);
    }

    authorityReportToken(
        reportIndex: bigint,
        priority: NcaPriority,
        reporter: NcaReporterContact,
        oohCallAcknowledged: boolean,
    ): Promise<AuthorityReportTokenResponse> {
        return this._userIndexClient.authorityReportToken(
            reportIndex,
            priority,
            reporter,
            oohCallAcknowledged,
        );
    }

    vaultFileChunk(
        bucketCanisterId: string,
        fileId: bigint,
        chunkIndex: number,
    ): Promise<VaultFileChunkResponse> {
        let bucketClient = this._storageBucketClients.get(bucketCanisterId);
        if (bucketClient === undefined) {
            bucketClient = new StorageBucketClient(this.identity, this._agent, bucketCanisterId);
            this._storageBucketClients.set(bucketCanisterId, bucketClient);
        }
        return bucketClient.vaultFileChunk(fileId, chunkIndex);
    }

    vaultFileInfo(bucketCanisterId: string, fileId: bigint): Promise<VaultFileInfoResponse> {
        let bucketClient = this._storageBucketClients.get(bucketCanisterId);
        if (bucketClient === undefined) {
            bucketClient = new StorageBucketClient(this.identity, this._agent, bucketCanisterId);
            this._storageBucketClients.set(bucketCanisterId, bucketClient);
        }
        return bucketClient.vaultFileInfo(fileId);
    }

    setModerationFlags(flags: number): Promise<boolean> {
        if (offline()) return Promise.resolve(false);

        return this._userIndexClient.setModerationFlags(flags);
    }

    checkUsername(username: string, isBot: boolean): Promise<CheckUsernameResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.checkUsername(username, isBot);
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.setUsername(userId, username);
    }

    setDisplayName(
        userId: string,
        displayName: string | undefined,
    ): Promise<SetDisplayNameResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.setDisplayName(userId, displayName);
    }

    setHideOnlineStatus(hideOnlineStatus: boolean): Promise<void> {
        return this._userIndexClient.setHideOnlineStatus(hideOnlineStatus);
    }

    changeRole(
        chatId: MultiUserChatIdentifier,
        userId: string,
        newRole: MemberRole,
    ): Promise<ChangeRoleResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.changeRole(chatId.groupId, userId, newRole);
            case "channel":
                return this._communityClient.changeChannelRole(chatId, userId, newRole);
        }
    }

    deleteGroup(chatId: MultiUserChatIdentifier): Promise<DeleteGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.userClient.deleteGroup(chatId.groupId);
            case "channel":
                return this._communityClient.deleteChannel(chatId);
        }
    }

    removeMember(chatId: MultiUserChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.removeMember(chatId.groupId, userId);
            case "channel":
                return this._communityClient.removeMemberFromChannel(chatId, userId);
        }
    }

    blockUserFromDirectChat(userId: string): Promise<BlockUserResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.blockUser(userId);
    }

    blockUserFromGroupChat(
        chatId: MultiUserChatIdentifier,
        userId: string,
    ): Promise<BlockUserResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        if (chatId.kind === "channel")
            throw new Error("TODO - blockUserFromChannel not implemented");
        return this._groupClient.blockUser(chatId.groupId, userId);
    }

    unblockUserFromGroupChat(
        chatId: MultiUserChatIdentifier,
        userId: string,
    ): Promise<UnblockUserResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        if (chatId.kind === "channel")
            throw new Error("TODO - unblockUserFromChannel not implemented");
        return this._groupClient.unblockUser(chatId.groupId, userId);
    }

    unblockUserFromDirectChat(userId: string): Promise<UnblockUserResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.unblockUser(userId);
    }

    leaveGroup(chatId: MultiUserChatIdentifier): Promise<LeaveGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        if (chatIdentifiersEqual(this._groupInvite?.chatId, chatId)) {
            this._groupInvite = undefined;
        }
        switch (chatId.kind) {
            case "group_chat":
                return this.userClient.leaveGroup(chatId.groupId);
            case "channel":
                return this._communityClient.leaveChannel(chatId);
        }
    }

    async joinGroup(
        chatId: MultiUserChatIdentifier,
        credentialArgs: VerifiedCredentialArgs | undefined,
        compositeGateIndex?: number,
    ): Promise<JoinGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat": {
                const localUserIndex = await this._groupClient.localUserIndex(chatId.groupId);
                const groupInviteCode = this._groupClient.inviteCode(chatId.groupId);
                return this._localUserIndexClient
                    .joinGroup(
                        localUserIndex,
                        chatId.groupId,
                        groupInviteCode,
                        credentialArgs,
                        compositeGateIndex,
                    )
                    .then((resp) => {
                        if (resp.kind === "success") {
                            return {
                                kind: "success",
                                group: this.hydrateChatSummary(resp.group),
                            } as JoinGroupResponse;
                        }
                        return resp;
                    });
            }
            case "channel": {
                const localUserIndex = await this._communityClient.localUserIndex(
                    chatId.communityId,
                );
                const communityInviteCode = this._communityClient.inviteCode(chatId.communityId);
                const referredBy = await this.getCommunityReferral(chatId.communityId);
                return this._localUserIndexClient
                    .joinChannel(
                        localUserIndex,
                        chatId,
                        communityInviteCode,
                        credentialArgs,
                        referredBy,
                        compositeGateIndex,
                    )
                    .then((resp) => {
                        if (resp.kind === "success" || resp.kind === "success_joined_community") {
                            deleteCommunityReferral(chatId.communityId);
                        }
                        if (resp.kind === "success") {
                            return {
                                kind: "success",
                                group: this.hydrateChatSummary(resp.group),
                            } as JoinGroupResponse;
                        }

                        if (resp.kind === "success_joined_community") {
                            return {
                                kind: "success_joined_community",
                                community: this.hydrateCommunity(resp.community),
                            };
                        }
                        return resp;
                    });
            }
        }
    }

    async joinCommunity(
        id: CommunityIdentifier,
        credentialArgs: VerifiedCredentialArgs | undefined,
        compositeGateIndex?: number,
    ): Promise<JoinCommunityResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        const inviteCode = this._communityClient.inviteCode(id.communityId);
        const localUserIndex = await this._communityClient.localUserIndex(id.communityId);
        const referredBy = await this.getCommunityReferral(id.communityId);
        return this._localUserIndexClient
            .joinCommunity(
                localUserIndex,
                id.communityId,
                inviteCode,
                credentialArgs,
                referredBy,
                compositeGateIndex,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    deleteCommunityReferral(id.communityId);
                }
                return resp;
            });
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.userClient.markMessagesRead(request);
    }

    setUserAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.userClient.setAvatar(data);
    }

    setProfileBackground(data: Uint8Array): Promise<BlobReference> {
        return this.userClient.setProfileBackground(data);
    }

    addReaction(
        chatId: ChatIdentifier,
        messageId: bigint,
        reaction: string,
        username: string,
        displayName: string | undefined,
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<AddRemoveReactionResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.addReaction(
                    chatId.groupId,
                    messageId,
                    reaction,
                    username,
                    displayName,
                    threadRootMessageIndex,
                    newAchievement,
                );

            case "direct_chat":
                return this.userClient.addReaction(
                    chatId.userId,
                    messageId,
                    reaction,
                    threadRootMessageIndex,
                );

            case "channel":
                return this._communityClient.addReaction(
                    chatId,
                    username,
                    displayName,
                    messageId,
                    reaction,
                    threadRootMessageIndex,
                    newAchievement,
                );
        }
    }

    removeReaction(
        chatId: ChatIdentifier,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.removeReaction(
                    chatId.groupId,
                    messageId,
                    reaction,
                    threadRootMessageIndex,
                );

            case "direct_chat":
                return this.userClient.removeReaction(
                    chatId.userId,
                    messageId,
                    reaction,
                    threadRootMessageIndex,
                );

            case "channel":
                return this._communityClient.removeReaction(
                    chatId,
                    messageId,
                    reaction,
                    threadRootMessageIndex,
                );
        }
    }

    deleteMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.deleteGroupMessage(
                    chatId.groupId,
                    messageId,
                    threadRootMessageIndex,
                    asPlatformModerator,
                    newAchievement,
                );

            case "direct_chat":
                return this.deleteDirectMessage(chatId.userId, messageId, threadRootMessageIndex);

            case "channel":
                return this.deleteChannelMessage(
                    chatId,
                    messageId,
                    threadRootMessageIndex,
                    asPlatformModerator,
                    newAchievement,
                );
        }
    }

    private deleteChannelMessage(
        chatId: ChannelIdentifier,
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._communityClient.deleteMessages(
            chatId,
            [messageId],
            threadRootMessageIndex,
            asPlatformModerator,
            newAchievement,
        );
    }

    private deleteGroupMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._groupClient.deleteMessage(
            chatId,
            messageId,
            threadRootMessageIndex,
            asPlatformModerator,
            newAchievement,
        );
    }

    private deleteDirectMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeleteMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    undeleteMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.undeleteMessageInternal(chatId, messageId, threadRootMessageIndex).then(
            (resp) =>
                resp.kind === "success"
                    ? { ...resp, message: withLatestUserIds(resp.message, this._ownLatestUserIds) }
                    : resp,
        );
    }

    private undeleteMessageInternal(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.undeleteMessage(
                    chatId.groupId,
                    messageId,
                    threadRootMessageIndex,
                );
            case "direct_chat":
                return this.userClient.undeleteMessage(
                    chatId.userId,
                    messageId,
                    threadRootMessageIndex,
                );
            case "channel":
                return this._communityClient.undeleteMessage(
                    chatId,
                    messageId,
                    threadRootMessageIndex,
                );
        }
    }

    lastOnline(userIds: string[]): Promise<Record<string, number>> {
        return this._onlineClient.lastOnline(userIds);
    }

    markAsOnline(): Promise<MinutesOnline> {
        return this._onlineClient.markAsOnline();
    }

    subscriptionExists(endpoint: string): Promise<boolean> {
        return this._notificationClient.subscriptionExists(endpoint);
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this._notificationClient.pushSubscription(subscription);
    }

    removeSubscription(endpoint: string): Promise<void> {
        return this._notificationClient.removeSubscription(endpoint);
    }

    fcmTokenExists(fcmToken: string): Promise<boolean> {
        return this._notificationClient.fcmTokenExists(fcmToken);
    }

    addFcmToken(fcmToken: string, onResponseError?: (error: string | null) => void): Promise<void> {
        return this._notificationClient.addFcmToken(fcmToken, onResponseError);
    }

    removeFcmToken(fcmToken: string): Promise<void> {
        return this._notificationClient.removeFcmToken(fcmToken);
    }

    toggleMuteNotifications(
        id: ChatIdentifier | CommunityIdentifier,
        mute: boolean | undefined,
        muteAtEveryone: boolean | undefined,
    ): Promise<ToggleMuteNotificationResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "group_chat":
                return this._groupClient.toggleMuteNotifications(id.groupId, mute, muteAtEveryone);
            case "direct_chat":
                return this.userClient.toggleMuteNotifications(id.userId, mute!);
            case "channel":
            case "community":
                return this._communityClient.toggleMuteChannelNotifications(
                    id,
                    mute,
                    muteAtEveryone,
                );
        }
    }

    markNotificationSubscriptionActive(endpoint: string): Promise<void> {
        return this._notificationClient.markSubscriptionActive(endpoint);
    }

    getGroupDetails(
        chatId: MultiUserChatIdentifier,
        detailsLastUpdated: bigint,
        detailsSyncedUpTo?: bigint,
    ): Promise<GroupChatDetailsResponse> {
        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.getGroupDetails(
                    chatId.groupId,
                    detailsLastUpdated,
                    detailsSyncedUpTo,
                );
            case "channel":
                return this._communityClient.getChannelDetails(
                    chatId,
                    detailsLastUpdated,
                    detailsSyncedUpTo,
                );
        }
    }

    searchCommunityMembers(
        id: CommunityIdentifier,
        searchTerm: string,
        maxResults: number,
        latestKnownUpdate: bigint,
    ): Promise<LookupMembersResponse> {
        return this._communityClient.searchMembers(
            id.communityId,
            searchTerm,
            maxResults,
            latestKnownUpdate,
        );
    }

    lookupMembers(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
        latestKnownUpdate: bigint,
    ): Promise<LookupMembersResponse> {
        switch (id.kind) {
            case "group_chat":
                return this._groupClient.lookupMembers(id.groupId, userIds, latestKnownUpdate);
            case "channel":
                return this._communityClient.lookupChannelMembers(id, userIds, latestKnownUpdate);
            case "community":
                return this._communityClient.lookupMembers(
                    id.communityId,
                    userIds,
                    latestKnownUpdate,
                );
        }
    }

    getPublicGroupSummary(chatId: GroupChatIdentifier): Promise<PublicGroupSummaryResponse> {
        return this._groupClient
            .getPublicSummary(chatId.groupId)
            .then((resp) => {
                if (resp.kind === "success") {
                    const group = this.rehydrateDataContent(resp.group, "avatar");
                    return {
                        kind: "success",
                        group: {
                            ...group,
                            latestMessage: withLatestUserIds(
                                group.latestMessage,
                                this._ownLatestUserIds,
                            ),
                        },
                    } as PublicGroupSummaryResponse;
                }
                return resp;
            })
            .catch((err) => {
                // An imported group's canister is gone, so look up the channel it was imported as
                if (isCanisterGoneError(err)) {
                    return this._groupIndexClient.lookupChannelByGroupId(chatId).then((resp) => {
                        if (resp === undefined) return CommonResponses.failure();
                        return {
                            kind: "group_moved",
                            location: resp,
                        };
                    });
                }
                return CommonResponses.failure();
            });
    }

    getRecommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        return this._groupIndexClient
            .recommendedGroups(exclusions)
            .then((groups) => groups.map((g) => this.rehydrateDataContent(g, "avatar")));
    }

    dismissRecommendation(chatId: GroupChatIdentifier): Promise<void> {
        return this.userClient.dismissRecommendation(chatId.groupId);
    }

    getBio(userId?: string): Promise<string> {
        if (offline()) return Promise.resolve("");

        let userClient: UserClient | AnonUserClient;
        try {
            userClient = userId ? this.otherUserClient(userId) : this.userClient;
        } catch (err) {
            return Promise.reject(err);
        }
        return userClient.getBio();
    }

    getPublicProfile(userId?: string): Stream<PublicProfile | undefined> {
        if (userId) {
            return new Stream(async (resolve, reject) => {
                const deleted = await this._userDb.isUserIdDeleted(userId);
                if (deleted) {
                    resolve(undefined, true);
                }
                let userClient: UserClient;
                try {
                    userClient = this.otherUserClient(userId);
                } catch (err) {
                    reject(err);
                    return;
                }
                const result = userClient.getPublicProfile();
                result.subscribe({
                    onResult: (res, final) => {
                        resolve(res, final);
                    },
                    onError: (err) => {
                        reject(err);
                    },
                });
            });
        } else {
            return this.userClient.getPublicProfile().map<PublicProfile | undefined>((p) => p);
        }
    }

    setBio(bio: string): Promise<SetBioResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.setBio(bio);
    }

    getAuthenticationPrincipals(): Promise<AuthenticationPrincipalsResponse> {
        return this._identityClient.getAuthenticationPrincipals(this.authPrincipal);
    }

    async registerUser(
        username: string,
        email: string | undefined,
        referralCode: string | undefined,
    ): Promise<RegisterUserResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        const localUserIndex = await this._userIndexClient.userRegistrationCanister();
        return this._localUserIndexClient.registerUser(
            localUserIndex,
            username,
            email,
            referralCode,
        );
    }

    getUserStorageLimits(): Promise<StorageStatus> {
        return this._dataClient.storageStatus();
    }

    refreshAccountBalance(ledger: string, userId: string): Promise<bigint> {
        if (offline()) return Promise.resolve(0n);

        return this._ledgerClient.accountBalance(ledger, this.walletAccount(userId));
    }

    // The balances left behind in the wallets of the canisters the user had before being migrated to
    // a MultiUser canister, on each token in the Registry, which are large enough to be moved. Only
    // those of `previousUserIds` which were canisters of their own had wallets. A balance which
    // can't be read, eg. on a ledger which has been decommissioned, is left out, but if none can be
    // checked, while offline or before the Registry has loaded, this rejects.
    async fundsInPreviousWallets(previousUserIds: string[]): Promise<FundsInPreviousWallet[]> {
        if (offline()) {
            throw new Error("Offline, so the previous wallets can't be checked");
        }
        if (this._registryValue === undefined) {
            throw new Error("The Registry hasn't loaded, so the previous wallets can't be checked");
        }

        const tokens = this._registryValue.tokenDetails;
        const checks = previousUserIds
            .filter((id) => isCanisterId(Principal.fromText(id)))
            .flatMap((previousUserId) =>
                tokens.map((t) => ({ previousUserId, ledger: t.ledger, fee: t.transferFee })),
            );

        const funds: FundsInPreviousWallet[] = [];
        for (const batch of chunk(checks, MAX_CONCURRENT_PREVIOUS_WALLET_BALANCE_CHECKS)) {
            const balances = await Promise.allSettled(
                batch.map(({ previousUserId, ledger }) =>
                    this._ledgerClient.accountBalance(ledger, this.walletAccount(previousUserId)),
                ),
            );
            batch.forEach(({ previousUserId, ledger, fee }, i) => {
                const balance = balances[i];
                if (balance.status === "fulfilled" && balance.value > fee) {
                    funds.push({ previousUserId, ledger, balance: balance.value });
                }
            });
        }
        return funds;
    }

    // Moves the given balances, left behind in the wallets of the canisters the user had before
    // being migrated to a MultiUser canister, to the user's wallet, returning the outcome on each
    // ledger. The canisters are moved from one after another.
    async moveFundsFromPreviousWallets(
        funds: FundsInPreviousWallet[],
    ): Promise<MoveFundsOutcome[]> {
        const ledgersByPreviousUserId = new Map<string, Set<string>>();
        for (const { previousUserId, ledger } of funds) {
            const ledgers = ledgersByPreviousUserId.get(previousUserId) ?? new Set();
            ledgers.add(ledger);
            ledgersByPreviousUserId.set(previousUserId, ledgers);
        }

        const outcomes: MoveFundsOutcome[] = [];
        for (const [previousUserId, ledgers] of ledgersByPreviousUserId) {
            const results = await this.moveFundsFromPreviousWallet(previousUserId, [...ledgers]);
            outcomes.push(...results.map((r) => ({ previousUserId, ...r })));
        }
        return outcomes;
    }

    private async moveFundsFromPreviousWallet(
        previousUserId: string,
        ledgers: string[],
    ): Promise<{ ledger: string; result: MoveFundsResult }[]> {
        const outcomes: { ledger: string; result: MoveFundsResult }[] = [];
        let localUserIndexes: string[] | undefined = undefined;
        for (const batch of chunk(ledgers, MAX_LEDGERS_PER_FUNDS_MOVE)) {
            let response: MoveFundsFromOldCanisterResponse;
            try {
                localUserIndexes ??= await this.canisterControllers(previousUserId);
                const moved = await this.moveFundsThroughController(
                    localUserIndexes,
                    previousUserId,
                    batch,
                );
                response = moved.response;
                if (moved.localUserIndex !== undefined) {
                    localUserIndexes = [moved.localUserIndex];
                }
            } catch (err) {
                response = { kind: "error", code: ErrorCode.Unknown, message: String(err) };
            }

            if (response.kind === "success") {
                outcomes.push(...response.outcomes);
            } else {
                const result: MoveFundsResult = { kind: "failed", error: response };
                outcomes.push(...batch.map((ledger) => ({ ledger, result })));
            }
        }
        return outcomes;
    }

    // Moves the funds on `ledgers` from the canister of `previousUserId` through whichever of its
    // controllers is the LocalUserIndex which controls it, giving that LocalUserIndex if found. The
    // others are passed over, since a LocalUserIndex which doesn't control the canister returns
    // `CanisterNotFound`, and a canister which isn't a LocalUserIndex rejects the call.
    private async moveFundsThroughController(
        controllers: string[],
        previousUserId: string,
        ledgers: string[],
    ): Promise<{ localUserIndex?: string; response: MoveFundsFromOldCanisterResponse }> {
        let response: MoveFundsFromOldCanisterResponse = {
            kind: "error",
            code: ErrorCode.CanisterNotFound,
            message: "No LocalUserIndex controls the previous canister",
        };
        for (const controller of controllers) {
            try {
                response = await this.moveFundsFromOldCanister(controller, previousUserId, ledgers);
            } catch (err) {
                response = { kind: "error", code: ErrorCode.Unknown, message: String(err) };
                continue;
            }
            if (!isError(response) || response.code !== ErrorCode.CanisterNotFound) {
                return { localUserIndex: controller, response };
            }
        }
        return { response };
    }

    // The LocalUserIndex turns a move away with `AlreadyInProgress` while the canister is busy,
    // which it is for a few seconds while its cycles are refunded. That happens once the canister
    // is uninstalled, and again straight after each move which makes a transfer from it, so is to
    // be expected before each batch of ledgers after the first.
    private async moveFundsFromOldCanister(
        localUserIndex: string,
        previousUserId: string,
        ledgers: string[],
    ): Promise<MoveFundsFromOldCanisterResponse> {
        for (let attempt = 0; ; attempt++) {
            const response = await this._localUserIndexClient.moveFundsFromOldCanister(
                localUserIndex,
                previousUserId,
                ledgers,
            );
            if (
                !isError(response) ||
                response.code !== ErrorCode.AlreadyInProgress ||
                attempt >= MAX_FUNDS_MOVE_RETRIES
            ) {
                return response;
            }
            await new Promise((resolve) => setTimeout(resolve, FUNDS_MOVE_RETRY_INTERVAL_MS));
        }
    }

    // The canisters which control `canisterId`. The IC certifies these for any canister, so unlike
    // a canister's own `local_user_index` query, they can be had for a User canister which has been
    // uninstalled, as one is once its user has been migrated to a MultiUser canister. A User
    // canister is controlled by the LocalUserIndex which created it.
    private async canisterControllers(canisterId: string): Promise<string[]> {
        // `CanisterStatus` doesn't fetch the root key itself, as calls do, when the agent has to
        if (this._agent.rootKey === null) {
            await this._agent.fetchRootKey();
        }
        const status = await CanisterStatus.request({
            canisterId: Principal.fromText(canisterId),
            agent: this._agent,
            paths: ["controllers"],
        });
        // Rather than throwing, `CanisterStatus` gives null for a path it couldn't read
        const controllers = status.get("controllers");
        if (!Array.isArray(controllers)) {
            throw new Error(`Unable to read the controllers of ${canisterId}`);
        }
        return (controllers as Principal[]).filter(isCanisterId).map((c) => c.toText());
    }

    // The transactions of each wallet `userId` has held funds in, merged into one history
    async getAccountTransactions(
        ledgerIndex: string,
        userId: string,
        fromId?: bigint,
    ): Promise<AccountTransactionResult> {
        const wallets = this.walletsOf(userId);
        const isNns = this._registryValue?.nervousSystemSummary.some(
            (ns) => ns.isNns && ns.indexCanisterId === ledgerIndex,
        );
        const icpLedgerIndexClient = isNns
            ? new IcpLedgerIndexClient(this.identity, this._agent, ledgerIndex)
            : undefined;

        const results = await Promise.all(
            wallets.accounts.map((account) =>
                icpLedgerIndexClient !== undefined
                    ? icpLedgerIndexClient.getAccountTransactions(account, wallets, fromId)
                    : this._ledgerIndexClient.getAccountTransactions(
                          ledgerIndex,
                          account,
                          wallets,
                          fromId,
                      ),
            ),
        );
        return mergeAccountTransactions(results);
    }

    // The wallet of `userId`, along with, for the current user, the wallet of each of their other ids,
    // since the funds of a user migrated to a MultiUser canister were held in their User canister's
    // account until then, and in their principal's since. That's whichever of those the session isn't
    // under, which is usually their earlier one (see `updateOwnLatestUserIds`). Each of the user's ids
    // maps to the same principal, so ids which were each in a MultiUser canister share a wallet,
    // which is listed once.
    private walletsOf(userId: string): Wallets {
        const accounts = new Map<string, IcrcAccount>();
        const add = (account: IcrcAccount) => accounts.set(encodeIcrcAccount(account), account);

        add(this.walletAccount(userId));
        if (userId === this._userClient.userId) {
            for (const [ownUserId, latest] of this._ownLatestUserIds) {
                if (latest === userId) {
                    add(userWalletAccount(ownUserId, () => this.principal.toText()));
                }
            }
        }
        return { accounts: [...accounts.values()], userId };
    }

    getMessagesByMessageIndex(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined,
    ): Stream<EventsResponse<Message>> {
        return this._chatEventsReader
            .messagesByMessageIndex(
                chatId,
                threadRootMessageIndex,
                messageIndexes,
                latestKnownUpdate,
            )
            .mapAsync((resp) =>
                this.rehydrateEventResponse(
                    chatId,
                    resp,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                ),
            );
    }

    pinMessage(chatId: MultiUserChatIdentifier, messageIndex: number): Promise<PinMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.pinMessage(chatId.groupId, messageIndex);
            case "channel":
                return this._communityClient.pinMessage(chatId, messageIndex);
        }
    }

    unpinMessage(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
    ): Promise<UnpinMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.unpinMessage(chatId.groupId, messageIndex);
            case "channel":
                return this._communityClient.unpinMessage(chatId, messageIndex);
        }
    }

    registerPollVote(
        chatId: MultiUserChatIdentifier,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<RegisterPollVoteResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.registerPollVote(
                    chatId.groupId,
                    messageIdx,
                    answerIdx,
                    voteType,
                    threadRootMessageIndex,
                    newAchievement,
                );
            case "channel":
                return this._communityClient.registerPollVote(
                    chatId,
                    messageIdx,
                    answerIdx,
                    voteType,
                    threadRootMessageIndex,
                    newAchievement,
                );
        }
    }

    // A user who holds their own funds sends them from their wallet on the ledger, as themselves,
    // since their canister can't send them. Only their canister could check their PIN, so it isn't
    // checked when they do.
    async withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
        pin: string | undefined,
    ): Promise<WithdrawCryptocurrencyResponse> {
        if (offline()) return CommonResponses.offline();

        const stamped = { ...domain, createdAtNanos: await icNowNanos(this._agent, domain.ledger) };
        if (this.holdsOwnFunds()) {
            return this._ledgerClient.withdraw(stamped);
        }
        return this.userClient.withdrawCryptocurrency(stamped, pin);
    }

    getInviteCode(id: GroupChatIdentifier | CommunityIdentifier): Promise<InviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this._communityClient.getInviteCode(id.communityId);
            case "group_chat":
                return this._groupClient.getInviteCode(id.groupId);
        }
    }

    enableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<EnableInviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this._communityClient.enableInviteCode(id.communityId);
            case "group_chat":
                return this._groupClient.enableInviteCode(id.groupId);
        }
    }

    disableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<DisableInviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this._communityClient.disableInviteCode(id.communityId);
            case "group_chat":
                return this._groupClient.disableInviteCode(id.groupId);
        }
    }

    resetInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<ResetInviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this._communityClient.resetInviteCode(id.communityId);
            case "group_chat":
                return this._groupClient.resetInviteCode(id.groupId);
        }
    }

    pinChat(chatId: ChatIdentifier, favourite: boolean): Promise<PinChatResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.pinChat(chatId, favourite);
    }

    unpinChat(chatId: ChatIdentifier, favourite: boolean): Promise<UnpinChatResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.unpinChat(chatId, favourite);
    }

    archiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.archiveChat(chatId);
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.unarchiveChat(chatId);
    }

    async registerProposalVote(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        if (offline()) return CommonResponses.offline();

        // A User canister votes with the neurons hot-keyed to it. A MultiUser canister can't, since
        // its users share its principal, so for them vote with the neurons hot-keyed to their own
        // principal from here, then record the vote against the message.
        if (isMultiUserCanisterUser(this._userClient.userId)) {
            const voteResponse = await this.voteWithNeurons(
                governanceCanisterId,
                proposalId,
                isNns,
                adopt,
            );
            if (voteResponse.kind !== "success") return voteResponse;

            switch (chatId.kind) {
                case "group_chat":
                    return this._groupClient.registerProposalVoteV2(
                        chatId.groupId,
                        messageIndex,
                        adopt,
                    );
                case "channel":
                    return this._communityClient.registerProposalVoteV2(
                        chatId,
                        messageIndex,
                        adopt,
                    );
            }
        }

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.registerProposalVote(chatId.groupId, messageIndex, adopt);
            case "channel":
                return this._communityClient.registerProposalVote(chatId, messageIndex, adopt);
        }
    }

    // Lists the neurons the user's principal controls or is hot-keyed to, then votes with each of
    // them in parallel. The vote counts as cast if any neuron's vote is accepted, or if any neuron
    // had already voted (eg. via the NNS dapp), so that the vote still gets recorded in OpenChat.
    // Other neurons will typically have failed because they are not eligible for this proposal.
    private async voteWithNeurons(
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        let votes: PromiseSettledResult<ManageNeuronResponse>[];
        if (isNns) {
            const client = new NnsGovernanceClient(
                this.identity,
                this._agent,
                governanceCanisterId,
            );
            const neuronIds = await client.listNeurons();
            if (neuronIds.length === 0) return noEligibleNeurons();
            votes = await Promise.allSettled(
                neuronIds.map((id) => client.registerVote(id, proposalId, adopt)),
            );
        } else {
            const client = new SnsGovernanceClient(
                this.identity,
                this._agent,
                governanceCanisterId,
            );
            const neuronIds = await client.listNeurons();
            if (neuronIds.length === 0) return noEligibleNeurons();
            votes = await Promise.allSettled(
                neuronIds.map((id) => client.registerVote(id, proposalId, adopt)),
            );
        }

        const outcomes: ManageNeuronResponse[] = votes.map((v) =>
            v.status === "fulfilled"
                ? v.value
                : { kind: "error", type: -1, message: String(v.reason) },
        );

        if (outcomes.some((o) => o.kind === "success" || isAlreadyVoted(o, isNns))) {
            return CommonResponses.success();
        }

        this.config.logger.error("Failed to vote with any neuron", outcomes);
        const first = outcomes.find((o) => o.kind === "error");
        return {
            kind: "error",
            code:
                first !== undefined && isNotAcceptingVotes(first)
                    ? ErrorCode.ProposalNotAcceptingVotes
                    : ErrorCode.Unknown,
            message: first?.kind === "error" ? first.message : undefined,
        };

        function noEligibleNeurons(): RegisterProposalVoteResponse {
            return { kind: "error", code: ErrorCode.NoEligibleNeurons, message: undefined };
        }

        // NNS governance has a dedicated error type for this, SNS governance reports it as a
        // precondition failure, so fall back to the message both of them use
        function isAlreadyVoted(outcome: ManageNeuronResponse, isNns: boolean): boolean {
            if (outcome.kind !== "error") return false;
            if (isNns && outcome.type === NNS_ERROR_TYPE_NEURON_ALREADY_VOTED) return true;
            return /already voted/i.test(outcome.message);
        }

        // Best effort: both canisters report a closed proposal as a precondition failure whose
        // message mentions the deadline
        function isNotAcceptingVotes(outcome: ManageNeuronResponse): boolean {
            return (
                outcome.kind === "error" && /deadline|not accepting votes/i.test(outcome.message)
            );
        }
    }

    getProposalVoteDetails(
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
    ): Promise<ProposalVoteDetails> {
        if (isNns) {
            return new NnsGovernanceClient(
                this.identity,
                this._agent,
                governanceCanisterId,
            ).getProposalVoteDetails(proposalId);
        } else {
            return new SnsGovernanceClient(
                this.identity,
                this._agent,
                governanceCanisterId,
            ).getProposalVoteDetails(proposalId);
        }
    }

    listNervousSystemFunctions(
        snsGovernanceCanisterId: string,
    ): Promise<ListNervousSystemFunctionsResponse> {
        return new SnsGovernanceClient(
            this.identity,
            this._agent,
            snsGovernanceCanisterId,
        ).listNervousSystemFunctions();
    }

    async threadPreviews(
        threadsByChat: Map<string, [ThreadSyncDetails[], bigint | undefined]>,
    ): Promise<ThreadPreview[]> {
        function latestMessageTimestamp(messages: EventWrapper<Message>[]): bigint {
            return messages[messages.length - 1]?.timestamp ?? BigInt(0);
        }

        return Promise.all(
            [...ChatMap.fromMap(threadsByChat).entries()].map(
                ([chatId, [threadSyncs, latestKnownUpdate]]) => {
                    const latestClientThreadUpdate = threadSyncs.reduce(
                        (curr, next) => (next.lastUpdated > curr ? next.lastUpdated : curr),
                        BigInt(0),
                    );

                    switch (chatId.kind) {
                        case "group_chat":
                            return this._groupClient
                                .threadPreviews(
                                    chatId.groupId,
                                    threadSyncs.map((t) => t.threadRootMessageIndex),
                                    latestClientThreadUpdate,
                                )
                                .then(
                                    (response) =>
                                        [response, latestKnownUpdate] as [
                                            ThreadPreviewsResponse,
                                            bigint | undefined,
                                        ],
                                );

                        case "channel":
                            return this._communityClient
                                .threadPreviews(
                                    chatId,
                                    threadSyncs.map((t) => t.threadRootMessageIndex),
                                    latestClientThreadUpdate,
                                )
                                .then(
                                    (response) =>
                                        [response, latestKnownUpdate] as [
                                            ThreadPreviewsResponse,
                                            bigint | undefined,
                                        ],
                                );

                        case "direct_chat":
                            throw new Error("direct chat thread previews not supported");
                    }
                },
            ),
        ).then((responses) =>
            Promise.all(
                responses.map(([r, latestKnownUpdate]) => {
                    return r.kind === "thread_previews_success"
                        ? Promise.all(
                              r.threads.map((t) =>
                                  this.rehydrateThreadPreview(t, latestKnownUpdate),
                              ),
                          )
                        : [];
                }),
            ).then((threads) =>
                threads
                    .flat()
                    .sort((a, b) =>
                        Number(
                            latestMessageTimestamp(b.latestReplies) -
                                latestMessageTimestamp(a.latestReplies),
                        ),
                    ),
            ),
        );
    }

    private async rehydrateThreadPreview(
        thread: ThreadPreview,
        latestKnownUpdate: bigint | undefined,
    ): Promise<ThreadPreview> {
        const threadMissing = await this.resolveMissingIndexes(
            thread.chatId,
            thread.latestReplies,
            thread.rootMessage.event.messageIndex,
            latestKnownUpdate,
        );

        const rootMissing = await this.resolveMissingIndexes(
            thread.chatId,
            [thread.rootMessage],
            undefined,
            latestKnownUpdate,
        );

        const latestReplies = thread.latestReplies.map((r) =>
            this.rehydrateEvent(
                r,
                thread.chatId,
                threadMissing,
                emptyResolvedMessagePreviews(),
                thread.rootMessage.event.messageIndex,
            ),
        );
        const rootMessage = this.rehydrateEvent(
            thread.rootMessage,
            thread.chatId,
            rootMissing,
            emptyResolvedMessagePreviews(),
            undefined,
        );

        return {
            ...thread,
            rootMessage,
            latestReplies,
        };
    }

    setCachedMessageFromNotification(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        message: EventWrapper<Message>,
    ): Promise<void> {
        return this._chatsDb.setCachedMessageIfNotExists(chatId, message, threadRootMessageIndex);
    }

    freezeGroup(
        chatId: GroupChatIdentifier,
        reason: string | undefined,
    ): Promise<FreezeGroupResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.freezeGroup(chatId.groupId, reason);
    }

    unfreezeGroup(chatId: GroupChatIdentifier): Promise<UnfreezeGroupResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.unfreezeGroup(chatId.groupId);
    }

    freezeCommunity(
        id: CommunityIdentifier,
        reason: string | undefined,
    ): Promise<FreezeCommunityResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.freezeCommunity(id, reason);
    }

    unfreezeCommunity(id: CommunityIdentifier): Promise<UnfreezeCommunityResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.unfreezeCommunity(id);
    }

    deleteFrozenGroup(chatId: GroupChatIdentifier): Promise<DeleteFrozenGroupResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.deleteFrozenGroup(chatId.groupId);
    }

    addHotGroupExclusion(chatId: GroupChatIdentifier): Promise<AddHotGroupExclusionResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.addHotGroupExclusion(chatId.groupId);
    }

    removeHotGroupExclusion(chatId: GroupChatIdentifier): Promise<RemoveHotGroupExclusionResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.removeHotGroupExclusion(chatId.groupId);
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.suspendUser(userId, reason).then((resp) => {
            if (resp === "success") {
                this._userDb.userSuspended(userId, true);
            }
            return resp;
        });
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.unsuspendUser(userId).then((resp) => {
            if (resp === "success") {
                this._userDb.userSuspended(userId, false);
            }
            return resp;
        });
    }

    loadFailedMessages(): Promise<Map<string, Record<number, EventWrapper<Message>>>> {
        return this._chatsDb.loadFailedMessages().then((messages) => {
            const byChat = messages.toMap() as Map<string, Record<number, EventWrapper<Message>>>;
            // A message which failed before the user was migrated was sent under their earlier id
            for (const [chatKey, failed] of byChat) {
                byChat.set(chatKey, withLatestUserIds(failed, this._ownLatestUserIds));
            }
            return byChat;
        });
    }

    deleteFailedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        return this._chatsDb.removeFailedMessage(chatId, messageId, threadRootMessageIndex);
    }

    async claimPrize(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        signInProof: string | undefined,
    ): Promise<ClaimPrizeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        const localUserIndex = await (chatId.kind === "group_chat"
            ? this._groupClient.localUserIndex(chatId.groupId)
            : this._communityClient.localUserIndex(chatId.communityId));

        return this._localUserIndexClient.claimPrize(
            localUserIndex,
            chatId,
            messageId,
            signInProof,
        );
    }

    async payForDiamondMembership(
        userId: string,
        ledger: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
        fromAccount: string | undefined,
        pin: string | undefined,
    ): Promise<PayForDiamondMembershipResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        // The UserIndex has the user's canister pull the price, which includes the transfer's fee
        const error = await this.approveUserCanisterToPull(
            ledger,
            expectedPriceE8s,
            this.ledgerFee(ledger),
            fromAccount,
            pin,
        );
        if (error !== undefined) {
            return error;
        }

        return this._userIndexClient.payForDiamondMembership(
            userId,
            ledger,
            duration,
            recurring,
            expectedPriceE8s,
            fromAccount,
        );
    }

    setCommunityModerationFlags(
        communityId: string,
        flags: number,
    ): Promise<SetCommunityModerationFlagsResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.setCommunityModerationFlags(communityId, flags);
    }

    setGroupModerationFlags(
        chatId: string,
        flags: number,
    ): Promise<SetGroupModerationFlagsResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.setGroupModerationFlags(chatId, flags);
    }

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.setGroupUpgradeConcurrency(value);
    }

    setCommunityUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.setCommunityUpgradeConcurrency(value);
    }

    setUserUpgradeConcurrency(value: number): Promise<SetUserUpgradeConcurrencyResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.setUserUpgradeConcurrency(value);
    }

    createMultiUserCanister(
        localUserIndexCanisterId: string,
    ): Promise<CreateMultiUserCanisterResponse> {
        return this._userIndexClient.createMultiUserCanister(localUserIndexCanisterId);
    }

    setMultiUserCanistersEnabled(enabled: boolean): Promise<boolean> {
        return this._userIndexClient.setMultiUserCanistersEnabled(enabled);
    }

    migrateUsers(users: UsersToMigrate): Promise<MigrateUsersResponse> {
        return this._userIndexClient.migrateUsers(users);
    }

    setUserMigrationConcurrency(value: number): Promise<boolean> {
        return this._userIndexClient.setUserMigrationConcurrency(value);
    }

    userMigration(userId: string): Promise<UserMigrationResponse> {
        return this._userIndexClient.userMigration(userId);
    }

    cancelUserMigration(userId: string, multiUserCanisterId: string): Promise<Success | OCError> {
        return this._userIndexClient.cancelUserMigration(userId, multiUserCanisterId);
    }

    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<boolean> {
        return this._groupIndexClient.markLocalGroupIndexFull(canisterId, full);
    }

    stakeNeuronForSubmittingProposals(
        governanceCanisterId: string,
        stake: bigint,
    ): Promise<StakeNeuronForSubmittingProposalsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._proposalsBotClient
            .get()
            .stakeNeuronForSubmittingProposals(governanceCanisterId, stake);
    }

    topUpNeuronForSubmittingProposals(
        governanceCanisterId: string,
        amount: bigint,
    ): Promise<TopUpNeuronResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._proposalsBotClient.get().topUpNeuron(governanceCanisterId, amount);
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs,
    ): Promise<UpdateMarketMakerConfigResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._marketMakerClient.get().updateConfig(config);
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number,
    ): Promise<SetMessageReminderResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.setMessageReminder(
            chatId,
            eventIndex,
            remindAt,
            notes,
            threadRootMessageIndex,
        );
    }

    cancelMessageReminder(reminderId: bigint): Promise<boolean> {
        if (offline()) return Promise.resolve(false);

        return this.userClient.cancelMessageReminder(reminderId);
    }

    declineInvitation(chatId: MultiUserChatIdentifier): Promise<DeclineInvitationResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this._groupClient.declineInvitation(chatId.groupId);
            case "channel":
                return this._communityClient.declineInvitation(chatId);
        }
    }

    convertGroupToCommunity(
        chatId: GroupChatIdentifier,
        historyVisible: boolean,
        rules: Rules,
    ): Promise<ConvertToCommunityResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._groupClient.convertToCommunity(chatId.groupId, historyVisible, rules);
    }

    getRegistry(): Stream<[RegistryValue, boolean]> {
        return new Stream(async (resolve, reject) => {
            const current = await this._registryDb.get();
            const isOffline = offline();
            if (current !== undefined) {
                this._registryValue = current;
                resolve([current, false], isOffline);
            }

            if (!isOffline) {
                try {
                    const updates = await this._registryClient.updates(current?.lastUpdated);
                    if (updates.kind === "success") {
                        // Ledgers the registry has detected as uninstalled must be dropped from
                        // the cached token list, otherwise we keep querying dead ledgers forever
                        // (they never reappear in `tokenDetails`, only in `tokensUninstalled`).
                        const uninstalled = new Set(updates.tokensUninstalled);
                        const updated = {
                            lastUpdated: updates.lastUpdated,
                            tokenDetails: distinctBy(
                                [...updates.tokenDetails, ...(current?.tokenDetails ?? [])],
                                (t) => t.ledger,
                            ).filter((t) => !uninstalled.has(t.ledger)),
                            nervousSystemSummary: distinctBy(
                                [
                                    ...updates.nervousSystemSummary,
                                    ...(current?.nervousSystemSummary ?? []),
                                ],
                                (ns) => ns.governanceCanisterId,
                            ),
                            swapProviders: updates.swapProviders ?? current?.swapProviders ?? [],
                            messageFilters: [
                                ...(current?.messageFilters ?? []),
                                ...updates.messageFiltersAdded,
                            ].filter((f) => !updates.messageFiltersRemoved.includes(f.id)),
                            currentAirdropChannel: applyOptionUpdate(
                                current?.currentAirdropChannel,
                                updates.currentAirdropChannel,
                            ),
                        };
                        this._registryDb.set(updated);
                        this._registryValue = updated;
                        resolve([updated, true], true);
                    } else if (updates.kind === "success_no_updates" && current !== undefined) {
                        resolve([current, false], true);
                    } else {
                        // this is a fallback for is we had nothing in the cache and nothing from the api
                        reject("Registry is empty... this should never happen!");
                    }
                } catch (err) {
                    console.warn("Getting registry updates failed: ", err);
                    reject(err);
                }
            }
        });
    }

    setCommunityIndexes(communityIndexes: Record<string, number>): Promise<boolean> {
        if (offline()) return Promise.resolve(false);

        return this.userClient.setCommunityIndexes(communityIndexes);
    }

    createUserGroup(
        communityId: string,
        name: string,
        userIds: string[],
    ): Promise<CreateUserGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._communityClient.createUserGroup(communityId, name, userIds);
    }

    updateUserGroup(
        communityId: string,
        userGroupId: number,
        name: string | undefined,
        usersToAdd: string[],
        usersToRemove: string[],
    ): Promise<UpdateUserGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._communityClient.updateUserGroup(
            communityId,
            userGroupId,
            name,
            usersToAdd,
            usersToRemove,
        );
    }

    setMemberDisplayName(
        communityId: string,
        display_name: string | undefined,
        newAchievement: boolean,
    ): Promise<SetMemberDisplayNameResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._communityClient.setMemberDisplayName(
            communityId,
            display_name,
            newAchievement,
        );
    }

    deleteUserGroups(
        communityId: string,
        userGroupIds: number[],
    ): Promise<DeleteUserGroupsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._communityClient.deleteUserGroups(communityId, userGroupIds);
    }

    followThread(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        follow: boolean,
        newAchievement: boolean,
    ): Promise<FollowThreadResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        if (chatId.kind === "channel") {
            return this._communityClient.followThread(
                chatId,
                threadRootMessageIndex,
                follow,
                newAchievement,
            );
        } else if (chatId.kind === "group_chat") {
            return this._groupClient.followThread(
                chatId.groupId,
                threadRootMessageIndex,
                follow,
                newAchievement,
            );
        } else {
            throw new Error("followThread not implemented for direct chats");
        }
    }

    async submitProposal(
        currentUserId: string,
        governanceCanisterId: string,
        proposal: CandidateProposal,
        ledger: string,
        token: string,
        proposalRejectionFee: bigint,
        transactionFee: bigint,
    ): Promise<SubmitProposalResponse> {
        if (offline()) return CommonResponses.offline();

        // The ProposalsBot pulls the fee from the user's wallet, which they have approved it to
        return this._proposalsBotClient
            .get()
            .submitProposal(
                encodeIcrcAccount(this.walletAccount(currentUserId)),
                governanceCanisterId,
                proposal,
                ledger,
                token,
                proposalRejectionFee,
                transactionFee,
                await icNowNanos(this._agent, ledger),
            );
    }

    reportMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
        csam: boolean,
    ): Promise<boolean> {
        if (offline()) return Promise.resolve(false);

        if (chatId.kind === "channel") {
            return this._communityClient.reportMessage(
                chatId,
                threadRootMessageIndex,
                messageId,
                deleteMessage,
                csam,
            );
        } else if (chatId.kind === "group_chat") {
            return this._groupClient.reportMessage(
                chatId.groupId,
                threadRootMessageIndex,
                messageId,
                deleteMessage,
                csam,
            );
        } else {
            return this.userClient.reportMessage(
                chatId,
                threadRootMessageIndex,
                messageId,
                deleteMessage,
                csam,
            );
        }
    }

    canSwap(tokenLedgers: Set<string>): Promise<Set<string>> {
        return this._dexesAgent.get().canSwap(tokenLedgers, this.swapProviders());
    }

    getTokenSwaps(
        inputTokenLedger: string,
        outputTokenLedgers: string[],
    ): Promise<Record<string, DexId[]>> {
        return this._dexesAgent
            .get()
            .getSwapPools(inputTokenLedger, new Set(outputTokenLedgers), this.swapProviders())
            .then((pools) => {
                return pools.reduce(swapReducer, {} as Record<string, DexId[]>);
            });

        function swapReducer(
            result: Record<string, DexId[]>,
            pool: TokenSwapPool,
        ): Record<string, DexId[]> {
            const outputTokenLedger = inputTokenLedger === pool.token0 ? pool.token1 : pool.token0;
            return {
                ...result,
                [outputTokenLedger]: [...(result[outputTokenLedger] || []), pool.dex],
            };
        }
    }

    getTokenSwapQuotes(
        inputTokenLedger: string,
        outputTokenLedger: string,
        amountIn: bigint,
    ): Promise<[DexId, bigint][]> {
        return this._dexesAgent
            .get()
            .quoteSwap(inputTokenLedger, outputTokenLedger, amountIn, this.swapProviders())
            .then((quotes) => {
                // Sort the quotes by amount descending so the first quote is the best
                quotes.sort(compare);
                return quotes;
            });

        function compare(
            [_dexA, amountA]: [DexId, bigint],
            [_dexB, amountB]: [DexId, bigint],
        ): number {
            if (amountA > amountB) {
                return -1;
            }
            if (amountA < amountB) {
                return 1;
            }
            return 0;
        }
    }

    swapTokens(
        swapId: bigint,
        inputTokenDetails: CryptocurrencyDetails,
        outputTokenDetails: CryptocurrencyDetails,
        amountIn: bigint,
        minAmountOut: bigint,
        dex: DexId,
        pin: string | undefined,
    ): Promise<SwapTokensResponse> {
        return this._dexesAgent
            .get()
            .getSwapPools(
                inputTokenDetails.ledger,
                new Set([outputTokenDetails.ledger]),
                this.swapProviders(),
            )
            .then((pools) => {
                const pool = pools.find((p) => p.dex === dex);

                if (pool === undefined) {
                    return Promise.reject("Cannot find a matching pool");
                }

                const exchangeArgs: ExchangeTokenSwapArgs =
                    dex === "taco"
                        ? {
                              dex: "taco",
                              swapCanisterId: pool.canisterId,
                              treasuryCanisterId: TACO_TREASURY_CANISTER_ID,
                          }
                        : {
                              dex,
                              swapCanisterId: pool.canisterId,
                              zeroForOne: pool.token0 === inputTokenDetails.ledger,
                          };

                // A user who holds their own funds swaps straight from their wallet, since their
                // canister can't spend from it
                if (this.holdsOwnFunds()) {
                    return this.swapTokensFromWallet(
                        swapId,
                        inputTokenDetails,
                        outputTokenDetails,
                        amountIn,
                        minAmountOut,
                        pool,
                        exchangeArgs,
                        pin,
                    );
                }

                return this.userClient.swapTokens(
                    swapId,
                    inputTokenDetails,
                    outputTokenDetails,
                    amountIn,
                    minAmountOut,
                    exchangeArgs,
                    pin,
                );
            });
    }

    // Swaps straight from the wallet of a user who holds their own funds, via ICPSwap, which pulls the
    // input from the wallet and pays the output back to it. The input swapped is `amountIn` less the
    // fees for approving the pool and for its pull, so the swap takes `amountIn` from the wallet in
    // all, as a swap made by the user's canister does. The swap is recorded in the user's canister
    // as it starts and as it ends, so that one which doesn't finish, eg. because the user leaves part
    // way through, is found again (see `recoverUnfinishedTokenSwaps`), and they get the achievement
    // for swapping once it has.
    private async swapTokensFromWallet(
        swapId: bigint,
        inputTokenDetails: CryptocurrencyDetails,
        outputTokenDetails: CryptocurrencyDetails,
        amountIn: bigint,
        minAmountOut: bigint,
        pool: TokenSwapPool,
        exchangeArgs: ExchangeTokenSwapArgs,
        pin: string | undefined,
    ): Promise<SwapTokensResponse> {
        if (exchangeArgs.dex !== "icpswap") {
            return { kind: "error", code: ErrorCode.InvalidRequest, message: "Unsupported DEX" };
        }

        const fee = inputTokenDetails.transferFee;
        const amountToSwap = amountIn - 2n * fee;
        if (amountToSwap <= fee) {
            return { kind: "error", code: ErrorCode.InsufficientFunds, message: undefined };
        }
        // The pool pulls as its own default account
        const approvalError = await this.approveToPull(
            { owner: Principal.fromText(pool.canisterId) },
            inputTokenDetails.ledger,
            amountToSwap + fee,
            fee,
            pin,
        );
        if (approvalError !== undefined) {
            return approvalError;
        }

        const started = await this.userClient.markTokenSwapStarted(
            swapId,
            inputTokenDetails,
            outputTokenDetails,
            amountIn,
            minAmountOut,
            exchangeArgs,
        );
        if (started.kind !== "success") {
            return started;
        }

        const poolClient = this.icpSwapPoolClient(pool.canisterId, pool.token0, pool.token1);
        let result: DexSwapResult;
        try {
            result = await poolClient.swapFromWallet(
                inputTokenDetails.ledger,
                outputTokenDetails.ledger,
                amountToSwap,
                minAmountOut,
                fee,
                outputTokenDetails.transferFee,
            );
        } catch (err) {
            // The swap may or may not have gone ahead, so it is left unfinished, to be finished off
            // once it can no longer be in progress
            console.warn("Failed to swap tokens from the wallet", err);
            return { kind: "error", code: ErrorCode.Unknown, message: String(err) };
        }

        await this.markTokenSwapCompleted(
            swapId,
            result.kind === "success"
                ? { kind: "swapped", amountOut: result.amountOut }
                : { kind: "failed", reason: result.error },
        );

        if (result.kind === "success") {
            return { kind: "success", amountOut: result.amountOut };
        }
        // ICPSwap refuses a swap whose output would fall short of the minimum with a slippage
        // error, which is down to the rate having moved since the quote. Any other error (eg. the
        // pool's cached fees being out of date) is no better for quoting again.
        return result.error.includes("Slippage check failed")
            ? { kind: "error", code: ErrorCode.SwapFailed, message: result.error }
            : { kind: "internal_error", error: result.error };
    }

    // Records how a swap made straight from the wallet ended, trying a few times, since the swap is
    // over either way, and failing to record that leaves it to be finished off later as one whose
    // outcome isn't known
    private async markTokenSwapCompleted(
        swapId: bigint,
        result: { kind: "swapped"; amountOut: bigint } | { kind: "failed"; reason: string },
    ): Promise<void> {
        for (let attempt = 1; attempt <= MARK_TOKEN_SWAP_COMPLETED_ATTEMPTS; attempt++) {
            try {
                const response = await this.userClient.markTokenSwapCompleted(swapId, result);
                if (response.kind !== "success") {
                    console.warn("Failed to mark a token swap as completed", response);
                }
                return;
            } catch (err) {
                console.warn("Failed to mark a token swap as completed", attempt, err);
            }
        }
    }

    // Finishes off each swap the user started straight from their wallet which was never marked as
    // completed, eg. because they left part way through, withdrawing to their wallet anything
    // ICPSwap still holds for them, then marking the swap as completed. The user's canister only
    // lists swaps which can't still be in progress. A swap whose pool can't be checked, or whose
    // funds can't be withdrawn, is left to be tried again next time.
    async recoverUnfinishedTokenSwaps(): Promise<void> {
        if (!this.holdsOwnFunds() || offline()) return;

        for (const swap of await this.userClient.unfinishedTokenSwaps()) {
            const recovered = await this.withdrawFromPool(swap).catch((err) => {
                console.warn("Failed to withdraw an unfinished token swap's funds", err);
                return false;
            });
            if (recovered) {
                await this.markTokenSwapCompleted(swap.swapId, {
                    kind: "failed",
                    reason: "Never marked as completed, so how it ended isn't known",
                });
            }
        }
    }

    // Withdraws to the user's wallet whatever the pool an unfinished swap was made in holds for them,
    // returning whether there is nothing left there
    private async withdrawFromPool(swap: UnfinishedTokenSwap): Promise<boolean> {
        const { exchangeArgs } = swap;
        // A TACO swap pays out or refunds itself, so leaves nothing to withdraw
        if (exchangeArgs.dex !== "icpswap") return true;

        const [token0, token1] = exchangeArgs.zeroForOne
            ? [swap.inputLedger, swap.outputLedger]
            : [swap.outputLedger, swap.inputLedger];
        const poolClient = this.icpSwapPoolClient(exchangeArgs.swapCanisterId, token0, token1);

        let withdrawnAll = true;
        for (const { ledger, balance } of await poolClient.unusedBalances(this.principal)) {
            if (balance === 0n) continue;
            const fee = this.ledgerFee(ledger);
            if (fee === undefined) {
                withdrawnAll = false;
            } else if (balance > fee) {
                withdrawnAll = (await poolClient.withdraw(ledger, balance, fee)) && withdrawnAll;
            }
        }
        return withdrawnAll;
    }

    // An ICPSwap pool, which the user calls as themselves, so as the owner of their wallet
    private icpSwapPoolClient(
        canisterId: string,
        token0: string,
        token1: string,
    ): IcpSwapPoolClient {
        return new IcpSwapPoolClient(this.identity, this._agent, canisterId, token0, token1);
    }

    tokenSwapStatus(swapId: bigint): Promise<TokenSwapStatusResponse> {
        return this.userClient.tokenSwapStatus(swapId);
    }

    private swapProviders(): DexId[] {
        const swapProviders = this._registryValue?.swapProviders ?? [];
        // A user who holds their own funds swaps straight from their wallet (see
        // `swapTokensFromWallet`), which is only supported via ICPSwap so far
        return this.holdsOwnFunds() ? swapProviders.filter((p) => p === "icpswap") : swapProviders;
    }

    // Approves `spender`, a canister such as the ProposalsBot which spends as its own default
    // account, to pull up to `amount` from the user's wallet within `expiresIn` ms (see
    // `approveSpender`)
    approveTransfer(
        spender: string,
        ledger: string,
        amount: bigint,
        expiresIn: bigint | undefined,
        pin: string | undefined,
    ): Promise<ApproveTransferResponse> {
        return this.approveSpender(
            { owner: Principal.fromText(spender) },
            ledger,
            amount,
            expiresIn,
            pin,
        );
    }

    // Approves a group or community (`canisterId`) to pull an access gate's payment of up to
    // `amount` from the user's wallet when they join, within `expiresIn` ms. It pulls the payment as
    // the user's member spender account, as it does any other payment from a member's wallet (see
    // `approveSpender`).
    approveAccessGatePayment(
        canisterId: string,
        ledger: string,
        amount: bigint,
        expiresIn: bigint,
        pin: string | undefined,
    ): Promise<ApproveTransferResponse> {
        return this.approveSpender(
            this.memberSpenderAccount(canisterId),
            ledger,
            amount,
            expiresIn,
            pin,
        );
    }

    // Approves `spender` to pull up to `amount` from the user's wallet within `expiresIn` ms. A user
    // alone in their canister has it make the approval, which checks their PIN, and replaces
    // whatever the spender could pull before.
    //
    // A user who holds their own funds can't have their canister approve anything, so approves the
    // spender on the ledger themselves, once their canister has checked their PIN, adding `amount`
    // to what it may pull already, with the approval's fee on top. Without `expiresIn` their
    // approval lasts only long enough for a payment pulled at once, rather than never lapsing.
    private approveSpender(
        spender: IcrcAccount,
        ledger: string,
        amount: bigint,
        expiresIn: bigint | undefined,
        pin: string | undefined,
    ): Promise<ApproveTransferResponse> {
        if (!this.holdsOwnFunds()) {
            return this.userClient.approveTransfer(spender, ledger, amount, expiresIn, pin);
        }

        return this.approveToPull(
            spender,
            ledger,
            amount,
            this.ledgerFee(ledger),
            pin,
            expiresIn === undefined ? undefined : Number(expiresIn),
        ).then((error) => error ?? CommonResponses.success());
    }

    deleteDirectChat(userId: string, blockUser: boolean): Promise<boolean> {
        return this.userClient.deleteDirectChat(userId, blockUser);
    }

    diamondMembershipFees(): Promise<DiamondMembershipFees[]> {
        return this._userIndexClient.diamondMembershipFees();
    }

    setDiamondMembershipFees(fees: DiamondMembershipFees[]): Promise<boolean> {
        return this._userIndexClient.setDiamondMembershipFees(fees);
    }

    addRemoveSwapProvider(swapProvider: DexId, add: boolean): Promise<boolean> {
        return this._registryClient.addRemoveSwapProvider(swapProvider, add);
    }

    addMessageFilter(regex: string): Promise<boolean> {
        return this._registryClient.addMessageFilter(regex);
    }

    removeMessageFilter(id: bigint): Promise<boolean> {
        return this._registryClient.removeMessageFilter(id);
    }

    setAirdropConfig(
        channelId: number,
        channelName: string,
        communityId?: string,
        communityName?: string,
    ): Promise<boolean> {
        return this._registryClient.setAirdropConfig(
            channelId,
            channelName,
            communityId,
            communityName,
        );
    }

    setTokenEnabled(ledger: string, enabled: boolean): Promise<boolean> {
        return this._registryClient.setTokenEnabled(ledger, enabled);
    }

    async exchangeRates(): Promise<Record<string, TokenExchangeRates>> {
        const supportedTokens = this._registryValue?.tokenDetails;

        // if (supportedTokens === undefined || !isMainnet(this.config.icUrl)) {
        //     return Promise.resolve({});
        // }

        if (supportedTokens === undefined) {
            return Promise.resolve({});
        }

        const exchangeRatesFromAllProviders = await Promise.allSettled(
            this._exchangeRateClients.map((c) => c.exchangeRates(supportedTokens)),
        );

        const grouped: Record<string, TokenExchangeRates[]> = {};
        for (const response of exchangeRatesFromAllProviders) {
            if (response.status === "fulfilled") {
                for (const [token, exchangeRates] of Object.entries(response.value)) {
                    if (grouped[token] === undefined) {
                        grouped[token] = [];
                    }
                    grouped[token].push(exchangeRates);
                }
            }
        }

        const equivalentSymbols = [
            ["btc", "ckbtc"],
            ["eth", "cketh"],
        ];

        // If any symbols within a group of equivalent symbols are missing exchange rates,
        // copy them over from other symbols within the group
        for (const group of equivalentSymbols) {
            const symbolWithExchangeRates = group.find((s) => grouped[s] !== undefined);
            if (symbolWithExchangeRates) {
                const exchangeRates = grouped[symbolWithExchangeRates];
                for (const symbol of group) {
                    if (grouped[symbol] === undefined) {
                        grouped[symbol] = exchangeRates;
                    }
                }
            }
        }

        return toRecord2(
            Object.entries(grouped),
            ([token, _]) => token,
            ([_, group]) => ({
                toUSD: mean(group.map((e) => e.toUSD)),
            }),
        );
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this._userIndexClient.reportedMessages(userId);
    }

    // `username`, `displayName` and `newAchievement` are only needed by a group or community tipped
    // in directly
    async tipMessage(
        messageContext: MessageContext,
        messageId: bigint,
        transfer: PendingCryptocurrencyTransfer,
        decimals: number,
        pin: string | undefined,
        username: string,
        displayName: string | undefined,
        newAchievement: boolean,
    ): Promise<TipMessageResponse> {
        const { chatId, threadRootMessageIndex } = messageContext;
        const fee = transfer.feeE8s ?? 0n;
        const amount = transfer.amountE8s + fee;

        if (chatId.kind === "direct_chat") {
            // The user's canister pulls a tip in a direct chat
            const error = await this.approveUserCanisterToPull(
                transfer.ledger,
                amount,
                fee,
                transfer.fromAccount,
                pin,
            );
            if (error !== undefined) {
                return error;
            }
        } else if (this.holdsOwnFunds()) {
            // A user who holds their own funds tips in a group or channel by having the group or
            // community pull the tip from their wallet, since their canister can't make it for them
            if (transfer.fromAccount === undefined) {
                const spender = this.chatSpenderAccount(chatId);
                const error = await this.approveToPull(spender, transfer.ledger, amount, fee, pin);
                if (error !== undefined) {
                    return error;
                }
            }
            // Only a tip pulled by a group or community carries a stamp, a user's canister stamping
            // the tips it pulls or makes itself
            const wallet = encodeIcrcAccount(this.walletAccount(this._userClient.userId));
            const paid = {
                ...transfer,
                fromAccount: transfer.fromAccount ?? wallet,
                createdAtNanos: await icNowNanos(this._agent, transfer.ledger),
            };
            return chatId.kind === "channel"
                ? this._communityClient.tipMessage(
                      chatId,
                      threadRootMessageIndex,
                      messageId,
                      paid,
                      decimals,
                      username,
                      displayName,
                      newAchievement,
                  )
                : this._groupClient.tipMessage(
                      chatId.groupId,
                      threadRootMessageIndex,
                      messageId,
                      paid,
                      decimals,
                      username,
                      displayName,
                      newAchievement,
                  );
        }

        return this.userClient.tipMessage(messageContext, messageId, transfer, decimals, pin);
    }

    async acceptP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        token1: TokenInfo,
        token1Amount: bigint,
        pin: string | undefined,
        newAchievement: boolean,
        fromAccount: string | undefined,
    ): Promise<AcceptP2PSwapResponse> {
        // Whichever kind of chat the swap is in, it is the user's canister which deposits token1 in
        // the escrow canister, along with the fee for paying it out, so it costs two fees
        const error = await this.approveUserCanisterToPull(
            token1.ledger,
            token1Amount + 2n * token1.fee,
            token1.fee,
            fromAccount,
            pin,
        );
        if (error !== undefined) {
            return error;
        }

        if (chatId.kind === "channel") {
            return this._communityClient.acceptP2PSwap(
                chatId,
                threadRootMessageIndex,
                messageId,
                pin,
                newAchievement,
                fromAccount,
            );
        } else if (chatId.kind === "group_chat") {
            return this._groupClient.acceptP2PSwap(
                chatId.groupId,
                threadRootMessageIndex,
                messageId,
                pin,
                newAchievement,
                fromAccount,
            );
        } else {
            return this.userClient.acceptP2PSwap(
                chatId.userId,
                threadRootMessageIndex,
                messageId,
                pin,
                fromAccount,
            );
        }
    }

    cancelP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        if (chatId.kind === "channel") {
            return this._communityClient.cancelP2PSwap(chatId, threadRootMessageIndex, messageId);
        } else if (chatId.kind === "group_chat") {
            return this._groupClient.cancelP2PSwap(
                chatId.groupId,
                threadRootMessageIndex,
                messageId,
            );
        } else {
            return this.userClient.cancelP2PSwap(chatId.userId, messageId);
        }
    }

    videoCallParticipants(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        updatesSince?: bigint,
    ): Promise<VideoCallParticipantsResponse> {
        switch (chatId.kind) {
            case "channel":
                return this._communityClient.videoCallParticipants(chatId, messageId, updatesSince);
            case "group_chat":
                return this._groupClient.videoCallParticipants(
                    chatId.groupId,
                    messageId,
                    updatesSince,
                );
        }
    }

    joinVideoCall(
        chatId: ChatIdentifier,
        messageId: bigint,
        newAchievement: boolean,
    ): Promise<JoinVideoCallResponse> {
        if (chatId.kind === "channel") {
            return this._communityClient.joinVideoCall(chatId, messageId, newAchievement);
        } else if (chatId.kind === "group_chat") {
            return this._groupClient.joinVideoCall(chatId.groupId, messageId, newAchievement);
        } else {
            return this.userClient.joinVideoCall(chatId.userId, messageId);
        }
    }

    setVideoCallPresence(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        presence: VideoCallPresence,
        newAchievement: boolean,
    ): Promise<SetVideoCallPresenceResponse> {
        switch (chatId.kind) {
            case "channel":
                return this._communityClient.setVideoCallPresence(
                    chatId,
                    messageId,
                    presence,
                    newAchievement,
                );
            case "group_chat":
                return this._groupClient.setVideoCallPresence(
                    chatId.groupId,
                    messageId,
                    presence,
                    newAchievement,
                );
        }
    }

    async getAccessToken(
        accessTokenType: AccessTokenType,
        localUserIndex: string,
    ): Promise<string | undefined> {
        return this._localUserIndexClient.getAccessToken(localUserIndex, accessTokenType);
    }

    async getLocalUserIndexForUser(userId: string): Promise<string> {
        const localUserIndexFromCache = await this._chatsDb.getLocalUserIndexForUser(userId);
        if (localUserIndexFromCache !== undefined) {
            return localUserIndexFromCache;
        }
        return this.otherUserClient(userId)
            .localUserIndex()
            .then((localUserIndex) => {
                return this._chatsDb.cacheLocalUserIndexForUser(userId, localUserIndex);
            });
    }

    generateBtcAddress(): Promise<string> {
        return this.userClient.generateBtcAddress();
    }

    generateOneSecAddress(): Promise<string> {
        return this.userClient.generateOneSecAddress();
    }

    // Query the Bitcoin canister to check for any new UTXOs for this user, if there are any, then also query the ckBTC
    // minter to check that it has processed them, if it has not, call `update_btc_balance` on the user canister which
    // will then call into `update_balance` on the ckBTC minter to pull in the new UTXOs.
    async updateBtcBalance(userId: string, bitcoinAddress: string): Promise<boolean> {
        const allUtxos = await this._bitcoinClient.get().getUtxos(bitcoinAddress);

        if (allUtxos.length > 0) {
            const knownUtxos = await this._ckbtcMinterClient
                .get()
                .getKnownUtxos(this.walletAccount(userId));
            const knownUtxosSet = new Set(
                knownUtxos.map((utxo) => bytesToHexString(utxo.outpoint.txid)),
            );

            if (allUtxos.some((utxo) => !knownUtxosSet.has(bytesToHexString(utxo.outpoint.txid)))) {
                return await this.userClient.updateBtcBalance();
            }
        }

        return false;
    }

    withdrawBtc(
        address: string,
        amount: bigint,
        pin: string | undefined,
    ): Promise<WithdrawBtcResponse> {
        return this.userClient.withdrawBtc(address, amount, pin);
    }

    withdrawViaOneSec(
        ledger: string,
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        amount: bigint,
        pin: string | undefined,
    ) {
        return this.userClient.withdrawViaOneSec(ledger, tokenSymbol, chain, address, amount, pin);
    }

    getCkbtcMinterDepositInfo(): Promise<CkbtcMinterDepositInfo> {
        return this._ckbtcMinterClient.get().getDepositInfo();
    }

    getCkbtcMinterWithdrawalInfo(amount: bigint): Promise<CkbtcMinterWithdrawalInfo> {
        return this._ckbtcMinterClient.get().getWithdrawalInfo(amount);
    }

    oneSecGetTransferFees(): Promise<OneSecTransferFees[]> {
        return this._oneSecMinterClient.get().getTransferFees();
    }

    oneSecForwardEvmToIcp(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        receiver: string,
    ): Promise<OneSecForwardingStatus> {
        return this._oneSecMinterClient
            .get()
            .forwardEvmToIcp(tokenSymbol, chain, address, this.walletAccount(receiver));
    }

    oneSecGetForwardingStatus(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        receiver: string,
    ): Promise<OneSecForwardingStatus> {
        return this._oneSecMinterClient
            .get()
            .getForwardingStatus(tokenSymbol, chain, address, this.walletAccount(receiver));
    }

    async oneSecEnableForwarding(userId: string, evmAddress: string): Promise<void> {
        const client = this._oneSecForwarderClient.get();
        const forwarding = await client.isForwarding(evmAddress);
        if (!forwarding) {
            await client.enableForwarding(this.walletAccount(userId));
        }
    }

    generateMagicLink(email: string, sessionKey: Uint8Array): Promise<GenerateMagicLinkResponse> {
        return this._signInWithEmailClient.get().generateMagicLink(email, sessionKey);
    }

    getSignInWithEmailDelegation(
        email: string,
        sessionKey: Uint8Array,
        expiration: bigint,
    ): Promise<GetDelegationResponse> {
        return this._signInWithEmailClient.get().getDelegation(email, sessionKey, expiration);
    }

    siwePrepareLogin(address: string): Promise<SiwePrepareLoginResponse> {
        return this._signInWithEthereumClient.get().prepareLogin(address);
    }

    siwsPrepareLogin(address: string): Promise<SiwsPrepareLoginResponse> {
        return this._signInWithSolanaClient.get().prepareLogin(address);
    }

    loginWithWallet(
        token: "eth" | "sol",
        address: string,
        signature: string,
        sessionKey: Uint8Array,
    ): Promise<PrepareDelegationResponse> {
        switch (token) {
            case "eth":
                return this._signInWithEthereumClient.get().login(signature, address, sessionKey);
            case "sol":
                return this._signInWithSolanaClient.get().login(signature, address, sessionKey);
        }
    }

    getDelegationWithWallet(
        token: "eth" | "sol",
        address: string,
        sessionKey: Uint8Array,
        expiration: bigint,
    ): Promise<GetDelegationResponse> {
        switch (token) {
            case "eth":
                return this._signInWithEthereumClient
                    .get()
                    .getDelegation(address, sessionKey, expiration);
            case "sol":
                return this._signInWithSolanaClient
                    .get()
                    .getDelegation(address, sessionKey, expiration);
        }
    }

    setPinNumber(
        verification: Verification,
        newPin: string | undefined,
    ): Promise<SetPinNumberResponse> {
        return this.userClient.setPinNumber(verification, newPin);
    }

    claimDailyChit(utcOffsetMins: number | undefined): Promise<ClaimDailyChitResponse> {
        return this.userClient.claimDailyChit(utcOffsetMins);
    }

    chitLeaderboard(): Promise<ChitLeaderboardResponse> {
        return this._userIndexClient.chitLeaderboard();
    }

    chitEvents(req: ChitEventsRequest): Promise<ChitEventsResponse> {
        return this.userClient.chitEvents(req);
    }

    async markAchievementsSeen(): Promise<void> {
        const cachedState = await this._chatsDb.getCachedChats();
        if (cachedState !== undefined) {
            return this.userClient.markAchievementsSeen(cachedState.latestUserCanisterUpdates);
        }
    }

    submitProofOfUniquePersonhood(
        iiPrincipal: string,
        credential: string,
    ): Promise<SubmitProofOfUniquePersonhoodResponse> {
        return this._userIndexClient.submitProofOfUniquePersonhood(iiPrincipal, credential);
    }

    configureWallet(config: WalletConfig): Promise<void> {
        return this.userClient.configureWallet(config);
    }

    cancelInvites(
        id: MultiUserChatIdentifier | CommunityIdentifier,
        userIds: string[],
    ): Promise<boolean> {
        if (offline()) return Promise.resolve(false);

        switch (id.kind) {
            case "group_chat":
                return this._groupClient.cancelInvites(id.groupId, userIds);
            case "channel":
            case "community":
                return this._communityClient.cancelInvites(id, userIds);
        }
    }

    async clearCachedData(): Promise<void> {
        await Promise.all([
            this._chatsDb.clearCache(),
            this._userDb.clearCache(),
            clearReferralCache(),
        ]);
    }

    async getExternalAchievements(): Promise<ExternalAchievement[]> {
        const cached = await this._chatsDb.getCachedExternalAchievements();
        const updates = await this._userIndexClient.getExternalAchievements(
            cached?.lastUpdated ?? 0n,
        );

        if (updates.kind === "success") {
            const merged = this.mergeExternalAchievements(cached, updates);
            this._chatsDb.setCachedExternalAchievements(merged.lastUpdated, merged.achievements);
            return merged.achievements;
        }

        return cached?.achievements ?? [];
    }

    private mergeExternalAchievements(
        cached: { achievements: ExternalAchievement[] } | undefined,
        updates: ExternalAchievementsSuccess,
    ): { lastUpdated: bigint; achievements: ExternalAchievement[] } {
        if (cached === undefined) {
            return {
                lastUpdated: updates.lastUpdated,
                achievements: updates.addedOrUpdated,
            };
        }

        const { achievements } = cached;

        const map = toRecord(achievements, (a) => a.id);
        updates.addedOrUpdated.forEach((a) => {
            map[a.id] = a;
        });

        return {
            lastUpdated: updates.lastUpdated,
            achievements: Object.values(map),
        };
    }

    markActivityFeedRead(readUpTo: bigint): Promise<void> {
        return this.userClient.markActivityFeedRead(readUpTo);
    }

    messageActivityFeed(): Stream<MessageActivityFeedResponse> {
        return new Stream(async (resolve) => {
            const cachedEvents = await this._chatsDb.getActivityFeedEvents();

            const since = cachedEvents[0]?.timestamp ?? 0n;

            const server = await this.userClient.messageActivityFeed(since);

            const combined = [...cachedEvents, ...server.events];

            // first sort ascending
            combined.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

            // dedupe by overwriting earlier events with the same context, activity type and event index
            const deduped = combined.reduce((map, ev) => {
                map.set(
                    `${messageContextToString(ev.messageContext)}_${ev.activity}_${ev.eventIndex}`,
                    ev,
                );
                return map;
            }, new Map<string, MessageActivityEvent>());

            // then sort descending
            const sorted = [...deduped.values()].sort(
                (a, b) => Number(b.timestamp) - Number(a.timestamp),
            );

            this._chatsDb.setActivityFeedEvents(sorted.slice(0, MAX_ACTIVITY_EVENTS));

            this.hydrateActivityFeedEvents(sorted, (hydrated, final) =>
                resolve({ total: server.total, events: hydrated }, final),
            );
        });
    }

    async hydrateActivityFeedEvents(
        activityEvents: MessageActivityEvent[],
        callback: (events: MessageActivityEvent[], final: boolean) => void,
    ) {
        const messageIndexesByMessageContext = activityEvents.reduce((map, event) => {
            const messageIndexes = map.get(event.messageContext) ?? [];
            messageIndexes.push(event.messageIndex);
            map.set(event.messageContext, messageIndexes);
            return map;
        }, new AsyncMessageContextMap<number>());

        await messageIndexesByMessageContext.asyncMap(async (cxt, indexes) => {
            const response = await this.getMessagesByMessageIndex(
                cxt.chatId,
                cxt.threadRootMessageIndex,
                indexes,
                undefined,
            )
                .aggregate(mergeEventStreamResponses, emptyEventsResponse<Message>())
                .toPromise();

            const lookup = toRecord2(
                response.events,
                (m) => m.event.messageIndex,
                (m) => m.event,
            );

            activityEvents.forEach((ev) => {
                if (messageContextsEqual(cxt, ev.messageContext)) {
                    ev.message = lookup[ev.messageIndex] ?? ev.message;
                }
            });
            callback(activityEvents, false);
            return [cxt, []];
        });
        callback(activityEvents, true);
    }

    getChannelSummary(channelId: ChannelIdentifier): Promise<ChannelSummaryResponse> {
        return this._communityClient.channelSummary(channelId).then((resp) => {
            if (resp.kind === "channel") {
                return this.hydrateChatSummary(resp);
            }
            return resp;
        });
    }

    exploreBots(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        location: BotInstallationLocation | undefined,
        excludeInstalled: boolean,
    ): Promise<ExploreBotsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._userIndexClient.exploreBots(
            searchTerm,
            pageIndex,
            pageSize,
            location,
            excludeInstalled,
        );
    }

    registerBot(principal: string, bot: ExternalBot): Promise<boolean> {
        if (offline()) return Promise.resolve(false);
        return this._userIndexClient.registerBot(principal, bot);
    }

    removeBot(botId: string): Promise<boolean> {
        if (offline()) return Promise.resolve(false);
        return this._userIndexClient.removeBot(botId);
    }

    updateRegisteredBot(
        id: string,
        principal?: string,
        ownerId?: string,
        avatarUrl?: string,
        endpoint?: string,
        definition?: BotDefinition,
    ): Promise<boolean> {
        if (offline()) return Promise.resolve(false);
        return this._userIndexClient.updateRegisteredBot(
            id,
            principal,
            ownerId,
            avatarUrl,
            endpoint,
            definition,
        );
    }

    #localUserIndexForBotContext(id: BotInstallationLocation): Promise<string> {
        switch (id.kind) {
            case "community":
                return this._communityClient.localUserIndex(id.communityId);
            case "group_chat":
                return this._groupClient.localUserIndex(id.groupId);
            case "direct_chat":
                return this.getLocalUserIndexForUser(this.userClient.userId);
        }
    }

    async installBot(
        id: BotInstallationLocation,
        botId: string,
        grantedPermissions: GrantedBotPermissions,
    ): Promise<boolean> {
        const localUserIndex = await this.#localUserIndexForBotContext(id);
        return this._localUserIndexClient.installBot(localUserIndex, id, botId, grantedPermissions);
    }

    updateInstalledBot(
        id: BotInstallationLocation,
        botId: string,
        grantedPermissions: GrantedBotPermissions,
    ): Promise<boolean> {
        switch (id.kind) {
            case "community":
                return this._communityClient.updateInstalledBot(
                    id.communityId,
                    botId,
                    grantedPermissions,
                );
            case "group_chat":
                return this._groupClient.updateInstalledBot(id.groupId, botId, grantedPermissions);
            case "direct_chat":
                return this.userClient.updateInstalledBot(botId, grantedPermissions);
        }
    }

    async uninstallBot(id: BotInstallationLocation, botId: string): Promise<boolean> {
        const localUserIndex = await this.#localUserIndexForBotContext(id);
        return this._localUserIndexClient.uninstallBot(localUserIndex, id, botId);
    }

    getBots(initialLoad: boolean): Stream<BotsResponse> {
        return new Stream(async (resolve, reject) => {
            const cachedBots = await this._chatsDb.getCachedBots();
            const isOffline = offline();
            if (cachedBots && initialLoad) {
                resolve(cachedBots, isOffline);
            }
            if (!isOffline) {
                try {
                    const updates = await this._userIndexClient.getBots(cachedBots);
                    this._chatsDb.setCachedBots(updates);
                    resolve(updates, true);
                } catch (err) {
                    reject(err);
                }
            }
        });
    }

    async withdrawFromIcpSwap(
        userId: string,
        swapId: bigint,
        inputToken: boolean,
        amount: bigint | undefined,
        fee: bigint | undefined,
    ): Promise<boolean> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.withdrawFromIcpSwap(
            localUserIndex,
            userId,
            swapId,
            inputToken,
            amount,
            fee,
        );
    }

    async payForStreakInsurance(
        additionalDays: number,
        expectedPrice: bigint,
        pin: string | undefined,
    ): Promise<PayForStreakInsuranceResponse> {
        // The price is paid in CHAT to the SNS governance canister, which is the CHAT ledger's
        // minting account, so it is burned, and the ledger charges no fee for a burn
        const error = await this.approveUserCanisterToPull(
            LEDGER_CANISTER_CHAT,
            expectedPrice,
            this.ledgerFee(LEDGER_CANISTER_CHAT),
            undefined,
            pin,
        );
        if (error !== undefined) {
            return error;
        }

        return this.userClient.payForStreakInsurance(additionalDays, expectedPrice, pin);
    }

    updateDirectChatSettings(userId: string, eventsTtl: OptionUpdate<bigint>): Promise<boolean> {
        return this.userClient.updateChatSettings(userId, eventsTtl);
    }

    registerWebhook(
        chatId: MultiUserChatIdentifier,
        name: string,
        avatar: string | undefined,
    ): Promise<FullWebhookDetails | undefined> {
        switch (chatId.kind) {
            case "channel":
                return this._communityClient.registerWebhook(chatId, name, avatar);
            case "group_chat":
                return this._groupClient.registerWebhook(chatId.groupId, name, avatar);
        }
    }

    updateWebhook(
        chatId: MultiUserChatIdentifier,
        id: string,
        name: string | undefined,
        avatar: OptionUpdate<string>,
    ): Promise<boolean> {
        switch (chatId.kind) {
            case "channel":
                return this._communityClient.updateWebhook(chatId, id, name, avatar);
            case "group_chat":
                return this._groupClient.updateWebhook(chatId.groupId, id, name, avatar);
        }
    }

    regenerateWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<string | undefined> {
        switch (chatId.kind) {
            case "channel":
                return this._communityClient.regenerateWebhook(chatId, id);
            case "group_chat":
                return this._groupClient.regenerateWebhook(chatId.groupId, id);
        }
    }

    deleteWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<boolean> {
        switch (chatId.kind) {
            case "channel":
                return this._communityClient.deleteWebhook(chatId, id);
            case "group_chat":
                return this._groupClient.deleteWebhook(chatId.groupId, id);
        }
    }

    getWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<string | undefined> {
        switch (chatId.kind) {
            case "channel":
                return this._communityClient.getWebhook(chatId, id);
            case "group_chat":
                return this._groupClient.getWebhook(chatId.groupId, id);
        }
    }

    async updateProposalTallies(chatId: MultiUserChatIdentifier): Promise<EventWrapper<Message>[]> {
        const response = await (chatId.kind === "channel"
            ? this._communityClient.activeProposalTallies(chatId)
            : this._groupClient.activeProposalTallies(chatId.groupId));

        if (isError(response) || response.length === 0) {
            return [];
        }

        const { messages, version } = await this._chatsDb.updateCachedProposalTallies(
            chatId,
            response,
        );
        if (version !== undefined) {
            await this.#announceSyncHead(version);
        }
        // Returned straight from the cache, so not through `rehydrateEvent`
        return withLatestUserIds(messages, this._ownLatestUserIds);
    }

    async #updateCachedProposalTallies(localUserIndex: string, chatIds: MultiUserChatIdentifier[]) {
        const response = await this._localUserIndexClient.activeProposalTallies(
            localUserIndex,
            chatIds,
        );

        let head: number | undefined = undefined;
        for (const [chatId, tallies] of response) {
            const { version } = await this._chatsDb.updateCachedProposalTallies(chatId, tallies);
            head = version ?? head;
        }
        if (head !== undefined) {
            await this.#announceSyncHead(head);
        }
    }

    async payForPremiumItem(userId: string, item: PremiumItem): Promise<PayForPremiumItemResponse> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.payForPremiumItem(localUserIndex, item);
    }

    async dailyPuzzleFetch(userId: string): Promise<DailyPuzzleFetchResult | OCError> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.dailyPuzzleFetch(localUserIndex);
    }

    async dailyPuzzleStart(
        userId: string,
        gameId: string,
        number: number,
        expectedEntryFee: number,
    ): Promise<DailyPuzzleStartResponse> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.dailyPuzzleStart(
            localUserIndex,
            gameId,
            number,
            expectedEntryFee,
        );
    }

    async dailyPuzzleSubmit(
        userId: string,
        gameId: string,
        number: number,
        grid: Uint8Array,
    ): Promise<DailyPuzzleSubmitResponse> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.dailyPuzzleSubmit(localUserIndex, gameId, number, grid);
    }

    async dailyPuzzleHint(
        userId: string,
        gameId: string,
        number: number,
        level: number,
        filled: [number, number][],
        expectedPrice: number,
    ): Promise<DailyPuzzleHintResponse> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.dailyPuzzleHint(
            localUserIndex,
            gameId,
            number,
            level,
            filled,
            expectedPrice,
        );
    }

    async dailyPuzzleSaveGrid(
        userId: string,
        gameId: string,
        number: number,
        grid: Uint8Array,
    ): Promise<Success | OCError> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.dailyPuzzleSaveGrid(localUserIndex, gameId, number, grid);
    }

    dailyPuzzleCurrent(): Promise<PublicDailyPuzzle[]> {
        if (!this.config.dailyPuzzleCanister) return Promise.resolve([]);
        return this._dailyPuzzleClient.get().currentPuzzles();
    }

    dailyPuzzleResults(
        gameId: string,
        number: number,
        userIds: string[],
    ): Promise<DailyPuzzleResult[]> {
        if (!this.config.dailyPuzzleCanister) return Promise.resolve([]);
        return this._dailyPuzzleClient.get().results(gameId, number, userIds);
    }

    dailyPuzzleConfig(): Promise<DailyPuzzleConfig | OCError> {
        return this._dailyPuzzleClient.get().config();
    }

    dailyPuzzleSetEnabled(enabled: boolean): Promise<Success | OCError> {
        return this._dailyPuzzleClient.get().setEnabled(enabled);
    }

    callPushEnabled(): Promise<boolean> {
        return this._userIndexClient.callPushEnabled();
    }

    setCallPushEnabled(enabled: boolean): Promise<Success | OCError> {
        return this._userIndexClient.setCallPushEnabled(enabled);
    }
    dailyPuzzleRegenerateToday(gameId: string | undefined): Promise<Success | OCError> {
        return this._dailyPuzzleClient.get().regenerateToday(gameId);
    }
    setPremiumItemCost(item: PremiumItem, chitCost: number): Promise<void> {
        return this._userIndexClient.setPremiumItemCost(item, chitCost);
    }

    async reinstateMissedDailyClaims(userId: string, days: number[]): Promise<boolean> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this._localUserIndexClient.reinstateMissedDailyClaims(localUserIndex, userId, days);
    }

    updateBlockedUsernamePatterns(pattern: string, add: boolean): Promise<void> {
        return this._userIndexClient.updateBlockedUsernamePatterns(pattern, add);
    }
}

export interface ExchangeRateClient {
    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates>>;
}
