import { describe, expect, test } from "vitest";
import { reportHasNotes, reportedMessageText } from "./reportedMessage";

const report = { reasonCode: 5, timestamp: 0, reportedBy: "carol", notes: undefined };

function deps(names: Record<string, string> = {}) {
    return {
        username: (id: string) => names[id],
        datetime: () => "today",
        translate: (key: string, options?: { values: Record<string, string | undefined> }) =>
            options === undefined ? `[${key}]` : `${key} ${JSON.stringify(options.values)}`,
    };
}

describe("a reported message's report", () => {
    test("who reported it, when and why", () => {
        expect(reportedMessageText(report, deps({ carol: "Carol" }))).toBe(
            'report.messageReport {"username":"Carol","timestamp":"today","reason":"[report.scam]"}',
        );
    });

    test("an unknown reporter by id, as the old card wrote it; an unknown reason left out", () => {
        expect(reportedMessageText({ ...report, reasonCode: 99 }, deps())).toBe(
            'report.messageReport {"username":"unknown user (carol))","timestamp":"today"}',
        );
    });

    test("notes only when there are some", () => {
        expect(reportHasNotes(report)).toBe(false);
        expect(reportHasNotes({ ...report, notes: "" })).toBe(false);
        expect(reportHasNotes({ ...report, notes: "x" })).toBe(true);
    });
});
