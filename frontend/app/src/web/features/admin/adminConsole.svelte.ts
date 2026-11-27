import type { OpenChat, ResourceKey } from "@client";
import type { AdminSectionId } from "@src/logic/admin/adminSections";
import { AuthorityReports, slaStanding } from "@src/logic/admin/authorityReports.svelte";
import { ConsoleLoads } from "@src/logic/admin/consoleLoads";
import { DailyPuzzleOperator } from "@src/logic/admin/dailyPuzzleOperator.svelte";
import { FormOutcomes, type ActionOutcome } from "@src/logic/admin/formOutcomes.svelte";
import { OperatorFunctions } from "@src/logic/admin/operatorFunctions.svelte";
import { isOwnProposal, PendingProposals } from "@src/logic/admin/pendingProposals.svelte";
import { TranslationCorrections } from "@src/logic/admin/translationCorrections.svelte";
import { VaultLog } from "@src/logic/admin/vaultLog.svelte";

// The operator console's state, shared by its two screens (the sections in the list panel, the
// section open in the main pane) while /admin shows: the `logic/admin` classes, made when the
// console opens and dropped when it closes, so it opens afresh as the old one did; and how each
// form last went (FormOutcomes). The list panel loads the proposals and the register for its
// counts; a section reads what it shows each time it opens, and a proposal that went through
// reads the proposals again (ConsoleLoads).

/** What a settings card's footer says: busy while its action runs, else how it last went. */
export type CardOutcome = { kind: "busy" | "success" | "proposed" | "failed"; text: string };

export class AdminConsole {
    readonly proposals: PendingProposals;
    readonly reports: AuthorityReports;
    readonly ops: OperatorFunctions;
    readonly puzzle: DailyPuzzleOperator;
    readonly corrections: TranslationCorrections;
    readonly vault: VaultLog;
    readonly outcomes = new FormOutcomes();
    readonly loads: ConsoleLoads;

    constructor(client: OpenChat) {
        this.proposals = new PendingProposals(client);
        this.reports = new AuthorityReports(client);
        this.ops = new OperatorFunctions(client);
        this.puzzle = new DailyPuzzleOperator(client);
        this.corrections = new TranslationCorrections(client);
        this.vault = new VaultLog(client);
        this.loads = new ConsoleLoads({
            proposals: () => this.proposals.refresh(),
            reports: () => this.reports.load(),
            operatorConfig: () => this.ops.load(),
        });
    }

    /** Reads what a section shows, as it opens (as the old console's tabs did on mounting). */
    sectionOpened(section: AdminSectionId): Promise<void> {
        return this.loads.sectionOpened(section);
    }

    /** Runs a form's action, keeps how it went, and reads again what that calls for (a
     * proposal: the pending proposals). */
    async run(
        form: string,
        action: () => Promise<ActionOutcome | undefined>,
        proposal = false,
    ): Promise<void> {
        await this.outcomes.run(form, action, proposal);
        // not waited for: the form is done once its outcome is in
        void this.loads.outcomeRecorded(this.outcomes.of(form)?.kind);
    }

    /** The proposals awaiting you (another operator's) and yours; none until they've loaded. */
    proposalCounts(userId: string): { awaitingYou: number; yours: number } | undefined {
        const p = this.proposals;
        if (p.error !== undefined || (p.loading && p.pending.length === 0)) return undefined;
        const yours = p.pending.filter((x) => isOwnProposal(x, userId)).length;
        return { awaitingYou: p.pending.length - yours, yours };
    }

    /** The due reports by how they stand against their SLA targets; none until it's loaded. */
    reportCounts(now: number): { overdue: number; soon: number; filed: number } | undefined {
        if (!this.reports.loaded) return undefined;
        const states = this.reports.due.map((row) => slaStanding(row, now).state);
        return {
            overdue: states.filter((s) => s === "overdue").length,
            soon: states.filter((s) => s === "soon").length,
            filed: this.reports.filed.length,
        };
    }

    /** A card's footer: `busyText` while it's busy, else its last outcome, translated. */
    cardOutcome(
        form: string,
        busy: boolean,
        translate: (key: ResourceKey) => string,
        busyText = "Applying…",
    ): CardOutcome | undefined {
        if (busy) return { kind: "busy", text: busyText };
        const outcome = this.outcomes.of(form);
        return outcome === undefined
            ? undefined
            : { kind: outcome.kind, text: translate(outcome.message) };
    }
}

/**
 * Whether this session's chat polling was paused here: the client doesn't say, and it outlives
 * the console (pausing stops only this client's poller, until it's resumed or the page reloads).
 */
export const sessionPolling = $state<{ paused: boolean }>({ paused: false });

let current: { client: OpenChat; console: AdminConsole } | undefined;

/** The open console's state, made the first time either screen asks for it. */
export function adminConsole(client: OpenChat): AdminConsole {
    if (current === undefined || current.client !== client) {
        current = { client, console: new AdminConsole(client) };
    }
    return current.console;
}

/** Drops the console's state as it closes, so it opens afresh next time. */
export function closeAdminConsole(): void {
    current = undefined;
}
