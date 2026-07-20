import { ErrorCode, HttpError, type OCError, type PinNumberFailures } from "../domain";
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
// registry's uninstalled-token detection + client cache purge remove the token. The agent's
// reject message includes the IC error code, so we can recognise these here. Any OTHER failure
// is a real signal.
const DEAD_LEDGER_ERROR_CODES = ["IC0207", "IC0301", "IC0537"];
function isDeadLedgerError(error: unknown): boolean {
    return (
        error instanceof HttpError && DEAD_LEDGER_ERROR_CODES.some((c) => error.message.includes(c))
    );
}

// Decide whether a failed worker request should be reported to our error tracker. A tolerated
// kind is silenced only for the expected dead-ledger errors above; every other failure - a
// boundary error, a decode error, a code bug - is still reported so real regressions stay visible.
export function shouldReportWorkerError(kind: string, error: unknown): boolean {
    return !(callerToleratedErrorKinds.has(kind) && isDeadLedgerError(error));
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
