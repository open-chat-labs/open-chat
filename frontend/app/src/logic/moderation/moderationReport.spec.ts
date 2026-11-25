import type { ModerationReportContent, OpenChat, VaultFileInfoResponse } from "@client";
import { describe, expect, test } from "vitest";
import {
    OPTIMISTIC_ATTEMPT_MS,
    STALE_ATTEMPT_MS,
    canOpenFiling,
    canResolveReport,
    filingChecklistUrl,
    flaggedCategoryNames,
    hashMatchLine,
    isAttemptStale,
    reportHashLines,
    reportIsCsam,
    reportIsCsamish,
    reportMessageUrl,
    reportPeople,
    shownAuthorityReport,
} from "./moderationReport";

function moderationReport(
    fields: Partial<ModerationReportContent> = {},
): ModerationReportContent {
    return {
        kind: "moderation_report_content",
        reportIndex: 7n,
        chatId: { kind: "group_chat", groupId: "g" },
        threadRootMessageIndex: undefined,
        messageIndex: 4,
        messageId: 9n,
        sender: "bob",
        reporters: ["carol"],
        flaggedCategories: 0,
        classificationFailed: false,
        authorityReport: undefined,
        autoSanctioned: false,
        contentExcerpt: undefined,
        blobReferences: [],
        reportedAt: 0n,
        status: { kind: "pending" },
        ...fields,
    };
}

const MATCH = {
    provider: "photodna",
    blobId: 5n,
    source: "s",
    violations: [],
    matchDistance: 3n,
    matchId: "r1",
    hash: "abc",
};

describe("CSAM treatment", () => {
    test("flagged sexual/minors, or auto-sanctioned, is CSAM", () => {
        expect(reportIsCsam(moderationReport({ flaggedCategories: 2 }))).toBe(true);
        expect(reportIsCsam(moderationReport({ autoSanctioned: true }))).toBe(true);
        expect(reportIsCsam(moderationReport({ flaggedCategories: 1 }))).toBe(false);
    });

    test("upheld as CSAM is treated as CSAM too (no link), though not flagged", () => {
        const upheld = moderationReport({
            status: { kind: "upheld_as_csam", moderator: "m", timestamp: 0n },
        });
        expect(reportIsCsam(upheld)).toBe(false);
        expect(reportIsCsamish(upheld)).toBe(true);
    });
});

describe("what the report says", () => {
    test("the flagged categories, by bit", () => {
        expect(flaggedCategoryNames(1 | 4 | 128)).toEqual(["sexual", "violence", "illicit"]);
        expect(flaggedCategoryNames(0)).toEqual([]);
    });

    test("the hash matches on one line, with the record where there is one", () => {
        expect(hashMatchLine([MATCH, { ...MATCH, provider: "x", matchId: undefined }])).toBe(
            "photodna record r1 (distance 3); x (distance 3)",
        );
    });

    test("no link for a DM's message; a group's or a channel's goes to it", () => {
        expect(
            reportMessageUrl(moderationReport({ chatId: { kind: "direct_chat", userId: "u" } })),
        ).toBeUndefined();
        expect(reportMessageUrl(moderationReport())).toContain("/group/g/4");
        expect(
            reportMessageUrl(
                moderationReport({
                    chatId: { kind: "channel", communityId: "c", channelId: 1 },
                }),
            ),
        ).toContain("/community/c/channel/1/4");
    });

    test("people by username, else by id; no reporters is the pipeline; the moderator once decided", () => {
        const names = new Map([["bob", "Bobby"]]);
        const username = (id: string) => names.get(id);
        expect(reportPeople(moderationReport(), username)).toEqual({
            sender: "Bobby",
            reporters: ["carol"],
            moderator: undefined,
        });
        expect(
            reportPeople(
                moderationReport({
                    reporters: [],
                    status: { kind: "dismissed", moderator: "bob", timestamp: 0n },
                }),
                username,
            ),
        ).toEqual({ sender: "Bobby", reporters: [], moderator: "Bobby" });
    });
});

describe("who may act", () => {
    test("a verdict: a moderator, on a pending or contested report that isn't a blocked attempt", () => {
        expect(canResolveReport(moderationReport(), true)).toBe(true);
        expect(canResolveReport(moderationReport({ status: { kind: "contested" } }), true)).toBe(
            true,
        );
        expect(canResolveReport(moderationReport(), false)).toBe(false);
        expect(canResolveReport(moderationReport({ reportIndex: undefined }), true)).toBe(false);
        expect(canResolveReport(moderationReport({ isBlockedAttempt: true }), true)).toBe(false);
        expect(
            canResolveReport(
                moderationReport({ status: { kind: "upheld", moderator: "m", timestamp: 0n } }),
                true,
            ),
        ).toBe(false);
    });

    test("filing: an operator always; a moderator only with the automated service", () => {
        const r = moderationReport();
        expect(canOpenFiling(r, true, false, "")).toBe(true);
        expect(canOpenFiling(r, false, true, "")).toBe(false);
        expect(canOpenFiling(r, false, true, "https://nca")).toBe(true);
        expect(canOpenFiling(moderationReport({ reportIndex: undefined }), true, true, "x")).toBe(
            false,
        );
    });
});

describe("the filing checklist's link", () => {
    test("names the report, the origin, urgency and the state reached", () => {
        expect(
            filingChecklistUrl(
                moderationReport({ authorityReport: { kind: "due", urgent: true } }),
            ),
        ).toBe("/csea-reporting?report=7&origin=manual&urgent=true");
        expect(
            filingChecklistUrl(
                moderationReport({
                    mediaMatches: [MATCH],
                    authorityReport: { kind: "contingency_required", error: "e", urgent: false },
                }),
            ),
        ).toBe("/csea-reporting?report=7&origin=hash&state=contingency");
        expect(
            filingChecklistUrl(
                moderationReport({
                    authorityReport: { kind: "validation_failed", error: "e", urgent: false },
                }),
            ),
        ).toContain("state=validation");
        expect(
            filingChecklistUrl(
                moderationReport({ authorityReport: { kind: "attempting", startedAt: 1n } }),
            ),
        ).toContain("state=reconcile");
    });
});

describe("the filing state shown", () => {
    const due = { kind: "due" as const, urgent: false };

    test("a reference just recorded wins", () => {
        expect(shownAuthorityReport(due, "URN1", undefined, 0)).toEqual({
            kind: "filed",
            portalReference: "URN1",
        });
    });

    test("a filing just started shows as attempting, for a while, until the report changes", () => {
        expect(shownAuthorityReport(due, undefined, 1000, 1000 + 10)).toEqual({
            kind: "attempting",
            startedAt: 1000n,
        });
        expect(shownAuthorityReport(due, undefined, 1000, 1000 + OPTIMISTIC_ATTEMPT_MS)).toBe(
            due,
        );
        const filed = { kind: "filed" as const, portalReference: "x" };
        expect(shownAuthorityReport(filed, undefined, 1000, 1010)).toBe(filed);
        expect(shownAuthorityReport(undefined, undefined, 1000, 1010)).toBeUndefined();
    });

    test("an attempt is stale once it's taken longer than a filing does", () => {
        const attempting = { kind: "attempting" as const, startedAt: 0n };
        expect(isAttemptStale(attempting, STALE_ATTEMPT_MS)).toBe(false);
        expect(isAttemptStale(attempting, STALE_ATTEMPT_MS + 1)).toBe(true);
        expect(isAttemptStale(due, STALE_ATTEMPT_MS + 1)).toBe(false);
    });
});

describe("the hashes to copy", () => {
    test("the vault's sha256 per file it has, then the scanner's hash per match", async () => {
        const client = {
            vaultFileInfo: async (_c: string, blobId: bigint): Promise<VaultFileInfoResponse> =>
                blobId === 1n
                    ? { kind: "success", hash: "h1", mimeType: "image/png", size: 10n }
                    : ({ kind: "not_found" } as VaultFileInfoResponse),
        } as Pick<OpenChat, "vaultFileInfo">;
        const lines = await reportHashLines(
            client,
            moderationReport({
                blobReferences: [
                    { canisterId: "b", blobId: 1n },
                    { canisterId: "b", blobId: 2n },
                ],
                mediaMatches: [MATCH, { ...MATCH, hash: undefined }],
            }),
        );
        expect(lines).toEqual([
            "file 1: sha256 h1 (image/png, 10 bytes)",
            "file 5: photodna hash abc",
        ]);
    });
});
