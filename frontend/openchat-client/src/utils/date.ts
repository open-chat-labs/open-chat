export function getStartOfToday(): Date {
    return getStartOfDay(new Date());
}

export function getStartOfDay(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    return new Date(year, month, day);
}

export function addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(date.getDate() + days);
    return copy;
}

export function addSeconds(date: Date, seconds: number): Date {
    const copy = new Date(date);
    copy.setSeconds(date.getSeconds() + seconds);
    return copy;
}

export function areOnSameDay(left: Date, right: Date): boolean {
    const dayLeft = left.getDate();
    const dayRight = right.getDate();

    if (dayLeft !== dayRight) return false;

    const monthLeft = left.getMonth();
    const monthRight = right.getMonth();

    if (monthLeft !== monthRight) return false;

    const yearLeft = left.getFullYear();
    const yearRight = right.getFullYear();

    return yearLeft === yearRight;
}

export function getMinutesSince(date: Date): number {
    const now = new Date();
    const diffMillis: number = now.getTime() - date.getTime();
    return diffMillis / 1000 / 60;
}

export function toMonthString(date: Date, locale: string): string {
    return date.toLocaleDateString(locale, { month: "long" });
}

export function toDayOfWeekString(date: Date): string {
    return date.toLocaleDateString(undefined, { weekday: "long" });
}

export function toDateString(date: Date): string {
    return date.toLocaleDateString();
}

export function toDatetimeString(date: Date): string {
    return `${date.toLocaleDateString()} ${toShortTimeString(date)}`;
}

export function toLongDateString(date: Date): string {
    const weekday = date.toLocaleDateString("en", { weekday: "long" });
    const dayOfMonth = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: "short" });
    const ordinal = getOrdinal(dayOfMonth);
    const year = date.getFullYear();

    return `${weekday} ${dayOfMonth}${ordinal} ${month} ${year}`;
}

export function toShortTimeString(date: Date): string {
    return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function getOrdinal(n: number): string {
    // TODO - Localise
    // Taken from https://stackoverflow.com/a/39466341
    return ["", "st", "nd", "rd"][(n / 10) % 10 ^ 1 && n % 10] || "th";
}

export function formatMessageDate(
    timestamp: bigint,
    today: string,
    yesterday: string,
    timeIfToday = false,
    short = false
): string {
    const date = new Date(Number(timestamp));

    const startOfToday = getStartOfToday();
    if (date >= startOfToday) {
        return timeIfToday ? toShortTimeString(date) : today;
    }
    const startOfYesterday = addDays(startOfToday, -1);
    if (date >= startOfYesterday) {
        return yesterday;
    }
    const useDayNameOnly = date >= addDays(startOfToday, -6);
    return useDayNameOnly
        ? toDayOfWeekString(date)
        : short
        ? toDateString(date)
        : toLongDateString(date);
}
