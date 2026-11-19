import { i18nKey, type ResourceKey } from "@client";

// What the toast says once a message reminder has been set: when it goes off. The OpenChat Bot's
// own confirmation lands in the user's DM with it, which the toast's View opens (the view's job).

/** How a time of day and a date are written in the user's locale (the client's formatters). */
export type ReminderTimeFormat = {
    /** "14:32" (`client.toShortTimeString`). */
    time: (date: Date) => string;
    /** The day, for a reminder after tomorrow (`client.toDateString`). */
    date: (date: Date) => string;
};

/**
 * "I'll remind you today at 14:32", "… tomorrow at 09:00" or "… on 24/11/2026 at 09:00": when a
 * reminder set at `now` (ms) goes off at `remindAt` (ms), by the device's calendar days.
 */
export function reminderSetText(
    remindAt: number,
    now: number,
    format: ReminderTimeFormat,
): ResourceKey {
    const at = new Date(remindAt);
    const time = format.time(at);
    switch (daysBetween(new Date(now), at)) {
        case 0:
            return i18nKey("reminders.setToday", { time });
        case 1:
            return i18nKey("reminders.setTomorrow", { time });
        default:
            return i18nKey("reminders.setOn", { date: format.date(at), time });
    }
}

// calendar days from `from`'s day to `to`'s (a DST change makes a day 23 or 25 hours long)
function daysBetween(from: Date, to: Date): number {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}
