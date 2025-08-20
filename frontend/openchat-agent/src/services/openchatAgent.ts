/* eslint-disable no-case-declarations */
import { HttpAgent, type Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import type {
    AcceptedRules,
    AcceptP2PSwapResponse,
    AccessGateConfig,
    AccessTokenType,
    AccountTransactionResult,
    AddHotGroupExclusionResponse,
    AddRemoveReactionResponse,
    ApproveTransferResponse,
    ArchiveChatResponse,
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
    CreatedUser,
    CreateGroupResponse,
    CreateUserGroupResponse,
    CryptocurrencyDetails,
    CurrentUserResponse,
    DataContent,
    DeclineInvitationResponse,
    DeletedDirectMessageResponse,
    DeletedGroupMessageResponse,
    DeleteFrozenGroupResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DeleteUserGroupsResponse,
    DexId,
    DiamondMembershipDuration,
    DiamondMembershipFees,
    DirectChatIdentifier,
    DirectChatSummary,
    DirectChatSummaryUpdates,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventWrapper,
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
    OptionalChatPermissions,
    OptionUpdate,
    PayForDiamondMembershipResponse,
    PayForPremiumItemResponse,
    PayForStreakInsuranceResponse,
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
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
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
    SetCommunityModerationFlagsResponse,
    SetDisplayNameResponse,
    SetGroupUpgradeConcurrencyResponse,
    SetMemberDisplayNameResponse,
    SetMessageReminderResponse,
    SetPinNumberResponse,
    SetUsernameResponse,
    SetUserUpgradeConcurrencyResponse,
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
    ToggleMuteNotificationResponse,
    TokenExchangeRates,
    TokenSwapPool,
    TokenSwapStatusResponse,
    TopUpNeuronResponse,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnfreezeCommunityResponse,
    UnfreezeGroupResponse,
    UnpinChatResponse,
    UnpinMessageResponse,
    UnsuspendUserResponse,
    UpdatedEvent,
    UpdatedRules,
    UpdateGroupResponse,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
    UpdatesResult,
    UpdatesSuccessResponse,
    UpdateUserGroupResponse,
    User,
    UserCanisterCommunitySummary,
    UserCanisterCommunitySummaryUpdates,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
    UsersArgs,
    UsersResponse,
    UserSummary,
    Verification,
    VerifiedCredentialArgs,
    VideoCallParticipantsResponse,
    VideoCallPresence,
    WaitAllResult,
    WalletConfig,
    WithdrawBtcResponse,
    WithdrawCryptocurrencyResponse,
} from "openchat-shared";
import {
    ANON_USER_ID,
    applyOptionUpdate,
    chatIdentifiersEqual,
    ChatMap,
    CommonResponses,
    DestinationInvalidError,
    getOrAdd,
    isError,
    isSuccessfulEventsResponse,
    Lazy,
    MAX_ACTIVITY_EVENTS,
    MessageContextMap,
    messageContextToString,
    MessageMap,
    offline,
    ONE_MINUTE_MILLIS,
    Stream,
    UnsupportedValueError,
    waitAll,
} from "openchat-shared";
import type { AgentConfig } from "../config";
import { CachePrimer } from "../utils/cachePrimer";
import {
    cacheLocalUserIndexForUser,
    clearCache,
    type Database,
    deleteEventsForChat,
    getActivityFeedEvents,
    getCachedBots,
    getCachedChats,
    getCachedExternalAchievements,
    getCachePrimerTimestamps,
    getLocalUserIndexForUser,
    initDb,
    loadFailedMessages,
    recordFailedMessage,
    removeFailedMessage,
    setActivityFeedEvents,
    setCachedBots,
    setCachedChats,
    setCachedExternalAchievements,
    setCachedMessageIfNotExists,
    updateCachedProposalTallies,
} from "../utils/caching";
import {
    buildBlobUrl,
    buildUserAvatarUrl,
    getUpdatedEvents,
    mergeDirectChatUpdates,
    mergeGroupChats,
    mergeGroupChatUpdates,
} from "../utils/chat";
import {
    isSuccessfulCommunitySummaryResponse,
    mergeCommunities,
    mergeCommunityUpdates,
} from "../utils/community";
import { createHttpAgentSync } from "../utils/httpAgent";
import { chunk, distinctBy, toRecord, toRecord2 } from "../utils/list";
import { bytesToHexString, mapOptional } from "../utils/mapping";
import { mean } from "../utils/maths";
import { AsyncMessageContextMap } from "../utils/messageContext";
import { isMainnet } from "../utils/network";
import {
    clearCache as clearReferralCache,
    deleteCommunityReferral,
    getCommunityReferral,
} from "../utils/referralCache";
import { getCachedRegistry, setCachedRegistry } from "../utils/registryCache";
import { Updatable, UpdatableOption } from "../utils/updatable";
import {
    clearCache as clearUserCache,
    getAllUsers,
    isUserIdDeleted,
    userSuspended,
} from "../utils/userCache";
import { BitcoinClient } from "./bitcoin/bitcoin.client";
import { CkbtcMinterClient } from "./ckbtcMinter/ckbtcMinter.client";
import { measure } from "./common/profiling";
import { CommunityClient } from "./community/community.client";
import { DataClient } from "./data/data.client";
import { DexesAgent } from "./dexes";
import { callBotCommandEndpoint } from "./externalBot/externalBot";
import { GroupClient } from "./group/group.client";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import { IcpCoinsClient } from "./icpcoins/icpCoinsClient";
import { IcpLedgerIndexClient } from "./icpLedgerIndex/icpLedgerIndex.client";
import { IcpSwapClient } from "./icpSwap/icpSwapClient";
import { LedgerClient } from "./ledger/ledger.client";
import { LedgerIndexClient } from "./ledgerIndex/ledgerIndex.client";
import { LocalUserIndexClient } from "./localUserIndex/localUserIndex.client";
import { MarketMakerClient } from "./marketMaker/marketMaker.client";
import { NnsGovernanceClient } from "./nnsGovernance/nns.governance.client";
import { NotificationsClient } from "./notifications/notifications.client";
import { OneSecMinterClient } from "./oneSecMinter/oneSecMinter.client";
import { OnlineClient } from "./online/online.client";
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

export class OpenChatAgent extends EventTarget {
    private _agent: HttpAgent;
    private _userIndexClient: UserIndexClient;
    private _onlineClient: OnlineClient;
    private _groupIndexClient: GroupIndexClient;
    private _userClient?: UserClient | AnonUserClient;
    private _notificationClient: NotificationsClient;
    private _registryClient: RegistryClient;
    private _dataClient: DataClient;
    private _localUserIndexClients: Record<string, LocalUserIndexClient>;
    private _ledgerClients: Record<string, LedgerClient>;
    private _ledgerIndexClients: Record<string, LedgerIndexClient>;
    private _groupClients: Record<string, GroupClient>;
    private _communityClients: Record<string, CommunityClient>;
    private _exchangeRateClients: ExchangeRateClient[];
    private _groupInvite: GroupInvite | undefined;
    private _communityInvite: CommunityInvite | undefined;
    private _registryValue: RegistryValue | undefined;
    private db: Database;
    private _logger: Logger;
    private _cachePrimer: CachePrimer | undefined = undefined;

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
    private _oneSecMinterClient: Lazy<OneSecMinterClient>;

    constructor(private identity: Identity, private config: AgentConfig) {
        super();
        this._logger = config.logger;
        this._agent = createHttpAgentSync(identity, config.icUrl);
        this.db = initDb(this.principal);
        this._onlineClient = new OnlineClient(identity, this._agent, config.onlineCanister);
        this._userIndexClient = new UserIndexClient(
            identity,
            this._agent,
            config.userIndexCanister,
            config.blobUrlPattern,
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
        this._dataClient = new DataClient(identity, this._agent, config);
        this._exchangeRateClients = [
            new IcpCoinsClient(identity, this._agent),
            new IcpSwapClient(identity, this._agent),
        ];
        this._localUserIndexClients = {};
        this._ledgerClients = {};
        this._ledgerIndexClients = {};
        this._groupClients = {};
        this._communityClients = {};
        this._groupInvite = config.groupInvite;

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
        this._oneSecMinterClient = new Lazy(
            () => new OneSecMinterClient(identity, this._agent, config.oneSecMinterCanister),
        );
    }

    private get principal(): Principal {
        return this.identity.getPrincipal();
    }

    getAllCachedUsers(): Promise<UserSummary[]> {
        return measure("getAllUsers", () =>
            getAllUsers().then((users) => users.map((u) => this.rehydrateUserSummary(u))),
        );
    }

    logError(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.error(message, optionalParams);
    }

    public set groupInvite(value: GroupInvite) {
        this._groupInvite = value;
    }

    public set communityInvite(value: CommunityInvite) {
        this._communityInvite = value;
    }

    createUserClient(userId: string): OpenChatAgent {
        if (userId === ANON_USER_ID) {
            this._userClient = AnonUserClient.create();
        } else {
            this._userClient = new UserClient(
                userId,
                this.identity,
                this._agent,
                this.config,
                this.db,
            );
        }
        return this;
    }

    communityClient(communityId: string): CommunityClient {
        if (!this._communityClients[communityId]) {
            const inviteCode = this.getProvidedCommunityInviteCode(communityId);
            this._communityClients[communityId] = new CommunityClient(
                this.identity,
                this._agent,
                this.config,
                communityId,
                this.db,
                inviteCode,
            );
        }
        return this._communityClients[communityId];
    }

    getGroupClient(chatId: string): GroupClient {
        if (!this._groupClients[chatId]) {
            const inviteCode = this.getProvidedGroupInviteCode({
                kind: "group_chat",
                groupId: chatId,
            });
            this._groupClients[chatId] = new GroupClient(
                this.identity,
                this._agent,
                this.config,
                { kind: "group_chat", groupId: chatId },
                this.db,
                inviteCode,
            );
        }
        return this._groupClients[chatId];
    }

    get userClient(): UserClient | AnonUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    getLedgerClient(ledger: string): LedgerClient {
        if (!this._ledgerClients[ledger]) {
            this._ledgerClients[ledger] = new LedgerClient(this.identity, this._agent, ledger);
        }
        return this._ledgerClients[ledger];
    }

    getLedgerIndexClient(ledgerIndex: string): LedgerIndexClient {
        if (!this._ledgerIndexClients[ledgerIndex]) {
            this._ledgerIndexClients[ledgerIndex] = new LedgerIndexClient(
                this.identity,
                this._agent,
                ledgerIndex,
            );
        }
        return this._ledgerIndexClients[ledgerIndex];
    }

    private getLocalUserIndexClient(canisterId: string): LocalUserIndexClient {
        if (!this._localUserIndexClients[canisterId]) {
            this._localUserIndexClients[canisterId] = new LocalUserIndexClient(
                this.identity,
                this._agent,
                canisterId,
                this.db,
            );
        }
        return this._localUserIndexClients[canisterId];
    }

    private getProvidedGroupInviteCode(chatId: MultiUserChatIdentifier): string | undefined {
        if (this._groupInvite === undefined) return undefined;
        return chatIdentifiersEqual(this._groupInvite.chatId, chatId)
            ? this._groupInvite.code
            : undefined;
    }

    private getProvidedCommunityInviteCode(communityId: string): string | undefined {
        if (this._communityInvite === undefined) return undefined;
        return this._communityInvite.id.communityId === communityId
            ? this._communityInvite.code
            : undefined;
    }

    private getCommunityReferral(communityId: string): Promise<string | undefined> {
        return getCommunityReferral(communityId, Date.now());
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
                recordFailedMessage(this.db, chatId, event, threadRootMessageIndex);
                return resolve([CommonResponses.offline(), event.event], true);
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
        return this.communityClient(chatId.communityId).sendMessage(
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
        return this.getGroupClient(chatId.groupId).sendMessage(
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
        return this.getGroupClient(chatId.groupId).editMessage(
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
        return this.communityClient(chatId.communityId).editMessage(
            chatId,
            message,
            threadRootMessageIndex,
            blockLevelMarkdown,
            newAchievement,
        );
    }

    private sendDirectMessage(
        chatId: DirectChatIdentifier,
        event: EventWrapper<Message>,
        messageFilterFailed: bigint | undefined,
        threadRootMessageIndex: number | undefined,
        pin: string | undefined,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
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
            return this.communityClient(candidate.id.communityId).createChannel(candidate);
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
                return this.getGroupClient(chatId.groupId).updateGroup(
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
                return this.communityClient(chatId.communityId).updateChannel(
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
                const localUserIndex = await this.communityClient(id.communityId).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                return localUserIndexClient.inviteUsersToCommunity(id.communityId, userIds);
            }
            case "group_chat": {
                const localUserIndex = await this.getGroupClient(id.groupId).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                return localUserIndexClient.inviteUsersToGroup(id.groupId, userIds);
            }
            case "channel": {
                const localUserIndex = await this.communityClient(id.communityId).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                return localUserIndexClient.inviteUsersToChannel(
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
    ): Promise<EventsResponse<ChatEvent>> {
        console.debug("CHAT EVENTS: Getting events window", {
            chatId,
            threadRootMessageIndex,
            messageIndex,
        });

        switch (chatId.kind) {
            case "direct_chat":
                return this.directChatEventsWindow(
                    eventIndexRange,
                    chatId,
                    messageIndex,
                    latestKnownUpdate,
                );
            case "group_chat":
                return this.groupChatEventsWindow(
                    eventIndexRange,
                    chatId,
                    messageIndex,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                );
            case "channel":
                return this.channelEventsWindow(
                    eventIndexRange,
                    chatId,
                    messageIndex,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                );
        }
    }

    private directChatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.userClient.chatEventsWindow(
                eventIndexRange,
                chatId,
                messageIndex,
                latestKnownUpdate,
            ),
            undefined,
            latestKnownUpdate,
        );
    }

    chatEvents(
        chatId: ChatIdentifier,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        console.debug("CHAT EVENTS: Getting chat events", {
            chatId,
            threadRootMessageIndex,
            startIndex,
            ascending,
        });

        if (chatId.kind === "group_chat") {
            return this.groupChatEvents(
                eventIndexRange,
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        } else if (chatId.kind === "direct_chat") {
            return this.directChatEvents(
                eventIndexRange,
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        } else if (chatId.kind === "channel") {
            return this.channelEvents(
                eventIndexRange,
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
        throw new UnsupportedValueError("Unexpect chat type", chatId);
    }

    private directChatEvents(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.userClient.chatEvents(
                eventIndexRange,
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    private directChatEventsByEventIndex(
        chatId: DirectChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.userClient.chatEventsByIndex(
                eventIndexes,
                chatId,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    private channelEventsWindow(
        eventIndexRange: IndexRange,
        chatId: ChannelIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.communityClient(chatId.communityId).eventsWindow(
                chatId,
                eventIndexRange,
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    private groupChatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: GroupChatIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const rawEvents = this.getGroupClient(chatId.groupId).chatEventsWindow(
            eventIndexRange,
            messageIndex,
            threadRootMessageIndex,
            latestKnownUpdate,
        );
        return this.rehydrateEventResponse(
            chatId,
            rawEvents,
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    private channelEvents(
        eventIndexRange: IndexRange,
        chatId: ChannelIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.communityClient(chatId.communityId).events(
                chatId,
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    private groupChatEvents(
        eventIndexRange: IndexRange,
        chatId: GroupChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.getGroupClient(chatId.groupId).chatEvents(
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    chatEventsByEventIndex(
        chatId: ChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        console.debug("CHAT EVENTS: Getting chat events by index", {
            chatId,
            threadRootMessageIndex,
            eventIndexes,
        });

        switch (chatId.kind) {
            case "group_chat":
                return this.groupChatEventsByEventIndex(
                    chatId,
                    eventIndexes,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                );
            case "direct_chat":
                return this.directChatEventsByEventIndex(
                    chatId,
                    eventIndexes,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                );
            case "channel":
                return this.channelEventsByEventIndex(
                    chatId,
                    eventIndexes,
                    threadRootMessageIndex,
                    latestKnownUpdate,
                );
        }
    }

    private channelEventsByEventIndex(
        chatId: ChannelIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.communityClient(chatId.communityId).eventsByIndex(
                chatId,
                eventIndexes,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    private groupChatEventsByEventIndex(
        chatId: GroupChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.getGroupClient(chatId.groupId).chatEventsByIndex(
                eventIndexes,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
            threadRootMessageIndex,
            latestKnownUpdate,
        );
    }

    async getDeletedGroupMessage(
        chatId: MultiUserChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        switch (chatId.kind) {
            case "group_chat":
                const groupResp = await this.getGroupClient(chatId.groupId).getDeletedMessage(
                    messageId,
                    threadRootMessageIndex,
                );
                if (groupResp.kind === "success") {
                    groupResp.content = this.rehydrateMessageContent(groupResp.content);
                }
                return groupResp;
            case "channel":
                const channelResp = await this.communityClient(
                    chatId.communityId,
                ).getDeletedMessage(chatId, messageId, threadRootMessageIndex);
                if (channelResp.kind === "success") {
                    channelResp.content = this.rehydrateMessageContent(channelResp.content);
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
            response.content = this.rehydrateMessageContent(response.content);
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
            const chatKind = chatId.kind;

            // Note that the latestKnownUpdate relates to the *currentChat*, not necessarily the chat for this messageContext
            // So only include it if the context matches the current chat
            // And yes - this is probably trying to tell us something
            const latestUpdate = chatIdentifiersEqual(chatId, currentChatId)
                ? latestKnownUpdate
                : undefined;

            if (chatKind === "direct_chat") {
                return this.userClient
                    .chatEventsByIndex(idxs, chatId, ctx.threadRootMessageIndex, latestUpdate)
                    .then((resp) => this.messagesFromEventsResponse(ctx, resp));
            } else if (chatKind === "group_chat") {
                const client = this.getGroupClient(chatId.groupId);
                return client
                    .chatEventsByIndex(idxs, ctx.threadRootMessageIndex, latestUpdate)
                    .then((resp) => this.messagesFromEventsResponse(ctx, resp));
            } else if (chatKind === "channel") {
                const client = this.communityClient(chatId.communityId);
                return client
                    .eventsByIndex(chatId, idxs, ctx.threadRootMessageIndex, latestUpdate)
                    .then((resp) => this.messagesFromEventsResponse(ctx, resp));
            } else {
                throw new UnsupportedValueError("unknown chatid kind supplied", chatId);
            }
        });

        return mapped;
    }

    private rehydrateEvent<T extends ChatEvent>(
        ev: EventWrapper<T>,
        defaultChatId: ChatIdentifier,
        missingReplies: AsyncMessageContextMap<EventWrapper<Message>>,
        threadRootMessageIndex: number | undefined,
    ): EventWrapper<T> {
        if (ev.event.kind === "message") {
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

            if (originalContent !== rehydratedContent || rehydratedReplyContext !== undefined) {
                return {
                    ...ev,
                    event: {
                        ...ev.event,
                        content: rehydratedContent,
                        repliesTo: rehydratedReplyContext ?? originalReplyContext,
                    },
                };
            }
        }
        return ev;
    }

    private async rehydrateEventResponse<T extends ChatEvent>(
        currentChatId: ChatIdentifier,
        eventsPromise: Promise<EventsResponse<T>>,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<T>> {
        const resp = await eventsPromise;

        if (!isSuccessfulEventsResponse(resp)) {
            return resp;
        }

        const missing = await this.resolveMissingIndexes(
            currentChatId,
            resp.events,
            threadRootMessageIndex,
            latestKnownUpdate,
        );

        resp.events = resp.events.map((e) =>
            this.rehydrateEvent(e, currentChatId, missing, threadRootMessageIndex),
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
                        : `${this.config.blobUrlPattern
                              .replace("{canisterId}", this.config.userIndexCanister)
                              .replace("{blobType}", "avatar")}/${userSummary.userId}/${
                              ref?.blobId
                          }`,
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
                      channelId,
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
        const missing = await this.resolveMissingIndexes(
            chatId,
            [message],
            threadRootMessageIndex,
            latestKnownUpdate,
        );
        return this.rehydrateEvent(message, chatId, missing, threadRootMessageIndex);
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        if (offline()) return Promise.resolve([]);

        return this._userIndexClient
            .searchUsers(searchTerm, maxResults)
            .then((users) => users.map((u) => this.rehydrateUserSummary(u)));
    }

    exploreChannels(
        id: CommunityIdentifier,
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize = 10,
    ): Promise<ExploreChannelsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.communityClient(id.communityId)
            .exploreChannels(searchTerm, pageIndex, pageSize)
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

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._groupIndexClient.searchGroups(searchTerm, maxResults).then((res) => {
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
                return this.getGroupClient(chatId.groupId).searchGroupChat(
                    searchTerm,
                    userIds,
                    maxResults,
                );
            case "channel":
                return this.communityClient(chatId.communityId).searchChannel(
                    chatId,
                    maxResults,
                    userIds,
                    searchTerm,
                );
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

    private async _getUpdates(
        current: ChatStateFull | undefined,
    ): Promise<UpdatesResult | undefined> {
        const start = performance.now();
        let totalQueryCount = 0;

        let userCanisterLocalUserIndex: string;
        let currentDirectChats: DirectChatSummary[] = [];
        let directChatsAdded: DirectChatSummary[] = [];
        let directChatUpdates: DirectChatSummaryUpdates[] = [];
        let directChatsRemoved: string[] = [];
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
        let pinnedGroupChats: Updatable<GroupChatIdentifier[]>;
        let pinnedDirectChats: Updatable<DirectChatIdentifier[]>;
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

        if (current === undefined) {
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
            pinnedGroupChats = new Updatable(userResponse.groupChats.pinned, true);
            pinnedDirectChats = new Updatable(userResponse.directChats.pinned, true);
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
            pinnedGroupChats = new Updatable(current.pinnedGroupChats);
            pinnedDirectChats = new Updatable(current.pinnedDirectChats);
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

            try {
                totalQueryCount++;
                const userResponse = await this.userClient.getUpdates(
                    current.latestUserCanisterUpdates,
                );

                if (userResponse.kind === "success") {
                    anyUpdates = true;
                    latestUserCanisterUpdates = userResponse.timestamp;

                    directChatsAdded = userResponse.directChats.added;
                    directChatUpdates = userResponse.directChats.updated;
                    directChatsRemoved = userResponse.directChats.removed;
                    directChatsRemoved.forEach((id) => {
                        deleteEventsForChat(this.db, id);
                    });

                    groupsAdded = userResponse.groupChats.added;
                    groupsRemoved = userResponse.groupChats.removed;
                    userCanisterGroupUpdates = userResponse.groupChats.updated;

                    communitiesAdded = userResponse.communities.added;
                    communitiesRemoved = userResponse.communities.removed;
                    userCanisterCommunityUpdates = userResponse.communities.updated;

                    avatarId.applyOptionUpdate(userResponse.avatarId);
                    blockedUsers.updateIfNotUndefined(userResponse.blockedUsers);
                    pinnedGroupChats.updateIfNotUndefined(userResponse.groupChats.pinned);
                    pinnedDirectChats.updateIfNotUndefined(userResponse.directChats.pinned);
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
                        userResponse.streakEnds !== chitState.value.streakEnds ||
                        // TODO remove this once User canisters have been upgraded
                        userResponse.nextDailyClaim !== chitState.value.nextDailyChitClaim
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

        const byLocalUserIndex: Map<string, GroupAndCommunitySummaryUpdatesArgs[]> = new Map();

        for (const group of groupsAdded) {
            getOrAdd(byLocalUserIndex, group.localUserIndex, []).push({
                canisterId: group.id.groupId,
                isCommunity: false,
                inviteCode: undefined,
                updatesSince: undefined,
            });
        }

        for (const community of communitiesAdded) {
            getOrAdd(byLocalUserIndex, community.localUserIndex, []).push({
                canisterId: community.id.communityId,
                isCommunity: true,
                inviteCode: undefined,
                updatesSince: undefined,
            });
        }

        for (const group of currentGroups) {
            getOrAdd(byLocalUserIndex, group.localUserIndex, []).push({
                canisterId: group.id.groupId,
                isCommunity: false,
                inviteCode: undefined,
                updatesSince: group.lastUpdated,
            });
        }

        for (const community of currentCommunities) {
            getOrAdd(byLocalUserIndex, community.localUserIndex, []).push({
                canisterId: community.id.communityId,
                isCommunity: true,
                inviteCode: undefined,
                updatesSince: community.lastUpdated,
            });
        }

        const previousUpdatesTimestamp = mapOptional(current?.latestUserCanisterUpdates, Number);
        const summaryUpdatesResponses = await this.#getSummaryUpdatesFromLocalUserIndexes(
            byLocalUserIndex,
            previousUpdatesTimestamp,
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

        if (!anyUpdates) {
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

        this.removeExpiredLatestMessages(directChats, start);
        this.removeExpiredLatestMessages(groupChats, start);
        communities.forEach((c) => this.removeExpiredLatestMessages(c.channels, start));

        const state = {
            userCanisterLocalUserIndex,
            latestUserCanisterUpdates,
            directChats,
            groupChats,
            communities,
            avatarId: avatarId.value,
            blockedUsers: blockedUsers.value,
            pinnedGroupChats: pinnedGroupChats.value,
            pinnedDirectChats: pinnedDirectChats.value,
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

        if (this.userClient.userId !== ANON_USER_ID) {
            setCachedChats(this.db, this.principal, state, updatedEvents);

            if (this._cachePrimer === undefined) {
                // Set up the cache primer on the first iteration but don't process anything yet, since we want OC's
                // initialization to be as fast as possible and so don't want resources going to the CachePrimer yet.
                getCachePrimerTimestamps(this.db).then(
                    (ts) =>
                        (this._cachePrimer = new CachePrimer(
                            state.userCanisterLocalUserIndex,
                            ts,
                            (localUserIndex, requests) =>
                                this.getLocalUserIndexClient(localUserIndex).chatEvents(
                                    requests,
                                    true,
                                ),
                            (localUserIndex, proposalChatIds) =>
                                this.#updateCachedProposalTallies(localUserIndex, proposalChatIds),
                            (userIds) => this._userIndexClient.populateUserCache(userIds),
                        )),
                );
            } else {
                this._cachePrimer.processState(state);
            }
        }

        const directChatsAddedUpdatedIds = new Set([
            ...directChatsAdded.map((c) => c.id.userId),
            ...directChatUpdates.map((c) => c.id.userId),
        ]);
        const directChatsAddedUpdated = directChats
            .filter((c) => directChatsAddedUpdatedIds.has(c.id.userId))
            .map((c) => this.hydrateChatSummary(c));

        const groupsAddedUpdatedIds = new Set([
            ...groupsAdded.map((g) => g.id.groupId),
            ...groupUpdates.map((g) => g.id.groupId),
        ]);
        const groupsAddedUpdated = groupChats
            .filter((g) => groupsAddedUpdatedIds.has(g.id.groupId))
            .map((c) => this.hydrateChatSummary(c));

        const communitiesAddedUpdatedIds = new Set([
            ...communitiesAdded.map((c) => c.id.communityId),
            ...communityUpdates.map((c) => c.id.communityId),
        ]);
        const communitiesAddedUpdated = communities
            .filter((c) => communitiesAddedUpdatedIds.has(c.id.communityId))
            .map((c) => this.hydrateCommunity(c));

        const duration = performance.now() - start;
        console.debug(
            `GetUpdates completed in ${duration}ms. Number of queries: ${totalQueryCount}`,
        );

        return {
            directChatsAddedUpdated,
            directChatsRemoved,
            groupsAddedUpdated,
            groupsRemoved,
            communitiesAddedUpdated,
            communitiesRemoved,
            updatedEvents: updatedEvents.toMap() as Map<string, UpdatedEvent[]>,
            avatarId: avatarId.toOptionUpdate(),
            blockedUsers: blockedUsers.valueIfUpdated(),
            pinnedGroupChats: pinnedGroupChats.valueIfUpdated(),
            pinnedDirectChats: pinnedDirectChats.valueIfUpdated(),
            pinnedChannels: pinnedChannels.valueIfUpdated(),
            pinnedFavouriteChats: pinnedFavouriteChats.valueIfUpdated(),
            favouriteChats: favouriteChats.valueIfUpdated(),
            pinNumberSettings: pinNumberSettings.toOptionUpdate(),
            achievements: achievements.valueIfUpdated(),
            newAchievements: newAchievements.valueIfUpdated() ?? [],
            chitState: chitState.valueIfUpdated(),
            referrals: referrals.valueIfUpdated(),
            walletConfig: walletConfig.valueIfUpdated(),
            messageActivitySummary: messageActivitySummary.valueIfUpdated(),
            installedBots: installedBots.valueIfUpdated(),
            bitcoinAddress: bitcoinAddress.valueIfUpdated(),
            oneSecAddress: oneSecAddress.valueIfUpdated(),
            streakInsurance: streakInsurance.toOptionUpdate(),
            suspensionChanged,
            premiumItems: premiumItems.valueIfUpdated(),
        };
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

        const results = await Promise.all(promises);
        const success: GroupAndCommunitySummaryUpdatesResponseBatch[] = [];
        const errors = [];
        for (const result of results) {
            success.push(...result.success);
            errors.push(...result.errors);
        }
        return { success, errors };
    }

    async #getSummaryUpdatesFromLocalUserIndex(
        localUserIndex: string,
        requests: GroupAndCommunitySummaryUpdatesArgs[],
        batchSize: number,
        maxC2cCalls: number,
    ): Promise<WaitAllResult<GroupAndCommunitySummaryUpdatesResponseBatch>> {
        const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
        const promises = chunk(requests, batchSize).map((batch) =>
            localUserIndexClient.groupAndCommunitySummaryUpdates(batch, maxC2cCalls),
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
                localUserIndexClient.groupAndCommunitySummaryUpdates(batch, maxC2cCalls),
            );
            const excessResponses = await waitAll(excessPromises);
            success.push(...excessResponses.success);
            errors.push(...excessResponses.errors);
        }

        return { success, errors };
    }

    getUpdates(initialLoad: boolean): Stream<UpdatesResult | undefined> {
        return new Stream(async (resolve, reject) => {
            const cachedState = await getCachedChats(this.db, this.principal);
            const isOffline = offline();
            if (cachedState && initialLoad) {
                resolve(
                    {
                        ...cachedState,
                        directChatsAddedUpdated: this.hydrateChatSummaries(cachedState.directChats),
                        directChatsRemoved: [],
                        groupsAddedUpdated: this.hydrateChatSummaries(cachedState.groupChats),
                        groupsRemoved: [],
                        communitiesAddedUpdated: cachedState.communities.map((c) =>
                            this.hydrateCommunity(c),
                        ),
                        communitiesRemoved: [],
                        updatedEvents: new Map(),
                        suspensionChanged: undefined,
                        newAchievements: [],
                        avatarId:
                            cachedState.avatarId !== undefined
                                ? { value: cachedState.avatarId }
                                : undefined,
                        pinNumberSettings:
                            cachedState.pinNumberSettings !== undefined
                                ? { value: cachedState.pinNumberSettings }
                                : undefined,
                        streakInsurance:
                            cachedState.streakInsurance !== undefined
                                ? { value: cachedState.streakInsurance }
                                : undefined,
                    },
                    isOffline,
                );
            }
            if (!isOffline) {
                try {
                    const updates = await this._getUpdates(cachedState);
                    resolve(updates, true);
                } catch (err) {
                    reject(err);
                }
            }
        });
    }

    private removeExpiredLatestMessages(
        chats: { latestMessage?: EventWrapper<Message>; latestMessageIndex: number | undefined }[],
        now: number,
    ) {
        for (const chat of chats) {
            if (
                chat.latestMessage?.event.messageIndex !== chat.latestMessageIndex ||
                (chat.latestMessage?.expiresAt !== undefined && chat.latestMessage.expiresAt < now)
            ) {
                chat.latestMessage = undefined;
            }
        }
    }

    async getCommunitySummary(communityId: string): Promise<CommunitySummaryResponse> {
        const resp = await this.communityClient(communityId).summary();
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
        return this._userIndexClient.getCurrentUser();
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

    changeRole(
        chatId: MultiUserChatIdentifier,
        userId: string,
        newRole: MemberRole,
    ): Promise<ChangeRoleResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).changeRole(userId, newRole);
            case "channel":
                return this.communityClient(chatId.communityId).changeChannelRole(
                    chatId,
                    userId,
                    newRole,
                );
        }
    }

    deleteGroup(chatId: MultiUserChatIdentifier): Promise<DeleteGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.userClient.deleteGroup(chatId.groupId);
            case "channel":
                return this.communityClient(chatId.communityId).deleteChannel(chatId);
        }
    }

    removeMember(chatId: MultiUserChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).removeMember(userId);
            case "channel":
                return this.communityClient(chatId.communityId).removeMemberFromChannel(
                    chatId,
                    userId,
                );
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
        return this.getGroupClient(chatId.groupId).blockUser(userId);
    }

    unblockUserFromGroupChat(
        chatId: MultiUserChatIdentifier,
        userId: string,
    ): Promise<UnblockUserResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        if (chatId.kind === "channel")
            throw new Error("TODO - unblockUserFromChannel not implemented");
        return this.getGroupClient(chatId.groupId).unblockUser(userId);
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
                return this.communityClient(chatId.communityId).leaveChannel(chatId);
        }
    }

    async joinGroup(
        chatId: MultiUserChatIdentifier,
        credentialArgs: VerifiedCredentialArgs | undefined,
    ): Promise<JoinGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat": {
                const localUserIndex = await this.getGroupClient(chatId.groupId).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                const groupInviteCode = this.getProvidedGroupInviteCode(chatId);
                return localUserIndexClient
                    .joinGroup(chatId.groupId, groupInviteCode, credentialArgs)
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
                const localUserIndex = await this.communityClient(
                    chatId.communityId,
                ).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                const communityInviteCode = this.getProvidedCommunityInviteCode(chatId.communityId);
                const referredBy = await this.getCommunityReferral(chatId.communityId);
                return localUserIndexClient
                    .joinChannel(chatId, communityInviteCode, credentialArgs, referredBy)
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
    ): Promise<JoinCommunityResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        const inviteCode = this.getProvidedCommunityInviteCode(id.communityId);
        const localUserIndex = await this.communityClient(id.communityId).localUserIndex();
        const referredBy = await this.getCommunityReferral(id.communityId);
        return this.getLocalUserIndexClient(localUserIndex)
            .joinCommunity(id.communityId, inviteCode, credentialArgs, referredBy)
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
                return this.getGroupClient(chatId.groupId).addReaction(
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
                return this.communityClient(chatId.communityId).addReaction(
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
                return this.getGroupClient(chatId.groupId).removeReaction(
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
                return this.communityClient(chatId.communityId).removeReaction(
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

        return this.communityClient(chatId.communityId).deleteMessages(
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

        return this.getGroupClient(chatId).deleteMessage(
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

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).undeleteMessage(
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
                return this.communityClient(chatId.communityId).undeleteMessage(
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

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this._notificationClient.subscriptionExists(p256dh_key);
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this._notificationClient.pushSubscription(subscription);
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this._notificationClient.removeSubscription(subscription);
    }

    fcmTokenExists(fcmToken: string): Promise<boolean> {
        return this._notificationClient.fcmTokenExists(fcmToken);
    }

    addFcmToken(fcmToken: string, onResponseError?: (error: string | null) => void): Promise<void> {
        return this._notificationClient.addFcmToken(fcmToken, onResponseError);
    }

    toggleMuteNotifications(
        id: ChatIdentifier | CommunityIdentifier,
        muted: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "group_chat":
                return this.getGroupClient(id.groupId).toggleMuteNotifications(muted);
            case "direct_chat":
                return this.userClient.toggleMuteNotifications(id.userId, muted);
            case "channel":
                return this.communityClient(id.communityId).toggleMuteChannelNotifications(
                    id,
                    muted,
                );
            case "community":
                return this.communityClient(id.communityId).toggleMuteChannelNotifications(
                    undefined,
                    muted,
                );
        }
    }

    getGroupDetails(
        chatId: MultiUserChatIdentifier,
        chatLastUpdated: bigint,
    ): Promise<GroupChatDetailsResponse> {
        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).getGroupDetails(chatLastUpdated);
            case "channel":
                return this.communityClient(chatId.communityId).getChannelDetails(
                    chatId,
                    chatLastUpdated,
                );
        }
    }

    getPublicGroupSummary(chatId: GroupChatIdentifier): Promise<PublicGroupSummaryResponse> {
        return this.getGroupClient(chatId.groupId)
            .getPublicSummary()
            .then((resp) => {
                if (resp.kind === "success") {
                    return {
                        kind: "success",
                        group: this.rehydrateDataContent(resp.group, "avatar"),
                    } as PublicGroupSummaryResponse;
                }
                return resp;
            })
            .catch((err) => {
                if (err instanceof DestinationInvalidError) {
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

        const userClient = userId
            ? new UserClient(userId, this.identity, this._agent, this.config, this.db)
            : this.userClient;
        return userClient.getBio();
    }

    getPublicProfile(userId?: string): Stream<PublicProfile | undefined> {
        if (userId) {
            return new Stream(async (resolve, reject) => {
                const deleted = await isUserIdDeleted(userId);
                if (deleted) {
                    resolve(undefined, true);
                }
                const userClient = new UserClient(
                    userId,
                    this.identity,
                    this._agent,
                    this.config,
                    this.db,
                );
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
            return this.userClient.getPublicProfile();
        }
    }

    setBio(bio: string): Promise<SetBioResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.setBio(bio);
    }

    async registerUser(
        username: string,
        referralCode: string | undefined,
    ): Promise<RegisterUserResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        const localUserIndex = await this._userIndexClient.userRegistrationCanister();
        return this.getLocalUserIndexClient(localUserIndex).registerUser(username, referralCode);
    }

    getUserStorageLimits(): Promise<StorageStatus> {
        return this._dataClient.storageStatus();
    }

    refreshAccountBalance(ledger: string, principal: string): Promise<bigint> {
        if (offline()) return Promise.resolve(0n);

        return this.getLedgerClient(ledger).accountBalance(principal);
    }

    getAccountTransactions(
        ledgerIndex: string,
        principal: string,
        fromId?: bigint,
    ): Promise<AccountTransactionResult> {
        const isNns = this._registryValue?.nervousSystemSummary.some(
            (ns) => ns.isNns && ns.indexCanisterId === ledgerIndex,
        );

        if (isNns) {
            return new IcpLedgerIndexClient(
                this.identity,
                this._agent,
                ledgerIndex,
            ).getAccountTransactions(principal, fromId);
        }
        return this.getLedgerIndexClient(ledgerIndex).getAccountTransactions(principal, fromId);
    }

    getGroupMessagesByMessageIndex(
        chatId: MultiUserChatIdentifier,
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        switch (chatId.kind) {
            case "group_chat":
                return this.rehydrateEventResponse(
                    chatId,
                    this.getGroupClient(chatId.groupId).getMessagesByMessageIndex(
                        messageIndexes,
                        latestKnownUpdate,
                    ),
                    undefined,
                    latestKnownUpdate,
                );
            case "channel":
                return this.rehydrateEventResponse(
                    chatId,
                    this.communityClient(chatId.communityId).getMessagesByMessageIndex(
                        chatId,
                        messageIndexes,
                        latestKnownUpdate,
                    ),
                    undefined,
                    latestKnownUpdate,
                );
        }
    }

    pinMessage(chatId: MultiUserChatIdentifier, messageIndex: number): Promise<PinMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).pinMessage(messageIndex);
            case "channel":
                return this.communityClient(chatId.communityId).pinMessage(chatId, messageIndex);
        }
    }

    unpinMessage(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
    ): Promise<UnpinMessageResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).unpinMessage(messageIndex);
            case "channel":
                return this.communityClient(chatId.communityId).unpinMessage(chatId, messageIndex);
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
                return this.getGroupClient(chatId.groupId).registerPollVote(
                    messageIdx,
                    answerIdx,
                    voteType,
                    threadRootMessageIndex,
                    newAchievement,
                );
            case "channel":
                return this.communityClient(chatId.communityId).registerPollVote(
                    chatId,
                    messageIdx,
                    answerIdx,
                    voteType,
                    threadRootMessageIndex,
                    newAchievement,
                );
        }
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
        pin: string | undefined,
    ): Promise<WithdrawCryptocurrencyResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.userClient.withdrawCryptocurrency(domain, pin);
    }

    getInviteCode(id: GroupChatIdentifier | CommunityIdentifier): Promise<InviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).getInviteCode();
            case "group_chat":
                return this.getGroupClient(id.groupId).getInviteCode();
        }
    }

    enableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<EnableInviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).enableInviteCode();
            case "group_chat":
                return this.getGroupClient(id.groupId).enableInviteCode();
        }
    }

    disableInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<DisableInviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).disableInviteCode();
            case "group_chat":
                return this.getGroupClient(id.groupId).disableInviteCode();
        }
    }

    resetInviteCode(
        id: GroupChatIdentifier | CommunityIdentifier,
    ): Promise<ResetInviteCodeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).resetInviteCode();
            case "group_chat":
                return this.getGroupClient(id.groupId).resetInviteCode();
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

    registerProposalVote(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).registerProposalVote(
                    messageIndex,
                    adopt,
                );
            case "channel":
                return this.communityClient(chatId.communityId).registerProposalVote(
                    chatId.channelId,
                    messageIndex,
                    adopt,
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
                            return this.getGroupClient(chatId.groupId)
                                .threadPreviews(
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
                            return this.communityClient(chatId.communityId)
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
                thread.rootMessage.event.messageIndex,
            ),
        );
        const rootMessage = this.rehydrateEvent(
            thread.rootMessage,
            thread.chatId,
            rootMissing,
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
        return setCachedMessageIfNotExists(this.db, chatId, message, threadRootMessageIndex);
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
                userSuspended(userId, true);
            }
            return resp;
        });
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.unsuspendUser(userId).then((resp) => {
            if (resp === "success") {
                userSuspended(userId, false);
            }
            return resp;
        });
    }

    loadFailedMessages(): Promise<Map<string, Record<number, EventWrapper<Message>>>> {
        return loadFailedMessages(this.db).then(
            (messages) => messages.toMap() as Map<string, Record<number, EventWrapper<Message>>>,
        );
    }

    deleteFailedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        return removeFailedMessage(this.db, chatId, messageId, threadRootMessageIndex);
    }

    claimPrize(chatId: MultiUserChatIdentifier, messageId: bigint): Promise<ClaimPrizeResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).claimPrize(messageId);
            case "channel":
                return this.communityClient(chatId.communityId).claimPrize(
                    chatId.channelId,
                    messageId,
                );
        }
    }

    payForDiamondMembership(
        userId: string,
        ledger: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
    ): Promise<PayForDiamondMembershipResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._userIndexClient.payForDiamondMembership(
            userId,
            ledger,
            duration,
            recurring,
            expectedPriceE8s,
        );
    }

    setCommunityModerationFlags(
        communityId: string,
        flags: number,
    ): Promise<SetCommunityModerationFlagsResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._groupIndexClient.setCommunityModerationFlags(communityId, flags);
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
                return this.getGroupClient(chatId.groupId).declineInvitation();
            case "channel":
                return this.communityClient(chatId.communityId).declineInvitation(chatId);
        }
    }

    convertGroupToCommunity(
        chatId: GroupChatIdentifier,
        historyVisible: boolean,
        rules: Rules,
    ): Promise<ConvertToCommunityResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.getGroupClient(chatId.groupId).convertToCommunity(historyVisible, rules);
    }

    getRegistry(): Stream<[RegistryValue, boolean]> {
        return new Stream(async (resolve, reject) => {
            const current = await getCachedRegistry();
            const isOffline = offline();
            if (current !== undefined) {
                this._registryValue = current;
                resolve([current, false], isOffline);
            }

            if (!isOffline) {
                try {
                    const updates = await this._registryClient.updates(current?.lastUpdated);
                    if (updates.kind === "success") {
                        const updated = {
                            lastUpdated: updates.lastUpdated,
                            tokenDetails: distinctBy(
                                [...updates.tokenDetails, ...(current?.tokenDetails ?? [])],
                                (t) => t.ledger,
                            ),
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
                        setCachedRegistry(updated);
                        this._registryValue = updated;
                        this._dexesAgent.get().updateTokenDetails(updated.tokenDetails);
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

        return this.communityClient(communityId).createUserGroup(name, userIds);
    }

    updateUserGroup(
        communityId: string,
        userGroupId: number,
        name: string | undefined,
        usersToAdd: string[],
        usersToRemove: string[],
    ): Promise<UpdateUserGroupResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.communityClient(communityId).updateUserGroup(
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

        return this.communityClient(communityId).setMemberDisplayName(display_name, newAchievement);
    }

    deleteUserGroups(
        communityId: string,
        userGroupIds: number[],
    ): Promise<DeleteUserGroupsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.communityClient(communityId).deleteUserGroups(userGroupIds);
    }

    followThread(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        follow: boolean,
        newAchievement: boolean,
    ): Promise<FollowThreadResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        if (chatId.kind === "channel") {
            return this.communityClient(chatId.communityId).followThread(
                chatId.channelId,
                threadRootMessageIndex,
                follow,
                newAchievement,
            );
        } else if (chatId.kind === "group_chat") {
            return this.getGroupClient(chatId.groupId).followThread(
                threadRootMessageIndex,
                follow,
                newAchievement,
            );
        } else {
            throw new Error("followThread not implemented for direct chats");
        }
    }

    submitProposal(
        currentUserId: string,
        governanceCanisterId: string,
        proposal: CandidateProposal,
        ledger: string,
        token: string,
        proposalRejectionFee: bigint,
        transactionFee: bigint,
    ): Promise<SubmitProposalResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._proposalsBotClient
            .get()
            .submitProposal(
                currentUserId,
                governanceCanisterId,
                proposal,
                ledger,
                token,
                proposalRejectionFee,
                transactionFee,
            );
    }

    reportMessage(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        if (offline()) return Promise.resolve(false);

        if (chatId.kind === "channel") {
            return this.communityClient(chatId.communityId).reportMessage(
                chatId.channelId,
                threadRootMessageIndex,
                messageId,
                deleteMessage,
            );
        } else if (chatId.kind === "group_chat") {
            return this.getGroupClient(chatId.groupId).reportMessage(
                threadRootMessageIndex,
                messageId,
                deleteMessage,
            );
        } else {
            return this.userClient.reportMessage(
                chatId,
                threadRootMessageIndex,
                messageId,
                deleteMessage,
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

                const exchangeArgs: ExchangeTokenSwapArgs = {
                    dex,
                    swapCanisterId: pool.canisterId,
                    zeroForOne: pool.token0 === inputTokenDetails.ledger,
                };

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

    tokenSwapStatus(swapId: bigint): Promise<TokenSwapStatusResponse> {
        return this.userClient.tokenSwapStatus(swapId);
    }

    private swapProviders(): DexId[] {
        return this._registryValue?.swapProviders ?? [];
    }

    approveTransfer(
        spender: string,
        ledger: string,
        amount: bigint,
        expiresIn: bigint | undefined,
        pin: string | undefined,
    ): Promise<ApproveTransferResponse> {
        return this.userClient.approveTransfer(spender, ledger, amount, expiresIn, pin);
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

        if (supportedTokens === undefined || !isMainnet(this.config.icUrl)) {
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

    acceptP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
    ): Promise<AcceptP2PSwapResponse> {
        if (chatId.kind === "channel") {
            return this.communityClient(chatId.communityId).acceptP2PSwap(
                chatId.channelId,
                threadRootMessageIndex,
                messageId,
                pin,
                newAchievement,
            );
        } else if (chatId.kind === "group_chat") {
            return this.getGroupClient(chatId.groupId).acceptP2PSwap(
                threadRootMessageIndex,
                messageId,
                pin,
                newAchievement,
            );
        } else {
            return this.userClient.acceptP2PSwap(
                chatId.userId,
                threadRootMessageIndex,
                messageId,
                pin,
            );
        }
    }

    cancelP2PSwap(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        if (chatId.kind === "channel") {
            return this.communityClient(chatId.communityId).cancelP2PSwap(
                chatId.channelId,
                threadRootMessageIndex,
                messageId,
            );
        } else if (chatId.kind === "group_chat") {
            return this.getGroupClient(chatId.groupId).cancelP2PSwap(
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
                return this.communityClient(chatId.communityId).videoCallParticipants(
                    chatId.channelId,
                    messageId,
                    updatesSince,
                );
            case "group_chat":
                return this.getGroupClient(chatId.groupId).videoCallParticipants(
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
            return this.communityClient(chatId.communityId).joinVideoCall(
                chatId.channelId,
                messageId,
                newAchievement,
            );
        } else if (chatId.kind === "group_chat") {
            return this.getGroupClient(chatId.groupId).joinVideoCall(messageId, newAchievement);
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
                return this.communityClient(chatId.communityId).setVideoCallPresence(
                    chatId.channelId,
                    messageId,
                    presence,
                    newAchievement,
                );
            case "group_chat":
                return this.getGroupClient(chatId.groupId).setVideoCallPresence(
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
        return this.getLocalUserIndexClient(localUserIndex).getAccessToken(accessTokenType);
    }

    async getLocalUserIndexForUser(userId: string): Promise<string> {
        const localUserIndex = await getLocalUserIndexForUser(userId);
        if (localUserIndex !== undefined) {
            return localUserIndex;
        }
        return new UserClient(userId, this.identity, this._agent, this.config, this.db)
            .localUserIndex()
            .then((localUserIndex) => {
                return cacheLocalUserIndexForUser(userId, localUserIndex);
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
            const knownUtxos = await this._ckbtcMinterClient.get().getKnownUtxos(userId);
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
            .forwardEvmToIcp(tokenSymbol, chain, address, receiver);
    }

    oneSecGetForwardingStatus(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        receiver: string,
    ): Promise<OneSecForwardingStatus> {
        return this._oneSecMinterClient
            .get()
            .getForwardingStatus(tokenSymbol, chain, address, receiver);
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
        const cachedState = await getCachedChats(this.db, this.principal);
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
                return this.getGroupClient(id.groupId).cancelInvites(userIds);
            case "channel":
                return this.communityClient(id.communityId).cancelInvites(id.channelId, userIds);
            case "community":
                return this.communityClient(id.communityId).cancelInvites(undefined, userIds);
        }
    }

    async clearCachedData(): Promise<void> {
        await Promise.all([
            clearCache(this.principal.toString()),
            clearUserCache(),
            clearReferralCache(),
        ]);
    }

    async getExternalAchievements(): Promise<ExternalAchievement[]> {
        const cached = await getCachedExternalAchievements();
        const updates = await this._userIndexClient.getExternalAchievements(
            cached?.lastUpdated ?? 0n,
        );

        if (updates.kind === "success") {
            const merged = this.mergeExternalAchievements(cached, updates);
            setCachedExternalAchievements(merged.lastUpdated, merged.achievements);
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
            const cachedEvents = await getActivityFeedEvents();

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

            setActivityFeedEvents(sorted.slice(0, MAX_ACTIVITY_EVENTS));

            this.hydrateActivityFeedEvents(sorted, (hydrated, final) =>
                resolve({ total: server.total, events: hydrated }, final),
            );
        });
    }

    /**
     * Hydration is a two phase process. First we load all the messages that we have in the cache
     * and resolve. Secondly we then optionally load any missing messages from the backend and
     * resolve again.
     */
    async hydrateActivityFeedEvents(
        activityEvents: MessageActivityEvent[],
        callback: (events: MessageActivityEvent[], final: boolean) => void,
    ) {
        const eventIndexesByMessageContext = activityEvents.reduce((map, event) => {
            const eventIndexes = map.get(event.messageContext) ?? [];
            eventIndexes.push(event.eventIndex);
            map.set(event.messageContext, eventIndexes);
            return map;
        }, new AsyncMessageContextMap<number>());

        const [withCachedMessages, missing] = await this.getMessagesByMessageContext(
            eventIndexesByMessageContext,
            activityEvents,
            "cached",
        );

        const anyMissing = [...missing.values()].some((s) => s.size > 0);
        callback(withCachedMessages, !anyMissing);

        if (anyMissing) {
            this.getMessagesByMessageContext(
                new AsyncMessageContextMap(
                    missing.map((_, v) => [...v]).toMap() as Map<string, number[]>,
                ),
                withCachedMessages,
                "missing",
            ).then(([withServerMessages]) => callback(withServerMessages, true));
        }
    }

    async getMessagesByMessageContext(
        eventIndexesByMessageContext: AsyncMessageContextMap<number>,
        activityEvents: MessageActivityEvent[],
        mode: "cached" | "missing",
    ): Promise<[MessageActivityEvent[], MessageContextMap<Set<number>>]> {
        const allMissing = new MessageContextMap<Set<number>>();

        const messagesByMessageContext = await eventIndexesByMessageContext.asyncMap(
            (ctx, idxs) => {
                const chatId = ctx.chatId;
                const chatKind = chatId.kind;

                function addMissing(context: MessageContext, missing: Set<number>) {
                    if (missing.size > 0) {
                        const current = allMissing.get(context) ?? new Set<number>();
                        missing.forEach((n) => current.add(n));
                        allMissing.set(context, current);
                    }
                }

                if (chatKind === "direct_chat") {
                    switch (mode) {
                        case "cached":
                            return this.userClient
                                .getCachedEventsByIndex(idxs, chatId, ctx.threadRootMessageIndex)
                                .then(([resp, missing]) => {
                                    addMissing(ctx, missing);
                                    return this.messagesFromEventsResponse(ctx, resp);
                                });
                        case "missing":
                            return this.userClient
                                .chatEventsByIndex(
                                    // getMissing(ctx),
                                    idxs,
                                    chatId,
                                    ctx.threadRootMessageIndex,
                                    undefined,
                                )
                                .then((resp) => this.messagesFromEventsResponse(ctx, resp));
                    }
                } else if (chatKind === "group_chat") {
                    const client = this.getGroupClient(chatId.groupId);
                    switch (mode) {
                        case "cached":
                            return client
                                .getCachedEventsByIndex(idxs, ctx.threadRootMessageIndex)
                                .then(([resp, missing]) => {
                                    addMissing(ctx, missing);
                                    return this.messagesFromEventsResponse(ctx, resp);
                                });
                        case "missing":
                            return client
                                .chatEventsByIndex(
                                    // getMissing(ctx),
                                    idxs,
                                    ctx.threadRootMessageIndex,
                                    undefined,
                                )
                                .then((resp) => this.messagesFromEventsResponse(ctx, resp));
                    }
                } else if (chatKind === "channel") {
                    const client = this.communityClient(chatId.communityId);
                    switch (mode) {
                        case "cached":
                            return client
                                .getCachedEventsByIndex(chatId, idxs, ctx.threadRootMessageIndex)
                                .then(([resp, missing]) => {
                                    addMissing(ctx, missing);
                                    return this.messagesFromEventsResponse(ctx, resp);
                                });
                        case "missing":
                            return client
                                .eventsByIndex(chatId, idxs, ctx.threadRootMessageIndex, undefined)
                                .then((resp) => this.messagesFromEventsResponse(ctx, resp));
                    }
                } else {
                    throw new UnsupportedValueError("unknown chatid kind supplied", chatId);
                }
            },
        );

        const lookup = [...messagesByMessageContext.values()].reduce((lookup, events) => {
            events.forEach((ev) => lookup.set(ev.event.messageId, ev.event));
            return lookup;
        }, new MessageMap<Message>());

        return [
            activityEvents.map((ev) => ({
                ...ev,
                message: ev.message ?? lookup.get(ev.messageId),
            })),
            allMissing,
        ];
    }

    getChannelSummary(channelId: ChannelIdentifier): Promise<ChannelSummaryResponse> {
        return this.communityClient(channelId.communityId)
            .channelSummary(channelId)
            .then((resp) => {
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
                return this.communityClient(id.communityId).localUserIndex();
            case "group_chat":
                return this.getGroupClient(id.groupId).localUserIndex();
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
        return this.getLocalUserIndexClient(localUserIndex).installBot(
            id,
            botId,
            grantedPermissions,
        );
    }

    updateInstalledBot(
        id: BotInstallationLocation,
        botId: string,
        grantedPermissions: GrantedBotPermissions,
    ): Promise<boolean> {
        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).updateInstalledBot(
                    botId,
                    grantedPermissions,
                );
            case "group_chat":
                return this.getGroupClient(id.groupId).updateInstalledBot(
                    botId,
                    grantedPermissions,
                );
            case "direct_chat":
                return this.userClient.updateInstalledBot(botId, grantedPermissions);
        }
    }

    async uninstallBot(id: BotInstallationLocation, botId: string): Promise<boolean> {
        const localUserIndex = await this.#localUserIndexForBotContext(id);
        return this.getLocalUserIndexClient(localUserIndex).uninstallBot(id, botId);
    }

    getBots(initialLoad: boolean): Stream<BotsResponse> {
        return new Stream(async (resolve, reject) => {
            const cachedBots = await getCachedBots(this.db, this.principal);
            const isOffline = offline();
            if (cachedBots && initialLoad) {
                resolve(cachedBots, isOffline);
            }
            if (!isOffline) {
                try {
                    const updates = await this._userIndexClient.getBots(cachedBots);
                    setCachedBots(this.db, this.principal, updates);
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
        return this.getLocalUserIndexClient(localUserIndex).withdrawFromIcpSwap(
            userId,
            swapId,
            inputToken,
            amount,
            fee,
        );
    }

    payForStreakInsurance(
        additionalDays: number,
        expectedPrice: bigint,
        pin: string | undefined,
    ): Promise<PayForStreakInsuranceResponse> {
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
                return this.communityClient(chatId.communityId).registerWebhook(
                    chatId.channelId,
                    name,
                    avatar,
                );
            case "group_chat":
                return this.getGroupClient(chatId.groupId).registerWebhook(name, avatar);
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
                return this.communityClient(chatId.communityId).updateWebhook(
                    chatId.channelId,
                    id,
                    name,
                    avatar,
                );
            case "group_chat":
                return this.getGroupClient(chatId.groupId).updateWebhook(id, name, avatar);
        }
    }

    regenerateWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<string | undefined> {
        switch (chatId.kind) {
            case "channel":
                return this.communityClient(chatId.communityId).regenerateWebhook(
                    chatId.channelId,
                    id,
                );
            case "group_chat":
                return this.getGroupClient(chatId.groupId).regenerateWebhook(id);
        }
    }

    deleteWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<boolean> {
        switch (chatId.kind) {
            case "channel":
                return this.communityClient(chatId.communityId).deleteWebhook(chatId.channelId, id);
            case "group_chat":
                return this.getGroupClient(chatId.groupId).deleteWebhook(id);
        }
    }

    getWebhook(chatId: MultiUserChatIdentifier, id: string): Promise<string | undefined> {
        switch (chatId.kind) {
            case "channel":
                return this.communityClient(chatId.communityId).getWebhook(chatId.channelId, id);
            case "group_chat":
                return this.getGroupClient(chatId.groupId).getWebhook(id);
        }
    }

    async updateProposalTallies(chatId: MultiUserChatIdentifier): Promise<EventWrapper<Message>[]> {
        const response = await (chatId.kind === "channel"
            ? this.communityClient(chatId.communityId).activeProposalTallies(chatId.channelId)
            : this.getGroupClient(chatId.groupId).activeProposalTallies());

        if (isError(response) || response.length === 0) {
            return [];
        }

        return await updateCachedProposalTallies(this.db, chatId, response);
    }

    async #updateCachedProposalTallies(localUserIndex: string, chatIds: MultiUserChatIdentifier[]) {
        const response = await this.getLocalUserIndexClient(localUserIndex).activeProposalTallies(
            chatIds,
        );

        for (const [chatId, tallies] of response) {
            await updateCachedProposalTallies(this.db, chatId, tallies);
        }
    }

    async payForPremiumItem(userId: string, item: PremiumItem): Promise<PayForPremiumItemResponse> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this.getLocalUserIndexClient(localUserIndex).payForPremiumItem(item);
    }

    async setPremiumItemCost(item: PremiumItem, chitCost: number): Promise<void> {
        return this._userIndexClient.setPremiumItemCost(item, chitCost);
    }

    async reinstateMissedDailyClaims(userId: string, days: number[]): Promise<boolean> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this.getLocalUserIndexClient(localUserIndex).reinstateMissedDailyClaims(
            userId,
            days,
        );
    }
}

export interface ExchangeRateClient {
    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates>>;
}
