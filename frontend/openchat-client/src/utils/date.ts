// Memoised for the current day. `startOfTodayMillis` is only reused while
// `now` is still within [start of today, start of tomorrow), so it survives DST
// transitions and is recomputed as soon as the day rolls over.
let startOfTodayMillis = 0;
let startOfTomorrowMillis = 0;

export function getStartOfToday(): Date {
    const now = Date.now();
    if (now < startOfTodayMillis || now >= startOfTomorrowMillis) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        startOfTodayMillis = new Date(year, month, day).getTime();
        startOfTomorrowMillis = new Date(year, month, day + 1).getTime();
    }
    return new Date(startOfTodayMillis);
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

// These formatters are used per message / per list row, so one instance is
// cached per locale for each distinct set of options rather than constructing
// a new `Intl.DateTimeFormat` on every call.
function memoisedFormatter(
    cache: Record<string, Intl.DateTimeFormat>,
    locale: string,
    options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
    let formatter = cache[locale];
    if (formatter === undefined) {
        formatter = new Intl.DateTimeFormat(locale, options);
        cache[locale] = formatter;
    }
    return formatter;
}

const longMonthFormatters: Record<string, Intl.DateTimeFormat> = {};
const shortMonthFormatters: Record<string, Intl.DateTimeFormat> = {};
const dayOfWeekFormatters: Record<string, Intl.DateTimeFormat> = {};
const dateFormatters: Record<string, Intl.DateTimeFormat> = {};
const longDateFormatters: Record<string, Intl.DateTimeFormat> = {};
const shortTimeFormatters: Record<string, Intl.DateTimeFormat> = {};

export function toMonthString(date: Date, locale: string): string {
    return memoisedFormatter(longMonthFormatters, locale, { month: "long" }).format(date);
}

export function toDayOfWeekString(date: Date, locale: string): string {
    return memoisedFormatter(dayOfWeekFormatters, locale, { weekday: "long" }).format(date);
}

export function toDateString(date: Date, locale: string): string {
    return memoisedFormatter(dateFormatters, locale).format(date);
}

export function toDatetimeString(date: Date, locale: string): string {
    return `${toDateString(date, locale)} ${toShortTimeString(date, locale)}`;
}

export function toLongDateString(date: Date, locale: string): string {
    const weekday = toDayOfWeekString(date, locale);
    const dayOfMonth = date.getDate();
    const month = memoisedFormatter(shortMonthFormatters, locale, { month: "short" }).format(date);
    const ordinal = getOrdinal(dayOfMonth);
    const year = date.getFullYear();

    return `${weekday} ${dayOfMonth}${ordinal} ${month} ${year}`;
}

export function toShortTimeString(date: Date, locale: string): string {
    return memoisedFormatter(shortTimeFormatters, locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(date);
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
    const formatter = memoisedFormatter(longDateFormatters, locale, {
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
        return toDayOfWeekString(date, locale);
    }

    return formatDateLong(date, locale);
}
