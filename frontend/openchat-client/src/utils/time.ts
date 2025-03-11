/* eslint-disable @typescript-eslint/ban-ts-comment */

import type { MessageFormatter } from "openchat-shared";

type DurationData = {
    total: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
};

export function formatDisappearingMessageTime(
    milliseconds: number,
    formatter: MessageFormatter,
): string {
    const duration = durationFromMilliseconds(milliseconds);

    if (duration.days > 0)
        return duration.days === 1
            ? formatter("oneDay")
            : formatter("durationDays", { values: { duration: duration.days } });

    if (duration.hours > 0)
        return duration.hours === 1
            ? formatter("oneHour")
            : formatter("durationHours", { values: { duration: duration.hours } });

    return duration.minutes === 1
        ? formatter("disappearingMessages.oneMinute")
        : formatter("disappearingMessages.durationMinutes", {
              values: { duration: duration.minutes },
          });
}

export function startsIn(now: number, time: number): DurationData {
    return durationFromMilliseconds(time - now);
}

export function durationFromMilliseconds(total: number): DurationData {
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor((total / (1000 * 60 * 60 * 24)));
    return {
        total,
        days,
        hours,
        minutes,
        seconds,
    };
}

function pad(num: number): string {
    return num.toString().padStart(2, "0");
}

export function formatDuration(ms: number): string {
    const { days, hours, minutes, seconds } = durationFromMilliseconds(ms);
    let result = "";
    if (days > 0) {
        result += `${pad(days)}d `;
    }
    if (hours > 0) {
        result += `${hours}h `;
    }
    if (minutes > 0) {
        result += `${minutes}m `;
    }
    if (seconds > 0) {
        result += `${seconds}s `;
    }
    return result;
}

export function formatTimeRemaining(
    now: number,
    deadline: number,
    excludeDays: boolean = false,
): string {
    const { days, hours, minutes, seconds } = startsIn(now, deadline);

    let text = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    if (!excludeDays) {
        text = `${pad(days)}:` + text;
    }

    return text;
}

const defaultFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const formatters: Record<string, Intl.RelativeTimeFormat> = {
    en: new Intl.RelativeTimeFormat("en", { numeric: "auto" }),
};

const timeDivisions = [
    { amount: 60, name: "seconds" },
    { amount: 60, name: "minutes" },
    { amount: 24, name: "hours" },
    { amount: 365.25, name: "days" },
    { amount: Number.POSITIVE_INFINITY, name: "years" },
];

export function formatRelativeTime(
    now: number,
    locale: string | null | undefined,
    expiry: bigint,
): string | undefined {
    let duration = (Number(expiry) - now) / 1000;
    for (let i = 0; i <= timeDivisions.length; i++) {
        const division = timeDivisions[i];
        if (Math.abs(duration) < division.amount) {
            if (locale && !formatters[locale]) {
                formatters[locale] = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
            }
            const formatter = locale ? formatters[locale] : defaultFormatter;
            //@ts-ignore
            return formatter.format(Math.round(duration), division.name);
        }
        duration /= division.amount;
    }
}
