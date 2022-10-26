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

function sendResponse(
    { correlationId }: WorkerRequest,
    msg: Omit<WorkerResponse, "correlationId" | "kind">
): void {
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
    const { kind, payload } = msg.data;

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
                sendResponse(msg.data, {
                    response: undefined,
                });
            }
        });
    }
    if (!agent) {
        console.debug("WORKER: agent does not exist: ", msg.data);
        return;
    }

    if (kind === "getCurrentUser") {
        agent.getCurrentUser().then((resp) =>
            sendResponse(msg.data, {
                response: resp,
            })
        );
    }
    if (kind === "getInitialState") {
        agent.getInitialState(payload.userStore, payload.selectedChatId).then((resp) =>
            sendResponse(msg.data, {
                response: resp,
            })
        );
    }
    if (kind === "getUpdates") {
        agent
            .getUpdates(
                payload.currentState,
                payload.args,
                payload.userStore,
                payload.selectedChatId
            )
            .then((resp) =>
                sendResponse(msg.data, {
                    response: resp,
                })
            );
    }
    if (kind === "createUserClient") {
        agent.createUserClient(payload.userId);
        sendResponse(msg.data, {
            response: undefined,
        });
    }
    if (kind === "chatEvents") {
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
                sendResponse(msg.data, {
                    response: resp,
                })
            );
    }
    if (kind === "getUsers") {
        agent.getUsers(payload.users, payload.allowStale).then((resp) =>
            sendResponse(msg.data, {
                response: resp,
            })
        );
    }
};
