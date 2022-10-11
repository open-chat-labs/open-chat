import { Actor, HttpAgent } from "@dfinity/agent";
import { rollbar } from "../utils/logging";
import { AuthError, ReplicaNotUpToDateError, SessionExpiryError, toCanisterResponseError } from "./error";
const MAX_RETRIES = process.env.NODE_ENV === "production" ? 7 : 3;
const RETRY_DELAY = 100;
function debug(msg) {
    rollbar.debug(msg);
    console.log(msg);
}
export class CandidService {
    constructor(identity) {
        this.identity = identity;
    }
    createServiceClient(factory, canisterId) {
        const host = process.env.IC_URL;
        const agent = new HttpAgent({ identity: this.identity, host });
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }
        return Actor.createActor(factory, {
            agent,
            canisterId,
        });
    }
    handleResponse(service, mapper, args) {
        return service.then(mapper).catch((err) => {
            console.log(err, args);
            throw toCanisterResponseError(err, this.identity);
        });
    }
    handleQueryResponse(serviceCall, mapper, args, interrupt, retries = 0) {
        return serviceCall()
            .then(mapper)
            .catch((err) => {
            const responseErr = toCanisterResponseError(err, this.identity);
            const debugInfo = `error: ${JSON.stringify(responseErr)}, args: ${JSON.stringify(args)}`;
            if (!(responseErr instanceof SessionExpiryError) &&
                !(responseErr instanceof AuthError) &&
                retries < MAX_RETRIES &&
                !(interrupt && interrupt(retries)) // bail out of the retry if the caller tells us to
            ) {
                const delay = RETRY_DELAY * Math.pow(2, retries);
                if (responseErr instanceof ReplicaNotUpToDateError) {
                    debug(`query: replica not up to date, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`);
                }
                else {
                    debug(`query: error occurred, retrying in ${delay}ms. retries: ${retries}. ${debugInfo}`);
                }
                return new Promise((resolve, reject) => {
                    window.setTimeout(() => {
                        this.handleQueryResponse(serviceCall, mapper, args, interrupt, retries + 1)
                            .then(resolve)
                            .catch(reject);
                    }, delay);
                });
            }
            else {
                debug(`query: Error performing query request, exiting retry loop. retries: ${retries}. ${debugInfo}`);
                throw responseErr;
            }
        });
    }
}
//# sourceMappingURL=candidService.js.map