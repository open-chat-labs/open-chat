import { describe, expect, test } from "vitest";
import { TokenState } from "./walletState.svelte";

// The first version of `unknown` compared `#token === nullToken`. `#token` is `$state`, Svelte
// proxies whatever is assigned to it, and the comparison was always false - every guard built on
// it was inert and the crash it was meant to stop was one tap away. This pins the contract.
describe("TokenState with a ledger the registry does not carry", () => {
    test("reports itself as unknown", () => {
        expect(new TokenState(undefined).unknown).toBe(true);
    });

    test("refuses to format an amount rather than inventing a scale", () => {
        expect(new TokenState(undefined).formatTokens(123456789n)).toBe("?????");
    });

    test("does not stay unknown once a real token is assigned", () => {
        const state = new TokenState(undefined);
        state.token = {
            name: "Internet Computer",
            symbol: "ICP",
            ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
            index: undefined,
            decimals: 8,
            transferFee: 10000n,
            logo: "",
            infoUrl: "",
            transactionUrlFormat: "",
            supportedStandards: [],
            added: 0n,
            enabled: true,
            oneSecEnabled: false,
            evmContractAddresses: [],
            lastUpdated: 0n,
            balance: 0n,
            dollarBalance: undefined,
            icpBalance: undefined,
            btcBalance: undefined,
            ethBalance: undefined,
            zero: false,
            urlFormat: "",
        };
        expect(state.unknown).toBe(false);
        expect(state.formatTokens(123456789n)).not.toBe("?????");
        expect(state.formatTokens(123456789n)).toMatch(/^1\.23456/);
    });
});
