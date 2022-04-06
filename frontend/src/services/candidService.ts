import { Actor, HttpAgent, Identity } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { rollbar } from "../utils/logging";
import { AuthError, SessionExpiryError, toHttpError } from "./httpError";

const MAX_RETRIES = 7;
const RETRY_DELAY = 100;

function debug(msg: string): void {
    rollbar.debug(msg);
    console.log(msg);
}

export abstract class CandidService {
    protected createServiceClient<T>(factory: IDL.InterfaceFactory, canisterId: string): T {
        const agent = new HttpAgent({ identity: this.identity });
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }
        return Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }

    protected async handleResponse<From, To>(
        service: Promise<From>,
        mapper: (from: From) => To,
        args?: unknown
    ): Promise<To> {
        let response: From;
        try {
            response = await service;
        } catch (e) {
            console.log(e, args);
            throw toHttpError(e as Error, this.identity);
        }
        return mapper(response);
    }

    protected async handleQueryResponse<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To,
        args?: unknown,
        retries = 0
    ): Promise<To> {
        let response: From;
        try {
            response = await serviceCall();
            if (retries !== 0) {
                debug(`query: Recovered from a temporary query error after ${retries} retries`);
            }
        } catch (e) {
            const httpErr = toHttpError(e as Error, this.identity);

            if (
                !(httpErr instanceof SessionExpiryError) &&
                !(httpErr instanceof AuthError) &&
                retries < MAX_RETRIES
            ) {
                const delay = RETRY_DELAY * Math.pow(2, retries);
                return new Promise((resolve, reject) => {
                    debug(`query: error occurred, retrying in ${delay}ms`);
                    window.setTimeout(() => {
                        this.handleQueryResponse(serviceCall, mapper, args, retries + 1)
                            .then(resolve)
                            .catch(reject);
                    }, delay);
                });
            } else {
                debug(`query: Error performing query request: ${e}, ${args}, ${retries}`);
                throw httpErr;
            }
        }
        return mapper(response);
    }

    constructor(protected identity: Identity) {}
}
