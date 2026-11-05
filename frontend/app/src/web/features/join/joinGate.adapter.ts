import {
    isCompositeGate,
    type EnhancedAccessGate,
    type EnhancedTokenDetails,
    type ReadonlyMap,
    type ResourceKey,
} from "@client";
import type { Gate } from "@openchat/ui/src/features/components/JoinGateDialog.svelte";
import type { WalletToken } from "@openchat/ui/src/lib/types";
import type { EvaluatedLeafGate } from "@src/logic/access/gateEvaluation.svelte";
import { otherRequirement } from "@src/logic/join/joinGate";
import { diamondWalletTokens, units } from "../diamond/diamond.adapter";

// JoinGateDialog's props for the gate being evaluated (one level: the community's, then the
// channel's). Each row's id is its leaf's `originalIndex`, which the dialog hands back with a
// payment, so the payment approved is the gate's own amount (logic/join/joinGate), never the
// dialog's number. A requirement the dialog has no row of its own for shows as `other`, met or
// not as the app found it.

const DAY_MS = 24 * 60 * 60 * 1000;

export type JoinGateProps = {
    community: { name: string };
    rule: "all" | "any";
    gates: Gate[];
    tokens: WalletToken[];
    recheckDays: number | undefined;
};

/** A row's id, for the leaf it shows. */
export function rowId(leaf: EvaluatedLeafGate): string {
    return String(leaf.originalIndex);
}

function other(leaf: EvaluatedLeafGate, text: (key: ResourceKey) => string): Gate {
    const requirement = otherRequirement(leaf);
    return {
        kind: "other",
        id: rowId(leaf),
        label: text(requirement.label),
        detail: requirement.detail === undefined ? undefined : text(requirement.detail),
        met: leaf.satisfied,
        icon: requirement.icon,
    };
}

function row(
    leaf: EvaluatedLeafGate,
    tokens: ReadonlyMap<string, EnhancedTokenDetails>,
    text: (key: ResourceKey) => string,
): Gate {
    const id = rowId(leaf);
    switch (leaf.kind) {
        case "payment_gate": {
            const token = tokens.get(leaf.ledgerCanister);
            return token === undefined
                ? other(leaf, text)
                : {
                      kind: "pay",
                      id,
                      symbol: token.symbol,
                      ledger: token.ledger,
                      amount: units(leaf.amount, token.decimals),
                  };
        }
        case "token_balance_gate": {
            const token = tokens.get(leaf.ledgerCanister);
            return token === undefined
                ? other(leaf, text)
                : {
                      kind: "balance",
                      id,
                      symbol: token.symbol,
                      ledger: token.ledger,
                      amount: units(leaf.minBalance, token.decimals),
                  };
        }
        case "neuron_gate":
            return { kind: "neuron", id };
        case "lifetime_diamond_gate":
            return { kind: "diamond", id };
        case "diamond_gate":
            return { kind: "diamond", id, lifetime: false };
        default:
            return other(leaf, text);
    }
}

/** The dialog's props for a gate and its leaves (GateEvaluation's), with the user's tokens. */
export function joinGateProps(
    gate: EnhancedAccessGate,
    leaves: EvaluatedLeafGate[],
    tokens: ReadonlyMap<string, EnhancedTokenDetails>,
    text: (key: ResourceKey) => string,
): JoinGateProps {
    const ledgers = new Set(
        leaves.flatMap((l) =>
            l.kind === "payment_gate" || l.kind === "token_balance_gate" ? [l.ledgerCanister] : [],
        ),
    );
    const held = [...ledgers].flatMap((ledger) => tokens.get(ledger) ?? []);
    return {
        community: { name: gate.collectionName },
        rule: isCompositeGate(gate) && gate.operator === "or" ? "any" : "all",
        gates: leaves.map((leaf) => row(leaf, tokens, text)),
        tokens: diamondWalletTokens(held),
        recheckDays:
            gate.expiry === undefined ? undefined : Math.round(Number(gate.expiry) / DAY_MS),
    };
}

/** The leaves the dialog's payments are for (`paid`'s ids), as GateChoice's indexes. */
export function paidLeaves(paid: { id?: string }[]): number[] {
    return paid.flatMap((p) => (p.id === undefined ? [] : [Number(p.id)]));
}
