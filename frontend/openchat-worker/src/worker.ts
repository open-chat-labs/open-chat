import "core-js/actual/structured-clone";

import type { Identity } from "@dfinity/agent";
import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import { OpenChatAgent } from "openchat-agent";
import {
    MessagesReadFromServer,
    StorageUpdated,
    UsersLoaded,
    WorkerEvent,
    WorkerRequest,
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

self.addEventListener("message", (msg: MessageEvent<WorkerRequest>) => {
    console.debug("WORKER: received ", msg.data.kind, msg.data.correlationId);
    const { kind, payload, correlationId } = msg.data;

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

            case "getInitialStateV2":
                agent
                    .getInitialStateV2()
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

            case "getUpdatesV2":
                agent
                    .getUpdatesV2(payload.currentState)
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
                    .markMessagesRead(payload)
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
                        payload.chatType,
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
                        payload.avatar
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
                        payload.threadRootMessageIndex
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
                    .registerUser(payload.username, payload.challengeAttempt, payload.referredBy)
                    .then((response) =>
                        sendResponse(correlationId, {
                            response,
                        })
                    )
                    .catch(sendError(correlationId));
                break;

            case "createChallenge":
                agent
                    .createChallenge()
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

            case "addMembers":
                agent
                    .addMembers(
                        payload.chatId,
                        payload.userIds,
                        payload.myUsername,
                        payload.allowBlocked
                    )
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
                agent.deleteFrozenGroup(payload.chatId)
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

            default:
                console.debug("WORKER: unknown message kind received: ", kind);
        }
    } catch (err) {
        console.debug("WORKER: unhandled error: ", err);
        sendError(correlationId)(err);
    }
});
