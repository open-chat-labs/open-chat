import { type AccessGate, type EnhancedAccessGate, type EnhancedTokenDetails } from "@client";
import { describe, expect, test } from "vitest";
import { requirementCard } from "./communityPreview.adapter";

const icp = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const tokens = new Map([
    [
        icp,
        {
            ledger: icp,
            symbol: "ICP",
            decimals: 8,
            balance: 10n ** 10n,
            transferFee: 10_000n,
        } as EnhancedTokenDetails,
    ],
]);

function community(gate: AccessGate, expiry?: bigint): EnhancedAccessGate {
    return { ...gate, level: "community", collectionName: "DAO Builders", expiry };
}

describe("a community's preview (#10375)", () => {
    test("invariant 9: the Requirements card shows every requirement, met ones included, with the sheet's status", () => {
        const gate = community(
            {
                kind: "composite_gate",
                operator: "and",
                gates: [
                    { kind: "diamond_gate" },
                    { kind: "token_balance_gate", ledgerCanister: icp, minBalance: 100n },
                    {
                        kind: "payment_gate",
                        ledgerCanister: icp,
                        amount: 300_000_000n,
                        fee: 10_000n,
                    },
                ],
            },
            7n * 24n * 60n * 60n * 1000n,
        );
        // a Diamond member holding enough: the gate's met but for the payment
        const card = requirementCard(gate, (g) => g.kind !== "payment_gate", tokens, false);
        expect(card.rows.map((r) => [r.state, r.status.key])).toEqual([
            ["met", "native.community.preview.met"],
            ["met", "native.community.preview.met"],
            ["pay", "native.community.preview.onJoin"],
        ]);
        expect(card.notes.map((n) => n.key)).toEqual([
            "native.community.preview.all",
            "native.community.preview.recheck.week",
        ]);

        // all of it met, it still lists them
        expect(requirementCard(gate, () => true, tokens, false).rows).toHaveLength(3);
    });
});
