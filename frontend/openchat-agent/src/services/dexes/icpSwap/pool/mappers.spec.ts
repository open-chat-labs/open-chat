import { describe, expect, test } from "vitest";
import { quoteResponse } from "./mappers";

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
