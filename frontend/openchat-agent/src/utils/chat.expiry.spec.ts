import { describe, expect, test } from "vitest";
import { isExpired } from "./chat";

describe("isExpired", () => {
    const now = Date.UTC(2026, 8, 18);

    test("an event with no expiry never expires", () => {
        expect(isExpired({ expiresAt: undefined }, now)).toBe(false);
    });

    test("an event whose expiry has passed is expired", () => {
        expect(isExpired({ expiresAt: now - 1 }, now)).toBe(true);
    });

    test("an event whose expiry is in the future is not expired", () => {
        expect(isExpired({ expiresAt: now + 1 }, now)).toBe(false);
    });

    test("an event expiring exactly now is not yet expired", () => {
        expect(isExpired({ expiresAt: now }, now)).toBe(false);
    });

    test("a past epoch-millis expiry is expired against wall-clock time", () => {
        // Regression: comparing against performance.now() (ms since page load) meant an
        // epoch-millis expiry was never considered to have passed
        expect(isExpired({ expiresAt: Date.now() - 60_000 }, Date.now())).toBe(true);
    });
});
