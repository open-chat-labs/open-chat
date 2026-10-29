import type { AccountTransaction, EnhancedTokenDetails, UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import {
    displayDecimals,
    receiveNetworks,
    panelSettings,
    sendContacts,
    sendTokenNets,
    supportedCount,
    tokenActivity,
    walletToken,
    walletTokenActions,
    walletTokens,
    walletRecipients,
    addressNetworkName,
} from "./wallet.adapter";

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
        // to a user: the transfer, and the approval it's pulled through
        expect(t.userFee).toBe(0.002);
        expect(t.logo).toBe("/chat.svg");
        expect(t.grad).toMatch(/^linear-gradient/);
    });

    test("Remove is the panel's Hide; Swap waits for its flow", () => {
        expect(walletTokenActions(["send", "receive", "swap", "refresh", "remove"])).toEqual([
            "send",
            "receive",
            "refresh",
            "hide",
        ]);
    });

    test("Send's networks: the IC for every token, and Bitcoin's own for BTC", () => {
        expect(sendTokenNets("CHAT")).toEqual(["icp"]);
        expect(sendTokenNets("ICP")).toEqual(["icp"]);
        expect(sendTokenNets("BTC")).toEqual(["icp", "btc"]);
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
            {
                me,
                users: new Map(),
                saved: [{ name: "Exchange", account: "them" }],
                unknown: "Unknown",
            },
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

    test("a mint (no sender) or a burn (no recipient) names the other side as unknown", () => {
        const mint: AccountTransaction = {
            kind: "mint",
            id: 5n,
            amount: 1n,
            timestamp: new Date(0),
            to: "me-account",
        };
        const burn: AccountTransaction = {
            kind: "burn",
            id: 4n,
            amount: 1n,
            timestamp: new Date(0),
            from: "me-user",
        };
        const rows = tokenActivity([mint, burn], token(), 0, {
            me,
            users: new Map(),
            saved: [],
            unknown: "Unknown",
        });
        expect(rows.map((r) => [r.kind, r.party])).toEqual([
            ["receive", "Unknown"],
            ["send", "Unknown"],
        ]);
    });
});

describe("the wallet's catalogue", () => {
    test("every token with its price; one counted per ledger, as the picker lists them", () => {
        const list = walletTokens(
            [
                token(),
                token({ ledger: "another-chat", balance: 0n }),
                token({ symbol: "ICP", ledger: "icp" }),
            ],
            new Map([["icp", { toUSD: 5 }]]),
            {
                swappable: new Set(),
                manualWallet: false,
                disabled: { send: false, receive: false, swap: false },
            },
        );
        expect(list.map((t) => [t.id, t.price])).toEqual([
            ["chat-ledger", 0],
            ["another-chat", 0],
            ["icp", 5],
        ]);
        expect(supportedCount(list)).toBe(3);
    });

    test("the panel reads the wallet config: a minimum value, or the chosen ledgers", () => {
        expect(panelSettings({ kind: "auto_wallet", minDollarValue: 2.5 })).toEqual({
            autoConfig: true,
            minBalance: "2.5",
        });
        expect(panelSettings({ kind: "manual_wallet", tokens: new Set(["a", "b"]) })).toEqual({
            autoConfig: false,
            tokens: ["a", "b"],
        });
    });
});

describe("Receive's networks", () => {
    const words = (key: string, values: Record<string, string>) =>
        `${key}(${Object.values(values).join(",")})`;
    const state = {
        networks: [] as string[],
        selectedNetwork: undefined,
        address: "icrc-address",
        failed: false,
        depositNote: { kind: "none" as const },
        arrivingToken: (network: string) =>
            ["BTC", "ckBTC"].includes(network) ? network : undefined,
    };

    test("an IC token: the Internet Computer alone, with the address", () => {
        expect(receiveNetworks(state, "CHAT", words)).toEqual([
            {
                id: "ICP",
                label: "Internet Computer",
                address: "icrc-address",
                failed: false,
                note: undefined,
            },
        ]);
    });

    test("BTC: both networks, the chosen one with its address and fee", () => {
        const list = receiveNetworks(
            {
                ...state,
                networks: ["BTC", "ckBTC"],
                selectedNetwork: "BTC",
                address: undefined,
                depositNote: { kind: "btc", fee: "~0.0001" },
            },
            "BTC",
            words,
        );
        expect(list.map((n) => n.label)).toEqual(["Bitcoin", "ckBTC"]);
        // the warning names what each address takes: BTC, or ckBTC
        expect(list.map((n) => n.token)).toEqual(["BTC", "ckBTC"]);
        expect(list[0]).toMatchObject({
            address: undefined,
            note: "cryptoAccount.networkFee(~0.0001,BTC)",
        });
        expect(list[1].address).toBeUndefined();
    });

    test("an address that failed says so; SOL's note has its minimum and fees", () => {
        const [sol] = receiveNetworks(
            {
                ...state,
                networks: ["SOL", "ckSOL"],
                selectedNetwork: "SOL",
                failed: true,
                depositNote: { kind: "sol", minimum: "0.01", firstFee: "0.002", laterFee: "0.001" },
            },
            "SOL",
            words,
        );
        expect(sol.failed).toBe(true);
        expect(sol.note).toBe(
            "cryptoAccount.minimumDeposit(0.01,SOL) cryptoAccount.solDepositFee(0.002,0.001,SOL)",
        );
    });
});

describe("Send's people", () => {
    test("a DM'd user by their display name, else username, with their handle", () => {
        const user = (over: Partial<UserSummary>): UserSummary => ({
            kind: "user",
            userId: "u1",
            username: "alice",
            displayName: undefined,
            updated: 0n,
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            totalChitEarned: 0,
            streak: 0,
            maxStreak: 0,
            isUniquePerson: false,
            hideOnlineStatus: false,
            ...over,
        });
        const [a, b] = sendContacts([user({}), user({ userId: "u2", displayName: "Bob" })]);
        expect(a).toMatchObject({ userId: "u1", name: "alice", handle: "@alice" });
        expect(b).toMatchObject({ userId: "u2", name: "Bob" });
        expect(a.grad).toMatch(/gradient/);
    });
});

describe("the address book", () => {
    test("each saved account is a recipient keyed by its account, with its network's name", () => {
        expect(walletRecipients([{ name: "Exchange", account: "abc" }])).toEqual([
            { id: "abc", name: "Exchange", address: "abc" },
        ]);
        expect(addressNetworkName("icrc")).toBe("Internet Computer");
        expect(addressNetworkName("sol")).toBe("Solana");
    });
});
