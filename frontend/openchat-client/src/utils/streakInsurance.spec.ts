import { CHAT_E8S, streakInsuranceDayPrice, streakInsurancePrice } from "./streakInsurance";

describe("what streak insurance costs", () => {
    test("each day twice the one before, by the days bought so far", () => {
        expect([0, 1, 2, 5].map(streakInsuranceDayPrice)).toEqual(
            [1n, 2n, 4n, 32n].map((chat) => chat * CHAT_E8S),
        );
    });

    test("several days, the sum of theirs", () => {
        expect(streakInsurancePrice(0, 1)).toBe(1n * CHAT_E8S);
        expect(streakInsurancePrice(0, 3)).toBe((1n + 2n + 4n) * CHAT_E8S);
        // three bought already: the next two are the 4th and 5th
        expect(streakInsurancePrice(3, 2)).toBe((8n + 16n) * CHAT_E8S);
        expect(streakInsurancePrice(5, 0)).toBe(0n);
    });
});
