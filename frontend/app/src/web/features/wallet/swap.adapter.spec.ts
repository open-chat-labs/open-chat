import { i18nKey, type SwapQuote } from "@client";
import { amountUnits } from "@src/logic/wallet/walletSend";
import { describe, expect, test } from "vitest";
import { dexesChecked, swapAnswer, swapQuoteView, swapStepIndex } from "./swap.adapter";

const quote: SwapQuote = {
    ledgerIn: "icp",
    ledgerOut: "chat",
    dex: "taco",
    amountIn: 100_000_000n,
    amountOut: 5_000_000_000n,
    valueWarning: undefined,
    values: { tokenIn: "ICP" },
};

describe("a swap's quote as Swap shows it", () => {
    test("the DEXes checked: every one asked that swaps the pair, answered or not", () => {
        expect(
            dexesChecked([
                ["icpswap", { kind: "declined" }],
                ["taco", { kind: "failed" }],
            ]),
        ).toBe(2);
        expect(
            dexesChecked([
                ["icpswap", { kind: "quoted", amountOut: 1n }],
                ["taco", { kind: "unsupported" }],
            ]),
        ).toBe(1);
        expect(dexesChecked([])).toBe(0);
    });

    test("the best quote, no expiry, and a value warning in the app's words", () => {
        const words = (key: string) => key;
        expect(swapQuoteView(quote, [], 8, words)).toMatchObject({
            dex: "TACO",
            out: 50,
            checked: 0,
            warning: undefined,
        });
        expect(
            swapQuoteView(
                quote,
                [
                    ["icpswap", { kind: "quoted", amountOut: 1n }],
                    ["taco", { kind: "quoted", amountOut: 5_000_000_000n }],
                ],
                8,
                words,
            ).checked,
        ).toBe(2);
        expect(swapQuoteView(quote, [], 8, words).expiresAt).toBeUndefined();
        expect(swapQuoteView({ ...quote, valueWarning: "dropped" }, [], 8, words).warning).toBe(
            "tokenSwap.warningValueDropped",
        );
    });

    test("6c invariant 4: the amount handed over becomes the base units quoted, without float rounding", () => {
        expect(amountUnits("0.3", 8)).toBe(30_000_000n);
        expect(amountUnits("123456.123456789012345678", 18)).toBe(123_456_123_456_789_012_345_678n);
    });
});

describe("a swap as it runs", () => {
    test("the client's steps are Swap's: approve, swap, withdraw", () => {
        expect(swapStepIndex({ step: "approve" })).toBe(0);
        expect(swapStepIndex({ step: "swap" })).toBe(1);
        expect(swapStepIndex({ step: "withdraw", amountOut: 1n })).toBe(2);
    });

    test("a dismissed PIN sends nothing and says nothing; a refusal says why", () => {
        expect(swapAnswer({ kind: "swapped", amountOut: 250_000_000n }, 8)).toEqual({
            kind: "swapped",
            out: 2.5,
        });
        expect(swapAnswer({ kind: "cancelled" }, 8)).toEqual({ kind: "not_sent" });
        const message = i18nKey("tokenSwap.progress.failed");
        expect(swapAnswer({ kind: "rate_changed", message }, 8)).toEqual({
            kind: "failed",
            message,
        });
    });
});
