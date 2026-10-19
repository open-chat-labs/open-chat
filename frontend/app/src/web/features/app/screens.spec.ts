import { regionSummary } from "./screens";

describe("a placeholder's account of a region", () => {
    test("is its parameters, without its kind", () => {
        expect(regionSummary({ kind: "wallet", view: "token", ledger: "abc" } as never)).toBe(
            '{"view":"token","ledger":"abc"}',
        );
    });

    test("writes big numbers out, and is empty for a region with nothing else", () => {
        expect(regionSummary({ kind: "x", messageIndex: 12n } as never)).toBe(
            '{"messageIndex":"12"}',
        );
        expect(regionSummary({ kind: "empty" })).toBe("");
    });
});
