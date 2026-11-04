import type { EnhancedAccessGate, EnhancedTokenDetails, LeafGate, ResourceKey } from "@client";
import type { EvaluatedLeafGate } from "@src/logic/access/gateEvaluation.svelte";
import { describe, expect, test } from "vitest";
import { joinGateProps, paidLeaves } from "./joinGate.adapter";

const icp = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const token = {
    symbol: "ICP",
    ledger: icp,
    decimals: 8,
    balance: 250_000_000n,
    logo: "icp.svg",
    transferFee: 10_000n,
    name: "Internet Computer",
} as EnhancedTokenDetails;
const tokens = new Map([[icp, token]]);
const text = (key: ResourceKey) => `t:${key.key}`;

function leaf(gate: LeafGate, originalIndex: number, satisfied = false): EvaluatedLeafGate {
    return {
        ...gate,
        level: "community",
        collectionName: "DAO",
        expiry: undefined,
        originalIndex,
        satisfied,
    };
}

function gate(over: Partial<EnhancedAccessGate> = {}): EnhancedAccessGate {
    return {
        kind: "composite_gate",
        operator: "and",
        gates: [],
        level: "community",
        collectionName: "DAO",
        expiry: undefined,
        ...over,
    } as EnhancedAccessGate;
}

describe("the join gate dialog's props", () => {
    test("each requirement is a row keyed by its leaf, payments in whole tokens", () => {
        const props = joinGateProps(
            gate(),
            [
                leaf(
                    { kind: "payment_gate", ledgerCanister: icp, amount: 150_000_000n, fee: 0n },
                    2,
                ),
                leaf(
                    { kind: "token_balance_gate", ledgerCanister: icp, minBalance: 100_000_000n },
                    0,
                ),
                leaf({ kind: "neuron_gate", governanceCanister: "gov" }, 1),
                leaf({ kind: "lifetime_diamond_gate" }, 3),
                leaf({ kind: "diamond_gate" }, 4),
            ],
            tokens,
            text,
        );

        expect(props.community).toEqual({ name: "DAO" });
        expect(props.rule).toBe("all");
        expect(props.gates).toEqual([
            { kind: "pay", id: "2", symbol: "ICP", ledger: icp, amount: 1.5 },
            { kind: "balance", id: "0", symbol: "ICP", ledger: icp, amount: 1 },
            { kind: "neuron", id: "1" },
            { kind: "diamond", id: "3" },
            { kind: "diamond", id: "4", lifetime: false },
        ]);
        expect(props.tokens).toMatchObject([{ symbol: "ICP", held: 2.5 }]);
    });

    test("an 'or' gate is one of any", () => {
        expect(
            joinGateProps(gate({ operator: "or" } as Partial<EnhancedAccessGate>), [], tokens, text)
                .rule,
        ).toBe("any");
    });

    test("a requirement with no row of its own shows as the app found it", () => {
        const props = joinGateProps(
            gate(),
            [leaf({ kind: "chit_earned_gate", minEarned: 500 }, 0, true)],
            tokens,
            text,
        );

        expect(props.gates).toEqual([
            {
                kind: "other",
                id: "0",
                label: "t:access.minimumChitEarned",
                detail: expect.any(String),
                met: true,
                icon: "chit",
            },
        ]);
    });

    // a payment gate on a ledger the registry doesn't carry offers no payment and doesn't crash
    test("a payment on a ledger the registry doesn't carry is offered no payment", () => {
        const props = joinGateProps(
            gate(),
            [leaf({ kind: "payment_gate", ledgerCanister: "unknown", amount: 1n, fee: 0n }, 0)],
            tokens,
            text,
        );

        expect(props.gates).toMatchObject([{ kind: "other", met: false }]);
        expect(props.tokens).toEqual([]);
    });

    test("re-checked every so many days for a gate that expires", () => {
        const expiry = BigInt(30 * 24 * 60 * 60 * 1000);
        expect(joinGateProps(gate({ expiry }), [], tokens, text).recheckDays).toBe(30);
    });

    test("the dialog's payments come back as the leaves they're for", () => {
        expect(paidLeaves([{ id: "2" }, {}, { id: "0" }])).toEqual([2, 0]);
    });
});
