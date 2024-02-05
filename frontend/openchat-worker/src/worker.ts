import type { Identity } from "@dfinity/agent";
import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import { OpenChatAgent } from "openchat-agent";
import {
    type CorrelatedWorkerRequest,
    type Logger,
    MessagesReadFromServer,
    StorageUpdated,
    UsersLoaded,
    type WorkerEvent,
    inititaliseLogger,
    type WorkerResponseInner,
    type WorkerRequest,
    Stream,
} from "openchat-shared";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

let logger: Logger | undefined = undefined;

const auth = AuthClient.create({
    idleOptions: {
        disableIdle: true,
    },
    storage: new IdbStorage(),
});

function getIdentity(): Promise<Identity> {
    return auth.then((a) => a.getIdentity());
}

let agent: OpenChatAgent | undefined = undefined;

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
    chain
        .subscribe((value, final) => {
            console.debug(
                `WORKER: sending streamed reply ${Date.now() - start}ms after subscribing`,
                correlationId,
                value,
                Date.now(),
                final,
            );
            sendResponse(correlationId, value, final);
        })
        .catch(sendError(correlationId, payload));
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
    logger?.debug("WORKER: received ", msg.data.kind, msg.data.correlationId);
    const payload = msg.data;
    const kind = payload.kind;
    const correlationId = payload.correlationId;

    try {
        if (kind === "init") {
            getIdentity().then((id) => {
                console.debug("anon: init worker", id, id?.getPrincipal().isAnonymous());
                logger = inititaliseLogger(
                    payload.rollbarApiKey,
                    payload.websiteVersion,
                    payload.env,
                );
                logger?.debug("WORKER: constructing agent instance");
                agent = new OpenChatAgent(id, {
                    ...payload,
                    logger,
                });
                agent.addEventListener("openchat_event", handleAgentEvent);
                sendResponse(correlationId, undefined);
            });
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
                    agent.getUsers(payload.users, payload.allowStale),
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
                executeThenReply(payload, correlationId, agent.checkUsername(payload.username));
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
                    agent.toggleMuteNotifications(payload.chatId, payload.muted),
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
                    agent.joinGroup(payload.chatId, payload.localUserIndex, payload.credential),
                );
                break;

            case "joinCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.joinCommunity(payload.id, payload.localUserIndex, payload.credential),
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
                        payload.gate,
                        payload.isPublic,
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
                executeThenReply(
                    payload,
                    correlationId,
                    agent.sendMessage(
                        payload.messageContext,
                        payload.user,
                        payload.mentioned,
                        payload.event,
                        payload.rulesAccepted,
                        payload.communityRulesAccepted,
                        payload.messageFilterFailed,
                    ),
                );
                break;

            case "editMessage":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.editMessage(payload.chatId, payload.msg, payload.threadRootMessageIndex),
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
                    agent.inviteUsers(payload.chatId, payload.localUserIndex, payload.userIds),
                );
                break;

            case "inviteUsersToCommunity":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.inviteUsersToCommunity(
                        payload.id,
                        payload.localUserIndex,
                        payload.userIds,
                    ),
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
                    agent.getUser(payload.userId, payload.allowStale),
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
                    agent.withdrawCryptocurrency(payload.domain),
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

            case "addMessageFilter":
                executeThenReply(payload, correlationId, agent.addMessageFilter(payload.regex));
                break;

            case "removeMessageFilter":
                executeThenReply(payload, correlationId, agent.removeMessageFilter(payload.id));
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

            case "getReferralLeaderboard":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.getReferralLeaderboard(payload.args),
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

            case "channelMessagesByMessageIndex":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.chatId.communityId)
                        .messagesByMessageIndex(
                            payload.chatId,
                            payload.messageIndexes,
                            payload.threadRootMessageIndex,
                            payload.latestKnownUpdate,
                        ),
                );
                break;

            case "removeCommunityMember":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.communityClient(payload.id.communityId).removeMember(payload.userId),
                );
                break;

            case "toggleMuteCommunityNotifications":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.communityId)
                        .toggleMuteNotifications(payload.mute),
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
                            payload.gate,
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
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .communityClient(payload.chatId.communityId)
                        .channelSummary(payload.chatId),
                );
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
                    agent.userClient.addToFavourites(payload.chatId),
                );
                break;

            case "removeFromFavourites":
                executeThenReply(
                    payload,
                    correlationId,
                    agent.userClient.removeFromFavourites(payload.chatId),
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
                    agent.setMemberDisplayName(payload.communityId, payload.displayName),
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

            case "setCachePrimerTimestamp":
                executeThenReply(
                    payload,
                    correlationId,
                    agent
                        .setCachePrimerTimestamp(payload.chatIdentifierString, payload.timestamp)
                        .then(() => undefined),
                );
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

            default:
                logger?.debug("WORKER: unknown message kind received: ", kind);
        }
    } catch (err) {
        logger?.debug("WORKER: unhandled error: ", err);
        sendError(correlationId)(err);
    }
});
