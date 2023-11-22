/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import {
    type Database,
    getCachedChats,
    getCachePrimerTimestamps,
    initDb,
    loadFailedMessages,
    removeFailedMessage,
    setCachedChats,
    setCachedMessageIfNotExists,
    setCachePrimerTimestamp,
    recordFailedMessage,
} from "../utils/caching";
import { getAllUsers } from "../utils/userCache";
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
import { distinctBy, toRecord } from "../utils/list";
import { measure } from "./common/profiling";
import {
    buildBlobUrl,
    buildUserAvatarUrl,
    getUpdatedEvents,
    isSuccessfulGroupSummaryResponse,
    isSuccessfulGroupSummaryUpdatesResponse,
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
    DirectChatEvent,
    DirectChatSummary,
    DirectChatSummaryUpdates,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventWrapper,
    GroupChatDetailsResponse,
    GroupChatEvent,
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
    MigrateUserPrincipalResponse,
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
    ThreadPreview,
    ThreadPreviewsResponse,
    ThreadSyncDetails,
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
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
    InviteUsersResponse,
    DeclineInvitationResponse,
    AccessGate,
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
} from "openchat-shared";
import {
    UnsupportedValueError,
    ChatMap,
    chatIdentifiersEqual,
    DestinationInvalidError,
    CommonResponses,
    applyOptionUpdate,
    ANON_USER_ID,
} from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import { waitAll } from "openchat-shared";
import { AsyncMessageContextMap } from "../utils/messageContext";
import { CommunityClient } from "./community/community.client";
import {
    isSuccessfulCommunitySummaryResponse,
    isSuccessfulCommunitySummaryUpdatesResponse,
    mergeCommunities,
    mergeCommunityUpdates,
} from "../utils/community";
import { AnonUserClient } from "./user/anonUser.client";
import { excludeLatestKnownUpdateIfBeforeFix } from "./common/replicaUpToDateChecker";

export class OpenChatAgent extends EventTarget {
    private _userIndexClient: UserIndexClient;
    private _onlineClient: OnlineClient;
    private _groupIndexClient: GroupIndexClient;
    private _userClient?: UserClient | AnonUserClient;
    private _notificationClient: NotificationsClient;
    private _proposalsBotClient: ProposalsBotClient;
    private _marketMakerClient: MarketMakerClient;
    private _registryClient: RegistryClient;
    private _ledgerClients: Record<string, LedgerClient>;
    private _ledgerIndexClients: Record<string, LedgerIndexClient>;
    private _groupClients: Record<string, GroupClient>;
    private _communityClients: Record<string, CommunityClient>;
    private _groupInvite: GroupInvite | undefined;
    private _communityInvite: CommunityInvite | undefined;
    private db: Database;
    private _logger: Logger;

    constructor(
        private identity: Identity,
        private config: AgentConfig,
    ) {
        super();
        this._logger = config.logger;
        this.db = initDb(this.principal);
        this._onlineClient = OnlineClient.create(identity, config);
        this._userIndexClient = new UserIndexClient(identity, config);
        this._groupIndexClient = GroupIndexClient.create(identity, config);
        this._notificationClient = NotificationsClient.create(identity, config);
        this._proposalsBotClient = ProposalsBotClient.create(identity, config);
        this._marketMakerClient = MarketMakerClient.create(identity, config);
        this._registryClient = RegistryClient.create(identity, config);
        this._ledgerClients = {};
        this._ledgerIndexClients = {};
        this._groupClients = {};
        this._communityClients = {};
    }

    private get principal(): Principal {
        return this.identity.getPrincipal();
    }

    getAllCachedUsers(): Promise<UserLookup> {
        return measure("getAllUsers", () => getAllUsers()).then((users) => {
            const lookup = toRecord(
                users.map((user) => this.rehydrateUserSummary(user)),
                (u) => u.userId,
            );
            return lookup;
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
            this._userClient = UserClient.create(userId, this.identity, this.config, this.db);
        }
        return this;
    }

    communityClient(communityId: string): CommunityClient {
        if (!this._communityClients[communityId]) {
            const inviteCode = this.getProvidedCommunityInviteCode(communityId);
            this._communityClients[communityId] = CommunityClient.create(
                communityId,
                this.identity,
                this.config,
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
            this._groupClients[chatId] = GroupClient.create(
                { kind: "group_chat", groupId: chatId },
                this.identity,
                this.config,
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
            this._ledgerClients[ledger] = LedgerClient.create(this.identity, this.config, ledger);
        }
        return this._ledgerClients[ledger];
    }

    getLedgerIndexClient(ledgerIndex: string): LedgerIndexClient {
        if (!this._ledgerIndexClients[ledgerIndex]) {
            this._ledgerIndexClients[ledgerIndex] = LedgerIndexClient.create(
                this.identity,
                this.config,
                ledgerIndex,
            );
        }
        return this._ledgerIndexClients[ledgerIndex];
    }

    private createLocalUserIndexClient(canisterId: string): LocalUserIndexClient {
        return LocalUserIndexClient.create(this.identity, this.config, canisterId);
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

    editMessage(
        chatId: ChatIdentifier,
        msg: Message,
        threadRootMessageIndex?: number,
    ): Promise<EditMessageResponse> {
        if (!navigator.onLine) return Promise.resolve("failure");

        switch (chatId.kind) {
            case "direct_chat":
                return this.editDirectMessage(chatId, msg, threadRootMessageIndex);
            case "group_chat":
                return this.editGroupMessage(chatId, msg, threadRootMessageIndex);
            case "channel":
                return this.editChannelMessage(chatId, msg, threadRootMessageIndex);
        }
    }

    sendMessage(
        messageContext: MessageContext,
        user: CreatedUser,
        mentioned: User[],
        event: EventWrapper<Message>,
        rulesAccepted: number | undefined,
        communityRulesAccepted: number | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        const { chatId, threadRootMessageIndex } = messageContext;

        if (!navigator.onLine) {
            recordFailedMessage(this.db, chatId, event, threadRootMessageIndex);
            return Promise.resolve([CommonResponses.offline(), event.event]);
        }

        if (chatId.kind === "channel") {
            if (
                event.event.content.kind === "crypto_content" ||
                event.event.content.kind === "prize_content_initial"
            ) {
                return this.userClient.sendMessageWithTransferToChannel(
                    chatId,
                    event.event.content.transfer.recipient,
                    user,
                    event,
                    threadRootMessageIndex,
                    communityRulesAccepted,
                    rulesAccepted,
                );
            }
            return this.sendChannelMessage(
                chatId,
                user.username,
                user.displayName,
                mentioned,
                event,
                threadRootMessageIndex,
                communityRulesAccepted,
                rulesAccepted,
            );
        }
        if (chatId.kind === "group_chat") {
            if (
                event.event.content.kind === "crypto_content" ||
                event.event.content.kind === "prize_content_initial"
            ) {
                return this.userClient.sendMessageWithTransferToGroup(
                    chatId,
                    event.event.content.transfer.recipient,
                    user,
                    event,
                    threadRootMessageIndex,
                    rulesAccepted,
                );
            }
            return this.sendGroupMessage(
                chatId,
                user.username,
                user.displayName,
                mentioned,
                event,
                threadRootMessageIndex,
                rulesAccepted,
            );
        }
        if (chatId.kind === "direct_chat") {
            return this.sendDirectMessage(chatId, event, threadRootMessageIndex);
        }
        throw new UnsupportedValueError("Unexpect chat type", chatId);
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
    ): Promise<[SendMessageResponse, Message]> {
        return this.getGroupClient(chatId.groupId).sendMessage(
            senderName,
            senderDisplayName,
            mentioned,
            event,
            threadRootMessageIndex,
            rulesAccepted,
        );
    }

    private editGroupMessage(
        chatId: GroupChatIdentifier,
        message: Message,
        threadRootMessageIndex?: number,
    ): Promise<EditMessageResponse> {
        return this.getGroupClient(chatId.groupId).editMessage(message, threadRootMessageIndex);
    }

    private editChannelMessage(
        chatId: ChannelIdentifier,
        message: Message,
        threadRootMessageIndex?: number,
    ): Promise<EditMessageResponse> {
        return this.communityClient(chatId.communityId).editMessage(
            chatId,
            message,
            threadRootMessageIndex,
        );
    }

    private sendDirectMessage(
        chatId: DirectChatIdentifier,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number,
    ): Promise<[SendMessageResponse, Message]> {
        return this.userClient.sendMessage(chatId, event, threadRootMessageIndex);
    }

    private editDirectMessage(
        recipientId: DirectChatIdentifier,
        message: Message,
        threadRootMessageIndex?: number,
    ): Promise<EditMessageResponse> {
        return this.userClient.editMessage(recipientId.userId, message, threadRootMessageIndex);
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        gate?: AccessGate,
        isPublic?: boolean,
    ): Promise<UpdateGroupResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).updateGroup(
                    name,
                    desc,
                    rules,
                    permissions,
                    avatar,
                    eventsTimeToLive,
                    gate,
                    isPublic,
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
                    gate,
                    isPublic,
                );
        }
    }

    async inviteUsersToCommunity(
        id: CommunityIdentifier,
        userIds: string[],
    ): Promise<InviteUsersResponse> {
        if (!userIds.length) {
            return Promise.resolve<InviteUsersResponse>("success");
        }

        if (!navigator.onLine) return Promise.resolve("failure");

        const communityLocalUserIndex = await this.communityClient(id.communityId).localUserIndex();
        return this.createLocalUserIndexClient(communityLocalUserIndex).inviteUsersToCommunity(
            id.communityId,
            userIds,
        );
    }

    async inviteUsers(
        chatId: MultiUserChatIdentifier,
        userIds: string[],
    ): Promise<InviteUsersResponse> {
        if (!userIds.length) {
            return Promise.resolve<InviteUsersResponse>("success");
        }

        if (!navigator.onLine) return Promise.resolve("failure");

        switch (chatId.kind) {
            case "group_chat":
                const groupLocalUserIndex = await this.getGroupClient(
                    chatId.groupId,
                ).localUserIndex();
                return this.createLocalUserIndexClient(groupLocalUserIndex).inviteUsersToGroup(
                    chatId.groupId,
                    userIds,
                );
            case "channel":
                const communityLocalUserIndex = await this.communityClient(
                    chatId.communityId,
                ).localUserIndex();
                return this.createLocalUserIndexClient(
                    communityLocalUserIndex,
                ).inviteUsersToChannel(chatId.communityId, chatId.channelId, userIds);
        }
    }

    chatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        latestKnownUpdate = excludeLatestKnownUpdateIfBeforeFix(latestKnownUpdate);

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
    ): Promise<EventsResponse<DirectChatEvent>> {
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
    ): Promise<EventsResponse<DirectChatEvent>> {
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
    ): Promise<EventsResponse<DirectChatEvent>> {
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
    ): Promise<EventsResponse<GroupChatEvent>> {
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
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.getGroupClient(chatId.groupId).chatEventsWindow(
                eventIndexRange,
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
            ),
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
    ): Promise<EventsResponse<GroupChatEvent>> {
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
    ): Promise<EventsResponse<GroupChatEvent>> {
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
    ): Promise<EventsResponse<GroupChatEvent>> {
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
    ): Promise<EventsResponse<GroupChatEvent>> {
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
                        sourceContext: ev.event.repliesTo.sourceContext ?? {
                            chatId: { ...defaultChatId },
                        },
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
        return {
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
        if (!navigator.onLine) return Promise.resolve([]);

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
            if (c.pinned === undefined) {
                byCommunity.delete(c.id.communityId);
            } else {
                byCommunity.set(c.id.communityId, c.pinned);
            }
        });

        return [...byCommunity.values()].flat();
    }

    async getUpdates(): Promise<UpdatesResult> {
        const start = Date.now();
        let numberOfAsyncCalls = 0;

        const current = await getCachedChats(this.db, this.principal);

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

        let latestActiveGroupsCheck = BigInt(0);
        let latestUserCanisterUpdates: bigint;
        let anyUpdates = false;

        if (current === undefined) {
            const userResponse = await this.userClient.getInitialState();
            numberOfAsyncCalls++;

            directChats = userResponse.directChats.summaries;
            groupsAdded = userResponse.groupChats.summaries;
            communitiesAdded = userResponse.communities.summaries;

            if (userResponse.groupChats.cached !== undefined) {
                currentGroups = userResponse.groupChats.cached.summaries;
                latestActiveGroupsCheck = userResponse.groupChats.cached.timestamp;
            }

            avatarId = userResponse.avatarId;
            blockedUsers = userResponse.blockedUsers;
            pinnedGroupChats = userResponse.groupChats.pinned;
            pinnedDirectChats = userResponse.directChats.pinned;
            pinnedFavouriteChats = userResponse.favouriteChats.pinned;
            pinnedChannels = userResponse.communities.summaries.flatMap((c) => c.pinned);
            favouriteChats = userResponse.favouriteChats.chats;
            latestUserCanisterUpdates = userResponse.timestamp;
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
                latestUserCanisterUpdates = userResponse.timestamp;
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
        }

        const addedGroupsPromises = groupsAdded.map((g) =>
            this.getGroupClient(g.id.groupId).summary(),
        );

        const addedCommunitiesPromises = communitiesAdded.map((c) =>
            this.communityClient(c.id.communityId).summary(),
        );

        const updatedGroupPromises = currentGroups
            .filter((g) => groupsToCheckForUpdates.has(g.id.groupId))
            .map((g) => this.getGroupClient(g.id.groupId).summaryUpdates(g.lastUpdated));

        const updatedCommunitiesPromises = currentCommunities
            .filter((c) => communitiesToCheckForUpdates.has(c.id.communityId))
            .map((c) => this.communityClient(c.id.communityId).summaryUpdates(c.lastUpdated));

        numberOfAsyncCalls +=
            addedGroupsPromises.length +
            addedCommunitiesPromises.length +
            updatedGroupPromises.length +
            updatedCommunitiesPromises.length;

        const groupPromiseResults = await waitAll(addedGroupsPromises);
        const communityPromiseResults = await waitAll(addedCommunitiesPromises);

        const groupUpdatePromiseResults = await waitAll(updatedGroupPromises);
        const communityUpdatePromiseResults = await waitAll(updatedCommunitiesPromises);

        const groupCanisterGroupSummaries = groupPromiseResults.success.filter(
            isSuccessfulGroupSummaryResponse,
        );
        const communityCanisterCommunitySummaries = communityPromiseResults.success.filter(
            isSuccessfulCommunitySummaryResponse,
        );

        const groupUpdates = groupUpdatePromiseResults.success.filter(
            isSuccessfulGroupSummaryUpdatesResponse,
        );
        const communityUpdates = communityUpdatePromiseResults.success.filter(
            isSuccessfulCommunitySummaryUpdatesResponse,
        );

        if (groupUpdates.length > 0 || communityUpdates.length > 0) {
            anyUpdates = true;
        }

        const anyErrors =
            groupPromiseResults.errors.length > 0 ||
            groupUpdatePromiseResults.errors.length > 0 ||
            communityPromiseResults.errors.length > 0 ||
            communityUpdatePromiseResults.errors.length > 0;

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
        };

        const updatedEvents = getUpdatedEvents(directChatUpdates, groupUpdates, communityUpdates);

        if (!anyErrors) {
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
        };
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

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this._userIndexClient.getCurrentUser();
    }

    setModerationFlags(flags: number): Promise<boolean> {
        if (!navigator.onLine) return Promise.resolve(false);

        return this._userIndexClient.setModerationFlags(flags);
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._userIndexClient.checkUsername(username);
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._userIndexClient.setUsername(userId, username);
    }

    setDisplayName(
        userId: string,
        displayName: string | undefined,
    ): Promise<SetDisplayNameResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._userIndexClient.setDisplayName(userId, displayName);
    }

    changeRole(
        chatId: MultiUserChatIdentifier,
        userId: string,
        newRole: MemberRole,
    ): Promise<ChangeRoleResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

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
        if (!navigator.onLine) return Promise.resolve("offline");

        switch (chatId.kind) {
            case "group_chat":
                return this.userClient.deleteGroup(chatId.groupId);
            case "channel":
                return this.communityClient(chatId.communityId).deleteChannel(chatId);
        }
    }

    removeMember(chatId: MultiUserChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

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
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.blockUser(userId);
    }

    blockUserFromGroupChat(
        chatId: MultiUserChatIdentifier,
        userId: string,
    ): Promise<BlockUserResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        if (chatId.kind === "channel")
            throw new Error("TODO - blockUserFromChannel not implemented");
        return this.getGroupClient(chatId.groupId).blockUser(userId);
    }

    unblockUserFromGroupChat(
        chatId: MultiUserChatIdentifier,
        userId: string,
    ): Promise<UnblockUserResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        if (chatId.kind === "channel")
            throw new Error("TODO - unblockUserFromChannel not implemented");
        return this.getGroupClient(chatId.groupId).unblockUser(userId);
    }

    unblockUserFromDirectChat(userId: string): Promise<UnblockUserResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.unblockUser(userId);
    }

    leaveGroup(chatId: MultiUserChatIdentifier): Promise<LeaveGroupResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

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
        _credential?: string,
    ): Promise<JoinGroupResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                const groupInviteCode = this.getProvidedGroupInviteCode(chatId);
                const groupLocalUserIndex = await this.getGroupClient(
                    chatId.groupId,
                ).localUserIndex();
                return this.createLocalUserIndexClient(groupLocalUserIndex).joinGroup(
                    chatId.groupId,
                    groupInviteCode,
                );
            case "channel":
                const communityInviteCode = this.getProvidedCommunityInviteCode(chatId.communityId);
                const communityLocalIndex = await this.communityClient(
                    chatId.communityId,
                ).localUserIndex();
                return this.createLocalUserIndexClient(communityLocalIndex).joinChannel(
                    chatId,
                    communityInviteCode,
                );
        }
    }

    async joinCommunity(
        id: CommunityIdentifier,
        _credential?: string,
    ): Promise<JoinCommunityResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        const inviteCode = this.getProvidedCommunityInviteCode(id.communityId);
        const localUserIndex = await this.communityClient(id.communityId).localUserIndex();
        return this.createLocalUserIndexClient(localUserIndex).joinCommunity(
            id.communityId,
            inviteCode,
        );
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
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).addReaction(
                    messageId,
                    reaction,
                    username,
                    displayName,
                    threadRootMessageIndex,
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
                );
        }
    }

    removeReaction(
        chatId: ChatIdentifier,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean,
    ): Promise<DeleteMessageResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        switch (chatId.kind) {
            case "group_chat":
                return this.deleteGroupMessage(
                    chatId.groupId,
                    messageId,
                    threadRootMessageIndex,
                    asPlatformModerator,
                );

            case "direct_chat":
                return this.deleteDirectMessage(chatId.userId, messageId, threadRootMessageIndex);

            case "channel":
                return this.deleteChannelMessage(
                    chatId,
                    messageId,
                    threadRootMessageIndex,
                    asPlatformModerator,
                );
        }
    }

    private deleteChannelMessage(
        chatId: ChannelIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean,
    ): Promise<DeleteMessageResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.communityClient(chatId.communityId).deleteMessages(
            chatId,
            [messageId],
            threadRootMessageIndex,
            asPlatformModerator,
        );
    }

    private deleteGroupMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean,
    ): Promise<DeleteMessageResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.getGroupClient(chatId).deleteMessage(
            messageId,
            threadRootMessageIndex,
            asPlatformModerator,
        );
    }

    private deleteDirectMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeleteMessageResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    undeleteMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        chatId: ChatIdentifier,
        muted: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).toggleMuteNotifications(muted);
            case "direct_chat":
                return this.userClient.toggleMuteNotifications(chatId.userId, muted);
            case "channel":
                return this.communityClient(chatId.communityId).toggleMuteChannelNotifications(
                    chatId,
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
        if (!navigator.onLine) return Promise.resolve("");

        const userClient = userId
            ? UserClient.create(userId, this.identity, this.config, this.db)
            : this.userClient;
        return userClient.getBio();
    }

    getPublicProfile(userId?: string): Promise<PublicProfile> {
        const userClient = userId
            ? UserClient.create(userId, this.identity, this.config, this.db)
            : this.userClient;
        return userClient.getPublicProfile();
    }

    setBio(bio: string): Promise<SetBioResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.setBio(bio);
    }

    async registerUser(
        username: string,
        displayName: string | undefined,
        referralCode: string | undefined,
    ): Promise<RegisterUserResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        const localUserIndex = await this._userIndexClient.userRegistrationCanister();
        return this.createLocalUserIndexClient(localUserIndex).registerUser(
            username,
            displayName,
            referralCode,
        );
    }

    getUserStorageLimits(): Promise<StorageStatus> {
        return DataClient.create(this.identity, this.config).storageStatus();
    }

    refreshAccountBalance(ledger: string, principal: string): Promise<bigint> {
        return this.getLedgerClient(ledger).accountBalance(principal);
    }

    getAccountTransactions(
        ledgerIndex: string,
        principal: string,
        fromId?: bigint,
    ): Promise<AccountTransactionResult> {
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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve("offline");

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
        threadRootMessageIndex?: number,
    ): Promise<RegisterPollVoteResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).registerPollVote(
                    messageIdx,
                    answerIdx,
                    voteType,
                    threadRootMessageIndex,
                );
            case "channel":
                return this.communityClient(chatId.communityId).registerPollVote(
                    chatId,
                    messageIdx,
                    answerIdx,
                    voteType,
                    threadRootMessageIndex,
                );
        }
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
    ): Promise<WithdrawCryptocurrencyResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        return this.userClient.withdrawCryptocurrency(domain);
    }

    getInviteCode(id: GroupChatIdentifier | CommunityIdentifier): Promise<InviteCodeResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve("offline");

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        switch (id.kind) {
            case "community":
                return this.communityClient(id.communityId).resetInviteCode();
            case "group_chat":
                return this.getGroupClient(id.groupId).resetInviteCode();
        }
    }

    pinChat(chatId: ChatIdentifier, favourite: boolean): Promise<PinChatResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.pinChat(chatId, favourite);
    }

    unpinChat(chatId: ChatIdentifier, favourite: boolean): Promise<UnpinChatResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.unpinChat(chatId, favourite);
    }

    archiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.archiveChat(chatId);
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.unarchiveChat(chatId);
    }

    registerProposalVote(
        chatId: MultiUserChatIdentifier,
        messageIndex: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

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

    initUserPrincipalMigration(newPrincipal: string): Promise<void> {
        return this.userClient.initUserPrincipalMigration(newPrincipal);
    }

    migrateUserPrincipal(userId: string): Promise<MigrateUserPrincipalResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        const userClient = UserClient.create(userId, this.identity, this.config, this.db);
        return userClient.migrateUserPrincipal();
    }

    getProposalVoteDetails(
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean,
    ): Promise<ProposalVoteDetails> {
        if (isNns) {
            return NnsGovernanceClient.create(
                this.identity,
                this.config,
                governanceCanisterId,
            ).getProposalVoteDetails(proposalId);
        } else {
            return SnsGovernanceClient.create(
                this.identity,
                this.config,
                governanceCanisterId,
            ).getProposalVoteDetails(proposalId);
        }
    }

    listNervousSystemFunctions(
        snsGovernanceCanisterId: string,
    ): Promise<ListNervousSystemFunctionsResponse> {
        return SnsGovernanceClient.create(
            this.identity,
            this.config,
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
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.freezeGroup(chatId.groupId, reason);
    }

    unfreezeGroup(chatId: GroupChatIdentifier): Promise<UnfreezeGroupResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.unfreezeGroup(chatId.groupId);
    }

    deleteFrozenGroup(chatId: GroupChatIdentifier): Promise<DeleteFrozenGroupResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.deleteFrozenGroup(chatId.groupId);
    }

    addHotGroupExclusion(chatId: GroupChatIdentifier): Promise<AddHotGroupExclusionResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.addHotGroupExclusion(chatId.groupId);
    }

    removeHotGroupExclusion(chatId: GroupChatIdentifier): Promise<RemoveHotGroupExclusionResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.removeHotGroupExclusion(chatId.groupId);
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._userIndexClient.suspendUser(userId, reason);
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.setCommunityModerationFlags(communityId, flags);
    }

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.setGroupUpgradeConcurrency(value);
    }

    setCommunityUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._groupIndexClient.setCommunityUpgradeConcurrency(value);
    }

    setUserUpgradeConcurrency(value: number): Promise<SetUserUpgradeConcurrencyResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._userIndexClient.setUserUpgradeConcurrency(value);
    }

    stakeNeuronForSubmittingProposals(
        governanceCanisterId: string,
        stake: bigint,
    ): Promise<StakeNeuronForSubmittingProposalsResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        return this._proposalsBotClient.stakeNeuronForSubmittingProposals(
            governanceCanisterId,
            stake,
        );
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs,
    ): Promise<UpdateMarketMakerConfigResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this._marketMakerClient.updateConfig(config);
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number,
    ): Promise<SetMessageReminderResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.userClient.setMessageReminder(
            chatId,
            eventIndex,
            remindAt,
            notes,
            threadRootMessageIndex,
        );
    }

    cancelMessageReminder(reminderId: bigint): Promise<boolean> {
        if (!navigator.onLine) return Promise.resolve(false);

        return this.userClient.cancelMessageReminder(reminderId);
    }

    getReferralLeaderboard(req?: ReferralLeaderboardRange): Promise<ReferralLeaderboardResponse> {
        return this._userIndexClient.getReferralLeaderboard(req);
    }

    declineInvitation(chatId: MultiUserChatIdentifier): Promise<DeclineInvitationResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

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
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        return this.getGroupClient(chatId.groupId).convertToCommunity(historyVisible, rules);
    }

    async getRegistry(): Promise<RegistryValue> {
        const current = await getCachedRegistry();

        const updates = await this._registryClient.updates(current?.lastUpdated);

        if (updates.kind === "success") {
            const updated = {
                lastUpdated: updates.lastUpdated,
                tokenDetails: distinctBy(
                    [...updates.tokenDetails, ...(current?.tokenDetails ?? [])],
                    (t) => t.ledger,
                ),
                nervousSystemSummary: distinctBy(
                    [...updates.nervousSystemSummary, ...(current?.nervousSystemSummary ?? [])],
                    (ns) => ns.governanceCanisterId,
                ),
            };
            setCachedRegistry(updated);
            return updated;
        } else if (current !== undefined) {
            return current;
        } else {
            throw new Error("Registry is empty... this should never happen!");
        }
    }

    setCommunityIndexes(communityIndexes: Record<string, number>): Promise<boolean> {
        if (!navigator.onLine) return Promise.resolve(false);

        return this.userClient.setCommunityIndexes(communityIndexes);
    }

    createUserGroup(
        communityId: string,
        name: string,
        userIds: string[],
    ): Promise<CreateUserGroupResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        return this.communityClient(communityId).createUserGroup(name, userIds);
    }

    updateUserGroup(
        communityId: string,
        userGroupId: number,
        name: string | undefined,
        usersToAdd: string[],
        usersToRemove: string[],
    ): Promise<UpdateUserGroupResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

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
    ): Promise<SetMemberDisplayNameResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        return this.communityClient(communityId).setMemberDisplayName(display_name);
    }

    deleteUserGroups(
        communityId: string,
        userGroupIds: number[],
    ): Promise<DeleteUserGroupsResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        return this.communityClient(communityId).deleteUserGroups(userGroupIds);
    }

    getCachePrimerTimestamps(): Promise<Record<string, bigint>> {
        return getCachePrimerTimestamps(this.db);
    }

    setCachePrimerTimestamp(chatIdentifierString: string, timestamp: bigint): Promise<void> {
        return setCachePrimerTimestamp(this.db, chatIdentifierString, timestamp);
    }

    followThread(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number,
        follow: boolean,
    ): Promise<FollowThreadResponse> {
        if (!navigator.onLine) return Promise.resolve("offline");

        if (chatId.kind === "channel") {
            return this.communityClient(chatId.communityId).followThread(
                chatId.channelId,
                threadRootMessageIndex,
                follow,
            );
        } else if (chatId.kind === "group_chat") {
            return this.getGroupClient(chatId.groupId).followThread(threadRootMessageIndex, follow);
        } else {
            throw new Error("followThread not implemented for direct chats");
        }
    }

    submitProposal(
        governanceCanisterId: string,
        proposal: CandidateProposal,
        ledger: string,
        token: string,
        proposalRejectionFee: bigint,
        transactionFee: bigint,
    ): Promise<SubmitProposalResponse> {
        if (!navigator.onLine) return Promise.resolve(CommonResponses.offline());

        return this.userClient.submitProposal(
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
        if (!navigator.onLine) return Promise.resolve(false);

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
            return this.userClient.reportMessage(chatId, messageId, deleteMessage);
        }
    }
}
