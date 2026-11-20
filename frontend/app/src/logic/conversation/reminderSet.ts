import {
    i18nKey,
    OPENCHAT_BOT_USER_ID,
    routeForChatIdentifier,
    routeForMessage,
    type DirectChatIdentifier,
    type ResourceKey,
} from "@client";

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
 * reminder set at `now` (ms) goes off at `remindAt` (ms), by the device's calendar days. A time on
 * an earlier day than `now` (a custom time just before midnight, set just after it) says today.
 */
export function reminderSetText(
    remindAt: number,
    now: number,
    format: ReminderTimeFormat,
): ResourceKey {
    const at = new Date(remindAt);
    const time = format.time(at);
    const days = daysBetween(new Date(now), at);
    if (days <= 0) return i18nKey("reminders.setToday", { time });
    if (days === 1) return i18nKey("reminders.setTomorrow", { time });
    return i18nKey("reminders.setOn", { date: format.date(at), time });
}

// calendar days from `from`'s day to `to`'s (a DST change makes a day 23 or 25 hours long)
function daysBetween(from: Date, to: Date): number {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

/** The user's DM with the OpenChat Bot, where its "I will remind you…" lands. */
export const OPENCHAT_BOT_DM: DirectChatIdentifier = {
    kind: "direct_chat",
    userId: OPENCHAT_BOT_USER_ID,
};

/** What View reads of the bot DM (a `ChatSummary` is one). */
export type BotDmLatest = { latestMessage?: { event: { messageIndex: number } } };

/**
 * Where the toast's View goes: the OpenChat Bot's DM (`botDm`, as the chat list has it) at its
 * latest message, which is the bot's "I will remind you…" once it has synced, rather than at its
 * first unread (older reminders that went off, confirmations never opened). Before the DM has a
 * message, the DM as a chat opens.
 */
export function reminderConfirmationRoute(botDm: BotDmLatest | undefined): string {
    const latest = botDm?.latestMessage?.event.messageIndex;
    return latest === undefined
        ? routeForChatIdentifier("chats", OPENCHAT_BOT_DM)
        : routeForMessage("chats", { chatId: OPENCHAT_BOT_DM }, latest);
}
