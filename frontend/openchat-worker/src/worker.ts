import { AnonymousIdentity } from "@icp-sdk/core/agent";
import {
    DelegationChain,
    DelegationIdentity,
    ECDSAKeyIdentity,
    type JsonnableDelegationChain,
} from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";
import {
    abortInFlightQueries,
    getBotDefinition,
    IdentityAgent,
    OpenChatAgent,
    setCachedWebAuthnKey,
    setCommunityReferral,
    type AgentConfig,
} from "@agent";
import {
    buildIdentityFromJson,
    getSessionExpiryMs,
    IdentityStorage,
    inititaliseLogger,
    MessagesReadFromServer,
    redactSecrets,
    setMinLogLevel,
    shouldReportWorkerError,
    StorageUpdated,
    Stream,
    SyncHeadMoved,
    UsersLoaded,
    type CorrelatedWorkerRequest,
    type CreateOpenChatIdentityError,
    type FinaliseAccountLinkingResponse,
    type GetOpenChatIdentityResponse,
    type JsonnableIdentityKeyAndChain,
    type LinkIdentitiesResponse,
    type Logger,
    type RemoveIdentityLinkResponse,
    type SetAuthIdentityResponse,
    type VerifyAccountLinkingCodeResponse,
    type WorkerEvent,
    type WebAuthnKey,
    type WebAuthnKeyFull,
    type WorkerRequest,
    type WorkerResult,
} from "@shared";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const ocIdentityStorage = IdentityStorage.createForOcIdentity();
const anonymousIdentity = new AnonymousIdentity();

let agentConfig: AgentConfig | undefined = undefined;
let identityAgent: IdentityAgent | undefined = undefined;
let authPrincipalString: string | undefined = undefined;
let logger: Logger = console;
let agent: OpenChatAgent | undefined = undefined;

async function initializeAuthIdentity(
    authIdentity: JsonnableIdentityKeyAndChain | undefined,
    isIIPrincipal: boolean,
    identityCanister: string,
    icUrl: string,
): Promise<GetOpenChatIdentityResponse> {
    if (authIdentity === undefined) {
        authPrincipalString = undefined;
        return { kind: "auth_identity_not_found" };
    }

    const identity = await buildIdentityFromJson(authIdentity);
    authPrincipalString = identity.getPrincipal().toString();

    identityAgent = await IdentityAgent.create(identity, identityCanister, icUrl, isIIPrincipal);

    const ocIdentity = await ocIdentityStorage.get(authPrincipalString);
    if (ocIdentity !== undefined) {
        return { kind: "success", identity: ocIdentity };
    }

    const ocIdentityExists = await identityAgent.checkOpenChatIdentityExists();
    if (ocIdentityExists) {
        const sessionKey = await ECDSAKeyIdentity.generate();

        const getIdentityResult = await identityAgent.getOpenChatIdentity(sessionKey);

        if (getIdentityResult !== undefined && typeof getIdentityResult.identity !== "string") {
            await ocIdentityStorage.set(
                sessionKey,
                getIdentityResult.identity.getDelegation(),
                authPrincipalString,
            );
            return { kind: "success", identity: getIdentityResult.identity };
        }
    }

    return { kind: "oc_identity_not_found" };
}

async function createOpenChatIdentity(
    webAuthnCredentialId: Uint8Array | undefined,
): Promise<DelegationIdentity | CreateOpenChatIdentityError> {
    if (identityAgent === undefined) {
        throw new Error("IdentityAgent not initialized");
    }

    const sessionKey = await ECDSAKeyIdentity.generate();

    const response = await identityAgent.createOpenChatIdentity(sessionKey, webAuthnCredentialId);

    if (typeof response !== "string") {
        await ocIdentityStorage.set(sessionKey, response.getDelegation(), authPrincipalString);
    }

    return response;
}

function handleAgentEvent(ev: Event): void {
    if (ev instanceof MessagesReadFromServer) {
        sendEvent({
            event: {
                subkind: "messages_read_from_server",
                chatId: ev.detail.chatId,
                readByMeUpTo: ev.detail.readByMeUpTo,
                threadsRead: ev.detail.threadsRead,
                dateReadPinned: ev.detail.dateReadPinned,
            },
        });
    }
    if (ev instanceof StorageUpdated) {
        sendEvent({
            event: {
                subkind: "storage_updated",
                status: ev.detail,
            },
        });
    }
    if (ev instanceof UsersLoaded) {
        sendEvent({
            event: {
                subkind: "users_loaded",
                users: ev.detail,
            },
        });
    }
    if (ev instanceof SyncHeadMoved) {
        sendEvent({
            event: {
                subkind: "sync_head",
                userId: ev.detail.userId,
                version: ev.detail.version,
            },
        });
    }
}

const sendError = (kind: string, correlationId: number, payload?: unknown) => {
    return (error: unknown) => {
        if (shouldReportWorkerError(kind, error)) {
            // The error must be the logger's second argument: that is the slot the logger's own
            // filtering inspects and the value Rollbar fingerprints on. Passing `kind` there
            // (as previously) named every item after the request kind and bypassed filtering.
            logger.error(`WORKER: request failed: ${kind}`, error, redactSecrets(payload));
        } else {
            logger.debug("WORKER: expected request failure (not reported): ", kind, error);
        }
        postMessage({
            kind: "worker_error",
            requestKind: kind,
            correlationId,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
    };
};

function streamReplies<T extends WorkerResult<WorkerRequest>>(
    payload: WorkerRequest,
    kind: string,
    correlationId: number,
    chain: Stream<T>,
) {
    const start = Date.now();
    chain.subscribe({
        onResult: (value, final) => {
            console.debug(
                `WORKER: sending streamed reply ${Date.now() - start}ms after subscribing`,
                correlationId,
                value,
                Date.now(),
                final,
            );
            sendResponse(kind, correlationId, value, final);
        },
        onError: sendError(kind, correlationId, payload),
    });
}

function executeThenReply(
    payload: WorkerRequest,
    kind: string,
    correlationId: number,
    promise: Promise<WorkerResult<WorkerRequest>>,
) {
    promise
        .then((response) => sendResponse(kind, correlationId, response))
        .catch(sendError(kind, correlationId, payload));
}

function sendResponse(
    kind: string,
    correlationId: number,
    response: WorkerResult<WorkerRequest>,
    final = true,
): void {
    logger.debug("WORKER: sending response: ", correlationId);
    postMessage({
        kind: "worker_response",
        requestKind: kind,
        correlationId,
        response,
        final,
    });
}

function sendEvent(msg: Omit<WorkerEvent, "kind">): void {
    postMessage({
        kind: "worker_event",
        ...msg,
    });
}

// No error / unhandledrejection listeners here, deliberately. inititaliseLogger's Rollbar.init
// runs in this worker too, and its captureUncaught / captureUnhandledRejections attach to `self`
// (rollbar falls back to `self` where there is no `window`), so listeners that also called
// logger.error reported every worker failure twice under two different titles - the same
// duplication App.svelte had. Rollbar's checkIgnore filters on the rejection reason itself.

self.addEventListener("message", (msg: MessageEvent<CorrelatedWorkerRequest>) => {
    logger.debug("WORKER: received ", msg.data.kind, msg.data.correlationId);
    const payload = msg.data;
    const kind = payload.kind;
    const correlationId = payload.correlationId;

    try {
        if (kind === "init") {
            agentConfig = {
                ...payload,
                logger,
            };
            logger = inititaliseLogger(payload.rollbarApiKey, payload.websiteVersion, payload.env);
            sendResponse(kind, correlationId, undefined);
            return;
        }

        const config = agentConfig;
        if (config === undefined) {
            throw new Error("Worker not initialised");
        }

        // Needs no agent: the queries belong to whichever agents exist
        if (kind === "abortInFlightQueries") {
            const aborted = abortInFlightQueries();
            logger.debug(`WORKER: aborted ${aborted} in-flight queries after resuming`);
            sendResponse(kind, correlationId, undefined);
            return;
        }

        if (kind === "setAuthIdentity") {
            executeThenReply(
                payload,
                kind,
                correlationId,
                initializeAuthIdentity(
                    payload.identity,
                    payload.isIIPrincipal,
                    config.identityCanister,
                    config.icUrl,
                ).then((resp) => {
                    const id = resp.kind === "success" ? resp.identity : anonymousIdentity;
                    const principal = id.getPrincipal().toString();

                    const response: SetAuthIdentityResponse =
                        resp.kind === "success"
                            ? {
                                  kind: "success",
                                  ocIdentityPrincipal: principal,
                                  ocIdentityExpiry: getSessionExpiryMs(resp.identity),
                              }
                            : resp;

                    console.debug("anon: init worker", principal, response.kind !== "success");

                    logger.debug("WORKER: constructing agent instance");
                    agent?.dispose();
                    agent = new OpenChatAgent(id, authPrincipalString ?? "", config);
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    return response;
                }),
            );
            return;
        }

        if (kind === "createOpenChatIdentity") {
            executeThenReply(
                payload,
                kind,
                correlationId,
                createOpenChatIdentity(payload.webAuthnCredentialId).then((resp) => {
                    const id = typeof resp !== "string" ? resp : new AnonymousIdentity();
                    agent?.dispose();
                    agent = new OpenChatAgent(id, authPrincipalString ?? "", config);
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    return typeof resp !== "string"
                        ? {
                              kind: "success",
                              ocIdentityPrincipal: resp.getPrincipal().toString(),
                              ocIdentityExpiry: getSessionExpiryMs(resp),
                          }
                        : resp;
                }),
            );
            return;
        }

        if (kind === "logout") {
            executeThenReply(
                payload,
                kind,
                correlationId,
                ocIdentityStorage.remove().then((_) => {
                    agent?.dispose();
                    agent = undefined;
                }),
            );
            return;
        }

        if (kind === "setMinLogLevel") {
            setMinLogLevel(payload.minLogLevel);
            sendResponse(kind, correlationId, undefined);
            return;
        }

        if (!agent) {
            // Reject rather than drop the request, otherwise the caller's promise would never settle.
            // Not routed via sendError since this is expected around login/logout and should not be reported.
            logger.debug("WORKER: agent does not exist: ", redactSecrets(msg.data));
            const error = new Error(`Worker has no agent to handle request: ${kind}`);
            postMessage({
                kind: "worker_error",
                requestKind: kind,
                correlationId,
                error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            });
            return;
        }

        const action = getAction(kind, payload, agent, config);

        if (action instanceof Promise) {
            executeThenReply(payload, kind, correlationId, action);
        } else {
            streamReplies(payload, kind, correlationId, action);
        }
    } catch (err) {
        logger.debug("WORKER: unhandled error: ", err, kind);
        sendError(kind, correlationId)(err);
    }
});

// The requests handled before an agent exists, in the message listener above
type HandledBeforeAgent =
    | "init"
    | "setAuthIdentity"
    | "createOpenChatIdentity"
    | "logout"
    | "setMinLogLevel"
    | "abortInFlightQueries";

type AgentRequestKind = Exclude<WorkerRequest["kind"], HandledBeforeAgent>;

type RequestOf<K extends WorkerRequest["kind"]> = Extract<WorkerRequest, { kind: K }>;

type Action<K extends WorkerRequest["kind"]> =
    | Promise<WorkerResult<RequestOf<K>>>
    | Stream<WorkerResult<RequestOf<K>>>;

// One handler per kind of request, each returning that kind's declared result, so a missing
// handler or a handler returning the wrong thing fails to compile
type Handlers = {
    [K in AgentRequestKind]: (
        payload: RequestOf<K>,
        agent: OpenChatAgent,
        config: AgentConfig,
    ) => Action<K>;
};

const handlers: Handlers = {
    getCurrentUser: (_payload, agent) => agent.getCurrentUser(),
    getDeletedGroupMessage: (payload, agent) =>
        agent.getDeletedGroupMessage(
            payload.chatId,
            payload.messageId,
            payload.threadRootMessageIndex,
        ),
    getDeletedDirectMessage: (payload, agent) =>
        agent.getDeletedDirectMessage(payload.userId, payload.messageId),
    getUpdates: (payload, agent) => agent.getUpdates(payload.initialLoad),
    syncSince: (payload, agent) => agent.syncSince(payload.since),
    refreshChat: (payload, agent) => agent.refreshChat(payload.chatId),
    getBots: (payload, agent) => agent.getBots(payload.initialLoad),
    createUserClient: (payload, agent) => {
        agent.createUserClient(payload.userId);
        return Promise.resolve();
    },
    chatEvents: (payload, agent) =>
        agent.chatEvents(
            payload.chatId,
            payload.eventIndexRange,
            payload.startIndex,
            payload.ascending,
            payload.threadRootMessageIndex,
            payload.latestKnownUpdate,
        ),
    getUsers: (payload, agent) => agent.getUsers(payload.users, payload.allowStale),
    getAllCachedUsers: (_payload, agent) => agent.getAllCachedUsers(),
    markMessagesRead: (payload, agent) => agent.markMessagesRead(payload.payload),
    getGroupDetails: (payload, agent) =>
        agent.getGroupDetails(
            payload.chatId,
            payload.detailsLastUpdated,
            payload.detailsSyncedUpTo,
        ),
    lookupMembers: (payload, agent) =>
        agent.lookupMembers(payload.id, payload.userIds, payload.latestKnownUpdate),
    searchCommunityMembers: (payload, agent) =>
        agent.searchCommunityMembers(
            payload.id,
            payload.searchTerm,
            payload.maxResults,
            payload.latestKnownUpdate,
        ),
    lastOnline: (payload, agent) => agent.lastOnline(payload.userIds),
    markAsOnline: (_payload, agent) => agent.markAsOnline(),
    chatEventsWindow: (payload, agent) =>
        agent.chatEventsWindow(
            payload.eventIndexRange,
            payload.chatId,
            payload.messageIndex,
            payload.threadRootMessageIndex,
            payload.latestKnownUpdate,
        ),
    chatEventsByEventIndex: (payload, agent) =>
        agent.chatEventsByEventIndex(
            payload.chatId,
            payload.eventIndexes,
            payload.threadRootMessageIndex,
            payload.latestKnownUpdate,
        ),
    rehydrateMessage: (payload, agent) =>
        agent.rehydrateMessage(
            payload.chatId,
            payload.message,
            payload.threadRootMessageIndex,
            payload.latestKnownUpdate,
        ),
    checkUsername: (payload, agent) => agent.checkUsername(payload.username, payload.isBot),
    searchUsers: (payload, agent) =>
        agent.searchUsers(payload.searchTerm, payload.maxResults, payload.pageIndex),
    getUserStorageLimits: (_payload, agent) => agent.getUserStorageLimits(),
    getPublicGroupSummary: (payload, agent) => agent.getPublicGroupSummary(payload.chatId),
    toggleMuteNotifications: (payload, agent) =>
        agent.toggleMuteNotifications(payload.id, payload.mute, payload.muteAtEveryone),
    archiveChat: (payload, agent) => agent.archiveChat(payload.chatId),
    unarchiveChat: (payload, agent) => agent.unarchiveChat(payload.chatId),
    pinChat: (payload, agent) => agent.pinChat(payload.chatId, payload.favourite),
    unpinChat: (payload, agent) => agent.unpinChat(payload.chatId, payload.favourite),
    blockUserFromDirectChat: (payload, agent) => agent.blockUserFromDirectChat(payload.userId),
    unblockUserFromDirectChat: (payload, agent) => agent.unblockUserFromDirectChat(payload.userId),
    setUserAvatar: (payload, agent) => agent.setUserAvatar(payload.data),
    setProfileBackground: (payload, agent) => agent.setProfileBackground(payload.data),
    deleteGroup: (payload, agent) => agent.deleteGroup(payload.chatId),
    leaveGroup: (payload, agent) => agent.leaveGroup(payload.chatId),
    joinGroup: (payload, agent) =>
        agent.joinGroup(payload.chatId, payload.credentialArgs, payload.compositeGateIndex),
    joinCommunity: (payload, agent) =>
        agent.joinCommunity(payload.id, payload.credentialArgs, payload.compositeGateIndex),
    updateGroup: (payload, agent) =>
        agent.updateGroup(
            payload.chatId,
            payload.name,
            payload.desc,
            payload.rules,
            payload.permissions,
            payload.avatar,
            payload.eventsTimeToLive,
            payload.gateConfig,
            payload.isPublic,
            payload.messagesVisibleToNonMembers,
            payload.externalUrl,
        ),
    registerPollVote: (payload, agent) =>
        agent.registerPollVote(
            payload.chatId,
            payload.messageIdx,
            payload.answerIdx,
            payload.voteType,
            payload.threadRootMessageIndex,
            payload.newAchievement,
        ),
    deleteMessage: (payload, agent) =>
        agent.deleteMessage(
            payload.chatId,
            payload.messageId,
            payload.threadRootMessageIndex,
            payload.asPlatformModerator,
            payload.newAchievement,
        ),
    undeleteMessage: (payload, agent) =>
        agent.undeleteMessage(payload.chatId, payload.messageId, payload.threadRootMessageIndex),
    addReaction: (payload, agent) =>
        agent.addReaction(
            payload.chatId,
            payload.messageId,
            payload.reaction,
            payload.username,
            payload.displayName,
            payload.threadRootMessageIndex,
            payload.newAchievement,
        ),
    removeReaction: (payload, agent) =>
        agent.removeReaction(
            payload.chatId,
            payload.messageId,
            payload.reaction,
            payload.threadRootMessageIndex,
        ),
    blockUserFromGroupChat: (payload, agent) =>
        agent.blockUserFromGroupChat(payload.chatId, payload.userId),
    unblockUserFromGroupChat: (payload, agent) =>
        agent.unblockUserFromGroupChat(payload.chatId, payload.userId),
    getProposalVoteDetails: (payload, agent) =>
        agent.getProposalVoteDetails(
            payload.governanceCanisterId,
            payload.proposalId,
            payload.isNns,
        ),
    listNervousSystemFunctions: (payload, agent) =>
        agent.listNervousSystemFunctions(payload.snsGovernanceCanisterId),
    unpinMessage: (payload, agent) => agent.unpinMessage(payload.chatId, payload.messageIndex),
    pinMessage: (payload, agent) => agent.pinMessage(payload.chatId, payload.messageIndex),
    sendMessage: (payload, agent) =>
        agent.sendMessage(
            payload.messageContext,
            payload.user,
            payload.mentioned,
            payload.event,
            payload.acceptedRules,
            payload.messageFilterFailed,
            payload.pin,
            payload.newAchievement,
        ),
    editMessage: (payload, agent) =>
        agent.editMessage(
            payload.chatId,
            payload.msg,
            payload.threadRootMessageIndex,
            payload.blockLevelMarkdown,
            payload.newAchievement,
        ),
    registerUser: (payload, agent) =>
        agent.registerUser(payload.username, payload.email, payload.referralCode),
    subscriptionExists: (payload, agent) => agent.subscriptionExists(payload.endpoint),
    pushSubscription: (payload, agent) =>
        agent.pushSubscription(payload.subscription).then(() => undefined),
    removeSubscription: (payload, agent) =>
        agent.removeSubscription(payload.endpoint).then(() => undefined),
    fcmTokenExists: (payload, agent) => agent.fcmTokenExists(payload.fcmToken),
    addFcmToken: (payload, agent) => agent.addFcmToken(payload.fcmToken),
    removeFcmToken: (payload, agent) => agent.removeFcmToken(payload.fcmToken),
    markNotificationSubscriptionActive: (payload, agent) =>
        agent.markNotificationSubscriptionActive(payload.endpoint),
    inviteUsers: (payload, agent) => agent.inviteUsers(payload.id, payload.userIds),
    removeMember: (payload, agent) => agent.removeMember(payload.chatId, payload.userId),
    changeRole: (payload, agent) =>
        agent.changeRole(payload.chatId, payload.userId, payload.newRole),
    registerProposalVote: (payload, agent) =>
        agent.registerProposalVote(
            payload.chatId,
            payload.messageIndex,
            payload.governanceCanisterId,
            payload.proposalId,
            payload.isNns,
            payload.adopt,
        ),
    getRecommendedGroups: (payload, agent) => agent.getRecommendedGroups(payload.exclusions),
    exploreCommunities: (payload, agent) =>
        agent.exploreCommunities(
            payload.searchTerm,
            payload.pageIndex,
            payload.pageSize,
            payload.flags,
            payload.languages,
        ),
    exploreBots: (payload, agent) =>
        agent.exploreBots(
            payload.searchTerm,
            payload.pageIndex,
            payload.pageSize,
            payload.location,
            payload.excludeInstalled,
        ),
    registerBot: (payload, agent) => agent.registerBot(payload.principal, payload.bot),
    removeBot: (payload, agent) => agent.removeBot(payload.botId),
    updateRegisteredBot: (payload, agent) =>
        agent.updateRegisteredBot(
            payload.id,
            payload.principal,
            payload.ownerId,
            payload.avatarUrl,
            payload.endpoint,
            payload.definition,
        ),
    searchGroups: (payload, agent) =>
        agent.searchGroups(payload.searchTerm, payload.flags, payload.maxResults),
    dismissRecommendation: (payload, agent) =>
        agent.dismissRecommendation(payload.chatId).then(() => undefined),
    communityInvite: (payload, agent) => {
        agent.communityInvite = payload.value;
        return Promise.resolve();
    },
    groupInvite: (payload, agent) => {
        agent.groupInvite = payload.value;
        return Promise.resolve();
    },
    searchGroupChat: (payload, agent) =>
        agent.searchGroupChat(
            payload.chatId,
            payload.searchTerm,
            payload.userIds,
            payload.maxResults,
        ),
    searchDirectChat: (payload, agent) =>
        agent.searchDirectChat(payload.chatId, payload.searchTerm, payload.maxResults),
    refreshAccountBalance: (payload, agent) =>
        agent.refreshAccountBalance(payload.ledger, payload.principal),
    fundsInPreviousWallets: (payload, agent) =>
        agent.fundsInPreviousWallets(payload.previousUserIds),
    moveFundsFromPreviousWallets: (payload, agent) =>
        agent.moveFundsFromPreviousWallets(payload.funds),
    getAccountTransactions: (payload, agent) =>
        agent.getAccountTransactions(payload.ledgerIndex, payload.principal, payload.fromId),
    threadPreviews: (payload, agent) => agent.threadPreviews(payload.threadsByChat),
    getUser: (payload, agent) => agent.getUser(payload.userId, payload.allowStale),
    getPublicProfile: (payload, agent) => agent.getPublicProfile(payload.userId),
    setUsername: (payload, agent) => agent.setUsername(payload.userId, payload.username),
    setDisplayName: (payload, agent) => agent.setDisplayName(payload.userId, payload.displayName),
    setHideOnlineStatus: (payload, agent) => agent.setHideOnlineStatus(payload.hideOnlineStatus),
    setBio: (payload, agent) => agent.setBio(payload.bio),
    getBio: (payload, agent) => agent.getBio(payload.userId),
    withdrawCryptocurrency: (payload, agent) =>
        agent.withdrawCryptocurrency(payload.domain, payload.pin),
    getMessagesByMessageIndex: (payload, agent) =>
        agent.getMessagesByMessageIndex(
            payload.chatId,
            payload.threadRootMessageIndex,
            payload.messageIndexes,
            payload.latestKnownUpdate,
        ),
    getInviteCode: (payload, agent) => agent.getInviteCode(payload.id),
    enableInviteCode: (payload, agent) => agent.enableInviteCode(payload.id),
    disableInviteCode: (payload, agent) => agent.disableInviteCode(payload.id),
    resetInviteCode: (payload, agent) => agent.resetInviteCode(payload.id),
    createGroupChat: (payload, agent) => agent.createGroupChat(payload.candidate),
    setCachedMessageFromNotification: (payload, agent) =>
        agent
            .setCachedMessageFromNotification(
                payload.chatId,
                payload.threadRootMessageIndex,
                payload.message,
            )
            .then(() => undefined),
    freezeGroup: (payload, agent) => agent.freezeGroup(payload.chatId, payload.reason),
    unfreezeGroup: (payload, agent) => agent.unfreezeGroup(payload.chatId),
    freezeCommunity: (payload, agent) => agent.freezeCommunity(payload.id, payload.reason),
    unfreezeCommunity: (payload, agent) => agent.unfreezeCommunity(payload.id),
    deleteFrozenGroup: (payload, agent) => agent.deleteFrozenGroup(payload.chatId),
    addHotGroupExclusion: (payload, agent) => agent.addHotGroupExclusion(payload.chatId),
    removeHotGroupExclusion: (payload, agent) => agent.removeHotGroupExclusion(payload.chatId),
    addRemoveSwapProvider: (payload, agent) =>
        agent.addRemoveSwapProvider(payload.swapProvider, payload.add),
    addMessageFilter: (payload, agent) => agent.addMessageFilter(payload.regex),
    removeMessageFilter: (payload, agent) => agent.removeMessageFilter(payload.id),
    setAirdropConfig: (payload, agent) =>
        agent.setAirdropConfig(
            payload.channelId,
            payload.channelName,
            payload.communityId,
            payload.communityName,
        ),
    setTokenEnabled: (payload, agent) => agent.setTokenEnabled(payload.ledger, payload.enabled),
    suspendUser: (payload, agent) => agent.suspendUser(payload.userId, payload.reason),
    unsuspendUser: (payload, agent) => agent.unsuspendUser(payload.userId),
    setCommunityModerationFlags: (payload, agent) =>
        agent.setCommunityModerationFlags(payload.communityId, payload.flags),
    setGroupModerationFlags: (payload, agent) =>
        agent.setGroupModerationFlags(payload.chatId, payload.flags),
    setGroupUpgradeConcurrency: (payload, agent) => agent.setGroupUpgradeConcurrency(payload.value),
    setCommunityUpgradeConcurrency: (payload, agent) =>
        agent.setCommunityUpgradeConcurrency(payload.value),
    createMultiUserCanister: (payload, agent) =>
        agent.createMultiUserCanister(payload.localUserIndexCanisterId),
    markLocalGroupIndexFull: (payload, agent) =>
        agent.markLocalGroupIndexFull(payload.canisterId, payload.full),
    setDiamondMembershipFees: (payload, agent) => agent.setDiamondMembershipFees(payload.fees),
    stakeNeuronForSubmittingProposals: (payload, agent) =>
        agent.stakeNeuronForSubmittingProposals(payload.governanceCanisterId, payload.stake),
    topUpNeuronForSubmittingProposals: (payload, agent) =>
        agent.topUpNeuronForSubmittingProposals(payload.governanceCanisterId, payload.amount),
    loadFailedMessages: (_payload, agent) => agent.loadFailedMessages(),
    deleteFailedMessage: (payload, agent) =>
        agent
            .deleteFailedMessage(payload.chatId, payload.messageId, payload.threadRootMessageIndex)
            .then(() => undefined),
    claimPrize: (payload, agent) =>
        agent.claimPrize(payload.chatId, payload.messageId, payload.signInProof),
    payForDiamondMembership: (payload, agent) =>
        agent.payForDiamondMembership(
            payload.userId,
            payload.ledger,
            payload.duration,
            payload.recurring,
            payload.expectedPriceE8s,
            payload.fromAccount,
            payload.pin,
        ),
    updateMarketMakerConfig: (payload, agent) => agent.updateMarketMakerConfig(payload),
    setMessageReminder: (payload, agent) =>
        agent.setMessageReminder(
            payload.chatId,
            payload.eventIndex,
            payload.remindAt,
            payload.notes,
            payload.threadRootMessageIndex,
        ),
    cancelMessageReminder: (payload, agent) => agent.cancelMessageReminder(payload.reminderId),
    reportMessage: (payload, agent) =>
        agent.reportMessage(
            payload.chatId,
            payload.threadRootMessageIndex,
            payload.messageId,
            payload.deleteMessage,
            payload.csam,
        ),
    approveTransfer: (payload, agent) =>
        agent.approveTransfer(
            payload.spender,
            payload.ledger,
            payload.amount,
            payload.expiresIn,
            payload.pin,
        ),
    approveAccessGatePayment: (payload, agent) =>
        agent.approveAccessGatePayment(
            payload.canisterId,
            payload.ledger,
            payload.amount,
            payload.expiresIn,
            payload.pin,
        ),
    declineInvitation: (payload, agent) => agent.declineInvitation(payload.chatId),
    // Community level functions
    addMembersToChannel: (payload, agent) =>
        agent.communityClient.addMembersToChannel(
            payload.chatId,
            payload.userIds,
            payload.username,
            payload.displayName,
        ),
    blockCommunityUser: (payload, agent) =>
        agent.communityClient.blockUser(payload.id.communityId, payload.userId),
    changeChannelRole: (payload, agent) =>
        agent.communityClient.changeChannelRole(payload.chatId, payload.userId, payload.newRole),
    changeCommunityRole: (payload, agent) =>
        agent.communityClient.changeRole(payload.id.communityId, payload.userId, payload.newRole),
    declineChannelInvitation: (payload, agent) =>
        agent.communityClient.declineInvitation(payload.chatId),
    removeCommunityMember: (payload, agent) =>
        agent.communityClient.removeMember(payload.id.communityId, payload.userId),
    unblockCommunityUser: (payload, agent) =>
        agent.communityClient.unblockUser(payload.id.communityId, payload.userId),
    updateCommunity: (payload, agent) =>
        agent.communityClient.updateCommunity(
            payload.communityId,
            payload.name,
            payload.description,
            payload.rules,
            payload.permissions,
            payload.avatar,
            payload.banner,
            payload.gateConfig,
            payload.isPublic,
            payload.primaryLanguage,
        ),
    createCommunity: (payload, agent) =>
        agent.userClient.createCommunity(
            payload.community,
            payload.rules,
            payload.defaultChannels,
            payload.defaultChannelRules,
        ),
    getCommunitySummary: (payload, agent) => agent.getCommunitySummary(payload.communityId),
    getChannelSummary: (payload, agent) => agent.getChannelSummary(payload.chatId),
    exploreChannels: (payload, agent) =>
        agent.exploreChannels(payload.id, payload.searchTerm, payload.pageSize, payload.pageIndex),
    getCommunityDetails: (payload, agent) =>
        agent.communityClient.getCommunityDetails(
            payload.id.communityId,
            payload.detailsLastUpdated,
            payload.detailsSyncedUpTo,
        ),
    addToFavourites: (payload, agent) =>
        agent.userClient.manageFavouriteChats([payload.chatId], []),
    removeFromFavourites: (payload, agent) =>
        agent.userClient.manageFavouriteChats([], [payload.chatId]),
    leaveCommunity: (payload, agent) => agent.userClient.leaveCommunity(payload.id),
    deleteCommunity: (payload, agent) => agent.userClient.deleteCommunity(payload.id),
    convertGroupToCommunity: (payload, agent) =>
        agent.convertGroupToCommunity(payload.chatId, payload.historyVisible, payload.rules),
    importGroupToCommunity: (payload, agent) =>
        agent.communityClient.importGroup(payload.communityId.communityId, payload.groupId),
    setModerationFlags: (payload, agent) => agent.setModerationFlags(payload.flags),
    proposeSetOpenAIApiKey: (payload, agent) => agent.proposeSetOpenAIApiKey(payload.apiKey),
    confirmProtectedAction: (payload, agent) => agent.confirmProtectedAction(payload.actionId),
    cancelProtectedAction: (payload, agent) => agent.cancelProtectedAction(payload.actionId),
    protectedActions: (_payload, agent) => agent.protectedActions(),
    setModerationReferralConfig: (payload, agent) =>
        agent.setModerationReferralConfig(payload.config),
    proposeSetVaultLegalHold: (payload, agent) =>
        agent.proposeSetVaultLegalHold(payload.reportIndex, payload.legalHold, payload.reference),
    proposeSetVaultReviewers: (payload, agent) => agent.proposeSetVaultReviewers(payload.userIds),
    proposeSetMediaScanConfig: (payload, agent) =>
        agent.proposeSetMediaScanConfig(payload.enabled, payload.scanners),
    proposeSetAuthorityReporter: (payload, agent) =>
        agent.proposeSetAuthorityReporter(payload.principal),
    setVaultLegalHold: (payload, agent) =>
        agent.setVaultLegalHold(payload.reportIndex, payload.legalHold, payload.reference),
    proposeDestroyVaultEvidence: (payload, agent) =>
        agent.proposeDestroyVaultEvidence(payload.reportIndex, payload.leRequestRef),
    vaultBuckets: (_payload, agent) => agent.vaultBuckets(),
    vaultLog: (payload, agent) =>
        agent.vaultLog(payload.bucketCanisterId, payload.start, payload.max, payload.fileId),
    moderationConfig: (_payload, agent) => agent.moderationConfig(),
    authorityReports: (_payload, agent) => agent.authorityReports(),
    recordAuthorityReportFiled: (payload, agent) =>
        agent.recordAuthorityReportFiled(
            payload.reportIndex,
            payload.portalReference,
            payload.urgent,
            payload.unverified,
        ),
    clearAuthorityReportAttempt: (payload, agent) =>
        agent.clearAuthorityReportAttempt(payload.reportIndex),
    authorityReportToken: (payload, agent) =>
        agent.authorityReportToken(
            payload.reportIndex,
            payload.priority,
            payload.reporter,
            payload.oohCallAcknowledged,
        ),
    acceptTerms: (payload, agent) => agent.acceptTerms(payload.version),
    proposeSetInternalModerationChannel: (payload, agent) =>
        agent.proposeSetInternalModerationChannel(payload.channel),
    resolveModerationReport: (payload, agent) =>
        agent.resolveModerationReport(payload.reportIndex, payload.verdict, payload.urgent),
    contestModerationSanction: (_payload, agent) => agent.contestModerationSanction(),
    vaultFileChunk: (payload, agent) =>
        agent.vaultFileChunk(payload.bucketCanisterId, payload.fileId, payload.chunkIndex),
    vaultFileInfo: (payload, agent) =>
        agent.vaultFileInfo(payload.bucketCanisterId, payload.fileId),
    updateRegistry: (_payload, agent) => agent.getRegistry(),
    setCommunityIndexes: (payload, agent) => agent.setCommunityIndexes(payload.indexes),
    createUserGroup: (payload, agent) =>
        agent.createUserGroup(payload.communityId, payload.name, payload.userIds),
    updateUserGroup: (payload, agent) =>
        agent.updateUserGroup(
            payload.communityId,
            payload.userGroupId,
            payload.name,
            payload.usersToAdd,
            payload.usersToRemove,
        ),
    deleteUserGroups: (payload, agent) =>
        agent.deleteUserGroups(payload.communityId, payload.userGroupIds),
    setMemberDisplayName: (payload, agent) =>
        agent.setMemberDisplayName(
            payload.communityId,
            payload.displayName,
            payload.newAchievement,
        ),
    followThread: (payload, agent) =>
        agent.followThread(
            payload.chatId,
            payload.threadRootMessageIndex,
            payload.follow,
            payload.newAchievement,
        ),
    submitProposal: (payload, agent) =>
        agent.submitProposal(
            payload.currentUserId,
            payload.governanceCanisterId,
            payload.proposal,
            payload.ledger,
            payload.token,
            payload.proposalRejectionFee,
            payload.transactionFee,
        ),
    tipMessage: (payload, agent) =>
        agent.tipMessage(
            payload.messageContext,
            payload.messageId,
            payload.transfer,
            payload.decimals,
            payload.pin,
            payload.username,
            payload.displayName,
            payload.newAchievement,
        ),
    loadSavedCryptoAccounts: (_payload, agent) => agent.userClient.loadSavedCryptoAccounts(),
    saveCryptoAccount: (payload, agent) => agent.userClient.saveCryptoAccount(payload.namedAccount),
    deleteCryptoAccount: (payload, agent) => agent.userClient.deleteCryptoAccount(payload.name),
    canSwap: (payload, agent) => agent.canSwap(payload.tokenLedgers),
    getTokenSwaps: (payload, agent) =>
        agent.getTokenSwaps(payload.inputTokenLedger, payload.outputTokenLedgers),
    getTokenSwapQuote: (payload, agent) =>
        agent.getTokenSwapQuote(
            payload.dex,
            payload.inputTokenLedger,
            payload.outputTokenLedger,
            payload.amountIn,
            payload.outputTokenFee,
        ),
    swapTokens: (payload, agent) =>
        agent.swapTokens(
            payload.swapId,
            payload.inputTokenDetails,
            payload.outputTokenDetails,
            payload.amountIn,
            payload.minAmountOut,
            payload.dex,
            payload.pin,
        ),
    recoverUnfinishedTokenSwaps: (_payload, agent) => agent.recoverUnfinishedTokenSwaps(),
    deleteDirectChat: (payload, agent) => agent.deleteDirectChat(payload.userId, payload.blockUser),
    diamondMembershipFees: (_payload, agent) => agent.diamondMembershipFees(),
    reportedMessages: (payload, agent) => agent.reportedMessages(payload.userId),
    exchangeRates: (_payload, agent) => agent.exchangeRates(),
    proposeTranslation: (payload, agent) =>
        agent.translationsClient().propose(payload.locale, payload.key, payload.value),
    approveTranslation: (payload, agent) => agent.translationsClient().approve(payload.id),
    rejectTranslation: (payload, agent) =>
        agent.translationsClient().reject(payload.id, payload.reason),
    getProposedTranslations: (_payload, agent) => agent.translationsClient().proposed(),
    markTranslationsDeployed: (_payload, agent) => agent.translationsClient().markDeployed(),
    getTranslationsPendingDeployment: (_payload, agent) =>
        agent.translationsClient().pendingDeployment(),
    acceptP2PSwap: (payload, agent) =>
        agent.acceptP2PSwap(
            payload.chatId,
            payload.threadRootMessageIndex,
            payload.messageId,
            payload.token1,
            payload.token1Amount,
            payload.pin,
            payload.newAchievement,
            payload.fromAccount,
        ),
    cancelP2PSwap: (payload, agent) =>
        agent.cancelP2PSwap(payload.chatId, payload.threadRootMessageIndex, payload.messageId),
    joinVideoCall: (payload, agent) =>
        agent.joinVideoCall(payload.chatId, payload.messageId, payload.newAchievement),
    videoCallParticipants: (payload, agent) =>
        agent.videoCallParticipants(payload.chatId, payload.messageId, payload.updatesSince),
    setVideoCallPresence: (payload, agent) =>
        agent.setVideoCallPresence(
            payload.chatId,
            payload.messageId,
            payload.presence,
            payload.newAchievement,
        ),
    getAccessToken: (payload, agent) =>
        agent.getAccessToken(payload.accessTokenType, payload.localUserIndex),
    registerWebhook: (payload, agent) =>
        agent.registerWebhook(payload.chatId, payload.name, payload.avatar),
    updateWebhook: (payload, agent) =>
        agent.updateWebhook(payload.chatId, payload.id, payload.name, payload.avatar),
    regenerateWebhook: (payload, agent) => agent.regenerateWebhook(payload.chatId, payload.id),
    deleteWebhook: (payload, agent) => agent.deleteWebhook(payload.chatId, payload.id),
    getWebhook: (payload, agent) => agent.getWebhook(payload.chatId, payload.id),
    getLocalUserIndexForUser: (payload, agent) => agent.getLocalUserIndexForUser(payload.userId),
    generateBtcAddress: (_payload, agent) => agent.generateBtcAddress(),
    generateOneSecAddress: (_payload, agent) => agent.generateOneSecAddress(),
    generateSolAddress: (_payload, agent) => agent.generateSolAddress(),
    updateBtcBalance: (payload, agent) =>
        agent.updateBtcBalance(payload.userId, payload.bitcoinAddress),
    updateSolBalance: (_payload, agent) => agent.updateSolBalance(),
    withdrawBtc: (payload, agent) =>
        agent.withdrawBtc(payload.address, payload.amount, payload.pin),
    withdrawSol: (payload, agent) =>
        agent.withdrawSol(payload.address, payload.amount, payload.pin),
    withdrawViaOneSec: (payload, agent) =>
        agent.withdrawViaOneSec(
            payload.ledger,
            payload.tokenSymbol,
            payload.chain,
            payload.address,
            payload.amount,
            payload.pin,
        ),
    ckbtcMinterDepositInfo: (_payload, agent) => agent.getCkbtcMinterDepositInfo(),
    ckbtcMinterWithdrawalInfo: (payload, agent) =>
        agent.getCkbtcMinterWithdrawalInfo(payload.amount),
    cksolMinterDepositInfo: (_payload, agent) => agent.getCksolMinterDepositInfo(),
    cksolMinterWithdrawalInfo: (_payload, agent) => agent.getCksolMinterWithdrawalInfo(),
    currentUserWebAuthnKey: (_payload) => {
        // TODO add type for the `res`
        return (
            identityAgent?.checkAuthPrincipal().then((res) => {
                return res.kind === "success" ? res.webAuthnKey : undefined;
            }) ?? Promise.resolve(undefined)
        );
    },
    lookupWebAuthnPubKey: (payload, _agent, config) =>
        IdentityAgent.create(
            new AnonymousIdentity(),
            config.identityCanister,
            config.icUrl,
            undefined,
        ).then((ia) => ia.lookupWebAuthnPubKey(payload.credentialId)),
    setCachedWebAuthnKey: (payload) => setCachedWebAuthnKey(payload.key),
    generateMagicLink: (payload, agent) =>
        agent.generateMagicLink(payload.email, payload.sessionKey),
    getSignInWithEmailDelegation: (payload, agent) =>
        agent.getSignInWithEmailDelegation(payload.email, payload.sessionKey, payload.expiration),
    siwePrepareLogin: (payload, agent) => agent.siwePrepareLogin(payload.address),
    siwsPrepareLogin: (payload, agent) => agent.siwsPrepareLogin(payload.address),
    loginWithWallet: (payload, agent) =>
        agent.loginWithWallet(
            payload.token,
            payload.address,
            payload.signature,
            payload.sessionKey,
        ),
    getDelegationWithWallet: (payload, agent) =>
        agent.getDelegationWithWallet(
            payload.token,
            payload.address,
            payload.sessionKey,
            payload.expiration,
        ),
    setPinNumber: (payload, agent) => agent.setPinNumber(payload.verification, payload.newPin),
    claimDailyChit: (payload, agent) => agent.claimDailyChit(payload.utcOffsetMins),
    chitLeaderboard: (_payload, agent) => agent.chitLeaderboard(),
    getChitEvents: (payload, agent) => agent.chitEvents(payload),
    markAchievementsSeen: (_payload, agent) => agent.markAchievementsSeen(),
    submitProofOfUniquePersonhood: (payload, agent) =>
        agent.submitProofOfUniquePersonhood(payload.iiPrincipal, payload.credential),
    linkIdentities: (payload, _agent, config) =>
        linkIdentities(
            payload.initiatorKey,
            payload.initiatorDelegation,
            payload.initiatorIsIIPrincipal,
            payload.initiatorWebAuthnKey,
            payload.approverKey,
            payload.approverDelegation,
            config.identityCanister,
            config.icUrl,
        ),
    removeIdentityLink: (payload) => removeIdentityLink(payload.linked_principal),
    getAuthenticationPrincipals: (_payload, agent) => agent.getAuthenticationPrincipals(),
    configureWallet: (payload, agent) => agent.configureWallet(payload.config),
    clearCachedData: (_payload, agent) => agent.clearCachedData(),
    setCommunityReferral: (payload) =>
        setCommunityReferral(payload.communityId.communityId, payload.referredBy, Date.now()),
    getExternalAchievements: (_payload, agent) => agent.getExternalAchievements(),
    cancelInvites: (payload, agent) => agent.cancelInvites(payload.id, payload.userIds),
    messageActivityFeed: (_payload, agent) => agent.messageActivityFeed(),
    markActivityFeedRead: (payload, agent) => agent.markActivityFeedRead(payload.readUpTo),
    deleteUser: (payload, _agent, config) =>
        deleteUser(payload.identityKey, payload.delegation, config.identityCanister, config.icUrl),
    getSignInProof: (payload, _agent, config) =>
        getSignInProof(
            payload.identityKey,
            payload.delegation,
            config.identityCanister,
            config.icUrl,
        ),
    installBot: (payload, agent) =>
        agent.installBot(payload.id, payload.botId, payload.grantedPermissions),
    updateInstalledBot: (payload, agent) =>
        agent.updateInstalledBot(payload.id, payload.botId, payload.grantedPermissions),
    uninstallBot: (payload, agent) => agent.uninstallBot(payload.id, payload.botId),
    getBotDefinition: (payload) => getBotDefinition(payload.endpoint),
    callBotCommandEndpoint: (payload, agent) =>
        agent.callBotCommandEndpoint(payload.endpoint, payload.token),
    payForStreakInsurance: (payload, agent) =>
        agent.payForStreakInsurance(payload.additionalDays, payload.expectedPrice, payload.pin),
    updateDirectChatSettings: (payload, agent) =>
        agent.updateDirectChatSettings(payload.userId, payload.eventsTtl),
    updateProposalTallies: (payload, agent) => agent.updateProposalTallies(payload.chatId),
    createAccountLinkingCode: (_payload) =>
        identityAgent?.createAccountLinkingCode() ?? Promise.resolve(undefined),
    reinstateMissedDailyClaims: (payload, agent) =>
        agent.reinstateMissedDailyClaims(payload.userId, payload.days),
    verifyAccountLinkingCode: (payload, _agent, config) =>
        verifyAccountLinkingCode(
            payload.code,
            payload.tempKey,
            config.identityCanister,
            config.icUrl,
        ),
    finaliseAccountLinkingWithCode: (payload, _agent, config) =>
        finaliseAccountLinkingWithCode(
            payload.tempKey,
            payload.principal,
            payload.publicKey,
            payload.webAuthnKey,
            config.identityCanister,
            config.icUrl,
        ),
    payForPremiumItem: (payload, agent) => agent.payForPremiumItem(payload.userId, payload.item),
    dailyPuzzleFetch: (payload, agent) => agent.dailyPuzzleFetch(payload.userId),
    dailyPuzzleStart: (payload, agent) =>
        agent.dailyPuzzleStart(
            payload.userId,
            payload.gameId,
            payload.number,
            payload.expectedEntryFee,
        ),
    dailyPuzzleSubmit: (payload, agent) =>
        agent.dailyPuzzleSubmit(payload.userId, payload.gameId, payload.number, payload.grid),
    dailyPuzzleHint: (payload, agent) =>
        agent.dailyPuzzleHint(
            payload.userId,
            payload.gameId,
            payload.number,
            payload.level,
            payload.filled,
            payload.expectedPrice,
        ),
    dailyPuzzleSaveGrid: (payload, agent) =>
        agent.dailyPuzzleSaveGrid(payload.userId, payload.gameId, payload.number, payload.grid),
    dailyPuzzleCurrent: (_payload, agent) => agent.dailyPuzzleCurrent(),
    dailyPuzzleResults: (payload, agent) =>
        agent.dailyPuzzleResults(payload.gameId, payload.number, payload.userIds),
    dailyPuzzleConfig: (_payload, agent) => agent.dailyPuzzleConfig(),
    dailyPuzzleSetEnabled: (payload, agent) => agent.dailyPuzzleSetEnabled(payload.enabled),
    callPushEnabled: (_payload, agent) => agent.callPushEnabled(),
    setCallPushEnabled: (payload, agent) => agent.setCallPushEnabled(payload.enabled),
    setAlchemyApiKey: (payload, agent) => agent.setAlchemyApiKey(payload.apiKey),
    setBridgeBot: (payload, agent) => agent.setBridgeBot(payload.platform, payload.botId),
    getBridgedUsers: (payload, agent) => agent.getBridgedUsers(payload.ids),
    dailyPuzzleRegenerateToday: (payload, agent) =>
        agent.dailyPuzzleRegenerateToday(payload.gameId),
    setPremiumItemCost: (payload, agent) =>
        agent.setPremiumItemCost(payload.item, payload.chitCost),
    oneSecEnableForwarding: (payload, agent) =>
        agent.oneSecEnableForwarding(payload.userId, payload.evmAddress),
    oneSecGetTransferFees: (_payload, agent) => agent.oneSecGetTransferFees(),
    oneSecForwardEvmToIcp: (payload, agent) =>
        agent.oneSecForwardEvmToIcp(
            payload.tokenSymbol,
            payload.chain,
            payload.address,
            payload.receiver,
        ),
    oneSecGetForwardingStatus: (payload, agent) =>
        agent.oneSecGetForwardingStatus(
            payload.tokenSymbol,
            payload.chain,
            payload.address,
            payload.receiver,
        ),
    updateBlockedUsernamePatterns: (payload, agent) =>
        agent.updateBlockedUsernamePatterns(payload.pattern, payload.add),
};

function getAction<K extends AgentRequestKind>(
    kind: K,
    payload: RequestOf<K>,
    agent: OpenChatAgent,
    config: AgentConfig,
): Action<K> {
    const handler: Handlers[K] | undefined = handlers[kind];
    if (handler === undefined) {
        // a request from a client built with a newer worker contract than this worker
        logger.debug("WORKER: unknown message kind received: ", kind);
        return Promise.resolve(undefined) as Action<K>;
    }
    return handler(payload, agent, config);
}

async function verifyAccountLinkingCode(
    code: string,
    tempKey: CryptoKeyPair,
    identityCanister: string,
    icUrl: string,
): Promise<VerifyAccountLinkingCodeResponse> {
    const ecdsaIdentity = await ECDSAKeyIdentity.fromKeyPair(tempKey);
    const identityAgent = await IdentityAgent.create(ecdsaIdentity, identityCanister, icUrl, false);

    return await identityAgent.verifyAccountLinkingCode(code);
}

async function finaliseAccountLinkingWithCode(
    tempKey: CryptoKeyPair,
    principal: string,
    publicKey: Uint8Array,
    webAuthnKey: WebAuthnKeyFull | undefined,
    identityCanister: string,
    icUrl: string,
): Promise<FinaliseAccountLinkingResponse> {
    const ecdsaIdentity = await ECDSAKeyIdentity.fromKeyPair(tempKey);
    const identityAgent = await IdentityAgent.create(ecdsaIdentity, identityCanister, icUrl, false);

    const delegationIdentity = await identityAgent.finaliseAccountLinkingWithCode(
        principal,
        publicKey,
        ecdsaIdentity,
        webAuthnKey,
    );

    const delegationChain = delegationIdentity.getDelegation();

    await ocIdentityStorage.set(
        ecdsaIdentity,
        delegationChain,
        ecdsaIdentity.getPrincipal().toString(),
    );

    return { kind: "success" };
}

async function linkIdentities(
    initiatorKey: CryptoKeyPair,
    initiatorDelegation: JsonnableDelegationChain,
    initiatorIsIIPrincipal: boolean,
    initiatorWebAuthnKey: WebAuthnKey | undefined,
    approverKey: CryptoKeyPair,
    approverDelegation: JsonnableDelegationChain,
    identityCanister: string,
    icUrl: string,
): Promise<LinkIdentitiesResponse> {
    const initiatorIdentity = DelegationIdentity.fromDelegation(
        await ECDSAKeyIdentity.fromKeyPair(initiatorKey),
        DelegationChain.fromJSON(initiatorDelegation),
    );
    const initiatorAgent = await IdentityAgent.create(
        initiatorIdentity,
        identityCanister,
        icUrl,
        initiatorIsIIPrincipal,
    );

    const approverIdentity = DelegationIdentity.fromDelegation(
        await ECDSAKeyIdentity.fromKeyPair(approverKey),
        DelegationChain.fromJSON(approverDelegation),
    );
    const approverAgent = await IdentityAgent.create(
        approverIdentity,
        identityCanister,
        icUrl,
        undefined,
    );

    const approver = approverIdentity.getPrincipal().toString();
    const initiateResponse = await initiatorAgent.initiateIdentityLink(
        approver,
        initiatorWebAuthnKey?.credentialId,
    );
    if (initiateResponse !== "success") {
        return initiateResponse;
    }

    const initiatorPrincipal =
        initiatorWebAuthnKey !== undefined
            ? Principal.selfAuthenticating(initiatorWebAuthnKey.publicKey)
            : initiatorIdentity.getPrincipal();

    return await approverAgent.approveIdentityLink(initiatorPrincipal.toString());
}

async function removeIdentityLink(linked_principal: string): Promise<RemoveIdentityLinkResponse> {
    if (identityAgent) {
        return identityAgent.removeIdentityLink(linked_principal);
    }

    throw new Error("IdentityAgent not initialized");
}

async function deleteUser(
    identityKey: CryptoKeyPair,
    delegation: JsonnableDelegationChain,
    identityCanister: string,
    icUrl: string,
): Promise<boolean> {
    const identity = DelegationIdentity.fromDelegation(
        await ECDSAKeyIdentity.fromKeyPair(identityKey),
        DelegationChain.fromJSON(delegation),
    );
    const identityAgent = await IdentityAgent.create(identity, identityCanister, icUrl, undefined);
    const response = await identityAgent.deleteUser();
    return response.kind === "success";
}

async function getSignInProof(
    identityKey: CryptoKeyPair,
    delegation: JsonnableDelegationChain,
    identityCanister: string,
    icUrl: string,
): Promise<string | undefined> {
    const identity = DelegationIdentity.fromDelegation(
        await ECDSAKeyIdentity.fromKeyPair(identityKey),
        DelegationChain.fromJSON(delegation),
    );
    const identityAgent = await IdentityAgent.create(identity, identityCanister, icUrl, undefined);
    const sessionKey = await ECDSAKeyIdentity.generate();

    const getIdentityResult = await identityAgent.getOpenChatIdentity(sessionKey);
    return getIdentityResult?.signInProofJwt;
}
