import { i18nKey, type SwapQuote } from "@client";
import { amountUnits } from "@src/logic/wallet/walletSend";
import { describe, expect, test } from "vitest";
import { dexQuoteRows, swapAnswer, swapQuoteView, swapStepIndex } from "./swap.adapter";

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
    test("each DEX's answer by name: its output, or why there's none", () => {
        expect(
            dexQuoteRows(
                [
                    ["icpswap", { kind: "quoting" }],
                    ["taco", { kind: "quoted", amountOut: 150_000_000n }],
                ],
                8,
            ),
        ).toEqual([
            { dex: "ICPSwap", state: "quoting" },
            { dex: "TACO", state: "quoted", out: 1.5 },
        ]);
        expect(
            dexQuoteRows(
                [
                    ["icpswap", { kind: "unsupported" }],
                    ["taco", { kind: "failed" }],
                ],
                8,
            ).map((r) => r.state),
        ).toEqual(["none", "failed"]);
    });

    test("the best quote, no expiry, and a value warning in the app's words", () => {
        const words = (key: string) => key;
        expect(swapQuoteView(quote, [], 8, words)).toMatchObject({
            dex: "TACO",
            out: 50,
            warning: undefined,
        });
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
