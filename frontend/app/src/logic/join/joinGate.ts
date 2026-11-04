import {
    i18nKey,
    isCompositeGate,
    type GateCheckSucceeded,
    type LeafGate,
    type ResourceKey,
} from "@client";
import type { EvaluatedLeafGate, GateEvaluation } from "../access/gateEvaluation.svelte";

// The join gate dialog's answer, recorded on the gates' evaluation (GateEvaluation), one level at a
// time: what the user agreed to pay and confirmed. The amounts approved are the gates' own, never
// the dialog's numbers.

/** What the user chose in the dialog for the gate being evaluated. */
export type GateChoice = {
    /** The `originalIndex` of each payment leaf the user agreed to pay. */
    paid: number[];
    /** The user confirmed they hold a qualifying neuron. */
    neuronConfirmed: boolean;
};

export type GateChoiceResult =
    // the gate isn't met yet: nothing moves on
    | { kind: "incomplete" }
    // this level's gate is met, and the next level's is up (a gated channel in a gated community)
    | { kind: "next_level" }
    // every level is met: join with this
    | { kind: "ready"; gateCheck: GateCheckSucceeded };

/**
 * Records the user's choice for the current gate and moves on. An "any" gate takes one way in: a
 * payment if one was chosen, else the neuron confirmed, else the branch already met; GateEvaluation
 * never takes a second payment for a gate once it's met. `approvalFee` is the ledger's transfer fee
 * (undefined for a ledger the registry doesn't carry, whose payment is never approved).
 */
export function recordGateChoice(
    evaluation: GateEvaluation,
    choice: GateChoice,
    approvalFee: (ledger: string) => bigint | undefined,
): GateChoiceResult {
    const gate = evaluation.gate;
    if (gate === undefined) return { kind: "incomplete" };
    const any = isCompositeGate(gate) && gate.operator === "or";
    const leaves = evaluation.leaves;

    for (const leaf of leaves) {
        if (leaf.kind !== "payment_gate" || !choice.paid.includes(leaf.originalIndex)) continue;
        const fee = approvalFee(leaf.ledgerCanister);
        if (fee === undefined) continue;
        evaluation.approvePayment(leaf, {
            ledger: leaf.ledgerCanister,
            amount: leaf.amount,
            approvalFee: fee,
        });
    }
    if (choice.neuronConfirmed && !(any && choice.paid.length > 0)) {
        for (const leaf of leaves) {
            if (leaf.kind === "neuron_gate") evaluation.confirm(leaf);
        }
    }

    if (!evaluation.complete) return { kind: "incomplete" };
    const gateCheck = evaluation.next();
    return gateCheck === undefined ? { kind: "next_level" } : { kind: "ready", gateCheck };
}

/** How the dialog names a requirement it has no row of its own for, and its icon. */
export type Requirement = { label: ResourceKey; detail: ResourceKey | undefined; icon: string };

/**
 * A requirement the join gate dialog shows as the app checked it (met or not): the gates it has no
 * row for (CHIT earned, a credential, locked, referred by a member, an NFT), and a payment on a
 * ledger the registry doesn't carry, which is offered no payment.
 */
export function otherRequirement(leaf: EvaluatedLeafGate | LeafGate): Requirement {
    const level = "level" in leaf ? leaf.level : undefined;
    switch (leaf.kind) {
        case "chit_earned_gate":
            return {
                label: i18nKey("access.minimumChitEarned"),
                detail: i18nKey(leaf.minEarned.toLocaleString()),
                icon: "chit",
            };
        case "credential_gate":
            return {
                label: i18nKey("access.credential.label"),
                detail: i18nKey(leaf.credential.credentialName),
                icon: "credential",
            };
        case "locked_gate":
            return {
                label: i18nKey("access.lockedGate"),
                detail: i18nKey("access.lockedGateInfo", undefined, level, true),
                icon: "lock",
            };
        case "referred_by_member_gate":
            return {
                label: i18nKey("access.referredByMember"),
                detail: i18nKey("access.referredByMemberInfo"),
                icon: "invite",
            };
        case "nft_gate":
            return { label: i18nKey("access.nftHolder"), detail: undefined, icon: "nft" };
        case "payment_gate":
            return {
                label: i18nKey("access.payment"),
                detail: i18nKey("access.unknownTokenPayment"),
                icon: "payment",
            };
        case "token_balance_gate":
            return {
                label: i18nKey("access.minimumBalance"),
                detail: i18nKey("access.unknownTokenPayment"),
                icon: "balance",
            };
        default:
            return { label: i18nKey("access.gate"), detail: undefined, icon: "gate" };
    }
}
