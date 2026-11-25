import type {
    AuthorityReportState,
    MediaScanMatch,
    ModerationReportContent,
    ModerationVerdict,
    OpenChat,
} from "@client";
import { createSubscriber } from "svelte/reactivity";
import {
    canOpenFiling,
    canResolveReport,
    filingChecklistUrl,
    isAttemptStale,
    reportHashLines,
    reportMediaMatches,
    shownAuthorityReport,
} from "./moderationReport";
import { MediaReviewGate } from "./vaultMediaReview.svelte";

type CardClient = Pick<
    OpenChat,
    "resolveModerationReport" | "clearAuthorityReportAttempt" | "vaultFileInfo"
>;

/** What the card follows: the report (a new one each time it changes), and the reader's roles. */
export type ReportCardInputs = {
    content: ModerationReportContent;
    isModerator: boolean;
    isOperator: boolean;
};

export type ReportCardOptions = {
    /** The automated filing service (utils/ncaFiling's `ncaReporterUrl`); empty when not configured. */
    ncaReporterUrl: string;
    /** Copies the hash lines (utils/urls' `copyToClipboard`): whether it worked. */
    copy: (text: string) => Promise<boolean>;
    /** The time, for the filing states that depend on it (Date.now). */
    clock?: () => number;
};

export type HashCopyState = "idle" | "copied" | "failed";

/** How often the time-based filing states are looked at again while the card shows. */
const TICK_MS = 30_000;
/** How long Copy hashes says how it went. */
const HASH_COPY_RESET_MS = 2000;

// One moderation report card's own state, shared by the old desktop and mobile cards and the web's
// (L6c): a verdict (once at a time; once given, the card offers no other), the urgent flag a CSAM
// verdict carries, the review-before-verdict gate (`gate`), a filing just recorded or started from
// the card ahead of the report's update, clearing a stale filing attempt (operators), and copying
// the hashes. What it shows is worked out from the report (moderationReport.ts).
export class ModerationReportCard {
    busy = $state(false);
    failed = $state(false);
    // The canister explains WHY a verdict was refused (your own assertion, already resolved);
    // showing "failed" alone leaves the moderator guessing
    failureReason = $state<string | undefined>(undefined);
    resolved = $state(false);
    urgent = $state(false);
    // Set once a filing is recorded from this card, ahead of the content update round-trip
    filedReference = $state<string | undefined>(undefined);
    clearingAttempt = $state(false);
    clearAttemptFailed = $state(false);
    hashCopyState = $state<HashCopyState>("idle");
    // A verdict on a media report requires the media to have been reviewed first: deciding
    // without looking is exactly what this system exists to prevent. Two exceptions surface
    // explicitly rather than silently locking the card: the caller not being a designated vault
    // reviewer, and the media being unavailable or fetched but unplayable in this browser (in
    // which case the verdict proceeds on the remaining evidence).
    readonly gate = new MediaReviewGate();

    // Set once an automated filing was accepted by the reporting service, ahead of the on-chain
    // attempt marker reaching the card, with the report it was started on. The overlay lapses as
    // soon as the report changes (whatever it changes to: the service may have failed before
    // opening a marker) and after a bounded time regardless, so a genuine return to Due is never
    // hidden
    #filingStarted = $state.raw<{ at: number; on: ModerationReportContent } | undefined>(
        undefined,
    );
    // The report a stale attempt was cleared on: the Clear button stays away until it changes
    #clearedOn = $state.raw<ModerationReportContent | undefined>(undefined);

    #client: CardClient;
    #inputs: () => ReportCardInputs;
    #options: ReportCardOptions;
    #clock: () => number;
    #now = $state(0);
    // Ticks while something shows the time-based states, so they're looked at again
    #ticking = createSubscriber((update) => {
        const interval = setInterval(() => {
            this.#now = this.#clock();
            update();
        }, TICK_MS);
        return () => clearInterval(interval);
    });

    constructor(client: CardClient, inputs: () => ReportCardInputs, options: ReportCardOptions) {
        this.#client = client;
        this.#inputs = inputs;
        this.#options = options;
        this.#clock = options.clock ?? Date.now;
        this.#now = this.#clock();
    }

    get content(): ModerationReportContent {
        return this.#inputs().content;
    }

    get now(): number {
        this.#ticking();
        return this.#now;
    }

    get mediaMatches(): MediaScanMatch[] {
        return reportMediaMatches(this.content);
    }

    get hasMedia(): boolean {
        return this.content.blobReferences.length > 0;
    }

    /** The media still has to be reviewed before a verdict. */
    get needsMediaReview(): boolean {
        return this.hasMedia && !this.gate.reviewed;
    }

    get canResolve(): boolean {
        return canResolveReport(this.content, this.#inputs().isModerator);
    }

    get canOpenFiling(): boolean {
        const { content, isOperator, isModerator } = this.#inputs();
        return canOpenFiling(content, isOperator, isModerator, this.#options.ncaReporterUrl);
    }

    /** Whether filing goes through the automated service (else it records a manual filing). */
    get automatedFiling(): boolean {
        return this.#options.ncaReporterUrl !== "";
    }

    get isOperator(): boolean {
        return this.#inputs().isOperator;
    }

    get checklistUrl(): string {
        return filingChecklistUrl(this.content);
    }

    /** The filing state shown (shownAuthorityReport). */
    get authorityReport(): AuthorityReportState | undefined {
        const content = this.content;
        const started = this.#filingStarted;
        return shownAuthorityReport(
            content.authorityReport,
            this.filedReference,
            started !== undefined && started.on === content ? started.at : undefined,
            this.now,
        );
    }

    get attemptIsStale(): boolean {
        return isAttemptStale(this.authorityReport, this.now);
    }

    /** A stale attempt was cleared on this report (its update will carry the new state). */
    get attemptCleared(): boolean {
        return this.#clearedOn !== undefined && this.#clearedOn === this.content;
    }

    /** Whether the filing dialog can open on the state shown (not once filed or attempting). */
    get filingOpen(): boolean {
        const shown = this.authorityReport;
        return (
            this.content.reportIndex !== undefined &&
            shown !== undefined &&
            shown.kind !== "filed" &&
            shown.kind !== "attempting"
        );
    }

    /** The urgency a filing carries: the shown state's (Due, or a failure to retry). */
    get filingUrgent(): boolean {
        const shown = this.authorityReport;
        return shown !== undefined && "urgent" in shown ? shown.urgent : false;
    }

    async resolve(verdict: ModerationVerdict): Promise<void> {
        const reportIndex = this.content.reportIndex;
        if (reportIndex === undefined || this.busy || this.resolved) return;
        this.busy = true;
        this.failed = false;
        this.failureReason = undefined;
        const result = await this.#client.resolveModerationReport(
            reportIndex,
            verdict,
            verdict === "upheld_as_csam" ? this.urgent : undefined,
        );
        this.busy = false;
        this.resolved = result.kind === "success";
        this.failed = result.kind !== "success";
        this.failureReason = result.kind === "error" ? result.message : undefined;
    }

    // Operator reconciliation of an orphaned marker: clears it on chain so the report returns to
    // Due (the card update carries the new state)
    async clearAttempt(): Promise<void> {
        const content = this.content;
        if (content.reportIndex === undefined) return;
        this.clearingAttempt = true;
        this.clearAttemptFailed = false;
        const ok = await this.#client.clearAuthorityReportAttempt(content.reportIndex);
        this.clearingAttempt = false;
        this.#clearedOn = ok ? content : undefined;
        this.clearAttemptFailed = !ok;
    }

    async copyHashes(): Promise<void> {
        const lines = await reportHashLines(this.#client, this.content);
        const ok = lines.length > 0 && (await this.#options.copy(lines.join("\n")));
        this.hashCopyState = ok ? "copied" : "failed";
        setTimeout(() => (this.hashCopyState = "idle"), HASH_COPY_RESET_MS);
    }

    /** The filing dialog recorded a manual filing. */
    filed(portalReference: string): void {
        this.filedReference = portalReference;
    }

    /** The filing dialog handed a filing to the automated service. */
    filingStarted(): void {
        this.#filingStarted = { at: this.#clock(), on: this.content };
    }
}
