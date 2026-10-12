import {
    exchangeRatesLookupStore,
    LEDGER_CANISTER_CKBTC,
    LEDGER_CANISTER_CKETH,
    LEDGER_CANISTER_ICP,
    type EnhancedTokenDetails,
} from "@client";
import { afterEach, describe, expect, test } from "vitest";
import { TokenState } from "./walletState.svelte";

const icp: EnhancedTokenDetails = {
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
        state.token = icp;
        expect(state.unknown).toBe(false);
        expect(state.formatTokens(123456789n)).not.toBe("?????");
        expect(state.formatTokens(123456789n)).toMatch(/^1\.23456/);
    });
});

describe("TokenState fees", () => {
    test("a draft costs a single transfer's fee unless the flow says otherwise", () => {
        const state = new TokenState(icp);
        expect(state.transferFee).toBe(10000n);
        expect(state.transferFees).toBe(10000n);
        expect(state.maxAmount).toBe(state.cryptoBalance - 10000n);
    });

    test("the fees a flow sets are what the draft costs, without changing a transfer's fee", () => {
        const state = new TokenState(icp);
        state.transferFees = 20000n;
        expect(state.transferFee).toBe(10000n);
        expect(state.transferFees).toBe(20000n);
        expect(state.maxAmount).toBe(state.cryptoBalance - 20000n);

        state.draftAmount = 1n;
        expect(state.remainingBalance).toBe(state.cryptoBalance - 1n - 20000n);
    });

    test("clearing the fees a flow set goes back to a single transfer's fee", () => {
        const state = new TokenState(icp);
        state.transferFees = 20000n;
        state.transferFees = undefined;
        expect(state.transferFees).toBe(10000n);
    });
});

describe("TokenState unit value", () => {
    // One of two tokens in the registry with the symbol TENDY
    const tendy: EnhancedTokenDetails = {
        ...icp,
        name: "Tendy",
        symbol: "TENDY",
        ledger: "kylwo-viaaa-aaaaq-aae7a-cai",
    };

    afterEach(() => exchangeRatesLookupStore.set(new Map()));

    test("is the rate of the token's ledger in the selected currency", () => {
        exchangeRatesLookupStore.set(
            new Map([
                [LEDGER_CANISTER_ICP, { toUSD: 4 }],
                [LEDGER_CANISTER_CKBTC, { toUSD: 80_000 }],
                [LEDGER_CANISTER_CKETH, { toUSD: 2_000 }],
                [tendy.ledger, { toUSD: 0.08 }],
                ["iozql-7iaaa-aaaah-advvq-cai", { toUSD: 0.3 }],
            ]),
        );
        const state = new TokenState(tendy);

        expect(state.formattedUnitValue).toBe("$0.080");
        state.selectedConversion = "icp";
        expect(state.formattedUnitValue).toBe("0.020");
        state.selectedConversion = "btc";
        expect(state.formattedUnitValue).toBe("0.0000010");
        state.selectedConversion = "eth";
        expect(state.formattedUnitValue).toBe("0.000040");
    });

    test("is unknown without a rate for the selected currency", () => {
        exchangeRatesLookupStore.set(new Map([[tendy.ledger, { toUSD: 0.08 }]]));

        expect(new TokenState(tendy, "btc").formattedUnitValue).toBe("?????");
    });
});
