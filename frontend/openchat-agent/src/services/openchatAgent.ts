/* eslint-disable no-case-declarations */
import { HttpAgent, type Identity } from "@dfinity/agent";
import {
    type Database,
    getCachedChats,
    getCachePrimerTimestamps,
    initDb,
    loadFailedMessages,
    removeFailedMessage,
    setCachedChats,
    setCachedMessageIfNotExists,
    recordFailedMessage,
    cacheLocalUserIndexForUser,
    getLocalUserIndexForUser,
    clearCache,
    getCachedExternalAchievements,
    setCachedExternalAchievements,
    getActivityFeedEvents,
    setActivityFeedEvents,
    getCachedBots,
    setCachedBots,
} from "../utils/caching";
import { isMainnet } from "../utils/network";
import { getAllUsers, clearCache as clearUserCache, isUserIdDeleted } from "../utils/userCache";
import { getCachedRegistry, setCachedRegistry } from "../utils/registryCache";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";
import { LocalUserIndexClient } from "./localUserIndex/localUserIndex.client";
import { NotificationsClient } from "./notifications/notifications.client";
import { ProposalsBotClient } from "./proposalsBot/proposalsBot.client";
import { OnlineClient } from "./online/online.client";
import { DataClient } from "./data/data.client";
import { LedgerClient } from "./ledger/ledger.client";
import { LedgerIndexClient } from "./ledgerIndex/ledgerIndex.client";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import { MarketMakerClient } from "./marketMaker/marketMaker.client";
import { RegistryClient } from "./registry/registry.client";
import { DexesAgent } from "./dexes";
import { chunk, distinctBy, toRecord, toRecord2 } from "../utils/list";
import { measure } from "./common/profiling";
import {
    buildBlobUrl,
    buildUserAvatarUrl,
    getUpdatedEvents,
    mergeDirectChatUpdates,
    mergeGroupChats,
    mergeGroupChatUpdates,
} from "../utils/chat";
import { NnsGovernanceClient } from "./nnsGovernance/nns.governance.client";
import { SnsGovernanceClient } from "./snsGovernance/sns.governance.client";
import type { AgentConfig } from "../config";
import type {
    Logger,
    AddRemoveReactionResponse,
    ArchiveChatResponse,
    BlobReference,
    BlockUserResponse,
    CandidateGroupChat,
    ChangeRoleResponse,
    ChatEvent,
    CheckUsernameResponse,
    CreatedUser,
    CreateGroupResponse,
    CurrentUserResponse,
    DataContent,
    DeleteFrozenGroupResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DexId,
    DiamondMembershipFees,
    DirectChatSummary,
    DirectChatSummaryUpdates,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventWrapper,
    ExchangeTokenSwapArgs,
    GroupChatDetailsResponse,
    GroupChatSummary,
    GroupInvite,
    Rules,
    IndexRange,
    InviteCodeResponse,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListNervousSystemFunctionsResponse,
    MarkReadRequest,
    MarkReadResponse,
    MemberRole,
    Message,
    MessageContent,
    OptionUpdate,
    PendingCryptocurrencyWithdrawal,
    PinChatResponse,
    PinMessageResponse,
    PublicProfile,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RegisterUserResponse,
    RemoveMemberResponse,
    ResetInviteCodeResponse,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    SendMessageResponse,
    SetBioResponse,
    SetUsernameResponse,
    StakeNeuronForSubmittingProposalsResponse,
    StorageStatus,
    SuspendUserResponse,
    SwapTokensResponse,
    ThreadPreview,
    ThreadPreviewsResponse,
    ThreadSyncDetails,
    TokenSwapStatusResponse,
    ToggleMuteNotificationResponse,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnpinChatResponse,
    UnpinMessageResponse,
    UpdateGroupResponse,
    User,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
    UserCanisterCommunitySummary,
    UserCanisterCommunitySummaryUpdates,
    UserLookup,
    UsersArgs,
    UsersResponse,
    UserSummary,
    WithdrawCryptocurrencyResponse,
    FreezeGroupResponse,
    UnfreezeGroupResponse,
    UnsuspendUserResponse,
    ChatStateFull,
    ChatSummary,
    UpdatesResult,
    DeletedGroupMessageResponse,
    DeletedDirectMessageResponse,
    ClaimPrizeResponse,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    SetCommunityModerationFlagsResponse,
    SetGroupUpgradeConcurrencyResponse,
    SetUserUpgradeConcurrencyResponse,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
    ProposalVoteDetails,
    SetMessageReminderResponse,
    DeclineInvitationResponse,
    JoinCommunityResponse,
    GroupSearchResponse,
    ChatIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
    MessageContext,
    CommunitySummary,
    ExploreCommunitiesResponse,
    ChannelIdentifier,
    MultiUserChatIdentifier,
    CommunityIdentifier,
    CommunitySummaryResponse,
    UpdatesSuccessResponse,
    ConvertToCommunityResponse,
    ExploreChannelsResponse,
    CommunityInvite,
    RegistryValue,
    PublicGroupSummaryResponse,
    SetDisplayNameResponse,
    CreateUserGroupResponse,
    UpdateUserGroupResponse,
    DeleteUserGroupsResponse,
    SetMemberDisplayNameResponse,
    UpdatedRules,
    FollowThreadResponse,
    CandidateProposal,
    SubmitProposalResponse,
    AccountTransactionResult,
    OptionalChatPermissions,
    CryptocurrencyDetails,
    ApproveTransferResponse,
    TokenSwapPool,
    TokenExchangeRates,
    GroupAndCommunitySummaryUpdatesArgs,
    GroupAndCommunitySummaryUpdatesResponse,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    CommunityCanisterCommunitySummaryUpdates,
    AcceptP2PSwapResponse,
    CancelP2PSwapResponse,
    ChatEventsArgs,
    ChatEventsResponse,
    JoinVideoCallResponse,
    AccessTokenType,
    UpdateBtcBalanceResponse,
    GenerateMagicLinkResponse,
    GetDelegationResponse,
    PrepareDelegationResponse,
    SiwePrepareLoginResponse,
    SiwsPrepareLoginResponse,
    VideoCallPresence,
    SetVideoCallPresenceResponse,
    VideoCallParticipantsResponse,
    AcceptedRules,
    VerifiedCredentialArgs,
    ChitEventsRequest,
    ChitEventsResponse,
    ChitEarned,
    ChitState,
    SubmitProofOfUniquePersonhoodResponse,
    TopUpNeuronResponse,
    Referral,
    WalletConfig,
    ExternalAchievement,
    ExternalAchievementsSuccess,
    ChitLeaderboardResponse,
    AccessGateConfig,
    Verification,
    MessageActivitySummary,
    MessageActivityFeedResponse,
    MessageActivityEvent,
    FreezeCommunityResponse,
    UnfreezeCommunityResponse,
    ChannelSummaryResponse,
    ExploreBotsResponse,
    ExternalBot,
    SlashCommandPermissions,
    BotsResponse,
    BotDefinition,
} from "openchat-shared";
import {
    UnsupportedValueError,
    ChatMap,
    chatIdentifiersEqual,
    DestinationInvalidError,
    CommonResponses,
    applyOptionUpdate,
    ANON_USER_ID,
    offline,
    Stream,
    getOrAdd,
    waitAll,
    MessageMap,
    MAX_ACTIVITY_EVENTS,
    messageContextToString,
    MessageContextMap,
} from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import { AsyncMessageContextMap } from "../utils/messageContext";
import { CommunityClient } from "./community/community.client";
import {
    isSuccessfulCommunitySummaryResponse,
    mergeCommunities,
    mergeCommunityUpdates,
} from "../utils/community";
import { AnonUserClient } from "./user/anonUser.client";
import { excludeLatestKnownUpdateIfBeforeFix } from "./common/replicaUpToDateChecker";
import { IcpCoinsClient } from "./icpcoins/icpCoinsClient";
import { IcpSwapClient } from "./icpSwap/icpSwapClient";
import { IcpLedgerIndexClient } from "./icpLedgerIndex/icpLedgerIndex.client";
import { TranslationsClient } from "./translations/translations.client";
import { CkbtcMinterClient } from "./ckbtcMinter/ckbtcMinter";
import { SignInWithEmailClient } from "./signInWithEmail/signInWithEmail.client";
import { SignInWithEthereumClient } from "./signInWithEthereum/signInWithEthereum.client";
import { SignInWithSolanaClient } from "./signInWithSolana/signInWithSolana.client";
import type { SetPinNumberResponse } from "openchat-shared";
import type { PinNumberSettings } from "openchat-shared";
import type { ClaimDailyChitResponse } from "openchat-shared";
import { createHttpAgentSync } from "../utils/httpAgent";
import {
    deleteCommunityReferral,
    clearCache as clearReferralCache,
    getCommunityReferral,
} from "../utils/referralCache";
import { mean } from "../utils/maths";

export class OpenChatAgent extends EventTarget {
    private _agent: HttpAgent;
    private _userIndexClient: UserIndexClient;
    private _onlineClient: OnlineClient;
    private _groupIndexClient: GroupIndexClient;
    private _userClient?: UserClient | AnonUserClient;
    private _notificationClient: NotificationsClient;
    private _proposalsBotClient: ProposalsBotClient;
    private _marketMakerClient: MarketMakerClient;
    private _registryClient: RegistryClient;
    private _dataClient: DataClient;
    private _localUserIndexClients: Record<string, LocalUserIndexClient>;
    private _ledgerClients: Record<string, LedgerClient>;
    private _ledgerIndexClients: Record<string, LedgerIndexClient>;
    private _groupClients: Record<string, GroupClient>;
    private _communityClients: Record<string, CommunityClient>;
    private _exchangeRateClients: ExchangeRateClient[];
    private _signInWithEmailClient: SignInWithEmailClient;
    private _signInWithEthereumClient: SignInWithEthereumClient;
    private _signInWithSolanaClient: SignInWithSolanaClient;
    private _dexesAgent: DexesAgent;
    private _groupInvite: GroupInvite | undefined;
    private _communityInvite: CommunityInvite | undefined;
    private _registryValue: RegistryValue | undefined;
    private db: Database;
    private _logger: Logger;
    public translationsClient: TranslationsClient;

    constructor(
        private identity: Identity,
        private config: AgentConfig,
    ) {
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
        this._proposalsBotClient = new ProposalsBotClient(
            identity,
            this._agent,
            config.proposalBotCanister,
        );
        this._marketMakerClient = new MarketMakerClient(
            identity,
            this._agent,
            config.marketMakerCanister,
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
        this.translationsClient = new TranslationsClient(
            identity,
            this._agent,
            config.translationsCanister,
        );
        this._signInWithEmailClient = new SignInWithEmailClient(
            identity,
            this._agent,
            config.signInWithEmailCanister,
        );
        this._signInWithEthereumClient = new SignInWithEthereumClient(
            identity,
            this._agent,
            config.signInWithEthereumCanister,
        );
        this._signInWithSolanaClient = new SignInWithSolanaClient(
            identity,
            this._agent,
            config.signInWithSolanaCanister,
        );
        this._localUserIndexClients = {};
        this._ledgerClients = {};
        this._ledgerIndexClients = {};
        this._groupClients = {};
        this._communityClients = {};
        this._dexesAgent = new DexesAgent(this._agent);
        this._groupInvite = config.groupInvite;
    }

    private get principal(): Principal {
        return this.identity.getPrincipal();
    }

    getAllCachedUsers(): Promise<UserLookup> {
        return measure("getAllUsers", () => getAllUsers()).then((users) => {
            return new Map(users.map((user) => [user.userId, this.rehydrateUserSummary(user)]));
        });
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

    editMessage(
        chatId: ChatIdentifier,
        msg: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        if (offline()) return Promise.resolve("failure");

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
        callerUsername: string,
    ): Promise<boolean> {
        if (!userIds.length) {
            return Promise.resolve(true);
        }

        if (offline()) return Promise.resolve(false);

        switch (id.kind) {
            case "community": {
                const localUserIndex = await this.communityClient(id.communityId).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                return localUserIndexClient.inviteUsersToCommunity(
                    id.communityId,
                    userIds,
                    callerUsername,
                );
            }
            case "group_chat": {
                const localUserIndex = await this.getGroupClient(id.groupId).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                return localUserIndexClient.inviteUsersToGroup(id.groupId, userIds, callerUsername);
            }
            case "channel": {
                const localUserIndex = await this.communityClient(id.communityId).localUserIndex();
                const localUserIndexClient = this.getLocalUserIndexClient(localUserIndex);
                return localUserIndexClient.inviteUsersToChannel(
                    id.communityId,
                    id.channelId,
                    userIds,
                    callerUsername,
                );
            }
        }
    }

    chatEventsBatch(
        localUserIndex: string,
        requests: ChatEventsArgs[],
        cachePrimer: boolean,
    ): Promise<ChatEventsResponse[]> {
        console.debug("CHAT EVENTS: Getting events batch", {
            localUserIndex,
            requests,
        });

        return this.getLocalUserIndexClient(localUserIndex).chatEvents(requests, cachePrimer);
    }

    chatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        latestKnownUpdate = excludeLatestKnownUpdateIfBeforeFix(latestKnownUpdate);

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
        latestKnownUpdate = excludeLatestKnownUpdateIfBeforeFix(latestKnownUpdate);

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
        latestKnownUpdate = excludeLatestKnownUpdateIfBeforeFix(latestKnownUpdate);

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
        if (resp !== "events_failed") {
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

        if (resp === "events_failed") {
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
                blobUrl: `${this.config.blobUrlPattern
                    .replace("{canisterId}", this.config.userIndexCanister)
                    .replace("{blobType}", "avatar")}/${userSummary.userId}/${ref?.blobId}`,
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
        latestKnownUpdate = excludeLatestKnownUpdateIfBeforeFix(latestKnownUpdate);

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

    async getUser(
        chitState: ChitState,
        userId: string,
        allowStale = false,
    ): Promise<UserSummary | undefined> {
        const response = await this.getUsers(
            chitState,
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

    getUsers(chitState: ChitState, users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        return this._userIndexClient.getUsers(chitState, users, allowStale).then((resp) => ({
            ...resp,
            users: resp.users.map((u) => this.rehydrateUserSummary(u)),
        }));
    }

    private getUpdatedPinnedChannels(
        currentPinnedChannels: ChannelIdentifier[],
        userResponse: UpdatesSuccessResponse,
    ): ChannelIdentifier[] {
        const byCommunity = currentPinnedChannels.reduce((map, channel) => {
            const channels = map.get(channel.communityId) ?? [];
            channels.push(channel);
            map.set(channel.communityId, channels);
            return map;
        }, new Map<string, ChannelIdentifier[]>());

        userResponse.communities.added
            .flatMap((c) => c.pinned)
            .forEach((channel) => {
                byCommunity.get(channel.communityId)?.push(channel);
            });

        userResponse.communities.updated.forEach((c) => {
            if (c.pinned !== undefined) {
                if (c.pinned.length === 0) {
                    byCommunity.delete(c.id.communityId);
                } else {
                    byCommunity.set(c.id.communityId, c.pinned);
                }
            }
        });

        return [...byCommunity.values()].flat();
    }

    private async _getUpdates(current: ChatStateFull | undefined): Promise<UpdatesResult> {
        const start = Date.now();
        let numberOfAsyncCalls = 0;

        let directChats: DirectChatSummary[];
        let directChatUpdates: DirectChatSummaryUpdates[] = [];

        let currentGroups: GroupChatSummary[] = [];
        let groupsAdded: UserCanisterGroupChatSummary[] = [];
        let userCanisterGroupUpdates: UserCanisterGroupChatSummaryUpdates[] = [];
        const groupsToCheckForUpdates = new Set<string>();
        const groupsRemoved = new Set<string>();

        let currentCommunities: CommunitySummary[] = [];
        let communitiesAdded: UserCanisterCommunitySummary[] = [];
        let userCanisterCommunityUpdates: UserCanisterCommunitySummaryUpdates[] = [];
        const communitiesToCheckForUpdates = new Set<string>();
        const communitiesRemoved = new Set<string>();

        let avatarId: bigint | undefined;
        let blockedUsers: string[];
        let pinnedGroupChats: GroupChatIdentifier[];
        let pinnedDirectChats: DirectChatIdentifier[];
        let pinnedFavouriteChats: ChatIdentifier[];
        let pinnedChannels: ChannelIdentifier[];
        let favouriteChats: ChatIdentifier[];
        let suspensionChanged = undefined;
        let pinNumberSettings: PinNumberSettings | undefined;
        let userCanisterLocalUserIndex: string;
        let achievements: Set<string>;
        let newAchievements: ChitEarned[];
        let achievementsLastSeen: bigint;
        let chitState: ChitState;
        let referrals: Referral[];
        let walletConfig: WalletConfig;
        let messageActivitySummary: MessageActivitySummary;

        let latestActiveGroupsCheck = BigInt(0);
        let latestUserCanisterUpdates: bigint;
        let anyUpdates = false;

        if (current === undefined) {
            const userResponse = await this.userClient.getInitialState();
            numberOfAsyncCalls++;

            directChats = userResponse.directChats.summaries;
            groupsAdded = userResponse.groupChats.summaries;
            communitiesAdded = userResponse.communities.summaries;

            avatarId = userResponse.avatarId;
            blockedUsers = userResponse.blockedUsers;
            pinnedGroupChats = userResponse.groupChats.pinned;
            pinnedDirectChats = userResponse.directChats.pinned;
            pinnedFavouriteChats = userResponse.favouriteChats.pinned;
            pinnedChannels = userResponse.communities.summaries.flatMap((c) => c.pinned);
            favouriteChats = userResponse.favouriteChats.chats;
            latestUserCanisterUpdates = userResponse.timestamp;
            pinNumberSettings = userResponse.pinNumberSettings;
            userCanisterLocalUserIndex = userResponse.localUserIndex;
            newAchievements = userResponse.achievements ?? [];
            achievements = new Set<string>(
                newAchievements.reduce((all, a) => {
                    if (a.reason.kind === "achievement_unlocked") {
                        all.push(a.reason.type);
                    }
                    if (a.reason.kind === "external_achievement_unlocked") {
                        all.push(a.reason.name);
                    }
                    return all;
                }, [] as string[]),
            );
            achievementsLastSeen = userResponse.achievementsLastSeen;
            chitState = {
                streakEnds: userResponse.streakEnds,
                streak: userResponse.streak,
                chitBalance: userResponse.chitBalance,
                nextDailyChitClaim: userResponse.nextDailyClaim,
                totalChitEarned: userResponse.totalChitEarned,
            };
            referrals = userResponse.referrals;
            walletConfig = userResponse.walletConfig;
            messageActivitySummary = userResponse.messageActivitySummary;
            anyUpdates = true;
        } else {
            directChats = current.directChats;
            currentGroups = current.groupChats;
            currentCommunities = current.communities;
            latestActiveGroupsCheck = current.latestActiveGroupsCheck;

            const userResponse = await this.userClient.getUpdates(
                current.latestUserCanisterUpdates,
            );

            numberOfAsyncCalls++;

            avatarId = current.avatarId;
            blockedUsers = current.blockedUsers;
            pinnedGroupChats = current.pinnedGroupChats;
            pinnedDirectChats = current.pinnedDirectChats;
            pinnedFavouriteChats = current.pinnedFavouriteChats;
            pinnedChannels = current.pinnedChannels;
            favouriteChats = current.favouriteChats;
            latestUserCanisterUpdates = current.latestUserCanisterUpdates;
            pinNumberSettings = current.pinNumberSettings;
            userCanisterLocalUserIndex = current.userCanisterLocalUserIndex;
            achievementsLastSeen = current.achievementsLastSeen;
            achievements = current.achievements;
            newAchievements = [];
            chitState = current.chitState;
            referrals = current.referrals;
            walletConfig = current.walletConfig;
            messageActivitySummary = current.messageActivitySummary;

            if (userResponse.kind === "success") {
                directChats = userResponse.directChats.added.concat(
                    mergeDirectChatUpdates(directChats, userResponse.directChats.updated),
                );
                directChatUpdates = userResponse.directChats.updated;

                groupsAdded = userResponse.groupChats.added;
                userCanisterGroupUpdates = userResponse.groupChats.updated;
                userCanisterGroupUpdates.forEach((g) => groupsToCheckForUpdates.add(g.id.groupId));
                userResponse.groupChats.removed.forEach((g) => groupsRemoved.add(g));

                communitiesAdded = userResponse.communities.added;
                userCanisterCommunityUpdates = userResponse.communities.updated;
                userCanisterCommunityUpdates.forEach((c) =>
                    communitiesToCheckForUpdates.add(c.id.communityId),
                );
                userResponse.communities.removed.forEach((c) => communitiesRemoved.add(c));

                avatarId = applyOptionUpdate(avatarId, userResponse.avatarId);
                blockedUsers = userResponse.blockedUsers ?? blockedUsers;
                pinnedGroupChats = userResponse.groupChats.pinned ?? pinnedGroupChats;
                pinnedDirectChats = userResponse.directChats.pinned ?? pinnedDirectChats;
                pinnedFavouriteChats = userResponse.favouriteChats.pinned ?? pinnedFavouriteChats;
                pinnedChannels = this.getUpdatedPinnedChannels(pinnedChannels, userResponse);
                favouriteChats = userResponse.favouriteChats.chats ?? favouriteChats;
                suspensionChanged = userResponse.suspended;
                latestUserCanisterUpdates = userResponse.timestamp;
                pinNumberSettings = applyOptionUpdate(
                    pinNumberSettings,
                    userResponse.pinNumberSettings,
                );
                achievementsLastSeen = userResponse.achievementsLastSeen ?? achievementsLastSeen;
                newAchievements = userResponse.achievements ?? [];
                newAchievements.forEach((a) => {
                    if (a.reason.kind === "achievement_unlocked") {
                        achievements.add(a.reason.type);
                    }
                    if (a.reason.kind === "external_achievement_unlocked") {
                        achievements.add(a.reason.name);
                    }
                });
                chitState = {
                    streakEnds: userResponse.streakEnds,
                    streak: userResponse.streak,
                    chitBalance: userResponse.chitBalance,
                    nextDailyChitClaim: userResponse.nextDailyClaim,
                    totalChitEarned: userResponse.totalChitEarned,
                };
                referrals = referrals
                    .filter(
                        (prev) =>
                            !userResponse.referrals.find((latest) => latest.userId === prev.userId),
                    )
                    .concat(userResponse.referrals);
                walletConfig = userResponse.walletConfig ?? current.walletConfig;
                messageActivitySummary =
                    userResponse.messageActivitySummary ?? current.messageActivitySummary;
                anyUpdates = true;
            }
        }

        const currentGroupChatIds = currentGroups.map((g) => g.id);
        const currentCommunityIds = currentCommunities.map((c) => c.id);

        if (currentGroupChatIds.length > 0 || currentCommunityIds.length > 0) {
            const groupIndexResponse = await this._groupIndexClient.activeGroups(
                currentCommunityIds,
                currentGroupChatIds,
                latestActiveGroupsCheck,
            );
            numberOfAsyncCalls++;

            groupIndexResponse.activeGroups.forEach((g) => groupsToCheckForUpdates.add(g));
            groupIndexResponse.deletedGroups.forEach((g) => groupsRemoved.add(g.id));

            groupIndexResponse.activeCommunities.forEach((c) =>
                communitiesToCheckForUpdates.add(c),
            );
            groupIndexResponse.deletedCommunities.forEach((c) => groupsRemoved.add(c.id));

            latestActiveGroupsCheck = groupIndexResponse.timestamp;

            // Also check for updates for recently joined groups and communities since it may take a few iterations
            // before the GroupIndex knows that they are active
            const recentlyJoinedCutOff = BigInt(start - 10 * 60 * 1000);

            for (const group of currentGroups) {
                if (group.membership.joined > recentlyJoinedCutOff) {
                    groupsToCheckForUpdates.add(group.id.groupId);
                }
            }

            for (const community of currentCommunities) {
                if (community.membership.joined > recentlyJoinedCutOff) {
                    groupsToCheckForUpdates.add(community.id.communityId);
                }
            }
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
            if (groupsToCheckForUpdates.has(group.id.groupId)) {
                getOrAdd(byLocalUserIndex, group.localUserIndex, []).push({
                    canisterId: group.id.groupId,
                    isCommunity: false,
                    inviteCode: undefined,
                    updatesSince: group.lastUpdated,
                });
            }
        }

        for (const community of currentCommunities) {
            if (communitiesToCheckForUpdates.has(community.id.communityId)) {
                getOrAdd(byLocalUserIndex, community.localUserIndex, []).push({
                    canisterId: community.id.communityId,
                    isCommunity: true,
                    inviteCode: undefined,
                    updatesSince: community.lastUpdated,
                });
            }
        }

        const summaryUpdatesPromises: Promise<GroupAndCommunitySummaryUpdatesResponse[]>[] = [];
        for (const [localUserIndex, args] of byLocalUserIndex) {
            for (const batch of chunk(args, 50)) {
                summaryUpdatesPromises.push(
                    this.getLocalUserIndexClient(localUserIndex).groupAndCommunitySummaryUpdates(
                        batch,
                    ),
                );
                numberOfAsyncCalls++;
            }
        }

        const summaryUpdatesResults = await waitAll(summaryUpdatesPromises);

        for (const error of summaryUpdatesResults.errors) {
            this._logger.error("Summary updates error", error);
        }

        const groupCanisterGroupSummaries: GroupCanisterGroupChatSummary[] = [];
        const communityCanisterCommunitySummaries: CommunitySummary[] = [];
        const groupUpdates: GroupCanisterGroupChatSummaryUpdates[] = [];
        const communityUpdates: CommunityCanisterCommunitySummaryUpdates[] = [];
        let anyErrors = summaryUpdatesResults.errors.length > 0;

        for (const response of summaryUpdatesResults.success) {
            for (const result of response) {
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
                    case "error": {
                        if (!result.error.includes("DestinationInvalid")) {
                            anyErrors = true;
                        }
                        break;
                    }
                }
            }
        }

        if (groupUpdates.length > 0 || communityUpdates.length > 0) {
            anyUpdates = true;
        }

        const groupChats = mergeGroupChats(groupsAdded, groupCanisterGroupSummaries)
            .concat(mergeGroupChatUpdates(currentGroups, userCanisterGroupUpdates, groupUpdates))
            .filter((g) => !groupsRemoved.has(g.id.groupId));

        const communities = mergeCommunities(communitiesAdded, communityCanisterCommunitySummaries)
            .concat(
                mergeCommunityUpdates(
                    currentCommunities,
                    userCanisterCommunityUpdates,
                    communityUpdates,
                ),
            )
            .filter((c) => !communitiesRemoved.has(c.id.communityId));

        this.removeExpiredLatestMessages(directChats, start);
        this.removeExpiredLatestMessages(groupChats, start);
        communities.forEach((c) => this.removeExpiredLatestMessages(c.channels, start));

        const state = {
            latestUserCanisterUpdates,
            latestActiveGroupsCheck,
            directChats,
            groupChats,
            communities,
            avatarId,
            blockedUsers,
            pinnedGroupChats,
            pinnedDirectChats,
            pinnedFavouriteChats,
            pinnedChannels,
            favouriteChats,
            pinNumberSettings,
            userCanisterLocalUserIndex,
            achievementsLastSeen,
            achievements,
            chitState,
            referrals,
            walletConfig,
            messageActivitySummary,
        };

        const updatedEvents = getUpdatedEvents(directChatUpdates, groupUpdates, communityUpdates);

        if (!anyErrors && this.userClient.userId !== ANON_USER_ID) {
            setCachedChats(this.db, this.principal, state, updatedEvents);
        }

        const end = Date.now();
        const duration = end - start;
        console.debug(
            `GetUpdates completed in ${duration}ms. Number of async calls: ${numberOfAsyncCalls}`,
        );

        return {
            state: this.hydrateChatState(state),
            updatedEvents: updatedEvents.toMap(),
            anyUpdates,
            suspensionChanged,
            newAchievements,
        };
    }

    getUpdates(initialLoad: boolean): Stream<UpdatesResult> {
        return new Stream(async (resolve, reject) => {
            const cachedState = await getCachedChats(this.db, this.principal);
            const isOffline = offline();
            if (cachedState && initialLoad) {
                resolve(
                    {
                        state: this.hydrateChatState(cachedState),
                        updatedEvents: new Map(),
                        anyUpdates: false,
                        suspensionChanged: undefined,
                        newAchievements: [],
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

    private hydrateChatState(state: ChatStateFull): ChatStateFull {
        const groupChats = state.groupChats.map((c) => this.hydrateChatSummary(c));
        const communities = state.communities.map((c) => this.hydrateCommunity(c));

        return {
            ...state,
            groupChats,
            communities,
        };
    }

    hydrateCommunity(community: CommunitySummary): CommunitySummary {
        const channels = community.channels.map((c) => this.hydrateChatSummary(c));
        return {
            ...community,
            channels,
            avatar: {
                ...this.rehydrateDataContent(community.avatar, "avatar"),
            },
            banner: {
                ...this.rehydrateDataContent(community.banner, "banner"),
            },
        };
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
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

        switch (chatId.kind) {
            case "group_chat":
                return this.userClient.deleteGroup(chatId.groupId);
            case "channel":
                return this.communityClient(chatId.communityId).deleteChannel(chatId);
        }
    }

    removeMember(chatId: MultiUserChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

        return this.userClient.blockUser(userId);
    }

    blockUserFromGroupChat(
        chatId: MultiUserChatIdentifier,
        userId: string,
    ): Promise<BlockUserResponse> {
        if (offline()) return Promise.resolve("offline");

        if (chatId.kind === "channel")
            throw new Error("TODO - blockUserFromChannel not implemented");
        return this.getGroupClient(chatId.groupId).blockUser(userId);
    }

    unblockUserFromGroupChat(
        chatId: MultiUserChatIdentifier,
        userId: string,
    ): Promise<UnblockUserResponse> {
        if (offline()) return Promise.resolve("offline");

        if (chatId.kind === "channel")
            throw new Error("TODO - unblockUserFromChannel not implemented");
        return this.getGroupClient(chatId.groupId).unblockUser(userId);
    }

    unblockUserFromDirectChat(userId: string): Promise<UnblockUserResponse> {
        if (offline()) return Promise.resolve("offline");

        return this.userClient.unblockUser(userId);
    }

    leaveGroup(chatId: MultiUserChatIdentifier): Promise<LeaveGroupResponse> {
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

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

    markAsOnline(): Promise<void> {
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

    toggleMuteNotifications(
        id: ChatIdentifier | CommunityIdentifier,
        muted: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        if (offline()) return Promise.resolve("offline");

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

    getPublicProfile(userId?: string): Promise<PublicProfile | undefined> {
        if (userId) {
            return isUserIdDeleted(userId).then((deleted) => {
                if (deleted) return undefined;
                const userClient = new UserClient(
                    userId,
                    this.identity,
                    this._agent,
                    this.config,
                    this.db,
                );
                return userClient.getPublicProfile();
            });
        } else {
            return this.userClient.getPublicProfile();
        }
    }

    setBio(bio: string): Promise<SetBioResponse> {
        if (offline()) return Promise.resolve("offline");

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
        const icpLedgerIndex = this._registryValue?.nervousSystemSummary.find((ns) => ns.isNns)
            ?.indexCanisterId;

        if (ledgerIndex === icpLedgerIndex) {
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
        latestKnownUpdate = excludeLatestKnownUpdateIfBeforeFix(latestKnownUpdate);

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
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

        return this.userClient.pinChat(chatId, favourite);
    }

    unpinChat(chatId: ChatIdentifier, favourite: boolean): Promise<UnpinChatResponse> {
        if (offline()) return Promise.resolve("offline");

        return this.userClient.unpinChat(chatId, favourite);
    }

    archiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (offline()) return Promise.resolve("offline");

        return this.userClient.archiveChat(chatId);
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (offline()) return Promise.resolve("offline");

        return this.userClient.unarchiveChat(chatId);
    }

    registerProposalVote(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        if (offline()) return Promise.resolve("offline");

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
            ChatMap.fromMap(threadsByChat)
                .entries()
                .map(([chatId, [threadSyncs, latestKnownUpdate]]) => {
                    latestKnownUpdate = excludeLatestKnownUpdateIfBeforeFix(latestKnownUpdate);

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
                }),
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

        return this._userIndexClient.suspendUser(userId, reason);
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._userIndexClient.unsuspendUser(userId);
    }

    loadFailedMessages(): Promise<Map<string, Record<number, EventWrapper<Message>>>> {
        return loadFailedMessages(this.db).then((messages) => messages.toMap());
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
        token: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
    ): Promise<PayForDiamondMembershipResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._userIndexClient.payForDiamondMembership(
            userId,
            token,
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

        return this._proposalsBotClient.stakeNeuronForSubmittingProposals(
            governanceCanisterId,
            stake,
        );
    }

    topUpNeuronForSubmittingProposals(
        governanceCanisterId: string,
        amount: bigint,
    ): Promise<TopUpNeuronResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._proposalsBotClient.topUpNeuron(governanceCanisterId, amount);
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs,
    ): Promise<UpdateMarketMakerConfigResponse> {
        if (offline()) return Promise.resolve("offline");

        return this._marketMakerClient.updateConfig(config);
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number,
    ): Promise<SetMessageReminderResponse> {
        if (offline()) return Promise.resolve("offline");

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
        if (offline()) return Promise.resolve("offline");

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
                            currentAirdropChannel: updates.currentAirdropChannel,
                        };
                        setCachedRegistry(updated);
                        this._registryValue = updated;
                        this._dexesAgent.updateTokenDetails(updated.tokenDetails);
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
        if (offline()) return Promise.resolve("offline");

        return this.communityClient(communityId).setMemberDisplayName(display_name, newAchievement);
    }

    deleteUserGroups(
        communityId: string,
        userGroupIds: number[],
    ): Promise<DeleteUserGroupsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this.communityClient(communityId).deleteUserGroups(userGroupIds);
    }

    getCachePrimerTimestamps(): Promise<Record<string, bigint>> {
        return getCachePrimerTimestamps(this.db);
    }

    followThread(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        follow: boolean,
        newAchievement: boolean,
    ): Promise<FollowThreadResponse> {
        if (offline()) return Promise.resolve("offline");

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

        return this._proposalsBotClient.submitProposal(
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
        return this._dexesAgent.canSwap(tokenLedgers, this.swapProviders());
    }

    getTokenSwaps(
        inputTokenLedger: string,
        outputTokenLedgers: string[],
    ): Promise<Record<string, DexId[]>> {
        return this._dexesAgent
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
        chatId: ChatIdentifier,
        accessTokenType: AccessTokenType,
        localUserIndex: string,
    ): Promise<string | undefined> {
        return this.getLocalUserIndexClient(localUserIndex).getAccessToken(chatId, accessTokenType);
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

    updateBtcBalance(userId: string): Promise<UpdateBtcBalanceResponse> {
        return new CkbtcMinterClient(this.identity, this._agent).updateBalance(userId);
    }

    generateMagicLink(email: string, sessionKey: Uint8Array): Promise<GenerateMagicLinkResponse> {
        return this._signInWithEmailClient.generateMagicLink(email, sessionKey);
    }

    getSignInWithEmailDelegation(
        email: string,
        sessionKey: Uint8Array,
        expiration: bigint,
    ): Promise<GetDelegationResponse> {
        return this._signInWithEmailClient.getDelegation(email, sessionKey, expiration);
    }

    siwePrepareLogin(address: string): Promise<SiwePrepareLoginResponse> {
        return this._signInWithEthereumClient.prepareLogin(address);
    }

    siwsPrepareLogin(address: string): Promise<SiwsPrepareLoginResponse> {
        return this._signInWithSolanaClient.prepareLogin(address);
    }

    loginWithWallet(
        token: "eth" | "sol",
        address: string,
        signature: string,
        sessionKey: Uint8Array,
    ): Promise<PrepareDelegationResponse> {
        switch (token) {
            case "eth":
                return this._signInWithEthereumClient.login(signature, address, sessionKey);
            case "sol":
                return this._signInWithSolanaClient.login(signature, address, sessionKey);
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
                return this._signInWithEthereumClient.getDelegation(
                    address,
                    sessionKey,
                    expiration,
                );
            case "sol":
                return this._signInWithSolanaClient.getDelegation(address, sessionKey, expiration);
        }
    }

    setPinNumber(
        verification: Verification,
        newPin: string | undefined,
    ): Promise<SetPinNumberResponse> {
        return this.userClient.setPinNumber(verification, newPin);
    }

    claimDailyChit(): Promise<ClaimDailyChitResponse> {
        return this.userClient.claimDailyChit();
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
                new AsyncMessageContextMap(missing.map((_, v) => [...v]).toMap()),
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

    deleteUser(userId: string): Promise<boolean> {
        return this._userIndexClient.deleteUser(userId);
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
    ): Promise<ExploreBotsResponse> {
        if (offline()) return Promise.resolve(CommonResponses.offline());

        return this._userIndexClient.exploreBots(searchTerm, pageIndex, pageSize);
    }

    registerBot(principal: string, bot: ExternalBot): Promise<boolean> {
        if (offline()) return Promise.resolve(false);
        return this._userIndexClient.registerBot(principal, bot);
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

    addBot(
        id: CommunityIdentifier | GroupChatIdentifier,
        botId: string,
        grantedPermissions: SlashCommandPermissions,
    ): Promise<boolean> {
        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).addBot(botId, grantedPermissions);
            case "group_chat":
                return this.getGroupClient(id.groupId).addBot(botId, grantedPermissions);
        }
    }

    updateInstalledBot(
        id: CommunityIdentifier | GroupChatIdentifier,
        botId: string,
        grantedPermissions: SlashCommandPermissions,
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
        }
    }

    removeInstalledBot(
        id: CommunityIdentifier | GroupChatIdentifier,
        botId: string,
    ): Promise<boolean> {
        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).removeInstalledBot(botId);
            case "group_chat":
                return this.getGroupClient(id.groupId).removeInstalledBot(botId);
        }
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
    ): Promise<boolean> {
        const localUserIndex = await this.getLocalUserIndexForUser(userId);
        return this.getLocalUserIndexClient(localUserIndex).withdrawFromIcpSwap(
            userId,
            swapId,
            inputToken,
        );
    }
}

export interface ExchangeRateClient {
    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates>>;
}
