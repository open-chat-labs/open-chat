import { describe, expect, test } from "vitest";
import { quoteResponse, swapResponse, unusedBalancesResponse } from "./mappers";

// A decline (undefined) is dropped by quoteSwap and costs nothing; a throw is retried by
// executeQuery seven times with backoff and, if every pool throws, reaches the error tracker.
// Which ICPSwap variants land on which side is therefore load-bearing.
describe("ICPSwap quoteResponse", () => {
    test("a quote is returned as is", () => {
        expect(quoteResponse({ ok: 123n })).toBe(123n);
    });

    test("InsufficientFunds and UnsupportedToken are declines", () => {
        expect(quoteResponse({ err: { InsufficientFunds: null } })).toBeUndefined();
        expect(quoteResponse({ err: { UnsupportedToken: "x" } })).toBeUndefined();
    });

    test("the dust-amount InternalError is a decline (the payload behind Rollbar #31881)", () => {
        expect(
            quoteResponse({
                err: { InternalError: "The amount of input token is too small." },
            }),
        ).toBeUndefined();
    });

    test("any other InternalError, and CommonError, still throw so they are retried", () => {
        expect(() => quoteResponse({ err: { InternalError: "pool is paused" } })).toThrow(
            /Unable to get quote/,
        );
        expect(() => quoteResponse({ err: { CommonError: null } })).toThrow(/Unable to get quote/);
    });
});

describe("ICPSwap swapResponse", () => {
    test("ok is a success with the amount out", () => {
        expect(swapResponse({ ok: 123n })).toEqual({ kind: "success", amountOut: 123n });
    });

    test("err is an error rather than a throw, since the swap was made and declined", () => {
        expect(swapResponse({ err: { InternalError: "Slippage check failed" } })).toEqual({
            kind: "error",
            error: '{"InternalError":"Slippage check failed"}',
        });
    });
});

describe("ICPSwap unusedBalancesResponse", () => {
    test("balances are keyed by each token's ledger", () => {
        expect(
            unusedBalancesResponse({ ok: { balance0: 1n, balance1: 2n } }, "ledger0", "ledger1"),
        ).toEqual({ ledger0: 1n, ledger1: 2n });
    });
});
