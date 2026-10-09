import { ErrorCode } from "@client";
import { describe, expect, test } from "vitest";
import { swapFromWalletOutcome } from "./tokenSwap";

describe("swapFromWalletOutcome", () => {
    test("a swap which went ahead succeeded", () => {
        expect(swapFromWalletOutcome({ kind: "success", amountOut: 10n })).toBe("success");
    });

    test("a wallet which can't cover the swap has insufficient funds", () => {
        expect(
            swapFromWalletOutcome({
                kind: "error",
                code: ErrorCode.InsufficientFunds,
                message: undefined,
            }),
        ).toBe("insufficientFunds");
    });

    test("a swap the DEX refused is down to the rate changing", () => {
        expect(
            swapFromWalletOutcome({
                kind: "error",
                code: ErrorCode.SwapFailed,
                message: "slippage",
            }),
        ).toBe("rateChanged");
    });

    test("anything else is an error", () => {
        expect(
            swapFromWalletOutcome({ kind: "error", code: ErrorCode.Unknown, message: "timed out" }),
        ).toBe("error");
        expect(
            swapFromWalletOutcome({
                kind: "error",
                code: ErrorCode.PinIncorrect,
                message: undefined,
            }),
        ).toBe("error");
    });
});
