import { i18nKey } from "@client";
import { describe, expect, test } from "vitest";
import { pendingTransfer } from "../cryptoTransfer/cryptoTransferForm.svelte";
import { userWalletAddress } from "./receiveAddress";
import {
    acceptsAddress,
    amountUnits,
    ownAccounts,
    sendAnswer,
    sendCost,
    sendNetworks,
    sendPlan,
    type SendToken,
} from "./walletSend";

const chat: SendToken = {
    ledger: "chat-ledger",
    symbol: "CHAT",
    decimals: 8,
    transferFee: 100_000n,
};
const eth: SendToken = {
    ledger: "cketh",
    symbol: "ckETH",
    decimals: 18,
    transferFee: 2_000_000_000_000n,
};
const btc = { fee: 5_000n, minimum: 10_000n };
const request = (over: Partial<Parameters<typeof sendPlan>[0]> = {}) => ({
    amountText: "1.5",
    max: false,
    to: "",
    network: "icp",
    ...over,
});

describe("the amount sent", () => {
    test("invariant 1: the amount entered in ledger units, without float rounding, for 8 and 18 decimals", () => {
        expect(amountUnits("1.5", 8)).toBe(150_000_000n);
        expect(amountUnits("0.1", 8)).toBe(10_000_000n);
        expect(amountUnits("0.00000001", 8)).toBe(1n);
        // 0.1 + 0.2 as floats is 0.30000000000000004; as digits, exactly 0.3
        expect(amountUnits("0.3", 18)).toBe(300_000_000_000_000_000n);
        expect(amountUnits("123456789.123456789123456789", 18)).toBe(
            123_456_789_123_456_789_123_456_789n,
        );
        expect(amountUnits("2", 18)).toBe(2_000_000_000_000_000_000n);
        // a comma decimal, digits past the token's decimals dropped, junk is nothing
        expect(amountUnits("0,5", 8)).toBe(50_000_000n);
        expect(amountUnits("0.123456789", 8)).toBe(12_345_678n);
        expect(amountUnits("abc", 8)).toBe(0n);
        expect(amountUnits("", 8)).toBe(0n);
    });

    test("Max sends what's left after the fees: one to an address, plus the approval for a person or Bitcoin", () => {
        const balance = 1_000_000_000n;
        expect(sendPlan(request({ max: true, to: "abc" }), chat, balance)).toMatchObject({
            amount: balance - 100_000n,
        });
        expect(sendPlan(request({ max: true, userId: "u1" }), chat, balance)).toMatchObject({
            amount: balance - 200_000n,
        });
        // to Bitcoin, the minter's fee goes on top: Max burns all but the approval and the fee
        expect(
            sendPlan(request({ max: true, to: "bc1", network: "btc" }), chat, balance, btc),
        ).toMatchObject({ amount: balance - 200_000n });
        // nothing left to send: no plan
        expect(sendPlan(request({ max: true, to: "abc" }), chat, 50_000n)).toBeUndefined();
        expect(sendPlan(request({ amountText: "0" }), chat, balance)).toBeUndefined();
    });
});

describe("where a send goes", () => {
    test("invariant 2: the fee is the ledger's, never the form's", () => {
        expect(sendPlan(request({ to: "abc" }), eth, 10n ** 19n)).toMatchObject({
            fee: 2_000_000_000_000n,
        });
        expect(pendingTransfer(eth, "u1", 1n).feeE8s).toBe(2_000_000_000_000n);
    });

    test("invariant 3: a person gets a transfer in their DM; an address a withdrawal, over the network the form chose", () => {
        expect(sendPlan(request({ userId: "u1", to: "u1" }), chat, 10n ** 10n)).toEqual({
            kind: "transfer",
            userId: "u1",
            amount: 150_000_000n,
        });
        expect(sendPlan(request({ to: "abc" }), chat, 10n ** 10n)).toMatchObject({
            kind: "withdraw",
            to: "abc",
            route: { kind: "ledger" },
        });
        expect(
            sendPlan(request({ to: "bc1", network: "btc" }), chat, 10n ** 10n, btc),
        ).toMatchObject({
            kind: "withdraw",
            route: { kind: "btc" },
            amount: 150_000_000n + 5_000n,
        });
    });

    test("a Bitcoin send waits for the minter's fee, and stops under its minimum", () => {
        expect(sendPlan(request({ to: "bc1", network: "btc" }), chat, 10n ** 10n)).toBeUndefined();
        expect(
            sendPlan(
                request({ amountText: "0.00001", to: "bc1", network: "btc" }),
                chat,
                10n ** 10n,
                {
                    fee: 5_000n,
                    minimum: 50_000n,
                },
            ),
        ).toEqual({ kind: "too_small", minimum: 50_000n });
    });

    test("a send under ten fees is refused, as the old wallets do", () => {
        expect(
            sendPlan(request({ amountText: "0.00999999", to: "abc" }), chat, 10n ** 10n),
        ).toEqual({
            kind: "too_small",
            minimum: 1_000_000n,
        });
        expect(
            sendPlan(request({ amountText: "0.000001", userId: "u1" }), chat, 10n ** 10n),
        ).toEqual({ kind: "too_small", minimum: 1_000_000n });
        expect(
            sendPlan(request({ amountText: "0.01", to: "abc" }), chat, 10n ** 10n),
        ).toMatchObject({
            kind: "withdraw",
            amount: 1_000_000n,
        });
    });

    test("a Bitcoin address only over Bitcoin's own network: the ledger can't send there", () => {
        const bitcoin = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
        expect(
            sendPlan(request({ to: bitcoin, network: "ckbtc" }), chat, 10n ** 10n, btc),
        ).toBeUndefined();
        expect(
            sendPlan(request({ to: bitcoin, network: "btc" }), chat, 10n ** 10n, btc),
        ).toMatchObject({
            route: { kind: "btc" },
        });
    });

    test("what Send shows on top: a fee to an address, the approval too for a person, and the minter's fee to Bitcoin", () => {
        expect(sendCost(chat, "address")).toBe(100_000n);
        expect(sendCost(chat, "person")).toBe(200_000n);
        expect(sendCost(chat, "btc", btc)).toBe(205_000n);
    });
});

describe("the addresses a send accepts", () => {
    const ctx = {
        ownAccounts: ["aaaaa-aa"],
        isUserIdAccount: (a: string) => a === "user-id-account",
    };
    const principal = "ryjl3-tyaaa-aaaaa-aaaba-cai";
    const accountId = "517a929e03de7038888d2cf7370ab7bf605405ce5795efa87464ec0e7a03beaa";

    test("an IC account for any token; an ICP account identifier only for ICP; never the user's own or a user id's", () => {
        expect(acceptsAddress(principal, sendNetworks("CHAT"), ctx)).toBe(true);
        expect(acceptsAddress(accountId, sendNetworks("CHAT"), ctx)).toBe(false);
        expect(acceptsAddress(accountId, sendNetworks("ICP"), ctx)).toBe(true);
        expect(acceptsAddress("aaaaa-aa", sendNetworks("CHAT"), ctx)).toBe(false);
        expect(
            acceptsAddress("user-id-account", sendNetworks("CHAT"), {
                ...ctx,
                isUserIdAccount: () => true,
            }),
        ).toBe(false);
    });
});

describe("the user's own wallet", () => {
    test("for ICP, both its account identifier and its ICRC account; for another token, the ICRC account", () => {
        const owner = {
            cryptoAccount: "icp-account-identifier",
            userId: "qp43m-xeaaa-aaaaa-qaama-daa",
            principal: () => "2vxsx-fae",
        };
        const icrc = userWalletAddress(owner.userId, owner.principal);
        expect(ownAccounts("ICP", owner)).toEqual(["icp-account-identifier", icrc]);
        expect(ownAccounts("CHAT", owner)).toEqual([icrc]);
    });
});

describe("what Send hears", () => {
    test("invariant 5: a dismissed or refused PIN sends nothing and never reads as sent", () => {
        expect(sendAnswer({ kind: "sent" })).toEqual({ kind: "sent" });
        expect(sendAnswer({ kind: "cancelled" })).toEqual({ kind: "not_sent" });
        expect(sendAnswer({ kind: "pin_failed" })).toEqual({ kind: "failed", reason: "pin" });
        const message = i18nKey("cryptoAccount.sendFailed");
        expect(sendAnswer({ kind: "failed", message })).toEqual({
            kind: "failed",
            reason: message,
        });
    });
});
