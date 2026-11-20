import { i18nKey, OPENCHAT_BOT_USER_ID } from "@client";
import { reminderConfirmationRoute, reminderSetText, type ReminderTimeFormat } from "./reminderSet";

const format: ReminderTimeFormat = {
    time: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`,
    date: (d) => `${d.getDate()}/${d.getMonth() + 1}`,
};

// local times, so the day boundaries are the device's
const at = (day: number, hours: number, minutes = 0) =>
    new Date(2026, 10, day, hours, minutes).getTime();

describe("reminderSetText", () => {
    const now = at(19, 14, 12);

    test("later today says today and the time", () => {
        expect(reminderSetText(at(19, 14, 32), now, format)).toEqual(
            i18nKey("reminders.setToday", { time: "14:32" }),
        );
    });

    test("just before midnight is still today", () => {
        expect(reminderSetText(at(19, 23, 59), now, format)).toEqual(
            i18nKey("reminders.setToday", { time: "23:59" }),
        );
    });

    test("the next calendar day says tomorrow, even less than a day away", () => {
        expect(reminderSetText(at(20, 9), now, format)).toEqual(
            i18nKey("reminders.setTomorrow", { time: "9:00" }),
        );
        expect(reminderSetText(at(20, 0, 5), at(19, 23, 50), format)).toEqual(
            i18nKey("reminders.setTomorrow", { time: "0:05" }),
        );
    });

    test("after tomorrow says the date and the time", () => {
        expect(reminderSetText(at(23, 9), now, format)).toEqual(
            i18nKey("reminders.setOn", { date: "23/11", time: "9:00" }),
        );
    });

    test("across a month's end", () => {
        expect(reminderSetText(new Date(2026, 11, 1, 9).getTime(), at(30, 20), format)).toEqual(
            i18nKey("reminders.setTomorrow", { time: "9:00" }),
        );
    });

    test("a time on an earlier day than now (set across midnight) says today, not a date", () => {
        expect(reminderSetText(at(19, 23, 59), at(20, 0, 1), format)).toEqual(
            i18nKey("reminders.setToday", { time: "23:59" }),
        );
    });
});

describe("reminderConfirmationRoute", () => {
    const dm = `/chats/user/${OPENCHAT_BOT_USER_ID}`;

    test("opens the bot's DM at its latest message, not its first unread", () => {
        expect(reminderConfirmationRoute({ latestMessage: { event: { messageIndex: 41 } } })).toBe(
            `${dm}/41`,
        );
    });

    test("opens the DM as a chat while it has no message, or isn't in the chat list yet", () => {
        expect(reminderConfirmationRoute({})).toBe(dm);
        expect(reminderConfirmationRoute(undefined)).toBe(dm);
    });
});
