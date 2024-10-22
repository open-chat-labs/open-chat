import type { PinNumberFailures } from "openchat-shared";
import { durationToTimestamp } from "../../utils/mapping";

export function pinNumberFailureResponseV2(
    value: "PinRequired" | { PinIncorrect: bigint } | { TooManyFailedPinAttempts: bigint },
): PinNumberFailures {
    if (value === "PinRequired") {
        return {
            kind: "pin_required",
        };
    }

    if ("PinIncorrect" in value) {
        return {
            kind: "pin_incorrect",
            nextRetryAt: value.PinIncorrect > 0n ? durationToTimestamp(value.PinIncorrect) : 0n,
        };
    }

    if ("TooManyFailedPinAttempts" in value) {
        return {
            kind: "too_main_failed_pin_attempts",
            nextRetryAt: durationToTimestamp(value.TooManyFailedPinAttempts),
        };
    }

    throw new Error("Unexpected ApiPinNumberResponse type received");
}
