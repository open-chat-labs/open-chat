import { requiresLogout } from "@client";
import { eventToError, isIdbConnectionClosingError, recordError } from "@utils/errorPostmortem";

// The window's error / unhandledrejection handler, shared by every App tree.
export function handleUnhandledError(ev: Event, logout: () => void): void {
    if (
        ev instanceof ErrorEvent &&
        (ev.message.includes("ResizeObserver loop completed with undelivered notifications") ||
            ev.message.includes("ResizeObserver loop limit exceeded"))
    ) {
        return;
    }

    const err = eventToError(ev);
    if (isIdbConnectionClosingError(err)) {
        ev.preventDefault();
        return;
    }
    recordError("window", err);
    // Deliberately not reported here. Rollbar's own captureUncaught /
    // captureUnhandledRejections already reports every event this handler sees, and
    // installs earlier than this listener, so logging again produced two Rollbar items
    // per rejection - one titled "Unhandled error: X" and one titled "X" - splitting
    // every defect in two and doubling the volume. Its `checkIgnore` reads the rejection
    // reason out of the original arguments, so worker errors - which arrive as plain
    // objects, not Errors - are still filtered on name and code. This handler keeps the
    // crash-log record and the logout, which Rollbar's capture does not do.
    if (ev instanceof PromiseRejectionEvent && requiresLogout(ev.reason)) {
        logout();
        ev.preventDefault();
    }
}
