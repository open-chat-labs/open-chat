import type { EnhancedAccessGate, MergeableAccessGate } from "openchat-client";
import { mergeAccessGates } from "./access";

function testGates(
    kind: MergeableAccessGate["kind"],
    e1?: bigint,
    e2?: bigint,
): [EnhancedAccessGate, EnhancedAccessGate] {
    const g1: EnhancedAccessGate = {
        kind,
        level: "community",
        expiry: e1,
    };
    const g2: EnhancedAccessGate = {
        kind,
        level: "channel",
        expiry: e2,
    };
    return [g1, g2];
}

function runTestsForGateType(kind: MergeableAccessGate["kind"]) {
    describe(`${kind} gates`, () => {
        test("with no expiry", () => {
            const [g1, g2] = testGates(kind);
            const merged = mergeAccessGates(g1, g2);
            expect(merged.length).toEqual(1);
            expect(merged[0].expiry).toBe(undefined);
        });
        test("with expiry", () => {
            const [g1, g2] = testGates(kind, 100n, 500n);
            const merged = mergeAccessGates(g1, g2);
            expect(merged.length).toEqual(1);
            expect(merged[0].expiry).toEqual(100n);
        });
    });
}

describe("merging access gates", () => {
    runTestsForGateType("locked_gate");
    runTestsForGateType("diamond_gate");
    runTestsForGateType("lifetime_diamond_gate");
    runTestsForGateType("unique_person_gate");
    runTestsForGateType("referred_by_member_gate");

    describe("with no expiry", () => {
        test("with only one gate", () => {
            const g1: EnhancedAccessGate = {
                kind: "diamond_gate",
                level: "community",
                expiry: undefined,
            };
            expect(mergeAccessGates(g1)).toEqual([g1]);
        });
        test("with no gates", () => {
            expect(mergeAccessGates()).toEqual([]);
        });
    });
});
