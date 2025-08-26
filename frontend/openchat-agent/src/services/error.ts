import { HttpErrorCode, type Identity, ProtocolError } from "@icp-sdk/core/agent";
import { ResponseTooLargeError } from "openchat-shared";
import {
    getTimeUntilSessionExpiryMs,
    HttpError,
    SessionExpiryError,
    AuthError,
    DestinationInvalidError,
    InvalidDelegationError,
    TypeboxValidationError,
} from "openchat-shared";

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
    if (error instanceof ReplicaNotUpToDateError || error instanceof TypeboxValidationError) {
        return error;
    }

    let code = 500;

    if (error.message.includes("DestinationInvalid")) {
        // this will allow us to short-circuit the retry mechanism in this circumstance
        return new DestinationInvalidError(error);
    }

    const tooLarge = responseTooLarge(error);
    if (tooLarge) {
        return tooLarge;
    }

    if (error instanceof ProtocolError) {
        if (error.cause.code instanceof HttpErrorCode) {
            code = error.cause.code.status;
        }
        const timeUntilSessionExpiryMs = getTimeUntilSessionExpiryMs(identity);
        if (timeUntilSessionExpiryMs < 0) {
            console.debug(
                "SESSION: we received a 400 response and the session has timed out: ",
                timeUntilSessionExpiryMs,
            );
            return new SessionExpiryError(code, error);
        } else if (error.message.includes("Invalid delegation")) {
            return new InvalidDelegationError(error);
        }
    }

    return code === 401 || code === 403 ? new AuthError(code, error) : new HttpError(code, error);
}
