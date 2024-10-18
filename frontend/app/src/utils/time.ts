import { ONE_DAY, ONE_HOUR, ONE_MINUTE_MILLIS, ONE_MONTH, ONE_WEEK } from "openchat-client";

export function msToMinutes(ms: number): number {
    return Math.floor(ms / ONE_MINUTE_MILLIS);
}

export function msToHours(ms: number): number {
    return Math.floor(ms / ONE_HOUR);
}

export function msToDays(ms: number): number {
    return Math.floor(ms / ONE_DAY);
}

export function msToWeeks(ms: number): number {
    return Math.floor(ms / ONE_WEEK);
}

export function msToMonths(ms: number): number {
    return Math.floor(ms / ONE_MONTH);
}
