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
        postMessage({
            kind: "worker_error",
            correlationId,
            error,
        });
    };
};

function sendResponse(correlationId: string, msg: Uncorrelated): void {
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

self.onmessage = (msg: MessageEvent<WorkerRequest>) => {
    console.debug("WORKER: ", msg.data.kind);
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
                .then((resp) =>
                    sendResponse(correlationId, {
                        response: resp,
                    })
                )
                .catch(sendError(correlationId));
            break;

        case "getInitialState":
            agent
                .getInitialState(payload.userStore, payload.selectedChatId)
                .then((resp) =>
                    sendResponse(correlationId, {
                        response: resp,
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
                .then((resp) =>
                    sendResponse(correlationId, {
                        response: resp,
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
                .then((resp) =>
                    sendResponse(correlationId, {
                        response: resp,
                    })
                )
                .catch(sendError(correlationId));
            break;

        case "getUsers":
            agent
                .getUsers(payload.users, payload.allowStale)
                .then((resp) =>
                    sendResponse(correlationId, {
                        response: resp,
                    })
                )
                .catch(sendError(correlationId));
            break;

        case "getAllCachedUsers":
            agent
                .getAllCachedUsers()
                .then((resp) =>
                    sendResponse(correlationId, {
                        response: resp,
                    })
                )
                .catch(sendError(correlationId));
            break;

        case "markMessagesRead":
            agent
                .markMessagesRead(payload)
                .then((resp) =>
                    sendResponse(correlationId, {
                        response: resp,
                    })
                )
                .catch(sendError(correlationId));
            break;

        default:
            console.log("WORKER: unknown message kind received: ", kind);
    }
};
