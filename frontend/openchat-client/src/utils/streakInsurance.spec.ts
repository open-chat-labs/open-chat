import { STREAK_INSURANCE_MAX_DAYS, streakInsurancePrice } from "./streakInsurance";

const CHAT = 100_000_000n;

describe("what streak insurance costs", () => {
    test("doubles with each day, by the days bought so far", () => {
        expect(streakInsurancePrice(0, 1)).toBe(1n * CHAT);
        expect(streakInsurancePrice(0, 3)).toBe((1n + 2n + 4n) * CHAT);
        // three bought already: the next two are the 4th and 5th
        expect(streakInsurancePrice(3, 2)).toBe((8n + 16n) * CHAT);
        expect(streakInsurancePrice(5, 0)).toBe(0n);
    });

    test("caps cover at 30 days", () => {
        expect(STREAK_INSURANCE_MAX_DAYS).toBe(30);
    });
});
