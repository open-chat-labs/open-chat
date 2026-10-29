import { describe, expect, test } from "vitest";
import { pinFailureNeedsWait } from "./pinNumber";

describe("a PIN failure", () => {
    test("means waiting after too many wrong PINs, or a wrong PIN whose next try is to come", () => {
        const now = 1_000_000;
        expect(pinFailureNeedsWait(undefined, now)).toBe(false);
        expect(pinFailureNeedsWait({ kind: "pin_required" }, now)).toBe(false);
        expect(
            pinFailureNeedsWait({ kind: "too_main_failed_pin_attempts", nextRetryAt: 0n }, now),
        ).toBe(true);
        expect(pinFailureNeedsWait({ kind: "pin_incorrect", nextRetryAt: 2_000_000n }, now)).toBe(
            true,
        );
        expect(pinFailureNeedsWait({ kind: "pin_incorrect", nextRetryAt: 500n }, now)).toBe(false);
    });
});
