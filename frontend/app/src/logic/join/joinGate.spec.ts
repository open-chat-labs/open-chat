import {
    cryptoBalanceStore,
    type AccessGate,
    type EnhancedAccessGate,
    type LeafGate,
    type PaymentGate,
} from "@client";
import { afterEach, describe, expect, test } from "vitest";
import { GateEvaluation } from "../access/gateEvaluation.svelte";
import { otherRequirement, recordGateChoice } from "./joinGate";

const icp = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const chat = "2ouva-viaaa-aaaaq-aaamq-cai";
const unknown = "unknown-ledger";
const fees: Record<string, bigint> = { [icp]: 10_000n, [chat]: 100_000n };
const fee = (ledger: string) => fees[ledger];

// payments and neurons always need the user, as they do in the client
const client = { doesUserMeetAccessGate: () => false };

function payment(amount: bigint, ledger = icp): PaymentGate {
    return { kind: "payment_gate", ledgerCanister: ledger, amount, fee: 10n };
}

const neuron: LeafGate = { kind: "neuron_gate", governanceCanister: "gov" };

function enhanced(
    gate: AccessGate,
    level: "community" | "channel" = "community",
): EnhancedAccessGate {
    return { ...gate, level, collectionName: "c", expiry: undefined };
}

function indexOf(evaluation: GateEvaluation, amount: bigint): number {
    const leaf = evaluation.leaves.find((l) => l.kind === "payment_gate" && l.amount === amount);
    if (leaf === undefined) throw new Error("no such payment");
    return leaf.originalIndex;
}

describe("recording the join gate dialog's choice", () => {
    // 8b invariant 3: the payment approved for a gate is the gate's own bigint amount, never a
    // value rebuilt from the dialog's number
    test("the payment approved for a gate is the gate's own bigint amount", () => {
        // more digits than a number holds exactly
        const amount = 12_345_678_901_234_567n;
        const evaluation = new GateEvaluation(client, [enhanced(payment(amount))]);

        const result = recordGateChoice(
            evaluation,
            { paid: [indexOf(evaluation, amount)], neuronConfirmed: false },
            fee,
        );

        expect(result).toMatchObject({ kind: "ready" });
        if (result.kind !== "ready") return;
        expect(result.gateCheck.paymentApprovals.get(icp)).toEqual({
            amount,
            approvalFee: 10_000n,
        });
    });

    // 8b invariant 4: nothing is approved or sent until every level's gate is complete
    test("nothing is ready until every level's gate is complete", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced(payment(100n)),
            enhanced(payment(50n), "channel"),
        ]);

        expect(recordGateChoice(evaluation, { paid: [], neuronConfirmed: false }, fee)).toEqual({
            kind: "incomplete",
            balanceShort: false,
        });
        expect(recordGateChoice(evaluation, { paid: [0], neuronConfirmed: false }, fee)).toEqual({
            kind: "next_level",
        });
        // the community's payment doesn't carry over to the channel's
        expect(evaluation.gate?.level).toBe("channel");
        expect(evaluation.leaves[0].satisfied).toBe(false);

        const last = recordGateChoice(evaluation, { paid: [0], neuronConfirmed: false }, fee);
        expect(last).toMatchObject({ kind: "ready" });
        if (last.kind !== "ready") return;
        expect(last.gateCheck.paymentApprovals.get(icp)).toEqual({
            amount: 150n,
            approvalFee: 10_000n,
        });
    });

    // a join that doesn't go through puts the last level back (the dialog's checkpoint), so the
    // user's next choice is recorded afresh, not the one that failed
    test("a checkpoint puts the evaluation back on the level it was taken on", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced({ kind: "composite_gate", operator: "or", gates: [payment(100n), neuron] }),
        ]);
        const putBack = evaluation.checkpoint();

        const neuronOnly = recordGateChoice(evaluation, { paid: [], neuronConfirmed: true }, fee);
        expect(neuronOnly).toMatchObject({ kind: "ready" });
        expect(evaluation.gate).toBeUndefined();

        putBack();
        expect(evaluation.gate?.kind).toBe("composite_gate");
        expect(evaluation.satisfiedCount).toBe(0);
        const paying = recordGateChoice(evaluation, { paid: [0], neuronConfirmed: false }, fee);
        expect(paying).toMatchObject({ kind: "ready" });
        if (paying.kind !== "ready") return;
        expect(paying.gateCheck.compositeGateIndex).toBe(0);
        expect(paying.gateCheck.paymentApprovals.get(icp)?.amount).toBe(100n);
    });

    // never pays for a second branch of a met "or" gate; it sends the branch's original index
    test("an 'any' gate takes one payment, and sends that branch's index", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced({
                kind: "composite_gate",
                operator: "or",
                gates: [{ kind: "unique_person_gate" }, payment(100n), payment(200n, chat)],
            }),
        ]);

        const result = recordGateChoice(
            evaluation,
            { paid: [indexOf(evaluation, 200n), indexOf(evaluation, 100n)], neuronConfirmed: true },
            fee,
        );

        expect(result).toMatchObject({ kind: "ready" });
        if (result.kind !== "ready") return;
        expect([...result.gateCheck.paymentApprovals.keys()]).toHaveLength(1);
        expect(result.gateCheck.compositeGateIndex).toBe(1);
    });

    test("an 'any' gate met by the neuron confirmed pays nothing", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced({ kind: "composite_gate", operator: "or", gates: [payment(100n), neuron] }),
        ]);

        const result = recordGateChoice(evaluation, { paid: [], neuronConfirmed: true }, fee);

        expect(result).toMatchObject({ kind: "ready" });
        if (result.kind !== "ready") return;
        expect(result.gateCheck.paymentApprovals.size).toBe(0);
        expect(result.gateCheck.compositeGateIndex).toBe(1);
    });

    // a payment gate on a ledger the registry doesn't carry offers no payment
    test("a payment on a ledger the registry doesn't carry is never approved", () => {
        const evaluation = new GateEvaluation(client, [enhanced(payment(100n, unknown))]);

        expect(recordGateChoice(evaluation, { paid: [0], neuronConfirmed: false }, fee)).toEqual({
            kind: "incomplete",
            balanceShort: false,
        });
    });

    describe("a payment out of a balance the gate also asks for", () => {
        afterEach(() => cryptoBalanceStore.setBalance(chat, 0n));

        // pay 10 CHAT + hold 50 CHAT with 55: paying leaves 45, so the gate isn't met
        test("leaves nothing approved, and says the balance is what falls short", () => {
            cryptoBalanceStore.setBalance(chat, 55n);
            const evaluation = new GateEvaluation(client, [
                enhanced({
                    kind: "composite_gate",
                    operator: "and",
                    gates: [
                        payment(10n, chat),
                        { kind: "token_balance_gate", ledgerCanister: chat, minBalance: 50n },
                    ],
                }),
            ]);
            const paid = [indexOf(evaluation, 10n)];

            expect(recordGateChoice(evaluation, { paid, neuronConfirmed: false }, fee)).toEqual({
                kind: "incomplete",
                balanceShort: true,
            });
            // nothing kept: the balance counts in full again, and the payment is still to choose
            expect(evaluation.balanceAfterCurrentCommitments(chat, 55n)).toBe(55n);
            expect(evaluation.satisfiedCount).toBe(1);

            // topped up, the same choice goes through, with the one payment approved
            cryptoBalanceStore.setBalance(chat, 60n);
            const result = recordGateChoice(evaluation, { paid, neuronConfirmed: false }, fee);
            expect(result).toMatchObject({ kind: "ready" });
            if (result.kind !== "ready") return;
            expect(result.gateCheck.paymentApprovals.get(chat)).toEqual({
                amount: 10n,
                approvalFee: 100_000n,
            });
        });
    });
});

describe("a requirement the dialog has no row for", () => {
    test("is named, with an icon", () => {
        expect(otherRequirement({ kind: "chit_earned_gate", minEarned: 500 })).toMatchObject({
            label: { key: "access.minimumChitEarned" },
            icon: "chit",
        });
        expect(otherRequirement({ kind: "locked_gate" })).toMatchObject({
            label: { key: "access.lockedGate" },
            icon: "lock",
        });
        expect(otherRequirement(payment(1n, unknown))).toMatchObject({
            detail: { key: "access.unknownTokenPayment" },
        });
    });
});
