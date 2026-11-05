import { i18nKey, type ResourceKey } from "@shared";

// Reporting a message to the platform's moderators: why, as both old report dialogs offered it.

/** Why a message is reported. */
export type ReportReason =
    | "threat"
    | "child"
    | "nonConsensual"
    | "sexual"
    | "selfHarm"
    | "violence"
    | "scam";

/** The reasons offered, in the order they're listed. */
export const REPORT_REASONS: readonly ReportReason[] = [
    "threat",
    "child",
    "nonConsensual",
    "sexual",
    "selfHarm",
    "violence",
    "scam",
];

/** A reason as the report dialog lists it. */
export function reportReasonText(reason: ReportReason): ResourceKey {
    return i18nKey(`report.${reason}`);
}

/**
 * Whether a report is of child sexual content: it's then treated as a classifier's detection, and
 * the auto-sanction applies at once (the dialog warns of it, `report.csamWarning`).
 */
export function isCsamReport(reason: ReportReason | undefined): boolean {
    return reason === "child";
}
