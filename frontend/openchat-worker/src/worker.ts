import { AnonymousIdentity, SignIdentity } from "@dfinity/agent";
import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import {
    DelegationChain,
    DelegationIdentity,
    ECDSAKeyIdentity,
    type JsonnableDelegationChain,
} from "@dfinity/identity";
import { IdentityAgent, OpenChatAgent, setCommunityReferral } from "openchat-agent";
import {
    type CorrelatedWorkerRequest,
    type Init,
    type Logger,
    MessagesReadFromServer,
    StorageUpdated,
    UsersLoaded,
    type WorkerEvent,
    inititaliseLogger,
    type WorkerResponseInner,
    type WorkerRequest,
    Stream,
    IdentityStorage,
    type GetOpenChatIdentityResponse,
    type ChallengeAttempt,
    type CreateOpenChatIdentityError,
    type LinkIdentitiesResponse,
    AuthProvider,
} from "openchat-shared";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const authClient = AuthClient.create({
    idleOptions: {
        disableIdle: true,
    },
    storage: new IdbStorage(),
});

const ocIdentityStorage = new IdentityStorage();

let initPayload: Init | undefined = undefined;
let identityAgent: IdentityAgent | undefined = undefined;
let authPrincipalString: string | undefined = undefined;
let logger: Logger | undefined = undefined;
let agent: OpenChatAgent | undefined = undefined;
let identityCanister: string = "";
let icUrl: string = "";

async function initialize(
    expectedAuthPrincipal: string,
    authProvider: AuthProvider | undefined,
    _identityCanister: string,
    _icUrl: string,
): Promise<GetOpenChatIdentityResponse> {
    identityCanister = _identityCanister;
    icUrl = _icUrl;

    const authProviderIdentity = await authClient.then((a) => a.getIdentity());
    const authPrincipal = authProviderIdentity.getPrincipal();
    authPrincipalString = authPrincipal.toString();

    if (authPrincipal.isAnonymous() || authPrincipalString !== expectedAuthPrincipal) {
        return { kind: "auth_identity_not_found" };
    }

    identityAgent = await IdentityAgent.create(
        authProviderIdentity as SignIdentity,
        identityCanister,
        icUrl,
        authProvider === undefined ? undefined : authProvider === AuthProvider.II,
    );

    const ocIdentity = await ocIdentityStorage.get(authPrincipalString);
    if (ocIdentity !== undefined) {
        return { kind: "success", identity: ocIdentity };
    }

    const ocIdentityExists = await identityAgent.checkOpenChatIdentityExists();
    if (ocIdentityExists) {
        const sessionKey = await ECDSAKeyIdentity.generate();

        const identity = await identityAgent.getOpenChatIdentity(sessionKey);

        if (identity !== undefined && typeof identity !== "string") {
            await ocIdentityStorage.set(authPrincipalString, sessionKey, identity.getDelegation());
            return { kind: "success", identity };
        }
    }

    return { kind: "oc_identity_not_found" };
}

async function createOpenChatIdentity(
    challengeAttempt: ChallengeAttempt | undefined,
): Promise<DelegationIdentity | CreateOpenChatIdentityError> {
    if (identityAgent === undefined || authPrincipalString === undefined) {
        throw new Error("IdentityAgent not initialized");
    }

    const sessionKey = await ECDSAKeyIdentity.generate();

    const response = await identityAgent.createOpenChatIdentity(sessionKey, challengeAttempt);

    if (typeof response !== "string") {
        await ocIdentityStorage.set(authPrincipalString, sessionKey, response.getDelegation());
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
}

const sendError = (correlationId: string, payload?: unknown) => {
    return (error: unknown) => {
        logger?.error("WORKER: error caused by payload: ", error, payload);
        postMessage({
            kind: "worker_error",
            correlationId,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
    };
};

function streamReplies(
    payload: WorkerRequest,
    correlationId: string,
    chain: Stream<WorkerResponseInner>,
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
            sendResponse(correlationId, value, final);
        },
        onError: sendError(correlationId, payload),
    });
}

function executeThenReply(
    payload: WorkerRequest,
    correlationId: string,
    promise: Promise<WorkerResponseInner>,
) {
    promise
        .then((response) => sendResponse(correlationId, response))
        .catch(sendError(correlationId, payload));
}

function sendResponse(correlationId: string, response: WorkerResponseInner, final = true): void {
    logger?.debug("WORKER: sending response: ", correlationId);
    postMessage({
        kind: "worker_response",
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

self.addEventListener("error", (err: ErrorEvent) => {
    logger?.error("WORKER: unhandled error: ", err);
});

self.addEventListener("unhandledrejection", (err: PromiseRejectionEvent) => {
    logger?.error("WORKER: unhandled promise rejection: ", err);
});

self.addEventListener("message", (msg: MessageEvent<CorrelatedWorkerRequest>) => {
    (logger ?? console).debug("WORKER: received ", msg.data.kind, msg.data.correlationId);
    const payload = msg.data;
    const kind = payload.kind;
    const correlationId = payload.correlationId;

    try {
        if (kind === "init") {
            initPayload = payload;
            const init = payload;
            executeThenReply(
                payload,
                correlationId,
                initialize(
                    init.authPrincipal,
                    init.authProvider,
                    init.identityCanister,
                    init.icUrl,
                ).then((resp) => {
                    const id = resp.kind === "success" ? resp.identity : new AnonymousIdentity();
                    console.debug(
                        "anon: init worker",
                        id.getPrincipal().toString(),
                        id?.getPrincipal().isAnonymous(),
                    );
                    logger = inititaliseLogger(init.rollbarApiKey, init.websiteVersion, init.env);
                    logger?.debug("WORKER: constructing agent instance");
                    agent = new OpenChatAgent(id, {
                        ...init,
                        logger,
                    });
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    return resp.kind;
                }),
            );
            return;
        }

        if (initPayload === undefined) {
            throw new Error("Worker not initialised");
        }

        if (payload.kind === "generateIdentityChallenge") {
            if (identityAgent === undefined) {
                throw new Error("IdentityAgent not initialized");
            }

            executeThenReply(payload, correlationId, identityAgent.generateChallenge());
            return;
        }

        if (kind === "createOpenChatIdentity") {
            executeThenReply(
                payload,
                correlationId,
                createOpenChatIdentity(payload.challengeAttempt).then((resp) => {
                    const id = typeof resp !== "string" ? resp : new AnonymousIdentity();
                    agent = new OpenChatAgent(id, {
                        ...initPayload!,
                        logger: logger!,
                    });
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    return typeof resp !== "string" ? "success" : resp;
                }),
            );
            return;
        }

        if (!agent) {
            logger?.debug("WORKER: agent does not exist: ", msg.data);
            return;
        }

        switch (kind) {
            case "getCurrentUser":
                streamReplies(payload, correlationId, agent.getCurrentUser());
                break;

            case "getDeletedGroupMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getDeletedGroupMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex,
                    ),
                );
                break;

            case "getDeletedDirectMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getDeletedDirectMessage(payload.userId, payload.messageId),
                );
                break;

            case "getUpdates":
                streamReplies(payload, correlationId, agent.getUpdates(payload.initialLoad));
                break;

            case "createUserClient":
                agent.createUserClient(payload.userId);
                sendResponse(correlationId, undefined);
                break;

            case "chatEvents":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.chatEvents(
                        payload.chatId,
                        payload.eventIndexRange,
                        payload.startIndex,
                        payload.ascending,
                        payload.threadRootMessageIndex,
                        payload.latestKnownUpdate,
                    ),
                );
                break;

            case "getUsers":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getUsers(payload.chitState, payload.users, payload.allowStale),
                );
                break;

            case "getAllCachedUsers":
                executeThenReply(payload, correlationId, agent.getAllCachedUsers());
                break;

            case "markMessagesRead":
                executeThenReply(payload, correlationId, agent.markMessagesRead(payload.payload));
                break;

            case "getGroupDetails":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getGroupDetails(payload.chatId, payload.chatLastUpdated),
                );
                break;

            case "lastOnline":
                executeThenReply(payload, correlationId, agent.lastOnline(payload.userIds));
                break;

            case "markAsOnline":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.markAsOnline().then(() => undefined),
                );
                break;

            case "chatEventsBatch":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.chatEventsBatch(
                        payload.localUserIndex,
                        payload.requests,
                        payload.cachePrimer,
                    ),
                );
                break;

            case "chatEventsWindow":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.chatEventsWindow(
                        payload.eventIndexRange,
                        payload.chatId,
                        payload.messageIndex,
                        payload.threadRootMessageIndex,
                        payload.latestKnownUpdate,
                    ),
                );
                break;

            case "chatEventsByEventIndex":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.chatEventsByEventIndex(
                        payload.chatId,
                        payload.eventIndexes,
                        payload.threadRootMessageIndex,
                        payload.latestKnownUpdate,
                    ),
                );
                break;

            case "rehydrateMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.rehydrateMessage(
                        payload.chatId,
                        payload.message,
                        payload.threadRootMessageIndex,
                        payload.latestKnownUpdate,
                    ),
                );
                break;

            case "checkUsername":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.checkUsername(payload.username, payload.isBot),
                );
                break;

            case "searchUsers":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.searchUsers(payload.searchTerm, payload.maxResults),
                );
                break;

            case "getUserStorageLimits":
                executeThenReply(payload, correlationId, agent.getUserStorageLimits());
                break;

            case "getPublicGroupSummary":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getPublicGroupSummary(payload.chatId),
                );
                break;

            case "toggleMuteNotifications":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.toggleMuteNotifications(payload.id, payload.muted),
                );
                break;

            case "archiveChat":
                executeThenReply(payload, correlationId, agent.archiveChat(payload.chatId));
                break;

            case "unarchiveChat":
                executeThenReply(payload, correlationId, agent.unarchiveChat(payload.chatId));
                break;

            case "pinChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.pinChat(payload.chatId, payload.favourite),
                );
                break;

            case "unpinChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.unpinChat(payload.chatId, payload.favourite),
                );
                break;

            case "blockUserFromDirectChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.blockUserFromDirectChat(payload.userId),
                );
                break;

            case "unblockUserFromDirectChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.unblockUserFromDirectChat(payload.userId),
                );
                break;

            case "setUserAvatar":
                executeThenReply(payload, correlationId, agent.setUserAvatar(payload.data));
                break;

            case "deleteGroup":
                executeThenReply(payload, correlationId, agent.deleteGroup(payload.chatId));
                break;

            case "leaveGroup":
                executeThenReply(payload, correlationId, agent.leaveGroup(payload.chatId));
                break;

            case "joinGroup":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.joinGroup(payload.chatId, payload.credentialArgs),
                );
                break;

            case "joinCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.joinCommunity(payload.id, payload.credentialArgs),
                );
                break;

            case "updateGroup":
                executeThenReply(
                    payload,
                    correlationId,
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
                );
                break;

            case "registerPollVote":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.registerPollVote(
                        payload.chatId,
                        payload.messageIdx,
                        payload.answerIdx,
                        payload.voteType,
                        payload.threadRootMessageIndex,
                        payload.newAchievement,
                    ),
                );
                break;

            case "deleteMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.deleteMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex,
                        payload.asPlatformModerator,
                        payload.newAchievement,
                    ),
                );
                break;

            case "undeleteMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.undeleteMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex,
                    ),
                );
                break;

            case "addReaction":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.addReaction(
                        payload.chatId,
                        payload.messageId,
                        payload.reaction,
                        payload.username,
                        payload.displayName,
                        payload.threadRootMessageIndex,
                        payload.newAchievement,
                    ),
                );
                break;

            case "removeReaction":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.removeReaction(
                        payload.chatId,
                        payload.messageId,
                        payload.reaction,
                        payload.threadRootMessageIndex,
                    ),
                );
                break;

            case "blockUserFromGroupChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.blockUserFromGroupChat(payload.chatId, payload.userId),
                );
                break;

            case "unblockUserFromGroupChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.unblockUserFromGroupChat(payload.chatId, payload.userId),
                );
                break;

            case "getProposalVoteDetails":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getProposalVoteDetails(
                        payload.governanceCanisterId,
                        payload.proposalId,
                        payload.isNns,
                    ),
                );
                break;

            case "listNervousSystemFunctions":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.listNervousSystemFunctions(payload.snsGovernanceCanisterId),
                );
                break;

            case "unpinMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.unpinMessage(payload.chatId, payload.messageIndex),
                );
                break;

            case "pinMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.pinMessage(payload.chatId, payload.messageIndex),
                );
                break;

            case "sendMessage":
                streamReplies(
                    payload,
                    correlationId,
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
                );
                break;

            case "editMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.editMessage(
                        payload.chatId,
                        payload.msg,
                        payload.threadRootMessageIndex,
                        payload.blockLevelMarkdown,
                        payload.newAchievement,
                    ),
                );
                break;

            case "registerUser":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.registerUser(payload.username, payload.referralCode),
                );
                break;

            case "subscriptionExists":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.subscriptionExists(payload.p256dh_key),
                );
                break;

            case "pushSubscription":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.pushSubscription(payload.subscription).then(() => undefined),
                );
                break;

            case "removeSubscription":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.removeSubscription(payload.subscription).then(() => undefined),
                );
                break;

            case "inviteUsers":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.inviteUsers(payload.id, payload.userIds, payload.callerUsername),
                );
                break;

            case "removeMember":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.removeMember(payload.chatId, payload.userId),
                );
                break;

            case "changeRole":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.changeRole(payload.chatId, payload.userId, payload.newRole),
                );
                break;

            case "registerProposalVote":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.registerProposalVote(payload.chatId, payload.messageIndex, payload.adopt),
                );
                break;

            case "getRecommendedGroups":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getRecommendedGroups(payload.exclusions),
                );
                break;

            case "exploreCommunities":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.exploreCommunities(
                        payload.searchTerm,
                        payload.pageIndex,
                        payload.pageSize,
                        payload.flags,
                        payload.languages,
                    ),
                );
                break;

            case "exploreBots":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.exploreBots(payload.searchTerm, payload.pageIndex, payload.pageSize),
                );
                break;

            case "registerBot":
                executeThenReply(payload, correlationId, agent.registerBot(payload.bot));
                break;

            case "searchGroups":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.searchGroups(payload.searchTerm, payload.maxResults),
                );
                break;

            case "dismissRecommendation":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.dismissRecommendation(payload.chatId).then(() => undefined),
                );
                break;

            case "communityInvite":
                agent.communityInvite = payload.value;
                sendResponse(correlationId, undefined);
                break;

            case "groupInvite":
                agent.groupInvite = payload.value;
                sendResponse(correlationId, undefined);
                break;

            case "searchGroupChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.searchGroupChat(
                        payload.chatId,
                        payload.searchTerm,
                        payload.userIds,
                        payload.maxResults,
                    ),
                );
                break;

            case "searchDirectChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.searchDirectChat(payload.chatId, payload.searchTerm, payload.maxResults),
                );
                break;

            case "refreshAccountBalance":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.refreshAccountBalance(payload.ledger, payload.principal),
                );
                break;

            case "getAccountTransactions":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getAccountTransactions(
                        payload.ledgerIndex,
                        payload.principal,
                        payload.fromId,
                    ),
                );
                break;

            case "threadPreviews":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.threadPreviews(payload.threadsByChat),
                );
                break;

            case "getUser":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getUser(payload.chitState, payload.userId, payload.allowStale),
                );
                break;

            case "getPublicProfile":
                executeThenReply(payload, correlationId, agent.getPublicProfile(payload.userId));
                break;

            case "setUsername":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setUsername(payload.userId, payload.username),
                );
                break;

            case "setDisplayName":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setDisplayName(payload.userId, payload.displayName),
                );
                break;

            case "setBio":
                executeThenReply(payload, correlationId, agent.setBio(payload.bio));
                break;

            case "getBio":
                executeThenReply(payload, correlationId, agent.getBio(payload.userId));
                break;

            case "withdrawCryptocurrency":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.withdrawCryptocurrency(payload.domain, payload.pin),
                );
                break;

            case "getGroupMessagesByMessageIndex":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getGroupMessagesByMessageIndex(
                        payload.chatId,
                        payload.messageIndexes,
                        payload.latestKnownUpdate,
                    ),
                );
                break;

            case "getInviteCode":
                executeThenReply(payload, correlationId, agent.getInviteCode(payload.id));
                break;

            case "enableInviteCode":
                executeThenReply(payload, correlationId, agent.enableInviteCode(payload.id));
                break;

            case "disableInviteCode":
                executeThenReply(payload, correlationId, agent.disableInviteCode(payload.id));
                break;

            case "resetInviteCode":
                executeThenReply(payload, correlationId, agent.resetInviteCode(payload.id));
                break;

            case "createGroupChat":
                executeThenReply(payload, correlationId, agent.createGroupChat(payload.candidate));
                break;

            case "setCachedMessageFromNotification":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .setCachedMessageFromNotification(
                            payload.chatId,
                            payload.threadRootMessageIndex,
                            payload.message,
                        )
                        .then(() => undefined),
                );
                break;

            case "freezeGroup":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.freezeGroup(payload.chatId, payload.reason),
                );
                break;

            case "unfreezeGroup":
                executeThenReply(payload, correlationId, agent.unfreezeGroup(payload.chatId));
                break;

            case "freezeCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.freezeCommunity(payload.id, payload.reason),
                );
                break;

            case "unfreezeCommunity":
                executeThenReply(payload, correlationId, agent.unfreezeCommunity(payload.id));
                break;

            case "deleteFrozenGroup":
                executeThenReply(payload, correlationId, agent.deleteFrozenGroup(payload.chatId));
                break;

            case "addHotGroupExclusion":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.addHotGroupExclusion(payload.chatId),
                );
                break;

            case "removeHotGroupExclusion":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.removeHotGroupExclusion(payload.chatId),
                );
                break;

            case "addRemoveSwapProvider":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.addRemoveSwapProvider(payload.swapProvider, payload.add),
                );
                break;

            case "addMessageFilter":
                executeThenReply(payload, correlationId, agent.addMessageFilter(payload.regex));
                break;

            case "removeMessageFilter":
                executeThenReply(payload, correlationId, agent.removeMessageFilter(payload.id));
                break;

            case "setTokenEnabled":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setTokenEnabled(payload.ledger, payload.enabled),
                );
                break;

            case "suspendUser":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.suspendUser(payload.userId, payload.reason),
                );
                break;

            case "unsuspendUser":
                executeThenReply(payload, correlationId, agent.unsuspendUser(payload.userId));
                break;

            case "setCommunityModerationFlags":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setCommunityModerationFlags(payload.communityId, payload.flags),
                );
                break;

            case "setGroupUpgradeConcurrency":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setGroupUpgradeConcurrency(payload.value),
                );
                break;

            case "setCommunityUpgradeConcurrency":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setCommunityUpgradeConcurrency(payload.value),
                );
                break;

            case "setUserUpgradeConcurrency":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setUserUpgradeConcurrency(payload.value),
                );
                break;

            case "markLocalGroupIndexFull":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.markLocalGroupIndexFull(payload.canisterId, payload.full),
                );
                break;

            case "setDiamondMembershipFees":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setDiamondMembershipFees(payload.fees),
                );
                break;

            case "stakeNeuronForSubmittingProposals":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.stakeNeuronForSubmittingProposals(
                        payload.governanceCanisterId,
                        payload.stake,
                    ),
                );
                break;

            case "topUpNeuronForSubmittingProposals":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.topUpNeuronForSubmittingProposals(
                        payload.governanceCanisterId,
                        payload.amount,
                    ),
                );
                break;

            case "loadFailedMessages":
                executeThenReply(payload, correlationId, agent.loadFailedMessages());
                break;

            case "deleteFailedMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .deleteFailedMessage(
                            payload.chatId,
                            payload.messageId,
                            payload.threadRootMessageIndex,
                        )
                        .then(() => undefined),
                );
                break;
            case "claimPrize":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.claimPrize(payload.chatId, payload.messageId),
                );
                break;

            case "payForDiamondMembership":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.payForDiamondMembership(
                        payload.userId,
                        payload.token,
                        payload.duration,
                        payload.recurring,
                        payload.expectedPriceE8s,
                    ),
                );
                break;

            case "updateMarketMakerConfig":
                executeThenReply(payload, correlationId, agent.updateMarketMakerConfig(payload));
                break;

            case "setMessageReminder":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setMessageReminder(
                        payload.chatId,
                        payload.eventIndex,
                        payload.remindAt,
                        payload.notes,
                        payload.threadRootMessageIndex,
                    ),
                );
                break;

            case "cancelMessageReminder":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.cancelMessageReminder(payload.reminderId),
                );
                break;

            case "reportMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.reportMessage(
                        payload.chatId,
                        payload.threadRootMessageIndex,
                        payload.messageId,
                        payload.deleteMessage,
                    ),
                );
                break;

            case "approveTransfer":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.approveTransfer(
                        payload.spender,
                        payload.ledger,
                        payload.amount,
                        payload.expiresIn,
                        payload.pin,
                    ),
                );
                break;

            case "declineInvitation":
                executeThenReply(payload, correlationId, agent.declineInvitation(payload.chatId));
                break;

            // Community level functions
            case "addMembersToChannel":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.chatId.communityId)
                        .addMembersToChannel(
                            payload.chatId,
                            payload.userIds,
                            payload.username,
                            payload.displayName,
                        ),
                );
                break;

            case "blockCommunityUser":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.communityClient(payload.id.communityId).blockUser(payload.userId),
                );
                break;

            case "changeChannelRole":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.chatId.communityId)
                        .changeChannelRole(payload.chatId, payload.userId, payload.newRole),
                );
                break;

            case "changeCommunityRole":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.id.communityId)
                        .changeRole(payload.userId, payload.newRole),
                );
                break;

            case "declineChannelInvitation":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.chatId.communityId)
                        .declineInvitation(payload.chatId),
                );
                break;

            case "removeCommunityMember":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.communityClient(payload.id.communityId).removeMember(payload.userId),
                );
                break;

            case "unblockCommunityUser":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.communityClient(payload.id.communityId).unblockUser(payload.userId),
                );
                break;

            case "updateCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.communityId)
                        .updateCommunity(
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
                );
                break;

            case "createCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.createCommunity(
                        payload.community,
                        payload.rules,
                        payload.defaultChannels,
                        payload.defaultChannelRules,
                    ),
                );
                break;

            case "getCommunitySummary":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getCommunitySummary(payload.communityId),
                );
                break;

            case "getChannelSummary":
                executeThenReply(payload, correlationId, agent.getChannelSummary(payload.chatId));
                break;

            case "exploreChannels":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.exploreChannels(
                        payload.id,
                        payload.searchTerm,
                        payload.pageSize,
                        payload.pageIndex,
                    ),
                );
                break;

            case "getCommunityDetails":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.id.communityId)
                        .getCommunityDetails(payload.id, payload.communityLastUpdated),
                );
                break;

            case "addToFavourites":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.manageFavouriteChats([payload.chatId], []),
                );
                break;

            case "removeFromFavourites":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.manageFavouriteChats([], [payload.chatId]),
                );
                break;

            case "leaveCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.leaveCommunity(payload.id),
                );
                break;

            case "deleteCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.deleteCommunity(payload.id),
                );
                break;

            case "convertGroupToCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.convertGroupToCommunity(
                        payload.chatId,
                        payload.historyVisible,
                        payload.rules,
                    ),
                );
                break;

            case "importGroupToCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.communityId.communityId)
                        .importGroup(payload.groupId),
                );
                break;

            case "setModerationFlags":
                executeThenReply(payload, correlationId, agent.setModerationFlags(payload.flags));
                break;

            case "updateRegistry":
                streamReplies(payload, correlationId, agent.getRegistry());
                break;

            case "setCommunityIndexes":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setCommunityIndexes(payload.indexes),
                );
                break;

            case "createUserGroup":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.createUserGroup(payload.communityId, payload.name, payload.userIds),
                );
                break;

            case "updateUserGroup":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.updateUserGroup(
                        payload.communityId,
                        payload.userGroupId,
                        payload.name,
                        payload.usersToAdd,
                        payload.usersToRemove,
                    ),
                );
                break;

            case "deleteUserGroups":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.deleteUserGroups(payload.communityId, payload.userGroupIds),
                );
                break;

            case "setMemberDisplayName":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setMemberDisplayName(
                        payload.communityId,
                        payload.displayName,
                        payload.newAchievement,
                    ),
                );
                break;

            case "followThread":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.followThread(
                        payload.chatId,
                        payload.threadRootMessageIndex,
                        payload.follow,
                        payload.newAchievement,
                    ),
                );
                break;

            case "submitProposal":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.submitProposal(
                        payload.governanceCanisterId,
                        payload.proposal,
                        payload.ledger,
                        payload.token,
                        payload.proposalRejectionFee,
                        payload.transactionFee,
                    ),
                );
                break;

            case "getCachePrimerTimestamps":
                executeThenReply(payload, correlationId, agent.getCachePrimerTimestamps());
                break;

            case "tipMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.tipMessage(
                        payload.messageContext,
                        payload.messageId,
                        payload.transfer,
                        payload.decimals,
                        payload.pin,
                    ),
                );
                break;

            case "loadSavedCryptoAccounts":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.loadSavedCryptoAccounts(),
                );
                break;

            case "saveCryptoAccount":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.saveCryptoAccount(payload.namedAccount),
                );
                break;

            case "canSwap":
                executeThenReply(payload, correlationId, agent.canSwap(payload.tokenLedgers));
                break;

            case "getTokenSwaps":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getTokenSwaps(payload.inputTokenLedger, payload.outputTokenLedgers),
                );
                break;

            case "getTokenSwapQuotes":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getTokenSwapQuotes(
                        payload.inputTokenLedger,
                        payload.outputTokenLedger,
                        payload.amountIn,
                    ),
                );
                break;

            case "swapTokens":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.swapTokens(
                        payload.swapId,
                        payload.inputTokenDetails,
                        payload.outputTokenDetails,
                        payload.amountIn,
                        payload.minAmountOut,
                        payload.dex,
                        payload.pin,
                    ),
                );
                break;

            case "tokenSwapStatus":
                executeThenReply(payload, correlationId, agent.tokenSwapStatus(payload.swapId));
                break;

            case "deleteDirectChat":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.deleteDirectChat(payload.userId, payload.blockUser),
                );
                break;

            case "diamondMembershipFees":
                executeThenReply(payload, correlationId, agent.diamondMembershipFees());
                break;

            case "reportedMessages":
                executeThenReply(payload, correlationId, agent.reportedMessages(payload.userId));
                break;

            case "exchangeRates":
                executeThenReply(payload, correlationId, agent.exchangeRates());
                break;

            case "proposeTranslation":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.translationsClient.propose(payload.locale, payload.key, payload.value),
                );
                break;

            case "approveTranslation":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.translationsClient.approve(payload.id),
                );
                break;

            case "rejectTranslation":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.translationsClient.reject(payload.id, payload.reason),
                );
                break;

            case "getProposedTranslations":
                executeThenReply(payload, correlationId, agent.translationsClient.proposed());
                break;

            case "markTranslationsDeployed":
                executeThenReply(payload, correlationId, agent.translationsClient.markDeployed());
                break;

            case "getTranslationsPendingDeployment":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.translationsClient.pendingDeployment(),
                );
                break;

            case "acceptP2PSwap":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.acceptP2PSwap(
                        payload.chatId,
                        payload.threadRootMessageIndex,
                        payload.messageId,
                        payload.pin,
                        payload.newAchievement,
                    ),
                );
                break;

            case "cancelP2PSwap":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.cancelP2PSwap(
                        payload.chatId,
                        payload.threadRootMessageIndex,
                        payload.messageId,
                    ),
                );
                break;

            case "joinVideoCall":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.joinVideoCall(payload.chatId, payload.messageId, payload.newAchievement),
                );
                break;

            case "videoCallParticipants":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.videoCallParticipants(
                        payload.chatId,
                        payload.messageId,
                        payload.updatesSince,
                    ),
                );
                break;

            case "setVideoCallPresence":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setVideoCallPresence(
                        payload.chatId,
                        payload.messageId,
                        payload.presence,
                        payload.newAchievement,
                    ),
                );
                break;

            case "getAccessToken":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getAccessToken(
                        payload.chatId,
                        payload.accessTokenType,
                        payload.localUserIndex,
                    ),
                );
                break;

            case "getLocalUserIndexForUser":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getLocalUserIndexForUser(payload.userId),
                );
                break;

            case "updateBtcBalance":
                executeThenReply(payload, correlationId, agent.updateBtcBalance(payload.userId));
                break;

            case "generateMagicLink":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.generateMagicLink(payload.email, payload.sessionKey),
                );
                break;

            case "getSignInWithEmailDelegation":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getSignInWithEmailDelegation(
                        payload.email,
                        payload.sessionKey,
                        payload.expiration,
                    ),
                );
                break;

            case "siwePrepareLogin":
                executeThenReply(payload, correlationId, agent.siwePrepareLogin(payload.address));
                break;

            case "siwsPrepareLogin":
                executeThenReply(payload, correlationId, agent.siwsPrepareLogin(payload.address));
                break;

            case "loginWithWallet":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.loginWithWallet(
                        payload.token,
                        payload.address,
                        payload.signature,
                        payload.sessionKey,
                    ),
                );
                break;

            case "getDelegationWithWallet":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getDelegationWithWallet(
                        payload.token,
                        payload.address,
                        payload.sessionKey,
                        payload.expiration,
                    ),
                );
                break;

            case "setPinNumber":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.setPinNumber(payload.verification, payload.newPin),
                );
                break;

            case "claimDailyChit":
                executeThenReply(payload, correlationId, agent.claimDailyChit());
                break;

            case "chitLeaderboard":
                executeThenReply(payload, correlationId, agent.chitLeaderboard());
                break;

            case "getChitEvents":
                executeThenReply(payload, correlationId, agent.chitEvents(payload));
                break;

            case "markAchievementsSeen":
                executeThenReply(payload, correlationId, agent.markAchievementsSeen());
                break;

            case "submitProofOfUniquePersonhood":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.submitProofOfUniquePersonhood(payload.iiPrincipal, payload.credential),
                );
                break;

            case "linkIdentities":
                executeThenReply(
                    payload,
                    correlationId,
                    linkIdentities(
                        payload.initiatorKey,
                        payload.initiatorDelegation,
                        payload.initiatorIsIIPrincipal,
                        payload.approverKey,
                        payload.approverDelegation,
                    ),
                );
                break;

            case "getAuthenticationPrincipals":
                if (identityAgent === undefined) {
                    throw new Error("IdentityAgent not initialized");
                }
                executeThenReply(
                    payload,
                    correlationId,
                    identityAgent.getAuthenticationPrincipals(),
                );
                break;

            case "configureWallet":
                executeThenReply(payload, correlationId, agent.configureWallet(payload.config));
                break;

            case "clearCachedData":
                executeThenReply(payload, correlationId, agent.clearCachedData());
                break;

            case "setCommunityReferral":
                executeThenReply(
                    payload,
                    correlationId,
                    setCommunityReferral(
                        payload.communityId.communityId,
                        payload.referredBy,
                        Date.now(),
                    ),
                );
                break;

            case "getExternalAchievements":
                executeThenReply(payload, correlationId, agent.getExternalAchievements());
                break;

            case "cancelInvites":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.cancelInvites(payload.id, payload.userIds),
                );
                break;

            case "messageActivityFeed":
                streamReplies(payload, correlationId, agent.messageActivityFeed());
                break;

            case "markActivityFeedRead":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.markActivityFeedRead(payload.readUpTo),
                );
                break;

            case "deleteUser":
                executeThenReply(payload, correlationId, agent.deleteUser(payload.userId));
                break;

            case "addBotToCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.addBotToCommunity(payload.id, payload.botId, payload.grantedPermissions),
                );
                break;

            default:
                logger?.debug("WORKER: unknown message kind received: ", kind);
        }
    } catch (err) {
        logger?.debug("WORKER: unhandled error: ", err);
        sendError(correlationId)(err);
    }
});

async function linkIdentities(
    initiatorKey: CryptoKeyPair,
    initiatorDelegation: JsonnableDelegationChain,
    initiatorIsIIPrincipal: boolean,
    approverKey: CryptoKeyPair,
    approverDelegation: JsonnableDelegationChain,
): Promise<LinkIdentitiesResponse> {
    const initiatorIdentity = DelegationIdentity.fromDelegation(
        await ECDSAKeyIdentity.fromKeyPair(initiatorKey),
        DelegationChain.fromJSON(initiatorDelegation),
    );
    const initiator = initiatorIdentity.getPrincipal().toString();
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
    const approver = approverIdentity.getPrincipal().toString();
    const approverAgent = await IdentityAgent.create(
        approverIdentity,
        identityCanister,
        icUrl,
        undefined,
    );

    if (approver != authPrincipalString) {
        return "principal_mismatch";
    }

    const initiateResponse = await initiatorAgent.initiateIdentityLink(approver);
    if (initiateResponse !== "success") {
        return initiateResponse;
    }
    return await approverAgent.approveIdentityLink(initiator);
}
