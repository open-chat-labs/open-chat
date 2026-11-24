import { BTC_SYMBOL, walletApprovalFee } from "@client";
import { describe, expect, test } from "vitest";
import {
    addressParts,
    cleanAmount,
    plainUnits,
    quickAmount,
    recipientSheet,
    sendAvailable,
    sendCheck,
    sendNetwork,
    sendRoute,
    swapCheck,
    swapRate,
    type FlowToken,
    type SendTo,
} from "./flows.adapter";

const icp: FlowToken = { symbol: "ICP", decimals: 8, transferFee: 10_000n, balance: 100_000_000n };
const btc: FlowToken = { symbol: BTC_SYMBOL, decimals: 8, transferFee: 10n, balance: 1_000_000n };
const julian: SendTo = { kind: "person", userId: "u1", name: "Julian", handle: "@julian" };
const principal: SendTo = { kind: "address", address: "2vxsx-fae" };
const bitcoin: SendTo = { kind: "address", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" };

describe("Receive's address", () => {
    test("the middle dimmed between the first and last six", () => {
        expect(addressParts("abcdef123456789uvwxyz")).toEqual({
            head: "abcdef",
            middle: "123456789",
            tail: "uvwxyz",
        });
    });

    test("a short one isn't split", () => {
        expect(addressParts("abc")).toEqual({ head: "abc", middle: "", tail: "" });
    });
});

describe("amounts in ledger units", () => {
    test("as plain decimals, exactly", () => {
        expect(plainUnits(150_000_000n, 8)).toBe("1.5");
        expect(plainUnits(1n, 8)).toBe("0.00000001");
        expect(plainUnits(0n, 8)).toBe("0");
        expect(plainUnits(12n, 0)).toBe("12");
    });

    test("typed: digits and one point (a comma is one), no more decimals than the token has", () => {
        expect(cleanAmount("1,5", 8)).toBe("1.5");
        expect(cleanAmount("1.2.3", 8)).toBe("1.23");
        expect(cleanAmount("a1b2", 8)).toBe("12");
        expect(cleanAmount("0.123456789", 8)).toBe("0.12345678");
        expect(cleanAmount(".", 8)).toBe(".");
    });

    test("quick picks round down to a unit; Max is all of it", () => {
        expect(quickAmount(99_990_000n, 25, 8)).toBe("0.249975");
        expect(quickAmount(3n, 50, 8)).toBe("0.00000001");
        expect(quickAmount(99_990_000n, 100, 8)).toBe("0.9999");
        expect(quickAmount(-5n, 75, 8)).toBe("0");
    });
});

describe("Send's route", () => {
    test("a person is a transfer in the DM; BTC to a Bitcoin address goes over Bitcoin's own", () => {
        expect(sendRoute("ICP", julian)).toBe("person");
        expect(sendRoute("ICP", principal)).toBe("address");
        expect(sendRoute(BTC_SYMBOL, bitcoin)).toBe("btc");
        expect(sendRoute(BTC_SYMBOL, principal)).toBe("address");
        expect(sendNetwork("btc")).toBe("btc");
        expect(sendNetwork("person")).toBe("ledger");
    });
});

describe("the recipient sheet", () => {
    const people = [
        { userId: "u1", name: "Julian", handle: "@julian" },
        { userId: "u2", name: "Lucy", handle: "@lucy" },
    ];
    const saved = [{ id: "a", name: "Cold storage", address: "2vxsx-fae" }];
    const takes = (a: string) => a === "2vxsx-fae" || a === "aaaaa-aa";

    test("everyone with no search: the saved addresses and the people", () => {
        expect(recipientSheet("", people, saved, takes)).toEqual({
            address: undefined,
            saved,
            people,
        });
    });

    test("a search narrows both; an address the token takes is offered itself", () => {
        expect(recipientSheet("@lu", people, saved, takes).people.map((p) => p.name)).toEqual([
            "Lucy",
        ]);
        expect(recipientSheet("cold", people, saved, takes).saved).toEqual(saved);
        const typed = recipientSheet(" aaaaa-aa ", people, saved, takes);
        expect(typed.address).toBe("aaaaa-aa");
        expect(typed.people).toEqual([]);
        expect(recipientSheet("not-an-address", people, saved, takes).address).toBeUndefined();
    });
});

describe("Send's button", () => {
    const check = (over: Partial<Parameters<typeof sendCheck>[0]>) =>
        sendCheck({ token: icp, to: julian, amountText: "", max: false, btc: undefined, ...over });

    test("asks for what's missing, in order", () => {
        expect(check({ token: undefined }).cta).toEqual({ kind: "choose_token" });
        expect(check({ to: undefined }).cta).toEqual({ kind: "choose_recipient" });
        expect(check({ amountText: "" }).cta).toEqual({ kind: "enter_amount" });
        expect(check({ amountText: "0" }).cta).toEqual({ kind: "enter_amount" });
    });

    test("a person costs the fee and the approval; the total is what leaves", () => {
        const fee = 10_000n + walletApprovalFee(10_000n);
        expect(check({ amountText: "0.5" })).toEqual({
            cta: { kind: "send", amount: 50_000_000n },
            fee,
            total: 50_000_000n + fee,
        });
    });

    test("an address costs one fee", () => {
        expect(check({ to: principal, amountText: "0.5" }).fee).toBe(10_000n);
    });

    test("more than the balance, the fee included, can't go", () => {
        expect(check({ to: principal, amountText: "1" }).cta).toEqual({ kind: "over_balance" });
    });

    test("Max is the balance less the fee, exactly", () => {
        expect(check({ to: principal, max: true }).cta).toEqual({
            kind: "send",
            amount: 99_990_000n,
        });
        expect(sendAvailable(icp, "address")).toBe(99_990_000n);
    });

    test("under ten fees to a person can't go (the in-chat transfer's minimum)", () => {
        expect(check({ amountText: "0.0009" }).cta).toEqual({
            kind: "too_small",
            minimum: 100_000n,
        });
        expect(check({ to: principal, amountText: "0.0009" }).cta.kind).toBe("send");
    });

    test("BTC to a Bitcoin address waits for the minter, then pays its fee and keeps its minimum", () => {
        const minter = { fee: 1_000n, minimum: 50_000n };
        expect(check({ token: btc, to: bitcoin, amountText: "0.001" }).cta).toEqual({
            kind: "waiting_fee",
        });
        const ok = check({ token: btc, to: bitcoin, amountText: "0.001", btc: minter });
        expect(ok.cta).toEqual({ kind: "send", amount: 100_000n });
        expect(ok.fee).toBe(10n + walletApprovalFee(10n) + 1_000n);
        expect(check({ token: btc, to: bitcoin, amountText: "0.0001", btc: minter }).cta).toEqual({
            kind: "too_small",
            minimum: 49_000n,
        });
    });
});

describe("Swap's button", () => {
    const check = (over: Partial<Parameters<typeof swapCheck>[0]>) =>
        swapCheck({
            from: icp,
            toChosen: true,
            amountText: "0.5",
            restricted: false,
            quoting: false,
            quoted: false,
            warning: false,
            warningConfirmed: false,
            ...over,
        });

    test("never offers a quote where swapping is restricted", () => {
        expect(check({ restricted: true })).toEqual({ kind: "restricted" });
    });

    test("asks for the tokens and an amount", () => {
        expect(check({ from: undefined })).toEqual({ kind: "choose_tokens" });
        expect(check({ toChosen: false })).toEqual({ kind: "choose_tokens" });
        expect(check({ amountText: "" })).toEqual({ kind: "enter_amount" });
    });

    test("the amount is all that leaves: the whole balance may go, more may not", () => {
        expect(check({ amountText: "1" })).toEqual({ kind: "get_quote" });
        expect(check({ amountText: "1.00000001" })).toEqual({ kind: "over_balance" });
    });

    test("three fees or less is too little to swap", () => {
        expect(check({ amountText: "0.0003" })).toEqual({ kind: "too_small", minimum: 30_000n });
        expect(check({ amountText: "0.00030001" })).toEqual({ kind: "get_quote" });
    });

    test("quote, then swap; a value warning waits to be confirmed", () => {
        expect(check({ quoting: true })).toEqual({ kind: "getting_quote" });
        expect(check({ quoted: true })).toEqual({ kind: "swap" });
        expect(check({ quoted: true, warning: true })).toEqual({ kind: "confirm_warning" });
        expect(check({ quoted: true, warning: true, warningConfirmed: true })).toEqual({
            kind: "swap",
        });
    });

    test("the rate is per whole token in", () => {
        expect(swapRate(100_000_000n, 8, 5_000_000_000n, 8)).toBe(50);
        expect(swapRate(0n, 8, 1n, 8)).toBe(0);
    });
});
