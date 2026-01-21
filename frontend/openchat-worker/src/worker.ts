import { AnonymousIdentity } from "@icp-sdk/core/agent";
import {
    DelegationChain,
    DelegationIdentity,
    ECDSAKeyIdentity,
    type JsonnableDelegationChain,
} from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";
import {
    getBotDefinition,
    IdentityAgent,
    OpenChatAgent,
    setCachedWebAuthnKey,
    setCommunityReferral,
} from "openchat-agent";
import {
    buildIdentityFromJson,
    IdentityStorage,
    inititaliseLogger,
    MessagesReadFromServer,
    setMinLogLevel,
    StorageUpdated,
    Stream,
    UsersLoaded,
    type CorrelatedWorkerRequest,
    type CreateOpenChatIdentityError,
    type FinaliseAccountLinkingResponse,
    type GetOpenChatIdentityResponse,
    type Init,
    type JsonnableIdentityKeyAndChain,
    type LinkIdentitiesResponse,
    type Logger,
    type RemoveIdentityLinkResponse,
    type VerifyAccountLinkingCodeResponse,
    type WebAuthnKey,
    type WebAuthnKeyFull,
    type WorkerEvent,
    type WorkerRequest,
    type WorkerResponseInner,
} from "openchat-shared";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const ocIdentityStorage = IdentityStorage.createForOcIdentity();

let initPayload: Init | undefined = undefined;
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
}

const sendError = (correlationId: number, payload?: unknown) => {
    return (error: unknown) => {
        logger.error("WORKER: error caused by payload: ", error, payload);
        postMessage({
            kind: "worker_error",
            correlationId,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
    };
};

function streamReplies(
    payload: WorkerRequest,
    correlationId: number,
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
    correlationId: number,
    promise: Promise<WorkerResponseInner>,
) {
    promise
        .then((response) => sendResponse(correlationId, response))
        .catch(sendError(correlationId, payload));
}

function sendResponse(correlationId: number, response: WorkerResponseInner, final = true): void {
    logger.debug("WORKER: sending response: ", correlationId);
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
    logger.error("WORKER: unhandled error: ", err);
});

self.addEventListener("unhandledrejection", (err: PromiseRejectionEvent) => {
    logger.error("WORKER: unhandled promise rejection: ", err);
});

self.addEventListener("message", (msg: MessageEvent<CorrelatedWorkerRequest>) => {
    logger.debug("WORKER: received ", msg.data.kind, msg.data.correlationId);
    const payload = msg.data;
    const kind = payload.kind;
    const correlationId = payload.correlationId;

    try {
        if (kind === "init") {
            initPayload = payload;
            logger = inititaliseLogger(
                initPayload.rollbarApiKey,
                initPayload.websiteVersion,
                initPayload.env,
            );
            sendResponse(correlationId, undefined);
            return;
        }

        const config = initPayload;
        if (config === undefined) {
            throw new Error("Worker not initialised");
        }

        if (kind === "setAuthIdentity") {
            executeThenReply(
                payload,
                correlationId,
                initializeAuthIdentity(
                    payload.identity,
                    payload.isIIPrincipal,
                    config.identityCanister,
                    config.icUrl,
                ).then((resp) => {
                    const id = resp.kind === "success" ? resp.identity : new AnonymousIdentity();
                    console.debug(
                        "anon: init worker",
                        id.getPrincipal().toString(),
                        id?.getPrincipal().isAnonymous(),
                    );

                    logger.debug("WORKER: constructing agent instance");
                    agent = new OpenChatAgent(id, authPrincipalString ?? "", {
                        ...config,
                        logger,
                    });
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    return resp.kind;
                }),
            );
            return;
        }

        if (kind === "createOpenChatIdentity") {
            executeThenReply(
                payload,
                correlationId,
                createOpenChatIdentity(payload.webAuthnCredentialId).then((resp) => {
                    const id = typeof resp !== "string" ? resp : new AnonymousIdentity();
                    agent = new OpenChatAgent(id, authPrincipalString ?? "", {
                        ...config,
                        logger,
                    });
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    return typeof resp !== "string" ? "success" : resp;
                }),
            );
            return;
        }

        if (kind === "setMinLogLevel") {
            setMinLogLevel(payload.minLogLevel);
            sendResponse(correlationId, undefined);
            return;
        }

        if (!agent) {
            logger?.debug("WORKER: agent does not exist: ", msg.data);
            return;
        }

        let action: Promise<WorkerResponseInner> | Stream<WorkerResponseInner> | undefined;
        switch (kind) {
            case "getCurrentUser":
                action = agent.getCurrentUser();
                break;

            case "getDeletedGroupMessage":
                action = agent.getDeletedGroupMessage(
                    payload.chatId,
                    payload.messageId,
                    payload.threadRootMessageIndex,
                );
                break;

            case "getDeletedDirectMessage":
                action = agent.getDeletedDirectMessage(payload.userId, payload.messageId);
                break;

            case "getUpdates":
                action = agent.getUpdates(payload.initialLoad);
                break;

            case "getBots":
                action = agent.getBots(payload.initialLoad);
                break;

            case "createUserClient":
                agent.createUserClient(payload.userId);
                break;

            case "chatEvents":
                action = agent.chatEvents(
                    payload.chatId,
                    payload.eventIndexRange,
                    payload.startIndex,
                    payload.ascending,
                    payload.threadRootMessageIndex,
                    payload.latestKnownUpdate,
                );
                break;

            case "getUsers":
                action = agent.getUsers(payload.users, payload.allowStale);
                break;

            case "getAllCachedUsers":
                action = agent.getAllCachedUsers();
                break;

            case "markMessagesRead":
                action = agent.markMessagesRead(payload.payload);
                break;

            case "getGroupDetails":
                action = agent.getGroupDetails(payload.chatId, payload.chatLastUpdated);
                break;

            case "lastOnline":
                action = agent.lastOnline(payload.userIds);
                break;

            case "markAsOnline":
                action = agent.markAsOnline();
                break;

            case "chatEventsWindow":
                action = agent.chatEventsWindow(
                    payload.eventIndexRange,
                    payload.chatId,
                    payload.messageIndex,
                    payload.threadRootMessageIndex,
                    payload.latestKnownUpdate,
                );
                break;

            case "chatEventsByEventIndex":
                action = agent.chatEventsByEventIndex(
                    payload.chatId,
                    payload.eventIndexes,
                    payload.threadRootMessageIndex,
                    payload.latestKnownUpdate,
                );
                break;

            case "rehydrateMessage":
                action = agent.rehydrateMessage(
                    payload.chatId,
                    payload.message,
                    payload.threadRootMessageIndex,
                    payload.latestKnownUpdate,
                );
                break;

            case "checkUsername":
                action = agent.checkUsername(payload.username, payload.isBot);
                break;

            case "searchUsers":
                action = agent.searchUsers(payload.searchTerm, payload.maxResults);
                break;

            case "getUserStorageLimits":
                action = agent.getUserStorageLimits();
                break;

            case "getPublicGroupSummary":
                action = agent.getPublicGroupSummary(payload.chatId);
                break;

            case "toggleMuteNotifications":
                action = agent.toggleMuteNotifications(
                    payload.id,
                    payload.mute,
                    payload.muteAtEveryone,
                );
                break;

            case "archiveChat":
                action = agent.archiveChat(payload.chatId);
                break;

            case "unarchiveChat":
                action = agent.unarchiveChat(payload.chatId);
                break;

            case "pinChat":
                action = agent.pinChat(payload.chatId, payload.favourite);
                break;

            case "unpinChat":
                action = agent.unpinChat(payload.chatId, payload.favourite);
                break;

            case "blockUserFromDirectChat":
                action = agent.blockUserFromDirectChat(payload.userId);
                break;

            case "unblockUserFromDirectChat":
                action = agent.unblockUserFromDirectChat(payload.userId);
                break;

            case "setUserAvatar":
                action = agent.setUserAvatar(payload.data);
                break;

            case "setProfileBackground":
                action = agent.setProfileBackground(payload.data);
                break;

            case "deleteGroup":
                action = agent.deleteGroup(payload.chatId);
                break;

            case "leaveGroup":
                action = agent.leaveGroup(payload.chatId);
                break;

            case "joinGroup":
                action = agent.joinGroup(payload.chatId, payload.credentialArgs);
                break;

            case "joinCommunity":
                action = agent.joinCommunity(payload.id, payload.credentialArgs);
                break;

            case "updateGroup":
                action = agent.updateGroup(
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
                );
                break;

            case "registerPollVote":
                action = agent.registerPollVote(
                    payload.chatId,
                    payload.messageIdx,
                    payload.answerIdx,
                    payload.voteType,
                    payload.threadRootMessageIndex,
                    payload.newAchievement,
                );
                break;

            case "deleteMessage":
                action = agent.deleteMessage(
                    payload.chatId,
                    payload.messageId,
                    payload.threadRootMessageIndex,
                    payload.asPlatformModerator,
                    payload.newAchievement,
                );
                break;

            case "undeleteMessage":
                action = agent.undeleteMessage(
                    payload.chatId,
                    payload.messageId,
                    payload.threadRootMessageIndex,
                );
                break;

            case "addReaction":
                action = agent.addReaction(
                    payload.chatId,
                    payload.messageId,
                    payload.reaction,
                    payload.username,
                    payload.displayName,
                    payload.threadRootMessageIndex,
                    payload.newAchievement,
                );
                break;

            case "removeReaction":
                action = agent.removeReaction(
                    payload.chatId,
                    payload.messageId,
                    payload.reaction,
                    payload.threadRootMessageIndex,
                );
                break;

            case "blockUserFromGroupChat":
                action = agent.blockUserFromGroupChat(payload.chatId, payload.userId);
                break;

            case "unblockUserFromGroupChat":
                action = agent.unblockUserFromGroupChat(payload.chatId, payload.userId);
                break;

            case "getProposalVoteDetails":
                action = agent.getProposalVoteDetails(
                    payload.governanceCanisterId,
                    payload.proposalId,
                    payload.isNns,
                );
                break;

            case "listNervousSystemFunctions":
                action = agent.listNervousSystemFunctions(payload.snsGovernanceCanisterId);
                break;

            case "unpinMessage":
                action = agent.unpinMessage(payload.chatId, payload.messageIndex);
                break;

            case "pinMessage":
                action = agent.pinMessage(payload.chatId, payload.messageIndex);
                break;

            case "sendMessage":
                action = agent.sendMessage(
                    payload.messageContext,
                    payload.user,
                    payload.mentioned,
                    payload.event,
                    payload.acceptedRules,
                    payload.messageFilterFailed,
                    payload.pin,
                    payload.newAchievement,
                );
                break;

            case "editMessage":
                action = agent.editMessage(
                    payload.chatId,
                    payload.msg,
                    payload.threadRootMessageIndex,
                    payload.blockLevelMarkdown,
                    payload.newAchievement,
                );
                break;

            case "registerUser":
                action = agent.registerUser(payload.username, payload.email, payload.referralCode);
                break;

            case "subscriptionExists":
                action = agent.subscriptionExists(payload.endpoint);
                break;

            case "pushSubscription":
                action = agent.pushSubscription(payload.subscription).then(() => undefined);
                break;

            case "removeSubscription":
                action = agent.removeSubscription(payload.endpoint).then(() => undefined);
                break;

            case "fcmTokenExists":
                action = agent.fcmTokenExists(payload.fcmToken);
                break;

            case "addFcmToken":
                action = agent.addFcmToken(payload.fcmToken, payload.onResponseError);
                break;

            case "markNotificationSubscriptionActive":
                action = agent.markNotificationSubscriptionActive(payload.endpoint);
                break;

            case "inviteUsers":
                action = agent.inviteUsers(payload.id, payload.userIds);
                break;

            case "removeMember":
                action = agent.removeMember(payload.chatId, payload.userId);
                break;

            case "changeRole":
                action = agent.changeRole(payload.chatId, payload.userId, payload.newRole);
                break;

            case "registerProposalVote":
                action = agent.registerProposalVote(
                    payload.chatId,
                    payload.messageIndex,
                    payload.adopt,
                );
                break;

            case "getRecommendedGroups":
                action = agent.getRecommendedGroups(payload.exclusions);
                break;

            case "exploreCommunities":
                action = agent.exploreCommunities(
                    payload.searchTerm,
                    payload.pageIndex,
                    payload.pageSize,
                    payload.flags,
                    payload.languages,
                );
                break;

            case "exploreBots":
                action = agent.exploreBots(
                    payload.searchTerm,
                    payload.pageIndex,
                    payload.pageSize,
                    payload.location,
                    payload.excludeInstalled,
                );
                break;

            case "registerBot":
                action = agent.registerBot(payload.principal, payload.bot);
                break;

            case "removeBot":
                action = agent.removeBot(payload.botId);
                break;

            case "updateRegisteredBot":
                action = agent.updateRegisteredBot(
                    payload.id,
                    payload.principal,
                    payload.ownerId,
                    payload.avatarUrl,
                    payload.endpoint,
                    payload.definition,
                );
                break;

            case "searchGroups":
                action = agent.searchGroups(payload.searchTerm, payload.maxResults);
                break;

            case "dismissRecommendation":
                action = agent.dismissRecommendation(payload.chatId).then(() => undefined);
                break;

            case "communityInvite":
                agent.communityInvite = payload.value;
                break;

            case "groupInvite":
                agent.groupInvite = payload.value;
                break;

            case "searchGroupChat":
                action = agent.searchGroupChat(
                    payload.chatId,
                    payload.searchTerm,
                    payload.userIds,
                    payload.maxResults,
                );
                break;

            case "searchDirectChat":
                action = agent.searchDirectChat(
                    payload.chatId,
                    payload.searchTerm,
                    payload.maxResults,
                );
                break;

            case "refreshAccountBalance":
                action = agent.refreshAccountBalance(payload.ledger, payload.principal);
                break;

            case "getAccountTransactions":
                action = agent.getAccountTransactions(
                    payload.ledgerIndex,
                    payload.principal,
                    payload.fromId,
                );
                break;

            case "threadPreviews":
                action = agent.threadPreviews(payload.threadsByChat);
                break;

            case "getUser":
                action = agent.getUser(payload.userId, payload.allowStale);
                break;

            case "getPublicProfile":
                action = agent.getPublicProfile(payload.userId);
                break;

            case "setUsername":
                action = agent.setUsername(payload.userId, payload.username);
                break;

            case "setDisplayName":
                action = agent.setDisplayName(payload.userId, payload.displayName);
                break;

            case "setBio":
                action = agent.setBio(payload.bio);
                break;

            case "getBio":
                action = agent.getBio(payload.userId);
                break;

            case "withdrawCryptocurrency":
                action = agent.withdrawCryptocurrency(payload.domain, payload.pin);
                break;

            case "getMessagesByMessageIndex":
                action = agent.getMessagesByMessageIndex(
                    payload.chatId,
                    payload.threadRootMessageIndex,
                    payload.messageIndexes,
                    payload.latestKnownUpdate,
                );
                break;

            case "getInviteCode":
                action = agent.getInviteCode(payload.id);
                break;

            case "enableInviteCode":
                action = agent.enableInviteCode(payload.id);
                break;

            case "disableInviteCode":
                action = agent.disableInviteCode(payload.id);
                break;

            case "resetInviteCode":
                action = agent.resetInviteCode(payload.id);
                break;

            case "createGroupChat":
                action = agent.createGroupChat(payload.candidate);
                break;

            case "setCachedMessageFromNotification":
                agent
                    .setCachedMessageFromNotification(
                        payload.chatId,
                        payload.threadRootMessageIndex,
                        payload.message,
                    )
                    .then(() => undefined);
                break;

            case "freezeGroup":
                action = agent.freezeGroup(payload.chatId, payload.reason);
                break;

            case "unfreezeGroup":
                action = agent.unfreezeGroup(payload.chatId);
                break;

            case "freezeCommunity":
                action = agent.freezeCommunity(payload.id, payload.reason);
                break;

            case "unfreezeCommunity":
                action = agent.unfreezeCommunity(payload.id);
                break;

            case "deleteFrozenGroup":
                action = agent.deleteFrozenGroup(payload.chatId);
                break;

            case "addHotGroupExclusion":
                action = agent.addHotGroupExclusion(payload.chatId);
                break;

            case "removeHotGroupExclusion":
                action = agent.removeHotGroupExclusion(payload.chatId);
                break;

            case "addRemoveSwapProvider":
                action = agent.addRemoveSwapProvider(payload.swapProvider, payload.add);
                break;

            case "addMessageFilter":
                action = agent.addMessageFilter(payload.regex);
                break;

            case "removeMessageFilter":
                action = agent.removeMessageFilter(payload.id);
                break;

            case "setAirdropConfig":
                action = agent.setAirdropConfig(
                    payload.channelId,
                    payload.channelName,
                    payload.communityId,
                    payload.communityName,
                );
                break;

            case "setTokenEnabled":
                action = agent.setTokenEnabled(payload.ledger, payload.enabled);
                break;

            case "suspendUser":
                action = agent.suspendUser(payload.userId, payload.reason);
                break;

            case "unsuspendUser":
                action = agent.unsuspendUser(payload.userId);
                break;

            case "setCommunityModerationFlags":
                action = agent.setCommunityModerationFlags(payload.communityId, payload.flags);
                break;

            case "setGroupUpgradeConcurrency":
                action = agent.setGroupUpgradeConcurrency(payload.value);
                break;

            case "setCommunityUpgradeConcurrency":
                action = agent.setCommunityUpgradeConcurrency(payload.value);
                break;

            case "setUserUpgradeConcurrency":
                action = agent.setUserUpgradeConcurrency(payload.value);
                break;

            case "markLocalGroupIndexFull":
                action = agent.markLocalGroupIndexFull(payload.canisterId, payload.full);
                break;

            case "setDiamondMembershipFees":
                action = agent.setDiamondMembershipFees(payload.fees);
                break;

            case "stakeNeuronForSubmittingProposals":
                action = agent.stakeNeuronForSubmittingProposals(
                    payload.governanceCanisterId,
                    payload.stake,
                );
                break;

            case "topUpNeuronForSubmittingProposals":
                action = agent.topUpNeuronForSubmittingProposals(
                    payload.governanceCanisterId,
                    payload.amount,
                );
                break;

            case "loadFailedMessages":
                action = agent.loadFailedMessages();
                break;

            case "deleteFailedMessage":
                action = agent
                    .deleteFailedMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex,
                    )
                    .then(() => undefined);
                break;
            case "claimPrize":
                action = agent.claimPrize(payload.chatId, payload.messageId, payload.signInProof);
                break;

            case "payForDiamondMembership":
                action = agent.payForDiamondMembership(
                    payload.userId,
                    payload.ledger,
                    payload.duration,
                    payload.recurring,
                    payload.expectedPriceE8s,
                );
                break;

            case "updateMarketMakerConfig":
                action = agent.updateMarketMakerConfig(payload);
                break;

            case "setMessageReminder":
                action = agent.setMessageReminder(
                    payload.chatId,
                    payload.eventIndex,
                    payload.remindAt,
                    payload.notes,
                    payload.threadRootMessageIndex,
                );
                break;

            case "cancelMessageReminder":
                action = agent.cancelMessageReminder(payload.reminderId);
                break;

            case "reportMessage":
                action = agent.reportMessage(
                    payload.chatId,
                    payload.threadRootMessageIndex,
                    payload.messageId,
                    payload.deleteMessage,
                );
                break;

            case "approveTransfer":
                action = agent.approveTransfer(
                    payload.spender,
                    payload.ledger,
                    payload.amount,
                    payload.expiresIn,
                    payload.pin,
                );
                break;

            case "declineInvitation":
                action = agent.declineInvitation(payload.chatId);
                break;

            // Community level functions
            case "addMembersToChannel":
                action = agent.communityClient.addMembersToChannel(
                    payload.chatId,
                    payload.userIds,
                    payload.username,
                    payload.displayName,
                );
                break;

            case "blockCommunityUser":
                action = agent.communityClient.blockUser(payload.id.communityId, payload.userId);
                break;

            case "changeChannelRole":
                action = agent.communityClient.changeChannelRole(
                    payload.chatId,
                    payload.userId,
                    payload.newRole,
                );
                break;

            case "changeCommunityRole":
                action = agent.communityClient.changeRole(
                    payload.id.communityId,
                    payload.userId,
                    payload.newRole,
                );
                break;

            case "declineChannelInvitation":
                action = agent.communityClient.declineInvitation(payload.chatId);
                break;

            case "removeCommunityMember":
                action = agent.communityClient.removeMember(payload.id.communityId, payload.userId);
                break;

            case "unblockCommunityUser":
                action = agent.communityClient.unblockUser(payload.id.communityId, payload.userId);
                break;

            case "updateCommunity":
                action = agent.communityClient.updateCommunity(
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
                );
                break;

            case "createCommunity":
                action = agent.userClient.createCommunity(
                    payload.community,
                    payload.rules,
                    payload.defaultChannels,
                    payload.defaultChannelRules,
                );
                break;

            case "getCommunitySummary":
                action = agent.getCommunitySummary(payload.communityId);
                break;

            case "getChannelSummary":
                action = agent.getChannelSummary(payload.chatId);
                break;

            case "exploreChannels":
                action = agent.exploreChannels(
                    payload.id,
                    payload.searchTerm,
                    payload.pageSize,
                    payload.pageIndex,
                );
                break;

            case "getCommunityDetails":
                action = agent.communityClient.getCommunityDetails(
                    payload.id.communityId,
                    payload.communityLastUpdated,
                );
                break;

            case "addToFavourites":
                action = agent.userClient.manageFavouriteChats([payload.chatId], []);
                break;

            case "removeFromFavourites":
                action = agent.userClient.manageFavouriteChats([], [payload.chatId]);
                break;

            case "leaveCommunity":
                action = agent.userClient.leaveCommunity(payload.id);
                break;

            case "deleteCommunity":
                action = agent.userClient.deleteCommunity(payload.id);
                break;

            case "convertGroupToCommunity":
                action = agent.convertGroupToCommunity(
                    payload.chatId,
                    payload.historyVisible,
                    payload.rules,
                );
                break;

            case "importGroupToCommunity":
                action = agent.communityClient.importGroup(
                    payload.communityId.communityId,
                    payload.groupId,
                );
                break;

            case "setModerationFlags":
                action = agent.setModerationFlags(payload.flags);
                break;

            case "updateRegistry":
                action = agent.getRegistry();
                break;

            case "setCommunityIndexes":
                action = agent.setCommunityIndexes(payload.indexes);
                break;

            case "createUserGroup":
                action = agent.createUserGroup(payload.communityId, payload.name, payload.userIds);
                break;

            case "updateUserGroup":
                action = agent.updateUserGroup(
                    payload.communityId,
                    payload.userGroupId,
                    payload.name,
                    payload.usersToAdd,
                    payload.usersToRemove,
                );
                break;

            case "deleteUserGroups":
                action = agent.deleteUserGroups(payload.communityId, payload.userGroupIds);
                break;

            case "setMemberDisplayName":
                action = agent.setMemberDisplayName(
                    payload.communityId,
                    payload.displayName,
                    payload.newAchievement,
                );
                break;

            case "followThread":
                action = agent.followThread(
                    payload.chatId,
                    payload.threadRootMessageIndex,
                    payload.follow,
                    payload.newAchievement,
                );
                break;

            case "submitProposal":
                action = agent.submitProposal(
                    payload.currentUserId,
                    payload.governanceCanisterId,
                    payload.proposal,
                    payload.ledger,
                    payload.token,
                    payload.proposalRejectionFee,
                    payload.transactionFee,
                );
                break;

            case "tipMessage":
                action = agent.userClient.tipMessage(
                    payload.messageContext,
                    payload.messageId,
                    payload.transfer,
                    payload.decimals,
                    payload.pin,
                );
                break;

            case "loadSavedCryptoAccounts":
                action = agent.userClient.loadSavedCryptoAccounts();
                break;

            case "saveCryptoAccount":
                action = agent.userClient.saveCryptoAccount(payload.namedAccount);
                break;

            case "canSwap":
                action = agent.canSwap(payload.tokenLedgers);
                break;

            case "getTokenSwaps":
                action = agent.getTokenSwaps(payload.inputTokenLedger, payload.outputTokenLedgers);
                break;

            case "getTokenSwapQuotes":
                action = agent.getTokenSwapQuotes(
                    payload.inputTokenLedger,
                    payload.outputTokenLedger,
                    payload.amountIn,
                );
                break;

            case "swapTokens":
                action = agent.swapTokens(
                    payload.swapId,
                    payload.inputTokenDetails,
                    payload.outputTokenDetails,
                    payload.amountIn,
                    payload.minAmountOut,
                    payload.dex,
                    payload.pin,
                );
                break;

            case "tokenSwapStatus":
                action = agent.tokenSwapStatus(payload.swapId);
                break;

            case "deleteDirectChat":
                action = agent.deleteDirectChat(payload.userId, payload.blockUser);
                break;

            case "diamondMembershipFees":
                action = agent.diamondMembershipFees();
                break;

            case "reportedMessages":
                action = agent.reportedMessages(payload.userId);
                break;

            case "exchangeRates":
                action = agent.exchangeRates();
                break;

            case "proposeTranslation":
                action = agent
                    .translationsClient()
                    .propose(payload.locale, payload.key, payload.value);
                break;

            case "approveTranslation":
                action = agent.translationsClient().approve(payload.id);
                break;

            case "rejectTranslation":
                action = agent.translationsClient().reject(payload.id, payload.reason);
                break;

            case "getProposedTranslations":
                action = agent.translationsClient().proposed();
                break;

            case "markTranslationsDeployed":
                action = agent.translationsClient().markDeployed();
                break;

            case "getTranslationsPendingDeployment":
                action = agent.translationsClient().pendingDeployment();
                break;

            case "acceptP2PSwap":
                action = agent.acceptP2PSwap(
                    payload.chatId,
                    payload.threadRootMessageIndex,
                    payload.messageId,
                    payload.pin,
                    payload.newAchievement,
                );
                break;

            case "cancelP2PSwap":
                action = agent.cancelP2PSwap(
                    payload.chatId,
                    payload.threadRootMessageIndex,
                    payload.messageId,
                );
                break;

            case "joinVideoCall":
                action = agent.joinVideoCall(
                    payload.chatId,
                    payload.messageId,
                    payload.newAchievement,
                );
                break;

            case "videoCallParticipants":
                action = agent.videoCallParticipants(
                    payload.chatId,
                    payload.messageId,
                    payload.updatesSince,
                );
                break;

            case "setVideoCallPresence":
                action = agent.setVideoCallPresence(
                    payload.chatId,
                    payload.messageId,
                    payload.presence,
                    payload.newAchievement,
                );
                break;

            case "getAccessToken":
                action = agent.getAccessToken(payload.accessTokenType, payload.localUserIndex);
                break;

            case "registerWebhook":
                action = agent.registerWebhook(payload.chatId, payload.name, payload.avatar);
                break;

            case "updateWebhook":
                action = agent.updateWebhook(
                    payload.chatId,
                    payload.id,
                    payload.name,
                    payload.avatar,
                );
                break;

            case "regenerateWebhook":
                action = agent.regenerateWebhook(payload.chatId, payload.id);
                break;

            case "deleteWebhook":
                action = agent.deleteWebhook(payload.chatId, payload.id);
                break;

            case "getWebhook":
                action = agent.getWebhook(payload.chatId, payload.id);
                break;

            case "getLocalUserIndexForUser":
                action = agent.getLocalUserIndexForUser(payload.userId);
                break;

            case "generateBtcAddress":
                action = agent.generateBtcAddress();
                break;

            case "generateOneSecAddress":
                action = agent.generateOneSecAddress();
                break;

            case "updateBtcBalance":
                action = agent.updateBtcBalance(payload.userId, payload.bitcoinAddress);
                break;

            case "withdrawBtc":
                action = agent.withdrawBtc(payload.address, payload.amount, payload.pin);
                break;

            case "withdrawViaOneSec":
                action = agent.withdrawViaOneSec(
                    payload.ledger,
                    payload.tokenSymbol,
                    payload.chain,
                    payload.address,
                    payload.amount,
                    payload.pin,
                );
                break;

            case "ckbtcMinterDepositInfo":
                action = agent.getCkbtcMinterDepositInfo();
                break;

            case "ckbtcMinterWithdrawalInfo":
                action = agent.getCkbtcMinterWithdrawalInfo(payload.amount);
                break;

            case "currentUserWebAuthnKey":
                // TODO add type for the `res`
                action =
                    identityAgent?.checkAuthPrincipal().then((res) => {
                        return res.kind === "success" ? res.webAuthnKey : undefined;
                    }) ?? Promise.resolve(undefined);
                break;

            case "lookupWebAuthnPubKey":
                IdentityAgent.create(
                    new AnonymousIdentity(),
                    config.identityCanister,
                    config.icUrl,
                    undefined,
                ).then((ia) => ia.lookupWebAuthnPubKey(payload.credentialId));
                break;

            case "setCachedWebAuthnKey":
                action = setCachedWebAuthnKey(payload.key);
                break;

            case "generateMagicLink":
                action = agent.generateMagicLink(payload.email, payload.sessionKey);
                break;

            case "getSignInWithEmailDelegation":
                action = agent.getSignInWithEmailDelegation(
                    payload.email,
                    payload.sessionKey,
                    payload.expiration,
                );
                break;

            case "siwePrepareLogin":
                action = agent.siwePrepareLogin(payload.address);
                break;

            case "siwsPrepareLogin":
                action = agent.siwsPrepareLogin(payload.address);
                break;

            case "loginWithWallet":
                action = agent.loginWithWallet(
                    payload.token,
                    payload.address,
                    payload.signature,
                    payload.sessionKey,
                );
                break;

            case "getDelegationWithWallet":
                action = agent.getDelegationWithWallet(
                    payload.token,
                    payload.address,
                    payload.sessionKey,
                    payload.expiration,
                );
                break;

            case "setPinNumber":
                action = agent.setPinNumber(payload.verification, payload.newPin);
                break;

            case "claimDailyChit":
                action = agent.claimDailyChit(payload.utcOffsetMins);
                break;

            case "chitLeaderboard":
                action = agent.chitLeaderboard();
                break;

            case "getChitEvents":
                action = agent.chitEvents(payload);
                break;

            case "markAchievementsSeen":
                action = agent.markAchievementsSeen();
                break;

            case "submitProofOfUniquePersonhood":
                action = agent.submitProofOfUniquePersonhood(
                    payload.iiPrincipal,
                    payload.credential,
                );
                break;

            case "linkIdentities":
                linkIdentities(
                    payload.initiatorKey,
                    payload.initiatorDelegation,
                    payload.initiatorIsIIPrincipal,
                    payload.initiatorWebAuthnKey,
                    payload.approverKey,
                    payload.approverDelegation,
                    config.identityCanister,
                    config.icUrl,
                );
                break;

            case "removeIdentityLink":
                removeIdentityLink(payload.linked_principal);
                break;

            case "getAuthenticationPrincipals":
                action = agent.getAuthenticationPrincipals();
                break;

            case "configureWallet":
                action = agent.configureWallet(payload.config);
                break;

            case "clearCachedData":
                action = agent.clearCachedData();
                break;

            case "setCommunityReferral":
                setCommunityReferral(
                    payload.communityId.communityId,
                    payload.referredBy,
                    Date.now(),
                );
                break;

            case "getExternalAchievements":
                action = agent.getExternalAchievements();
                break;

            case "cancelInvites":
                action = agent.cancelInvites(payload.id, payload.userIds);
                break;

            case "messageActivityFeed":
                action = agent.messageActivityFeed();
                break;

            case "markActivityFeedRead":
                action = agent.markActivityFeedRead(payload.readUpTo);
                break;

            case "deleteUser":
                deleteUser(
                    payload.identityKey,
                    payload.delegation,
                    config.identityCanister,
                    config.icUrl,
                );
                break;

            case "getSignInProof":
                getSignInProof(
                    payload.identityKey,
                    payload.delegation,
                    config.identityCanister,
                    config.icUrl,
                );
                break;

            case "installBot":
                action = agent.installBot(payload.id, payload.botId, payload.grantedPermissions);
                break;

            case "updateInstalledBot":
                action = agent.updateInstalledBot(
                    payload.id,
                    payload.botId,
                    payload.grantedPermissions,
                );
                break;

            case "uninstallBot":
                action = agent.uninstallBot(payload.id, payload.botId);
                break;

            case "getBotDefinition":
                action = getBotDefinition(payload.endpoint);
                break;

            case "callBotCommandEndpoint":
                action = agent.callBotCommandEndpoint(payload.endpoint, payload.token);
                break;

            case "withdrawFromIcpSwap":
                action = agent.withdrawFromIcpSwap(
                    payload.userId,
                    payload.swapId,
                    payload.inputToken,
                    payload.amount,
                    payload.fee,
                );
                break;

            case "payForStreakInsurance":
                action = agent.payForStreakInsurance(
                    payload.additionalDays,
                    payload.expectedPrice,
                    payload.pin,
                );
                break;

            case "updateDirectChatSettings":
                action = agent.updateDirectChatSettings(payload.userId, payload.eventsTtl);
                break;

            case "updateProposalTallies":
                action = agent.updateProposalTallies(payload.chatId);
                break;

            case "createAccountLinkingCode":
                action = identityAgent?.createAccountLinkingCode() ?? Promise.resolve(undefined);
                break;

            case "reinstateMissedDailyClaims":
                action = agent.reinstateMissedDailyClaims(payload.userId, payload.days);
                break;

            case "verifyAccountLinkingCode":
                action = verifyAccountLinkingCode(
                    payload.code,
                    payload.tempKey,
                    config.identityCanister,
                    config.icUrl,
                );
                break;

            case "finaliseAccountLinkingWithCode":
                action =
                    finaliseAccountLinkingWithCode(
                        payload.tempKey,
                        payload.principal,
                        payload.publicKey,
                        payload.webAuthnKey,
                        config.identityCanister,
                        config.icUrl,
                    ) ?? Promise.resolve(undefined);
                break;

            case "payForPremiumItem":
                action = agent.payForPremiumItem(payload.userId, payload.item);
                break;

            case "setPremiumItemCost":
                action = agent.setPremiumItemCost(payload.item, payload.chitCost);
                break;

            case "oneSecEnableForwarding":
                action = agent.oneSecEnableForwarding(payload.userId, payload.evmAddress);
                break;

            case "oneSecGetTransferFees":
                action = agent.oneSecGetTransferFees();
                break;

            case "oneSecForwardEvmToIcp":
                action = agent.oneSecForwardEvmToIcp(
                    payload.tokenSymbol,
                    payload.chain,
                    payload.address,
                    payload.receiver,
                );
                break;

            case "oneSecGetForwardingStatus":
                action = agent.oneSecGetForwardingStatus(
                    payload.tokenSymbol,
                    payload.chain,
                    payload.address,
                    payload.receiver,
                );
                break;

            case "updateBlockedUsernamePatterns":
                action = agent.updateBlockedUsernamePatterns(payload.pattern, payload.add);
                break;

            default:
                logger?.debug("WORKER: unknown message kind received: ", kind);
        }

        if (action === undefined) {
            sendResponse(correlationId, undefined);
        } else if (action instanceof Stream) {
            streamReplies(payload, correlationId, action);
        } else {
            executeThenReply(payload, correlationId, action);
        }
    } catch (err) {
        logger?.debug("WORKER: unhandled error: ", err);
        sendError(correlationId)(err);
    }
});

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
