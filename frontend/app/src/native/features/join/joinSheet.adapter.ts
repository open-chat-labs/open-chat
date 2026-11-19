import {
    formatTokens,
    i18nKey,
    isCompositeGate,
    type EnhancedAccessGate,
    type EnhancedTokenDetails,
    type ReadonlyMap,
    type ResourceKey,
} from "@client";
import type { EvaluatedLeafGate } from "@src/logic/access/gateEvaluation.svelte";
import { otherRequirement, type GateChoice } from "@src/logic/join/joinGate";

const DAY_MS = 24 * 60 * 60 * 1000;

// The requirements sheet (N8b PR 2, native plan 12 "Join sheet"): a gate's requirements as a
// checklist, one level at a time (GateEvaluation's), and what Join pays. What the user chose is
// recorded by logic/join's recordGateChoice, which approves the gates' own amounts; this says which
// leaves the user is paying for, never how much.

/**
 * A requirement's row. met: the app found it met (or the user confirmed it); pay: a payment the
 * user can afford, made on Join; short: a payment or balance their wallet can't cover; todo: not
 * met, and nothing here can meet it but Diamond (`getDiamond`).
 */
export type SheetRowState = "met" | "pay" | "short" | "todo";

export type SheetRow = {
    /** The leaf's `originalIndex`, which a payment is recorded by. */
    id: number;
    label: ResourceKey;
    detail: ResourceKey | undefined;
    state: SheetRowState;
    icon: string;
    /** The neuron row: only the user can say they hold one, by tapping it. */
    confirmable: boolean;
    /** Diamond isn't met: the row offers Get Diamond. */
    getDiamond: boolean;
    /** pay: what Join pays, for its label. */
    payment?: { amount: string; symbol: string };
};

function tokenRow(
    leaf: Extract<EvaluatedLeafGate, { kind: "payment_gate" | "token_balance_gate" }>,
    token: EnhancedTokenDetails,
): SheetRow {
    const pay = leaf.kind === "payment_gate";
    const needed = pay ? leaf.amount : leaf.minBalance;
    const amount = formatTokens(needed, token.decimals);
    const values = { amount, symbol: token.symbol };
    const state: SheetRowState = pay
        ? token.balance >= needed
            ? "pay"
            : "short"
        : leaf.satisfied
          ? "met"
          : "short";
    return {
        id: leaf.originalIndex,
        label: i18nKey(pay ? "native.join.sheet.pay" : "native.join.sheet.hold", values),
        detail:
            pay && state === "pay"
                ? i18nKey("native.join.sheet.charged")
                : state === "short" && pay
                  ? i18nKey("native.join.sheet.notEnough", { symbol: token.symbol })
                  : i18nKey("native.join.sheet.youHold", {
                        amount: formatTokens(token.balance, token.decimals),
                        symbol: token.symbol,
                    }),
        state,
        icon: pay ? "wallet" : "coins",
        confirmable: false,
        getDiamond: false,
        payment: pay ? values : undefined,
    };
}

/**
 * The rows for a gate's leaves (GateEvaluation's), with the user's tokens and their balances. A
 * store build (`appStoreBuild`) moves no crypto and sells no Diamond, as v2's store build: a payment
 * can't be met in it, and a Diamond row doesn't offer Get Diamond.
 */
export function sheetRows(
    leaves: EvaluatedLeafGate[],
    tokens: ReadonlyMap<string, EnhancedTokenDetails>,
    neuronConfirmed: boolean,
    store: boolean,
): SheetRow[] {
    return leaves.map((leaf): SheetRow => {
        const base = { id: leaf.originalIndex, confirmable: false, getDiamond: false };
        switch (leaf.kind) {
            case "payment_gate":
                if (store) {
                    return {
                        ...base,
                        label: i18nKey("native.join.sheet.storePayment"),
                        detail: undefined,
                        state: "todo",
                        icon: "wallet",
                    };
                }
            // falls through
            case "token_balance_gate": {
                const token = tokens.get(leaf.ledgerCanister);
                if (token !== undefined) return tokenRow(leaf, token);
                break;
            }
            case "neuron_gate": {
                // the stake asked for, else the dissolve delay (days), as the old trees said them
                const detail =
                    leaf.minStakeE8s !== undefined
                        ? i18nKey("access.minStakeN", {
                              n: formatTokens(BigInt(leaf.minStakeE8s), 8),
                          })
                        : leaf.minDissolveDelay !== undefined
                          ? i18nKey("access.minDissolveDelayN", {
                                n: Math.round(leaf.minDissolveDelay / DAY_MS),
                            })
                          : undefined;
                return {
                    ...base,
                    label: i18nKey("access.neuronHolder"),
                    detail,
                    state: neuronConfirmed || leaf.satisfied ? "met" : "todo",
                    icon: "lock",
                    confirmable: true,
                };
            }
            case "diamond_gate":
            case "lifetime_diamond_gate": {
                const lifetime = leaf.kind === "lifetime_diamond_gate";
                return {
                    ...base,
                    label: i18nKey(
                        lifetime ? "access.lifetimeDiamondMember" : "access.diamondMember",
                    ),
                    detail: i18nKey(
                        leaf.satisfied
                            ? lifetime
                                ? "native.join.sheet.lifetimeYes"
                                : "native.join.sheet.diamondYes"
                            : "native.join.sheet.diamondNo",
                    ),
                    state: leaf.satisfied ? "met" : "todo",
                    icon: "diamond",
                    getDiamond: !leaf.satisfied && !store,
                };
            }
        }
        // a requirement only the app can check (CHIT, a credential …), or a payment on a ledger
        // the registry doesn't carry, which is offered no payment
        const requirement = otherRequirement(leaf);
        return {
            ...base,
            label: requirement.label,
            detail: requirement.detail,
            state: leaf.satisfied ? "met" : "todo",
            icon: requirement.icon,
        };
    });
}

/**
 * What Join does with the rows. All: every row met or paid, and every payment made. Any: one way
 * in, a requirement already met if there is one (nothing paid), else the first payment the user
 * can afford. Not ready: Join can't be pressed.
 */
export function sheetChoice(
    gate: EnhancedAccessGate,
    rows: SheetRow[],
    neuronConfirmed: boolean,
): { ready: boolean; choice: GateChoice; payments: NonNullable<SheetRow["payment"]>[] } {
    const any = isCompositeGate(gate) && gate.operator === "or";
    const chosen = any
        ? [rows.find((r) => r.state === "met") ?? rows.find((r) => r.state === "pay")].filter(
              (r) => r !== undefined,
          )
        : rows;
    const ready = chosen.length > 0 && chosen.every((r) => r.state === "met" || r.state === "pay");
    const paying = ready ? chosen.filter((r) => r.state === "pay") : [];
    return {
        ready,
        choice: { paid: paying.map((r) => r.id), neuronConfirmed },
        payments: paying.flatMap((r) => (r.payment === undefined ? [] : [r.payment])),
    };
}

/** The sheet's words around the rows: what to meet, Join's label and the note under it. */
export function sheetCopy(
    gate: EnhancedAccessGate,
    payments: NonNullable<SheetRow["payment"]>[],
): { intro: ResourceKey; join: ResourceKey; icon: string; foot: ResourceKey } {
    const any = isCompositeGate(gate) && gate.operator === "or";
    return {
        intro: i18nKey(any ? "native.join.sheet.introAny" : "native.join.sheet.introAll"),
        join:
            payments.length === 1
                ? i18nKey("native.join.sheet.payAndJoin", payments[0])
                : payments.length > 1
                  ? i18nKey("access.payAndJoin")
                  : i18nKey("joinGroup", undefined, gate.level, true),
        icon: payments.length > 0 ? "wallet" : "check",
        foot:
            payments.length > 0
                ? i18nKey("access.paymentDistributionMessage", undefined, gate.level, true)
                : i18nKey("native.join.sheet.leaveAnyTime"),
    };
}
