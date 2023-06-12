import "core-js/actual/structured-clone";

import type { Identity } from "@dfinity/agent";
import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import { OpenChatAgent } from "openchat-agent";
import {
    CorrelatedWorkerRequest,
    MessagesReadFromServer,
    StorageUpdated,
    UsersLoaded,
    WorkerEvent,
    WorkerResponse,
} from "openchat-shared";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

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

const sendError = (correlationId: string) => {
    return (error: unknown) => {
        console.debug("WORKER: sending error: ", error);
        postMessage({
            kind: "worker_error",
            correlationId,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
    };
};

function sendResponse(correlationId: string, msg: Uncorrelated): void {
    console.debug("WORKER: sending response: ", correlationId);
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

// FIXME - not sure what to do with this
self.addEventListener("error", (err: ErrorEvent) => {
    console.error("WORKER: unhandled error: ", err);
});

// FIXME - not sure what to do with this
self.addEventListener("unhandledrejection", (err: PromiseRejectionEvent) => {
    console.error("WORKER: unhandled promise rejection: ", err);
});

self.addEventListener("message", (msg: MessageEvent<CorrelatedWorkerRequest>) => {
    console.debug("WORKER: received ", msg.data.kind, msg.data.correlationId);
    const payload = msg.data;
    const kind = payload.kind;
    const correlationId = payload.correlationId;

    try {
        if (kind === "init") {
            getIdentity().then((id) => {
                if (id) {
                    console.debug("WORKER: constructing agent instance");
                    agent = new OpenChatAgent(id, {
                        ...payload,
                        logger: {
                            error: console.error,
                        },
                    });
                    agent.addEventListener("openchat_event", handleAgentEvent);
                    sendResponse(correlationId, {
                        response: undefined,
                    });
                }
            });
        }

        if (!agent) {
            console.debug("WORKER: agent does not exist: ", msg.data);
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
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "getDeletedDirectMessage":
                agent
                    .getDeletedDirectMessage(payload.userId, payload.messageId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getUpdates":
                agent
                    .getUpdates()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                        payload.chatType,
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
                    .catch(sendError(correlationId));
                break;

            case "getUsers":
                agent
                    .getUsers(payload.users, payload.allowStale)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getAllCachedUsers":
                agent
                    .getAllCachedUsers()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "markMessagesRead":
                agent
                    .markMessagesRead(payload.payload)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getGroupDetails":
                agent
                    .getGroupDetails(payload.chatId, payload.latestEventIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getGroupDetailsUpdates":
                agent
                    .getGroupDetailsUpdates(payload.chatId, payload.previous)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "lastOnline":
                agent
                    .lastOnline(payload.userIds)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "markAsOnline":
                agent
                    .markAsOnline()
                    .then((_) =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "directChatEventsWindow":
                agent
                    .directChatEventsWindow(
                        payload.eventIndexRange,
                        payload.theirUserId,
                        payload.messageIndex,
                        payload.latestClientMainEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "groupChatEventsWindow":
                agent
                    .groupChatEventsWindow(
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
                    .catch(sendError(correlationId));
                break;

            case "directChatEventsByEventIndex":
                agent
                    .directChatEventsByEventIndex(
                        payload.theirUserId,
                        payload.eventIndexes,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "groupChatEventsByEventIndex":
                agent
                    .groupChatEventsByEventIndex(
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
                    .catch(sendError(correlationId));
                break;

            case "rehydrateMessage":
                agent
                    .rehydrateMessage(
                        payload.chatId,
                        payload.message,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex,
                        undefined
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "checkUsername":
                agent
                    .checkUsername(payload.username)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "searchUsers":
                agent
                    .searchUsers(payload.searchTerm, payload.maxResults)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "migrateUserPrincipal":
                agent
                    .migrateUserPrincipal(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "initUserPrincipalMigration":
                agent
                    .initUserPrincipalMigration(payload.newPrincipal)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getUserStorageLimits":
                agent
                    .getUserStorageLimits()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getPublicGroupSummary":
                agent
                    .getPublicGroupSummary(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "toggleMuteNotifications":
                agent
                    .toggleMuteNotifications(payload.chatId, payload.muted)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "archiveChat":
                agent
                    .archiveChat(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "unarchiveChat":
                agent
                    .unarchiveChat(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "pinChat":
                agent
                    .pinChat(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "unpinChat":
                agent
                    .unpinChat(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "blockUserFromDirectChat":
                agent
                    .blockUserFromDirectChat(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "unblockUserFromDirectChat":
                agent
                    .unblockUserFromDirectChat(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "setUserAvatar":
                agent
                    .setUserAvatar(payload.data)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "makeGroupPrivate":
                agent
                    .makeGroupPrivate(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "deleteGroup":
                agent
                    .deleteGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "leaveGroup":
                agent
                    .leaveGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "joinGroup":
                agent
                    .joinGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                        payload.gate
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "deleteMessage":
                agent
                    .deleteMessage(
                        payload.chatType,
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
                    .catch(sendError(correlationId));
                break;

            case "undeleteMessage":
                agent
                    .undeleteMessage(
                        payload.chatType,
                        payload.chatId,
                        payload.messageId,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "addDirectChatReaction":
                agent
                    .addDirectChatReaction(
                        payload.otherUserId,
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
                    .catch(sendError(correlationId));
                break;

            case "removeDirectChatReaction":
                agent
                    .removeDirectChatReaction(
                        payload.otherUserId,
                        payload.messageId,
                        payload.reaction,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "addGroupChatReaction":
                agent
                    .addGroupChatReaction(
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
                    .catch(sendError(correlationId));
                break;

            case "removeGroupChatReaction":
                agent
                    .removeGroupChatReaction(
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
                    .catch(sendError(correlationId));
                break;

            case "blockUserFromGroupChat":
                agent
                    .blockUserFromGroupChat(payload.chatId, payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "unblockUserFromGroupChat":
                agent
                    .unblockUserFromGroupChat(payload.chatId, payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "listNervousSystemFunctions":
                agent
                    .listNervousSystemFunctions(payload.snsGovernanceCanisterId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "unpinMessage":
                agent
                    .unpinMessage(payload.chatId, payload.messageIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "pinMessage":
                agent
                    .pinMessage(payload.chatId, payload.messageIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "sendMessage":
                agent
                    .sendMessage(
                        payload.chatType,
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
                    .catch(sendError(correlationId));
                break;

            case "editMessage":
                agent
                    .editMessage(
                        payload.chatType,
                        payload.chatId,
                        payload.msg,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "registerUser":
                agent
                    .registerUser(payload.username, payload.referralCode)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "subscriptionExists":
                agent
                    .subscriptionExists(payload.p256dh_key)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "pushSubscription":
                agent
                    .pushSubscription(payload.subscription)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "removeSubscription":
                agent
                    .removeSubscription(payload.subscription)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "inviteUsers":
                agent
                    .inviteUsers(payload.chatId, payload.userIds)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "removeMember":
                agent
                    .removeMember(payload.chatId, payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "changeRole":
                agent
                    .changeRole(payload.chatId, payload.userId, payload.newRole)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "registerProposalVote":
                agent
                    .registerProposalVote(payload.chatId, payload.messageIndex, payload.adopt)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getRecommendedGroups":
                agent
                    .getRecommendedGroups(payload.exclusions)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getGroupRules":
                agent
                    .getGroupRules(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "searchGroups":
                agent
                    .searchGroups(payload.searchTerm, payload.maxResults)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "dismissRecommendation":
                agent
                    .dismissRecommendation(payload.chatId)
                    .then(() =>
                        sendResponse(correlationId, {
                            response: undefined,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "searchDirectChat":
                agent
                    .searchDirectChat(payload.userId, payload.searchTerm, payload.maxResults)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "refreshAccountBalance":
                agent
                    .refreshAccountBalance(payload.crypto, payload.principal)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "threadPreviews":
                agent
                    .threadPreviews(payload.threadsByChat)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getUser":
                agent
                    .getUser(payload.userId, payload.allowStale)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getPublicProfile":
                agent
                    .getPublicProfile(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "setUsername":
                agent
                    .setUsername(payload.userId, payload.username)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "setBio":
                agent
                    .setBio(payload.bio)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getBio":
                agent
                    .getBio(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "withdrawCryptocurrency":
                agent
                    .withdrawCryptocurrency(payload.domain)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "getInviteCode":
                agent
                    .getInviteCode(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "enableInviteCode":
                agent
                    .enableInviteCode(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "disableInviteCode":
                agent
                    .disableInviteCode(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "resetInviteCode":
                agent
                    .resetInviteCode(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "createGroupChat":
                agent
                    .createGroupChat(payload.candidate)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "freezeGroup":
                agent
                    .freezeGroup(payload.chatId, payload.reason)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "unfreezeGroup":
                agent
                    .unfreezeGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "deleteFrozenGroup":
                agent
                    .deleteFrozenGroup(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "addHotGroupExclusion":
                agent
                    .addHotGroupExclusion(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "removeHotGroupExclusion":
                agent
                    .removeHotGroupExclusion(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "suspendUser":
                agent
                    .suspendUser(payload.userId, payload.reason)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "unsuspendUser":
                agent
                    .unsuspendUser(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "setGroupUpgradeConcurrency":
                agent
                    .setGroupUpgradeConcurrency(payload.value)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "setUserUpgradeConcurrency":
                agent
                    .setUserUpgradeConcurrency(payload.value)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "markSuspectedBot":
                agent
                    .markSuspectedBot()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "loadFailedMessages":
                agent
                    .loadFailedMessages()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;
            case "claimPrize":
                agent
                    .claimPrize(payload.chatId, payload.messageId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "updateMarketMakerConfig":
                agent
                    .updateMarketMakerConfig(payload)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "cancelMessageReminder":
                agent
                    .cancelMessageReminder(payload.reminderId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "getReferralLeaderboard":
                agent
                    .getReferralLeaderboard(payload.args)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
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
                    .catch(sendError(correlationId));
                break;

            case "declineInvitation":
                agent
                    .declineInvitation(payload.chatId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            // Community level functions
            case "addMembersToChannel":
                agent
                    .communityClient(payload.communityId)
                    .addMembersToChannel(payload.channelId, payload.userIds, payload.username)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "addCommunityReaction":
                agent
                    .communityClient(payload.communityId)
                    .addReaction(
                        payload.channelId,
                        payload.username,
                        payload.messageId,
                        payload.reaction,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "blockCommunityUser":
                agent
                    .communityClient(payload.communityId)
                    .blockUser(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "changeChannelRole":
                agent
                    .communityClient(payload.communityId)
                    .changeChannelRole(payload.channelId, payload.userId, payload.newRole)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "changeCommunityRole":
                agent
                    .communityClient(payload.communityId)
                    .changeRole(payload.userId, payload.newRole)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "createChannel":
                agent
                    .communityClient(payload.communityId)
                    .createChannel(payload.candidate)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "declineChannelInvitation":
                agent
                    .communityClient(payload.communityId)
                    .declineInvitation(payload.channelId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "deleteChannel":
                agent
                    .communityClient(payload.communityId)
                    .deleteChannel(payload.channelId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "deleteChannelMessages":
                agent
                    .communityClient(payload.communityId)
                    .deleteMessages(
                        payload.channelId,
                        payload.messageIds,
                        payload.threadRootMessageIndex,
                        payload.asPlatformModerator
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "deleteChannelMessage":
                agent
                    .communityClient(payload.communityId)
                    .deleteMessage(
                        payload.channelId,
                        payload.messageId,
                        payload.sender,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "disableCommunityInviteCode":
                agent
                    .communityClient(payload.communityId)
                    .disableInviteCode()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "editChannelMessage":
                agent
                    .communityClient(payload.communityId)
                    .editMessage(payload.channelId, payload.message, payload.threadRootMessageIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "channelEvents":
                agent
                    .communityClient(payload.communityId)
                    .events(
                        payload.channelId,
                        payload.startIndex,
                        payload.ascending,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "channelEventsByIndex":
                agent
                    .communityClient(payload.communityId)
                    .eventsByIndex(
                        payload.channelId,
                        payload.eventIndexes,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "channelEventsWindow":
                agent
                    .communityClient(payload.communityId)
                    .eventsWindow(
                        payload.channelId,
                        payload.messageIndex,
                        payload.threadRootMessageIndex,
                        payload.latestClientEventIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "communityInviteCode":
                agent
                    .communityClient(payload.communityId)
                    .inviteCode()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "joinChannel":
                agent
                    .communityClient(payload.communityId)
                    .joinChannel(payload.channelId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "leaveChannel":
                agent
                    .communityClient(payload.communityId)
                    .leaveChannel(payload.channelId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "makeChannelPrivate":
                agent
                    .communityClient(payload.communityId)
                    .makeChannelPrivate(payload.channelId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "makeCommunityPrivate":
                agent
                    .communityClient(payload.communityId)
                    .makePrivate()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "channelMessagesByMessageIndex":
                agent
                    .communityClient(payload.communityId)
                    .messagesByMessageIndex(
                        payload.channelId,
                        payload.messageIndexes,
                        payload.latestClientEventIndex,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "pinChannelMessage":
                agent
                    .communityClient(payload.communityId)
                    .pinMessage(payload.channelId, payload.messageIndex)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "removeCommunityMember":
                agent
                    .communityClient(payload.communityId)
                    .removeMember(payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "removeChannelMember":
                agent
                    .communityClient(payload.communityId)
                    .removeMemberFromChannel(payload.channelId, payload.userId)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "removeChannelReaction":
                agent
                    .communityClient(payload.communityId)
                    .removeReaction(
                        payload.channelId,
                        payload.messageId,
                        payload.reaction,
                        payload.threadRootMessageIndex
                    )
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "resetCommunityInviteCode":
                agent
                    .communityClient(payload.communityId)
                    .resetInviteCode()
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "communityRules":
                agent
                    .communityClient(payload.communityId)
                    .rules(payload.inviteCode)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;
            default:
                console.debug("WORKER: unknown message kind received: ", kind);
        }
    } catch (err) {
        console.debug("WORKER: unhandled error: ", err);
        sendError(correlationId)(err);
    }
});
