import type { AdminSectionId } from "./adminSections";
import type { FormOutcomeKind } from "./formOutcomes.svelte";

// When the operator console (the new web UI's) reads its shared state again, as the old console
// did by mounting each tab afresh: a section reads what it shows as it opens, and a change that
// went through as a proposal reads the pending proposals again, so the list's row, the Danger
// zone's banner and Pending proposals (all one `PendingProposals`) count it at once.

/** What the console reads: the pending proposals, the authority register, and the operator
 * functions' settings (the call push switch, the moderation config, the Diamond fees). */
export type ConsoleLoad = "proposals" | "reports" | "operatorConfig";

/**
 * What a section reads as it opens. The operator functions' sections read the settings they
 * show beside their fields, as the old console's Operator functions tab did each time it
 * opened; the Danger zone also the proposals, for its banner's count. The daily puzzle,
 * translations and vault log read their own as they mount, as before.
 */
export function loadsOnOpen(section: AdminSectionId): ConsoleLoad[] {
    switch (section) {
        case "proposals":
            return ["proposals"];
        case "reports":
            return ["reports"];
        case "danger":
            return ["operatorConfig", "proposals"];
        case "infrastructure":
        case "money":
        case "moderation":
        case "integrations":
            return ["operatorConfig"];
        case "puzzle":
        case "translations":
        case "vault":
            return [];
    }
}

/**
 * What a form's outcome reads again: a proposal (a Danger zone change, or a legal hold clear
 * that became one) is a new pending proposal. A confirmed proposal needs nothing here: it's
 * read as the section it changed opens.
 */
export function loadsAfter(outcome: FormOutcomeKind | undefined): ConsoleLoad[] {
    return outcome === "proposed" ? ["proposals"] : [];
}

/**
 * Runs the console's reads, one at a time for each: a read asked for while the same one is
 * under way (the list panel and the section opening together) shares it.
 */
export class ConsoleLoads {
    readonly #loaders: Record<ConsoleLoad, () => Promise<void> | void>;
    readonly #inFlight = new Map<ConsoleLoad, Promise<void>>();

    constructor(loaders: Record<ConsoleLoad, () => Promise<void> | void>) {
        this.#loaders = loaders;
    }

    load(what: ConsoleLoad): Promise<void> {
        const running = this.#inFlight.get(what);
        if (running !== undefined) return running;
        const done = Promise.resolve(this.#loaders[what]()).finally(() =>
            this.#inFlight.delete(what),
        );
        this.#inFlight.set(what, done);
        return done;
    }

    /** The reads a section needs as it opens. */
    sectionOpened(section: AdminSectionId): Promise<void> {
        return this.#all(loadsOnOpen(section));
    }

    /** The reads a form's outcome calls for. */
    outcomeRecorded(outcome: FormOutcomeKind | undefined): Promise<void> {
        return this.#all(loadsAfter(outcome));
    }

    async #all(loads: ConsoleLoad[]): Promise<void> {
        await Promise.all(loads.map((l) => this.load(l)));
    }
}
