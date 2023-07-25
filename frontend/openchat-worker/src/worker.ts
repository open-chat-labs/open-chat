import type { Identity } from "@dfinity/agent";
import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import { OpenChatAgent } from "openchat-agent";
import {
    CorrelatedWorkerRequest,
    Logger,
    MessagesReadFromServer,
    StorageUpdated,
    UsersLoaded,
    WorkerEvent,
    WorkerResponse,
    inititaliseLogger,
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

function getIdentity(): Promise<Identity | undefined> {
    return auth.then((a) => {
        const id = a.getIdentity();
        const p = id.getPrincipal();
        if (p.isAnonymous()) {
            return undefined;
        }
        return id;
    });
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

type Uncorrelated = Omit<WorkerResponse, "correlationId" | "kind">;

const sendError = (correlationId: string, payload?: unknown) => {
    return (error: unknown) => {
        logger?.error("WORKER: sending error: ", error);
        if (payload !== undefined) {
            console.error("WORKER: error caused by paylaod: ", payload);
        }
        postMessage({
            kind: "worker_error",
            correlationId,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
    };
};

function sendResponse(correlationId: string, msg: Uncorrelated): void {
    logger?.debug("WORKER: sending response: ", correlationId);
    postMessage({
        kind: "worker_response",
        correlationId,
        ...msg,
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
                if (id) {
                    logger = inititaliseLogger(
                        payload.rollbarApiKey,
                        payload.websiteVersion,
                        payload.env
                    );
                    logger?.debug("WORKER: constructing agent instance");
                    agent = new OpenChatAgent(id, {
                        ...payload,
                        logger,
                    });
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    sendResponse(correlationId, {
                        response: undefined,
                    });
                }
            });
        }

        if (!agent) {
            logger?.debug("WORKER: agent does not exist: ", msg.data);
            return;
        }

        switch (kind) {
            case "getCurrentUser":
                agent
                    .getCurrentUser()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getDeletedGroupMessage":
                agent
                    .getDeletedGroupMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getDeletedDirectMessage":
                agent
                    .getDeletedDirectMessage(payload.userId, payload.messageId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getUpdates":
                agent
                    .getUpdates()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "createUserClient":
                agent.createUserClient(payload.userId);
                sendResponse(correlationId, {
                    response: undefined,
                });
                break;

            case "chatEvents":
                agent
                    .chatEvents(
                        payload.chatId,
                        payload.eventIndexRange,
                        payload.startIndex,
                        payload.ascending,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex
                    )
                    .then((response) => {
                        sendResponse(correlationId, {
                            response,
                        });
                    })
                    .catch(sendError(correlationId, payload));
                break;

            case "getUsers":
                agent
                    .getUsers(payload.users, payload.allowStale)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getAllCachedUsers":
                agent
                    .getAllCachedUsers()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "markMessagesRead":
                agent
                    .markMessagesRead(payload.payload)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getGroupDetails":
                agent
                    .getGroupDetails(payload.chatId, payload.timestamp)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getGroupDetailsUpdates":
                agent
                    .getGroupDetailsUpdates(payload.chatId, payload.previous)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "lastOnline":
                agent
                    .lastOnline(payload.userIds)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "markAsOnline":
                agent
                    .markAsOnline()
                    .then((_) =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "chatEventsWindow":
                agent
                    .chatEventsWindow(
                        payload.eventIndexRange,
                        payload.chatId,
                        payload.messageIndex,
                        payload.threadRootMessageIndex,
                        payload.latestClientMainEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "chatEventsByEventIndex":
                agent
                    .chatEventsByEventIndex(
                        payload.chatId,
                        payload.eventIndexes,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "rehydrateMessage":
                agent
                    .rehydrateMessage(
                        payload.chatId,
                        payload.message,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "checkUsername":
                agent
                    .checkUsername(payload.username)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "searchUsers":
                agent
                    .searchUsers(payload.searchTerm, payload.maxResults)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "migrateUserPrincipal":
                agent
                    .migrateUserPrincipal(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "initUserPrincipalMigration":
                agent
                    .initUserPrincipalMigration(payload.newPrincipal)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getUserStorageLimits":
                agent
                    .getUserStorageLimits()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getPublicGroupSummary":
                agent
                    .getPublicGroupSummary(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "toggleMuteNotifications":
                agent
                    .toggleMuteNotifications(payload.chatId, payload.muted)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "archiveChat":
                agent
                    .archiveChat(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unarchiveChat":
                agent
                    .unarchiveChat(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "pinChat":
                agent
                    .pinChat(payload.chatId, payload.communitiesEnabled, payload.favourite)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unpinChat":
                agent
                    .unpinChat(payload.chatId, payload.communitiesEnabled, payload.favourite)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "blockUserFromDirectChat":
                agent
                    .blockUserFromDirectChat(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unblockUserFromDirectChat":
                agent
                    .unblockUserFromDirectChat(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "setUserAvatar":
                agent
                    .setUserAvatar(payload.data)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "deleteGroup":
                agent
                    .deleteGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "leaveGroup":
                agent
                    .leaveGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "joinGroup":
                agent
                    .joinGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "joinCommunity":
                agent
                    .joinCommunity(payload.id)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "updateGroup":
                agent
                    .updateGroup(
                        payload.chatId,
                        payload.name,
                        payload.desc,
                        payload.rules,
                        payload.permissions,
                        payload.avatar,
                        payload.gate,
                        payload.isPublic
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "registerPollVote":
                agent
                    .registerPollVote(
                        payload.chatId,
                        payload.messageIdx,
                        payload.answerIdx,
                        payload.voteType,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "deleteMessage":
                agent
                    .deleteMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex,
                        payload.asPlatformModerator
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "undeleteMessage":
                agent
                    .undeleteMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "addReaction":
                agent
                    .addReaction(
                        payload.chatId,
                        payload.messageId,
                        payload.reaction,
                        payload.username,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "removeReaction":
                agent
                    .removeReaction(
                        payload.chatId,
                        payload.messageId,
                        payload.reaction,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "blockUserFromGroupChat":
                agent
                    .blockUserFromGroupChat(payload.chatId, payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unblockUserFromGroupChat":
                agent
                    .unblockUserFromGroupChat(payload.chatId, payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getProposalVoteDetails":
                agent
                    .getProposalVoteDetails(
                        payload.governanceCanisterId,
                        payload.proposalId,
                        payload.isNns
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "listNervousSystemFunctions":
                agent
                    .listNervousSystemFunctions(payload.snsGovernanceCanisterId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unpinMessage":
                agent
                    .unpinMessage(payload.chatId, payload.messageIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "pinMessage":
                agent
                    .pinMessage(payload.chatId, payload.messageIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "sendMessage":
                agent
                    .sendMessage(
                        payload.chatId,
                        payload.user,
                        payload.mentioned,
                        payload.event,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "editMessage":
                agent
                    .editMessage(payload.chatId, payload.msg, payload.threadRootMessageIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "registerUser":
                agent
                    .registerUser(payload.username, payload.referralCode)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "subscriptionExists":
                agent
                    .subscriptionExists(payload.p256dh_key)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "pushSubscription":
                agent
                    .pushSubscription(payload.subscription)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "removeSubscription":
                agent
                    .removeSubscription(payload.subscription)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "inviteUsers":
                agent
                    .inviteUsers(payload.chatId, payload.userIds)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "inviteUsersToCommunity":
                agent
                    .inviteUsersToCommunity(payload.id, payload.userIds)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "removeMember":
                agent
                    .removeMember(payload.chatId, payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "changeRole":
                agent
                    .changeRole(payload.chatId, payload.userId, payload.newRole)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "registerProposalVote":
                agent
                    .registerProposalVote(payload.chatId, payload.messageIndex, payload.adopt)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getRecommendedGroups":
                agent
                    .getRecommendedGroups(payload.exclusions)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getGroupRules":
                agent
                    .getGroupRules(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "exploreCommunities":
                agent
                    .exploreCommunities(
                        payload.searchTerm,
                        payload.pageIndex,
                        payload.pageSize,
                        payload.flags,
                        payload.languages
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "searchGroups":
                agent
                    .searchGroups(payload.searchTerm, payload.maxResults)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "dismissRecommendation":
                agent
                    .dismissRecommendation(payload.chatId)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "communityInvite":
                agent.communityInvite = payload.value;
                sendResponse(correlationId, {
                    response: undefined,
                });
                break;

            case "groupInvite":
                agent.groupInvite = payload.value;
                sendResponse(correlationId, {
                    response: undefined,
                });
                break;

            case "searchGroupChat":
                agent
                    .searchGroupChat(
                        payload.chatId,
                        payload.searchTerm,
                        payload.userIds,
                        payload.maxResults
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "searchDirectChat":
                agent
                    .searchDirectChat(payload.chatId, payload.searchTerm, payload.maxResults)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "refreshAccountBalance":
                agent
                    .refreshAccountBalance(payload.crypto, payload.principal)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "threadPreviews":
                agent
                    .threadPreviews(payload.threadsByChat)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getUser":
                agent
                    .getUser(payload.userId, payload.allowStale)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getPublicProfile":
                agent
                    .getPublicProfile(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "setUsername":
                agent
                    .setUsername(payload.userId, payload.username)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "setBio":
                agent
                    .setBio(payload.bio)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getBio":
                agent
                    .getBio(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "withdrawCryptocurrency":
                agent
                    .withdrawCryptocurrency(payload.domain)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getGroupMessagesByMessageIndex":
                agent
                    .getGroupMessagesByMessageIndex(
                        payload.chatId,
                        payload.messageIndexes,
                        payload.latestClientEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getInviteCode":
                agent
                    .getInviteCode(payload.id)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "enableInviteCode":
                agent
                    .enableInviteCode(payload.id)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "disableInviteCode":
                agent
                    .disableInviteCode(payload.id)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "resetInviteCode":
                agent
                    .resetInviteCode(payload.id)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "createGroupChat":
                agent
                    .createGroupChat(payload.candidate)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "setCachedMessageFromNotification":
                agent
                    .setCachedMessageFromNotification(
                        payload.chatId,
                        payload.threadRootMessageIndex,
                        payload.message
                    )
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "freezeGroup":
                agent
                    .freezeGroup(payload.chatId, payload.reason)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unfreezeGroup":
                agent
                    .unfreezeGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "deleteFrozenGroup":
                agent
                    .deleteFrozenGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "addHotGroupExclusion":
                agent
                    .addHotGroupExclusion(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "removeHotGroupExclusion":
                agent
                    .removeHotGroupExclusion(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "suspendUser":
                agent
                    .suspendUser(payload.userId, payload.reason)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unsuspendUser":
                agent
                    .unsuspendUser(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "setGroupUpgradeConcurrency":
                agent
                    .setGroupUpgradeConcurrency(payload.value)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "setUserUpgradeConcurrency":
                agent
                    .setUserUpgradeConcurrency(payload.value)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "markSuspectedBot":
                agent
                    .markSuspectedBot()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "loadFailedMessages":
                agent
                    .loadFailedMessages()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "deleteFailedMessage":
                agent
                    .deleteFailedMessage(
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex
                    )
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;
            case "claimPrize":
                agent
                    .claimPrize(payload.chatId, payload.messageId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "payForDiamondMembership":
                agent
                    .payForDiamondMembership(
                        payload.userId,
                        payload.token,
                        payload.duration,
                        payload.recurring,
                        payload.expectedPriceE8s
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "updateMarketMakerConfig":
                agent
                    .updateMarketMakerConfig(payload)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "setMessageReminder":
                agent
                    .setMessageReminder(
                        payload.chatId,
                        payload.eventIndex,
                        payload.remindAt,
                        payload.notes,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "cancelMessageReminder":
                agent
                    .cancelMessageReminder(payload.reminderId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getReferralLeaderboard":
                agent
                    .getReferralLeaderboard(payload.args)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "reportMessage":
                agent
                    .reportMessage(
                        payload.chatId,
                        payload.eventIndex,
                        payload.reasonCode,
                        payload.notes,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "declineInvitation":
                agent
                    .declineInvitation(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            // Community level functions
            case "addMembersToChannel":
                agent
                    .communityClient(payload.chatId.communityId)
                    .addMembersToChannel(payload.chatId, payload.userIds, payload.username)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "blockCommunityUser":
                agent
                    .communityClient(payload.id.communityId)
                    .blockUser(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "changeChannelRole":
                agent
                    .communityClient(payload.chatId.communityId)
                    .changeChannelRole(payload.chatId, payload.userId, payload.newRole)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "changeCommunityRole":
                agent
                    .communityClient(payload.id.communityId)
                    .changeRole(payload.userId, payload.newRole)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "declineChannelInvitation":
                agent
                    .communityClient(payload.chatId.communityId)
                    .declineInvitation(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "channelMessagesByMessageIndex":
                agent
                    .communityClient(payload.chatId.communityId)
                    .messagesByMessageIndex(
                        payload.chatId,
                        payload.messageIndexes,
                        payload.latestClientEventIndex,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "removeCommunityMember":
                agent
                    .communityClient(payload.id.communityId)
                    .removeMember(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "toggleMuteCommunityNotifications":
                agent
                    .communityClient(payload.communityId)
                    .toggleMuteNotifications(payload.mute)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "unblockCommunityUser":
                agent
                    .communityClient(payload.id.communityId)
                    .unblockUser(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "updateCommunity":
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
                        payload.primaryLanguage
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "createCommunity":
                agent.userClient
                    .createCommunity(payload.community, payload.rules, payload.defaultChannels)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getCommunitySummary":
                agent
                    .getCommunitySummary(payload.communityId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getChannelSummary":
                agent
                    .communityClient(payload.chatId.communityId)
                    .channelSummary(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "exploreChannels":
                agent
                    .exploreChannels(
                        payload.id,
                        payload.searchTerm,
                        payload.pageSize,
                        payload.pageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getCommunityDetails":
                agent
                    .communityClient(payload.id.communityId)
                    .getCommunityDetails(payload.id, payload.lastUpdated)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "getCommunityDetailsUpdates":
                agent
                    .communityClient(payload.id.communityId)
                    .getCommunityDetailsUpdates(payload.id, payload.previous)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "addToFavourites":
                agent.userClient
                    .addToFavourites(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "removeFromFavourites":
                agent.userClient
                    .removeFromFavourites(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "leaveCommunity":
                agent.userClient
                    .leaveCommunity(payload.id)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "deleteCommunity":
                agent.userClient
                    .deleteCommunity(payload.id)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "convertGroupToCommunity":
                agent
                    .convertGroupToCommunity(payload.chatId, payload.historyVisible, payload.rules)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "importGroupToCommunity":
                agent
                    .communityClient(payload.communityId.communityId)
                    .importGroup(payload.groupId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            case "manageDefaultChannels":
                agent
                    .communityClient(payload.id.communityId)
                    .manageDefaultChannels(payload.toAdd, payload.toRemove)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId, payload));
                break;

            default:
                logger?.debug("WORKER: unknown message kind received: ", kind);
        }
    } catch (err) {
        logger?.debug("WORKER: unhandled error: ", err);
        sendError(correlationId)(err);
    }
});
