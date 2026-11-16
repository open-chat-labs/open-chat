import {
    formatTokens,
    validateTokenInput,
    type ChitEarnedGate,
    type CryptocurrencyDetails,
    type NervousSystemDetails,
    type NeuronGate,
    type PaymentGate,
    type ReadonlyMap,
    type TokenBalanceGate,
} from "@client";
import { getNeuronGateBindings, getPaymentGateBindings } from "@src/utils/access";

// The values an access gate's editor shows and reads back: a token amount typed in its units, a
// neuron's dissolve delay in days, a CHIT minimum, and the tokens and nervous systems a gate may
// name. The web's AccessGates (its adapter) and the native gates page both read and write gates
// through these, so a gate typed in either is the same gate.

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The tokens and nervous systems a gate is read against. */
export type GateLookups = {
    tokens: ReadonlyMap<string, CryptocurrencyDetails>;
    nervousSystems: ReadonlyMap<string, NervousSystemDetails>;
};

/** A token amount as a gate's field shows it; "" for a token that isn't known. */
export function gateAmountText(amount: bigint, decimals: number | undefined): string {
    return decimals === undefined ? "" : formatTokens(amount, decimals, ".", true);
}

/** A typed amount in the token's smallest units, or undefined when it isn't one above 0. */
export function parseGateAmount(text: string, decimals: number): bigint | undefined {
    const { replacementText, amount } = validateTokenInput(text, decimals);
    return replacementText === "" || amount <= 0n ? undefined : amount;
}

/** A payment gate for `token` and the amount typed, or undefined when it isn't an amount. */
export function paymentGateOf(token: CryptocurrencyDetails, text: string): PaymentGate | undefined {
    const amount = parseGateAmount(text, token.decimals);
    return amount === undefined
        ? undefined
        : { kind: "payment_gate", ledgerCanister: token.ledger, amount, fee: token.transferFee };
}

/** A minimum balance gate for `token` and the amount typed, or undefined when it isn't one. */
export function balanceGateOf(
    token: CryptocurrencyDetails,
    text: string,
): TokenBalanceGate | undefined {
    const minBalance = parseGateAmount(text, token.decimals);
    return minBalance === undefined
        ? undefined
        : { kind: "token_balance_gate", ledgerCanister: token.ledger, minBalance };
}

/**
 * A neuron gate for `ns`, with the dissolve delay typed in days and the stake in tokens: each
 * optional, left out when it isn't a number above 0.
 */
export function neuronGateOf(ns: NervousSystemDetails, days: string, stake: string): NeuronGate {
    const delay = Number(days);
    const staked = stake.trim() === "" ? undefined : parseGateAmount(stake, ns.token.decimals);
    return {
        kind: "neuron_gate",
        governanceCanister: ns.governanceCanisterId,
        minDissolveDelay: delay > 0 ? delay * DAY_MS : undefined,
        minStakeE8s: staked === undefined ? undefined : Number(staked),
    };
}

/** A neuron gate's dissolve delay in days and stake in tokens, as its fields show them. */
export function neuronGateText(
    gate: NeuronGate,
    lookups: GateLookups,
): { days: string; stake: string } {
    const decimals = lookups.nervousSystems.get(gate.governanceCanister)?.token.decimals;
    return {
        days: gate.minDissolveDelay ? String(gate.minDissolveDelay / DAY_MS) : "",
        stake: gate.minStakeE8s ? gateAmountText(BigInt(gate.minStakeE8s), decimals) : "",
    };
}

/** A minimum CHIT gate for the number typed, or undefined when it isn't a whole number above 0. */
export function chitGateOf(text: string): ChitEarnedGate | undefined {
    const minEarned = Number(text);
    return Number.isInteger(minEarned) && minEarned > 0
        ? { kind: "chit_earned_gate", minEarned }
        : undefined;
}

/** The tokens a payment or balance gate may name: those the old gate editors offered. */
export function gateTokens(lookups: GateLookups): CryptocurrencyDetails[] {
    const nsLedgers = new Set(
        [...lookups.nervousSystems.values()].map((ns) => ns.ledgerCanisterId),
    );
    return getPaymentGateBindings(lookups.tokens, nsLedgers)
        .filter((b) => b.enabled)
        .flatMap((b) => lookups.tokens.get(b.gate.ledgerCanister) ?? []);
}

/** The nervous systems a neuron gate may name: those the old gate editors offered. */
export function gateNervousSystems(lookups: GateLookups): NervousSystemDetails[] {
    return getNeuronGateBindings(lookups.nervousSystems)
        .filter((b) => b.enabled)
        .flatMap((b) => lookups.nervousSystems.get(b.gate.governanceCanister) ?? []);
}
