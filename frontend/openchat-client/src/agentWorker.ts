import {
    WorkerRequest,
    MessagesReadFromServer,
    FromWorker,
    StorageUpdated,
    UsersLoaded,
    EventsResponse,
    WorkerResponse,
    WorkerError,
    DirectChatEvent,
    GroupChatEvent,
    EventWrapper,
    Message,
    CheckUsernameResponse,
    UserSummary,
    MigrateUserPrincipalResponse,
    StorageStatus,
    GroupChatSummary,
    ToggleMuteNotificationResponse,
    ArchiveChatResponse,
    PinChatResponse,
    UnpinChatResponse,
    BlockUserResponse,
    UnblockUserResponse,
    BlobReference,
    MakeGroupPrivateResponse,
    DeleteFrozenGroupResponse,
    DeleteGroupResponse,
    LeaveGroupResponse,
    JoinGroupResponse,
    UpdateGroupResponse,
    GroupPermissions,
    AccessRules,
    RegisterPollVoteResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    AddRemoveReactionResponse,
    ListNervousSystemFunctionsResponse,
    UnpinMessageResponse,
    PinMessageResponse,
    SendMessageResponse,
    CreatedUser,
    User,
    EditMessageResponse,
    RegisterUserResponse,
    RemoveMemberResponse,
    MemberRole,
    RegisterProposalVoteResponse,
    GroupSearchResponse,
    GroupInvite,
    SearchGroupChatResponse,
    SearchDirectChatResponse,
    Cryptocurrency,
    Tokens,
    ThreadPreview,
    ThreadSyncDetails,
    PartialUserSummary,
    PublicProfile,
    SetUsernameResponse,
    SetBioResponse,
    PendingCryptocurrencyWithdrawal,
    WithdrawCryptocurrencyResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    CandidateGroupChat,
    CreateGroupResponse,
    ChangeRoleResponse,
    FreezeGroupResponse,
    UnfreezeGroupResponse,
    SuspendUserResponse,
    UnsuspendUserResponse,
    ClaimPrizeResponse,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    SetGroupUpgradeConcurrencyResponse,
    SetUserUpgradeConcurrencyResponse,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
    AccessGate,
    ProposalVoteDetails,
    SetMessageReminderResponse,
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
    ReportMessageResponse,
    InviteUsersResponse,
    DeclineInvitationResponse,
    ResetInviteCodeResponse,
    WorkerResult,
} from "openchat-shared";
import type { OpenChatConfig } from "./config";
import { v4 } from "uuid";

const WORKER_TIMEOUT = 1000 * 90;

type UnresolvedRequest = {
    kind: string;
    sentAt: number;
};

type PromiseResolver<T> = {
    resolve: (val: T | PromiseLike<T>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void;
    timeout: number;
};

/**
 * This is a wrapper around the OpenChatAgent which brokers communication with the agent inside a web worker
 */
export class OpenChatAgentWorker extends EventTarget {
    private _worker: Worker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _pending: Map<string, PromiseResolver<any>> = new Map(); // in-flight requests
    private _unresolved: Map<string, UnresolvedRequest> = new Map(); // requests that never resolved
    public ready: Promise<boolean>;

    constructor(protected config: OpenChatConfig) {
        super();
        console.debug("WORKER_CLIENT: loading worker with version: ", config.websiteVersion);
        this._worker = new Worker(`/worker.js?v=${config.websiteVersion}`);
        this.ready = new Promise((resolve) => {
            this.sendRequest({
                kind: "init",
                icUrl: this.config.icUrl ?? window.location.origin,
                iiDerivationOrigin: this.config.iiDerivationOrigin,
                openStorageIndexCanister: this.config.openStorageIndexCanister,
                groupIndexCanister: this.config.groupIndexCanister,
                notificationsCanister: this.config.notificationsCanister,
                onlineCanister: this.config.onlineCanister,
                userIndexCanister: this.config.userIndexCanister,
                internetIdentityUrl: this.config.internetIdentityUrl,
                nfidUrl: this.config.nfidUrl,
                ledgerCanisterICP: this.config.ledgerCanisterICP,
                ledgerCanisterSNS1: this.config.ledgerCanisterSNS1,
                ledgerCanisterBTC: this.config.ledgerCanisterBTC,
                ledgerCanisterCHAT: this.config.ledgerCanisterCHAT,
                userGeekApiKey: this.config.userGeekApiKey,
                enableMultiCrypto: this.config.enableMultiCrypto,
                blobUrlPattern: this.config.blobUrlPattern,
                proposalBotCanister: this.config.proposalBotCanister,
                marketMakerCanister: this.config.marketMakerCanister,
            }).then(() => {
                resolve(true);
            });
        });

        this._worker.onmessage = (ev: MessageEvent<FromWorker>) => {
            if (!ev.data) {
                console.debug("WORKER_CLIENT: event message with no data received");
                return;
            }

            const data = ev.data;

            if (data.kind === "worker_event") {
                if (data.event.subkind === "messages_read_from_server") {
                    this.dispatchEvent(
                        new MessagesReadFromServer(
                            data.event.chatId,
                            data.event.readByMeUpTo,
                            data.event.threadsRead,
                            data.event.dateReadPinned
                        )
                    );
                }
                if (data.event.subkind === "storage_updated") {
                    this.dispatchEvent(new StorageUpdated(data.event.status));
                }
                if (data.event.subkind === "users_loaded") {
                    this.dispatchEvent(new UsersLoaded(data.event.users));
                }
            } else if (data.kind === "worker_response") {
                console.debug("WORKER_CLIENT: response: ", ev);
                this.resolveResponse(data);
            } else if (data.kind === "worker_error") {
                console.debug("WORKER_CLIENT: error: ", ev);
                this.resolveError(data);
            } else {
                console.debug("WORKER_CLIENT: unknown message: ", ev);
            }
        };
    }

    private logUnexpected(correlationId: string): void {
        const unresolved = this._unresolved.get(correlationId);
        const timedOut =
            unresolved === undefined
                ? ""
                : `Timed-out req of kind: ${unresolved.kind} received after ${
                      Date.now() - unresolved.sentAt
                  }ms`;
        console.error(
            `WORKER_CLIENT: unexpected correlationId received (${correlationId}). ${timedOut}`
        );
    }

    private resolveResponse(data: WorkerResponse): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.resolve(data.response);
            window.clearTimeout(promise.timeout);
            this._pending.delete(data.correlationId);
        } else {
            this.logUnexpected(data.correlationId);
        }
        this._unresolved.delete(data.correlationId);
    }

    private resolveError(data: WorkerError): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.reject(JSON.parse(data.error));
            window.clearTimeout(promise.timeout);
            this._pending.delete(data.correlationId);
        } else {
            this.logUnexpected(data.correlationId);
        }
        this._unresolved.delete(data.correlationId);
    }

    async sendRequest<Req extends WorkerRequest>(req: Req): Promise<WorkerResult<Req>> {
        await this.ready;

        const correlated = {
            ...req,
            correlationId: v4(),
        };

        this._worker.postMessage(correlated);
        const promise = new Promise<WorkerResult<Req>>((resolve, reject) => {
            const sentAt = Date.now();
            this._pending.set(correlated.correlationId, {
                resolve,
                reject,
                timeout: window.setTimeout(() => {
                    reject(
                        `WORKER_CLIENT: Request of kind ${req.kind} with correlationId ${correlated.correlationId} did not receive a response withing the ${WORKER_TIMEOUT}ms timeout`
                    );
                    this._unresolved.set(correlated.correlationId, {
                        kind: req.kind,
                        sentAt,
                    });
                    this._pending.delete(correlated.correlationId);
                }, WORKER_TIMEOUT),
            });
        });
        return promise;
    }

    protected _rehydrateMessage(
        chatId: string,
        message: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventWrapper<Message>> {
        return this.sendRequest({
            kind: "rehydrateMessage",
            chatId,
            message,
            threadRootMessageIndex,
            latestClientEventIndex,
        });
    }

    protected _checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this.sendRequest({
            kind: "checkUsername",
            username,
        });
    }

    protected _searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this.sendRequest({
            kind: "searchUsers",
            searchTerm,
            maxResults,
        });
    }

    protected _migrateUserPrincipal(userId: string): Promise<MigrateUserPrincipalResponse> {
        return this.sendRequest({
            kind: "migrateUserPrincipal",
            userId,
        });
    }

    protected _initUserPrincipalMigration(newPrincipal: string): Promise<void> {
        return this.sendRequest({
            kind: "initUserPrincipalMigration",
            newPrincipal,
        });
    }

    protected _getUserStorageLimits(): Promise<StorageStatus> {
        return this.sendRequest({
            kind: "getUserStorageLimits",
        });
    }

    protected _getPublicGroupSummary(chatId: string): Promise<GroupChatSummary | undefined> {
        return this.sendRequest({
            kind: "getPublicGroupSummary",
            chatId,
        });
    }

    protected _toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse> {
        return this.sendRequest({
            kind: "toggleMuteNotifications",
            chatId,
            muted,
        });
    }

    protected _archiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.sendRequest({
            kind: "archiveChat",
            chatId,
        });
    }

    protected _unarchiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.sendRequest({
            kind: "unarchiveChat",
            chatId,
        });
    }

    protected _pinChat(chatId: string): Promise<PinChatResponse> {
        return this.sendRequest({
            kind: "pinChat",
            chatId,
        });
    }

    protected _unpinChat(chatId: string): Promise<UnpinChatResponse> {
        return this.sendRequest({
            kind: "unpinChat",
            chatId,
        });
    }

    protected _blockUserFromDirectChat(userId: string): Promise<BlockUserResponse> {
        return this.sendRequest({
            kind: "blockUserFromDirectChat",
            userId,
        });
    }

    protected _unblockUserFromDirectChat(userId: string): Promise<UnblockUserResponse> {
        return this.sendRequest({
            kind: "unblockUserFromDirectChat",
            userId,
        });
    }

    protected _setUserAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.sendRequest({
            kind: "setUserAvatar",
            data,
        });
    }

    protected _makeGroupPrivate(chatId: string): Promise<MakeGroupPrivateResponse> {
        return this.sendRequest({
            kind: "makeGroupPrivate",
            chatId,
        });
    }

    protected _deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.sendRequest({
            kind: "deleteGroup",
            chatId,
        });
    }

    protected _leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.sendRequest({
            kind: "leaveGroup",
            chatId,
        });
    }

    protected _joinGroup(chatId: string): Promise<JoinGroupResponse> {
        return this.sendRequest({
            kind: "joinGroup",
            chatId,
        });
    }

    protected _updateGroup(
        chatId: string,
        name?: string,
        desc?: string,
        rules?: AccessRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array,
        gate?: AccessGate
    ): Promise<UpdateGroupResponse> {
        return this.sendRequest({
            kind: "updateGroup",
            chatId,
            name,
            desc,
            rules,
            permissions,
            avatar,
            gate,
        });
    }

    protected _registerPollVote(
        chatId: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.sendRequest({
            kind: "registerPollVote",
            chatId,
            messageIdx,
            answerIdx,
            voteType,
            threadRootMessageIndex,
        });
    }

    protected _deleteMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean
    ): Promise<DeleteMessageResponse> {
        return this.sendRequest({
            kind: "deleteMessage",
            chatType,
            chatId,
            messageId,
            threadRootMessageIndex,
            asPlatformModerator,
        });
    }

    protected _undeleteMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.sendRequest({
            kind: "undeleteMessage",
            chatType,
            chatId,
            messageId,
            threadRootMessageIndex,
        });
    }

    protected _addDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "addDirectChatReaction",
            otherUserId,
            messageId,
            reaction,
            username,
            threadRootMessageIndex,
        });
    }

    protected _removeDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "removeDirectChatReaction",
            otherUserId,
            messageId,
            reaction,
            threadRootMessageIndex,
        });
    }

    protected _addGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "addGroupChatReaction",
            chatId,
            messageId,
            reaction,
            username,
            threadRootMessageIndex,
        });
    }

    protected _removeGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "removeGroupChatReaction",
            chatId,
            messageId,
            reaction,
            threadRootMessageIndex,
        });
    }

    protected _blockUserFromGroupChat(chatId: string, userId: string): Promise<BlockUserResponse> {
        return this.sendRequest({
            kind: "blockUserFromGroupChat",
            chatId,
            userId,
        });
    }

    protected _unblockUserFromGroupChat(
        chatId: string,
        userId: string
    ): Promise<UnblockUserResponse> {
        return this.sendRequest({
            kind: "unblockUserFromGroupChat",
            chatId,
            userId,
        });
    }

    protected _getProposalVoteDetails(
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean
    ): Promise<ProposalVoteDetails> {
        return this.sendRequest({
            kind: "getProposalVoteDetails",
            governanceCanisterId,
            proposalId,
            isNns,
        });
    }

    listNervousSystemFunctions(
        snsGovernanceCanisterId: string
    ): Promise<ListNervousSystemFunctionsResponse> {
        return this.sendRequest({
            kind: "listNervousSystemFunctions",
            snsGovernanceCanisterId,
        });
    }

    protected _unpinMessage(chatId: string, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.sendRequest({
            kind: "unpinMessage",
            chatId,
            messageIndex,
        });
    }

    protected _pinMessage(chatId: string, messageIndex: number): Promise<PinMessageResponse> {
        const resp = this.sendRequest({
            kind: "pinMessage",
            chatId,
            messageIndex,
        });
        return resp;
    }

    protected _sendMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        user: CreatedUser,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.sendRequest({
            kind: "sendMessage",
            chatType,
            chatId,
            user,
            mentioned,
            event,
            threadRootMessageIndex,
        });
    }

    protected _editMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        msg: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        return this.sendRequest({
            kind: "editMessage",
            chatType,
            chatId,
            msg,
            threadRootMessageIndex,
        });
    }

    protected _registerUser(
        username: string,
        referralCode: string | undefined
    ): Promise<RegisterUserResponse> {
        return this.sendRequest({
            kind: "registerUser",
            username,
            referralCode,
        });
    }

    protected _subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.sendRequest({
            kind: "subscriptionExists",
            p256dh_key,
        });
    }

    protected _pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({
            kind: "pushSubscription",
            subscription,
        });
    }

    protected _removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({
            kind: "removeSubscription",
            subscription,
        });
    }

    protected _inviteUsers(chatId: string, userIds: string[]): Promise<InviteUsersResponse> {
        return this.sendRequest({
            kind: "inviteUsers",
            chatId,
            userIds,
        });
    }

    protected _removeMember(chatId: string, userId: string): Promise<RemoveMemberResponse> {
        return this.sendRequest({
            kind: "removeMember",
            chatId,
            userId,
        });
    }

    protected _changeRole(
        chatId: string,
        userId: string,
        newRole: MemberRole
    ): Promise<ChangeRoleResponse> {
        return this.sendRequest({
            kind: "changeRole",
            chatId,
            userId,
            newRole,
        });
    }

    protected _registerProposalVote(
        chatId: string,
        messageIndex: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.sendRequest({
            kind: "registerProposalVote",
            chatId,
            messageIndex,
            adopt,
        });
    }

    protected _getRecommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        return this.sendRequest({
            kind: "getRecommendedGroups",
            exclusions,
        });
    }

    protected _getGroupRules(chatId: string): Promise<AccessRules | undefined> {
        return this.sendRequest({
            kind: "getGroupRules",
            chatId,
        });
    }

    protected _searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.sendRequest({
            kind: "searchGroups",
            searchTerm,
            maxResults,
        });
    }

    protected _dismissRecommendation(chatId: string): Promise<void> {
        return this.sendRequest({
            kind: "dismissRecommendation",
            chatId,
        });
    }

    protected set _groupInvite(value: GroupInvite) {
        this.sendRequest({
            kind: "groupInvite",
            value,
        });
    }

    protected _searchGroupChat(
        chatId: string,
        searchTerm: string,
        userIds: string[],
        maxResults = 10
    ): Promise<SearchGroupChatResponse> {
        return this.sendRequest({
            kind: "searchGroupChat",
            chatId,
            searchTerm,
            userIds,
            maxResults,
        });
    }

    protected _searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults = 10
    ): Promise<SearchDirectChatResponse> {
        return this.sendRequest({
            kind: "searchDirectChat",
            userId,
            searchTerm,
            maxResults,
        });
    }

    protected _refreshAccountBalance(crypto: Cryptocurrency, principal: string): Promise<Tokens> {
        return this.sendRequest({
            kind: "refreshAccountBalance",
            crypto,
            principal,
        });
    }

    protected async _threadPreviews(
        threadsByChat: Record<string, [ThreadSyncDetails[], number | undefined]>
    ): Promise<ThreadPreview[]> {
        return this.sendRequest({
            kind: "threadPreviews",
            threadsByChat,
        });
    }

    protected async _getUser(
        userId: string,
        allowStale = false
    ): Promise<PartialUserSummary | undefined> {
        return this.sendRequest({
            kind: "getUser",
            userId,
            allowStale,
        });
    }

    protected _getPublicProfile(userId?: string): Promise<PublicProfile> {
        return this.sendRequest({
            kind: "getPublicProfile",
            userId,
        });
    }

    protected _setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.sendRequest({
            kind: "setUsername",
            userId,
            username,
        });
    }

    protected _setBio(bio: string): Promise<SetBioResponse> {
        return this.sendRequest({
            kind: "setBio",
            bio,
        });
    }

    protected _getBio(userId?: string): Promise<string> {
        return this.sendRequest({
            kind: "getBio",
            userId,
        });
    }

    protected _withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.sendRequest({
            kind: "withdrawCryptocurrency",
            domain,
        });
    }

    protected _getGroupMessagesByMessageIndex(
        chatId: string,
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        return this.sendRequest({
            kind: "getGroupMessagesByMessageIndex",
            chatId,
            messageIndexes,
            latestClientEventIndex,
        });
    }

    protected _getInviteCode(chatId: string): Promise<InviteCodeResponse> {
        return this.sendRequest({
            kind: "getInviteCode",
            chatId,
        });
    }

    protected _enableInviteCode(chatId: string): Promise<EnableInviteCodeResponse> {
        return this.sendRequest({
            kind: "enableInviteCode",
            chatId,
        });
    }

    protected _disableInviteCode(chatId: string): Promise<DisableInviteCodeResponse> {
        return this.sendRequest({
            kind: "disableInviteCode",
            chatId,
        });
    }

    protected _resetInviteCode(chatId: string): Promise<ResetInviteCodeResponse> {
        return this.sendRequest({
            kind: "resetInviteCode",
            chatId,
        });
    }

    protected _createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.sendRequest({
            kind: "createGroupChat",
            candidate,
        });
    }

    protected _setCachedMessageFromNotification(
        chatId: string,
        threadRootMessageIndex: number | undefined,
        message: EventWrapper<Message>
    ): Promise<void> {
        return this.sendRequest({
            kind: "setCachedMessageFromNotification",
            chatId,
            threadRootMessageIndex,
            message,
        });
    }

    protected _freezeGroup(
        chatId: string,
        reason: string | undefined
    ): Promise<FreezeGroupResponse> {
        return this.sendRequest({
            kind: "freezeGroup",
            chatId,
            reason,
        });
    }

    protected _unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this.sendRequest({
            kind: "unfreezeGroup",
            chatId,
        });
    }

    protected _addHotGroupExclusion(chatId: string): Promise<AddHotGroupExclusionResponse> {
        return this.sendRequest({
            kind: "addHotGroupExclusion",
            chatId,
        });
    }

    protected _removeHotGroupExclusion(chatId: string): Promise<RemoveHotGroupExclusionResponse> {
        return this.sendRequest({
            kind: "removeHotGroupExclusion",
            chatId,
        });
    }

    protected _deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this.sendRequest({
            kind: "deleteFrozenGroup",
            chatId,
        });
    }

    protected _suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this.sendRequest({
            kind: "suspendUser",
            userId,
            reason,
        });
    }

    protected _unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.sendRequest({
            kind: "unsuspendUser",
            userId,
        });
    }

    protected _setGroupUpgradeConcurrency(
        value: number
    ): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.sendRequest({
            kind: "setGroupUpgradeConcurrency",
            value,
        });
    }

    protected _setUserUpgradeConcurrency(
        value: number
    ): Promise<SetUserUpgradeConcurrencyResponse> {
        return this.sendRequest({
            kind: "setUserUpgradeConcurrency",
            value,
        });
    }

    protected _loadFailedMessages(): Promise<
        Record<string, Record<number, EventWrapper<Message>>>
    > {
        return this.sendRequest({
            kind: "loadFailedMessages",
        });
    }

    protected _deleteFailedMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<void> {
        return this.sendRequest({
            kind: "deleteFailedMessage",
            chatId,
            messageId,
            threadRootMessageIndex,
        });
    }

    protected _markSuspectedBot(): Promise<void> {
        return this.sendRequest({
            kind: "markSuspectedBot",
        });
    }

    protected _claimPrize(chatId: string, messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.sendRequest({
            kind: "claimPrize",
            chatId,
            messageId,
        });
    }

    protected _payForDiamondMembership(
        userId: string,
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this.sendRequest({
            kind: "payForDiamondMembership",
            userId,
            token,
            duration,
            recurring,
            expectedPriceE8s,
        });
    }

    protected _updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs
    ): Promise<UpdateMarketMakerConfigResponse> {
        return this.sendRequest({
            kind: "updateMarketMakerConfig",
            ...config,
        });
    }

    protected _setMessageReminder(
        chatId: string,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number
    ): Promise<SetMessageReminderResponse> {
        return this.sendRequest({
            kind: "setMessageReminder",
            chatId,
            eventIndex,
            remindAt,
            notes,
            threadRootMessageIndex,
        });
    }

    protected _cancelMessageReminder(reminderId: bigint): Promise<boolean> {
        return this.sendRequest({
            kind: "cancelMessageReminder",
            reminderId,
        });
    }

    protected _getReferralLeaderboard(
        args?: ReferralLeaderboardRange
    ): Promise<ReferralLeaderboardResponse> {
        return this.sendRequest({
            kind: "getReferralLeaderboard",
            ...args,
        });
    }

    protected _reportMessage(
        chatId: string,
        eventIndex: number,
        reasonCode: number,
        notes: string | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<ReportMessageResponse> {
        return this.sendRequest({
            kind: "reportMessage",
            chatId,
            eventIndex,
            reasonCode,
            notes,
            threadRootMessageIndex,
        });
    }

    protected _declineInvitation(chatId: string): Promise<DeclineInvitationResponse> {
        return this.sendRequest({
            kind: "declineInvitation",
            chatId,
        });
    }
}
