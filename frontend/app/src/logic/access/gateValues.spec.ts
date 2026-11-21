import type { CryptocurrencyDetails, NervousSystemDetails } from "@client";
import { describe, expect, test } from "vitest";
import {
    balanceGateOf,
    chitGateOf,
    DAY_MS,
    gateAmountText,
    neuronGateOf,
    neuronGateText,
    parseGateAmount,
    paymentGateOf,
    type GateLookups,
} from "./gateValues";

const icp = {
    ledger: "icp-ledger",
    symbol: "ICP",
    name: "ICP",
    decimals: 8,
    transferFee: 10_000n,
} as CryptocurrencyDetails;
const ns = {
    governanceCanisterId: "gov",
    ledgerCanisterId: "chat-ledger",
    token: { ledger: "chat-ledger", symbol: "CHAT", name: "OpenChat", decimals: 8 },
} as NervousSystemDetails;
const lookups: GateLookups = {
    tokens: new Map([[icp.ledger, icp]]),
    nervousSystems: new Map([[ns.governanceCanisterId, ns]]),
};

describe("a gate's values", () => {
    test("an amount typed in tokens is read in the token's smallest units", () => {
        expect(parseGateAmount("1.5", 8)).toBe(150_000_000n);
        expect(parseGateAmount("0", 8)).toBeUndefined();
        expect(parseGateAmount("", 8)).toBeUndefined();
        expect(parseGateAmount("abc", 8)).toBeUndefined();
    });

    test("an amount read back shows as it was typed", () => {
        expect(gateAmountText(150_000_000n, 8)).toBe("1.50");
        expect(gateAmountText(150_000_000n, undefined)).toBe("");
    });

    test("a payment gate takes the token's fee, and needs an amount", () => {
        expect(paymentGateOf(icp, "2")).toEqual({
            kind: "payment_gate",
            ledgerCanister: "icp-ledger",
            amount: 200_000_000n,
            fee: 10_000n,
        });
        expect(paymentGateOf(icp, "")).toBeUndefined();
    });

    test("a minimum balance gate needs an amount", () => {
        expect(balanceGateOf(icp, "0.1")).toEqual({
            kind: "token_balance_gate",
            ledgerCanister: "icp-ledger",
            minBalance: 10_000_000n,
        });
        expect(balanceGateOf(icp, "-1")).toBeUndefined();
    });

    test("a neuron gate's delay and stake are each optional, and read back the same", () => {
        const gate = neuronGateOf(ns, "30", "25.5");
        expect(gate).toEqual({
            kind: "neuron_gate",
            governanceCanister: "gov",
            minDissolveDelay: 30 * DAY_MS,
            minStakeE8s: 2_550_000_000,
        });
        expect(neuronGateText(gate, lookups)).toEqual({ days: "30", stake: "25.50" });
        expect(neuronGateOf(ns, "", "")).toEqual({
            kind: "neuron_gate",
            governanceCanister: "gov",
            minDissolveDelay: undefined,
            minStakeE8s: undefined,
        });
    });

    test("a CHIT gate needs a whole number above 0", () => {
        expect(chitGateOf("100")).toEqual({ kind: "chit_earned_gate", minEarned: 100 });
        expect(chitGateOf("1.5")).toBeUndefined();
        expect(chitGateOf("0")).toBeUndefined();
    });
});
