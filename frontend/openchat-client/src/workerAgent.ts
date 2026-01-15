import type {
    FromWorker,
    Init,
    Logger,
    WorkerError,
    WorkerRequest,
    WorkerResponse,
    WorkerResult
} from "openchat-shared";
import { ONE_MINUTE_MILLIS, Stream, random64 } from "openchat-shared";
import type { OpenChatConfig } from "./config";
import { snapshot } from "./snapshot.svelte";
import { messagesRead , storageStore} from "./state";
import { userStore } from "./state/users/state";
import { withPausedStores } from "./utils/stores";

export class WorkerAgent {
    readonly #worker: Worker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly #inflightRequests: Map<string, PromiseResolver<any>> = new Map();
    readonly #logger: Logger;

    constructor(config: OpenChatConfig) {
        console.debug("WORKER_CLIENT: loading worker with version: ", config.websiteVersion);

        const workerUrl = `/worker.js?v=${config.websiteVersion}`;
        this.#worker = new Worker(new URL(workerUrl, import.meta.url), {
            type: "module",
        });
        this.#logger = config.logger;

        this.#worker.onmessage = (ev: MessageEvent<FromWorker>) => {
            if (!ev.data) {
                console.debug("WORKER_CLIENT: event message with no data received");
                return;
            }

            const data = ev.data;

            if (data.kind === "worker_event") {
                if (data.event.subkind === "messages_read_from_server") {
                    const { chatId, readByMeUpTo, threadsRead, dateReadPinned } = data.event;
                    withPausedStores(() => {
                        messagesRead.syncWithServer(
                            chatId,
                            readByMeUpTo,
                            threadsRead,
                            dateReadPinned,
                        );
                    });
                }
                if (data.event.subkind === "storage_updated") {
                    storageStore.set(data.event.status);
                }
                if (data.event.subkind === "users_loaded") {
                    userStore.addMany(data.event.users);
                }
            } else if (data.kind === "worker_response") {
                console.debug("WORKER_CLIENT: response: ", ev);
                this.#resolveResponse(data);
            } else if (data.kind === "worker_error") {
                console.debug("WORKER_CLIENT: error: ", ev);
                this.#resolveError(data);
            } else {
                console.debug("WORKER_CLIENT: unknown message: ", ev);
            }
        };

        const initArgs: Init = {
            kind: "init",
            icUrl: config.icUrl ?? window.location.origin,
            iiDerivationOrigin: config.iiDerivationOrigin,
            openStorageIndexCanister: config.openStorageIndexCanister,
            groupIndexCanister: config.groupIndexCanister,
            notificationsCanister: config.notificationsCanister,
            identityCanister: config.identityCanister,
            onlineCanister: config.onlineCanister,
            userIndexCanister: config.userIndexCanister,
            translationsCanister: config.translationsCanister,
            registryCanister: config.registryCanister,
            internetIdentityUrl: config.internetIdentityUrl,
            nfidUrl: config.nfidUrl,
            userGeekApiKey: config.userGeekApiKey,
            enableMultiCrypto: config.enableMultiCrypto,
            blobUrlPattern: config.blobUrlPattern,
            canisterUrlPath: config.canisterUrlPath,
            proposalBotCanister: config.proposalBotCanister,
            marketMakerCanister: config.marketMakerCanister,
            signInWithEmailCanister: config.signInWithEmailCanister,
            signInWithEthereumCanister: config.signInWithEthereumCanister,
            signInWithSolanaCanister: config.signInWithSolanaCanister,
            oneSecForwarderCanister: config.oneSecForwarderCanister,
            oneSecMinterCanister: config.oneSecMinterCanister,
            websiteVersion: config.websiteVersion,
            rollbarApiKey: config.rollbarApiKey,
            env: config.env,
            bitcoinMainnetEnabled: config.bitcoinMainnetEnabled,
            groupInvite: config.groupInvite,
            accountLinkingCodesEnabled: config.accountLinkingCodesEnabled,
        };

        this.send(initArgs);

        window.setInterval(() => this.#monitorPendingRequests(), ONE_MINUTE_MILLIS);
    }

    send<Req extends WorkerRequest>(request: Req): Promise<WorkerResult<Req>> {
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        return new Promise<WorkerResult<Req>>(this.#sendRequestInternal(request));
    }

    stream<Req extends WorkerRequest>(request: Req): Stream<WorkerResult<Req>> {
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        return new Stream<WorkerResult<Req>>(this.#sendRequestInternal(request));
    }

    responseHandler<T>(
        correlationId: string,
    ): (resolve: (val: T, final: boolean) => void, reject: (reason?: unknown) => void) => void {
        return (resolve, reject) => {
            this.#inflightRequests.set(correlationId, {
                resolve,
                reject,
            });
        };
    }

    #sendRequestInternal<Req extends WorkerRequest, T>(
        req: Req,
    ): (resolve: (val: T, final: boolean) => void, reject: (reason?: unknown) => void) => void {
        const correlationId = random64().toString();
        try {
            this.#worker.postMessage({
                ...snapshot(req),
                correlationId,
            });
        } catch (err) {
            console.error("Error sending postMessage to worker", err);
            throw err;
        }
        return this.responseHandler(correlationId);
    }

    #monitorPendingRequests() {
        const pendingRequests = this.#inflightRequests.size;
        if (pendingRequests >= 100) {
            this.#logger.error("Pending request count exceeded limit", { count: pendingRequests });
        }
    }

    #resolveResponse(data: WorkerResponse): void {
        const promise = this.#inflightRequests.get(data.correlationId);
        if (promise !== undefined) {
            promise.resolve(data.response, data.final);
            if (data.final) {
                this.#inflightRequests.delete(data.correlationId);
            }
        } else {
            this.#logUnexpected(data.correlationId);
        }
    }

    #resolveError(data: WorkerError): void {
        const promise = this.#inflightRequests.get(data.correlationId);
        if (promise !== undefined) {
            promise.reject(JSON.parse(data.error));
            this.#inflightRequests.delete(data.correlationId);
        } else {
            this.#logUnexpected(data.correlationId);
        }
    }

    #logUnexpected(correlationId: string): void {
        console.error(`WORKER_CLIENT: unexpected correlationId received (${correlationId})`);
    }
}

type PromiseResolver<T> = {
    resolve: (val: T | PromiseLike<T>, final: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void;
};
