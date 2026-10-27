import { formatClock } from "./time";

describe("formatClock", () => {
    test("rounds to the second before splitting minutes from seconds", () => {
        expect(formatClock(0)).toBe("0:00");
        expect(formatClock(59.6)).toBe("1:00");
        expect(formatClock(125.2)).toBe("2:05");
    });
});
