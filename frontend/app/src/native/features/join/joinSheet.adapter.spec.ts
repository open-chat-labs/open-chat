import {
    type AccessGate,
    type EnhancedAccessGate,
    type EnhancedTokenDetails,
    type LeafGate,
} from "@client";
import { GateEvaluation } from "@src/logic/access/gateEvaluation.svelte";
import { recordGateChoice } from "@src/logic/join/joinGate";
import { describe, expect, test } from "vitest";
import { sheetChoice, sheetRows } from "./joinSheet.adapter";

const icp = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const chat = "2ouva-viaaa-aaaaq-aaamq-cai";

function token(ledger: string, symbol: string, balance: bigint): EnhancedTokenDetails {
    return { ledger, symbol, decimals: 8, balance, transferFee: 10_000n } as EnhancedTokenDetails;
}

// payments and neurons always need the user, as they do in the client; Diamond as given
function client(diamond = false) {
    return { doesUserMeetAccessGate: (g: AccessGate) => diamond && g.kind === "diamond_gate" };
}

function enhanced(gate: AccessGate): EnhancedAccessGate {
    return { ...gate, level: "community", collectionName: "DAO Builders", expiry: undefined };
}

const pay = (amount: bigint, ledger = icp): LeafGate => ({
    kind: "payment_gate",
    ledgerCanister: ledger,
    amount,
    fee: 10_000n,
});
const diamond: LeafGate = { kind: "diamond_gate" };

function sheet(gate: AccessGate, balances: { icp?: bigint; chat?: bigint }, diamondMember = false) {
    const evaluation = new GateEvaluation(client(diamondMember), [enhanced(gate)]);
    const tokens = new Map([
        [icp, token(icp, "ICP", balances.icp ?? 0n)],
        [chat, token(chat, "CHAT", balances.chat ?? 0n)],
    ]);
    const rows = sheetRows(evaluation.leaves, tokens, false);
    const gateNow = evaluation.gate;
    if (gateNow === undefined) throw new Error("no gate");
    return { evaluation, rows, ...sheetChoice(gateNow, rows, false) };
}

describe("the requirements sheet (#10375)", () => {
    test("invariant 3: Join approves the gate's own amount for each payment the sheet shows, and nothing else", () => {
        // more digits than a number holds exactly
        const amount = 12_345_678_901_234_567n;
        const { evaluation, ready, choice, payments } = sheet(
            { kind: "composite_gate", operator: "and", gates: [pay(amount), diamond] },
            { icp: amount * 2n },
            true,
        );
        expect(ready).toBe(true);
        expect(payments).toHaveLength(1);

        const result = recordGateChoice(evaluation, choice, () => 10_000n);
        expect(result).toMatchObject({ kind: "ready" });
        if (result.kind !== "ready") return;
        expect([...result.gateCheck.paymentApprovals]).toEqual([
            [icp, { amount, approvalFee: 10_000n }],
        ]);
    });

    test("invariant 3: an 'any' gate pays nothing when a way in is met already, else one payment", () => {
        const either: AccessGate = {
            kind: "composite_gate",
            operator: "or",
            gates: [pay(300_000_000n), pay(500_000_000n, chat), diamond],
        };

        expect(sheet(either, { icp: 10n ** 12n, chat: 10n ** 12n }, true)).toMatchObject({
            ready: true,
            choice: { paid: [] },
        });
        const paying = sheet(either, { chat: 10n ** 12n });
        expect(paying.ready).toBe(true);
        expect(paying.payments).toEqual([{ amount: "5.00", symbol: "CHAT" }]);
    });

    test("invariant 2: Join can't be pressed while a requirement isn't met or a payment can't be covered", () => {
        expect(sheet(pay(300_000_000n), { icp: 299_999_999n }).ready).toBe(false);
        expect(sheet(diamond, {}).ready).toBe(false);
        expect(sheet(diamond, {}).rows[0].getDiamond).toBe(true);
    });
});
