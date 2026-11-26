import type { ResourceKey } from "@client";
import { SvelteMap } from "svelte/reactivity";

// How each of the console's forms last went, shown in its card's footer beside its action (the
// new web UI's console, in place of a toast and a line at the bottom of the page). A proposal
// that went through is "proposed", not a success: nothing has taken effect yet.

export type FormOutcomeKind = "success" | "proposed" | "failed";

export type FormOutcome = { kind: FormOutcomeKind; message: ResourceKey; at: number };

/** What an action hands back: the `logic/admin` outcomes all have this shape. A success that
 * only queued the change for another operator says so (`proposed`). */
export type ActionOutcome = { kind: "success" | "failed"; message: ResourceKey; proposed?: true };

/** A success of a dual-authorised action is "proposed", as is one that turned into a proposal
 * (clearing a legal hold whose release is pending); anything else is as it came. */
export function formOutcomeKind(outcome: ActionOutcome, proposal: boolean): FormOutcomeKind {
    return outcome.kind === "success" && (proposal || outcome.proposed === true)
        ? "proposed"
        : outcome.kind;
}

export class FormOutcomes {
    readonly #outcomes = new SvelteMap<string, FormOutcome>();

    of(form: string): FormOutcome | undefined {
        return this.#outcomes.get(form);
    }

    /** Keeps how a form's action went; none (the action did nothing) clears what was there. */
    record(
        form: string,
        outcome: ActionOutcome | undefined,
        proposal = false,
        at: number = Date.now(),
    ): void {
        if (outcome === undefined) {
            this.#outcomes.delete(form);
            return;
        }
        this.#outcomes.set(form, {
            kind: formOutcomeKind(outcome, proposal),
            message: outcome.message,
            at,
        });
    }

    /** Runs a form's action and keeps how it went. */
    async run(
        form: string,
        action: () => Promise<ActionOutcome | undefined>,
        proposal = false,
    ): Promise<void> {
        this.#outcomes.delete(form);
        this.record(form, await action(), proposal);
    }

    clear(form: string): void {
        this.#outcomes.delete(form);
    }
}
