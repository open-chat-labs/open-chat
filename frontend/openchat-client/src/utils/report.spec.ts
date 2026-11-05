import { REPORT_REASONS, isCsamReport, reportReasonText } from "./report";

describe("a report's reason", () => {
    // invariant 1 (#10117)
    test("a report sends csam: true only when the chosen reason is child sexual content", () => {
        expect(REPORT_REASONS.filter(isCsamReport)).toEqual(["child"]);
        expect(isCsamReport(undefined)).toBe(false);
    });

    test("is listed in the old dialogs' order and words, with no placeholder to pick", () => {
        expect(REPORT_REASONS.map((r) => reportReasonText(r).key)).toEqual([
            "report.threat",
            "report.child",
            "report.nonConsensual",
            "report.sexual",
            "report.selfHarm",
            "report.violence",
            "report.scam",
        ]);
    });
});
