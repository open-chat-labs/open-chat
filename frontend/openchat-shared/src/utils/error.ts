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
// "error decoding response body" is the Tauri (reqwest) equivalent of a fetch dying mid-body.
const NETWORK_NOISE_PATTERN =
    /failed to fetch|networkerror|load failed|network connection was lost|error decoding response body/i;

const REQWEST_NOISE_PATTERN = /error decoding response body/i;

function isTransientNetworkError(error: unknown): boolean {
    // Structural checks rather than instanceof: errors which crossed the worker boundary
    // arrive as plain objects where only name/message/code survive
    const name = errorName(error);
    if (name === "HttpError") {
        const code = Number((error as { code?: unknown }).code);
        if (code >= 502 && code <= 504) return true;
    }
    const message = errorMessage(error);
    // Exempt from the TypeError rule below because it only ever originates from the Tauri
    // native fetch layer
    if (REQWEST_NOISE_PATTERN.test(message)) return true;
    // Only for the browser's own TypeError: our code also throws Errors whose text happens to
    // start "Failed to fetch ...", and those must stay reportable. A bare string carries no
    // name, so it can never satisfy this and is reported like any other unrecognised failure.
    return name === "TypeError" && NETWORK_NOISE_PATTERN.test(message);
}

// Failures produced by the client's environment rather than our code: corrupt or exhausted
// browser storage, permission prompts the user declined or let time out, and the browser
// failing to fetch its own service worker script. Nothing to fix per-occurrence.
const ENVIRONMENT_NOISE_PATTERNS: RegExp[] = [
    /internal error opening backing store/i,
    /file_error_no_space/i,
    /failed to read large indexeddb value/i,
    /failed to write blobs/i,
    /database connection is closing/i,
    /connection is closing because of: io error/i,
    /denied permission to use service worker/i,
    // WebAuthn's blanket NotAllowedError: the user dismissed the passkey prompt or it timed out
    /operation either timed out or was not allowed/i,
    /failed to (update|register) a serviceworker/i,
    // IndexedDB backing store failures (UnknownError) seen in storms from broken iOS installs
    /failed to delete record from object store/i,
    /unable to store record in object store/i,
    /delete range from database without an in-progress transaction/i,
    // The client's clock is wrong, so the replica certificate looks like it is from the future
    /certificate is signed more than 5 minutes in the future/i,
    // Safari's built-in media controls script, no frame of ours involved
    /can't find variable: EmptyRanges/i,
    // Benign browser warning surfaced as an error event
    /resizeobserver loop/i,
];

function errorName(error: unknown): string {
    if (error == null || typeof error !== "object" || !("name" in error)) return "";
    return typeof error.name === "string" ? error.name : "";
}

function errorMessage(error: unknown): string {
    if (typeof error === "string") return error;
    if (error == null || typeof error !== "object" || !("message" in error)) return "";
    return typeof error.message === "string" ? error.message : "";
}

function isEnvironmentNoise(error: unknown): boolean {
    const name = errorName(error);
    // AbortError is always a deliberate cancellation (navigation, stream teardown);
    // QuotaExceededError is the client's disk, not our code
    if (name === "AbortError" || name === "QuotaExceededError") return true;
    return ENVIRONMENT_NOISE_PATTERNS.some((p) => p.test(errorMessage(error)));
}

// Events requests race membership changes: a user who has left, lapsed or been blocked keeps
// requesting events until local state catches up, and the server answers with a NotAuthorized
// code (100-106) which `assertSuccessfulEventsResponse` turns into a thrown Error embedding the
// response JSON. Expected client state, not a defect.
// ChatNotFound is the same race for a chat that no longer exists on the server (a deleted
// direct chat partner, say) while the local summary still does.
// Deliberately scoped to that one message: a NotAuthorized code reaching us from anywhere else -
// a mutation, say - means our local view of the user's permissions is wrong, which is a defect.
const EVENTS_RESPONSE_ERROR_PREFIX = "Events response error:";
function isExpectedAccessError(error: unknown): boolean {
    const message = errorMessage(error);
    if (!message.startsWith(EVENTS_RESPONSE_ERROR_PREFIX)) return false;
    const match = message.match(/"code":(\d+)/);
    if (match == null) return false;
    const code = Number(match[1]);
    return (
        (code >= ErrorCode.InitiatorNotFound && code <= ErrorCode.InitiatorBlocked) ||
        code === ErrorCode.ChatNotFound
    );
}

// Central filter applied by the logger before anything reaches Rollbar: expected session
// teardown, network weather, client-environment failures and membership races are dropped;
// everything else is reported.
export function shouldReportError(error: unknown): boolean {
    return !(
        isExpectedSessionError(error) ||
        isTransientNetworkError(error) ||
        isEnvironmentNoise(error) ||
        isExpectedAccessError(error)
    );
}

// The same filter for Rollbar's checkIgnore hook, where only the payload strings are available -
// i.e. errors captured by captureUncaught / captureUnhandledRejections which bypass our logger
// entirely. Rebuilds the structural shape `shouldReportError` inspects from the exception class
// and message so both paths share one rule set; `name` is empty for payloads that carry no
// exception. An HttpError's status only survives in its message on this path.
export function shouldReportMessage(name: string, message: string): boolean {
    const status = message.match(/Status: (\d{3})\b/);
    const code = status != null ? Number(status[1]) : undefined;
    return shouldReportError({ name, message, code });
}

// Decide whether a failed worker request should be reported to our error tracker. Expected
// failures (session teardown, network weather, and dead-ledger errors for tolerated kinds) are
// silenced; every other failure - a decode error, a code bug - is still reported so real
// regressions stay visible.
export function shouldReportWorkerError(kind: string, error: unknown): boolean {
    if (!shouldReportError(error)) return false;
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
