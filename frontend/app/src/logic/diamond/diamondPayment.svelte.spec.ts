import {
    ErrorCode,
    type DiamondMembershipFees,
    type PayForDiamondMembershipResponse,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    DiamondPayment,
    diamondPriceE8s,
    insufficientFunds,
    membershipEnd,
    recurring,
    walletCostE8s,
} from "./diamondPayment.svelte";

const E8S = 100_000_000n;
const FEES: DiamondMembershipFees[] = [
    {
        token: "CHAT",
        oneMonth: 15n * E8S,
        threeMonths: 35n * E8S,
        oneYear: 100n * E8S,
        lifetime: 400n * E8S,
    },
    { token: "ICP", oneMonth: E8S, threeMonths: 2n * E8S, oneYear: 7n * E8S, lifetime: 25n * E8S },
];
const DAY = 24 * 60 * 60 * 1000;

function fakeClient(answer: () => Promise<PayForDiamondMembershipResponse>) {
    return {
        diamondMembershipFees: vi.fn(async () => FEES),
        payForDiamondMembership: vi.fn(answer),
    };
}

async function loaded(answer: () => Promise<PayForDiamondMembershipResponse>) {
    const client = fakeClient(answer);
    const payment = new DiamondPayment(client);
    await payment.loadFees();
    return { client, payment };
}

const success = async (): Promise<PayForDiamondMembershipResponse> => ({
    kind: "success",
    status: { kind: "lifetime" },
    proof: "proof",
});

describe("paying for Diamond", () => {
    test("invariant 1: the expected price sent is the backend's fee for the chosen token and duration", async () => {
        const { client, payment } = await loaded(success);
        await payment.pay({
            ledger: "icp-ledger",
            token: "ICP",
            duration: "one_year",
            autoRenew: true,
        });
        expect(client.payForDiamondMembership).toHaveBeenCalledWith(
            "icp-ledger",
            "one_year",
            true,
            7n * E8S,
            undefined,
        );
        expect(diamondPriceE8s(FEES, "CHAT", "three_months")).toBe(35n * E8S);
        // a token the backend doesn't price can't be paid in
        expect(diamondPriceE8s(FEES, "ckBTC", "one_month")).toBeUndefined();
    });

    test("invariant 2: recurring is false for lifetime, whatever auto-renew says", async () => {
        expect(recurring(true, "lifetime")).toBe(false);
        expect(recurring(true, "one_month")).toBe(true);
        expect(recurring(false, "one_month")).toBe(false);
        const { client, payment } = await loaded(success);
        await payment.pay({
            ledger: "chat-ledger",
            token: "CHAT",
            duration: "lifetime",
            autoRenew: true,
        });
        expect(client.payForDiamondMembership).toHaveBeenCalledWith(
            "chat-ledger",
            "lifetime",
            false,
            400n * E8S,
            undefined,
        );
    });

    test("invariant 3: insufficient funds whenever price plus approval fee passes the balance by 1 e8, and never for an external wallet", () => {
        const price = 15n * E8S;
        const fee = 100_000n;
        expect(walletCostE8s(price, fee)).toBe(price + fee);
        expect(insufficientFunds(price, fee, price + fee, false)).toBe(false);
        expect(insufficientFunds(price, fee, price + fee - 1n, false)).toBe(true);
        expect(insufficientFunds(price, fee, 0n, true)).toBe(false);
    });

    test("invariant 4: a dismissed PIN prompt is cancelled, and a PIN failure gives the PIN message, not payment failed", async () => {
        const dismissed = await loaded(() => Promise.reject("cancelled"));
        expect(
            await dismissed.payment.pay({
                ledger: "l",
                token: "CHAT",
                duration: "one_month",
                autoRenew: true,
            }),
        ).toEqual({ kind: "cancelled" });

        const wrongPin = await loaded(async () => ({
            kind: "error",
            code: ErrorCode.PinIncorrect,
            message: "0",
        }));
        const outcome = await wrongPin.payment.pay({
            ledger: "l",
            token: "CHAT",
            duration: "one_month",
            autoRenew: true,
        });
        expect(outcome.kind).toBe("failed");
        expect(outcome.kind === "failed" && outcome.message.key).not.toBe("upgrade.paymentFailed");
    });

    test("any other failure says the payment failed", async () => {
        const { payment } = await loaded(async () => ({ kind: "price_mismatch" }));
        const outcome = await payment.pay({
            ledger: "l",
            token: "CHAT",
            duration: "one_month",
            autoRenew: false,
        });
        expect(outcome.kind === "failed" && outcome.message.key).toBe("upgrade.paymentFailed");
    });

    test("a success hands back the proof, and the payment may be made again after", async () => {
        const { payment } = await loaded(success);
        expect(
            await payment.pay({
                ledger: "l",
                token: "CHAT",
                duration: "one_month",
                autoRenew: true,
            }),
        ).toEqual({ kind: "success", proof: "proof" });
        expect(payment.paying).toBe(false);
    });
});

describe("a membership's end", () => {
    const now = Date.UTC(2026, 9, 25);

    test("extends from the current membership's end while it runs, else from now", () => {
        const expiresAt = now + 10 * DAY;
        expect(membershipEnd("one_month", now, expiresAt)).toBeGreaterThan(expiresAt);
        expect(membershipEnd("one_month", now, expiresAt)! - expiresAt).toBe(
            membershipEnd("one_month", now)! - now,
        );
        // a membership that has run out: from now
        expect(membershipEnd("one_month", now, now - DAY)).toBe(membershipEnd("one_month", now));
    });

    test("never comes for lifetime", () => {
        expect(membershipEnd("lifetime", now)).toBeUndefined();
    });
});
