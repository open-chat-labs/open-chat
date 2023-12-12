import {
    type WorkerRequest,
    MessagesReadFromServer,
    type FromWorker,
    StorageUpdated,
    UsersLoaded,
    type WorkerResponse,
    type WorkerError,
    type WorkerResult,
    type InitMessage,
} from "openchat-shared";
import type { OpenChatConfig } from "./config";
import { v4 } from "uuid";
import { Stream } from "openchat-shared";

const WORKER_TIMEOUT = 1000 * 90;

type UnresolvedRequest = {
    kind: string;
    sentAt: number;
};

type PromiseResolver<T> = {
    resolve: (val: T | PromiseLike<T>, final: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void;
    timeout: number;
};

/**
 * This is a wrapper around the OpenChatAgent which brokers communication with the agent inside a web worker
 */
export class OpenChatAgentWorker extends EventTarget {
    private _registration: ServiceWorkerRegistration | undefined = undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _pending: Map<string, PromiseResolver<any>> = new Map(); // in-flight requests
    private _unresolved: Map<string, UnresolvedRequest> = new Map(); // requests that never resolved
    private _connectedToWorker = false;
    private _messagePort: MessagePort | undefined;

    constructor(protected config: OpenChatConfig) {
        super();

        // TODO - move the push notification handling into here and refactor a bit

        this.registerServiceWorker().then((reg) => {
            if (reg === null || reg === undefined) {
                throw new Error("Unable to register service worker - this is a fatal error");
            }
            this._registration = reg;
            this.connectToWorker();
        });
    }

    private async registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
        try {
            const registration = await navigator.serviceWorker.register(
                "process.env.SERVICE_WORKER_PATH",
                {
                    type: "module",
                },
            );
            registration.update();
            return registration;
        } catch (e) {
            console.log(e);
            return undefined;
        }
    }

    get api(): ServiceWorker {
        if (this._registration?.active) {
            return this._registration.active;
        }
        throw new Error("No active serivce worker - this is a fatal error");
    }

    protected connectToWorker(): Promise<boolean> {
        console.debug("SW_CLIENT loading worker with version: ", this.config.websiteVersion);
        const messageChannel = new MessageChannel();
        this._messagePort = messageChannel.port1;

        messageChannel.port1.onmessage = (ev: MessageEvent<FromWorker>) => {
            // TODO - have a look at what actually comes back and restrict the source probably
            if (!("data" in ev)) {
                console.debug("SW_CLIENT event message with no data received");
                return;
            }

            const data = ev.data as FromWorker;

            if (data.kind === "worker_event") {
                if (data.event.subkind === "messages_read_from_server") {
                    this.dispatchEvent(
                        new MessagesReadFromServer(
                            data.event.chatId,
                            data.event.readByMeUpTo,
                            data.event.threadsRead,
                            data.event.dateReadPinned,
                        ),
                    );
                }
                if (data.event.subkind === "storage_updated") {
                    this.dispatchEvent(new StorageUpdated(data.event.status));
                }
                if (data.event.subkind === "users_loaded") {
                    this.dispatchEvent(new UsersLoaded(data.event.users));
                }
            } else if (data.kind === "worker_response") {
                console.debug("SW_CLIENT response: ", ev);
                this.resolveResponse(data);
            } else if (data.kind === "worker_error") {
                console.debug("SW_CLIENT error: ", ev);
                this.resolveError(data);
            } else {
                console.debug("SW_CLIENT unknown message: ", ev);
            }
        };

        const ready = new Promise<boolean>((resolve) => {
            const correlationId = v4();
            const req: InitMessage = {
                kind: "init",
                icUrl: this.config.icUrl ?? window.location.origin,
                iiDerivationOrigin: this.config.iiDerivationOrigin,
                openStorageIndexCanister: this.config.openStorageIndexCanister,
                groupIndexCanister: this.config.groupIndexCanister,
                notificationsCanister: this.config.notificationsCanister,
                onlineCanister: this.config.onlineCanister,
                userIndexCanister: this.config.userIndexCanister,
                registryCanister: this.config.registryCanister,
                internetIdentityUrl: this.config.internetIdentityUrl,
                nfidUrl: this.config.nfidUrl,
                userGeekApiKey: this.config.userGeekApiKey,
                enableMultiCrypto: this.config.enableMultiCrypto,
                blobUrlPattern: this.config.blobUrlPattern,
                proposalBotCanister: this.config.proposalBotCanister,
                marketMakerCanister: this.config.marketMakerCanister,
                websiteVersion: this.config.websiteVersion,
                rollbarApiKey: this.config.rollbarApiKey,
                env: this.config.env,
                correlationId,
            };
            this.api.postMessage(req, [messageChannel.port2]);
            return new Promise<WorkerResult<InitMessage>>(
                this.responseHandler(req, correlationId, WORKER_TIMEOUT),
            ).then(() => {
                resolve(true);
                this._connectedToWorker = true;
            });
        });

        return ready;
    }

    private logUnexpected(correlationId: string): void {
        const unresolved = this._unresolved.get(correlationId);
        const timedOut =
            unresolved === undefined
                ? ""
                : `Timed-out req of kind: ${unresolved.kind} received after ${
                      Date.now() - unresolved.sentAt
                  }ms`;
        console.error(
            `SW_CLIENT unexpected correlationId received (${correlationId}). ${timedOut}`,
        );
    }

    private resolveResponse(data: WorkerResponse): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.resolve(data.response, data.final);
            if (data.final) {
                window.clearTimeout(promise.timeout);
                this._pending.delete(data.correlationId);
            }
        } else {
            this.logUnexpected(data.correlationId);
        }
        this._unresolved.delete(data.correlationId);
    }

    private resolveError(data: WorkerError): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.reject(JSON.parse(data.error));
            window.clearTimeout(promise.timeout);
            this._pending.delete(data.correlationId);
        } else {
            this.logUnexpected(data.correlationId);
        }
        this._unresolved.delete(data.correlationId);
    }

    responseHandler<Req extends WorkerRequest | { kind: "init" }, T>(
        req: Req,
        correlationId: string,
        timeout: number,
    ): (resolve: (val: T, final: boolean) => void, reject: (reason?: unknown) => void) => void {
        return (resolve, reject) => {
            const sentAt = Date.now();
            this._pending.set(correlationId, {
                resolve,
                reject,
                timeout: window.setTimeout(() => {
                    reject(
                        `SW_CLIENT Request of kind ${req.kind} with correlationId ${correlationId} did not receive a response withing the ${WORKER_TIMEOUT}ms timeout`,
                    );
                    this._unresolved.set(correlationId, {
                        kind: req.kind,
                        sentAt,
                    });
                    this._pending.delete(correlationId);
                }, timeout),
            });
        };
    }

    sendStreamRequest<Req extends WorkerRequest>(
        req: Req,
        connecting = false,
        timeout: number = WORKER_TIMEOUT,
    ): Stream<WorkerResult<Req>> {
        if (!connecting && !this._connectedToWorker) {
            throw new Error("SW_CLIENT the client is not yet connected to the worker");
        }
        const correlationId = v4();
        if (!this._messagePort) {
            throw new Error("No channel port to send message via");
        }
        this._messagePort.postMessage({
            ...req,
            correlationId,
        });
        return new Stream<WorkerResult<Req>>(this.responseHandler(req, correlationId, timeout));
    }

    async sendRequest<Req extends WorkerRequest>(
        req: Req,
        connecting = false,
        timeout: number = WORKER_TIMEOUT,
    ): Promise<WorkerResult<Req>> {
        if (!connecting && !this._connectedToWorker) {
            throw new Error("SW_CLIENT the client is not yet connected to the worker");
        }
        const correlationId = v4();

        if (this._messagePort) {
            this._messagePort.postMessage({
                ...req,
                correlationId,
            });
        } else {
            throw new Error("No channel port to send message via");
        }
        return new Promise<WorkerResult<Req>>(this.responseHandler(req, correlationId, timeout));
    }
}
