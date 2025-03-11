import { ONE_DAY, ONE_HOUR, ONE_MINUTE_MILLIS } from "openchat-client";

export function msToMinutes(ms: number): number {
    return Math.floor(ms / ONE_MINUTE_MILLIS);
}

export function msToHours(ms: number): number {
    return Math.floor(ms / ONE_HOUR);
}

export function msToDays(ms: number): number {
    return Math.floor(ms / ONE_DAY);
}
