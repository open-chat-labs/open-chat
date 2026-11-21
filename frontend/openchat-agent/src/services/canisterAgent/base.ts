import { HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import {
    AuthError,
    CanisterMethodNotFoundError,
    CanisterUnavailableError,
    DestinationInvalidError,
    InstructionLimitExceededError,
    redactSecrets,
    ResponseTooLargeError,
    SessionExpiryError,
    TypeboxValidationError,
} from "@shared";
import { ReplicaNotUpToDateError, toCanisterResponseError } from "../error";
import { waitForOnline } from "../../utils/waitForOnline";

const MAX_RETRIES = process.env.NODE_ENV === "production" ? 7 : 3;
const RETRY_DELAY = 100;
// The delay doubles with each retry but never exceeds this. Uncapped, the later retries slept for
// up to 6.4s, so a query which failed while the network was down (eg. just after the device woke)
// was often still asleep long after the network had recovered.
const MAX_RETRY_DELAY = 1000;

function debug(msg: string): void {
    console.log(msg);
}

export abstract class CanisterAgent {
    constructor(
        protected identity: Identity,
        protected agent: HttpAgent,
        protected canisterName: string,
    ) {}

    protected get principal(): Principal {
        return this.identity.getPrincipal();
    }

    protected executeQuery<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To | Promise<To>,
        args?: unknown,
        retries = 0,
    ): Promise<To> {
        return serviceCall()
            .then(mapper)
            .catch((err) => {
                const responseErr = toCanisterResponseError(err as Error, this.identity);
                const debugInfo = `error: ${JSON.stringify(
                    responseErr,
                    Object.getOwnPropertyNames(responseErr),
                )}, args: ${JSON.stringify(redactSecrets(args))}`;
                if (
                    !(responseErr instanceof ResponseTooLargeError) &&
                    !(responseErr instanceof SessionExpiryError) &&
                    !(responseErr instanceof DestinationInvalidError) &&
                    !(responseErr instanceof CanisterUnavailableError) &&
                    !(responseErr instanceof CanisterMethodNotFoundError) &&
                    !(responseErr instanceof InstructionLimitExceededError) &&
                    !(responseErr instanceof AuthError) &&
                    !(responseErr instanceof TypeboxValidationError) &&
                    retries < MAX_RETRIES
                ) {
                    const delay = Math.min(RETRY_DELAY * Math.pow(2, retries), MAX_RETRY_DELAY);

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
                        setTimeout(async () => {
                            // With the browser offline a retry can only fail too, and retrying
                            // each second sent a query over and over while the device was offline.
                            // So the retry waits for the browser to be back, and goes then. One
                            // still offline after `OFFLINE_RETRY_WAIT_MS` gives up: pollers stop
                            // while offline and run again once the app is back.
                            if (!(await waitForOnline())) {
                                debug(
                                    `query: still offline, exiting retry loop. retries: ${retries}. ${debugInfo}`,
                                );
                                reject(responseErr);
                                return;
                            }
                            this.executeQuery(serviceCall, mapper, args, retries + 1)
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

    protected writeTrace(methodName: string, update: boolean, duration: number, isError: boolean) {
        if (!isError) {
            console.debug(
                `TRACE: ${update ? "Update" : "Query"} call to ${
                    this.canisterName
                }.${methodName} took ${Math.trunc(duration)}ms`,
            );
        }
    }
}
