import {
    cryptoBalanceStore,
    type AccessGate,
    type EnhancedAccessGate,
    type LeafGate,
    type PaymentGate,
} from "@client";
import { afterEach, describe, expect, test } from "vitest";
import { GateEvaluation } from "./gateEvaluation.svelte";

const ledger = "ryjl3-tyaaa-aaaaa-aaaba-cai";

// Payment and credential gates always need the user, as they do in the client
const client = { doesUserMeetAccessGate: () => false };

function payment(amount: bigint): PaymentGate {
    return { kind: "payment_gate", ledgerCanister: ledger, amount, fee: 10n };
}

const credential: LeafGate = {
    kind: "credential_gate",
    credential: {
        credentialName: "c",
        issuerCanisterId: "i",
        issuerOrigin: "o",
        credentialType: "t",
    },
};

function enhanced(
    gate: AccessGate,
    level: "community" | "channel" = "community",
): EnhancedAccessGate {
    return { ...gate, level, collectionName: "c", expiry: undefined };
}

function leaf(evaluation: GateEvaluation, kind: LeafGate["kind"]) {
    const found = evaluation.leaves.find((g) => g.kind === kind);
    if (found === undefined) throw new Error(`no ${kind} leaf`);
    return found;
}

describe("evaluating access gates", () => {
    afterEach(() => cryptoBalanceStore.setBalance(ledger, 0n));

    test("payments on the same ledger are sent as one approval with a single fee", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced(payment(100n)),
            enhanced(payment(50n), "channel"),
        ]);

        const approval = { ledger, approvalFee: 10n };
        evaluation.approvePayment(leaf(evaluation, "payment_gate"), { ...approval, amount: 100n });
        expect(evaluation.next()).toBeUndefined();
        // the channel's payment is not satisfied by the community's
        expect(leaf(evaluation, "payment_gate").satisfied).toBe(false);
        evaluation.approvePayment(leaf(evaluation, "payment_gate"), { ...approval, amount: 50n });

        expect(evaluation.next()?.paymentApprovals).toEqual(
            new Map([[ledger, { amount: 150n, approvalFee: 10n }]]),
        );
    });

    test("an 'or' gate sends the index of the branch the user satisfied, counting hidden unique person branches", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced({
                kind: "composite_gate",
                operator: "or",
                gates: [{ kind: "unique_person_gate" }, credential, payment(100n)],
            }),
        ]);
        expect(evaluation.leaves.map((g) => g.kind)).toEqual(["credential_gate", "payment_gate"]);

        evaluation.approvePayment(leaf(evaluation, "payment_gate"), {
            ledger,
            amount: 100n,
            approvalFee: 10n,
        });

        expect(evaluation.next()?.compositeGateIndex).toBe(2);
    });

    test("an 'or' gate sends the approval for one branch only", () => {
        const otherLedger = "mxzaz-hqaaa-aaaar-qaada-cai";
        const evaluation = new GateEvaluation(client, [
            enhanced({
                kind: "composite_gate",
                operator: "or",
                gates: [payment(100n), { ...payment(50n), ledgerCanister: otherLedger }],
            }),
        ]);
        const [first, second] = evaluation.leaves;

        evaluation.approvePayment(first, { ledger, amount: 100n, approvalFee: 10n });
        evaluation.approvePayment(second, { ledger: otherLedger, amount: 50n, approvalFee: 10n });

        expect(evaluation.next()?.paymentApprovals).toEqual(
            new Map([[ledger, { amount: 100n, approvalFee: 10n }]]),
        );
    });

    test("approving the same payment gate twice sends it once", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced({
                kind: "composite_gate",
                operator: "and",
                gates: [payment(100n), credential],
            }),
        ]);
        const approval = { ledger, amount: 100n, approvalFee: 10n };

        evaluation.approvePayment(leaf(evaluation, "payment_gate"), approval);
        evaluation.approvePayment(leaf(evaluation, "payment_gate"), approval);
        evaluation.addCredential(leaf(evaluation, "credential_gate"), "jwt");

        expect(evaluation.next()?.paymentApprovals).toEqual(
            new Map([[ledger, { amount: 100n, approvalFee: 10n }]]),
        );
    });

    test("a balance gate counts payments the user already approved in this evaluation", () => {
        cryptoBalanceStore.setBalance(ledger, 100n);
        const evaluation = new GateEvaluation(client, [
            enhanced({
                kind: "composite_gate",
                operator: "and",
                gates: [
                    payment(60n),
                    { kind: "token_balance_gate", ledgerCanister: ledger, minBalance: 50n },
                ],
            }),
        ]);
        expect(leaf(evaluation, "token_balance_gate").satisfied).toBe(true);

        evaluation.approvePayment(leaf(evaluation, "payment_gate"), {
            ledger,
            amount: 60n,
            approvalFee: 10n,
        });

        expect(leaf(evaluation, "token_balance_gate").satisfied).toBe(false);
        expect(evaluation.complete).toBe(false);
        expect(evaluation.next()).toBeUndefined();
    });

    test("an 'and' gate sends nothing until every leaf is satisfied, then sends what the user produced", () => {
        const evaluation = new GateEvaluation(client, [
            enhanced({
                kind: "composite_gate",
                operator: "and",
                gates: [payment(100n), credential],
            }),
        ]);

        evaluation.approvePayment(leaf(evaluation, "payment_gate"), {
            ledger,
            amount: 100n,
            approvalFee: 10n,
        });
        expect(evaluation.complete).toBe(false);
        expect(evaluation.next()).toBeUndefined();

        evaluation.addCredential(leaf(evaluation, "credential_gate"), "jwt");
        expect(evaluation.next()).toEqual({
            credentials: ["jwt"],
            paymentApprovals: new Map([[ledger, { amount: 100n, approvalFee: 10n }]]),
            compositeGateIndex: undefined,
        });
    });
});
