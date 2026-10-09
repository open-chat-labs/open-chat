import { describe, expect, test } from "vitest";
import { quoteResponse, swapResponse, unusedBalancesResponse, withdrawResponse } from "./mappers";

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

    test("a pool that cannot fill the swap (price at range edge, or input over its maximum) is a decline (the payloads behind Rollbar #31905)", () => {
        expect(
            quoteResponse({ err: { InternalError: 'preswap "price limit out of bound"' } }),
        ).toBeUndefined();
        expect(
            quoteResponse({
                err: { InternalError: "The maximum amount of input tokens is 38_248_330" },
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
    test("ok is a success with what reaches the wallet, after the output token's fee", () => {
        expect(swapResponse({ ok: 123n }, 10n)).toEqual({ kind: "success", amountOut: 113n });
        expect(swapResponse({ ok: 10n }, 10n)).toEqual({ kind: "success", amountOut: 0n });
    });

    test("err is an error rather than a throw, since the swap was made and declined", () => {
        expect(swapResponse({ err: { InternalError: "Slippage check failed" } }, 10n)).toEqual({
            kind: "error",
            error: '{"InternalError":"Slippage check failed"}',
        });
    });
});

describe("ICPSwap unusedBalancesResponse", () => {
    test("each balance is given with the ledger of the pool's token it is of", () => {
        expect(
            unusedBalancesResponse({ ok: { balance0: 5n, balance1: 7n } }, "token0", "token1"),
        ).toEqual([
            { ledger: "token0", balance: 5n },
            { ledger: "token1", balance: 7n },
        ]);
    });

    test("an error is thrown, so that the swap is left to be recovered next time", () => {
        expect(() =>
            unusedBalancesResponse({ err: { InternalError: "busy" } }, "token0", "token1"),
        ).toThrow();
    });
});

describe("ICPSwap withdrawResponse", () => {
    test("a withdrawal the pool accepts succeeds", () => {
        expect(withdrawResponse({ ok: 5n })).toBe(true);
    });

    test("a withdrawal the pool refuses fails", () => {
        expect(withdrawResponse({ err: { InsufficientFunds: null } })).toBe(false);
    });
});
