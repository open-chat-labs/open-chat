import {
    CurrentUserResponse,
    WorkerRequest,
    UserLookup,
    UsersArgs,
    UsersResponse,
    MessagesReadFromServer,
    FromWorker,
    StorageUpdated,
    UsersLoaded,
    IndexRange,
    EventsResponse,
    ChatEvent,
    MarkReadRequest,
    MarkReadResponse,
    WorkerResponse,
    WorkerError,
    GroupChatDetailsResponse,
    GroupChatDetails,
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
    GroupRules,
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
    ChallengeAttempt,
    CreateChallengeResponse,
    AddMembersResponse,
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
    ChatStateFull,
    UpdatesResult,
    DeletedGroupMessageResponse,
    DeletedDirectMessageResponse,
    ClaimPrizeResponse,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    Tally,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
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

    constructor(private config: OpenChatConfig) {
        super();
        console.debug("WORKER_CLIENT: loading worker with version: ", config.websiteVersion);
        this._worker = new Worker(`/worker.js?v=${config.websiteVersion}`);
        const req: Omit<WorkerRequest, "correlationId"> = {
            kind: "init",
            payload: {
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
            },
        };
        this.ready = new Promise((resolve) => {
            this.sendRequest(req).then(() => {
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

    private sendRequest<Req extends Omit<WorkerRequest, "correlationId">, Resp = unknown>(
        req: Req
    ): Promise<Resp> {
        const correlated = {
            ...req,
            correlationId: v4(),
        };
        this._worker.postMessage(correlated);
        const promise = new Promise<Resp>((resolve, reject) => {
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

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.sendRequest({
            kind: "getCurrentUser",
            payload: undefined,
        });
    }

    getInitialStateV2(): Promise<UpdatesResult> {
        return this.sendRequest({
            kind: "getInitialStateV2",
            payload: {},
        });
    }

    getUpdatesV2(currentState: ChatStateFull): Promise<UpdatesResult> {
        return this.sendRequest({
            kind: "getUpdatesV2",
            payload: {
                currentState,
            },
        });
    }

    getDeletedGroupMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex: number | undefined
    ): Promise<DeletedGroupMessageResponse> {
        return this.sendRequest({
            kind: "getDeletedGroupMessage",
            payload: {
                chatId,
                messageId,
                threadRootMessageIndex,
            },
        });
    }

    getDeletedDirectMessage(
        userId: string,
        messageId: bigint
    ): Promise<DeletedDirectMessageResponse> {
        return this.sendRequest({
            kind: "getDeletedDirectMessage",
            payload: {
                userId,
                messageId,
            },
        });
    }

    createUserClient(userId: string): Promise<void> {
        return this.sendRequest({
            kind: "createUserClient",
            payload: {
                userId,
            },
        });
    }

    chatEvents(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<ChatEvent>> {
        return this.sendRequest({
            kind: "chatEvents",
            payload: {
                chatType,
                chatId,
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex,
            },
        });
    }

    getUsers(users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        return this.sendRequest({
            kind: "getUsers",
            payload: {
                users,
                allowStale,
            },
        });
    }

    getAllCachedUsers(): Promise<UserLookup> {
        return this.sendRequest({
            kind: "getAllCachedUsers",
            payload: undefined,
        });
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.sendRequest({
            kind: "markMessagesRead",
            payload: request,
        });
    }

    getGroupDetails(chatId: string, latestEventIndex: number): Promise<GroupChatDetailsResponse> {
        return this.sendRequest({
            kind: "getGroupDetails",
            payload: {
                chatId,
                latestEventIndex,
            },
        });
    }

    async getGroupDetailsUpdates(
        chatId: string,
        previous: GroupChatDetails
    ): Promise<GroupChatDetails> {
        return this.sendRequest({
            kind: "getGroupDetailsUpdates",
            payload: {
                chatId,
                previous,
            },
        });
    }

    lastOnline(userIds: string[]): Promise<Record<string, number>> {
        return this.sendRequest({
            kind: "lastOnline",
            payload: {
                userIds,
            },
        });
    }

    markAsOnline(): Promise<void> {
        return this.sendRequest({
            kind: "markAsOnline",
            payload: undefined,
        });
    }

    directChatEventsWindow(
        eventIndexRange: IndexRange,
        theirUserId: string,
        messageIndex: number,
        latestClientMainEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.sendRequest({
            kind: "directChatEventsWindow",
            payload: {
                eventIndexRange,
                theirUserId,
                messageIndex,
                latestClientMainEventIndex,
            },
        });
    }

    groupChatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: string,
        messageIndex: number,
        latestClientMainEventIndex: number | undefined,
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.sendRequest({
            kind: "groupChatEventsWindow",
            payload: {
                eventIndexRange,
                chatId,
                messageIndex,
                threadRootMessageIndex,
                latestClientMainEventIndex,
            },
        });
    }

    directChatEventsByEventIndex(
        theirUserId: string,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.sendRequest({
            kind: "directChatEventsByEventIndex",
            payload: {
                theirUserId,
                eventIndexes,
                threadRootMessageIndex,
                latestClientEventIndex,
            },
        });
    }

    groupChatEventsByEventIndex(
        chatId: string,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.sendRequest({
            kind: "groupChatEventsByEventIndex",
            payload: {
                chatId,
                eventIndexes,
                threadRootMessageIndex,
                latestClientEventIndex,
            },
        });
    }

    rehydrateMessage(
        chatType: "direct_chat" | "group_chat",
        currentChatId: string,
        message: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventWrapper<Message>> {
        return this.sendRequest({
            kind: "rehydrateMessage",
            payload: {
                chatType,
                currentChatId,
                message,
                threadRootMessageIndex,
                latestClientEventIndex,
            },
        });
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this.sendRequest({
            kind: "checkUsername",
            payload: {
                username,
            },
        });
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this.sendRequest({
            kind: "searchUsers",
            payload: {
                searchTerm,
                maxResults,
            },
        });
    }

    migrateUserPrincipal(userId: string): Promise<MigrateUserPrincipalResponse> {
        return this.sendRequest({
            kind: "migrateUserPrincipal",
            payload: {
                userId,
            },
        });
    }

    initUserPrincipalMigration(newPrincipal: string): Promise<void> {
        return this.sendRequest({
            kind: "initUserPrincipalMigration",
            payload: {
                newPrincipal,
            },
        });
    }

    getUserStorageLimits(): Promise<StorageStatus> {
        return this.sendRequest({
            kind: "getUserStorageLimits",
            payload: undefined,
        });
    }

    getPublicGroupSummary(chatId: string): Promise<GroupChatSummary | undefined> {
        return this.sendRequest({
            kind: "getPublicGroupSummary",
            payload: {
                chatId,
            },
        });
    }

    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse> {
        return this.sendRequest({
            kind: "toggleMuteNotifications",
            payload: {
                chatId,
                muted,
            },
        });
    }

    archiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.sendRequest({
            kind: "archiveChat",
            payload: {
                chatId,
            },
        });
    }

    unarchiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.sendRequest({
            kind: "unarchiveChat",
            payload: {
                chatId,
            },
        });
    }

    pinChat(chatId: string): Promise<PinChatResponse> {
        return this.sendRequest({
            kind: "pinChat",
            payload: {
                chatId,
            },
        });
    }

    unpinChat(chatId: string): Promise<UnpinChatResponse> {
        return this.sendRequest({
            kind: "unpinChat",
            payload: {
                chatId,
            },
        });
    }

    blockUserFromDirectChat(userId: string): Promise<BlockUserResponse> {
        return this.sendRequest({
            kind: "blockUserFromDirectChat",
            payload: {
                userId,
            },
        });
    }

    unblockUserFromDirectChat(userId: string): Promise<UnblockUserResponse> {
        return this.sendRequest({
            kind: "unblockUserFromDirectChat",
            payload: {
                userId,
            },
        });
    }

    setUserAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.sendRequest({
            kind: "setUserAvatar",
            payload: {
                data,
            },
        });
    }

    makeGroupPrivate(chatId: string): Promise<MakeGroupPrivateResponse> {
        return this.sendRequest({
            kind: "makeGroupPrivate",
            payload: {
                chatId,
            },
        });
    }

    deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.sendRequest({
            kind: "deleteGroup",
            payload: {
                chatId,
            },
        });
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.sendRequest({
            kind: "leaveGroup",
            payload: {
                chatId,
            },
        });
    }

    joinGroup(chatId: string): Promise<JoinGroupResponse> {
        return this.sendRequest({
            kind: "joinGroup",
            payload: {
                chatId,
            },
        });
    }

    updateGroup(
        chatId: string,
        name?: string,
        desc?: string,
        rules?: GroupRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array
    ): Promise<UpdateGroupResponse> {
        return this.sendRequest({
            kind: "updateGroup",
            payload: {
                chatId,
                name,
                desc,
                rules,
                permissions,
                avatar,
            },
        });
    }

    registerPollVote(
        chatId: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.sendRequest({
            kind: "registerPollVote",
            payload: {
                chatId,
                messageIdx,
                answerIdx,
                voteType,
                threadRootMessageIndex,
            },
        });
    }

    deleteMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.sendRequest({
            kind: "deleteMessage",
            payload: {
                chatType,
                chatId,
                messageId,
                threadRootMessageIndex,
            },
        });
    }

    undeleteMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.sendRequest({
            kind: "undeleteMessage",
            payload: {
                chatType,
                chatId,
                messageId,
                threadRootMessageIndex,
            },
        });
    }

    addDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "addDirectChatReaction",
            payload: {
                otherUserId,
                messageId,
                reaction,
                username,
                threadRootMessageIndex,
            },
        });
    }

    removeDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "removeDirectChatReaction",
            payload: {
                otherUserId,
                messageId,
                reaction,
                threadRootMessageIndex,
            },
        });
    }

    addGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "addGroupChatReaction",
            payload: {
                chatId,
                messageId,
                reaction,
                username,
                threadRootMessageIndex,
            },
        });
    }

    removeGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.sendRequest({
            kind: "removeGroupChatReaction",
            payload: {
                chatId,
                messageId,
                reaction,
                threadRootMessageIndex,
            },
        });
    }

    blockUserFromGroupChat(chatId: string, userId: string): Promise<BlockUserResponse> {
        return this.sendRequest({
            kind: "blockUserFromGroupChat",
            payload: {
                chatId,
                userId,
            },
        });
    }

    getSnsProposalTally(
        snsGovernanceCanisterId: string,
        proposalId: bigint
    ): Promise<Tally> {
        return this.sendRequest({
            kind: "getSnsProposalTally",
            payload: {
                snsGovernanceCanisterId,
                proposalId,
            }
        })
    }

    listNervousSystemFunctions(
        snsGovernanceCanisterId: string
    ): Promise<ListNervousSystemFunctionsResponse> {
        return this.sendRequest({
            kind: "listNervousSystemFunctions",
            payload: {
                snsGovernanceCanisterId,
            },
        });
    }

    unpinMessage(chatId: string, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.sendRequest({
            kind: "unpinMessage",
            payload: {
                chatId,
                messageIndex,
            },
        });
    }

    pinMessage(chatId: string, messageIndex: number): Promise<PinMessageResponse> {
        return this.sendRequest({
            kind: "pinMessage",
            payload: {
                chatId,
                messageIndex,
            },
        });
    }

    sendMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        user: CreatedUser,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.sendRequest({
            kind: "sendMessage",
            payload: {
                chatType,
                chatId,
                user,
                mentioned,
                event,
                threadRootMessageIndex,
            },
        });
    }

    editMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        msg: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        return this.sendRequest({
            kind: "editMessage",
            payload: {
                chatType,
                chatId,
                msg,
                threadRootMessageIndex,
            },
        });
    }

    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): Promise<RegisterUserResponse> {
        return this.sendRequest({
            kind: "registerUser",
            payload: {
                username,
                challengeAttempt,
                referredBy,
            },
        });
    }

    createChallenge(): Promise<CreateChallengeResponse> {
        return this.sendRequest({
            kind: "createChallenge",
            payload: undefined,
        });
    }

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.sendRequest({
            kind: "subscriptionExists",
            payload: {
                p256dh_key,
            },
        });
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({
            kind: "pushSubscription",
            payload: {
                subscription,
            },
        });
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.sendRequest({
            kind: "removeSubscription",
            payload: {
                subscription,
            },
        });
    }

    addMembers(
        chatId: string,
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddMembersResponse> {
        return this.sendRequest({
            kind: "addMembers",
            payload: {
                chatId,
                userIds,
                myUsername,
                allowBlocked,
            },
        });
    }

    removeMember(chatId: string, userId: string): Promise<RemoveMemberResponse> {
        return this.sendRequest({
            kind: "removeMember",
            payload: {
                chatId,
                userId,
            },
        });
    }

    changeRole(chatId: string, userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        return this.sendRequest({
            kind: "changeRole",
            payload: {
                chatId,
                userId,
                newRole,
            },
        });
    }

    registerProposalVote(
        chatId: string,
        messageIndex: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.sendRequest({
            kind: "registerProposalVote",
            payload: {
                chatId,
                messageIndex,
                adopt,
            },
        });
    }

    getRecommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        return this.sendRequest({
            kind: "getRecommendedGroups",
            payload: {
                exclusions,
            },
        });
    }

    getGroupRules(chatId: string): Promise<GroupRules | undefined> {
        return this.sendRequest({
            kind: "getGroupRules",
            payload: {
                chatId,
            },
        });
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this.sendRequest({
            kind: "searchGroups",
            payload: {
                searchTerm,
                maxResults,
            },
        });
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.sendRequest({
            kind: "dismissRecommendation",
            payload: {
                chatId,
            },
        });
    }

    set groupInvite(value: GroupInvite) {
        this.sendRequest({
            kind: "groupInvite",
            payload: {
                value,
            },
        });
    }

    searchGroupChat(
        chatId: string,
        searchTerm: string,
        userIds: string[],
        maxResults = 10
    ): Promise<SearchGroupChatResponse> {
        return this.sendRequest({
            kind: "searchGroupChat",
            payload: {
                chatId,
                searchTerm,
                userIds,
                maxResults,
            },
        });
    }

    searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults = 10
    ): Promise<SearchDirectChatResponse> {
        return this.sendRequest({
            kind: "searchDirectChat",
            payload: {
                userId,
                searchTerm,
                maxResults,
            },
        });
    }

    refreshAccountBalance(crypto: Cryptocurrency, principal: string): Promise<Tokens> {
        return this.sendRequest({
            kind: "refreshAccountBalance",
            payload: {
                crypto,
                principal,
            },
        });
    }

    async threadPreviews(
        threadsByChat: Record<string, [ThreadSyncDetails[], number | undefined]>
    ): Promise<ThreadPreview[]> {
        return this.sendRequest({
            kind: "threadPreviews",
            payload: {
                threadsByChat,
            },
        });
    }

    async getUser(userId: string, allowStale = false): Promise<PartialUserSummary | undefined> {
        return this.sendRequest({
            kind: "getUser",
            payload: {
                userId,
                allowStale,
            },
        });
    }

    getPublicProfile(userId?: string): Promise<PublicProfile> {
        return this.sendRequest({
            kind: "getPublicProfile",
            payload: {
                userId,
            },
        });
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.sendRequest({
            kind: "setUsername",
            payload: {
                userId,
                username,
            },
        });
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.sendRequest({
            kind: "setBio",
            payload: {
                bio,
            },
        });
    }

    getBio(userId?: string): Promise<string> {
        return this.sendRequest({
            kind: "getBio",
            payload: {
                userId,
            },
        });
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.sendRequest({
            kind: "withdrawCryptocurrency",
            payload: {
                domain,
            },
        });
    }

    getGroupMessagesByMessageIndex(
        chatId: string,
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        return this.sendRequest({
            kind: "getGroupMessagesByMessageIndex",
            payload: {
                chatId,
                messageIndexes,
                latestClientEventIndex,
            },
        });
    }

    getInviteCode(chatId: string): Promise<InviteCodeResponse> {
        return this.sendRequest({
            kind: "getInviteCode",
            payload: {
                chatId,
            },
        });
    }

    enableInviteCode(chatId: string): Promise<EnableInviteCodeResponse> {
        return this.sendRequest({
            kind: "enableInviteCode",
            payload: {
                chatId,
            },
        });
    }

    disableInviteCode(chatId: string): Promise<DisableInviteCodeResponse> {
        return this.sendRequest({
            kind: "disableInviteCode",
            payload: {
                chatId,
            },
        });
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.sendRequest({
            kind: "createGroupChat",
            payload: {
                candidate,
            },
        });
    }

    setCachedMessageFromNotification(
        chatId: string,
        threadRootMessageIndex: number | undefined,
        message: EventWrapper<Message>
    ): Promise<void> {
        return this.sendRequest({
            kind: "setCachedMessageFromNotification",
            payload: {
                chatId,
                threadRootMessageIndex,
                message,
            },
        });
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this.sendRequest({
            kind: "freezeGroup",
            payload: {
                chatId,
                reason,
            },
        });
    }

    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this.sendRequest({
            kind: "unfreezeGroup",
            payload: {
                chatId,
            },
        });
    }

    addHotGroupExclusion(chatId: string): Promise<AddHotGroupExclusionResponse> {
        return this.sendRequest({
            kind: "addHotGroupExclusion",
            payload: {
                chatId,
            },
        });
    }

    removeHotGroupExclusion(chatId: string): Promise<RemoveHotGroupExclusionResponse> {
        return this.sendRequest({
            kind: "removeHotGroupExclusion",
            payload: {
                chatId,
            },
        });
    }

    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this.sendRequest({
            kind: "deleteFrozenGroup",
            payload: {
                chatId,
            },
        });
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this.sendRequest({
            kind: "suspendUser",
            payload: {
                userId,
                reason,
            },
        });
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.sendRequest({
            kind: "unsuspendUser",
            payload: {
                userId,
            },
        });
    }

    loadFailedMessages(): Promise<Record<string, Record<number, EventWrapper<Message>>>> {
        return this.sendRequest({
            kind: "loadFailedMessages",
            payload: {},
        });
    }

    deleteFailedMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<void> {
        return this.sendRequest({
            kind: "deleteFailedMessage",
            payload: {
                chatId,
                messageId,
                threadRootMessageIndex,
            },
        });
    }

    markSuspectedBot(): Promise<void> {
        return this.sendRequest({
            kind: "markSuspectedBot",
            payload: {},
        });
    }

    claimPrize(chatId: string, messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.sendRequest({
            kind: "claimPrize",
            payload: {
                chatId,
                messageId,
            },
        });
    }

    payForDiamondMembership(
        userId: string,
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this.sendRequest({
            kind: "payForDiamondMembership",
            payload: {
                userId,
                token,
                duration,
                recurring,
                expectedPriceE8s,
            },
        });
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs
    ): Promise<UpdateMarketMakerConfigResponse> {
        return this.sendRequest({
            kind: "updateMarketMakerConfig",
            payload: config
        });
    }
}
