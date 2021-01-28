export function getStartOfToday() : Date {
    return getStartOfDay(new Date());
}

export function getStartOfDay(date: Date) : Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    return new Date(year, month, day);
}

export function addDays(date: Date, days: number) : Date {
    const copy = new Date(date);
    copy.setDate(date.getDate() + days);
    return copy;
}

export function areOnSameDay(left: Date, right: Date) : boolean {
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
