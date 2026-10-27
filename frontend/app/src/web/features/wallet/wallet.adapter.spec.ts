import type { AccountTransaction, EnhancedTokenDetails } from "@client";
import { describe, expect, test } from "vitest";
import { displayDecimals, tokenActivity, walletToken, walletTokenActions } from "./wallet.adapter";

function token(over: Partial<EnhancedTokenDetails> = {}): EnhancedTokenDetails {
    return {
        name: "OpenChat",
        symbol: "CHAT",
        ledger: "chat-ledger",
        index: "chat-index",
        decimals: 8,
        transferFee: 100_000n,
        logo: "",
        infoUrl: "",
        transactionUrlFormat: "",
        supportedStandards: ["ICRC-1", "ICRC-2"],
        added: 0n,
        enabled: true,
        oneSecEnabled: false,
        evmContractAddresses: [],
        lastUpdated: 0n,
        balance: 150_000_000n,
        dollarBalance: undefined,
        icpBalance: undefined,
        btcBalance: undefined,
        ethBalance: undefined,
        zero: false,
        urlFormat: "",
        ...over,
    };
}

describe("the wallet's tokens", () => {
    test("invariant 1: a token is identified by its ledger, so two with one symbol stay apart", () => {
        const a = walletToken(token(), 0.05, []);
        const b = walletToken(token({ ledger: "another-chat" }), 0.05, []);
        expect(a.id).toBe("chat-ledger");
        expect(b.id).toBe("another-chat");
        expect(a.symbol).toBe(b.symbol);
    });

    test("amounts are in whole tokens, the logo is its face", () => {
        const t = walletToken(token({ logo: "/chat.svg" }), 0.05, ["send", "refresh"]);
        expect(t).toMatchObject({ held: 1.5, fee: 0.001, price: 0.05, standard: "ICRC-2" });
        expect(t.logo).toBe("/chat.svg");
        expect(t.grad).toMatch(/^linear-gradient/);
    });

    test("Remove is the panel's Hide; Send, Receive and Swap wait for their flows", () => {
        expect(walletTokenActions(["send", "receive", "swap", "refresh", "remove"])).toEqual([
            "refresh",
            "hide",
        ]);
    });

    test("shows 8 places for a token worth a lot, 2 for a dollar one, else 4, never more than it has", () => {
        expect(displayDecimals(8, 62_000)).toBe(8);
        expect(displayDecimals(6, 1)).toBe(2);
        expect(displayDecimals(8, 5.4)).toBe(4);
        expect(displayDecimals(2, 0.05)).toBe(2);
    });
});

describe("a token's activity", () => {
    const me = { userId: "me-user", cryptoAccount: "me-account" };
    const tx = (id: bigint, from: string, to: string): AccountTransaction => ({
        kind: "transfer",
        id,
        amount: 200_000_000n,
        timestamp: new Date(1000),
        from,
        to,
    });

    test("invariant 2: between the user's own wallets is neither sent nor received", () => {
        const rows = tokenActivity(
            [
                tx(3n, "me-user", "me-account"),
                tx(2n, "me-account", "them"),
                tx(1n, "them", "me-account"),
            ],
            token(),
            0.5,
            { me, users: new Map(), saved: [{ name: "Exchange", account: "them" }] },
        );
        expect(rows.map((r) => r.kind)).toEqual(["own", "send", "receive"]);
        expect(rows[1]).toMatchObject({
            id: "2",
            token: "chat-ledger",
            party: "Exchange",
            amount: 2,
            fiat: 1,
            timestamp: 1000,
        });
    });
});
