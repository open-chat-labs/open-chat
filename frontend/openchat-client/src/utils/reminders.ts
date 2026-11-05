import { i18nKey, type ResourceKey } from "@shared";

// When a message reminder goes off, as the old desktop reminder dialog offered it: a few preset
// times, or one the user picks.

/** A preset time for a reminder. */
export type ReminderPreset = "twentyMinutes" | "oneHour" | "threeHours" | "tomorrow" | "nextWeek";

/** The presets offered, in order. */
export const REMINDER_PRESETS: readonly ReminderPreset[] = [
    "twentyMinutes",
    "oneHour",
    "threeHours",
    "tomorrow",
    "nextWeek",
];

const MINUTE = 60 * 1000;

/** A preset as the reminder dialog lists it. */
export function reminderPresetText(preset: ReminderPreset): ResourceKey {
    return i18nKey(`reminders.${preset}`);
}

/**
 * When a reminder set `now` (ms) with a preset goes off (ms): in 20 minutes, an hour or three
 * hours; tomorrow at 9am; or next week, the coming Monday at 9am (a week on, set on a Monday), in
 * the device's time zone.
 */
export function reminderTime(preset: ReminderPreset, now: number): number {
    switch (preset) {
        case "twentyMinutes":
            return now + 20 * MINUTE;
        case "oneHour":
            return now + 60 * MINUTE;
        case "threeHours":
            return now + 180 * MINUTE;
        case "tomorrow":
            return atNine(now, 1);
        case "nextWeek": {
            const day = new Date(now).getDay();
            return atNine(now, (1 + 7 - day) % 7 || 7);
        }
    }
}

// 9am, `days` days after the day of `now`
function atNine(now: number, days: number): number {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    return date.getTime();
}
