import type { ResourceKey, ToastOutcome } from "@client";

// A moderation dialog's one action (Suspend, Freeze) while it runs: the dialog stays open until the
// backend answers, the action's button spins and nothing dismisses it (Esc, ×, the backdrop,
// Cancel). A failure stays in the dialog, inline, with what the moderator typed, and the action can
// be tried again; a success is handed back for the view to close and say so.

/** A failure the dialog shows inline (its words): a ToastOutcome's, shown in the dialog instead. */
export type ActionFailure = Extract<ToastOutcome, { kind: "failed" }>;

export type PendingActionState = { kind: "idle" } | { kind: "busy" } | ActionFailure;

function isFailure<S extends { kind: string }>(
    outcome: S | ActionFailure,
): outcome is ActionFailure {
    return outcome.kind === "failed";
}

export class PendingAction {
    state: PendingActionState = $state({ kind: "idle" });

    /** Running: the button spins, and neither it nor anything that dismisses the dialog responds. */
    get busy(): boolean {
        return this.state.kind === "busy";
    }

    /** The last try's failure, shown inline until the next try. */
    get error(): ResourceKey | undefined {
        return this.state.kind === "failed" ? this.state.message : undefined;
    }

    /**
     * Runs the action once at a time (a press while it runs is ignored: undefined). A success comes
     * back for the view to close the dialog and say so; a failure stays here (`error`), and
     * undefined comes back.
     */
    async run<S extends { kind: string }>(
        action: () => Promise<S | ActionFailure>,
    ): Promise<S | undefined> {
        if (this.busy) return undefined;
        this.state = { kind: "busy" };
        const outcome = await action();
        if (isFailure(outcome)) {
            this.state = outcome;
            return undefined;
        }
        this.state = { kind: "idle" };
        return outcome;
    }
}
