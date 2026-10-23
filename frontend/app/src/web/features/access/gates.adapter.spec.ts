import type { AccessGateConfig, CryptocurrencyDetails, NervousSystemDetails } from "@client";
import { describe, expect, test } from "vitest";
import { gateConfig, gatesState, type GateLookups } from "./gates.adapter";

const icp = { ledger: "icp-ledger", symbol: "ICP", name: "ICP", decimals: 8, transferFee: 10_000n };
const eth = {
    ledger: "eth-ledger",
    symbol: "ckETH",
    name: "ckETH",
    decimals: 18,
    transferFee: 2_000_000_000_000n,
};
const ns = {
    governanceCanisterId: "gov",
    ledgerCanisterId: "chat-ledger",
    token: {
        ledger: "chat-ledger",
        symbol: "CHAT",
        name: "OpenChat",
        decimals: 8,
        transferFee: 100_000n,
    },
};

const lookups: GateLookups = {
    tokens: new Map([
        [icp.ledger, icp as CryptocurrencyDetails],
        [eth.ledger, eth as CryptocurrencyDetails],
    ]),
    nervousSystems: new Map([[ns.governanceCanisterId, ns as NervousSystemDetails]]),
};

const moneyGates: AccessGateConfig = {
    gate: {
        kind: "composite_gate",
        operator: "or",
        gates: [
            // an amount with every decimal place used, and one with 18 decimals
            {
                kind: "payment_gate",
                ledgerCanister: icp.ledger,
                amount: 123_456_789n,
                fee: 10_000n,
            },
            {
                kind: "token_balance_gate",
                ledgerCanister: eth.ledger,
                minBalance: 1_000_000_000_000_000_001n,
            },
            {
                kind: "neuron_gate",
                governanceCanister: ns.governanceCanisterId,
                minStakeE8s: 2_550_000_000,
                minDissolveDelay: 30 * 24 * 60 * 60 * 1000,
            },
        ],
    },
    expiry: BigInt(84 * 24 * 60 * 60 * 1000),
};

describe("the gates adapter", () => {
    // 4a invariant 7: an amount read into the editor and written back is the same bigint, and a
    // typed amount converts with the token's decimals
    test("reading and writing back keeps every amount exactly, and a typed amount converts with the token's decimals", () => {
        const state = gatesState(moneyGates, lookups);
        expect(state.rules.map((r) => [r.a, r.b])).toEqual([
            ["1.23456789", ""],
            ["1.000000000000000001", ""],
            ["30", "25.50"],
        ]);
        expect(gateConfig(state, moneyGates, lookups)).toEqual(moneyGates);

        // the same rules typed afresh (new ids) convert to the same amounts
        const typed = { ...state, rules: state.rules.map((r, i) => ({ ...r, id: `new${i}` })) };
        const back = gateConfig(typed, moneyGates, lookups).gate;
        expect(back.kind === "composite_gate" && back.gates).toEqual([
            {
                kind: "payment_gate",
                ledgerCanister: icp.ledger,
                amount: 123_456_789n,
                fee: icp.transferFee,
            },
            {
                kind: "token_balance_gate",
                ledgerCanister: eth.ledger,
                minBalance: 1_000_000_000_000_000_001n,
            },
            {
                kind: "neuron_gate",
                governanceCanister: ns.governanceCanisterId,
                minStakeE8s: 2_550_000_000,
                minDissolveDelay: 30 * 24 * 60 * 60 * 1000,
            },
        ]);
    });

    // 4a invariant 3: never shows a unique-person gate, and keeps a dormant one on the way back
    test("never shows a unique-person gate, and writing back keeps a dormant one", () => {
        const config: AccessGateConfig = {
            gate: {
                kind: "composite_gate",
                operator: "and",
                gates: [{ kind: "diamond_gate" }, { kind: "unique_person_gate" }],
            },
            expiry: undefined,
        };
        const state = gatesState(config, lookups);
        expect(state.rules.map((r) => r.type)).toEqual(["diamond"]);
        expect(gateConfig(state, config, lookups)).toEqual(config);

        // removing the only shown gate still keeps it
        expect(gateConfig({ ...state, rules: [] }, config, lookups).gate).toEqual({
            kind: "unique_person_gate",
        });
        // and a unique-person rule handed back is never written
        const added = {
            ...state,
            rules: [...state.rules, { id: "x", type: "unique", asset: "", a: "", b: "" }],
        };
        expect(
            gateConfig(added, { gate: { kind: "no_gate" }, expiry: undefined }, lookups).gate,
        ).toEqual({
            kind: "diamond_gate",
        });
    });
});
