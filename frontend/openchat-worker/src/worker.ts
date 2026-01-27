import { AnonymousIdentity } from "@icp-sdk/core/agent";
import {
    DelegationChain,
    DelegationIdentity,
    ECDSAKeyIdentity,
    type JsonnableDelegationChain,
} from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";
import {
    type AgentConfig,
    getBotDefinition,
    IdentityAgent,
    OpenChatAgent,
    setCachedWebAuthnKey,
    setCommunityReferral,
} from "openchat-agent";
import {
    buildIdentityFromJson,
    getSessionExpiryMs,
    IdentityStorage,
    inititaliseLogger,
    MessagesReadFromServer,
    setMinLogLevel,
    StorageUpdated,
    Stream,
    UsersLoaded,
    type CorrelatedWorkerRequest,
    type CreateOpenChatIdentity,
    type CreateOpenChatIdentityError,
    type FinaliseAccountLinkingResponse,
    type GetOpenChatIdentityResponse,
    type Init,
    type JsonnableIdentityKeyAndChain,
    type LinkIdentitiesResponse,
    type Logger,
    type Logout,
    type RemoveIdentityLinkResponse,
    type SetAuthIdentity,
    type SetMinLogLevel,
    type VerifyAccountLinkingCodeResponse,
    type WebAuthnKey,
    type WebAuthnKeyFull,
    type WorkerEvent,
    type WorkerRequest,
    type WorkerResponseInner,
    type SetAuthIdentityResponse,
} from "openchat-shared";

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
}

const sendError = (kind: string, correlationId: number, payload?: unknown) => {
    return (error: unknown) => {
        logger.error("WORKER: error caused by payload: ", kind, error, payload);
        postMessage({
            kind: "worker_error",
            requestKind: kind,
            correlationId,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
    };
};

function streamReplies(
    payload: WorkerRequest,
    kind: string,
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
            sendResponse(kind, correlationId, value, final);
        },
        onError: sendError(kind, correlationId, payload),
    });
}

function executeThenReply(
    payload: WorkerRequest,
    kind: string,
    correlationId: number,
    promise: Promise<WorkerResponseInner>,
) {
    promise
        .then((response) => sendResponse(kind, correlationId, response))
        .catch(sendError(kind, correlationId, payload));
}

function sendResponse(
    kind: string,
    correlationId: number,
    response: WorkerResponseInner,
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
                ocIdentityStorage.remove().then((_) => (agent = undefined)),
            );
            return;
        }

        if (kind === "setMinLogLevel") {
            setMinLogLevel(payload.minLogLevel);
            sendResponse(kind, correlationId, undefined);
            return;
        }

        if (!agent) {
            logger.debug("WORKER: agent does not exist: ", msg.data);
            return;
        }

        const action = getAction(payload, agent, config);

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

function getAction(
    payload: Exclude<
        WorkerRequest,
        Init | SetAuthIdentity | CreateOpenChatIdentity | Logout | SetMinLogLevel
    >,
    agent: OpenChatAgent,
    config: AgentConfig,
): Promise<WorkerResponseInner> | Stream<WorkerResponseInner> {
    const kind = payload.kind;
    switch (kind) {
        case "getCurrentUser":
            return agent.getCurrentUser();

        case "getDeletedGroupMessage":
            return agent.getDeletedGroupMessage(
                payload.chatId,
                payload.messageId,
                payload.threadRootMessageIndex,
            );

        case "getDeletedDirectMessage":
            return agent.getDeletedDirectMessage(payload.userId, payload.messageId);

        case "getUpdates":
            return agent.getUpdates(payload.initialLoad);

        case "getBots":
            return agent.getBots(payload.initialLoad);

        case "createUserClient":
            agent.createUserClient(payload.userId);
            return Promise.resolve();

        case "chatEvents":
            return agent.chatEvents(
                payload.chatId,
                payload.eventIndexRange,
                payload.startIndex,
                payload.ascending,
                payload.threadRootMessageIndex,
                payload.latestKnownUpdate,
            );

        case "getUsers":
            return agent.getUsers(payload.users, payload.allowStale);

        case "getAllCachedUsers":
            return agent.getAllCachedUsers();

        case "markMessagesRead":
            return agent.markMessagesRead(payload.payload);

        case "getGroupDetails":
            return agent.getGroupDetails(payload.chatId, payload.chatLastUpdated);

        case "lastOnline":
            return agent.lastOnline(payload.userIds);

        case "markAsOnline":
            return agent.markAsOnline();

        case "chatEventsWindow":
            return agent.chatEventsWindow(
                payload.eventIndexRange,
                payload.chatId,
                payload.messageIndex,
                payload.threadRootMessageIndex,
                payload.latestKnownUpdate,
            );

        case "chatEventsByEventIndex":
            return agent.chatEventsByEventIndex(
                payload.chatId,
                payload.eventIndexes,
                payload.threadRootMessageIndex,
                payload.latestKnownUpdate,
            );

        case "rehydrateMessage":
            return agent.rehydrateMessage(
                payload.chatId,
                payload.message,
                payload.threadRootMessageIndex,
                payload.latestKnownUpdate,
            );

        case "checkUsername":
            return agent.checkUsername(payload.username, payload.isBot);

        case "searchUsers":
            return agent.searchUsers(payload.searchTerm, payload.maxResults);

        case "getUserStorageLimits":
            return agent.getUserStorageLimits();

        case "getPublicGroupSummary":
            return agent.getPublicGroupSummary(payload.chatId);

        case "toggleMuteNotifications":
            return agent.toggleMuteNotifications(payload.id, payload.mute, payload.muteAtEveryone);

        case "archiveChat":
            return agent.archiveChat(payload.chatId);

        case "unarchiveChat":
            return agent.unarchiveChat(payload.chatId);

        case "pinChat":
            return agent.pinChat(payload.chatId, payload.favourite);

        case "unpinChat":
            return agent.unpinChat(payload.chatId, payload.favourite);

        case "blockUserFromDirectChat":
            return agent.blockUserFromDirectChat(payload.userId);

        case "unblockUserFromDirectChat":
            return agent.unblockUserFromDirectChat(payload.userId);

        case "setUserAvatar":
            return agent.setUserAvatar(payload.data);

        case "setProfileBackground":
            return agent.setProfileBackground(payload.data);

        case "deleteGroup":
            return agent.deleteGroup(payload.chatId);

        case "leaveGroup":
            return agent.leaveGroup(payload.chatId);

        case "joinGroup":
            return agent.joinGroup(payload.chatId, payload.credentialArgs);

        case "joinCommunity":
            return agent.joinCommunity(payload.id, payload.credentialArgs);

        case "updateGroup":
            return agent.updateGroup(
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

        case "registerPollVote":
            return agent.registerPollVote(
                payload.chatId,
                payload.messageIdx,
                payload.answerIdx,
                payload.voteType,
                payload.threadRootMessageIndex,
                payload.newAchievement,
            );

        case "deleteMessage":
            return agent.deleteMessage(
                payload.chatId,
                payload.messageId,
                payload.threadRootMessageIndex,
                payload.asPlatformModerator,
                payload.newAchievement,
            );

        case "undeleteMessage":
            return agent.undeleteMessage(
                payload.chatId,
                payload.messageId,
                payload.threadRootMessageIndex,
            );

        case "addReaction":
            return agent.addReaction(
                payload.chatId,
                payload.messageId,
                payload.reaction,
                payload.username,
                payload.displayName,
                payload.threadRootMessageIndex,
                payload.newAchievement,
            );

        case "removeReaction":
            return agent.removeReaction(
                payload.chatId,
                payload.messageId,
                payload.reaction,
                payload.threadRootMessageIndex,
            );

        case "blockUserFromGroupChat":
            return agent.blockUserFromGroupChat(payload.chatId, payload.userId);

        case "unblockUserFromGroupChat":
            return agent.unblockUserFromGroupChat(payload.chatId, payload.userId);

        case "getProposalVoteDetails":
            return agent.getProposalVoteDetails(
                payload.governanceCanisterId,
                payload.proposalId,
                payload.isNns,
            );

        case "listNervousSystemFunctions":
            return agent.listNervousSystemFunctions(payload.snsGovernanceCanisterId);

        case "unpinMessage":
            return agent.unpinMessage(payload.chatId, payload.messageIndex);

        case "pinMessage":
            return agent.pinMessage(payload.chatId, payload.messageIndex);

        case "sendMessage":
            return agent.sendMessage(
                payload.messageContext,
                payload.user,
                payload.mentioned,
                payload.event,
                payload.acceptedRules,
                payload.messageFilterFailed,
                payload.pin,
                payload.newAchievement,
            );

        case "editMessage":
            return agent.editMessage(
                payload.chatId,
                payload.msg,
                payload.threadRootMessageIndex,
                payload.blockLevelMarkdown,
                payload.newAchievement,
            );

        case "registerUser":
            return agent.registerUser(payload.username, payload.email, payload.referralCode);

        case "subscriptionExists":
            return agent.subscriptionExists(payload.endpoint);

        case "pushSubscription":
            return agent.pushSubscription(payload.subscription).then(() => undefined);

        case "removeSubscription":
            return agent.removeSubscription(payload.endpoint).then(() => undefined);

        case "fcmTokenExists":
            return agent.fcmTokenExists(payload.fcmToken);

        case "addFcmToken":
            return agent.addFcmToken(payload.fcmToken, payload.onResponseError);

        case "markNotificationSubscriptionActive":
            return agent.markNotificationSubscriptionActive(payload.endpoint);

        case "inviteUsers":
            return agent.inviteUsers(payload.id, payload.userIds);

        case "removeMember":
            return agent.removeMember(payload.chatId, payload.userId);

        case "changeRole":
            return agent.changeRole(payload.chatId, payload.userId, payload.newRole);

        case "registerProposalVote":
            return agent.registerProposalVote(payload.chatId, payload.messageIndex, payload.adopt);

        case "getRecommendedGroups":
            return agent.getRecommendedGroups(payload.exclusions);

        case "exploreCommunities":
            return agent.exploreCommunities(
                payload.searchTerm,
                payload.pageIndex,
                payload.pageSize,
                payload.flags,
                payload.languages,
            );

        case "exploreBots":
            return agent.exploreBots(
                payload.searchTerm,
                payload.pageIndex,
                payload.pageSize,
                payload.location,
                payload.excludeInstalled,
            );

        case "registerBot":
            return agent.registerBot(payload.principal, payload.bot);

        case "removeBot":
            return agent.removeBot(payload.botId);

        case "updateRegisteredBot":
            return agent.updateRegisteredBot(
                payload.id,
                payload.principal,
                payload.ownerId,
                payload.avatarUrl,
                payload.endpoint,
                payload.definition,
            );

        case "searchGroups":
            return agent.searchGroups(payload.searchTerm, payload.maxResults);

        case "dismissRecommendation":
            return agent.dismissRecommendation(payload.chatId).then(() => undefined);

        case "communityInvite":
            agent.communityInvite = payload.value;
            return Promise.resolve();

        case "groupInvite":
            agent.groupInvite = payload.value;
            return Promise.resolve();

        case "searchGroupChat":
            return agent.searchGroupChat(
                payload.chatId,
                payload.searchTerm,
                payload.userIds,
                payload.maxResults,
            );

        case "searchDirectChat":
            return agent.searchDirectChat(payload.chatId, payload.searchTerm, payload.maxResults);

        case "refreshAccountBalance":
            return agent.refreshAccountBalance(payload.ledger, payload.principal);

        case "getAccountTransactions":
            return agent.getAccountTransactions(
                payload.ledgerIndex,
                payload.principal,
                payload.fromId,
            );

        case "threadPreviews":
            return agent.threadPreviews(payload.threadsByChat);

        case "getUser":
            return agent.getUser(payload.userId, payload.allowStale);

        case "getPublicProfile":
            return agent.getPublicProfile(payload.userId);

        case "setUsername":
            return agent.setUsername(payload.userId, payload.username);

        case "setDisplayName":
            return agent.setDisplayName(payload.userId, payload.displayName);

        case "setBio":
            return agent.setBio(payload.bio);

        case "getBio":
            return agent.getBio(payload.userId);

        case "withdrawCryptocurrency":
            return agent.withdrawCryptocurrency(payload.domain, payload.pin);

        case "getMessagesByMessageIndex":
            return agent.getMessagesByMessageIndex(
                payload.chatId,
                payload.threadRootMessageIndex,
                payload.messageIndexes,
                payload.latestKnownUpdate,
            );

        case "getInviteCode":
            return agent.getInviteCode(payload.id);

        case "enableInviteCode":
            return agent.enableInviteCode(payload.id);

        case "disableInviteCode":
            return agent.disableInviteCode(payload.id);

        case "resetInviteCode":
            return agent.resetInviteCode(payload.id);

        case "createGroupChat":
            return agent.createGroupChat(payload.candidate);

        case "setCachedMessageFromNotification":
            return agent
                .setCachedMessageFromNotification(
                    payload.chatId,
                    payload.threadRootMessageIndex,
                    payload.message,
                )
                .then(() => undefined);

        case "freezeGroup":
            return agent.freezeGroup(payload.chatId, payload.reason);

        case "unfreezeGroup":
            return agent.unfreezeGroup(payload.chatId);

        case "freezeCommunity":
            return agent.freezeCommunity(payload.id, payload.reason);

        case "unfreezeCommunity":
            return agent.unfreezeCommunity(payload.id);

        case "deleteFrozenGroup":
            return agent.deleteFrozenGroup(payload.chatId);

        case "addHotGroupExclusion":
            return agent.addHotGroupExclusion(payload.chatId);

        case "removeHotGroupExclusion":
            return agent.removeHotGroupExclusion(payload.chatId);

        case "addRemoveSwapProvider":
            return agent.addRemoveSwapProvider(payload.swapProvider, payload.add);

        case "addMessageFilter":
            return agent.addMessageFilter(payload.regex);

        case "removeMessageFilter":
            return agent.removeMessageFilter(payload.id);

        case "setAirdropConfig":
            return agent.setAirdropConfig(
                payload.channelId,
                payload.channelName,
                payload.communityId,
                payload.communityName,
            );

        case "setTokenEnabled":
            return agent.setTokenEnabled(payload.ledger, payload.enabled);

        case "suspendUser":
            return agent.suspendUser(payload.userId, payload.reason);

        case "unsuspendUser":
            return agent.unsuspendUser(payload.userId);

        case "setCommunityModerationFlags":
            return agent.setCommunityModerationFlags(payload.communityId, payload.flags);

        case "setGroupUpgradeConcurrency":
            return agent.setGroupUpgradeConcurrency(payload.value);

        case "setCommunityUpgradeConcurrency":
            return agent.setCommunityUpgradeConcurrency(payload.value);

        case "setUserUpgradeConcurrency":
            return agent.setUserUpgradeConcurrency(payload.value);

        case "markLocalGroupIndexFull":
            return agent.markLocalGroupIndexFull(payload.canisterId, payload.full);

        case "setDiamondMembershipFees":
            return agent.setDiamondMembershipFees(payload.fees);

        case "stakeNeuronForSubmittingProposals":
            return agent.stakeNeuronForSubmittingProposals(
                payload.governanceCanisterId,
                payload.stake,
            );

        case "topUpNeuronForSubmittingProposals":
            return agent.topUpNeuronForSubmittingProposals(
                payload.governanceCanisterId,
                payload.amount,
            );

        case "loadFailedMessages":
            return agent.loadFailedMessages();

        case "deleteFailedMessage":
            return agent
                .deleteFailedMessage(
                    payload.chatId,
                    payload.messageId,
                    payload.threadRootMessageIndex,
                )
                .then(() => undefined);

        case "claimPrize":
            return agent.claimPrize(payload.chatId, payload.messageId, payload.signInProof);

        case "payForDiamondMembership":
            return agent.payForDiamondMembership(
                payload.userId,
                payload.ledger,
                payload.duration,
                payload.recurring,
                payload.expectedPriceE8s,
            );

        case "updateMarketMakerConfig":
            return agent.updateMarketMakerConfig(payload);

        case "setMessageReminder":
            return agent.setMessageReminder(
                payload.chatId,
                payload.eventIndex,
                payload.remindAt,
                payload.notes,
                payload.threadRootMessageIndex,
            );

        case "cancelMessageReminder":
            return agent.cancelMessageReminder(payload.reminderId);

        case "reportMessage":
            return agent.reportMessage(
                payload.chatId,
                payload.threadRootMessageIndex,
                payload.messageId,
                payload.deleteMessage,
            );

        case "approveTransfer":
            return agent.approveTransfer(
                payload.spender,
                payload.ledger,
                payload.amount,
                payload.expiresIn,
                payload.pin,
            );

        case "declineInvitation":
            return agent.declineInvitation(payload.chatId);

        // Community level functions
        case "addMembersToChannel":
            return agent.communityClient.addMembersToChannel(
                payload.chatId,
                payload.userIds,
                payload.username,
                payload.displayName,
            );

        case "blockCommunityUser":
            return agent.communityClient.blockUser(payload.id.communityId, payload.userId);

        case "changeChannelRole":
            return agent.communityClient.changeChannelRole(
                payload.chatId,
                payload.userId,
                payload.newRole,
            );

        case "changeCommunityRole":
            return agent.communityClient.changeRole(
                payload.id.communityId,
                payload.userId,
                payload.newRole,
            );

        case "declineChannelInvitation":
            return agent.communityClient.declineInvitation(payload.chatId);

        case "removeCommunityMember":
            return agent.communityClient.removeMember(payload.id.communityId, payload.userId);

        case "unblockCommunityUser":
            return agent.communityClient.unblockUser(payload.id.communityId, payload.userId);

        case "updateCommunity":
            return agent.communityClient.updateCommunity(
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

        case "createCommunity":
            return agent.userClient.createCommunity(
                payload.community,
                payload.rules,
                payload.defaultChannels,
                payload.defaultChannelRules,
            );

        case "getCommunitySummary":
            return agent.getCommunitySummary(payload.communityId);

        case "getChannelSummary":
            return agent.getChannelSummary(payload.chatId);

        case "exploreChannels":
            return agent.exploreChannels(
                payload.id,
                payload.searchTerm,
                payload.pageSize,
                payload.pageIndex,
            );

        case "getCommunityDetails":
            return agent.communityClient.getCommunityDetails(
                payload.id.communityId,
                payload.communityLastUpdated,
            );

        case "addToFavourites":
            return agent.userClient.manageFavouriteChats([payload.chatId], []);

        case "removeFromFavourites":
            return agent.userClient.manageFavouriteChats([], [payload.chatId]);

        case "leaveCommunity":
            return agent.userClient.leaveCommunity(payload.id);

        case "deleteCommunity":
            return agent.userClient.deleteCommunity(payload.id);

        case "convertGroupToCommunity":
            return agent.convertGroupToCommunity(
                payload.chatId,
                payload.historyVisible,
                payload.rules,
            );

        case "importGroupToCommunity":
            return agent.communityClient.importGroup(
                payload.communityId.communityId,
                payload.groupId,
            );

        case "setModerationFlags":
            return agent.setModerationFlags(payload.flags);

        case "updateRegistry":
            return agent.getRegistry();

        case "setCommunityIndexes":
            return agent.setCommunityIndexes(payload.indexes);

        case "createUserGroup":
            return agent.createUserGroup(payload.communityId, payload.name, payload.userIds);

        case "updateUserGroup":
            return agent.updateUserGroup(
                payload.communityId,
                payload.userGroupId,
                payload.name,
                payload.usersToAdd,
                payload.usersToRemove,
            );

        case "deleteUserGroups":
            return agent.deleteUserGroups(payload.communityId, payload.userGroupIds);

        case "setMemberDisplayName":
            return agent.setMemberDisplayName(
                payload.communityId,
                payload.displayName,
                payload.newAchievement,
            );

        case "followThread":
            return agent.followThread(
                payload.chatId,
                payload.threadRootMessageIndex,
                payload.follow,
                payload.newAchievement,
            );

        case "submitProposal":
            return agent.submitProposal(
                payload.currentUserId,
                payload.governanceCanisterId,
                payload.proposal,
                payload.ledger,
                payload.token,
                payload.proposalRejectionFee,
                payload.transactionFee,
            );

        case "tipMessage":
            return agent.userClient.tipMessage(
                payload.messageContext,
                payload.messageId,
                payload.transfer,
                payload.decimals,
                payload.pin,
            );

        case "loadSavedCryptoAccounts":
            return agent.userClient.loadSavedCryptoAccounts();

        case "saveCryptoAccount":
            return agent.userClient.saveCryptoAccount(payload.namedAccount);

        case "canSwap":
            return agent.canSwap(payload.tokenLedgers);

        case "getTokenSwaps":
            return agent.getTokenSwaps(payload.inputTokenLedger, payload.outputTokenLedgers);

        case "getTokenSwapQuotes":
            return agent.getTokenSwapQuotes(
                payload.inputTokenLedger,
                payload.outputTokenLedger,
                payload.amountIn,
            );

        case "swapTokens":
            return agent.swapTokens(
                payload.swapId,
                payload.inputTokenDetails,
                payload.outputTokenDetails,
                payload.amountIn,
                payload.minAmountOut,
                payload.dex,
                payload.pin,
            );

        case "tokenSwapStatus":
            return agent.tokenSwapStatus(payload.swapId);

        case "deleteDirectChat":
            return agent.deleteDirectChat(payload.userId, payload.blockUser);

        case "diamondMembershipFees":
            return agent.diamondMembershipFees();

        case "reportedMessages":
            return agent.reportedMessages(payload.userId);

        case "exchangeRates":
            return agent.exchangeRates();

        case "proposeTranslation":
            return agent.translationsClient().propose(payload.locale, payload.key, payload.value);

        case "approveTranslation":
            return agent.translationsClient().approve(payload.id);

        case "rejectTranslation":
            return agent.translationsClient().reject(payload.id, payload.reason);

        case "getProposedTranslations":
            return agent.translationsClient().proposed();

        case "markTranslationsDeployed":
            return agent.translationsClient().markDeployed();

        case "getTranslationsPendingDeployment":
            return agent.translationsClient().pendingDeployment();

        case "acceptP2PSwap":
            return agent.acceptP2PSwap(
                payload.chatId,
                payload.threadRootMessageIndex,
                payload.messageId,
                payload.pin,
                payload.newAchievement,
            );

        case "cancelP2PSwap":
            return agent.cancelP2PSwap(
                payload.chatId,
                payload.threadRootMessageIndex,
                payload.messageId,
            );

        case "joinVideoCall":
            return agent.joinVideoCall(payload.chatId, payload.messageId, payload.newAchievement);

        case "videoCallParticipants":
            return agent.videoCallParticipants(
                payload.chatId,
                payload.messageId,
                payload.updatesSince,
            );

        case "setVideoCallPresence":
            return agent.setVideoCallPresence(
                payload.chatId,
                payload.messageId,
                payload.presence,
                payload.newAchievement,
            );

        case "getAccessToken":
            return agent.getAccessToken(payload.accessTokenType, payload.localUserIndex);

        case "registerWebhook":
            return agent.registerWebhook(payload.chatId, payload.name, payload.avatar);

        case "updateWebhook":
            return agent.updateWebhook(payload.chatId, payload.id, payload.name, payload.avatar);

        case "regenerateWebhook":
            return agent.regenerateWebhook(payload.chatId, payload.id);

        case "deleteWebhook":
            return agent.deleteWebhook(payload.chatId, payload.id);

        case "getWebhook":
            return agent.getWebhook(payload.chatId, payload.id);

        case "getLocalUserIndexForUser":
            return agent.getLocalUserIndexForUser(payload.userId);

        case "generateBtcAddress":
            return agent.generateBtcAddress();

        case "generateOneSecAddress":
            return agent.generateOneSecAddress();

        case "updateBtcBalance":
            return agent.updateBtcBalance(payload.userId, payload.bitcoinAddress);

        case "withdrawBtc":
            return agent.withdrawBtc(payload.address, payload.amount, payload.pin);

        case "withdrawViaOneSec":
            return agent.withdrawViaOneSec(
                payload.ledger,
                payload.tokenSymbol,
                payload.chain,
                payload.address,
                payload.amount,
                payload.pin,
            );

        case "ckbtcMinterDepositInfo":
            return agent.getCkbtcMinterDepositInfo();

        case "ckbtcMinterWithdrawalInfo":
            return agent.getCkbtcMinterWithdrawalInfo(payload.amount);

        case "currentUserWebAuthnKey":
            // TODO add type for the `res`
            return (
                identityAgent?.checkAuthPrincipal().then((res) => {
                    return res.kind === "success" ? res.webAuthnKey : undefined;
                }) ?? Promise.resolve(undefined)
            );

        case "lookupWebAuthnPubKey":
            return IdentityAgent.create(
                new AnonymousIdentity(),
                config.identityCanister,
                config.icUrl,
                undefined,
            ).then((ia) => ia.lookupWebAuthnPubKey(payload.credentialId));

        case "setCachedWebAuthnKey":
            return setCachedWebAuthnKey(payload.key);

        case "generateMagicLink":
            return agent.generateMagicLink(payload.email, payload.sessionKey);

        case "getSignInWithEmailDelegation":
            return agent.getSignInWithEmailDelegation(
                payload.email,
                payload.sessionKey,
                payload.expiration,
            );

        case "siwePrepareLogin":
            return agent.siwePrepareLogin(payload.address);

        case "siwsPrepareLogin":
            return agent.siwsPrepareLogin(payload.address);

        case "loginWithWallet":
            return agent.loginWithWallet(
                payload.token,
                payload.address,
                payload.signature,
                payload.sessionKey,
            );

        case "getDelegationWithWallet":
            return agent.getDelegationWithWallet(
                payload.token,
                payload.address,
                payload.sessionKey,
                payload.expiration,
            );

        case "setPinNumber":
            return agent.setPinNumber(payload.verification, payload.newPin);

        case "claimDailyChit":
            return agent.claimDailyChit(payload.utcOffsetMins);

        case "chitLeaderboard":
            return agent.chitLeaderboard();

        case "getChitEvents":
            return agent.chitEvents(payload);

        case "markAchievementsSeen":
            return agent.markAchievementsSeen();

        case "submitProofOfUniquePersonhood":
            return agent.submitProofOfUniquePersonhood(payload.iiPrincipal, payload.credential);

        case "linkIdentities":
            return linkIdentities(
                payload.initiatorKey,
                payload.initiatorDelegation,
                payload.initiatorIsIIPrincipal,
                payload.initiatorWebAuthnKey,
                payload.approverKey,
                payload.approverDelegation,
                config.identityCanister,
                config.icUrl,
            );

        case "removeIdentityLink":
            return removeIdentityLink(payload.linked_principal);

        case "getAuthenticationPrincipals":
            return agent.getAuthenticationPrincipals();

        case "configureWallet":
            return agent.configureWallet(payload.config);

        case "clearCachedData":
            return agent.clearCachedData();

        case "setCommunityReferral":
            return setCommunityReferral(
                payload.communityId.communityId,
                payload.referredBy,
                Date.now(),
            );

        case "getExternalAchievements":
            return agent.getExternalAchievements();

        case "cancelInvites":
            return agent.cancelInvites(payload.id, payload.userIds);

        case "messageActivityFeed":
            return agent.messageActivityFeed();

        case "markActivityFeedRead":
            return agent.markActivityFeedRead(payload.readUpTo);

        case "deleteUser":
            return deleteUser(
                payload.identityKey,
                payload.delegation,
                config.identityCanister,
                config.icUrl,
            );

        case "getSignInProof":
            return getSignInProof(
                payload.identityKey,
                payload.delegation,
                config.identityCanister,
                config.icUrl,
            );

        case "installBot":
            return agent.installBot(payload.id, payload.botId, payload.grantedPermissions);

        case "updateInstalledBot":
            return agent.updateInstalledBot(payload.id, payload.botId, payload.grantedPermissions);

        case "uninstallBot":
            return agent.uninstallBot(payload.id, payload.botId);

        case "getBotDefinition":
            return getBotDefinition(payload.endpoint);

        case "callBotCommandEndpoint":
            return agent.callBotCommandEndpoint(payload.endpoint, payload.token);

        case "withdrawFromIcpSwap":
            return agent.withdrawFromIcpSwap(
                payload.userId,
                payload.swapId,
                payload.inputToken,
                payload.amount,
                payload.fee,
            );

        case "payForStreakInsurance":
            return agent.payForStreakInsurance(
                payload.additionalDays,
                payload.expectedPrice,
                payload.pin,
            );

        case "updateDirectChatSettings":
            return agent.updateDirectChatSettings(payload.userId, payload.eventsTtl);

        case "updateProposalTallies":
            return agent.updateProposalTallies(payload.chatId);

        case "createAccountLinkingCode":
            return identityAgent?.createAccountLinkingCode() ?? Promise.resolve(undefined);

        case "reinstateMissedDailyClaims":
            return agent.reinstateMissedDailyClaims(payload.userId, payload.days);

        case "verifyAccountLinkingCode":
            return verifyAccountLinkingCode(
                payload.code,
                payload.tempKey,
                config.identityCanister,
                config.icUrl,
            );

        case "finaliseAccountLinkingWithCode":
            return finaliseAccountLinkingWithCode(
                payload.tempKey,
                payload.principal,
                payload.publicKey,
                payload.webAuthnKey,
                config.identityCanister,
                config.icUrl,
            );

        case "payForPremiumItem":
            return agent.payForPremiumItem(payload.userId, payload.item);

        case "setPremiumItemCost":
            return agent.setPremiumItemCost(payload.item, payload.chitCost);

        case "oneSecEnableForwarding":
            return agent.oneSecEnableForwarding(payload.userId, payload.evmAddress);

        case "oneSecGetTransferFees":
            return agent.oneSecGetTransferFees();

        case "oneSecForwardEvmToIcp":
            return agent.oneSecForwardEvmToIcp(
                payload.tokenSymbol,
                payload.chain,
                payload.address,
                payload.receiver,
            );

        case "oneSecGetForwardingStatus":
            return agent.oneSecGetForwardingStatus(
                payload.tokenSymbol,
                payload.chain,
                payload.address,
                payload.receiver,
            );

        case "updateBlockedUsernamePatterns":
            return agent.updateBlockedUsernamePatterns(payload.pattern, payload.add);

        default:
            logUnknownMessageKind(kind);
            return Promise.resolve(undefined);
    }
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

function logUnknownMessageKind(kind: never) {
    logger.debug("WORKER: unknown message kind received: ", kind);
}
