import { app, dummyPinNumberFailureStore } from "openchat-client";
import { formatTimeRemaining } from "openchat-client/lib/utils/time";
import type { PinNumberFailures, ResourceKey } from "openchat-shared";
import { derived } from "svelte/store";
import { now500 } from "./time";

export type SetPin = { kind: "set" };
export type ClearPin = { kind: "clear" };
export type ChangePin = { kind: "change" };
export type EnterPin = { kind: "enter" };
export type ForgotPin = { kind: "forgot"; while: ForgotPinWhile };
export type PinOperation = SetPin | ClearPin | ChangePin | ForgotPin | EnterPin;
export type ForgotPinWhile = ClearPin | ChangePin | EnterPin;

export function supportsForgot(operation: PinOperation): operation is ForgotPinWhile {
    return operation.kind === "change" || operation.kind === "clear" || operation.kind === "enter";
}

export const pinNumberErrorMessageStore = derived(
    [now500, dummyPinNumberFailureStore],
    ([$nowStore, _]) => {
        return app.pinNumberFailure
            ? pinNumberErrorMessage(app.pinNumberFailure, $nowStore)
            : undefined;
    },
);

export function pinNumberErrorMessage(
    resp: PinNumberFailures | undefined,
    now: number = 0,
): ResourceKey | undefined {
    if (resp === undefined) return undefined;

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

    const duration =
        nextRetryAt !== undefined ? formatTimeRemaining(now, Number(nextRetryAt), true) : "";

    return {
        kind: "resource_key",
        key: "pinNumber." + error,
        params: { duration },
        level: undefined,
        lowercase: false,
    };
}
