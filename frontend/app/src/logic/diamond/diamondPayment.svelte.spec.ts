import {
    ErrorCode,
    type DiamondMembershipFees,
    type PayForDiamondMembershipResponse,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    approvalFeeE8s,
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
        expect(outcome).toEqual({ kind: "pin_failed" });
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

describe("the Diamond payment's edges", () => {
    test("a second payment while one is under way is ignored, not a failure", async () => {
        let finish!: (r: PayForDiamondMembershipResponse) => void;
        const { client, payment } = await loaded(
            () => new Promise((resolve) => (finish = resolve)),
        );
        const first = payment.pay({
            ledger: "l",
            token: "CHAT",
            duration: "one_month",
            autoRenew: true,
        });
        expect(
            await payment.pay({
                ledger: "l",
                token: "CHAT",
                duration: "one_month",
                autoRenew: true,
            }),
        ).toEqual({ kind: "already_paying" });
        finish({ kind: "success", status: { kind: "lifetime" }, proof: "p" });
        expect(await first).toEqual({ kind: "success", proof: "p" });
        expect(client.payForDiamondMembership).toHaveBeenCalledTimes(1);
    });

    test("a payment that throws fails with its cause, for the view to pass on", async () => {
        const cause = new Error("agent down");
        const { payment } = await loaded(() => Promise.reject(cause));
        const outcome = await payment.pay({
            ledger: "l",
            token: "CHAT",
            duration: "one_month",
            autoRenew: true,
        });
        expect(outcome).toMatchObject({ kind: "failed", cause });
    });

    test("fees that fail to load are the state's to show, never a rejection", async () => {
        const client = fakeClient(success);
        client.diamondMembershipFees.mockRejectedValueOnce(new Error("offline"));
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const payment = new DiamondPayment(client);
        await expect(payment.loadFees()).resolves.toBeUndefined();
        expect(payment.feesState).toEqual({ kind: "failed" });
        expect(payment.fees).toBeUndefined();
        await payment.loadFees();
        expect(payment.feesState.kind).toBe("loaded");
    });

    test("the approval fee is the wallet's approval, part of what the wallet pays", () => {
        expect(approvalFeeE8s(100_000n)).toBe(100_000n);
        expect(walletCostE8s(E8S, 100_000n)).toBe(E8S + approvalFeeE8s(100_000n));
    });
});
