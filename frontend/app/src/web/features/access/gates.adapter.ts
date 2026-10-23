import {
    editableGates,
    formatTokens,
    gateWithHidden,
    validateTokenInput,
    type AccessGateConfig,
    type ActiveLeafGate,
    type CryptocurrencyDetails,
    type NervousSystemDetails,
    type ReadonlyMap,
} from "@client";
import type { GateAsset } from "@openchat/ui/src/features/components/AccessGates.svelte";
import type { AccessGateRule, AccessGatesState } from "@openchat/ui/src/lib/types";
import { getNeuronGateBindings, getPaymentGateBindings } from "@src/utils/access";

// A chat's or community's gate config to and from AccessGates' state. The editor never shows the
// suspended unique-person gate or a gate it has no row for, and writing back keeps them
// (editableGates / gateWithHidden). A rule the user left as it was is written back as the gate it
// came from, so reading and saving never changes a gate.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The gate types offered to add: not unique-person (suspended) or credential (AccessGates can't
 * pick a credential yet; one already there still shows).
 */
export const OFFERED_GATE_TYPES = [
    "lifetime",
    "diamond",
    "neuron",
    "payment",
    "balance",
    "locked",
    "chit",
];

export type GateLookups = {
    tokens: ReadonlyMap<string, CryptocurrencyDetails>;
    nervousSystems: ReadonlyMap<string, NervousSystemDetails>;
};

// AccessGates' own interval labels, by their length in days
const INTERVAL_LABELS: Record<number, string> = {
    1: "1 day",
    7: "1 week",
    14: "2 weeks",
    30: "1 month",
    90: "3 months",
    180: "6 months",
};

function amountText(amount: bigint, decimals: number | undefined): string {
    return decimals === undefined ? "" : formatTokens(amount, decimals, ".", true);
}

// a typed amount in the token's smallest units, or undefined when it isn't one
function parseAmount(text: string, decimals: number): bigint | undefined {
    const { replacementText, amount } = validateTokenInput(text, decimals);
    return replacementText === "" || amount <= 0n ? undefined : amount;
}

function toRule(
    gate: ActiveLeafGate,
    id: string,
    lookups: GateLookups,
): AccessGateRule | undefined {
    const rule = { id, asset: "", a: "", b: "" };
    switch (gate.kind) {
        case "lifetime_diamond_gate":
            return { ...rule, type: "lifetime" };
        case "diamond_gate":
            return { ...rule, type: "diamond" };
        case "locked_gate":
            return { ...rule, type: "locked" };
        case "credential_gate":
            return { ...rule, type: "credential" };
        case "chit_earned_gate":
            return { ...rule, type: "chit", a: String(gate.minEarned) };
        case "payment_gate":
            return {
                ...rule,
                type: "payment",
                asset: gate.ledgerCanister,
                a: amountText(gate.amount, lookups.tokens.get(gate.ledgerCanister)?.decimals),
            };
        case "token_balance_gate":
            return {
                ...rule,
                type: "balance",
                asset: gate.ledgerCanister,
                a: amountText(gate.minBalance, lookups.tokens.get(gate.ledgerCanister)?.decimals),
            };
        case "neuron_gate": {
            const decimals = lookups.nervousSystems.get(gate.governanceCanister)?.token.decimals;
            return {
                ...rule,
                type: "neuron",
                asset: gate.governanceCanister,
                a: gate.minDissolveDelay ? String(gate.minDissolveDelay / DAY_MS) : "",
                b: gate.minStakeE8s ? amountText(BigInt(gate.minStakeE8s), decimals) : "",
            };
        }
        default:
            return undefined;
    }
}

function toGate(rule: AccessGateRule, lookups: GateLookups): ActiveLeafGate | undefined {
    switch (rule.type) {
        case "lifetime":
            return { kind: "lifetime_diamond_gate" };
        case "diamond":
            return { kind: "diamond_gate" };
        case "locked":
            return { kind: "locked_gate" };
        case "chit": {
            const minEarned = Number(rule.a);
            return Number.isInteger(minEarned) && minEarned > 0
                ? { kind: "chit_earned_gate", minEarned }
                : undefined;
        }
        case "payment": {
            const token = lookups.tokens.get(rule.asset);
            const amount = token && parseAmount(rule.a, token.decimals);
            return token && amount !== undefined
                ? {
                      kind: "payment_gate",
                      ledgerCanister: token.ledger,
                      amount,
                      fee: token.transferFee,
                  }
                : undefined;
        }
        case "balance": {
            const token = lookups.tokens.get(rule.asset);
            const minBalance = token && parseAmount(rule.a, token.decimals);
            return token && minBalance !== undefined
                ? { kind: "token_balance_gate", ledgerCanister: token.ledger, minBalance }
                : undefined;
        }
        case "neuron": {
            const ns = lookups.nervousSystems.get(rule.asset);
            if (ns === undefined) return undefined;
            const days = Number(rule.a);
            const stake = rule.b.trim() === "" ? undefined : parseAmount(rule.b, ns.token.decimals);
            return {
                kind: "neuron_gate",
                governanceCanister: ns.governanceCanisterId,
                minDissolveDelay: days > 0 ? days * DAY_MS : undefined,
                minStakeE8s: stake === undefined ? undefined : Number(stake),
            };
        }
        // unique-person is suspended, and a new credential gate has no credential to name
        default:
            return undefined;
    }
}

/** AccessGates' `value` for a gate config. */
export function gatesState(config: AccessGateConfig, lookups: GateLookups): AccessGatesState {
    const { shown, operator } = editableGates(config.gate);
    const rules = shown.flatMap((gate, i) => toRule(gate, `g${i}`, lookups) ?? []);
    const days = config.expiry === undefined ? undefined : Number(config.expiry) / DAY_MS;
    return {
        count: rules.length,
        joiner: operator === "or" ? "Any" : "All",
        rules,
        complete: true,
        intervalOn: config.expiry !== undefined,
        every: days === undefined ? "1 month" : (INTERVAL_LABELS[days] ?? `${days} days`),
        everyDays: days,
    };
}

const sameRule = (a: AccessGateRule, b: AccessGateRule) =>
    a.type === b.type && a.asset === b.asset && a.a === b.a && a.b === b.b;

/**
 * The gate config AccessGates' state makes, from the `original` it was opened with. Rules left as
 * they were are their original gates; an incomplete rule is left out (AccessGates' `complete`
 * says so first).
 */
export function gateConfig(
    state: AccessGatesState,
    original: AccessGateConfig,
    lookups: GateLookups,
): AccessGateConfig {
    const { shown } = editableGates(original.gate);
    const before = gatesState(original, lookups);
    const gates = state.rules.flatMap((rule) => {
        const index = before.rules.findIndex((r) => r.id === rule.id);
        if (index >= 0 && sameRule(before.rules[index], rule)) return [shown[index]];
        return toGate(rule, lookups) ?? [];
    });
    const gate = gateWithHidden(gates, state.joiner === "Any" ? "or" : "and", original.gate);

    let expiry: bigint | undefined = undefined;
    if (state.intervalOn && gate.kind !== "no_gate") {
        expiry =
            state.every === before.every && original.expiry !== undefined
                ? original.expiry
                : state.everyDays !== undefined
                  ? BigInt(state.everyDays * DAY_MS)
                  : original.expiry;
    }
    return { gate, expiry };
}

/** AccessGates' `tokens` and `nervousSystems`: those the old gate editors offered. */
export function gateAssets(lookups: GateLookups): {
    tokens: GateAsset[];
    nervousSystems: GateAsset[];
} {
    const nsLedgers = new Set(
        [...lookups.nervousSystems.values()].map((ns) => ns.ledgerCanisterId),
    );
    const tokens = getPaymentGateBindings(lookups.tokens, nsLedgers)
        .filter((b) => b.enabled)
        .flatMap((b) => {
            const token = lookups.tokens.get(b.gate.ledgerCanister);
            return token ? [{ id: token.ledger, symbol: token.symbol, name: token.name }] : [];
        });
    const nervousSystems = getNeuronGateBindings(lookups.nervousSystems)
        .filter((b) => b.enabled)
        .flatMap((b) => {
            const ns = lookups.nervousSystems.get(b.gate.governanceCanister);
            return ns
                ? [{ id: ns.governanceCanisterId, symbol: ns.token.symbol, name: ns.token.name }]
                : [];
        });
    return { tokens, nervousSystems };
}
