export function toDayOfWeekString(date: Date) : string {
    return date.toLocaleDateString(undefined, { weekday: "long" });
}

export function toDateString(date: Date) {
    return date.toLocaleDateString();
}

export function toLongDateString(date: Date) : string {
    const weekday = date.toLocaleDateString("en", { weekday: "long" });
    const dayOfMonth = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: "short" });
    const ordinal = getOrdinal(dayOfMonth);
    const year = date.getFullYear();

    return `${weekday} ${dayOfMonth}${ordinal} ${month} ${year}`;
}

export function toShortTimeString(date: Date) : string {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getOrdinal(n: number) : string {
    // TODO - Localise
    // Taken from https://stackoverflow.com/a/39466341
    return [,"st","nd","rd"][n/10%10^1&&n%10]||"th";
}
