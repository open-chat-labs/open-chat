import type { PinNumberFailures } from "openchat-shared";
import type { Milliseconds } from "../user/candid/types";
import { durationToTimestamp } from "../../utils/mapping";

type ApiPinNumberResponse = 
  | { TooManyFailedPinAttempts : Milliseconds } 
  | { PinIncorrect : Milliseconds } 
  | { PinRequired : null };

export function pinNumberFailureResponse(candid: ApiPinNumberResponse): PinNumberFailures {
    if ("PinRequired" in candid) {
        return { 
            kind: "pin_required" 
        };
    }

    if ("PinIncorrect" in candid) {
        return { 
            kind: "pin_incorrect", 
            nextRetryAt: candid.PinIncorrect > 0n ? durationToTimestamp(candid.PinIncorrect) : 0n,
        };
    }

    if ("TooManyFailedPinAttempts" in candid) {
        return { 
            kind: "too_main_failed_pin_attempts", 
            nextRetryAt: durationToTimestamp(candid.TooManyFailedPinAttempts)
        };
    }

    throw new Error("Unexpected ApiPinNumberResponse type received");
}