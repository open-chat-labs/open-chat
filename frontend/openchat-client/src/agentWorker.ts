import {
    CurrentUserResponse,
    WorkerRequest,
    UserLookup,
    MergedUpdatesResponse,
    CurrentChatState,
    UpdateArgs,
    UsersArgs,
    UsersResponse,
    MessagesReadFromServer,
    FromWorker,
    StorageUpdated,
    UsersLoaded,
    ChatSummary,
    IndexRange,
    EventsResponse,
    ChatEvent,
    MarkReadRequest,
    MarkReadResponse,
    WorkerResponse,
    WorkerError,
} from "openchat-agent";
import type { OpenChatConfig } from "./config";
import { v4 } from "uuid";

const WORKER_TIMEOUT = 1000 * 10;

//FIXME - we need some sort of timeout for request-response calls to worker
//FIXME - we need a generic error handling mechnism to catch and relay exceptions

type PromiseResolver<T> = {
    resolve: (val: T | PromiseLike<T>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void;
    timeout: number;
};

/**
 * This is a wrapper around the OpenChatAgent which brokers communication with the agent inside a web worker
 */
export class OpenChatAgentWorker extends EventTarget {
    private _worker: Worker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _pending: Map<string, PromiseResolver<any>> = new Map();
    public ready: Promise<boolean>;

    constructor(private config: OpenChatConfig) {
        super();
        this._worker = new Worker("worker.js");
        const req: Omit<WorkerRequest, "correlationId"> = {
            kind: "init",
            payload: {
                icUrl: this.config.icUrl ?? window.location.origin,
                iiDerivationOrigin: this.config.iiDerivationOrigin,
                openStorageIndexCanister: this.config.openStorageIndexCanister,
                groupIndexCanister: this.config.groupIndexCanister,
                notificationsCanister: this.config.notificationsCanister,
                onlineCanister: this.config.onlineCanister,
                userIndexCanister: this.config.userIndexCanister,
                internetIdentityUrl: this.config.internetIdentityUrl,
                nfidUrl: this.config.nfidUrl,
                ledgerCanisterICP: this.config.ledgerCanisterICP,
                ledgerCanisterBTC: this.config.ledgerCanisterBTC,
                ledgerCanisterCHAT: this.config.ledgerCanisterCHAT,
                userGeekApiKey: this.config.userGeekApiKey,
                enableMultiCrypto: this.config.enableMultiCrypto,
                blobUrlPattern: this.config.blobUrlPattern,
                proposalBotCanister: this.config.proposalBotCanister,
            },
        };
        this.ready = new Promise((resolve) => {
            this.sendRequest(req).then(() => {
                resolve(true);
            });
        });

        this._worker.onmessage = (ev: MessageEvent<FromWorker>) => {
            if (!ev.data) {
                console.debug("WORKER_CLIENT: event message with no data received");
                return;
            }

            const data = ev.data;

            if (data.kind === "worker_event") {
                if (data.event.subkind === "messages_read_from_server") {
                    this.dispatchEvent(
                        new MessagesReadFromServer(
                            data.event.chatId,
                            data.event.readByMeUpTo,
                            data.event.threadsRead
                        )
                    );
                }
                if (data.event.subkind === "storage_updated") {
                    this.dispatchEvent(new StorageUpdated(data.event.status));
                }
                if (data.event.subkind === "users_loaded") {
                    this.dispatchEvent(new UsersLoaded(data.event.users));
                }
            } else if (data.kind === "worker_response") {
                console.debug("WORKER_CLIENT: response: ", ev);
                this.resolveResponse(data);
            } else if (data.kind === "worker_error") {
                console.debug("WORKER_CLIENT: error: ", ev);
                this.resolveError(data);
            } else {
                console.debug("WORKER_CLIENT: unknown message: ", ev);
            }
        };
    }

    private resolveResponse(data: WorkerResponse): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.resolve(data.response);
            window.clearTimeout(promise.timeout);
            this._pending.delete(data.correlationId);
        }
    }

    private resolveError(data: WorkerError): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.reject(data.error);
            window.clearTimeout(promise.timeout);
            this._pending.delete(data.correlationId);
        }
    }

    private sendRequest<Req extends Omit<WorkerRequest, "correlationId">, Resp = void>(
        req: Req
    ): Promise<Resp> {
        const correlated = {
            ...req,
            correlationId: v4(),
        };
        this._worker.postMessage(correlated);
        const promise = new Promise<Resp>((resolve, reject) => {
            this._pending.set(correlated.correlationId, {
                resolve,
                reject,
                timeout: window.setTimeout(() => {
                    reject(
                        `WORKER_CLIENT: Request of kind ${req.kind} with correlationId ${correlated.correlationId} did not receive a response withing the ${WORKER_TIMEOUT}ms timeout`
                    );
                    this._pending.delete(correlated.correlationId);
                }, WORKER_TIMEOUT),
            });
        });
        return promise;
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.sendRequest({
            kind: "getCurrentUser",
            payload: undefined,
        });
    }

    getInitialState(
        userStore: UserLookup,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse> {
        return this.sendRequest({
            kind: "getInitialState",
            payload: {
                userStore,
                selectedChatId,
            },
        });
    }

    getUpdates(
        currentState: CurrentChatState,
        args: UpdateArgs,
        userStore: UserLookup,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse> {
        return this.sendRequest({
            kind: "getUpdates",
            payload: {
                currentState,
                args,
                userStore,
                selectedChatId,
            },
        });
    }

    createUserClient(userId: string): Promise<void> {
        return this.sendRequest({
            kind: "createUserClient",
            payload: {
                userId,
            },
        });
    }

    chatEvents(
        chat: ChatSummary,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<ChatEvent>> {
        return this.sendRequest({
            kind: "chatEvents",
            payload: {
                chat,
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex,
            },
        });
    }

    getUsers(users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        return this.sendRequest({
            kind: "getUsers",
            payload: {
                users,
                allowStale,
            },
        });
    }

    getAllCachedUsers(): Promise<UserLookup> {
        return this.sendRequest({
            kind: "getAllCachedUsers",
            payload: undefined,
        });
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.sendRequest({
            kind: "markMessagesRead",
            payload: request,
        });
    }
}
