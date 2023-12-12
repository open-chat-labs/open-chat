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
    type InitMessage,
} from "openchat-shared";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

/**
 * This class adapts messages received via postMessage from the UI into
 * calls to the canister backend and sends correlated responses back to the
 * UI via postMessage.
 */
export class AgentAdapter extends EventTarget {
    private logger: Logger | undefined = undefined;
    private agent: OpenChatAgent | undefined = undefined;
    private auth: Promise<AuthClient>;
    private messagePort: MessagePort | undefined;

    constructor() {
        super();

        this.auth = AuthClient.create({
            idleOptions: {
                disableIdle: true,
            },
            storage: new IdbStorage(),
        });

        self.addEventListener("error", (err: ErrorEvent) => {
            this.logger?.error("SW: unhandled error: ", err);
        });

        self.addEventListener("unhandledrejection", (err: PromiseRejectionEvent) => {
            this.logger?.error("SW: unhandled promise rejection: ", err);
        });
    }

    private getIdentity(): Promise<Identity> {
        return this.auth.then((a) => a.getIdentity());
    }

    private handleAgentEvent(ev: Event): void {
        if (ev instanceof MessagesReadFromServer) {
            this.sendEvent({
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
            this.sendEvent({
                event: {
                    subkind: "storage_updated",
                    status: ev.detail,
                },
            });
        }
        if (ev instanceof UsersLoaded) {
            this.sendEvent({
                event: {
                    subkind: "users_loaded",
                    users: ev.detail,
                },
            });
        }
    }

    private sendError(correlationId: string, error: unknown, payload?: unknown) {
        if (!this.messagePort)
            throw new Error("SW: no message port available to send error message");

        this.logger?.error("SW: sending error: ", error);
        if (payload !== undefined) {
            console.error("SW: error caused by payload: ", payload);
        }
        this.messagePort.postMessage({
            kind: "worker_error",
            correlationId,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
    }

    private streamReplies(
        payload: WorkerRequest,
        correlationId: string,
        chain: Stream<WorkerResponseInner>,
    ) {
        const start = Date.now();
        chain
            .subscribe((value, final) => {
                console.debug(
                    `SW: sending streamed reply ${Date.now() - start}ms after subscribing`,
                    correlationId,
                    value,
                    Date.now(),
                    final,
                );
                this.sendResponse(correlationId, value, final);
            })
            .catch((err) => this.sendError(correlationId, err, payload));
    }

    private executeThenReply(
        payload: WorkerRequest,
        correlationId: string,
        promise: Promise<WorkerResponseInner>,
    ) {
        promise
            .then((response) => this.sendResponse(correlationId, response))
            .catch((err) => this.sendError(correlationId, err, payload));
    }

    private sendResponse(correlationId: string, response: WorkerResponseInner, final = true): void {
        if (!this.messagePort) throw new Error("SW: No message port available to send response");

        this.logger?.debug("SW: sending response: ", correlationId, response);
        this.messagePort.postMessage({
            kind: "worker_response",
            correlationId,
            response,
            final,
        });
    }

    private sendEvent(_msg: Omit<WorkerEvent, "kind">): void {
        // TODO - this needs to be some sort of broadcast
        // port.postMessage({
        //     kind: "worker_event",
        //     ...msg,
        // });
    }

    init(port: MessagePort, msg: InitMessage) {
        this.messagePort = port;
        this.getIdentity().then((id) => {
            console.debug("SW: anon: init worker", id, id?.getPrincipal().isAnonymous());
            this.logger = inititaliseLogger(msg.rollbarApiKey, msg.websiteVersion, msg.env);
            this.logger?.debug("SW: constructing agent instance");
            this.agent = new OpenChatAgent(id, {
                ...msg,
                logger: this.logger,
            });
            this.agent.addEventListener("openchat_event", (ev) => this.handleAgentEvent(ev));
            this.sendResponse(msg.correlationId, undefined);
        });
        this.messagePort.onmessage = (ev) => {
            this.workerRequestReceived(ev.data as CorrelatedWorkerRequest);
        };
        return;
    }

    workerRequestReceived(payload: CorrelatedWorkerRequest) {
        this.logger?.debug("SW: received ", payload.kind, payload.correlationId);
        const kind = payload.kind;
        const correlationId = payload.correlationId;

        try {
            if (!this.agent) {
                this.logger?.debug("SW: agent does not exist: ", payload);
                return;
            }

            switch (kind) {
                case "getCurrentUser":
                    this.streamReplies(payload, correlationId, this.agent.getCurrentUser());
                    break;

                case "getDeletedGroupMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getDeletedGroupMessage(
                            payload.chatId,
                            payload.messageId,
                            payload.threadRootMessageIndex,
                        ),
                    );
                    break;

                case "getDeletedDirectMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getDeletedDirectMessage(payload.userId, payload.messageId),
                    );
                    break;

                case "getUpdates":
                    this.streamReplies(
                        payload,
                        correlationId,
                        this.agent.getUpdates(payload.initialLoad),
                    );
                    break;

                case "createUserClient":
                    this.agent.createUserClient(payload.userId);
                    this.sendResponse(correlationId, undefined);
                    break;

                case "chatEvents":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.chatEvents(
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getUsers(payload.users, payload.allowStale),
                    );
                    break;

                case "getAllCachedUsers":
                    this.executeThenReply(payload, correlationId, this.agent.getAllCachedUsers());
                    break;

                case "markMessagesRead":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.markMessagesRead(payload.payload),
                    );
                    break;

                case "getGroupDetails":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getGroupDetails(payload.chatId, payload.chatLastUpdated),
                    );
                    break;

                case "lastOnline":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.lastOnline(payload.userIds),
                    );
                    break;

                case "markAsOnline":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.markAsOnline().then(() => undefined),
                    );
                    break;

                case "chatEventsWindow":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.chatEventsWindow(
                            payload.eventIndexRange,
                            payload.chatId,
                            payload.messageIndex,
                            payload.threadRootMessageIndex,
                            payload.latestKnownUpdate,
                        ),
                    );
                    break;

                case "chatEventsByEventIndex":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.chatEventsByEventIndex(
                            payload.chatId,
                            payload.eventIndexes,
                            payload.threadRootMessageIndex,
                            payload.latestKnownUpdate,
                        ),
                    );
                    break;

                case "rehydrateMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.rehydrateMessage(
                            payload.chatId,
                            payload.message,
                            payload.threadRootMessageIndex,
                            payload.latestKnownUpdate,
                        ),
                    );
                    break;

                case "checkUsername":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.checkUsername(payload.username),
                    );
                    break;

                case "searchUsers":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.searchUsers(payload.searchTerm, payload.maxResults),
                    );
                    break;

                case "migrateUserPrincipal":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.migrateUserPrincipal(payload.userId),
                    );
                    break;

                case "initUserPrincipalMigration":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .initUserPrincipalMigration(payload.newPrincipal)
                            .then(() => undefined),
                    );
                    break;

                case "getUserStorageLimits":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getUserStorageLimits(),
                    );
                    break;

                case "getPublicGroupSummary":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getPublicGroupSummary(payload.chatId),
                    );
                    break;

                case "toggleMuteNotifications":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.toggleMuteNotifications(payload.chatId, payload.muted),
                    );
                    break;

                case "archiveChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.archiveChat(payload.chatId),
                    );
                    break;

                case "unarchiveChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.unarchiveChat(payload.chatId),
                    );
                    break;

                case "pinChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.pinChat(payload.chatId, payload.favourite),
                    );
                    break;

                case "unpinChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.unpinChat(payload.chatId, payload.favourite),
                    );
                    break;

                case "blockUserFromDirectChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.blockUserFromDirectChat(payload.userId),
                    );
                    break;

                case "unblockUserFromDirectChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.unblockUserFromDirectChat(payload.userId),
                    );
                    break;

                case "setUserAvatar":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setUserAvatar(payload.data),
                    );
                    break;

                case "deleteGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.deleteGroup(payload.chatId),
                    );
                    break;

                case "leaveGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.leaveGroup(payload.chatId),
                    );
                    break;

                case "joinGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.joinGroup(payload.chatId, payload.credential),
                    );
                    break;

                case "joinCommunity":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.joinCommunity(payload.id, payload.credential),
                    );
                    break;

                case "updateGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.updateGroup(
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.registerPollVote(
                            payload.chatId,
                            payload.messageIdx,
                            payload.answerIdx,
                            payload.voteType,
                            payload.threadRootMessageIndex,
                        ),
                    );
                    break;

                case "deleteMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.deleteMessage(
                            payload.chatId,
                            payload.messageId,
                            payload.threadRootMessageIndex,
                            payload.asPlatformModerator,
                        ),
                    );
                    break;

                case "undeleteMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.undeleteMessage(
                            payload.chatId,
                            payload.messageId,
                            payload.threadRootMessageIndex,
                        ),
                    );
                    break;

                case "addReaction":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.addReaction(
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.removeReaction(
                            payload.chatId,
                            payload.messageId,
                            payload.reaction,
                            payload.threadRootMessageIndex,
                        ),
                    );
                    break;

                case "blockUserFromGroupChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.blockUserFromGroupChat(payload.chatId, payload.userId),
                    );
                    break;

                case "unblockUserFromGroupChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.unblockUserFromGroupChat(payload.chatId, payload.userId),
                    );
                    break;

                case "getProposalVoteDetails":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getProposalVoteDetails(
                            payload.governanceCanisterId,
                            payload.proposalId,
                            payload.isNns,
                        ),
                    );
                    break;

                case "listNervousSystemFunctions":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.listNervousSystemFunctions(payload.snsGovernanceCanisterId),
                    );
                    break;

                case "unpinMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.unpinMessage(payload.chatId, payload.messageIndex),
                    );
                    break;

                case "pinMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.pinMessage(payload.chatId, payload.messageIndex),
                    );
                    break;

                case "sendMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.sendMessage(
                            payload.messageContext,
                            payload.user,
                            payload.mentioned,
                            payload.event,
                            payload.rulesAccepted,
                            payload.communityRulesAccepted,
                        ),
                    );
                    break;

                case "editMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.editMessage(
                            payload.chatId,
                            payload.msg,
                            payload.threadRootMessageIndex,
                        ),
                    );
                    break;

                case "registerUser":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.registerUser(payload.username, payload.referralCode),
                    );
                    break;

                case "subscriptionExists":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.subscriptionExists(payload.p256dh_key),
                    );
                    break;

                case "pushSubscription":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.pushSubscription(payload.subscription).then(() => undefined),
                    );
                    break;

                case "removeSubscription":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.removeSubscription(payload.subscription).then(() => undefined),
                    );
                    break;

                case "inviteUsers":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.inviteUsers(payload.chatId, payload.userIds),
                    );
                    break;

                case "inviteUsersToCommunity":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.inviteUsersToCommunity(payload.id, payload.userIds),
                    );
                    break;

                case "removeMember":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.removeMember(payload.chatId, payload.userId),
                    );
                    break;

                case "changeRole":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.changeRole(payload.chatId, payload.userId, payload.newRole),
                    );
                    break;

                case "registerProposalVote":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.registerProposalVote(
                            payload.chatId,
                            payload.messageIndex,
                            payload.adopt,
                        ),
                    );
                    break;

                case "getRecommendedGroups":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getRecommendedGroups(payload.exclusions),
                    );
                    break;

                case "exploreCommunities":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.exploreCommunities(
                            payload.searchTerm,
                            payload.pageIndex,
                            payload.pageSize,
                            payload.flags,
                            payload.languages,
                        ),
                    );
                    break;

                case "searchGroups":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.searchGroups(payload.searchTerm, payload.maxResults),
                    );
                    break;

                case "dismissRecommendation":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.dismissRecommendation(payload.chatId).then(() => undefined),
                    );
                    break;

                case "communityInvite":
                    this.agent.communityInvite = payload.value;
                    this.sendResponse(correlationId, undefined);
                    break;

                case "groupInvite":
                    this.agent.groupInvite = payload.value;
                    this.sendResponse(correlationId, undefined);
                    break;

                case "searchGroupChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.searchGroupChat(
                            payload.chatId,
                            payload.searchTerm,
                            payload.userIds,
                            payload.maxResults,
                        ),
                    );
                    break;

                case "searchDirectChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.searchDirectChat(
                            payload.chatId,
                            payload.searchTerm,
                            payload.maxResults,
                        ),
                    );
                    break;

                case "refreshAccountBalance":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.refreshAccountBalance(payload.ledger, payload.principal),
                    );
                    break;

                case "getAccountTransactions":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getAccountTransactions(
                            payload.ledgerIndex,
                            payload.principal,
                            payload.fromId,
                        ),
                    );
                    break;

                case "threadPreviews":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.threadPreviews(payload.threadsByChat),
                    );
                    break;

                case "getUser":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getUser(payload.userId, payload.allowStale),
                    );
                    break;

                case "getPublicProfile":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getPublicProfile(payload.userId),
                    );
                    break;

                case "setUsername":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setUsername(payload.userId, payload.username),
                    );
                    break;

                case "setDisplayName":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setDisplayName(payload.userId, payload.displayName),
                    );
                    break;

                case "setBio":
                    this.executeThenReply(payload, correlationId, this.agent.setBio(payload.bio));
                    break;

                case "getBio":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getBio(payload.userId),
                    );
                    break;

                case "withdrawCryptocurrency":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.withdrawCryptocurrency(payload.domain),
                    );
                    break;

                case "getGroupMessagesByMessageIndex":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getGroupMessagesByMessageIndex(
                            payload.chatId,
                            payload.messageIndexes,
                            payload.latestKnownUpdate,
                        ),
                    );
                    break;

                case "getInviteCode":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getInviteCode(payload.id),
                    );
                    break;

                case "enableInviteCode":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.enableInviteCode(payload.id),
                    );
                    break;

                case "disableInviteCode":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.disableInviteCode(payload.id),
                    );
                    break;

                case "resetInviteCode":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.resetInviteCode(payload.id),
                    );
                    break;

                case "createGroupChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.createGroupChat(payload.candidate),
                    );
                    break;

                case "setCachedMessageFromNotification":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .setCachedMessageFromNotification(
                                payload.chatId,
                                payload.threadRootMessageIndex,
                                payload.message,
                            )
                            .then(() => undefined),
                    );
                    break;

                case "freezeGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.freezeGroup(payload.chatId, payload.reason),
                    );
                    break;

                case "unfreezeGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.unfreezeGroup(payload.chatId),
                    );
                    break;

                case "deleteFrozenGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.deleteFrozenGroup(payload.chatId),
                    );
                    break;

                case "addHotGroupExclusion":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.addHotGroupExclusion(payload.chatId),
                    );
                    break;

                case "removeHotGroupExclusion":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.removeHotGroupExclusion(payload.chatId),
                    );
                    break;

                case "suspendUser":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.suspendUser(payload.userId, payload.reason),
                    );
                    break;

                case "unsuspendUser":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.unsuspendUser(payload.userId),
                    );
                    break;

                case "setCommunityModerationFlags":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setCommunityModerationFlags(payload.communityId, payload.flags),
                    );
                    break;

                case "setGroupUpgradeConcurrency":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setGroupUpgradeConcurrency(payload.value),
                    );
                    break;

                case "setCommunityUpgradeConcurrency":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setCommunityUpgradeConcurrency(payload.value),
                    );
                    break;

                case "setUserUpgradeConcurrency":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setUserUpgradeConcurrency(payload.value),
                    );
                    break;

                case "stakeNeuronForSubmittingProposals":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.stakeNeuronForSubmittingProposals(
                            payload.governanceCanisterId,
                            payload.stake,
                        ),
                    );
                    break;

                case "loadFailedMessages":
                    this.executeThenReply(payload, correlationId, this.agent.loadFailedMessages());
                    break;

                case "deleteFailedMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .deleteFailedMessage(
                                payload.chatId,
                                payload.messageId,
                                payload.threadRootMessageIndex,
                            )
                            .then(() => undefined),
                    );
                    break;
                case "claimPrize":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.claimPrize(payload.chatId, payload.messageId),
                    );
                    break;

                case "payForDiamondMembership":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.payForDiamondMembership(
                            payload.userId,
                            payload.token,
                            payload.duration,
                            payload.recurring,
                            payload.expectedPriceE8s,
                        ),
                    );
                    break;

                case "updateMarketMakerConfig":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.updateMarketMakerConfig(payload),
                    );
                    break;

                case "setMessageReminder":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setMessageReminder(
                            payload.chatId,
                            payload.eventIndex,
                            payload.remindAt,
                            payload.notes,
                            payload.threadRootMessageIndex,
                        ),
                    );
                    break;

                case "cancelMessageReminder":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.cancelMessageReminder(payload.reminderId),
                    );
                    break;

                case "getReferralLeaderboard":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getReferralLeaderboard(payload.args),
                    );
                    break;

                case "reportMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.reportMessage(
                            payload.chatId,
                            payload.threadRootMessageIndex,
                            payload.messageId,
                            payload.deleteMessage,
                        ),
                    );
                    break;

                case "approveTransfer":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.approveTransfer(
                            payload.spender,
                            payload.ledger,
                            payload.amount,
                            payload.expiresIn,
                        ),
                    );
                    break;

                case "declineInvitation":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.declineInvitation(payload.chatId),
                    );
                    break;

                // Community level functions
                case "addMembersToChannel":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.id.communityId)
                            .blockUser(payload.userId),
                    );
                    break;

                case "changeChannelRole":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.chatId.communityId)
                            .changeChannelRole(payload.chatId, payload.userId, payload.newRole),
                    );
                    break;

                case "changeCommunityRole":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.id.communityId)
                            .changeRole(payload.userId, payload.newRole),
                    );
                    break;

                case "declineChannelInvitation":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.chatId.communityId)
                            .declineInvitation(payload.chatId),
                    );
                    break;

                case "channelMessagesByMessageIndex":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.id.communityId)
                            .removeMember(payload.userId),
                    );
                    break;

                case "toggleMuteCommunityNotifications":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.communityId)
                            .toggleMuteNotifications(payload.mute),
                    );
                    break;

                case "unblockCommunityUser":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.id.communityId)
                            .unblockUser(payload.userId),
                    );
                    break;

                case "updateCommunity":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.createCommunity(
                            payload.community,
                            payload.rules,
                            payload.defaultChannels,
                            payload.defaultChannelRules,
                        ),
                    );
                    break;

                case "getCommunitySummary":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getCommunitySummary(payload.communityId),
                    );
                    break;

                case "getChannelSummary":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.chatId.communityId)
                            .channelSummary(payload.chatId),
                    );
                    break;

                case "exploreChannels":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.exploreChannels(
                            payload.id,
                            payload.searchTerm,
                            payload.pageSize,
                            payload.pageIndex,
                        ),
                    );
                    break;

                case "getCommunityDetails":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.id.communityId)
                            .getCommunityDetails(payload.id, payload.communityLastUpdated),
                    );
                    break;

                case "addToFavourites":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.addToFavourites(payload.chatId),
                    );
                    break;

                case "removeFromFavourites":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.removeFromFavourites(payload.chatId),
                    );
                    break;

                case "leaveCommunity":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.leaveCommunity(payload.id),
                    );
                    break;

                case "deleteCommunity":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.deleteCommunity(payload.id),
                    );
                    break;

                case "convertGroupToCommunity":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.convertGroupToCommunity(
                            payload.chatId,
                            payload.historyVisible,
                            payload.rules,
                        ),
                    );
                    break;

                case "importGroupToCommunity":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .communityClient(payload.communityId.communityId)
                            .importGroup(payload.groupId),
                    );
                    break;

                case "setModerationFlags":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setModerationFlags(payload.flags),
                    );
                    break;

                case "updateRegistry":
                    this.executeThenReply(payload, correlationId, this.agent.getRegistry());
                    break;

                case "setCommunityIndexes":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setCommunityIndexes(payload.indexes),
                    );
                    break;

                case "createUserGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.createUserGroup(
                            payload.communityId,
                            payload.name,
                            payload.userIds,
                        ),
                    );
                    break;

                case "updateUserGroup":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.updateUserGroup(
                            payload.communityId,
                            payload.userGroupId,
                            payload.name,
                            payload.usersToAdd,
                            payload.usersToRemove,
                        ),
                    );
                    break;

                case "deleteUserGroups":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.deleteUserGroups(payload.communityId, payload.userGroupIds),
                    );
                    break;

                case "setMemberDisplayName":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.setMemberDisplayName(payload.communityId, payload.displayName),
                    );
                    break;

                case "followThread":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.followThread(
                            payload.chatId,
                            payload.threadRootMessageIndex,
                            payload.follow,
                        ),
                    );
                    break;

                case "submitProposal":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.submitProposal(
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getCachePrimerTimestamps(),
                    );
                    break;

                case "setCachePrimerTimestamp":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent
                            .setCachePrimerTimestamp(
                                payload.chatIdentifierString,
                                payload.timestamp,
                            )
                            .then(() => undefined),
                    );
                    break;

                case "tipMessage":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.tipMessage(
                            payload.messageContext,
                            payload.messageId,
                            payload.transfer,
                            payload.decimals,
                        ),
                    );
                    break;

                case "loadSavedCryptoAccounts":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.loadSavedCryptoAccounts(),
                    );
                    break;

                case "saveCryptoAccount":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.userClient.saveCryptoAccount(payload.namedAccount),
                    );
                    break;

                case "canSwap":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.canSwap(payload.tokenLedgers),
                    );
                    break;

                case "getTokenSwaps":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getTokenSwaps(
                            payload.inputTokenLedger,
                            payload.outputTokenLedgers,
                        ),
                    );
                    break;

                case "getTokenSwapQuotes":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.getTokenSwapQuotes(
                            payload.inputTokenLedger,
                            payload.outputTokenLedger,
                            payload.amountIn,
                        ),
                    );
                    break;

                case "swapTokens":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.swapTokens(
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
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.tokenSwapStatus(payload.swapId),
                    );
                    break;

                case "deleteDirectChat":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.deleteDirectChat(payload.userId, payload.blockUser),
                    );
                    break;

                case "diamondMembershipFees":
                    this.executeThenReply(
                        payload,
                        correlationId,
                        this.agent.diamondMembershipFees(),
                    );
                    break;

                default:
                    this.logger?.debug("SW: unknown message kind received: ", kind);
            }
        } catch (err) {
            this.logger?.debug("SW: unhandled error: ", err);
            this.sendError(correlationId, err);
        }
    }
}
