import type { OpenChat } from "@client";

// The operator console's authority reports (the old desktop's `home/admin/AuthorityReports`, and
// the new UI's admin screen). The authority-reports register: "due" rows are created by
// UpheldAsCsam verdicts (the s.66 reporting duty), and move to "filed" once the CSEA-IRP portal
// reference (URN) is recorded. The filed list is the compliance evidence that reporting deadlines
// were met.

export type DueRow = {
    report_index: number;
    urgent: boolean;
    created: number;
};

export type FiledRow = {
    report_index: number;
    portal_reference: string;
    filed_at: number;
    urgent: boolean;
    unverified: boolean;
};

export type AuthorityRegister = { due: DueRow[]; filed: FiledRow[] };

// Internal SLA targets, NOT statutory deadlines: the regulations require reporting "as soon as
// reasonably practicable" with no fixed period, so these are the operating targets we hold
// ourselves to (and the evidence we would point to)
export const URGENT_SLA_MS = 24 * 60 * 60 * 1000;
export const STANDARD_SLA_MS = 72 * 60 * 60 * 1000;

/** Due oldest first, filed newest first. Throws when it isn't JSON. */
export function parseAuthorityRegister(json: string): AuthorityRegister {
    const register = JSON.parse(json);
    return {
        due: ((register.due ?? []) as DueRow[]).sort((a, b) => a.created - b.created),
        filed: ((register.filed ?? []) as FiledRow[]).sort((a, b) => b.filed_at - a.filed_at),
    };
}

export function ageOf(row: DueRow, now: number): number {
    return now - row.created;
}

export function isOverdue(row: DueRow, now: number): boolean {
    return ageOf(row, now) > (row.urgent ? URGENT_SLA_MS : STANDARD_SLA_MS);
}

/** Hours under two days ("30h"), whole days after ("3d"). */
export function formatAge(ms: number): string {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours < 48) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

/** How a due report stands against its SLA target. */
export type SlaStanding = {
    state: "overdue" | "soon" | "on_time";
    /** The target, ms: 24h for an urgent report, 72h otherwise. */
    target: number;
    /** What's left of it, ms; below zero once overdue. */
    left: number;
    /** How much of it has gone, 0 to 1. */
    used: number;
};

/** Due soon: under a quarter of the target left. */
export const DUE_SOON_SHARE = 0.25;

export function slaStanding(row: DueRow, now: number): SlaStanding {
    const target = row.urgent ? URGENT_SLA_MS : STANDARD_SLA_MS;
    const left = target - ageOf(row, now);
    const state = left < 0 ? "overdue" : left <= target * DUE_SOON_SHARE ? "soon" : "on_time";
    return { state, target, left, used: Math.min(Math.max(1 - left / target, 0), 1) };
}

/** "8h left of 72h", or "Overdue by 6h" (whole hours, days from two days on). */
export function formatSlaLeft(standing: SlaStanding): string {
    return standing.left < 0
        ? `Overdue by ${formatAge(-standing.left)}`
        : `${formatAge(standing.left)} left of ${Math.round(standing.target / (60 * 60 * 1000))}h`;
}

/** The due reports most urgent first: overdue, then due soon, then on time, least left first. */
export function byUrgency(due: DueRow[], now: number): DueRow[] {
    const rank = { overdue: 0, soon: 1, on_time: 2 };
    return [...due].sort((a, b) => {
        const sa = slaStanding(a, now);
        const sb = slaStanding(b, now);
        return rank[sa.state] - rank[sb.state] || sa.left - sb.left;
    });
}

/** A filed row's flags: "urgent", "unverified", both or neither. */
export function filedFlags(row: FiledRow): string {
    return [row.urgent ? "urgent" : undefined, row.unverified ? "unverified" : undefined]
        .filter((f) => f !== undefined)
        .join(", ");
}

export class AuthorityReports {
    due = $state<DueRow[]>([]);
    filed = $state<FiledRow[]>([]);
    loaded = $state(false);
    error = $state<string | undefined>(undefined);
    #client: Pick<OpenChat, "authorityReports">;

    constructor(client: Pick<OpenChat, "authorityReports">) {
        this.#client = client;
    }

    async load(): Promise<void> {
        this.error = undefined;
        try {
            const json = await this.#client.authorityReports();
            if (json === undefined) {
                this.error = "Failed to load the register (platform operators only)";
                return;
            }
            const register = parseAuthorityRegister(json);
            this.due = register.due;
            this.filed = register.filed;
            this.loaded = true;
        } catch {
            this.error = "Failed to load the register";
        }
    }
}
