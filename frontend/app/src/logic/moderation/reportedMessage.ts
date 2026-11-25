import type { MessageReport } from "@client";

// The older reported message card (`reported_message_content`, in the moderation channel): one of
// a message's reports at a time. Shared by the old desktop and mobile cards and the web's (L6c).

/** The report reasons' keys, by `reasonCode`. */
export const REPORT_REASON_KEYS: string[] = [
    "report.threat",
    "report.child",
    "report.nonConsensual",
    "report.selfHarm",
    "report.violence",
    "report.scam",
    "report.other",
];

export type ReportedMessageDeps = {
    /** The reporter's username, where it's known. */
    username: (userId: string) => string | undefined;
    /** A date and time in the reader's locale (the client's `toDatetimeString`). */
    datetime: (date: Date) => string;
    /** svelte-i18n's `$_`. */
    translate: (key: string, options?: { values: Record<string, string | undefined> }) => string;
};

/** A report as one line of markdown: who reported it, when, and why. */
export function reportedMessageText(report: MessageReport, deps: ReportedMessageDeps): string {
    const reasonKey = REPORT_REASON_KEYS[report.reasonCode];
    return deps.translate("report.messageReport", {
        values: {
            username:
                deps.username(report.reportedBy) ?? `unknown user (${report.reportedBy}))`,
            timestamp: deps.datetime(new Date(report.timestamp)),
            reason: reasonKey === undefined ? undefined : deps.translate(reasonKey),
        },
    });
}

/** Whether a report has notes to show. */
export function reportHasNotes(report: MessageReport): boolean {
    return report.notes !== undefined && report.notes.length > 0;
}
