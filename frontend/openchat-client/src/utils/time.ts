/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { MessageFormatter } from "./i18n";

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
        ? formatter("oneMinute")
        : formatter("durationMinutes", { values: { duration: duration.minutes } });
}

export function startsIn(now: number, time: number): DurationData {
    return durationFromMilliseconds(time - now);
}

export function durationFromMilliseconds(total: number): DurationData {
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    return {
        total,
        days,
        hours,
        minutes,
        seconds,
    };
}

export function formatTimeRemaining(now: number, deadline: number): string {
    function pad(num: number): string {
        return num.toString().padStart(2, "0");
    }

    const data = startsIn(now, deadline);
    return `${pad(data.days)}:${pad(data.hours)}:${pad(data.minutes)}:${pad(data.seconds)}`;
}

const defaultFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const formatters: Record<string, Intl.RelativeTimeFormat> = {
    en: new Intl.RelativeTimeFormat("en", { numeric: "auto" }),
};

const timeDivisions = [
    { amount: 60, name: "seconds" },
    { amount: 60, name: "minutes" },
    { amount: 24, name: "hours" },
    { amount: 7, name: "days" },
    { amount: 4.34524, name: "weeks" },
    { amount: 12, name: "months" },
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
