import {
    AgentError,
    type ErrorCode,
    HttpErrorCode,
    type Identity,
    ProtocolError,
    ReplicaRejectCode,
} from "@icp-sdk/core/agent";
import { ResponseTooLargeError } from "@shared";
import {
    getSessionExpiryMs,
    HttpError,
    ICErrorCode,
    SessionExpiryError,
    AuthError,
    CanisterUnavailableError,
    DestinationInvalidError,
    InvalidDelegationError,
    TypeboxValidationError,
} from "@shared";

export class ReplicaNotUpToDateError extends Error {
    public static byTimestamp(
        replicaTimestamp: bigint,
        clientTimestamp: bigint,
        failedPostCheck: boolean,
    ): ReplicaNotUpToDateError {
        const message = `Replica not up to date (timestamp). Client: ${clientTimestamp}. Replica: ${replicaTimestamp}. FailedPostCheck: ${failedPostCheck}`;

        return new ReplicaNotUpToDateError(message);
    }

    private constructor(message: string) {
        super(message);
    }
}

// The SDK hangs the details of a failure off `AgentError.code`. Which fields are present depends
// on how the call failed, so each accessor below returns `undefined` for the cases which don't
// carry it. Always prefer these over matching on the error message.
function errorCode(error: Error): Partial<ErrorCode & RejectFields & HttpErrorCode> | undefined {
    return error instanceof AgentError ? error.code : undefined;
}

type RejectFields = { rejectCode: ReplicaRejectCode; rejectErrorCode: string | undefined };

// A `DestinationInvalid` rejection means the target canister doesn't exist, eg. because the group
// or community has been deleted. No amount of retrying can make it exist, so it is mapped to a
// `DestinationInvalidError` to short-circuit the retry mechanism.
//
// The reject code has to be read from the error rather than matched on its message - the message
// only ever contains the numeric code ("Reject code: 3"), never the name.
function destinationInvalid(error: Error): boolean {
    return errorCode(error)?.rejectCode === ReplicaRejectCode.DestinationInvalid;
}

// The IC error code of a rejection, eg. "IC0301". Callers use this to recognise specific failures
// without having to match on the error message.
function rejectErrorCode(error: Error): string | undefined {
    return errorCode(error)?.rejectErrorCode;
}

// A canister which is frozen or has been uninstalled can't serve the call, and won't start being
// able to within the lifetime of this request, so retrying only stalls the caller. These have to be
// recognised by their IC error code - unlike a deleted canister they share their reject codes
// (`SysTransient` and `CanisterError`) with failures which genuinely are worth retrying.
const UNAVAILABLE_ERROR_CODES: string[] = [
    ICErrorCode.CanisterOutOfCycles,
    ICErrorCode.CanisterWasmModuleNotFound,
];

function canisterUnavailable(error: Error): boolean {
    const code = rejectErrorCode(error);
    return code !== undefined && UNAVAILABLE_ERROR_CODES.includes(code);
}

// A delegation which the boundary node refuses is reported as a 400 whose *body* explains why.
// Unlike a rejection there is no code for this, so the body text has to be matched - but match the
// body specifically rather than the composed error message, which also contains the response
// headers.
function invalidDelegation(error: Error): boolean {
    const code = errorCode(error);
    return (
        code instanceof HttpErrorCode && (code.bodyText?.includes("Invalid delegation") ?? false)
    );
}

function responseTooLarge(error: Error): ResponseTooLargeError | undefined {
    const regex = /application payload size \((\d+)\) cannot be larger than (\d+)/;
    const match = error.message.match(regex);

    if (match) {
        const size = parseInt(match[1]);
        const maxSize = parseInt(match[2]);
        return new ResponseTooLargeError(error, size, maxSize);
    }
    return undefined;
}

export function toCanisterResponseError(
    error: Error,
    identity: Identity,
): HttpError | ReplicaNotUpToDateError | TypeboxValidationError {
    const responseError = classifyError(error, identity);

    // Carry the IC error code across so that callers downstream (which only see the mapped error)
    // can recognise specific failures without matching on the error message
    if (responseError instanceof HttpError) {
        responseError.rejectErrorCode = rejectErrorCode(error);
    }

    return responseError;
}

function classifyError(
    error: Error,
    identity: Identity,
): HttpError | ReplicaNotUpToDateError | TypeboxValidationError {
    if (error instanceof ReplicaNotUpToDateError || error instanceof TypeboxValidationError) {
        return error;
    }

    let code = 500;

    if (destinationInvalid(error)) {
        return new DestinationInvalidError(error);
    }

    if (canisterUnavailable(error)) {
        return new CanisterUnavailableError(error);
    }

    const tooLarge = responseTooLarge(error);
    if (tooLarge) {
        return tooLarge;
    }

    if (error instanceof ProtocolError) {
        if (error.cause.code instanceof HttpErrorCode) {
            code = error.cause.code.status;
        }
        const timeUntilSessionExpiryMs = getSessionExpiryMs(identity) - Date.now();
        if (timeUntilSessionExpiryMs < 0) {
            console.debug(
                "SESSION: we received a 400 response and the session has timed out: ",
                timeUntilSessionExpiryMs,
            );
            return new SessionExpiryError(code, error);
        } else if (invalidDelegation(error)) {
            return new InvalidDelegationError(error);
        }
    }

    return code === 401 || code === 403 ? new AuthError(code, error) : new HttpError(code, error);
}
