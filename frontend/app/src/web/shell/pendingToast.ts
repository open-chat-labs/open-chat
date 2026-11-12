import type { MessageFormatter } from "@client";
import { interpolate } from "@i18n/i18n";
import type { HostedToast, PendingToastHost } from "@openchat/ui/src/lib/toasts.svelte";
import type { PendingToastAction, SettledOutcome } from "@src/logic/moderation/pendingToast";
import { toastStore } from "@src/stores/toast";

// A moderator's action with no dialog (unfreeze, un-suspend: logic/moderation's
// PendingToastAction) in the app's library toast layer (App's setPendingToastHost): a loader while
// it runs, then how it went in the same toast.

/** How long a toast offers Undo (a suspension's, a freeze's): native's undo toasts' time. */
export const UNDO_TOAST_MS = 5000;

/** How long a success stays: the app's own success toast's time (toastStore). */
export const SETTLED_TOAST_MS = 2500;

/**
 * What the pending toast turns into: a success with the check, gone after SETTLED_TOAST_MS; a
 * failure with no icon, which stays until it's closed, as the app's failure toasts do.
 * TODO(design): the design has no failure tone for a toast.
 */
export function settledToast(outcome: SettledOutcome, formatter: MessageFormatter): HostedToast {
    const message = interpolate(formatter, outcome.message);
    return outcome.kind === "success"
        ? { message, tone: "success", icon: "check", duration: SETTLED_TOAST_MS }
        : { message, icon: "none" };
}

/**
 * Runs the action in a pending toast, which then says how it went. Without a host (none in the
 * web app, which always provides one) only the outcome shows, in the app's toast.
 */
export async function runInPendingToast(
    host: PendingToastHost | undefined,
    action: PendingToastAction,
    formatter: MessageFormatter,
): Promise<void> {
    if (host === undefined) {
        toastStore.showOutcome(await action.run());
        return;
    }
    const toast = host({ message: interpolate(formatter, action.pending), icon: "none" });
    toast.settle(settledToast(await action.run(), formatter));
}
