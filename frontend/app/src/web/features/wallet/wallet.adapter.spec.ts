import type { UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import {
    addressNetworkName,
    receiveNetworks,
    searchContacts,
    sendContacts,
    walletRecipients,
} from "./wallet.adapter";

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
    test("each saved account is a recipient keyed by its account, with its network's name and the token Send opens on", () => {
        const ledgers = { icp: "icp-ledger", btc: "ckbtc-ledger" };
        const [ic, btc, sol] = walletRecipients(
            [
                { name: "Exchange", account: "ryjl3-tyaaa-aaaaa-aaaba-cai" },
                { name: "Cold", account: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
                { name: "Phantom", account: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV" },
            ],
            ledgers,
        );
        expect(ic).toEqual({
            id: "ryjl3-tyaaa-aaaaa-aaaba-cai",
            name: "Exchange",
            address: "ryjl3-tyaaa-aaaaa-aaaba-cai",
            networkName: "Internet Computer",
            sendToken: "icp-ledger",
        });
        expect(btc).toMatchObject({ networkName: "Bitcoin", sendToken: "ckbtc-ledger" });
        // no ckSOL in the app: ICP, which Send then says can't reach the address
        expect(sol).toMatchObject({ networkName: "Solana", sendToken: "icp-ledger" });
        expect(addressNetworkName("icrc")).toBe("Internet Computer");
        expect(addressNetworkName("sol")).toBe("Solana");
    });
});

describe("Send's user search", () => {
    test("finds the DM'd users by name or handle, ignoring case and a leading @", () => {
        const contacts = [
            { userId: "u1", name: "Alice", handle: "@alice" },
            { userId: "u2", name: "Bob Smith", handle: "@bobby" },
        ];
        expect(searchContacts(contacts, "ALI").map((c) => c.userId)).toEqual(["u1"]);
        expect(searchContacts(contacts, "@bob").map((c) => c.userId)).toEqual(["u2"]);
        expect(searchContacts(contacts, "smith").map((c) => c.userId)).toEqual(["u2"]);
        expect(searchContacts(contacts, "  ")).toEqual([]);
    });
});
