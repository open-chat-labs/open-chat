import { APPROVAL_VALIDITY_MS } from "@shared";
import { describe, expect, test } from "vitest";
import { approvalToAdd } from "./approval";

const NOW_MS = 1_800_000_000_000;
const nanos = (ms: number) => BigInt(ms) * 1_000_000n;
const NOW = nanos(NOW_MS);
const DEFAULT_EXPIRY = nanos(NOW_MS + APPROVAL_VALIDITY_MS);

describe("approvalToAdd", () => {
    test("with no allowance, the amount is approved until the payment has had time to be pulled", () => {
        expect(
            approvalToAdd({ allowance: 0n, expiresAt: undefined }, 100n, NOW, APPROVAL_VALIDITY_MS),
        ).toEqual({
            amount: 100n,
            expectedAllowance: 0n,
            expiresAt: DEFAULT_EXPIRY,
        });
    });

    test("an allowance which lapses sooner than a payment pulled later is extended to cover it", () => {
        const validityMs = 7 * 24 * 60 * 60 * 1000;

        expect(
            approvalToAdd({ allowance: 50n, expiresAt: DEFAULT_EXPIRY }, 100n, NOW, validityMs),
        ).toEqual({
            amount: 150n,
            expectedAllowance: 50n,
            expiresAt: nanos(NOW_MS + validityMs),
        });
    });

    test("the amount is added to a standing allowance, which still never lapses", () => {
        expect(
            approvalToAdd(
                { allowance: 1_000n, expiresAt: undefined },
                100n,
                NOW,
                APPROVAL_VALIDITY_MS,
            ),
        ).toEqual({
            amount: 1_100n,
            expectedAllowance: 1_000n,
            expiresAt: undefined,
        });
    });

    test("an allowance which lapses later keeps its expiry", () => {
        const expiresAt = DEFAULT_EXPIRY + 1n;

        expect(
            approvalToAdd({ allowance: 50n, expiresAt }, 100n, NOW, APPROVAL_VALIDITY_MS),
        ).toEqual({
            amount: 150n,
            expectedAllowance: 50n,
            expiresAt,
        });
    });

    test("an allowance which lapses sooner is extended to cover the payment", () => {
        const expiresAt = nanos(NOW_MS + 1_000);

        expect(
            approvalToAdd({ allowance: 50n, expiresAt }, 100n, NOW, APPROVAL_VALIDITY_MS),
        ).toEqual({
            amount: 150n,
            expectedAllowance: 50n,
            expiresAt: DEFAULT_EXPIRY,
        });
    });
});
