import type { ModerationReportContent, ModerationVerdict, OCError, Success } from "@client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModerationReportCard, type ReportCardInputs } from "./moderationReportCard.svelte";

function moderationReport(fields: Partial<ModerationReportContent> = {}): ModerationReportContent {
    return {
        kind: "moderation_report_content",
        reportIndex: 7n,
        chatId: { kind: "group_chat", groupId: "g" },
        threadRootMessageIndex: undefined,
        messageIndex: 4,
        messageId: 9n,
        sender: "bob",
        reporters: [],
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

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

function setup(content: ModerationReportContent = moderationReport(), url = "") {
    const inputs: ReportCardInputs = { content, isModerator: true, isOperator: false };
    const calls: [bigint, ModerationVerdict, boolean | undefined][] = [];
    let answer = deferred<Success | OCError>();
    let clearAnswer = deferred<boolean>();
    let time = 10_000_000;
    const copied: string[] = [];
    const client = {
        resolveModerationReport: (i: bigint, v: ModerationVerdict, u: boolean | undefined) => {
            calls.push([i, v, u]);
            return answer.promise;
        },
        clearAuthorityReportAttempt: () => clearAnswer.promise,
        vaultFileInfo: vi.fn(),
    };
    const card = new ModerationReportCard(client, () => inputs, {
        ncaReporterUrl: url,
        copy: async (text) => {
            copied.push(text);
            return true;
        },
        clock: () => time,
    });
    return {
        card,
        inputs,
        calls,
        copied,
        answer: (value: Success | OCError) => answer.resolve(value),
        resetAnswer: () => (answer = deferred()),
        clear: (ok: boolean) => clearAnswer.resolve(ok),
        resetClear: () => (clearAnswer = deferred()),
        advance: (ms: number) => (time += ms),
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe("a verdict", () => {
    test("goes once at a time; urgent only with CSAM; a success leaves no other", async () => {
        const t = setup();
        t.card.urgent = true;
        const going = t.card.resolve("upheld_as_csam");
        expect(t.card.busy).toBe(true);
        await t.card.resolve("dismissed");
        expect(t.calls).toEqual([[7n, "upheld_as_csam", true]]);
        t.answer({ kind: "success" });
        await going;
        expect(t.card.busy).toBe(false);
        expect(t.card.resolved).toBe(true);
        await t.card.resolve("upheld");
        expect(t.calls).toHaveLength(1);
    });

    test("a refusal says why, and another try is allowed", async () => {
        const t = setup();
        const going = t.card.resolve("upheld");
        t.answer({ kind: "error", code: 1, message: "already resolved" });
        await going;
        expect(t.card.failed).toBe(true);
        expect(t.card.failureReason).toBe("already resolved");
        expect(t.card.resolved).toBe(false);
        t.resetAnswer();
        const again = t.card.resolve("dismissed");
        expect(t.card.failed).toBe(false);
        expect(t.calls[1]).toEqual([7n, "dismissed", undefined]);
        t.answer({ kind: "success" });
        await again;
    });
});

describe("the review-before-verdict gate", () => {
    test("media must be reviewed first; a report without any needs none", () => {
        const t = setup(moderationReport({ blobReferences: [{ canisterId: "b", blobId: 1n }] }));
        expect(t.card.needsMediaReview).toBe(true);
        t.card.gate.apply("viewed");
        expect(t.card.needsMediaReview).toBe(false);
        expect(setup().card.needsMediaReview).toBe(false);
    });
});

describe("filing", () => {
    const due = { kind: "due" as const, urgent: true };

    test("a recorded filing shows at once", () => {
        const t = setup(moderationReport({ authorityReport: due }));
        t.card.filed("URN9");
        expect(t.card.authorityReport).toEqual({ kind: "filed", portalReference: "URN9" });
        expect(t.card.filingOpen).toBe(false);
    });

    test("a started filing shows as under way until the report changes", () => {
        const t = setup(moderationReport({ authorityReport: due }));
        expect(t.card.filingOpen).toBe(true);
        expect(t.card.filingUrgent).toBe(true);
        t.card.filingStarted();
        expect(t.card.authorityReport?.kind).toBe("attempting");
        t.inputs.content = moderationReport({ authorityReport: due });
        expect(t.card.authorityReport).toBe(t.inputs.content.authorityReport);
    });

    test("an operator's cleared attempt keeps Clear away until the report changes", async () => {
        const t = setup(
            moderationReport({ authorityReport: { kind: "attempting", startedAt: 0n } }),
        );
        expect(t.card.attemptIsStale).toBe(true);
        const going = t.card.clearAttempt();
        expect(t.card.clearingAttempt).toBe(true);
        t.clear(true);
        await going;
        expect(t.card.attemptCleared).toBe(true);
        expect(t.card.clearAttemptFailed).toBe(false);
        t.inputs.content = { ...t.inputs.content };
        expect(t.card.attemptCleared).toBe(false);
        t.resetClear();
        const failing = t.card.clearAttempt();
        t.clear(false);
        await failing;
        expect(t.card.attemptCleared).toBe(false);
        expect(t.card.clearAttemptFailed).toBe(true);
    });

    test("automated filing is offered to a moderator only with the service", () => {
        expect(setup(moderationReport(), "").card.canOpenFiling).toBe(false);
        expect(setup(moderationReport(), "https://nca").card.canOpenFiling).toBe(true);
        expect(setup(moderationReport(), "https://nca").card.automatedFiling).toBe(true);
    });
});

describe("copying the hashes", () => {
    test("says nothing was copied when there's nothing to copy, then is ready again", async () => {
        vi.useFakeTimers();
        const t = setup();
        await t.card.copyHashes();
        expect(t.card.hashCopyState).toBe("failed");
        expect(t.copied).toEqual([]);
        vi.advanceTimersByTime(2000);
        expect(t.card.hashCopyState).toBe("idle");
    });

    test("copies the lines", async () => {
        const t = setup(
            moderationReport({
                mediaMatches: [
                    {
                        provider: "p",
                        blobId: 1n,
                        source: "",
                        violations: [],
                        matchDistance: 0n,
                        matchId: undefined,
                        hash: "h",
                    },
                ],
            }),
        );
        await t.card.copyHashes();
        expect(t.copied).toEqual(["file 1: p hash h"]);
        expect(t.card.hashCopyState).toBe("copied");
    });
});
