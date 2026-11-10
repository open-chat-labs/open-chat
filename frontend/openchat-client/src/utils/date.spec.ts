import { toLongDatetimeString } from "./date";

describe("a timeline event's date and time", () => {
    test("the long date, then the time on the 24-hour clock, in the user's locale", () => {
        expect(toLongDatetimeString(new Date(2026, 10, 10, 14, 5), "en-GB")).toBe(
            "Tuesday 10th Nov 2026 @ 14:05",
        );
        expect(toLongDatetimeString(new Date(2026, 10, 1, 9, 30), "en-GB")).toBe(
            "Sunday 1st Nov 2026 @ 09:30",
        );
    });
});
