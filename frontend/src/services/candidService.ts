import { Actor, HttpAgent, Identity } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { rollbar } from "../utils/logging";
import { AuthError, SessionExpiryError, toHttpError } from "./httpError";

const MAX_RETRIES = process.env.NODE_ENV === "production" ? 7 : 3;
const RETRY_DELAY = 100;

function debug(msg: string): void {
    rollbar.debug(msg);
    console.log(msg);
}

// This is a fn which will be given the retry iteration number and return a boolean indicating whether to *stop* retrying
export type ServiceRetryInterrupt = (iterations: number) => boolean;

export abstract class CandidService {
    protected createServiceClient<T>(factory: IDL.InterfaceFactory, canisterId: string): T {
        const host = process.env.IC_URL;
        const agent = new HttpAgent({ identity: this.identity, host });
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }
        return Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }

    protected handleResponse<From, To>(
        service: Promise<From>,
        mapper: (from: From) => To,
        args?: unknown
    ): Promise<To> {
        return service.then(mapper).catch((err) => {
            console.log(err, args);
            throw toHttpError(err as Error, this.identity);
        });
    }

    protected handleQueryResponse<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To,
        args?: unknown,
        interrupt?: ServiceRetryInterrupt,
        retries = 0
    ): Promise<To> {
        return serviceCall()
            .then(mapper)
            .catch((err) => {
                const httpErr = toHttpError(err as Error, this.identity);
                if (
                    !(httpErr instanceof SessionExpiryError) &&
                    !(httpErr instanceof AuthError) &&
                    retries < MAX_RETRIES &&
                    !(interrupt && interrupt(retries)) // bail out of the retry if the caller tells us to
                ) {
                    const delay = RETRY_DELAY * Math.pow(2, retries);
                    return new Promise((resolve, reject) => {
                        debug(`query: error occurred, retrying in ${delay}ms`);
                        window.setTimeout(() => {
                            this.handleQueryResponse(
                                serviceCall,
                                mapper,
                                args,
                                interrupt,
                                retries + 1
                            )
                                .then(resolve)
                                .catch(reject);
                        }, delay);
                    });
                } else {
                    debug(`query: Error performing query request: ${err}, ${args}, ${retries}`);
                    throw httpErr;
                }
            });
    }

    constructor(protected identity: Identity) {}
}
