import type { NcaPriority, NcaReporterContact, OpenChat } from "@client";

// The automated NCA filing path: mint the token pair from the user_index (proving the caller
// is a vault reviewer + platform moderator), then hand both tokens to the off-chain reporting
// service, which files with the NCA and records the outcome on chain. Fire-and-forget from
// the client's point of view: the report card tracks the outcome via its authorityReport
// state.

// Empty (unset) means automated filing is not configured and the UI never offers it
export const ncaReporterUrl: string = import.meta.env.OC_NCA_REPORTER_URL ?? "";

export const NCA_PRIORITY_LABELS: [NcaPriority, string][] = [
    ["P1", "moderationReport.priority1"],
    ["P2", "moderationReport.priority2"],
    ["P3", "moderationReport.priority3"],
];

// NCA business hours are Mon-Fri 07:00-17:00 UK time (bank holidays excluded - not knowable
// here, so the warning describes hours only and errs towards showing the obligation)
export function outsideNcaBusinessHours(now: Date = new Date()): boolean {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
        hour: "numeric",
        hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    if (weekday === "Sat" || weekday === "Sun") return true;
    return hour < 7 || hour >= 17;
}

export function contactValid(contact: NcaReporterContact): boolean {
    return (
        contact.firstName.trim() !== "" &&
        contact.lastName.trim() !== "" &&
        contact.phone.trim() !== "" &&
        contact.countryCallingCode.trim() !== "" &&
        contact.email.trim() !== ""
    );
}

export type StartFilingResult = { kind: "started" } | { kind: "error"; message: string };

export async function startAutomatedFiling(
    client: OpenChat,
    reportIndex: bigint,
    priority: NcaPriority,
    reporter: NcaReporterContact,
    oohCallAcknowledged: boolean,
): Promise<StartFilingResult> {
    const tokens = await client.authorityReportToken(
        reportIndex,
        priority,
        reporter,
        oohCallAcknowledged,
    );
    if (tokens.kind === "error") {
        return { kind: "error", message: tokens.message };
    }
    try {
        const response = await fetch(`${ncaReporterUrl}/file_report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                vault_token: tokens.vaultToken,
                submitter_token: tokens.submitterToken,
            }),
        });
        if (response.status === 202) {
            return { kind: "started" };
        }
        return { kind: "error", message: `Service answered ${response.status}` };
    } catch (err) {
        return { kind: "error", message: String(err) };
    }
}
