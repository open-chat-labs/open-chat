/* eslint-disable @typescript-eslint/ban-ts-comment */
export type CountdownData = {
    total: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
};

export function startsInFromSeconds(totalSeconds: number): CountdownData {
    return startsInFromMilliseconds(totalSeconds * 1000);
}

export function startsIn(now: number, time: number): CountdownData {
    return startsInFromMilliseconds(time - now);
}

function startsInFromMilliseconds(total: number): CountdownData {
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

export function startsInFormatted({
    total,
    days,
    hours,
    minutes,
}: CountdownData): "days" | "hours" | "minutes" | "seconds" | "finished" {
    if (total < 0) return "finished";
    if (days > 0) {
        return "days";
    }
    if (hours > 0) {
        return "hours";
    }
    if (minutes > 0) {
        return "minutes";
    }
    return "seconds";
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
    expiry: bigint
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
