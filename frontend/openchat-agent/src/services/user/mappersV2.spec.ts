import { describe, expect, test } from "vitest";
import { withdrawCryptoResponse } from "./mappersV2";

describe("withdrawCryptoResponse", () => {
    // Invariant: every variant of the canister's withdraw_crypto_v2 response maps to a value.
    // The Error variant used to fall through to "Unexpected ApiWithdrawCryptocurrencyResponse
    // type received", so a declined withdrawal surfaced as a crash (Rollbar #31567).
    test("maps the Error variant to an OCError", () => {
        expect(withdrawCryptoResponse({ Error: [1234, "insufficient funds"] })).toEqual({
            kind: "error",
            code: 1234,
            message: "insufficient funds",
        });
    });

    test("still rejects a shape it does not know", () => {
        expect(() => withdrawCryptoResponse({} as never)).toThrow(
            "Unexpected ApiWithdrawCryptocurrencyResponse type received",
        );
    });
});
