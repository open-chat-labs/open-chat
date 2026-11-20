import { describe, expect, test } from "vitest";
import { ledgerReport } from "./ledger.mjs";

const tests = new Map([
    ["v3-desktop", new Set(["an edit reaches the other member", "a v3-only test"])],
    ["v4-phone", new Set(["an edit reaches the other member"])],
]);

describe("the capability ledger (#10550)", () => {
    test("invariant 2 (#10550): a row passes only with a test that runs on each tree, or an acknowledged difference", () => {
        const rows = [
            {
                id: "edit",
                v3: "an edit reaches the other member",
                v4: "an edit reaches the other member",
            },
            {
                id: "only-v3",
                v3: "a v3-only test",
                v4: "a v3-only test",
            },
            {
                id: "renamed",
                v3: "an edit reaches the other person",
                v4: { difference: "phones don't do it", decided: "Julian 2026-11-20" },
            },
            { id: "gap", v3: { missing: "not built yet" }, v4: { difference: "no reason" } },
            {
                id: "later",
                v3: { untested: "needs a mic" },
                v4: "an edit reaches the other member",
            },
            { id: "edit", v3: "an edit reaches the other member", v4: { missing: "later" } },
        ];
        const { problems, differences } = ledgerReport(rows, tests);
        expect(problems.map((p) => `${p.id} ${p.tree}`)).toEqual([
            "only-v3 v4",
            "renamed v3",
            "gap v3",
            "gap v4",
            "later v3",
            "edit -",
            "edit v4",
        ]);
        expect(differences.map((d) => `${d.id} ${d.tree}`)).toEqual(["renamed v4"]);
    });
});
