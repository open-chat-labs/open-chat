export const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
export const weekDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export type ViewType = "month" | "year" | "decade";

export const getMonthCalendar = (currDate: Date) => {
    const date = new Date(currDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const noOfDays = new Date(year, month + 1, 0).getDate();
    const startingDayInWeek = new Date(year, month, 1).getDay() + 1;
    const daysDistribution = [];
    for (let i = 1; i < startingDayInWeek + noOfDays; i++) {
        if (i < startingDayInWeek) {
            daysDistribution.push("");
        } else {
            daysDistribution.push(i - startingDayInWeek + 1);
        }
    }
    return {
        month: month,
        year: year,
        daysDistribution: chunk(daysDistribution, 7),
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

export const isSameMonth = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
};

export const getYearRange = (year: number) => {
    const lastChar = `${year}`.substring(`${year}`.length - 1);
    const yearToBeDeducted = Number(lastChar);
    const startYear = year - yearToBeDeducted;
    const endYear = year + (10 - yearToBeDeducted);
    const years = [];
    for (let i = startYear; i <= endYear; i++) {
        years.push(i);
    }
    return {
        startYear: year - yearToBeDeducted,
        endYear: year + (10 - yearToBeDeducted),
        years,
    };
};
