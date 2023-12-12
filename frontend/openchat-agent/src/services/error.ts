import type { Identity } from "@dfinity/agent";
import {
    getTimeUntilSessionExpiryMs,
    HttpError,
    SessionExpiryError,
    AuthError,
    DestinationInvalidError,
    InvalidDelegationError,
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

export function toCanisterResponseError(
    error: Error,
    identity: Identity,
): HttpError | ReplicaNotUpToDateError {
    if (error instanceof ReplicaNotUpToDateError) {
        return error;
    }

    let code = 500;

    if (error.message.includes("DestinationInvalid")) {
        // this will allow us to short-circuit the retry mechanism in this circumstance
        return new DestinationInvalidError(error);
    }

    const statusLine = error.message
        .split("\n")
        .map((l) => l.trim().toLowerCase())
        .find((l) => l.startsWith("code:") || l.startsWith("http status code:"));

    if (statusLine) {
        const parts = statusLine.split(":");
        if (parts && parts.length > 1) {
            let valueText = parts[1].trim();
            const valueParts = valueText.split(" ");
            if (valueParts && valueParts.length > 1) {
                valueText = valueParts[0].trim();
            }
            code = parseInt(valueText, 10);
            if (isNaN(code)) {
                code = 500;
            }
        }
    }

    // if we make an api after the session has expired (which should not happen) it will manifest as a 400 error
    if (code === 400 && getTimeUntilSessionExpiryMs(identity) < 0) {
        console.debug(
            "SESSION: we received a 400 response and the session has timed out: ",
            getTimeUntilSessionExpiryMs(identity),
        );
        return new SessionExpiryError(code, error);
    }
    if (code === 403 && error.message.includes("Invalid delegation")) {
        return new InvalidDelegationError(error);
    }

    return code === 401 || code === 403 ? new AuthError(code, error) : new HttpError(code, error);
}
