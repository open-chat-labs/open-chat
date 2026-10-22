import { currentStreak } from "./chit";

describe("the current streak", () => {
    test("is the streak until it ends", () => {
        expect(currentStreak({ streak: 7, streakEnds: 2000n }, 1000)).toBe(7);
    });

    test("is none once it has ended", () => {
        expect(currentStreak({ streak: 7, streakEnds: 2000n }, 3000)).toBe(0);
    });
});
