import {
    ErrorCode,
    HttpError,
    INVALID_DELEGATION_ERROR_NAME,
    type OCError,
    type PinNumberFailures,
    SESSION_EXPIRY_ERROR_NAME,
} from "../domain";
// Imported from the module rather than the barrel: `../domain` cycles back through here, so a
// binding read at module scope (as below) is not yet initialised when going via the barrel
import { ICErrorCode } from "../domain/error";
import { parseBigInt } from "./bigint";

export function isError(value: unknown): value is OCError {
    return value != null && typeof value === "object" && "kind" in value && value.kind === "error";
}

// Request kinds whose failures the caller always tolerates (e.g. `refreshAccountBalance`
// falls back to a cached / zero balance).
const callerToleratedErrorKinds = new Set<string>(["refreshAccountBalance"]);

// A ledger canister that is frozen (IC0207), has no wasm module (IC0537) or has been deleted
// (IC0301) is a dead / decommissioned token ledger. Balance refreshes against these are
// expected: for the ~30 day window before the IC uninstalls a frozen canister, and until the
// registry's uninstalled-token detection + client cache purge remove the token. Any OTHER failure
// is a real signal.
const DEAD_LEDGER_ERROR_CODES: string[] = [
    ICErrorCode.CanisterOutOfCycles,
    ICErrorCode.CanisterNotFound,
    ICErrorCode.CanisterWasmModuleNotFound,
];
function isDeadLedgerError(error: unknown): boolean {
    return (
        error instanceof HttpError &&
        error.rejectErrorCode !== undefined &&
        DEAD_LEDGER_ERROR_CODES.includes(error.rejectErrorCode)
    );
}

// The session ending underneath an in-flight request is expected: the user logged out or their
// delegation expired and the app redirects to login. Every request racing that teardown fails
// with one of these, so reporting them buries real regressions under per-kind noise.
function isExpectedSessionError(error: unknown): boolean {
    if (error == null || typeof error !== "object" || !("name" in error)) return false;
    return error.name === "AnonymousOperationError" || requiresLogout(error);
}

// Network weather as seen from the client: a gateway 502/503/504, or a fetch that never got a
// response at all. The client retries or surfaces these contextually and server-side monitoring
// owns the underlying incidents, so per-occurrence client reports are pure noise. 500 is NOT
// included: replica rejections (including canister traps) map to HttpError 500 here, and those
// are exactly the signal this filter must keep.
function isTransientNetworkError(error: unknown): boolean {
    if (error instanceof HttpError && error.code >= 502 && error.code <= 504) return true;
    return (
        error instanceof Error &&
        error.name === "TypeError" &&
        /failed to fetch|networkerror|load failed|network connection was lost/i.test(error.message)
    );
}

// Decide whether a failed worker request should be reported to our error tracker. Expected
// failures (session teardown, network weather, and dead-ledger errors for tolerated kinds) are
// silenced; every other failure - a decode error, a code bug - is still reported so real
// regressions stay visible.
export function shouldReportWorkerError(kind: string, error: unknown): boolean {
    if (isExpectedSessionError(error) || isTransientNetworkError(error)) return false;
    return !(callerToleratedErrorKinds.has(kind) && isDeadLedgerError(error));
}

// Whether a rejected promise means the user's session is no longer usable and they must be logged
// out. These errors reach the client through the worker, so their prototype is gone and `name` is
// all that survives - see the constants in ../domain/error.
export function requiresLogout(error: unknown): boolean {
    if (error == null || typeof error !== "object" || !("name" in error)) return false;

    return error.name === SESSION_EXPIRY_ERROR_NAME || error.name === INVALID_DELEGATION_ERROR_NAME;
}

export function pinNumberFailureFromError(error: OCError): PinNumberFailures | undefined {
    function nextRetryAt(message: string | undefined): bigint {
        if (message === undefined) return BigInt(0);
        const delay = parseBigInt(message);
        return delay !== undefined ? BigInt(Date.now()) + delay : BigInt(0);
    }

    switch (error.code) {
        case ErrorCode.PinRequired:
            return { kind: "pin_required" };

        case ErrorCode.PinIncorrect:
            return {
                kind: "pin_incorrect",
                nextRetryAt: nextRetryAt(error.message),
            };

        case ErrorCode.TooManyFailedPinAttempts:
            return {
                kind: "too_main_failed_pin_attempts",
                nextRetryAt: nextRetryAt(error.message),
            };

        default:
            return undefined;
    }
}
