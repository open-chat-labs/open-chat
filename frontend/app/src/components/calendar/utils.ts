export function getTitleText(year: number, month: number, locale: string): string {
    const date = new Date(year, month, 1);
    const formatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
    return formatter.format(date);
}

function getCalendarDates(year: number, month: number): Date[] {
    const dates: Date[] = [];
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const lastDayDate = lastDayOfMonth.getDate();
    const lastDayWeekday = lastDayOfMonth.getDay();

    const daysFromPrevMonth = firstDayWeekday;
    for (let i = 0; i < daysFromPrevMonth; i++) {
        dates.push(new Date(year, month, i - daysFromPrevMonth + 1));
    }

    for (let day = 1; day <= lastDayDate; day++) {
        dates.push(new Date(year, month, day));
    }

    const daysFromNextMonth = 6 - lastDayWeekday;
    for (let i = 1; i <= daysFromNextMonth; i++) {
        dates.push(new Date(year, month + 1, i));
    }

    while (dates.length % 7 !== 0) {
        const lastDate = dates[dates.length - 1];
        dates.push(new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1));
    }

    return dates;
}

export const getMonthCalendar = (currDate: Date) => {
    const date = new Date(currDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const dates = getCalendarDates(year, month);
    return {
        month: month,
        year: year,
        dates: chunk(dates, 7),
    };
};

function chunk<T>(array: T[], size: number): T[][] {
    const chunkCount = Math.floor((array.length - 1) / size) + 1;
    const chunks: T[][] = [];

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
        const start = chunkIndex * size;
        const end = start + size;
        chunks.push(array.slice(start, end));
    }

    return chunks;
}

export const isSameDay = (d1: Date, d2: Date) => {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
};
