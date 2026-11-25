import {
    MODERATION_CATEGORY_NAMES,
    routeForMessage,
    type AuthorityReportState,
    type MediaScanMatch,
    type ModerationReportContent,
    type OpenChat,
} from "@client";

// What a moderation report card (`moderation_report_content`, in the moderation channel) shows
// and offers, worked out from the report. Shared by the old desktop and mobile cards and the web's
// (L6c); the card's own state (a verdict under way, a filing just started) is
// `moderationReportCard.svelte`'s.

/**
 * How long an automated filing the reporting service accepted shows as "attempting" before its
 * on-chain marker arrives (it lapses sooner as soon as the report changes).
 */
export const OPTIMISTIC_ATTEMPT_MS = 2 * 60 * 1000;

/**
 * An attempt marker much older than a filing takes means the service crashed mid-flight: a human
 * must check the portal before anything re-files.
 */
export const STALE_ATTEMPT_MS = 30 * 60 * 1000;

/**
 * Alleged CSAM. autoSanctioned always means CSAM (classifier detection, reporter assertion, or a
 * protective quarantine applied after classification): the flagged bits alone miss the assertion
 * cases, and the card must show the CSAM treatment (no in-place viewing).
 */
export function reportIsCsam(content: ModerationReportContent): boolean {
    return (content.flaggedCategories & 2) !== 0 || content.autoSanctioned;
}

/**
 * Alleged OR confirmed CSAM: a classifier-clean escalated report upheld as CSAM has no flag bits,
 * but must still never link to the content in place.
 */
export function reportIsCsamish(content: ModerationReportContent): boolean {
    return reportIsCsam(content) || content.status.kind === "upheld_as_csam";
}

/**
 * The media hash matches; non-empty when the detection was a media hash match rather than the text
 * classifier. Report content restored from the IndexedDB cache can pre-date the field entirely.
 */
export function reportMediaMatches(content: ModerationReportContent): MediaScanMatch[] {
    return content.mediaMatches ?? [];
}

/** The hash matches as one line ("provider record id (distance n); …"). */
export function hashMatchLine(matches: MediaScanMatch[]): string {
    return matches
        .map(
            (m) =>
                `${m.provider}${m.matchId !== undefined ? ` record ${m.matchId}` : ""} (distance ${m.matchDistance})`,
        )
        .join("; ");
}

/** The flagged categories' names, in the backend's bit order. */
export function flaggedCategoryNames(flaggedCategories: number): string[] {
    return MODERATION_CATEGORY_NAMES.filter(([bit, _name]) => (flaggedCategories & bit) !== 0).map(
        ([_bit, name]) => name,
    );
}

/**
 * The reported message's url. Direct-chat routes resolve relative to the viewer, so a link to
 * someone else's private chat would be dead for moderators: none for a DM.
 */
export function reportMessageUrl(content: ModerationReportContent): string | undefined {
    return content.chatId.kind === "direct_chat"
        ? undefined
        : routeForMessage(
              content.chatId.kind === "channel" ? "community" : "chats",
              {
                  chatId: content.chatId,
                  threadRootMessageIndex: content.threadRootMessageIndex,
              },
              content.messageIndex,
          );
}

/**
 * Whether the reader may give a verdict: a platform moderator, on a pending or contested report
 * that isn't a blocked re-post attempt (it resolves with its original report).
 */
export function canResolveReport(content: ModerationReportContent, isModerator: boolean): boolean {
    return (
        isModerator &&
        content.reportIndex !== undefined &&
        !content.isBlockedAttempt &&
        (content.status.kind === "pending" || content.status.kind === "contested")
    );
}

/**
 * Whether the reader may open the NCA filing dialog: a platform operator (who can record a manual
 * portal filing), or a platform moderator where automated filing is configured.
 */
export function canOpenFiling(
    content: ModerationReportContent,
    isOperator: boolean,
    isModerator: boolean,
    ncaReporterUrl: string,
): boolean {
    return content.reportIndex !== undefined && (isOperator || (ncaReporterUrl !== "" && isModerator));
}

/**
 * The manual-filing checklist (`/csea-reporting`), set up for this report: its index, whether the
 * detection was a hash match, urgency, and the state a filing has reached.
 */
export function filingChecklistUrl(content: ModerationReportContent): string {
    const params = new URLSearchParams();
    if (content.reportIndex !== undefined) {
        params.set("report", content.reportIndex.toString());
    }
    params.set("origin", reportMediaMatches(content).length > 0 ? "hash" : "manual");
    if (content.authorityReport?.kind === "due" && content.authorityReport.urgent) {
        params.set("urgent", "true");
    }
    if (content.authorityReport?.kind === "contingency_required") {
        params.set("state", "contingency");
    } else if (content.authorityReport?.kind === "validation_failed") {
        params.set("state", "validation");
    } else if (content.authorityReport?.kind === "attempting") {
        params.set("state", "reconcile");
    }
    return `/csea-reporting?${params}`;
}

/**
 * The filing state the card shows: a reference just recorded from the card wins; an automated
 * filing just accepted by the reporting service (`filingStartedAt`, while the report is the one it
 * was started on) shows as attempting until its on-chain marker arrives, for at most
 * OPTIMISTIC_ATTEMPT_MS, so a genuine return to Due is never hidden; else the report's own.
 */
export function shownAuthorityReport(
    onChain: AuthorityReportState | undefined,
    filedReference: string | undefined,
    filingStartedAt: number | undefined,
    now: number,
): AuthorityReportState | undefined {
    if (filedReference !== undefined) {
        return { kind: "filed", portalReference: filedReference };
    }
    if (
        filingStartedAt !== undefined &&
        now - filingStartedAt < OPTIMISTIC_ATTEMPT_MS &&
        onChain !== undefined &&
        onChain.kind !== "filed" &&
        onChain.kind !== "attempting"
    ) {
        return { kind: "attempting", startedAt: BigInt(filingStartedAt) };
    }
    return onChain;
}

/** Whether an automated filing has been attempting for longer than one takes (STALE_ATTEMPT_MS). */
export function isAttemptStale(report: AuthorityReportState | undefined, now: number): boolean {
    return report?.kind === "attempting" && now - Number(report.startedAt) > STALE_ATTEMPT_MS;
}

/** Who gave the verdict, once there is one. */
export function reportModerator(content: ModerationReportContent): string | undefined {
    return content.status.kind !== "pending" && content.status.kind !== "contested"
        ? content.status.moderator
        : undefined;
}

export type ReportPeople = {
    sender: string;
    /** Empty: the report came from the pipeline, not from people. */
    reporters: string[];
    moderator: string | undefined;
};

/** The people a report names, by username where it's known (`username`), else by user id. */
export function reportPeople(
    content: ModerationReportContent,
    username: (userId: string) => string | undefined,
): ReportPeople {
    const moderatorId = reportModerator(content);
    return {
        sender: username(content.sender) ?? content.sender,
        reporters: content.reporters.map((r) => username(r) ?? r),
        moderator: moderatorId ? (username(moderatorId) ?? moderatorId) : undefined,
    };
}

/**
 * The hash lines for the NCA report: the vault sha256 per quarantined blob (a reviewer-gated
 * query) plus the scanner's perceptual hash per match.
 */
export async function reportHashLines(
    client: Pick<OpenChat, "vaultFileInfo">,
    content: ModerationReportContent,
): Promise<string[]> {
    const lines: string[] = [];
    for (const ref of content.blobReferences) {
        const resp = await client.vaultFileInfo(ref.canisterId, ref.blobId);
        if (resp.kind === "success") {
            lines.push(
                `file ${ref.blobId}: sha256 ${resp.hash} (${resp.mimeType}, ${resp.size} bytes)`,
            );
        }
    }
    for (const m of reportMediaMatches(content)) {
        if (m.hash !== undefined) {
            lines.push(`file ${m.blobId}: ${m.provider} hash ${m.hash}`);
        }
    }
    return lines;
}
