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

    test("an event expiring exactly now is not yet expired", () => {
        expect(isExpired({ expiresAt: now }, now)).toBe(false);
    });
});
