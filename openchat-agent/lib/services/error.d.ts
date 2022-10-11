import type { Identity } from "@dfinity/agent";
export declare class HttpError extends Error {
    code: number;
    constructor(code: number, error: Error);
}
export declare class AuthError extends HttpError {
    code: number;
    constructor(code: number, error: Error);
}
export declare class SessionExpiryError extends HttpError {
    code: number;
    constructor(code: number, error: Error);
}
export declare class ReplicaNotUpToDateError extends Error {
    static byEventIndex(latestReplicaEventIndex: number, latestClientEventIndex: number, failedPostCheck: boolean): ReplicaNotUpToDateError;
    static byTimestamp(replicaTimestamp: bigint, clientTimestamp: bigint): ReplicaNotUpToDateError;
    private constructor();
}
export declare function toCanisterResponseError(error: Error, identity: Identity): HttpError | ReplicaNotUpToDateError;
