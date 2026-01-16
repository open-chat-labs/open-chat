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

export function getSecondsSince(date: Date): number {
    const now = new Date();
    const diffMillis: number = now.getTime() - date.getTime();
    return diffMillis / 1000;
}

export function getMinutesSince(date: Date): number {
    const diffSeconds = getSecondsSince(date);
    return diffSeconds / 60;
}

export function getDaysSince(date: Date): number {
    const diffSeconds = getSecondsSince(date);
    return diffSeconds / 60 / 60 / 24;
}

export function toMonthString(date: Date, locale: string): string {
    return date.toLocaleDateString(locale, { month: "long" });
}

export function toDayOfWeekString(date: Date, locale: string): string {
    return date.toLocaleDateString(locale, { weekday: "long" });
}

export function toDateString(date: Date, locale: string): string {
    return date.toLocaleDateString(locale);
}

export function toDatetimeString(date: Date, locale: string): string {
    return `${date.toLocaleDateString(locale)} ${toShortTimeString(date, locale)}`;
}

export function toLongDateString(date: Date, locale: string): string {
    const weekday = date.toLocaleDateString(locale, { weekday: "long" });
    const dayOfMonth = date.getDate();
    const month = date.toLocaleDateString(locale, { month: "short" });
    const ordinal = getOrdinal(dayOfMonth);
    const year = date.getFullYear();

    return `${weekday} ${dayOfMonth}${ordinal} ${month} ${year}`;
}

const shortTimeFormatters: Record<string, Intl.DateTimeFormat> = {};

export function toShortTimeString(date: Date, locale: string): string {
    if (shortTimeFormatters[locale] === undefined) {
        shortTimeFormatters[locale] = new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        });
    }
    return shortTimeFormatters[locale].format(date);
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
    locale: string,
    timeIfToday = false,
    short = false,
): string {
    if (timestamp === 0n) return "";

    const date = new Date(Number(timestamp));

    const startOfToday = getStartOfToday();
    if (date >= startOfToday) {
        return timeIfToday ? toShortTimeString(date, locale) : today;
    }
    const startOfYesterday = addDays(startOfToday, -1);
    if (date >= startOfYesterday) {
        return yesterday;
    }
    const useDayNameOnly = date >= addDays(startOfToday, -6);
    return useDayNameOnly
        ? toDayOfWeekString(date, locale)
        : short
          ? toDateString(date, locale)
          : toLongDateString(date, locale);
}

// Normalising provided data
function inputToDate(input: bigint | number | Date): Date {
    return input instanceof Date
        ? input
        : new Date(typeof input === "bigint" ? Number(input) : input);
}

// TODO i18n localise!
export function toRelativeTime(
    input: bigint | number | Date,
    opts = { year: "y", month: "mo", week: "w", day: "d", hour: "h", minute: "min" },
) {
    const inputDate = inputToDate(input);
    const secondsDiff = getSecondsSince(inputDate);

    // Define intervals in seconds
    const units = [
        { label: opts.year, seconds: 31536000 },
        { label: opts.month, seconds: 2592000 },
        { label: opts.week, seconds: 520200 },
        { label: opts.day, seconds: 86400 },
        { label: opts.hour, seconds: 3600 },
        { label: opts.minute, seconds: 60 },
    ];

    for (const unit of units) {
        if (secondsDiff >= unit.seconds) {
            const value = Math.round(secondsDiff / unit.seconds);
            return `${value} ${unit.label}`;
        }
    }

    return "now";
}

// Formats dates with the following format: Friday 16 Jan 2026.
// Handles i18n via Intl date formatter!
export function formatDateLong(input: bigint | number | Date, locale = "en-GB"): string {
    const date = inputToDate(input);
    const formatter = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    // Intl usually adds commas (e.g., "Friday, 16 Jan 2026") so we remove them!
    return formatter.format(date).replace(/,/g, "");
}

// Returns 'Today', 'Yesterday', 'Weekday', or the full formatted date
export function getSmartDateHeader(
    input: bigint | number | Date,
    locale = "en-GB",
    opts: { today: string; yesterday: string } = { today: "Today", yesterday: "Yesterday" },
): string {
    const date = inputToDate(input);

    const today = new Date();
    if (areOnSameDay(date, today)) return opts.today;

    const yesterday = addDays(today, -1);
    if (areOnSameDay(date, yesterday)) return opts.yesterday;

    const daysSince = getDaysSince(date);
    if (daysSince > 1 && daysSince <= 4) {
        return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
    }

    return formatDateLong(date, locale);
}
