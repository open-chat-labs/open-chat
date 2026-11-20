import { describe, expect, test } from "vitest";
import { ledgerReport } from "./ledger.mjs";

const tests = new Map([
    ["v3-desktop", new Set(["an edit reaches the other member", "a desktop-only test"])],
    ["v3-mobile", new Set(["an edit reaches the other member"])],
]);

describe("the capability ledger (#10550)", () => {
    test("invariant 2 (#10550): a row passes only with a test that runs on each tree, or an acknowledged difference", () => {
        const rows = [
            {
                id: "edit",
                desktop: "an edit reaches the other member",
                mobile: "an edit reaches the other member",
            },
            {
                id: "only-desktop",
                desktop: "a desktop-only test",
                mobile: "a desktop-only test",
            },
            {
                id: "renamed",
                desktop: "an edit reaches the other person",
                mobile: { difference: "phones don't do it", decided: "Julian 2026-11-20" },
            },
            {
                id: "gap",
                desktop: { missing: "not built yet" },
                mobile: { difference: "no reason" },
            },
            {
                id: "later",
                desktop: { untested: "needs a mic" },
                mobile: "an edit reaches the other member",
            },
            {
                id: "edit",
                desktop: "an edit reaches the other member",
                mobile: { missing: "later" },
            },
        ];
        const { problems, differences } = ledgerReport(rows, tests);
        expect(problems.map((p) => `${p.id} ${p.tree}`)).toEqual([
            "only-desktop mobile",
            "renamed desktop",
            "gap desktop",
            "gap mobile",
            "later desktop",
            "edit -",
            "edit mobile",
        ]);
        expect(differences.map((d) => `${d.id} ${d.tree}`)).toEqual(["renamed mobile"]);
    });
});
