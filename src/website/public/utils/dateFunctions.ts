export function getStartOfToday() : Date {
    const now = new Date();

    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDay = now.getDate();

    return new Date(nowYear, nowMonth, nowDay);
}

export function addDays(date: Date, days: number) : Date {
    const copy = new Date(date);
    copy.setDate(date.getDate() + days);
    return copy;
}
