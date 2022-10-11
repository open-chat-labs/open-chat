import { getTimeUntilSessionExpiryMs } from "./auth";
export class HttpError extends Error {
    constructor(code, error) {
        super(error.message);
        this.code = code;
        this.stack = error.stack;
        this.name = "HttpError";
    }
}
export class AuthError extends HttpError {
    constructor(code, error) {
        super(code, error);
        this.code = code;
        this.name = "AuthError";
    }
}
export class SessionExpiryError extends HttpError {
    constructor(code, error) {
        super(code, error);
        this.code = code;
        this.name = "SessionExpiryError";
    }
}
export class ReplicaNotUpToDateError extends Error {
    static byEventIndex(latestReplicaEventIndex, latestClientEventIndex, failedPostCheck) {
        const message = `Replica not up to date (event index). Client: ${latestClientEventIndex}. Replica: ${latestReplicaEventIndex}. FailedPostCheck: ${failedPostCheck}`;
        return new ReplicaNotUpToDateError(message);
    }
    static byTimestamp(replicaTimestamp, clientTimestamp) {
        const message = `Replica not up to date (timestamp). Client: ${clientTimestamp}. Replica: ${replicaTimestamp}.`;
        return new ReplicaNotUpToDateError(message);
    }
    constructor(message) {
        super(message);
    }
}
export function toCanisterResponseError(error, identity) {
    if (error instanceof ReplicaNotUpToDateError) {
        return error;
    }
    let code = 500;
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
        return new SessionExpiryError(code, error);
    }
    return code === 401 || code === 403 ? new AuthError(code, error) : new HttpError(code, error);
}
//# sourceMappingURL=error.js.map