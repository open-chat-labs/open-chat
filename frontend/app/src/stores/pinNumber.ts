import type { PinNumberFailures, ResourceKey,  } from "openchat-shared";
import { derived } from "svelte/store";
import { now500 } from "./time";
import { formatTimeRemaining } from "openchat-client/lib/utils/time";
import { pinNumberFailureStore } from "openchat-client";

export const pinNumberErrorMessageStore = derived([now500, pinNumberFailureStore], ([$nowStore, $pinNumberFailureStore]) => {
    return $pinNumberFailureStore ? pinNumberErrorMessage($pinNumberFailureStore, $nowStore) : undefined;
});

function pinNumberErrorMessage(resp: PinNumberFailures, now: number = 0): ResourceKey | undefined {
    let error;
    let nextRetryAt: bigint | undefined;

    now = Math.max(now, Date.now());

    if (resp.kind === "pin_incorrect") {
        if (resp.nextRetryAt > now) {
            error = "pinIncorrectTryLater";
            nextRetryAt = resp.nextRetryAt;
        } else {
            error = "pinIncorrect";
        }
    } else if (resp.kind === "pin_required") {
        error = "pinRequired";
    } else if (resp.kind === "too_main_failed_pin_attempts") {
        error = "tooManyFailedAttempts";
        nextRetryAt = resp.nextRetryAt;
        if (resp.nextRetryAt <= now) {
            return undefined;
        }
    } else {
        return undefined;
    }

    const duration = nextRetryAt !== undefined 
        ? formatTimeRemaining(
            now,
            Number(nextRetryAt),
            true,
        )
        : "";

    return {
        kind: "resource_key",
        key: "pinNumber." + error,
        params: { duration },
        level: undefined,
        lowercase: false,
    };
}

