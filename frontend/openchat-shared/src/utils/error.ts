import { ErrorCode, type OCError, type PinNumberFailures } from "../domain";
import { parseBigInt } from "./bigint";

export function isError(value: unknown): value is OCError {
    return value != null && typeof value === "object" && "kind" in value && value.kind === "error";
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
