import {
    HttpAgent,
    type Identity,
    ReplicaTimeError,
} from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import {
    AuthError,
    DestinationInvalidError,
    ResponseTooLargeError,
    SessionExpiryError,
} from "openchat-shared";
import { ReplicaNotUpToDateError, toCanisterResponseError } from "../error";

const MAX_RETRIES = process.env.NODE_ENV === "production" ? 7 : 3;
const RETRY_DELAY = 100;

function debug(msg: string): void {
    console.log(msg);
}

export abstract class CanisterAgent {
    constructor(
        protected identity: Identity,
        protected agent: HttpAgent,
        protected canisterId: string,
    ) {}

    protected get principal(): Principal {
        return this.identity.getPrincipal();
    }

    protected handleQueryResponse<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To | Promise<To>,
        args?: unknown,
        retries = 0,
    ): Promise<To> {
        return this.sendRequestToCanister(() => serviceCall())
            .then(mapper)
            .catch((err) => {
                const responseErr = toCanisterResponseError(err as Error, this.identity);
                const debugInfo = `error: ${JSON.stringify(
                    responseErr,
                    Object.getOwnPropertyNames(responseErr),
                )}, args: ${JSON.stringify(args)}`;
                if (
                    !(responseErr instanceof ResponseTooLargeError) &&
                    !(responseErr instanceof SessionExpiryError) &&
                    !(responseErr instanceof DestinationInvalidError) &&
                    !(responseErr instanceof AuthError) &&
                    retries < MAX_RETRIES
                ) {
                    const delay = RETRY_DELAY * Math.pow(2, retries);

                    if (responseErr instanceof ReplicaNotUpToDateError) {
                        debug(
                            `query: replica not up to date, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`,
                        );
                    } else {
                        debug(
                            `query: error occurred, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`,
                        );
                    }

                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            this.handleQueryResponse(serviceCall, mapper, args, retries + 1)
                                .then(resolve)
                                .catch(reject);
                        }, delay);
                    });
                } else {
                    debug(
                        `query: Error performing query request, exiting retry loop. retries: ${retries}. ${debugInfo}`,
                    );
                    throw responseErr;
                }
            });
    }

    protected async sendRequestToCanister<T>(
        requestFn: () => Promise<T>,
        isRetry = false,
    ): Promise<T> {
        try {
            return await requestFn();
        } catch (err) {
            if (!isRetry && err instanceof ReplicaTimeError) {
                this.agent.replicaTime = err.replicaTime;
                console.log("Set replica time to " + err.replicaTime);
                return await this.sendRequestToCanister(requestFn, true);
            }
            throw err;
        }
    }
}
