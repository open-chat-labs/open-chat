// Characterisation tests for the date formatters. These run per message /
// per list row, so they are being memoised; the assertions below pin down the
// CURRENT output for a handful of fixed dates and locales so the memoisation
// can be verified not to change any result.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    formatDateLong,
    formatMessageDate,
    getSmartDateHeader,
    getStartOfToday,
    toDateString,
    toDatetimeString,
    toDayOfWeekString,
    toLongDateString,
    toMonthString,
    toShortTimeString,
} from "./date";

const LOCALES = ["en-GB", "fr-FR", "de-DE"];

// Constructed from local date parts so the formatted output is independent of
// the timezone the test run happens to be in.
const FRIDAY = new Date(2026, 0, 16, 13, 45, 30);
const SUNDAY = new Date(2024, 6, 7, 9, 5, 0);
const LEAP_DAY = new Date(2020, 1, 29, 23, 59, 59);
const DATES = [FRIDAY, SUNDAY, LEAP_DAY];

function forEachCase(fn: (date: Date, locale: string) => void) {
    for (const date of DATES) {
        for (const locale of LOCALES) {
            fn(date, locale);
        }
    }
}

describe("date formatters", () => {
    test("toMonthString", () => {
        expect(toMonthString(FRIDAY, "en-GB")).toBe("January");
        expect(toMonthString(FRIDAY, "fr-FR")).toBe("janvier");
        expect(toMonthString(FRIDAY, "de-DE")).toBe("Januar");
        expect(toMonthString(SUNDAY, "en-GB")).toBe("July");
        expect(toMonthString(LEAP_DAY, "de-DE")).toBe("Februar");
    });

    test("toDayOfWeekString", () => {
        expect(toDayOfWeekString(FRIDAY, "en-GB")).toBe("Friday");
        expect(toDayOfWeekString(FRIDAY, "fr-FR")).toBe("vendredi");
        expect(toDayOfWeekString(FRIDAY, "de-DE")).toBe("Freitag");
        expect(toDayOfWeekString(SUNDAY, "en-GB")).toBe("Sunday");
        expect(toDayOfWeekString(LEAP_DAY, "fr-FR")).toBe("samedi");
    });

    test("toDateString", () => {
        expect(toDateString(FRIDAY, "en-GB")).toBe("16/01/2026");
        expect(toDateString(FRIDAY, "fr-FR")).toBe("16/01/2026");
        expect(toDateString(FRIDAY, "de-DE")).toBe("16.1.2026");
        expect(toDateString(SUNDAY, "en-GB")).toBe("07/07/2024");
        expect(toDateString(LEAP_DAY, "de-DE")).toBe("29.2.2020");
    });

    test("toDatetimeString", () => {
        expect(toDatetimeString(FRIDAY, "en-GB")).toBe("16/01/2026 13:45");
        expect(toDatetimeString(FRIDAY, "de-DE")).toBe("16.1.2026 13:45");
        expect(toDatetimeString(SUNDAY, "fr-FR")).toBe("07/07/2024 09:05");
    });

    test("toLongDateString", () => {
        expect(toLongDateString(FRIDAY, "en-GB")).toBe("Friday 16th Jan 2026");
        expect(toLongDateString(FRIDAY, "fr-FR")).toBe("vendredi 16th janv. 2026");
        expect(toLongDateString(FRIDAY, "de-DE")).toBe("Freitag 16th Jan 2026");
        expect(toLongDateString(SUNDAY, "en-GB")).toBe("Sunday 7th Jul 2024");
        expect(toLongDateString(LEAP_DAY, "en-GB")).toBe("Saturday 29th Feb 2020");
    });

    test("toShortTimeString", () => {
        expect(toShortTimeString(FRIDAY, "en-GB")).toBe("13:45");
        expect(toShortTimeString(SUNDAY, "de-DE")).toBe("09:05");
        expect(toShortTimeString(LEAP_DAY, "fr-FR")).toBe("23:59");
    });

    test("formatDateLong", () => {
        expect(formatDateLong(FRIDAY, "en-GB")).toBe("Friday 16 Jan 2026");
        expect(formatDateLong(FRIDAY, "fr-FR")).toBe("vendredi 16 janv. 2026");
        expect(formatDateLong(FRIDAY, "de-DE")).toBe("Freitag 16. Jan. 2026");
        expect(formatDateLong(SUNDAY, "en-GB")).toBe("Sunday 7 Jul 2024");
        // defaults to en-GB
        expect(formatDateLong(LEAP_DAY)).toBe("Saturday 29 Feb 2020");
        // accepts bigint and number as well as Date
        expect(formatDateLong(BigInt(FRIDAY.getTime()), "en-GB")).toBe("Friday 16 Jan 2026");
        expect(formatDateLong(FRIDAY.getTime(), "en-GB")).toBe("Friday 16 Jan 2026");
    });

    test("repeated calls return identical strings", () => {
        forEachCase((date, locale) => {
            expect(toMonthString(date, locale)).toBe(toMonthString(date, locale));
            expect(toDayOfWeekString(date, locale)).toBe(toDayOfWeekString(date, locale));
            expect(toDateString(date, locale)).toBe(toDateString(date, locale));
            expect(toDatetimeString(date, locale)).toBe(toDatetimeString(date, locale));
            expect(toLongDateString(date, locale)).toBe(toLongDateString(date, locale));
            expect(toShortTimeString(date, locale)).toBe(toShortTimeString(date, locale));
            expect(formatDateLong(date, locale)).toBe(formatDateLong(date, locale));
        });
    });

    test("interleaving locales does not leak formatter state", () => {
        // en -> fr -> en etc, to catch a memo keyed on the wrong thing
        for (let i = 0; i < 3; i++) {
            expect(toDayOfWeekString(FRIDAY, "en-GB")).toBe("Friday");
            expect(toDayOfWeekString(FRIDAY, "fr-FR")).toBe("vendredi");
            expect(toLongDateString(FRIDAY, "de-DE")).toBe("Freitag 16th Jan 2026");
            expect(formatDateLong(FRIDAY, "fr-FR")).toBe("vendredi 16 janv. 2026");
            expect(formatDateLong(FRIDAY, "en-GB")).toBe("Friday 16 Jan 2026");
            expect(toDateString(FRIDAY, "de-DE")).toBe("16.1.2026");
            expect(toDateString(FRIDAY, "en-GB")).toBe("16/01/2026");
        }
    });
});

describe("formatter memoisation", () => {
    // A locale not used by any other test in this file, so the module level
    // caches are guaranteed to be cold for it.
    const LOCALE = "en-AU";

    // Counts `new Intl.DateTimeFormat(...)` calls while still handing back a
    // real formatter.
    function countConstructions(run: () => void): number {
        const original = Intl.DateTimeFormat;
        let count = 0;
        Intl.DateTimeFormat = function (
            ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
        ) {
            count++;
            return new original(...args);
        } as unknown as typeof Intl.DateTimeFormat;
        try {
            run();
        } finally {
            Intl.DateTimeFormat = original;
        }
        return count;
    }

    test("one Intl.DateTimeFormat per locale is constructed per option set", () => {
        const count = countConstructions(() => {
            for (let i = 0; i < 5; i++) {
                toMonthString(FRIDAY, LOCALE);
                toDayOfWeekString(FRIDAY, LOCALE);
                toDateString(FRIDAY, LOCALE);
                toShortTimeString(FRIDAY, LOCALE);
                toLongDateString(FRIDAY, LOCALE);
                formatDateLong(FRIDAY, LOCALE);
            }
        });

        // month long, weekday long, plain date, short time, month short, long date
        expect(count).toBe(6);
    });

    test("a second locale gets its own formatters", () => {
        toDayOfWeekString(FRIDAY, "en-NZ");
        expect(countConstructions(() => toDayOfWeekString(FRIDAY, "en-NZ"))).toBe(0);
        expect(countConstructions(() => toDayOfWeekString(FRIDAY, "en-IE"))).toBe(1);
        expect(toDayOfWeekString(FRIDAY, "en-IE")).toBe("Friday");
    });
});

describe("date formatters relative to now", () => {
    // Wednesday 21 Jan 2026, local time
    const NOW = new Date(2026, 0, 21, 10, 0, 0);

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function at(daysAgo: number, hour = 10): bigint {
        const d = new Date(2026, 0, 21 - daysAgo, hour, 0, 0);
        return BigInt(d.getTime());
    }

    test("getStartOfToday", () => {
        expect(getStartOfToday().getTime()).toBe(new Date(2026, 0, 21).getTime());
        // repeated calls agree, and the returned Date is not shared
        const first = getStartOfToday();
        const second = getStartOfToday();
        expect(second.getTime()).toBe(first.getTime());
        expect(second).not.toBe(first);
    });

    test("getStartOfToday follows the clock over a day boundary", () => {
        expect(getStartOfToday().getTime()).toBe(new Date(2026, 0, 21).getTime());
        vi.setSystemTime(new Date(2026, 0, 21, 23, 59, 59));
        expect(getStartOfToday().getTime()).toBe(new Date(2026, 0, 21).getTime());
        vi.setSystemTime(new Date(2026, 0, 22, 0, 0, 1));
        expect(getStartOfToday().getTime()).toBe(new Date(2026, 0, 22).getTime());
        // and backwards, in case the system clock is corrected
        vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0));
        expect(getStartOfToday().getTime()).toBe(new Date(2026, 0, 20).getTime());
    });

    test("formatMessageDate", () => {
        expect(formatMessageDate(0n, "Today", "Yesterday", "en-GB")).toBe("");
        expect(formatMessageDate(at(0), "Today", "Yesterday", "en-GB")).toBe("Today");
        expect(formatMessageDate(at(0), "Today", "Yesterday", "en-GB", true)).toBe("10:00");
        expect(formatMessageDate(at(1), "Today", "Yesterday", "en-GB")).toBe("Yesterday");
        expect(formatMessageDate(at(1), "Today", "Yesterday", "en-GB", true)).toBe("Yesterday");
        // 2-6 days ago -> day name
        expect(formatMessageDate(at(2), "Today", "Yesterday", "en-GB")).toBe("Monday");
        expect(formatMessageDate(at(2), "Today", "Yesterday", "fr-FR")).toBe("lundi");
        expect(formatMessageDate(at(6), "Today", "Yesterday", "de-DE")).toBe("Donnerstag");
        // 7+ days ago -> long date, or short date when `short` is set
        expect(formatMessageDate(at(7), "Today", "Yesterday", "en-GB")).toBe(
            "Wednesday 14th Jan 2026",
        );
        expect(formatMessageDate(at(7), "Today", "Yesterday", "en-GB", false, true)).toBe(
            "14/01/2026",
        );
        expect(formatMessageDate(at(7), "Today", "Yesterday", "de-DE", false, true)).toBe(
            "14.1.2026",
        );
    });

    test("formatMessageDate is stable across repeated calls", () => {
        for (const daysAgo of [0, 1, 3, 10]) {
            for (const locale of LOCALES) {
                const first = formatMessageDate(at(daysAgo), "Today", "Yesterday", locale);
                expect(formatMessageDate(at(daysAgo), "Today", "Yesterday", locale)).toBe(first);
            }
        }
    });

    test("getSmartDateHeader", () => {
        expect(getSmartDateHeader(at(0), "en-GB")).toBe("Today");
        expect(getSmartDateHeader(at(1), "en-GB")).toBe("Yesterday");
        expect(getSmartDateHeader(at(0), "en-GB", { today: "Aujourd'hui", yesterday: "Hier" })).toBe(
            "Aujourd'hui",
        );
        expect(getSmartDateHeader(at(1), "en-GB", { today: "Aujourd'hui", yesterday: "Hier" })).toBe(
            "Hier",
        );
        // > 1 and <= 4 days since -> weekday name
        expect(getSmartDateHeader(at(2), "en-GB")).toBe("Monday");
        expect(getSmartDateHeader(at(2), "fr-FR")).toBe("lundi");
        expect(getSmartDateHeader(at(4), "de-DE")).toBe("Samstag");
        // beyond that -> full date
        expect(getSmartDateHeader(at(5), "en-GB")).toBe("Friday 16 Jan 2026");
        expect(getSmartDateHeader(at(5), "fr-FR")).toBe("vendredi 16 janv. 2026");
        // defaults to en-GB
        expect(getSmartDateHeader(at(5))).toBe("Friday 16 Jan 2026");
    });

    test("getSmartDateHeader is stable across repeated calls", () => {
        for (const daysAgo of [0, 1, 2, 5]) {
            for (const locale of LOCALES) {
                const first = getSmartDateHeader(at(daysAgo), locale);
                expect(getSmartDateHeader(at(daysAgo), locale)).toBe(first);
            }
        }
    });
});
