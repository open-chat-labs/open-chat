import { ErrorCode } from "@shared";
import { describe, expect, test } from "vitest";
import { withdrawSolResponse } from "./mappers";

describe("withdrawSolResponse", () => {
    test("a queued withdrawal succeeds", () => {
        expect(withdrawSolResponse({ Ok: { block_index: 1n } })).toEqual({ kind: "success" });
    });

    test("a wallet without enough ckSOL is reported as insufficient funds", () => {
        expect(withdrawSolResponse({ Err: { InsufficientFunds: { balance: 5n } } })).toEqual({
            kind: "error",
            code: ErrorCode.InsufficientFunds,
            message: undefined,
        });
    });

    test("any other refusal is reported with the minter's error as its message", () => {
        expect(
            withdrawSolResponse({
                Err: {
                    ValueTooSmall: {
                        minimum_withdrawal_amount: 2_000_000n,
                        withdrawal_amount: 1_000n,
                    },
                },
            }),
        ).toEqual({
            kind: "error",
            code: ErrorCode.Unknown,
            message:
                '{"ValueTooSmall":{"minimum_withdrawal_amount":"2000000","withdrawal_amount":"1000"}}',
        });
    });
});
