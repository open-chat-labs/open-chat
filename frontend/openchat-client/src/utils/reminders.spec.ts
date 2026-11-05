import { REMINDER_PRESETS, reminderPresetText, reminderTime } from "./reminders";

// in the device's time zone, as the reminders are
const at = (y: number, m: number, d: number, h: number, min = 0) =>
    new Date(y, m - 1, d, h, min).getTime();

describe("a reminder's time", () => {
    // Wednesday 5 November 2026, 14:30
    const now = at(2026, 11, 5, 14, 30);

    test("is 20 minutes, an hour or three hours on", () => {
        expect(reminderTime("twentyMinutes", now)).toBe(at(2026, 11, 5, 14, 50));
        expect(reminderTime("oneHour", now)).toBe(at(2026, 11, 5, 15, 30));
        expect(reminderTime("threeHours", now)).toBe(at(2026, 11, 5, 17, 30));
    });

    test("is 9am tomorrow, across a month's end too", () => {
        expect(reminderTime("tomorrow", now)).toBe(at(2026, 11, 6, 9));
        expect(reminderTime("tomorrow", at(2026, 11, 30, 23))).toBe(at(2026, 12, 1, 9));
    });

    test("is 9am on the coming Monday for next week", () => {
        expect(reminderTime("nextWeek", now)).toBe(at(2026, 11, 9, 9));
        // a Sunday: the next day
        expect(reminderTime("nextWeek", at(2026, 11, 8, 20))).toBe(at(2026, 11, 9, 9));
        // a Monday: a week on, never earlier that day (which could be gone already)
        expect(reminderTime("nextWeek", at(2026, 11, 9, 8))).toBe(at(2026, 11, 16, 9));
    });

    test("presets are offered in the old dialog's order and words", () => {
        expect(REMINDER_PRESETS.map((p) => reminderPresetText(p).key)).toEqual([
            "reminders.twentyMinutes",
            "reminders.oneHour",
            "reminders.threeHours",
            "reminders.tomorrow",
            "reminders.nextWeek",
        ]);
    });
});
