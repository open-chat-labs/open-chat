import "core-js/actual/structured-clone";

import type { Identity } from "@dfinity/agent";
import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import {
    MessagesReadFromServer,
    OpenChatAgent,
    StorageUpdated,
    UsersLoaded,
    WorkerEvent,
    WorkerRequest,
    WorkerResponse,
} from "openchat-agent";

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

const sendError = (correlationId: string) => (_: unknown) => {
    return (error: unknown) => {
        console.debug("WORKER: sending error: ", error);
        postMessage({
            kind: "worker_error",
            correlationId,
            error,
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

        case "getInitialState":
            agent
                .getInitialState(payload.userStore, payload.selectedChatId)
                .then((response) =>
                    sendResponse(correlationId, {
                        response,
                    })
                )
                .catch(sendError(correlationId));
            break;

        case "getUpdates":
            agent
                .getUpdates(
                    payload.currentState,
                    payload.args,
                    payload.userStore,
                    payload.selectedChatId
                )
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
                    payload.chat,
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
                    payload.currentChatId,
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
                .deleteMessage(payload.chat, payload.messageId, payload.threadRootMessageIndex)
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
                    payload.chat,
                    payload.user,
                    payload.mentioned,
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

        case "editMessage":
            agent
                .editMessage(payload.chat, payload.msg, payload.threadRootMessageIndex)
                .then((response) =>
                    sendResponse(correlationId, {
                        response,
                    })
                )
                .catch(sendError(correlationId));
            break;

        default:
            console.log("WORKER: unknown message kind received: ", kind);
    }
});
