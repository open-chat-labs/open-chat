import type { NcaPriority, NcaReporterContact, OpenChat } from "@client";
import {
    contactValid,
    outsideNcaBusinessHours,
    startAutomatedFiling,
} from "../../utils/ncaFiling";

export type FilingMode = "auto" | "manual";

/** How a submit went, for the dialog to act on; undefined when it failed (shown in the form) or didn't run. */
export type FilingOutcome =
    | { kind: "filed"; portalReference: string }
    | { kind: "started" };

type FilingClient = Pick<OpenChat, "recordAuthorityReportFiled" | "authorityReportToken">;

// The NCA (CSEA-IRP) filing form a moderation report card opens, shared by the old desktop and
// mobile dialogs and the web's (L6c). Automated filing is offered whenever the reporting service is
// configured; recording a manual portal filing stays available to platform operators (the original
// path), who may switch between the two.
export class NcaFilingForm {
    mode = $state<FilingMode>("manual");

    // --- manual mode ---
    reference = $state("");

    // --- automated mode ---
    // The moderator's own assessment; urgent verdicts suggest P1 but never decide it
    priority = $state<NcaPriority>("P3");
    firstName = $state("");
    lastName = $state("");
    countryCallingCode = $state("+44");
    phone = $state("");
    email = $state("");
    oohAcknowledged = $state(false);

    busy = $state(false);
    failed = $state(false);
    failureMessage = $state<string | undefined>(undefined);

    /** Whether the automated service is configured. */
    readonly autoAvailable: boolean;
    /** Outside the NCA's business hours when the form opened. */
    readonly outOfHours: boolean;

    #client: FilingClient;
    #reportIndex: bigint;
    #urgent: boolean;

    constructor(
        client: FilingClient,
        reportIndex: bigint,
        urgent: boolean,
        ncaReporterUrl: string,
        outOfHours: boolean = outsideNcaBusinessHours(),
    ) {
        this.#client = client;
        this.#reportIndex = reportIndex;
        this.#urgent = urgent;
        this.autoAvailable = ncaReporterUrl !== "";
        this.mode = this.autoAvailable ? "auto" : "manual";
        this.priority = urgent ? "P1" : "P3";
        this.outOfHours = outOfHours;
    }

    get urgent(): boolean {
        return this.#urgent;
    }

    /** P1 and P2 out of hours need the NCA phoned too: the moderator acknowledges it. */
    get needsOohAck(): boolean {
        return this.outOfHours && (this.priority === "P1" || this.priority === "P2");
    }

    get contact(): NcaReporterContact {
        return {
            firstName: this.firstName,
            lastName: this.lastName,
            phone: this.phone,
            countryCallingCode: this.countryCallingCode,
            email: this.email,
        };
    }

    get autoValid(): boolean {
        return contactValid(this.contact) && (!this.needsOohAck || this.oohAcknowledged);
    }

    get manualValid(): boolean {
        return this.reference.trim() !== "";
    }

    // Records that the NCA (CSEA-IRP) filing was made on the portal by hand: captures the
    // returned reference (URN) in the register
    async submitManual(): Promise<FilingOutcome | undefined> {
        const trimmed = this.reference.trim();
        if (trimmed === "" || this.busy) return undefined;
        this.busy = true;
        this.failed = false;
        const success = await this.#client.recordAuthorityReportFiled(
            this.#reportIndex,
            trimmed,
            this.#urgent,
            false,
        );
        this.busy = false;
        if (success) return { kind: "filed", portalReference: trimmed };
        this.failed = true;
        return undefined;
    }

    // Opens a signed filing window and hands it to the reporting service; the card tracks the
    // outcome via its authorityReport state
    async submitAuto(): Promise<FilingOutcome | undefined> {
        if (!this.autoValid || this.busy) return undefined;
        this.busy = true;
        this.failed = false;
        this.failureMessage = undefined;
        const result = await startAutomatedFiling(
            this.#client,
            this.#reportIndex,
            this.priority,
            this.contact,
            this.oohAcknowledged,
        );
        this.busy = false;
        if (result.kind === "started") return { kind: "started" };
        this.failed = true;
        this.failureMessage = result.message;
        return undefined;
    }
}
